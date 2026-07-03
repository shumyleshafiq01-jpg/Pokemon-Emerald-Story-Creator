#!/usr/bin/env node
/**
 * Structural (gameplay) hacks for the Hollow Crown story — applied to
 * pokeemerald-expansion source AFTER the dialogue pass in apply-story.mjs
 * (which invokes this module automatically; it can also run standalone).
 *
 * What this changes, per story scene:
 *   act1-01 truck intro   — eerie beat: thunder SE + camera shake + Stillness
 *                           whisper when the player steps off the truck.
 *   act1-02 clock scene   — the clock "hesitates": shake + whisper after the
 *                           wall clock is set.
 *   act1-03 birch rescue  — Birch is chased by a Poochyena (overworld sprite +
 *                           first battle species/level), the starters become
 *                           RALTS / MACHOP / SHUPPET, and Route 101 wild
 *                           encounters swap WURMPLE -> SHUPPET.
 *
 * Every edit locates a verified anchor (checked against rh-hideout commit
 * 662421c9) and fails loud if it's missing, so an upstream change can never
 * silently produce a vanilla ROM.
 *
 * Standalone usage: node scripts/structural-hacks.mjs <expansionRoot>
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function applyStructuralHacks(expansionRoot) {
  const errors = [];
  let editCount = 0;

  function edit(relPath, description, transform) {
    const absPath = path.join(expansionRoot, relPath);
    if (!fs.existsSync(absPath)) {
      errors.push(`${relPath}: file not found (${description})`);
      return;
    }
    const before = fs.readFileSync(absPath, "utf8");
    const after = transform(before);
    if (after === null || after === before) {
      errors.push(`${relPath}: anchor not found — ${description}`);
      return;
    }
    fs.writeFileSync(absPath, after);
    editCount++;
    console.log(`ok: ${description}`);
  }

  function replaceOnce(src, find, replacement) {
    const idx = src.indexOf(find);
    if (idx === -1) return null;
    return src.slice(0, idx) + replacement + src.slice(idx + find.length);
  }

  // -------------------------------------------------------------------------
  // act1-03 — starters become RALTS (mind) / MACHOP (discipline) / SHUPPET (hollow)
  edit("src/starter_choose.c", "starters -> Ralts/Machop/Shuppet", (src) => {
    let out = src;
    out = out.replace(
      /#define GRASS_STARTER \(IS_FRLG \? SPECIES_BULBASAUR {2}: SPECIES_TREECKO\)/,
      "#define GRASS_STARTER (IS_FRLG ? SPECIES_BULBASAUR  : SPECIES_RALTS)",
    );
    out = out.replace(
      /#define FIRE_STARTER {2}\(IS_FRLG \? SPECIES_CHARMANDER : SPECIES_TORCHIC\)/,
      "#define FIRE_STARTER  (IS_FRLG ? SPECIES_CHARMANDER : SPECIES_MACHOP)",
    );
    out = out.replace(
      /#define WATER_STARTER \(IS_FRLG \? SPECIES_SQUIRTLE {3}: SPECIES_MUDKIP \)/,
      "#define WATER_STARTER (IS_FRLG ? SPECIES_SQUIRTLE   : SPECIES_SHUPPET)",
    );
    return out.includes("SPECIES_RALTS)") && out.includes("SPECIES_MACHOP)") && out.includes("SPECIES_SHUPPET)")
      ? out
      : null;
  });

  // act1-03 — first battle: the creature savaging Birch is a lv3 Poochyena
  edit("src/battle_controllers.c", "first battle -> Poochyena lv3", (src) =>
    replaceOnce(
      src,
      "CreateWildMon(SPECIES_ZIGZAGOON, 2);",
      "CreateWildMon(SPECIES_POOCHYENA, 3);",
    ),
  );

  // act1-03 — the overworld sprite chasing Birch matches the battle
  edit("data/maps/Route101/map.json", "Birch chaser sprite -> Poochyena", (src) =>
    replaceOnce(src, '"OBJ_EVENT_GFX_ZIGZAGOON_1"', '"OBJ_EVENT_GFX_POOCHYENA"'),
  );

  // act1-03 — Route 101 wild encounters: WURMPLE slots become SHUPPET
  // (scoped to the MAP_ROUTE101 block only; the file repeats species everywhere)
  edit("src/data/wild_encounters.json", "Route101 wilds: Wurmple -> Shuppet", (src) => {
    const start = src.indexOf('"map": "MAP_ROUTE101"');
    if (start === -1) return null;
    const end = src.indexOf('"map": "', start + 10);
    if (end === -1) return null;
    const block = src.slice(start, end);
    if (!block.includes('"SPECIES_WURMPLE"')) return null;
    const patched = block.replaceAll('"SPECIES_WURMPLE"', '"SPECIES_SHUPPET"');
    return src.slice(0, start) + patched + src.slice(end);
  });

  // -------------------------------------------------------------------------
  // act1-01 — eerie beat stepping off the truck.
  // ShakeCamera consumes VAR_0x8004..8007; the door coords living in 8004/8005
  // are parked in 8008/8009 and restored afterwards.
  edit("data/maps/LittlerootTown/scripts.inc", "truck intro: Stillness beat", (src) => {
    const anchor =
      "\tapplymovement LOCALID_PLAYER, LittlerootTown_Movement_PlayerStepOffTruck\n\twaitmovement 0\n";
    const inject =
      anchor +
      "\tdelay 20\n" +
      "\tplayse SE_THUNDER\n" +
      "\tcopyvar VAR_0x8008, VAR_0x8004\n" +
      "\tcopyvar VAR_0x8009, VAR_0x8005\n" +
      "\tsetvar VAR_0x8004, 1\n" +
      "\tsetvar VAR_0x8005, 1\n" +
      "\tsetvar VAR_0x8006, 4\n" +
      "\tsetvar VAR_0x8007, 4\n" +
      "\tspecial ShakeCamera\n" +
      "\twaitstate\n" +
      "\tmsgbox LittlerootTown_Text_StillnessWhisper, MSGBOX_DEFAULT\n" +
      "\tclosemessage\n" +
      "\tcopyvar VAR_0x8004, VAR_0x8008\n" +
      "\tcopyvar VAR_0x8005, VAR_0x8009\n";
    const out = replaceOnce(src, anchor, inject);
    if (out === null) return null;
    return (
      out +
      "\nLittlerootTown_Text_StillnessWhisper:\n" +
      '\t.string "...?\\pFor a heartbeat, the world goes\\nquiet. Too quiet.\\pSomething beneath the soil\\ncounted you.$"\n'
    );
  });

  // act1-02 — the wall clock hesitates after being set.
  // VAR_0x8004 (gender) was already consumed by SetWallClock; 8008 is assigned
  // later by MomComesUpstairs*, so clobbering vars here is safe.
  edit("data/scripts/players_house.inc", "clock scene: hesitation beat", (src) => {
    const anchor = "\tcall PlayersHouse_2F_EventScript_SetWallClock\n\tdelay 30\n";
    const inject =
      anchor +
      "\tplayse SE_THUNDER\n" +
      "\tsetvar VAR_0x8004, 1\n" +
      "\tsetvar VAR_0x8005, 1\n" +
      "\tsetvar VAR_0x8006, 4\n" +
      "\tsetvar VAR_0x8007, 4\n" +
      "\tspecial ShakeCamera\n" +
      "\twaitstate\n" +
      "\tmsgbox PlayersHouse_2F_Text_ClockWhisper, MSGBOX_DEFAULT\n" +
      "\tclosemessage\n";
    const out = replaceOnce(src, anchor, inject);
    if (out === null) return null;
    return (
      out +
      "\nPlayersHouse_2F_Text_ClockWhisper:\n" +
      '\t.string "The second hand hesitates before\\neach tick.\\pAs if something, somewhere, is\\ncounting along.$"\n'
    );
  });

  // -------------------------------------------------------------------------
  console.log(`Structural hacks: ${editCount} applied, ${errors.length} failed.`);
  for (const e of errors) console.error(`  - ${e}`);
  if (errors.length > 0) {
    console.error(
      "::error::Structural hacks incomplete — aborting so the build can't silently ship vanilla gameplay.",
    );
    process.exit(1);
  }
}

// Standalone invocation
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  applyStructuralHacks(process.argv[2] || path.join("hack", "pokeemerald-expansion"));
}
