export function splitAiFileOutput(paste: string): { name: string; content: string }[] {
  const files: { name: string; content: string }[] = [];
  const parts = paste.split(/===\s*FILE:\s*/i);

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const nl = trimmed.indexOf("\n");
    if (nl === -1) continue;

    const header = trimmed.slice(0, nl).trim().replace(/=+\s*$/, "").trim();
    const content = trimmed.slice(nl + 1).trim();
    const name = header.endsWith(".md") ? header : `${header}.md`;

    if (content.length > 0) {
      files.push({ name, content });
    }
  }

  return files;
}
