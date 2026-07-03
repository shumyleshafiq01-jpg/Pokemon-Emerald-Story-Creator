#!/usr/bin/env node
/**
 * Applies a Story Builder JSON package into pokeemerald-expansion source.
 *
 * Strategy: OVERWRITE the `.string` body of real, already-compiled text labels.
 * We never invent new files (those are never linked into the build) and we never
 * trust the AI-supplied `vanillaEvent` field (the model hallucinates decomp symbol
 * names). Instead scripts/scene-map.json maps each scene slug to grep-verified
 * text labels in the checked-out source. Because we only change the words inside
 * existing text, all event/flag/warp/battle logic is preserved — no soft-locks.
 *
 * Usage: node scripts/apply-story.mjs <story-package.json> <expansionRoot> [sceneMap.json]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyStructuralHacks } from "./structural-hacks.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const storyJsonPath = process.argv[2] || "story-package.json";
const expansionRoot =
  process.argv[3] || path.join("hack", "pokeemerald-expansion");
const sceneMapPath = process.argv[4] || path.join(__dirname, "scene-map.json");

const GBA_TEXTBOX_CHARS = 34; // approx chars per visible line at default font
const LINES_PER_BOX = 2; // default message box shows 2 lines before scrolling
const MAX_BOXES_PER_ANCHOR = 6; // safety cap so a label can't balloon

const pkg = JSON.parse(fs.readFileSync(storyJsonPath, "utf8"));
const sceneMap = JSON.parse(fs.readFileSync(sceneMapPath, "utf8")).scenes || {};

const report = { applied: [], skipped: [], missingAnchors: [] };
const dirtyFiles = new Map(); // absPath -> lines[]

for (const scene of pkg.scenes) {
  const entry = sceneMap[scene.id];
  if (!entry) {
    report.skipped.push({ id: scene.id, reason: "no mapping in scene-map.json" });
    continue;
  }

  const absPath = path.join(expansionRoot, entry.file);
  if (!fs.existsSync(absPath)) {
    report.skipped.push({ id: scene.id, reason: `file not found: ${entry.file}` });
    continue;
  }

  let lines = dirtyFiles.get(absPath) || fs.readFileSync(absPath, "utf8").split(/\r?\n/);

  const boxes = dialogueToBoxes(scene.dialogue);
  if (boxes.length === 0) {
    report.skipped.push({ id: scene.id, reason: "no non-empty dialogue" });
    continue;
  }

  const anchors = entry.anchors || [];
  const chunks = splitAcross(boxes, anchors.length);

  let anyAnchorHit = false;
  anchors.forEach((label, i) => {
    const chunk = chunks[i];
    if (!chunk || chunk.length === 0) return;
    const result = overwriteStringLabel(lines, label, boxesToGbaString(chunk));
    if (result.ok) {
      lines = result.lines;
      anyAnchorHit = true;
      report.applied.push({ id: scene.id, label, boxes: chunk.length });
    } else {
      report.missingAnchors.push({ id: scene.id, label });
    }
  });

  if (anyAnchorHit) dirtyFiles.set(absPath, lines);
  else report.skipped.push({ id: scene.id, reason: "none of its anchors were found in source" });
}

for (const [absPath, lines] of dirtyFiles) {
  fs.writeFileSync(absPath, lines.join("\n"));
}

// Write a coverage report next to the story package for debugging.
const reportPath = path.join(path.dirname(storyJsonPath), "apply-report.json");
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

console.log(
  `Story apply: ${report.applied.length} anchors overwritten across ${dirtyFiles.size} file(s); ` +
    `${report.skipped.length} scene(s) skipped, ${report.missingAnchors.length} anchor(s) missing.`,
);
for (const s of report.skipped) console.log(`  - skipped ${s.id}: ${s.reason}`);
for (const m of report.missingAnchors) console.log(`  - missing anchor ${m.label} (${m.id})`);

if (report.applied.length === 0) {
  console.error(
    "::error::Story apply changed NOTHING — the ROM would be identical to vanilla. " +
      "Check scripts/scene-map.json anchors against the source.",
  );
  process.exit(1);
}

// Gameplay changes ride along with the dialogue pass (invoked here rather than
// as a separate workflow step: the CI token cannot modify workflow files).
applyStructuralHacks(expansionRoot);

// ---------------------------------------------------------------------------

/** Turn a scene's dialogue array into an array of "boxes" (each box = 1-2 wrapped lines). */
function dialogueToBoxes(dialogue) {
  const boxes = [];
  for (const d of dialogue || []) {
    const raw = (d.line || "").trim();
    if (!raw) continue; // silent PLAYER lines etc.
    const speaker = (d.speaker || "").trim().toUpperCase();
    const prefix = speaker && speaker !== "NARRATOR" ? `${speaker}: ` : "";
    const text = sanitizeToGba(prefix + raw);
    const wrapped = wordWrap(text, GBA_TEXTBOX_CHARS);
    for (let i = 0; i < wrapped.length; i += LINES_PER_BOX) {
      boxes.push(wrapped.slice(i, i + LINES_PER_BOX));
    }
  }
  return boxes.slice(0, MAX_BOXES_PER_ANCHOR * Math.max(1, boxes.length));
}

/** Distribute boxes across n anchors as evenly as possible, preserving order. */
function splitAcross(boxes, n) {
  if (n <= 1) return [boxes];
  const per = Math.ceil(boxes.length / n);
  const out = [];
  for (let i = 0; i < n; i++) out.push(boxes.slice(i * per, (i + 1) * per));
  return out;
}

/** Render boxes to a single pokeemerald .string body: `\n` between lines, `\p` between boxes, `$` terminator. */
function boxesToGbaString(boxes) {
  const capped = boxes.slice(0, MAX_BOXES_PER_ANCHOR);
  const rendered = capped
    .map((box) => box.join("\\n"))
    .join("\\p");
  return rendered + "$";
}

/**
 * Replace the contiguous run of `.string` lines that follow `label::` with a single
 * new `.string "<body>"`. Returns { ok, lines }.
 */
function overwriteStringLabel(lines, label, body) {
  // Text labels are local labels (`Label:`); event scripts use `Label::`.
  const labelRe = new RegExp(`^\\s*${escapeRe(label)}::?\\s*$`);
  let i = lines.findIndex((l) => labelRe.test(l));
  if (i === -1) return { ok: false, lines };

  let start = i + 1;
  let end = start;
  while (end < lines.length && /^\s*\.string\b/.test(lines[end])) end++;
  if (end === start) return { ok: false, lines }; // label wasn't a text label

  const indent = (lines[start].match(/^\s*/) || [""])[0];
  const next = [...lines];
  next.splice(start, end - start, `${indent}.string "${body}"`);
  return { ok: true, lines: next };
}

/** Map common Unicode to the pokeemerald ASCII charmap; drop anything unsupported. */
function sanitizeToGba(str) {
  return str
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, "'") // double quotes -> single (safe inside .string)
    .replace(/[–—―]/g, "-")
    .replace(/…/g, "...")
    .replace(/[àáâãäå]/gi, (m) => (m === m.toUpperCase() ? "A" : "a"))
    .replace(/[èéêë]/gi, (m) => (m === m.toUpperCase() ? "E" : "e"))
    .replace(/[ìíîï]/gi, (m) => (m === m.toUpperCase() ? "I" : "i"))
    .replace(/[òóôõö]/gi, (m) => (m === m.toUpperCase() ? "O" : "o"))
    .replace(/[ùúûü]/gi, (m) => (m === m.toUpperCase() ? "U" : "u"))
    .replace(/[ñ]/gi, (m) => (m === m.toUpperCase() ? "N" : "n"))
    .replace(/[ç]/gi, (m) => (m === m.toUpperCase() ? "C" : "c"))
    .replace(/"/g, "'")
    .replace(/\\/g, "") // strip stray backslashes; control codes are added later
    .replace(/[^\x20-\x7E]/g, "") // drop anything still non-ASCII
    .replace(/\s+/g, " ")
    .trim();
}

/** Greedy word wrap to <= width chars per line. */
function wordWrap(text, width) {
  const words = text.split(" ");
  const out = [];
  let line = "";
  for (const w of words) {
    if (!line) line = w;
    else if ((line + " " + w).length <= width) line += " " + w;
    else {
      out.push(line);
      line = w;
    }
  }
  if (line) out.push(line);
  return out;
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
