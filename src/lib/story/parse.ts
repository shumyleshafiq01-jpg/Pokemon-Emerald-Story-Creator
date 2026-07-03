import type { StoryPackage, StoryScene } from "@/lib/story/types";

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;

export function parseStoryMarkdown(
  fileName: string,
  content: string,
): { scene?: StoryScene; overview?: string; hackTitle?: string; errors: string[] } {
  const errors: string[] = [];

  if (fileName.toLowerCase() === "overview.md" || fileName.toLowerCase() === "00-overview.md") {
    const titleMatch = content.match(/^#\s+(.+)$/m);
    return {
      overview: content.trim(),
      hackTitle: titleMatch?.[1]?.trim(),
      errors,
    };
  }

  const fmMatch = content.match(FRONTMATTER_RE);
  const meta: Record<string, string> = {};
  let body = content;

  if (fmMatch) {
    body = fmMatch[2];
    for (const line of fmMatch[1].split("\n")) {
      const idx = line.indexOf(":");
      if (idx > 0) {
        meta[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
      }
    }
  } else {
    errors.push(`${fileName}: missing YAML frontmatter (--- block at top).`);
  }

  const titleMatch = body.match(/^#\s+Scene:\s*(.+)$/m) ?? body.match(/^#\s+(.+)$/m);
  const dialogue = parseDialogueTable(body);

  if (dialogue.length === 0) {
    errors.push(`${fileName}: no dialogue found. Add a ## Dialogue table.`);
  }

  const scene: StoryScene = {
    id: meta.scene_id || meta.id || fileName.replace(/\.md$/i, ""),
    title: titleMatch?.[1]?.trim() || fileName,
    map: meta.map,
    vanillaEvent: meta.vanilla_event || meta.vanillaEvent,
    act: meta.act ? Number(meta.act) : undefined,
    dialogue,
    flags: meta.flags ? meta.flags.split(",").map((f) => f.trim()) : undefined,
    rawBody: body,
  };

  return { scene, errors };
}

function parseDialogueTable(body: string): StoryScene["dialogue"] {
  const section = body.match(/## Dialogue\s*\n([\s\S]*?)(?=\n## |\n# |$)/i);
  if (!section) return [];

  const lines = section[1].trim().split("\n");
  const rows: StoryScene["dialogue"] = [];

  for (const line of lines) {
    if (!line.trim().startsWith("|")) continue;
    if (line.includes("---") || line.toLowerCase().includes("speaker")) continue;

    const cells = line
      .split("|")
      .map((c) => c.trim())
      .filter(Boolean);

    if (cells.length >= 2) {
      rows.push({
        speaker: cells[0],
        line: cells[1],
        note: cells[2] || undefined,
      });
    }
  }

  return rows;
}

export function buildStoryPackage(
  romGameCode: string,
  files: { name: string; content: string }[],
): { pkg: StoryPackage | null; errors: string[] } {
  const errors: string[] = [];
  const scenes: StoryScene[] = [];
  let overview: string | undefined;
  let hackTitle = "Untitled Story Hack";

  for (const file of files) {
    if (!file.name.toLowerCase().endsWith(".md")) {
      errors.push(`${file.name}: only .md files are supported.`);
      continue;
    }

    const parsed = parseStoryMarkdown(file.name, file.content);
    errors.push(...parsed.errors);
    if (parsed.overview) overview = parsed.overview;
    if (parsed.hackTitle) hackTitle = parsed.hackTitle;
    if (parsed.scene) scenes.push(parsed.scene);
  }

  if (scenes.length === 0) {
    errors.push("No scene files found. Include at least one scene .md file.");
  }

  if (errors.length > 0) {
    return { pkg: null, errors };
  }

  scenes.sort((a, b) => {
    const actA = a.act ?? 999;
    const actB = b.act ?? 999;
    return actA - actB || a.id.localeCompare(b.id);
  });

  return {
    pkg: {
      version: 1,
      hackTitle,
      romGameCode,
      createdAt: new Date().toISOString(),
      overview,
      scenes,
      files,
    },
    errors: [],
  };
}
