export default function RequirementsPanel() {
  return (
    <aside className="mb-8 rounded-xl border border-emerald-800/40 bg-emerald-950/30 p-5 text-sm text-zinc-300">
      <h2 className="font-semibold text-emerald-300">Requirements — nothing extra to install</h2>
      <ul className="mt-3 space-y-2">
        <li>
          <strong className="text-zinc-100">Your PC:</strong> Any browser on Windows or Mac.{" "}
          <span className="text-emerald-400">No Ubuntu. No Linux. No WSL.</span>
        </li>
        <li>
          <strong className="text-zinc-100">ROM file:</strong> Your own Pokémon Emerald{" "}
          <code className="rounded bg-zinc-800 px-1">.gba</code> (game code BPEE).
        </li>
        <li>
          <strong className="text-zinc-100">AI account:</strong> Claude, GPT, Gemini, Cursor, etc.
          — to write the story Markdown from our prompt.
        </li>
        <li>
          <strong className="text-zinc-100">ROM compile:</strong> Happens automatically in the{" "}
          <strong className="text-zinc-100">cloud</strong> (GitHub Actions). Ubuntu runs on
          GitHub&apos;s servers for ~10 minutes — you never see it or install it.
        </li>
      </ul>
    </aside>
  );
}
