import type { RomInfo } from "@/lib/story/types";

const EMERALD_CODES = new Set(["BPEE", "BPEP", "BPEF"]);

export async function validateRomFile(file: File): Promise<RomInfo> {
  const errors: string[] = [];
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  if (bytes.length < 0xc0) {
    return {
      valid: false,
      title: "",
      gameCode: "",
      size: bytes.length,
      sha256Prefix: "",
      errors: ["File is too small to be a GBA ROM."],
    };
  }

  const title = readAscii(bytes, 0xa0, 12).replace(/\0/g, "").trim();
  const gameCode = readAscii(bytes, 0xac, 4).replace(/\0/g, "").trim();

  if (bytes.length !== 16_777_216 && bytes.length !== 32_768_000) {
    errors.push(
      `Unusual ROM size (${bytes.length} bytes). Emerald is usually 16 MB (16777216).`,
    );
  }

  if (!EMERALD_CODES.has(gameCode)) {
    errors.push(
      `Game code "${gameCode || "unknown"}" is not Pokémon Emerald (expected BPEE).`,
    );
  }

  if (!title.toUpperCase().includes("POKEMON") && !title.toUpperCase().includes("POKEMON EMER")) {
    errors.push(`Title "${title}" does not look like Pokémon Emerald.`);
  }

  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashHex = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);

  return {
    valid: errors.length === 0,
    title,
    gameCode,
    size: bytes.length,
    sha256Prefix: hashHex,
    errors,
  };
}

function readAscii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.slice(offset, offset + length));
}
