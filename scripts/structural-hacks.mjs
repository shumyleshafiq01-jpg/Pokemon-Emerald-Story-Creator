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

  // First battle: a lv3 Hollowed hound savages the professor.
  // Poochyena sprite+species is the combination proven to play through the
  // rescue without hanging (the Machop OW object froze the cutscene in v1).
  edit("src/battle_controllers.c", "first battle -> Poochyena lv3", (src) =>
    replaceOnce(src, "CreateWildMon(SPECIES_ZIGZAGOON, 2);", "CreateWildMon(SPECIES_POOCHYENA, 3);"),
  );

  // Overworld sprite chasing the professor matches the battle
  edit("data/maps/Route101/map.json", "chaser sprite -> Poochyena (proven)", (src) =>
    replaceOnce(src, '"OBJ_EVENT_GFX_ZIGZAGOON_1"', '"OBJ_EVENT_GFX_POOCHYENA"'),
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
  // GLOBAL CONVERSION — the whole region, not just Act 1.
  // Every wild encounter slot, every trainer's Pokémon, and every outdoor
  // map's weather+music is converted to the Saiyan Requiem palette.
  // Each individual change is counted.
  let bulkCount = 0;

  // Species palette: husks (fighting), wraiths (ghost), androids (steel/elec),
  // hellhounds (dark/fire). Levels are untouched, so difficulty curve holds.
  // Slaking line (Norman), Ralts line, Makuhita line, legendaries and HM-water
  // staples are deliberately left alone.
  const SPECIES_CONVERT = {
    ZIGZAGOON: "SHUPPET",
    LINOONE: "BANETTE",
    POOCHYENA: "MACHOP",
    MIGHTYENA: "MACHOKE",
    WURMPLE: "GASTLY",
    SILCOON: "SHUPPET",
    CASCOON: "DUSKULL",
    BEAUTIFLY: "HAUNTER",
    DUSTOX: "DUSCLOPS",
    TAILLOW: "MEDITITE",
    SWELLOW: "MEDICHAM",
    WINGULL: "GASTLY",
    PELIPPER: "HAUNTER",
    WHISMUR: "LITWICK",
    LOUDRED: "LAMPENT",
    EXPLOUD: "CHANDELURE",
    ARON: "BELDUM",
    LAIRON: "METANG",
    NUMEL: "HOUNDOUR",
    CAMERUPT: "HOUNDOOM",
    ELECTRIKE: "MAGNEMITE",
    MANECTRIC: "MAGNETON",
    ZUBAT: "GASTLY",
    GOLBAT: "HAUNTER",
    TENTACOOL: "FRILLISH",
    TENTACRUEL: "JELLICENT",
    GEODUDE: "GOLETT",
    NOSEPASS: "BRONZOR",
    SHROOMISH: "BALTOY",
    BRELOOM: "CLAYDOL",
    SEEDOT: "SHUPPET",
    NUZLEAF: "SABLEYE",
    SHIFTRY: "DUSKNOIR",
  };
  const properCase = (s) => s[0] + s.slice(1).toLowerCase();

  // 1) Wild encounters, region-wide (species names only ever appear as values here)
  edit("src/data/wild_encounters.json", "GLOBAL wild encounters -> Requiem palette", (src) => {
    let out = src;
    let n = 0;
    for (const [from, to] of Object.entries(SPECIES_CONVERT)) {
      const re = new RegExp(`"SPECIES_${from}"`, "g");
      out = out.replace(re, () => {
        n++;
        return `"SPECIES_${to}"`;
      });
    }
    if (n === 0) return null;
    bulkCount += n;
    console.log(`   ${n} wild encounter slots converted`);
    return out;
  });

  // 2) Every trainer party in the game (Showdown syntax: species as proper-case words)
  edit("src/data/trainers.party", "GLOBAL trainer parties -> Requiem palette", (src) => {
    let out = src;
    let n = 0;
    for (const [from, to] of Object.entries(SPECIES_CONVERT)) {
      const nameRe = new RegExp(`\\b${properCase(from)}\\b`, "g");
      out = out.replace(nameRe, () => {
        n++;
        return properCase(to);
      });
      const constRe = new RegExp(`\\bSPECIES_${from}\\b`, "g");
      out = out.replace(constRe, () => {
        n++;
        return `SPECIES_${to}`;
      });
    }
    if (n === 0) return null;
    bulkCount += n;
    console.log(`   ${n} trainer Pokemon converted`);
    return out;
  });

  // 3) Every outdoor map: dread weather + eerie music (indoor maps untouched)
  {
    const routeMusic = ["MUS_MT_PYRE_EXTERIOR", "MUS_SEALED_CHAMBER", "MUS_ABNORMAL_WEATHER"];
    const townMusic = ["MUS_SEALED_CHAMBER", "MUS_CAVE_OF_ORIGIN"];
    const eerieSet = new Set([...routeMusic, ...townMusic]);
    const mapsDir = path.join(expansionRoot, "data", "maps");
    let mapsTouched = 0;
    let fieldEdits = 0;
    const dirs = fs.existsSync(mapsDir) ? fs.readdirSync(mapsDir) : [];
    dirs.forEach((dir, i) => {
      const mj = path.join(mapsDir, dir, "map.json");
      if (!fs.existsSync(mj)) return;
      let src = fs.readFileSync(mj, "utf8");
      const isRoute = src.includes('"map_type": "MAP_TYPE_ROUTE"');
      const isTown =
        src.includes('"map_type": "MAP_TYPE_TOWN"') || src.includes('"map_type": "MAP_TYPE_CITY"');
      if (!isRoute && !isTown) return;
      let changed = false;
      if (src.includes('"weather": "WEATHER_SUNNY"')) {
        src = src.replace(
          '"weather": "WEATHER_SUNNY"',
          `"weather": "${isRoute ? "WEATHER_FOG_HORIZONTAL" : "WEATHER_SHADE"}"`,
        );
        fieldEdits++;
        changed = true;
      }
      const musMatch = src.match(/"music": "(MUS_[A-Z0-9_]+)"/);
      if (musMatch && !eerieSet.has(musMatch[1])) {
        const pool = isRoute ? routeMusic : townMusic;
        src = src.replace(musMatch[0], `"music": "${pool[i % pool.length]}"`);
        fieldEdits++;
        changed = true;
      }
      if (changed) {
        fs.writeFileSync(mj, src);
        mapsTouched++;
      }
    });
    if (mapsTouched > 0) {
      bulkCount += fieldEdits;
      editCount++;
      console.log(
        `ok: GLOBAL atmosphere -> ${mapsTouched} outdoor maps re-themed (${fieldEdits} weather/music fields)`,
      );
    } else {
      errors.push("map atmosphere pass touched nothing");
    }
  }

  // -------------------------------------------------------------------------
  // EXP gain x2.5 — applied to the base calculatedExp, before the trainer-
  // battle 1.5x bonus and exp-share split, so every source of EXP scales
  // together instead of compounding unevenly.
  edit("src/battle_script_commands.c", "EXP gain -> x2.5", (src) => {
    const anchor =
      "            if (B_SCALED_EXP >= GEN_5 && B_SCALED_EXP != GEN_6)\n" +
      "                calculatedExp /= 5;\n" +
      "            else\n" +
      "                calculatedExp /= 7;\n";
    if (!src.includes(anchor)) return null;
    const inject = anchor + "            calculatedExp = (calculatedExp * 5) / 2; // Saiyan Requiem: 2.5x EXP gain\n";
    return replaceOnce(src, anchor, inject);
  });

  // -------------------------------------------------------------------------
  // Buu's Fury dialog-box skin: drop the composed green BF frame over the
  // selectable text-window "Type 1". Ships the graphic in-repo so CI has it.
  {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const bfFrame = path.join(here, "..", "assets", "bf_textbox_frame.png");
    const dstFrame = path.join(expansionRoot, "graphics", "text_window", "1.png");
    if (fs.existsSync(bfFrame) && fs.existsSync(dstFrame)) {
      fs.copyFileSync(bfFrame, dstFrame);
      editCount++;
      console.log("ok: text-window Type 1 -> Buu's Fury green dialog frame");
    } else {
      errors.push("BF dialog frame asset missing");
    }
  }

  // -------------------------------------------------------------------------
  // 4) GLOBAL CAST RENAME — every piece of game text, not just story scenes.
  // BIRCH -> GOHAN everywhere; the rival is VEGETA (male sprite, girl player)
  // or BULMA (female sprite, boy player). Replacements happen ONLY inside
  // double-quoted string literals, so code identifiers (FLAG_..._BIRCH,
  // TRAINER_MAY_..., LOCALID_ROUTE101_BIRCH) can never be touched.
  {
    const CAST = [
      [/\bBIRCH\b/g, "GOHAN"],
      [/\bBRENDAN\b/g, "VEGETA"],
      [/\bMAY\b/g, "BULMA"],
    ];
    let renameCount = 0;
    const renameInQuotes = (line) =>
      line.replace(/"([^"]*)"/g, (m, inner) => {
        let out = inner;
        for (const [re, to] of CAST) {
          out = out.replace(re, () => {
            renameCount++;
            return to;
          });
        }
        return `"${out}"`;
      });

    const renameFile = (absPath) => {
      const before = fs.readFileSync(absPath, "utf8");
      const after = before.split("\n").map(renameInQuotes).join("\n");
      if (after !== before) fs.writeFileSync(absPath, after);
    };

    // All script/text .inc files under data/
    const walk = (dir) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (e.name.endsWith(".inc")) renameFile(p);
      }
    };
    walk(path.join(expansionRoot, "data"));

    // The C sources that hold the intro speech, match-call and battle strings
    for (const f of [
      "src/strings.c",
      "src/main_menu.c",
      "src/pokenav_match_call_data.c",
      "src/field_screen_effect.c",
      "src/battle_message.c",
      "src/battle_main.c",
      "src/field_effect.c",
    ]) {
      const p = path.join(expansionRoot, f);
      if (fs.existsSync(p)) renameFile(p);
    }

    // Rival trainer names shown in battle (“BULMA would like to battle!”)
    const partyPath = path.join(expansionRoot, "src", "data", "trainers.party");
    let party = fs.readFileSync(partyPath, "utf8");
    party = party
      .replace(/^Name: MAY$/gm, () => {
        renameCount++;
        return "Name: BULMA";
      })
      .replace(/^Name: BRENDAN$/gm, () => {
        renameCount++;
        return "Name: VEGETA";
      });
    fs.writeFileSync(partyPath, party);

    if (renameCount > 0) {
      bulkCount += renameCount;
      editCount++;
      console.log(`ok: GLOBAL cast rename -> ${renameCount} name occurrences (BIRCH>GOHAN, BRENDAN>VEGETA, MAY>BULMA)`);
    } else {
      errors.push("cast rename pass touched nothing");
    }
  }

  // -------------------------------------------------------------------------
  // KAIROS ARC: BRANCHING CHOICE + TWO ENDINGS + THE WATCHER
  // The choice lives in persistent VAR_UNUSED_0x404E (0=unchosen, 1=seal,
  // 2=erase). Asked at the League gate after the guard's blessing; resolved
  // in the Champion's room, replacing Wallace's post-battle speech with one
  // of two endings. Re-entering the League re-asks, so the player can switch
  // sides before the final battle — deliberate.
  edit("data/maps/EverGrandeCity_PokemonLeague_1F/scripts.inc", "league gate: Kairos choice", (src) => {
    const anchor = "\tmsgbox EverGrandeCity_PokemonLeague_1F_Text_GoForth, MSGBOX_DEFAULT\n";
    const inject =
      anchor +
      "\tmsgbox SaiyanRequiem_Text_KairosOffer, MSGBOX_YESNO\n" +
      "\tcall_if_eq VAR_RESULT, YES, SaiyanRequiem_EventScript_ChooseSeal\n" +
      "\tcall_if_eq VAR_RESULT, NO, SaiyanRequiem_EventScript_ChooseErase\n";
    const out = replaceOnce(src, anchor, inject);
    if (out === null) return null;
    return (
      out +
      "\nSaiyanRequiem_EventScript_ChooseSeal::\n" +
      "\tsetvar VAR_UNUSED_0x404E, 1\n" +
      "\tmsgbox SaiyanRequiem_Text_ChoseSeal, MSGBOX_DEFAULT\n" +
      "\treturn\n" +
      "\nSaiyanRequiem_EventScript_ChooseErase::\n" +
      "\tsetvar VAR_UNUSED_0x404E, 2\n" +
      "\tmsgbox SaiyanRequiem_Text_ChoseErase, MSGBOX_DEFAULT\n" +
      "\treturn\n" +
      "\nSaiyanRequiem_Text_KairosOffer:\n" +
      '\t.string "A voice like torn paper fills the\\nhall.\\pKAIROS: One question, courier.\\nOnly one.\\pWill you stand with the elder\'s\\nseal against me?$"\n' +
      "\nSaiyanRequiem_Text_ChoseSeal:\n" +
      '\t.string "The bell in your bag hums warm.\\pThe elder\'s seal accepts you.\\nSomewhere ahead, KAIROS screams.$"\n' +
      "\nSaiyanRequiem_Text_ChoseErase:\n" +
      '\t.string "Cold washes down your spine.\\pKAIROS: Then help me end the thing\\nthat ends us. Come, co-author.$"\n'
    );
  });

  edit("data/maps/EverGrandeCity_ChampionsRoom/scripts.inc", "champion room: branching endings", (src) => {
    const anchor = "\tmsgbox EverGrandeCity_ChampionsRoom_Text_PostBattleSpeech, MSGBOX_DEFAULT\n";
    const inject =
      "\tcall_if_eq VAR_UNUSED_0x404E, 1, SaiyanRequiem_EventScript_EndingSeal\n" +
      "\tcall_if_ne VAR_UNUSED_0x404E, 1, SaiyanRequiem_EventScript_EndingErase\n";
    const out = replaceOnce(src, anchor, inject);
    if (out === null) return null;
    return (
      out +
      "\nSaiyanRequiem_EventScript_EndingSeal::\n" +
      "\tmsgbox SaiyanRequiem_Text_EndingSeal, MSGBOX_DEFAULT\n" +
      "\treturn\n" +
      "\nSaiyanRequiem_EventScript_EndingErase::\n" +
      "\tmsgbox SaiyanRequiem_Text_EndingErase, MSGBOX_DEFAULT\n" +
      "\treturn\n" +
      "\nSaiyanRequiem_Text_EndingSeal:\n" +
      '\t.string "WALLACE: The seal holds.\\pKAIROS is unwritten - and somewhere,\\na future you will never see forgives\\nyou.\\pChampion of two worlds...\\nwelcome home.$"\n' +
      "\nSaiyanRequiem_Text_EndingErase:\n" +
      '\t.string "WALLACE: ...So the seal breaks.\\pThe timeline folds itself neat as\\na letter. KAIROS bows to his new\\nco-author.\\pChampion... what did we just do?$"\n'
    );
  });

  // The Watcher — one hooded figure, three places, counting your versions.
  {
    const WATCHERS = [
      {
        map: "RustboroCity",
        x: 20, y: 13, elevation: 3,
        text: "WATCHER: Two teams, one leash.\\pCount the hands on the KI-CORE and\\nsubtract the honest ones.\\pZero. The answer is always zero.",
      },
      {
        map: "SlateportCity",
        x: 27, y: 29, elevation: 3,
        text: "WATCHER: The sub sails where the\\nseal sleeps.\\pYou have met the thief and the\\nshowman. The believer is next.\\pWhich one are you?",
      },
      {
        map: "EverGrandeCity_PokemonLeague_1F",
        x: 13, y: 2, elevation: 3,
        text: "WATCHER: I have watched seventeen\\nversions of this hallway.\\pIn sixteen of them, you choose\\nwrong.\\pNo pressure.",
      },
    ];
    let placed = 0;
    for (const w of WATCHERS) {
      const scriptsPath = path.join(expansionRoot, "data", "maps", w.map, "scripts.inc");
      const mapPath = path.join(expansionRoot, "data", "maps", w.map, "map.json");
      if (!fs.existsSync(scriptsPath) || !fs.existsSync(mapPath)) {
        errors.push(`watcher: ${w.map} files missing`);
        continue;
      }
      const scriptLabel = `SaiyanRequiem_EventScript_Watcher${w.map.replace(/[^A-Za-z]/g, "")}`;
      const textLabel = `SaiyanRequiem_Text_Watcher${w.map.replace(/[^A-Za-z]/g, "")}`;
      fs.appendFileSync(
        scriptsPath,
        `\n${scriptLabel}::\n\tmsgbox ${textLabel}, MSGBOX_NPC\n\tend\n\n${textLabel}:\n\t.string "${w.text}$"\n`,
      );
      const mj = JSON.parse(fs.readFileSync(mapPath, "utf8"));
      mj.object_events.push({
        graphics_id: "OBJ_EVENT_GFX_HEX_MANIAC",
        x: w.x,
        y: w.y,
        elevation: w.elevation,
        movement_type: "MOVEMENT_TYPE_FACE_DOWN",
        movement_range_x: 0,
        movement_range_y: 0,
        trainer_type: "TRAINER_TYPE_NONE",
        trainer_sight_or_berry_tree_id: "0",
        script: scriptLabel,
        flag: "0",
      });
      fs.writeFileSync(mapPath, JSON.stringify(mj, null, 2) + "\n");
      placed++;
    }
    if (placed === WATCHERS.length) {
      editCount++;
      bulkCount += placed;
      console.log(`ok: the Watcher placed in ${placed} locations`);
    } else {
      errors.push(`watcher: only ${placed}/${WATCHERS.length} placed`);
    }
  }

  // -------------------------------------------------------------------------
  // GLOBAL NPC FLAVOR PASS — every town/route's background chatter gets a
  // rumor about the merged Pokemon/DBZ world and the thing rewriting the
  // timeline. Appends one sentence to existing dialogue (never replaces),
  // so nothing that scripts branch on can break.
  {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const sceneMapPath = path.join(here, "scene-map.json");
    const excludeLabels = new Set();
    if (fs.existsSync(sceneMapPath)) {
      const sm = JSON.parse(fs.readFileSync(sceneMapPath, "utf8")).scenes || {};
      for (const entry of Object.values(sm)) for (const a of entry.anchors || []) excludeLabels.add(a);
    }

    const FLAVOR = [
      "\\pOld folks say the sky cracked open the day the Saiyans fell out of it - now our Pokemon dream in two worlds at once.",
      "\\pThere's a rift out past the badlands. Pokemon go quiet near it, like they remember something that hasn't happened yet.",
      "\\pA hooded stranger asked me about a Dragon Ball last week. I didn't like his eyes. Didn't like that my Pokemon didn't either.",
      "\\pMy grandmother says time used to run straight before the crater opened. Now it loops, just a little, right around Mt. Pyre.",
      "\\pSomeone's rewriting the timeline, mark my words. My scouter reads zero one second, infinite the next.",
      "\\pKids say a Namekian elder lives past the routes, keeping some old seal shut. I believe them more every year.",
    ];
    const SKIP_LABEL = /_(Sign|PC|Mart|Shop|Move|TM|HM|Egg|Nickname|Naming|Save|Options?|Register|Trade|Contest|Item|Tutor|Description|Wonder|Union|Cable|Berry|Whisper|RegisterMatchCall)_?/i;
    const SKIP_BODY = /(Saiyan|Namekian|scouter|Dragon Ball|rift out|timeline|Requiem|%|\{STR_VAR_[23]\})/i;
    const blockRe = /^([A-Za-z0-9_]+):\n((?:\t\.string "[^\n]*"\n)+)/gm;

    const mapsDir = path.join(expansionRoot, "data", "maps");
    let flavorCount = 0;
    let mapsFlavored = 0;
    for (const dir of fs.existsSync(mapsDir) ? fs.readdirSync(mapsDir) : []) {
      const sp = path.join(mapsDir, dir, "scripts.inc");
      if (!fs.existsSync(sp)) continue;
      const src = fs.readFileSync(sp, "utf8");
      let fileCount = 0;
      let hash = 0;
      for (const ch of dir) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;

      const out = src.replace(blockRe, (full, label, body) => {
        if (fileCount >= 2) return full;
        if (excludeLabels.has(label) || SKIP_LABEL.test(label)) return full;
        const plainLen = body.replace(/\\[np]/g, "").replace(/["\t\n]/g, "").length;
        if (plainLen < 40 || plainLen > 260) return full;
        if (SKIP_BODY.test(body)) return full;

        const lines = body.split("\n").filter(Boolean);
        const last = lines[lines.length - 1];
        const m = last.match(/^(\t\.string ")(.*)\$"$/);
        if (!m) return full;

        const flavor = FLAVOR[(hash + fileCount) % FLAVOR.length];
        lines[lines.length - 1] = `${m[1]}${m[2]}${flavor}$"`;
        fileCount++;
        flavorCount++;
        return `${label}:\n${lines.join("\n")}\n`;
      });

      if (out !== src) {
        fs.writeFileSync(sp, out);
        mapsFlavored++;
      }
    }

    if (flavorCount > 0) {
      bulkCount += flavorCount;
      editCount++;
      console.log(`ok: GLOBAL NPC flavor -> ${flavorCount} dialogue lines across ${mapsFlavored} maps (merged-timeline rumors)`);
    } else {
      errors.push("NPC flavor pass touched nothing");
    }
  }

  // -------------------------------------------------------------------------
  console.log(
    `Structural hacks: ${editCount} systems changed, ${bulkCount} individual gameplay edits, ${errors.length} failed.`,
  );
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
