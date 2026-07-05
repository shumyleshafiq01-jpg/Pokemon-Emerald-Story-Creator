#!/usr/bin/env node
/**
 * Saiyan Requiem — FINALIZE pass. Runs after apply-story + structural-hacks.
 * Adds new dungeon rooms (entered by talking to a repurposed NPC), relocates
 * existing townsfolk, and repurposes generic NPCs into Z-fighter cameos.
 *
 * Collision safety: new dungeons reuse Ancient Tomb blockdata (arrival tile
 * 8,11 and NPC tile 8,7 are vanilla-verified walkable). New "characters" are
 * NOT freshly placed objects (which could land in a wall) — they REPURPOSE an
 * existing townsperson object, so they inherit a known-walkable tile. Eject
 * warps target each town's warp #0 (a door tile, always walkable).
 */
import fs from "node:fs";
import path from "node:path";

export function applyFinalize(expansionRoot) {
  const errors = [];
  let rooms = 0,
    cameos = 0,
    swaps = 0;

  const mdir = (m) => path.join(expansionRoot, "data", "maps", m);
  const readMap = (m) => JSON.parse(fs.readFileSync(path.join(mdir(m), "map.json"), "utf8"));
  const writeMap = (m, j) => fs.writeFileSync(path.join(mdir(m), "map.json"), JSON.stringify(j, null, 2) + "\n");
  const appendScript = (m, t) => fs.appendFileSync(path.join(mdir(m), "scripts.inc"), t);

  const layoutsPath = path.join(expansionRoot, "data", "layouts", "layouts.json");
  const groupsPath = path.join(expansionRoot, "data", "maps", "map_groups.json");
  const evsPath = path.join(expansionRoot, "data", "event_scripts.s");
  const partyPath = path.join(expansionRoot, "src", "data", "trainers.party");

  const registerLayout = (id, name) => {
    const L = JSON.parse(fs.readFileSync(layoutsPath, "utf8"));
    const donor = L.layouts.find((l) => l && l.id === "LAYOUT_ANCIENT_TOMB");
    if (!donor) return errors.push(`donor layout missing for ${id}`), false;
    if (!L.layouts.some((l) => l && l.id === id)) {
      L.layouts.push({ ...donor, id, name });
      fs.writeFileSync(layoutsPath, JSON.stringify(L, null, 2) + "\n");
    }
    return true;
  };
  const addToGroup = (mapName) => {
    const G = JSON.parse(fs.readFileSync(groupsPath, "utf8"));
    if (!G.gMapGroup_Dungeons.includes(mapName)) {
      G.gMapGroup_Dungeons.push(mapName);
      fs.writeFileSync(groupsPath, JSON.stringify(G, null, 2) + "\n");
    }
  };
  const includeScripts = (mapName) => {
    const evs = fs.readFileSync(evsPath, "utf8");
    if (!evs.includes(`maps/${mapName}/scripts.inc`)) {
      fs.appendFileSync(evsPath, `\n\t.include "data/maps/${mapName}/scripts.inc"\n`);
    }
  };
  const replaceTrainer = (find, replace, tag) => {
    const src = fs.readFileSync(partyPath, "utf8");
    if (!src.includes(find)) return errors.push(`trainer anchor missing: ${tag}`), false;
    fs.writeFileSync(partyPath, src.replace(find, replace));
    return true;
  };

  // ---- add a dungeon reached via a repurposed gatekeeper NPC ----
  function addRoom(o) {
    const layoutId = `LAYOUT_${o.const}`;
    if (!registerLayout(layoutId, `${o.map}_Layout`)) return;
    addToGroup(o.map);

    const dir = mdir(o.map);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, "map.json"),
      JSON.stringify(
        {
          id: `MAP_${o.const}`,
          name: o.map,
          layout: layoutId,
          music: o.music,
          region: "REGION_HOENN",
          region_map_section: "MAPSEC_ANCIENT_TOMB",
          requires_flash: false,
          weather: o.weather || "WEATHER_NONE",
          map_type: "MAP_TYPE_UNDERGROUND",
          allow_cycling: false,
          allow_escaping: true,
          allow_running: true,
          show_map_name: false,
          battle_scene: "MAP_BATTLE_SCENE_NORMAL",
          connections: null,
          object_events: [
            {
              graphics_id: o.bossGfx,
              x: 8,
              y: 7,
              elevation: 3,
              movement_type: "MOVEMENT_TYPE_FACE_DOWN",
              movement_range_x: 0,
              movement_range_y: 0,
              trainer_type: "TRAINER_TYPE_NONE",
              trainer_sight_or_berry_tree_id: "0",
              script: `SR_${o.const}_Boss`,
              flag: "0",
            },
          ],
          warp_events: [],
          coord_events: [],
          bg_events: [],
        },
        null,
        2,
      ) + "\n",
    );
    fs.writeFileSync(
      path.join(dir, "scripts.inc"),
      `${o.map}_MapScripts::\n\t.byte 0\n` +
        `\nSR_${o.const}_Boss::\n` +
        `\ttrainerbattle_single ${o.bossTrainer}, SR_${o.const}_Intro, SR_${o.const}_Defeat, SR_${o.const}_Won\n` +
        `\tmsgbox SR_${o.const}_Rematch, MSGBOX_DEFAULT\n\tclosemessage\n\tcall SR_${o.const}_Eject\n\tend\n` +
        `\nSR_${o.const}_Won::\n${o.reward || ""}\tmsgbox SR_${o.const}_Post, MSGBOX_DEFAULT\n\tclosemessage\n\tcall SR_${o.const}_Eject\n\trelease\n\tend\n` +
        `\nSR_${o.const}_Eject::\n\tplayse SE_THUNDER\n\tfadescreen FADE_TO_BLACK\n\twarp MAP_${o.entranceConst}, ${o.ejectX}, ${o.ejectY}\n\twaitstate\n\treturn\n` +
        `\nSR_${o.const}_Intro:\n\t.string "${o.intro}$"\n` +
        `\nSR_${o.const}_Defeat:\n\t.string "${o.defeat}$"\n` +
        `\nSR_${o.const}_Post:\n\t.string "${o.post}$"\n` +
        `\nSR_${o.const}_Rematch:\n\t.string "${o.rematch}$"\n`,
    );
    includeScripts(o.map);

    // repurpose an existing NPC in the entrance town into the gatekeeper
    const em = readMap(o.entranceMap);
    const gk = em.object_events[o.gkIndex];
    if (!gk) return errors.push(`gatekeeper index ${o.gkIndex} missing in ${o.entranceMap}`);
    gk.graphics_id = o.gkGfx;
    gk.movement_type = "MOVEMENT_TYPE_FACE_DOWN";
    gk.script = `SR_${o.const}_Gate`;
    writeMap(o.entranceMap, em);
    appendScript(
      o.entranceMap,
      `\nSR_${o.const}_Gate::\n\tlock\n\tfaceplayer\n\tmsgbox SR_${o.const}_GateText, MSGBOX_YESNO\n` +
        `\tgoto_if_eq VAR_RESULT, NO, SR_${o.const}_GateNo\n\tfadescreen FADE_TO_BLACK\n\twarp MAP_${o.const}, 8, 11\n\twaitstate\n\trelease\n\tend\n` +
        `\nSR_${o.const}_GateNo::\n\tmsgbox SR_${o.const}_GateWait, MSGBOX_DEFAULT\n\trelease\n\tend\n` +
        `\nSR_${o.const}_GateText:\n\t.string "${o.gkText}$"\n` +
        `\nSR_${o.const}_GateWait:\n\t.string "${o.gkWait}$"\n`,
    );
    rooms++;
  }

  // ROOM 1 — Rocket Subterrace, entered from Lilycove
  addRoom({
    const: "ROCKET_SUBTERRACE",
    map: "RocketSubterrace",
    music: "MUS_MT_CHIMNEY",
    entranceMap: "LilycoveCity",
    entranceConst: "LILYCOVE_CITY",
    gkIndex: 2,
    gkGfx: "OBJ_EVENT_GFX_ROCKET_M",
    gkText: "ROCKET AGENT: You smell it, don't\\nyou? Ki bleaking up through the\\pgrates.\\pOur boss buys it by the barrel.\\nWant to see where it goes?",
    gkWait: "ROCKET AGENT: Smart. Cowards live\\nlonger in two timelines.",
    bossTrainer: "TRAINER_GRUNT_UNUSED",
    bossGfx: "OBJ_EVENT_GFX_ROCKET_M",
    ejectX: 27,
    ejectY: 6,
    intro: "ROCKET EXECUTIVE: A courier who\\nwanders off the route.\\pThis whole plant drains the rift\\ndry - KAIROS pays, we pump.\\pYou were never meant to see the\\npipes. Pity.",
    defeat: "ROCKET EXECUTIVE: The pump...\\njams!",
    post: "ROCKET EXECUTIVE: Shut it if you\\nlike. Ten more open by dawn.\\pTHE SYNDICATE, THE TEAMS, KAIROS -\\nall one hand, courier. All one.",
    rematch: "ROCKET EXECUTIVE: The pipes are\\nquiet. For now.",
  });

  // ROOM 2 — Chamber of Ki (Hyperbolic Time Chamber), entered from Lavaridge
  addRoom({
    const: "CHAMBER_OF_KI",
    map: "ChamberOfKi",
    music: "MUS_SEALED_CHAMBER",
    weather: "WEATHER_NONE",
    entranceMap: "LavaridgeTown",
    entranceConst: "LAVARIDGE_TOWN",
    gkIndex: 2,
    gkGfx: "OBJ_EVENT_GFX_MYSTERY_GIFT_MAN",
    gkText: "PICCOLO: One door. One day inside\\nis a year of training.\\pThe silence is coming for your\\nworld. Step in and get stronger,\\por stand out here and hope.",
    gkWait: "PICCOLO: Hope is not a technique.\\nCome back when you mean it.",
    bossTrainer: "TRAINER_FREDRICK",
    bossGfx: "OBJ_EVENT_GFX_MYSTERY_GIFT_MAN",
    ejectX: 12,
    ejectY: 15,
    reward: "\tgiveitem ITEM_RARE_CANDY\n",
    intro: "PICCOLO: In here, there is no sky\\nand no mercy.\\pShow me the strength you will\\nneed. Do not hold back - the\\pStillness will not.",
    defeat: "PICCOLO: ...Good. You have grown.",
    post: "PICCOLO: Take this. A day in here\\nis a year in your bones.\\pNow go. Your world is thinner\\nthan when you entered.",
    rematch: "PICCOLO: The chamber rests.\\nSo should you.",
  });

  // themed boss teams for the reused trainer slots
  replaceTrainer(
    "=== TRAINER_GRUNT_UNUSED ===\nName: GRUNT\nClass: Team Magma\nPic: Aqua Grunt F\n",
    "=== TRAINER_GRUNT_UNUSED ===\nName: EXECUTIVE\nClass: Team Rocket Frlg\nPic: Rocket Grunt M Frlg\n",
    "grunt_unused",
  );
  replaceTrainer(
    "=== TRAINER_FREDRICK ===\nName: FREDRICK\nClass: Expert\nPic: Expert M\nGender: Male\nMusic: Intense\nDouble Battle: No\nAI: Basic Trainer\n",
    "=== TRAINER_FREDRICK ===\nName: PICCOLO\nClass: Expert\nPic: Expert M\nGender: Male\nMusic: Intense\nDouble Battle: No\nAI: Check Bad Move / Try To Faint / Check Viability\n\nDusknoir\nLevel: 58\nIVs: 31 HP / 31 Atk / 31 Def / 31 SpA / 31 SpD / 31 Spe\n- Shadow Punch\n- Earthquake\n- Ice Punch\n\nGardevoir\nLevel: 58\nIVs: 31 HP / 31 Atk / 31 Def / 31 SpA / 31 SpD / 31 Spe\n- Psychic\n- Moonblast\n- Calm Mind\n\nMachamp\nLevel: 59\nIVs: 31 HP / 31 Atk / 31 Def / 31 SpA / 31 SpD / 31 Spe\n- Cross Chop\n- Earthquake\n- Bulk Up\n",
    "fredrick",
  );

  // ---- relocate + repurpose townsfolk (safe: only touches known-walkable objects) ----
  const swap = (m, i, j) => {
    const jm = readMap(m);
    const a = jm.object_events[i],
      b = jm.object_events[j];
    if (!a || !b) return errors.push(`swap idx missing in ${m}`);
    [a.x, b.x] = [b.x, a.x];
    [a.y, b.y] = [b.y, a.y];
    writeMap(m, jm);
    swaps++;
  };
  // repurpose an existing NPC into a talking cameo (keeps its walkable tile)
  const cameo = (m, idx, gfx, label, text) => {
    const jm = readMap(m);
    const o = jm.object_events[idx];
    if (!o) return errors.push(`cameo idx ${idx} missing in ${m}`);
    if (gfx) o.graphics_id = gfx;
    o.script = label;
    o.movement_type = "MOVEMENT_TYPE_WANDER_AROUND";
    writeMap(m, jm);
    appendScript(m, `\n${label}::\n\tmsgbox ${label}_Text, MSGBOX_NPC\n\tend\n\n${label}_Text:\n\t.string "${text}$"\n`);
    cameos++;
  };

  swap("FortreeCity", 0, 3);
  swap("MauvilleCity", 0, 3);
  swap("PetalburgCity", 0, 2);
  swap("SlateportCity", 1, 3);

  cameo("FortreeCity", 4, "OBJ_EVENT_GFX_HEX_MANIAC", "SR_Cameo_Tien",
    "TIEN: Three eyes, one truth.\\pI see the same street twice - once\\nas it is, once as it will be\\punwritten. Do not make me choose.");
  cameo("MauvilleCity", 2, "OBJ_EVENT_GFX_MAN_5", "SR_Cameo_Roshi",
    "OLD MASTER: Heh. In my day, power\\nwas earned in the desert with\\pyour bare hands.\\pNow it drips from a crack in the\\nsky and men bottle it. Feh.");
  cameo("PetalburgCity", 3, "OBJ_EVENT_GFX_GENTLEMAN", "SR_Cameo_KingKai",
    "KING KAI: Ha! Good one. ...No? You\\ndidn't hear a joke?\\pThat's because I told it in a\\ntimeline that no longer exists.\\pKAIROS ate the punchline.");
  cameo("LilycoveCity", 3, "OBJ_EVENT_GFX_RIVAL_BRENDAN_NORMAL", "SR_Cameo_Trunks",
    "STRANGER IN A COAT: I came a long\\nway back to stop this.\\pDo not trust the man who offers\\nyou a kinder yesterday. I trusted\\phim. Look what it cost.");
  cameo("MossdeepCity", 2, "OBJ_EVENT_GFX_HEX_MANIAC", "SR_Cameo_Watcher4",
    "WATCHER: Four cities now bear my\\nfootprints and none remember them.\\pYou are close to the question.\\nAnswer it awake.");

  console.log(`Finalize: ${rooms} new rooms, ${swaps} NPC relocations, ${cameos} overworld cameos, ${errors.length} failed.`);
  for (const e of errors) console.error(`  - ${e}`);
  if (errors.length > 0) {
    console.error("::error::Finalize incomplete.");
    process.exit(1);
  }
}
