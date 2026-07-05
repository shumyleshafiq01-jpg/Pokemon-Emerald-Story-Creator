#!/usr/bin/env node
/**
 * Saiyan Requiem — FINALIZE pass (data-driven). Runs after apply-story +
 * structural-hacks. Adds new dungeon rooms, scalable "Hollowed Titan" bosses
 * (scripted wild battles — no trainer-slot limit), overworld cameos, and NPC
 * relocations.
 *
 * Collision safety: new dungeons reuse Ancient Tomb blockdata (arrival 8,11 /
 * boss 8,7 vanilla-verified walkable). New characters REPURPOSE existing
 * object_events (inherit a known-walkable tile) via a per-map cursor so no two
 * uses touch the same object. Eject warps target each town's warp #0.
 */
import fs from "node:fs";
import path from "node:path";

export function applyFinalize(expansionRoot) {
  const errors = [];
  let rooms = 0,
    bosses = 0,
    cameos = 0,
    swaps = 0;

  const mdir = (m) => path.join(expansionRoot, "data", "maps", m);
  const readMap = (m) => JSON.parse(fs.readFileSync(path.join(mdir(m), "map.json"), "utf8"));
  const writeMap = (m, j) => fs.writeFileSync(path.join(mdir(m), "map.json"), JSON.stringify(j, null, 2) + "\n");
  const appendScript = (m, t) => fs.appendFileSync(path.join(mdir(m), "scripts.inc"), t);

  const layoutsPath = path.join(expansionRoot, "data", "layouts", "layouts.json");
  const groupsPath = path.join(expansionRoot, "data", "maps", "map_groups.json");
  const evsPath = path.join(expansionRoot, "data", "event_scripts.s");

  // per-map cursor: hands out the next generic, unused object index
  const GENERIC = /_(WOMAN|MAN|BOY|GIRL|FAT_MAN|NINJA_BOY|TWIN|EXPERT|MANIAC|RICH_BOY|SCHOOL_KID|POKEFAN|GENTLEMAN|OLD_MAN|GAMEBOY_KID|COOK|SAILOR|CAMPER|FISHERMAN|LASS|YOUNGSTER|HIKER|BEAUTY|LADY|GENTLEMAN)/;
  const used = {};
  const mapCache = {};
  const getMap = (m) => (mapCache[m] ||= readMap(m));
  function nextNpc(m) {
    const jm = getMap(m);
    used[m] ||= new Set();
    for (let i = 0; i < jm.object_events.length; i++) {
      if (used[m].has(i)) continue;
      const o = jm.object_events[i];
      if (o && GENERIC.test(o.graphics_id) && o.flag === "0") {
        used[m].add(i);
        return i;
      }
    }
    return -1;
  }
  const flushMaps = () => {
    for (const m of Object.keys(mapCache)) writeMap(m, mapCache[m]);
  };

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

  // boss script: trainer battle OR scripted wild "Hollowed Titan"
  function bossScript(tag, boss, ejectMap, ejectX, ejectY, intro, defeat, post, reward = "") {
    const eject = `\nSR_${tag}_Eject::\n\tplayse SE_THUNDER\n\tfadescreen FADE_TO_BLACK\n\twarp MAP_${ejectMap}, ${ejectX}, ${ejectY}\n\twaitstate\n\treturn\n`;
    if (boss.trainer) {
      return (
        `\nSR_${tag}_Boss::\n\ttrainerbattle_single ${boss.trainer}, SR_${tag}_Intro, SR_${tag}_Defeat, SR_${tag}_Won\n` +
        `\tmsgbox SR_${tag}_Rematch, MSGBOX_DEFAULT\n\tclosemessage\n\tcall SR_${tag}_Eject\n\tend\n` +
        `\nSR_${tag}_Won::\n${reward}\tmsgbox SR_${tag}_Post, MSGBOX_DEFAULT\n\tclosemessage\n\tcall SR_${tag}_Eject\n\trelease\n\tend\n` +
        eject +
        `\nSR_${tag}_Intro:\n\t.string "${intro}$"\n\nSR_${tag}_Defeat:\n\t.string "${defeat}$"\n` +
        `\nSR_${tag}_Post:\n\t.string "${post}$"\n\nSR_${tag}_Rematch:\n\t.string "The chamber is quiet now.$"\n`
      );
    }
    return (
      `\nSR_${tag}_Boss::\n\tlock\n\tfaceplayer\n\tmsgbox SR_${tag}_Intro, MSGBOX_DEFAULT\n\tclosemessage\n` +
      `\tsetwildbattle ${boss.species}, ${boss.level}\n\tdowildbattle\n${reward}\tmsgbox SR_${tag}_Post, MSGBOX_DEFAULT\n\tclosemessage\n\tcall SR_${tag}_Eject\n\trelease\n\tend\n` +
      eject +
      `\nSR_${tag}_Intro:\n\t.string "${intro}$"\n\nSR_${tag}_Post:\n\t.string "${post}$"\n`
    );
  }

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
        bossScript(o.const, o.boss, o.entranceConst, o.ejectX, o.ejectY, o.intro, o.defeat || "...", o.post, o.reward),
    );
    includeScripts(o.map);

    // repurpose a townsperson into the gatekeeper
    const gi = nextNpc(o.entranceMap);
    if (gi < 0) return errors.push(`no gatekeeper NPC free in ${o.entranceMap}`);
    const gk = getMap(o.entranceMap).object_events[gi];
    gk.graphics_id = o.gkGfx;
    gk.movement_type = "MOVEMENT_TYPE_FACE_DOWN";
    gk.script = `SR_${o.const}_Gate`;
    appendScript(
      o.entranceMap,
      `\nSR_${o.const}_Gate::\n\tlock\n\tfaceplayer\n\tmsgbox SR_${o.const}_GateText, MSGBOX_YESNO\n` +
        `\tgoto_if_eq VAR_RESULT, NO, SR_${o.const}_GateNo\n\tfadescreen FADE_TO_BLACK\n\twarp MAP_${o.const}, 8, 11\n\twaitstate\n\trelease\n\tend\n` +
        `\nSR_${o.const}_GateNo::\n\tmsgbox SR_${o.const}_GateWait, MSGBOX_DEFAULT\n\trelease\n\tend\n` +
        `\nSR_${o.const}_GateText:\n\t.string "${o.gkText}$"\n\nSR_${o.const}_GateWait:\n\t.string "${o.gkWait}$"\n`,
    );
    rooms++;
    bosses++;
  }

  // ---- 9 dungeon rooms ----
  const T = "OBJ_EVENT_GFX_HEX_MANIAC",
    M = "OBJ_EVENT_GFX_MYSTERY_GIFT_MAN",
    R = "OBJ_EVENT_GFX_ROCKET_M";
  const ROOMS = [
    { const: "ROCKET_SUBTERRACE", map: "RocketSubterrace", music: "MUS_MT_CHIMNEY", entranceMap: "LilycoveCity", entranceConst: "LILYCOVE_CITY", ejectX: 27, ejectY: 6, gkGfx: R,
      boss: { trainer: "TRAINER_GRUNT_UNUSED" }, bossGfx: R,
      gkText: "ROCKET AGENT: Ki bleeds up through\\nthe grates. Our boss buys it by the\\pbarrel. Want to see where it goes?",
      gkWait: "ROCKET AGENT: Smart. Cowards live\\nlonger in two timelines.",
      intro: "ROCKET EXECUTIVE: The pipes drain\\nthe rift dry. KAIROS pays, we pump.",
      defeat: "ROCKET EXECUTIVE: The pump jams!",
      post: "ROCKET EXECUTIVE: Ten more open by\\ndawn. All one hand, courier." },
    { const: "CHAMBER_OF_KI", map: "ChamberOfKi", music: "MUS_SEALED_CHAMBER", entranceMap: "LavaridgeTown", entranceConst: "LAVARIDGE_TOWN", ejectX: 12, ejectY: 15, gkGfx: M,
      boss: { trainer: "TRAINER_FREDRICK" }, bossGfx: M, reward: "\tgiveitem ITEM_RARE_CANDY\n",
      gkText: "PICCOLO: One day inside is a year of\\ntraining. Step in and get stronger,\\por hope. Hope is not a technique.",
      gkWait: "PICCOLO: Come back when you mean it.",
      intro: "PICCOLO: No sky, no mercy in here.\\nShow me the strength you will need.",
      defeat: "PICCOLO: ...Good. You have grown.",
      post: "PICCOLO: Take this. Now go - your\\nworld is thinner than when you came." },
    { const: "NAMEK_SHRINE", map: "NamekShrine", music: "MUS_SEALED_CHAMBER", entranceMap: "RustboroCity", entranceConst: "RUSTBORO_CITY", ejectX: 27, ejectY: 19, gkGfx: M,
      boss: { species: "SPECIES_CLAYDOL", level: 60 }, bossGfx: T, reward: "\tgiveitem ITEM_RARE_CANDY\n",
      gkText: "DENDE: The elder carved this shrine\\nbefore your world touched ours.\\pInside sleeps a guardian. Prove\\nkind, and it may bless you.",
      gkWait: "DENDE: The shrine waits. It is\\npatient. Are you?",
      intro: "A hollow guardian stirs, eyes\\nempty of the world it once knew...",
      post: "The guardian bows. Somewhere, a\\nNamekian elder exhales in relief." },
    { const: "GRAVITY_DOJO", map: "GravityDojo", music: "MUS_MT_CHIMNEY", entranceMap: "DewfordTown", entranceConst: "DEWFORD_TOWN", ejectX: 3, ejectY: 3, gkGfx: M,
      boss: { species: "SPECIES_MACHAMP", level: 58 }, bossGfx: T,
      gkText: "KING KAI: My dojo runs at ten times\\nyour weight. One rep here is ten\\pout there. Ready to sweat, kid?",
      gkWait: "KING KAI: Come back when your knees\\nstop shaking.",
      intro: "The gravity crushes down. A husk of\\na warrior charges through it...",
      post: "KING KAI: HA! You stayed standing.\\nMost don't. Off you go, champ." },
    { const: "CIRCUIT_OF_KI", map: "CircuitOfKi", music: "MUS_MT_CHIMNEY", entranceMap: "MauvilleCity", entranceConst: "MAUVILLE_CITY", ejectX: 8, ejectY: 5, gkGfx: T,
      boss: { species: "SPECIES_MAGNEZONE", level: 59 }, bossGfx: T,
      gkText: "ANDROID: My core reads your ki as a\\nnumber. Numbers can be beaten.\\pStep onto the circuit and prove me\\nwrong.",
      gkWait: "ANDROID: Recalculating. Return when\\nyour output rises.",
      intro: "A hollowed machine hums awake,\\nfeeding on the rift's current...",
      post: "ANDROID: Error. You exceed my\\nmodel. ...Fascinating. Go." },
    { const: "ASTRAL_RIFT", map: "AstralRift", music: "MUS_ABNORMAL_WEATHER", entranceMap: "MossdeepCity", entranceConst: "MOSSDEEP_CITY", ejectX: 28, ejectY: 9, gkGfx: T,
      boss: { species: "SPECIES_METAGROSS", level: 63 }, bossGfx: T, reward: "\tgiveitem ITEM_RARE_CANDY\n",
      gkText: "TIEN: I found a tear in the sky over\\nthe sea. Things fall THROUGH it.\\pStand with me at the edge?",
      gkWait: "TIEN: The tear will not close on its\\nown. Nor will your doubt.",
      intro: "Something enormous folds out of the\\nrift, screaming in reverse...",
      post: "TIEN: It's back through the tear.\\nBut the sky is still bleeding." },
    { const: "SEAL_ANTECHAMBER", map: "SealAntechamber", music: "MUS_CAVE_OF_ORIGIN", entranceMap: "SootopolisCity", entranceConst: "SOOTOPOLIS_CITY", ejectX: 43, ejectY: 31, gkGfx: M,
      boss: { species: "SPECIES_DUSKNOIR", level: 66 }, bossGfx: T, reward: "\tgiveitem ITEM_RARE_CANDY\n",
      gkText: "ELDER: Beneath this city, the seal\\nthins. Only one who has fought the\\phollow may stand watch. Have you?",
      gkWait: "ELDER: Then you are not ready to\\nsee what the deep remembers.",
      intro: "The antechamber's warden turns -\\na body worn hollow by the seal...",
      post: "ELDER: The warden yields. The seal\\nholds one more day. Thanks to you." },
    { const: "REFUGEE_HOLLOW", map: "RefugeeHollow", music: "MUS_SEALED_CHAMBER", entranceMap: "VerdanturfTown", entranceConst: "VERDANTURF_TOWN", ejectX: 3, ejectY: 7, gkGfx: T,
      boss: { species: "SPECIES_COFAGRIGUS", level: 61 }, bossGfx: T,
      gkText: "FUTURE TRUNKS: The people who got\\nerased have to go somewhere. They\\pcame here. One of them turned. Help?",
      gkWait: "FUTURE TRUNKS: I understand. Not\\neveryone can look at what's coming.",
      intro: "A refugee of an unwritten future,\\nhollowed by the crossing, attacks...",
      post: "FUTURE TRUNKS: Rest now, friend.\\nYou made it further than I did." },
    { const: "METEOR_VAULT", map: "MeteorVault", music: "MUS_MT_CHIMNEY", entranceMap: "FallarborTown", entranceConst: "FALLARBOR_TOWN", ejectX: 15, ejectY: 15, gkGfx: M,
      boss: { species: "SPECIES_CLAYDOL", level: 62 }, bossGfx: T,
      gkText: "PROFESSOR COZMO: The meteorite\\nwhispers of the same silence.\\pI locked a piece in the vault. It\\nwoke up. Please - see for yourself.",
      gkWait: "PROFESSOR COZMO: The vault stays\\nsealed until you're certain.",
      intro: "The meteorite fragment pulses, and\\nits keeper rises, eyes gone dark...",
      post: "PROFESSOR COZMO: Astounding. And\\nterrifying. Take my thanks, hero." },
  ];
  for (const r of ROOMS) addRoom(r);

  // ---- 9 overworld Hollowed-Titan mini-bosses (scripted wild) ----
  const TITANS = [
    { map: "SlateportCity", species: "SPECIES_BANETTE", level: 45, name: "a market wraith" },
    { map: "LilycoveCity", species: "SPECIES_MISMAGIUS", level: 52, name: "a department-store haunt" },
    { map: "MossdeepCity", species: "SPECIES_SPIRITOMB", level: 55, name: "a stargazer's shadow" },
    { map: "SootopolisCity", species: "SPECIES_GENGAR", level: 58, name: "a diver's echo" },
    { map: "RustboroCity", species: "SPECIES_AGGRON", level: 48, name: "a quarry husk" },
    { map: "MauvilleCity", species: "SPECIES_ELECTRODE", level: 44, name: "a substation ghost" },
    { map: "FortreeCity", species: "SPECIES_ALTARIA", level: 50, name: "a canopy revenant" },
    { map: "PetalburgCity", species: "SPECIES_SLAKING", level: 53, name: "an idle titan" },
    { map: "VerdanturfTown", species: "SPECIES_WHISCASH", level: 42, name: "a spring dweller" },
  ];
  for (let k = 0; k < TITANS.length; k++) {
    const t = TITANS[k];
    const i = nextNpc(t.map);
    if (i < 0) {
      errors.push(`no titan NPC free in ${t.map}`);
      continue;
    }
    const o = getMap(t.map).object_events[i];
    o.graphics_id = T;
    o.movement_type = "MOVEMENT_TYPE_LOOK_AROUND"; // never walks: safe with static-only sprites + can't block paths
    o.script = `SR_Titan${k}`;
    appendScript(
      t.map,
      `\nSR_Titan${k}::\n\tlock\n\tfaceplayer\n\tmsgbox SR_Titan${k}_Intro, MSGBOX_DEFAULT\n\tclosemessage\n` +
        `\tsetwildbattle ${t.species}, ${t.level}\n\tdowildbattle\n\tmsgbox SR_Titan${k}_Post, MSGBOX_DEFAULT\n\trelease\n\tend\n` +
        `\nSR_Titan${k}_Intro:\n\t.string "It wears a person's shape but its\\neyes read zero. ${t.name}, hollowed.$"\n` +
        `\nSR_Titan${k}_Post:\n\t.string "The husk collapses into quiet ash.\\nOne less voice for the silence.$"\n`,
    );
    bosses++;
  }

  // ---- overworld cameos (repurpose townsfolk into Z-fighter voices) ----
  const CAMEO_GFX = [T, M, "OBJ_EVENT_GFX_MAN_5", "OBJ_EVENT_GFX_GENTLEMAN", "OBJ_EVENT_GFX_SCIENTIST_1"];
  const CAMEO_LINES = [
    "YAMCHA: I sat this one out. Last time I helped save a world it... did not go well for me.",
    "KRILLIN: Bald, short, and still standing after two apocalypses. Beat that, kid.",
    "CHIAOTZU: I can feel him counting. KAIROS. He never stops counting.",
    "TApricot the SCIENTIST: The rift output doubled overnight. My instruments just... weep now.",
    "NAPPA: In my day we conquered planets. Now a crack in the sky does it for free. Lazy.",
    "RADITZ: Blood means nothing to the silence. It eats brothers and strangers the same.",
    "MR POPO: Patience, child. I have watched a thousand skies fall and rise. This one can too.",
    "BARDOCK: I see flashes of a future that isn't. Trust the visions. They're the only honest thing left.",
    "CHI-CHI: Study, train, save the world - fine. But you WILL eat something first.",
    "VIDEL: My father says HE'LL stop the silence. Ha. My father can't stop a sneeze.",
    "HERCULE: I, the CHAMPION of Earth, declare the sky-crack officially handled! ...It is not handled.",
    "ANDROID 18: Bought a ribbon with money that won't exist tomorrow. Worth it.",
    "GOTEN: Is it true a scary man is erasing yesterdays? My big brother says don't be scared.",
    "KID TRUNKS: I punched the fog once. It punched back with a memory that wasn't mine.",
    "DENDE: The seal sings when you pass. It knows a friend. Keep it that way.",
    "TIEN: Two futures, one street. I refuse to choose which strangers get to have existed.",
    "OOLONG: I'd shapeshift out of this timeline if I could. No such luck.",
    "PUAR: Everyone's so gloomy. ...Okay, the sky IS leaking. Fair enough.",
    "FORTUNE TELLER BABA: I see your future. Two of them. One I will not speak aloud.",
    "MASTER SHEN: Power is power, kid. The silence and I agree on that much. Nothing else.",
  ];
  const CAMEO_MAPS = ["SlateportCity", "LilycoveCity", "MossdeepCity", "SootopolisCity", "RustboroCity", "MauvilleCity", "FortreeCity", "PetalburgCity", "OldaleTown", "PacifidlogTown", "FallarborTown", "VerdanturfTown"];
  let ci = 0;
  for (const line of CAMEO_LINES) {
    let placed = false;
    for (let attempt = 0; attempt < CAMEO_MAPS.length && !placed; attempt++) {
      const m = CAMEO_MAPS[(ci + attempt) % CAMEO_MAPS.length];
      const idx = nextNpc(m);
      if (idx < 0) continue;
      const o = getMap(m).object_events[idx];
      o.graphics_id = CAMEO_GFX[cameos % CAMEO_GFX.length];
      o.movement_type = "MOVEMENT_TYPE_LOOK_AROUND"; // never walks: safe with static-only sprites + can't block paths
      const label = `SR_Cameo_${cameos}`;
      o.script = label;
      appendScript(m, `\n${label}::\n\tmsgbox ${label}_Text, MSGBOX_NPC\n\tend\n\n${label}_Text:\n\t.string "${line.replace(/"/g, "'")}$"\n`);
      cameos++;
      placed = true;
      ci++;
    }
  }

  flushMaps();

  // ---- NPC relocations: safe position swaps in 8 towns ----
  const SWAP = [
    ["FortreeCity", 1, 3], ["MauvilleCity", 1, 3], ["PetalburgCity", 0, 2], ["SlateportCity", 6, 8],
    ["RustboroCity", 6, 8], ["MossdeepCity", 7, 9], ["SootopolisCity", 6, 8], ["LilycoveCity", 6, 8],
  ];
  for (const [m, i, j] of SWAP) {
    const jm = readMap(m);
    const a = jm.object_events[i],
      b = jm.object_events[j];
    if (!a || !b) {
      errors.push(`swap idx missing in ${m}`);
      continue;
    }
    [a.x, b.x] = [b.x, a.x];
    [a.y, b.y] = [b.y, a.y];
    writeMap(m, jm);
    swaps++;
  }

  console.log(`Finalize: ${rooms} rooms, ${bosses} bosses, ${cameos} cameos, ${swaps} relocations, ${errors.length} failed.`);
  for (const e of errors) console.error(`  - ${e}`);
  if (errors.length > 0) {
    console.error("::error::Finalize incomplete.");
    process.exit(1);
  }
}
