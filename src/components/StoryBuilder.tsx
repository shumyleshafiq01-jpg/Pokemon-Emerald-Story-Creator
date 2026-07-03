"use client";

import { useCallback, useMemo, useState } from "react";
import { validateRomFile } from "@/lib/rom/validate";
import { buildStoryPackage } from "@/lib/story/parse";
import { generateStoryPrompt } from "@/lib/story/prompt";
import { splitAiFileOutput } from "@/lib/story/split-ai-output";
import type { BuildJobStatus, RomInfo, StoryPackage } from "@/lib/story/types";

type Step = 1 | 2 | 3 | 4;

export default function StoryBuilder() {
  const [step, setStep] = useState<Step>(1);
  const [rom, setRom] = useState<RomInfo | null>(null);
  const [romFile, setRomFile] = useState<File | null>(null);
  const [prompt, setPrompt] = useState("");
  const [storyFiles, setStoryFiles] = useState<{ name: string; content: string }[]>([]);
  const [storyPkg, setStoryPkg] = useState<StoryPackage | null>(null);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [buildStatus, setBuildStatus] = useState<BuildJobStatus>({ state: "idle" });
  const [copied, setCopied] = useState(false);
  const [aiPaste, setAiPaste] = useState("");

  const onRomUpload = useCallback(async (file: File) => {
    const info = await validateRomFile(file);
    setRom(info);
    setRomFile(info.valid ? file : null);
    if (info.valid) {
      setPrompt(generateStoryPrompt(info));
      setStep(2);
    }
  }, []);

  const ingestStoryFiles = useCallback(
    (loaded: { name: string; content: string }[]) => {
      if (!rom) return;
      setStoryFiles(loaded);
      const { pkg, errors } = buildStoryPackage(rom.gameCode, loaded);
      setParseErrors(errors);
      setStoryPkg(pkg);
      if (pkg) setStep(4);
    },
    [rom],
  );

  const onStoryUpload = useCallback(
    async (files: FileList | null) => {
      if (!files?.length || !rom) return;
      const loaded: { name: string; content: string }[] = [];
      for (const file of Array.from(files)) {
        loaded.push({ name: file.name, content: await file.text() });
      }
      ingestStoryFiles(loaded);
    },
    [rom, ingestStoryFiles],
  );

  const onSplitAiPaste = useCallback(() => {
    const split = splitAiFileOutput(aiPaste);
    if (split.length === 0) {
      setParseErrors([
        'No files found. AI output must use headers like: === FILE: act1-01-truck-intro.md ===',
      ]);
      return;
    }
    ingestStoryFiles(split);
  }, [aiPaste, ingestStoryFiles]);

  const copyPrompt = useCallback(async () => {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [prompt]);

  const downloadPrompt = useCallback(() => {
    const blob = new Blob([prompt], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "story-builder-ai-prompt.txt";
    a.click();
    URL.revokeObjectURL(url);
  }, [prompt]);

  const startBuild = useCallback(async () => {
    if (!storyPkg || !rom) return;

    setBuildStatus({ state: "validating" });

    try {
      const res = await fetch("/api/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyPackage: storyPkg, romInfo: rom }),
      });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        setBuildStatus({ state: "error", message: data.message || "Build failed." });
        return;
      }

      setBuildStatus({
        state: data.githubTriggered ? "building" : "queued",
        buildId: data.buildId,
        message: data.message,
      });
    } catch {
      setBuildStatus({
        state: "error",
        message: "Could not reach build API. Deploy to Vercel or run locally with npm run dev.",
      });
    }
  }, [storyPkg, rom]);

  const downloadPackage = useCallback(() => {
    if (!storyPkg) return;
    const blob = new Blob([JSON.stringify(storyPkg, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${storyPkg.hackTitle.replace(/\s+/g, "-").toLowerCase()}-story-package.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [storyPkg]);

  const stepLabels = useMemo(
    () => ["Upload ROM", "AI Prompt", "Upload Story", "Build ROM"],
    [],
  );

  return (
    <div className="mx-auto w-full max-w-4xl">
      <nav className="mb-10 flex flex-wrap gap-2">
        {stepLabels.map((label, i) => {
          const n = (i + 1) as Step;
          const active = step === n;
          const done = step > n;
          return (
            <button
              key={label}
              type="button"
              onClick={() => n <= step && setStep(n)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                active
                  ? "bg-emerald-600 text-white"
                  : done
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-zinc-100 text-zinc-500"
              }`}
            >
              {i + 1}. {label}
            </button>
          );
        })}
      </nav>

      {step === 1 && (
        <section className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
          <h2 className="text-xl font-semibold text-zinc-900">Step 1 — Upload your ROM</h2>
          <p className="mt-2 text-zinc-600">
            Upload a <strong>Pokémon Emerald</strong> <code className="text-sm">.gba</code> file
            (USA/EUR, game code BPEE). We validate locally — your ROM never leaves the browser
            until you start a cloud build.
          </p>
          <label className="mt-6 flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed border-emerald-300 bg-emerald-50/50 px-6 py-12 hover:border-emerald-500">
            <span className="text-lg font-medium text-emerald-800">Choose .gba file</span>
            <span className="mt-1 text-sm text-emerald-600">or drag and drop</span>
            <input
              type="file"
              accept=".gba"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onRomUpload(f);
              }}
            />
          </label>
          {rom && !rom.valid && (
            <ul className="mt-4 list-inside list-disc text-sm text-red-600">
              {rom.errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
          {rom?.valid && (
            <dl className="mt-4 grid grid-cols-2 gap-2 rounded-lg bg-emerald-50 p-4 text-sm">
              <dt className="text-zinc-500">Title</dt>
              <dd>{rom.title}</dd>
              <dt className="text-zinc-500">Game code</dt>
              <dd>{rom.gameCode}</dd>
              <dt className="text-zinc-500">Size</dt>
              <dd>{rom.size.toLocaleString()} bytes</dd>
            </dl>
          )}
        </section>
      )}

      {step === 2 && (
        <section className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
          <h2 className="text-xl font-semibold">Step 2 — Copy prompt into your AI</h2>
          <p className="mt-2 text-zinc-600">
            Paste this into <strong>Claude, GPT, Gemini, Cursor, DeepSeek</strong>, or any frontier
            model. It returns detailed <code className="text-sm">.md</code> scene files in the
            exact format Story Builder expects.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void copyPrompt()}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              {copied ? "Copied!" : "Copy prompt"}
            </button>
            <button
              type="button"
              onClick={downloadPrompt}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50"
            >
              Download .txt
            </button>
            <button
              type="button"
              onClick={() => setStep(3)}
              className="rounded-lg border border-emerald-600 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
            >
              I have my story files →
            </button>
          </div>
          <textarea
            readOnly
            value={prompt}
            className="mt-4 h-96 w-full resize-y rounded-lg border border-zinc-200 bg-zinc-50 p-4 font-mono text-xs leading-relaxed"
          />
        </section>
      )}

      {step === 3 && (
        <section className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
          <h2 className="text-xl font-semibold">Step 3 — Upload story Markdown</h2>
          <p className="mt-2 text-zinc-600">
            Upload <code className="text-sm">00-overview.md</code> plus all scene files. Select
            multiple files at once, or paste the AI response below.
          </p>
          <p className="mt-2 text-sm text-zinc-500">
            Test the flow? Download sample scenes from{" "}
            <a href="/examples/00-overview.md" className="text-violet-600 underline" download>
              examples/
            </a>{" "}
            (5 scenes + overview).
          </p>
          <label className="mt-6 flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed border-violet-300 bg-violet-50/50 px-6 py-12 hover:border-violet-500">
            <span className="text-lg font-medium text-violet-800">Choose .md files</span>
            <input
              type="file"
              accept=".md,text/markdown"
              multiple
              className="hidden"
              onChange={(e) => void onStoryUpload(e.target.files)}
            />
          </label>

          <div className="mt-8">
            <p className="text-sm font-medium text-zinc-700">Or paste AI output directly</p>
            <textarea
              value={aiPaste}
              onChange={(e) => setAiPaste(e.target.value)}
              placeholder="Paste the full AI response here (with === FILE: name.md === headers)…"
              className="mt-2 h-48 w-full rounded-lg border border-zinc-200 bg-zinc-50 p-3 font-mono text-xs"
            />
            <button
              type="button"
              onClick={onSplitAiPaste}
              disabled={!aiPaste.trim()}
              className="mt-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-40"
            >
              Split into files &amp; validate
            </button>
          </div>
          {parseErrors.length > 0 && (
            <ul className="mt-4 list-inside list-disc text-sm text-red-600">
              {parseErrors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
          {storyFiles.length > 0 && (
            <p className="mt-4 text-sm text-zinc-600">
              {storyFiles.length} file(s): {storyFiles.map((f) => f.name).join(", ")}
            </p>
          )}
        </section>
      )}

      {step === 4 && storyPkg && (
        <section className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
          <h2 className="text-xl font-semibold">Step 4 — Create new ROM</h2>
          <p className="mt-2 text-zinc-600">
            <strong>{storyPkg.hackTitle}</strong> — {storyPkg.scenes.length} scenes parsed.
          </p>

          <div className="mt-4 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
            <strong>Cloud build — no Ubuntu on your PC.</strong> Vercel runs this website.
            Compiling the <code className="text-xs">.gba</code> happens on GitHub&apos;s cloud
            servers (~5–15 min). Set <code className="text-xs">GITHUB_TOKEN</code> +{" "}
            <code className="text-xs">GITHUB_REPO</code> on Vercel for one-click builds.
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void startBuild()}
              disabled={buildStatus.state === "validating" || buildStatus.state === "building"}
              className="rounded-lg bg-emerald-600 px-6 py-3 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              Create new ROM file
            </button>
            <button
              type="button"
              onClick={downloadPackage}
              className="rounded-lg border border-zinc-300 px-4 py-3 text-sm font-medium hover:bg-zinc-50"
            >
              Download story package (.json)
            </button>
          </div>

          {buildStatus.state !== "idle" && (
            <div
              className={`mt-4 rounded-lg p-4 text-sm ${
                buildStatus.state === "error"
                  ? "bg-red-50 text-red-800"
                  : "bg-emerald-50 text-emerald-900"
              }`}
            >
              {buildStatus.state === "validating" && "Validating and queueing build…"}
              {"message" in buildStatus && buildStatus.message}
              {"buildId" in buildStatus && buildStatus.buildId && (
                <p className="mt-1 font-mono text-xs">Build ID: {buildStatus.buildId}</p>
              )}
            </div>
          )}

          {romFile && (
            <p className="mt-4 text-xs text-zinc-400">
              Reference ROM: {romFile.name} ({rom?.gameCode})
            </p>
          )}
        </section>
      )}
    </div>
  );
}
