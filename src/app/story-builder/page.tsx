import RequirementsPanel from "@/components/RequirementsPanel";
import StoryBuilder from "@/components/StoryBuilder";

export default function StoryBuilderPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-950 via-zinc-950 to-black text-zinc-100">
      <header className="border-b border-emerald-900/50 bg-black/40 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-emerald-400">
              PKMN EXP
            </p>
            <h1 className="text-lg font-semibold">Story Builder</h1>
          </div>
          <a href="/" className="text-sm text-zinc-400 hover:text-white">
            ← Home
          </a>
        </div>
      </header>
      <main className="px-6 py-12">
        <div className="mx-auto max-w-4xl">
          <p className="mb-6 text-zinc-400">
            Upload Emerald → get an AI prompt → upload story Markdown → build a new ROM with your
            storyline. No prebuilt hacks — your story, compiled from source.
          </p>
          <RequirementsPanel />
        </div>
        <StoryBuilder />
      </main>
    </div>
  );
}
