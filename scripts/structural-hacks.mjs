#!/usr/bin/env node
/**
 * Structural (gameplay) hacks for "Saiyan Requiem" — DBZ x cosmic-horror.
 * Applied to pokeemerald-expansion source AFTER the dialogue pass in
 * apply-story.mjs (which invokes this module; it can also run standalone).
 *
 * What this changes (gameplay, not just words):
 *   Starters      -> RIOLU (ki/aura), MACHOP (Saiyan brawler), DUSKULL (the Hollowed).
 *   First battle  -> the thing savaging Prof. Gohan is a lv3 MACHOP husk, not a Zigzagoon.
 *   Route 101     -> overworld chaser sprite becomes MACHOP; wild grass is now
 *                    DUSKULL (wraiths) + MACHOP (roaming husks); the whole route
 *                    is wrapped in fog and eerie Mt. Pyre music.
 *   Cutscene beats-> stepping off the truck AND setting the clock trigger a
 *                    thunder + camera-shake + horror whisper (a power level
 *                    erupting on the horizon, then flatlining to zero).
 *
 * Every edit locates a verified anchor (checked against rh-hideout commit
 * 662421c9) and fails loud if it's missing, so an upstream change can never
 * silently ship a vanilla ROM.
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
      errors.push(`${relPath}: anchor not found - ${description}`);
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
  // Starters -> Riolu / Machop / Duskull
  edit("src/starter_choose.c", "starters -> Riolu/Machop/Duskull", (src) => {
    let out = src;
    out = out.replace(
      /#define GRASS_STARTER \(IS_FRLG \? SPECIES_BULBASAUR {2}: SPECIES_TREECKO\)/,
      "#define GRASS_STARTER (IS_FRLG ? SPECIES_BULBASAUR  : SPECIES_RIOLU)",
    );
    out = out.replace(
      /#define FIRE_STARTER {2}\(IS_FRLG \? SPECIES_CHARMANDER : SPECIES_TORCHIC\)/,
      "#define FIRE_STARTER  (IS_FRLG ? SPECIES_CHARMANDER : SPECIES_MACHOP)",
    );
    out = out.replace(
      /#define WATER_STARTER \(IS_FRLG \? SPECIES_SQUIRTLE {3}: SPECIES_MUDKIP \)/,
      "#define WATER_STARTER (IS_FRLG ? SPECIES_SQUIRTLE   : SPECIES_DUSKULL)",
    );
    return out.includes("SPECIES_RIOLU)") && out.includes("SPECIES_MACHOP)") && out.includes("SPECIES_DUSKULL)")
      ? out
      : null;
  });

  // First battle: a lv3 Machop husk savages the professor
  edit("src/battle_controllers.c", "first battle -> Machop lv3", (src) =>
    replaceOnce(src, "CreateWildMon(SPECIES_ZIGZAGOON, 2);", "CreateWildMon(SPECIES_MACHOP, 3);"),
  );

  // Overworld sprite chasing the professor matches the battle
  edit("data/maps/Route101/map.json", "chaser sprite -> Machop", (src) =>
    replaceOnce(src, '"OBJ_EVENT_GFX_ZIGZAGOON_1"', '"OBJ_EVENT_GFX_MACHOP"'),
  );

  // Route 101 atmosphere: fog + eerie Mt. Pyre music
  edit("data/maps/Route101/map.json", "Route101 weather -> fog", (src) =>
    replaceOnce(src, '"weather": "WEATHER_SUNNY"', '"weather": "WEATHER_FOG_HORIZONTAL"'),
  );
  edit("data/maps/Route101/map.json", "Route101 music -> Mt. Pyre", (src) =>
    replaceOnce(src, '"music": "MUS_ROUTE101"', '"music": "MUS_MT_PYRE_EXTERIOR"'),
  );

  // Route 101 wilds: Wurmple -> Duskull (wraiths), Poochyena -> Machop (husks)
  edit("src/data/wild_encounters.json", "Route101 wilds -> Duskull/Machop", (src) => {
    const start = src.indexOf('"map": "MAP_ROUTE101"');
    if (start === -1) return null;
    const end = src.indexOf('"map": "', start + 10);
    if (end === -1) return null;
    let block = src.slice(start, end);
    if (!block.includes('"SPECIES_WURMPLE"') && !block.includes('"SPECIES_POOCHYENA"')) return null;
    block = block.replaceAll('"SPECIES_WURMPLE"', '"SPECIES_DUSKULL"');
    block = block.replaceAll('"SPECIES_POOCHYENA"', '"SPECIES_MACHOP"');
    return src.slice(0, start) + block + src.slice(end);
  });

  // -------------------------------------------------------------------------
  // Truck intro beat: a power level erupts on the horizon, then flatlines.
  edit("data/maps/LittlerootTown/scripts.inc", "truck intro: power-level beat", (src) => {
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
      "\tmsgbox LittlerootTown_Text_PowerLevelWhisper, MSGBOX_DEFAULT\n" +
      "\tclosemessage\n" +
      "\tcopyvar VAR_0x8004, VAR_0x8008\n" +
      "\tcopyvar VAR_0x8005, VAR_0x8009\n";
    const out = replaceOnce(src, anchor, inject);
    if (out === null) return null;
    return (
      out +
      "\nLittlerootTown_Text_PowerLevelWhisper:\n" +
      '\t.string "Out over the water, a power erupts -\\nvast, screaming, alive.\\pThen it drops to zero. Something\\nout there just went hollow.$"\n'
    );
  });

  // Clock beat: the numbers flicker like a scouter losing its target.
  edit("data/scripts/players_house.inc", "clock scene: scouter beat", (src) => {
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
      "\tmsgbox PlayersHouse_2F_Text_ScouterWhisper, MSGBOX_DEFAULT\n" +
      "\tclosemessage\n";
    const out = replaceOnce(src, anchor, inject);
    if (out === null) return null;
    return (
      out +
      "\nPlayersHouse_2F_Text_ScouterWhisper:\n" +
      '\t.string "The numbers flicker, lose their\\ntarget, and reset to zero.\\pLike a scouter staring at\\nsomething it refuses to name.$"\n'
    );
  });

  // -------------------------------------------------------------------------
  console.log(`Structural hacks: ${editCount} applied, ${errors.length} failed.`);
  for (const e of errors) console.error(`  - ${e}`);
  if (errors.length > 0) {
    console.error(
      "::error::Structural hacks incomplete - aborting so the build can't silently ship vanilla gameplay.",
    );
    process.exit(1);
  }
}

// Standalone invocation
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  applyStructuralHacks(process.argv[2] || path.join("hack", "pokeemerald-expansion"));
}
