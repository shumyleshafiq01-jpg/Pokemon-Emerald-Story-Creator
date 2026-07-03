import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-950 via-zinc-950 to-black text-zinc-100">
      <main className="mx-auto flex max-w-3xl flex-col px-6 py-24">
        <p className="text-sm font-medium uppercase tracking-widest text-emerald-400">PKMN EXP</p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
          Pokémon Emerald Story Hack Studio
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-zinc-400">
          Turn any frontier AI into your writing room. Story Builder validates your ROM, generates
          a format-locked prompt, ingests the Markdown it returns, and compiles a new{" "}
          <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-sm">.gba</code> from open-source
          decompilation — not a downloaded hack.
        </p>

        <section className="mt-12 grid gap-4 sm:grid-cols-2">
          <Link
            href="/story-builder"
            className="group rounded-2xl border border-emerald-800/60 bg-emerald-950/40 p-6 transition hover:border-emerald-500 hover:bg-emerald-900/30"
          >
            <h2 className="text-xl font-semibold text-emerald-300 group-hover:text-emerald-200">
              Story Builder
            </h2>
            <p className="mt-2 text-sm text-zinc-400">
              ROM → AI prompt → story MD → new ROM. Works with Claude, GPT, Gemini, Cursor, and
              more.
            </p>
            <span className="mt-4 inline-block text-sm font-medium text-emerald-400">
              Open module →
            </span>
          </Link>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 opacity-60">
            <h2 className="text-xl font-semibold text-zinc-500">Map Editor</h2>
            <p className="mt-2 text-sm text-zinc-600">Coming soon — Porymap integration.</p>
          </div>
        </section>

        <footer className="mt-20 border-t border-zinc-800 pt-8 text-xs text-zinc-600">
          Built on pret/pokeemerald &amp; rh-hideout/pokeemerald-expansion. Deploy to Vercel ·
          ROM builds via GitHub Actions.
        </footer>
      </main>
    </div>
  );
}
