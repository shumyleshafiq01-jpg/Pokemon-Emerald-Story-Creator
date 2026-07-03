import type { RomInfo } from "@/lib/story/types";

export function generateStoryPrompt(rom: RomInfo): string {
  return `# Pokémon Emerald Story Hack — AI Writing Brief

You are writing a **complete replacement storyline** for a Pokémon Emerald ROM hack.
The output will be parsed by **Story Builder** and compiled into a playable GBA ROM.
Write production-ready content — not summaries.

---

## ROM reference (uploaded by user)

| Field | Value |
|-------|-------|
| Title | ${rom.title} |
| Game code | ${rom.gameCode} |
| Size | ${rom.size.toLocaleString()} bytes |
| SHA-256 (prefix) | ${rom.sha256Prefix} |

Base game: **Pokémon Emerald (Hoenn)**. Maps, gyms, and routes stay unless a scene note says otherwise.
Replace **plot, dialogue, factions, and character arcs** entirely.

---

## Deliverables — file structure

Return **multiple Markdown files** in one response (clearly separated with \`=== FILE: filename.md ===\` headers).

### Required files

1. \`00-overview.md\` — world bible (no frontmatter on this file)
2. \`act1-01-truck-intro.md\` through \`act6-XX-epilogue.md\` — one file per major scene
3. Minimum **25 scene files** covering the full game (intro → champion)

Use this naming pattern: \`act{N}-{NN}-{slug}.md\`

---

## Scene file format (STRICT — parser will reject invalid files)

Every scene file **must** start with YAML frontmatter:

\`\`\`markdown
---
scene_id: act1-01-truck-intro
map: LittlerootTown
vanilla_event: LittlerootTown_EventScript_Intro
act: 1
flags: VAR_LITTLEROOT_INTRO_STATE
---

# Scene: Arrival in Littleroot

## Context
2–4 sentences: what happens, what vanilla event this replaces, player state.

## Characters
- MOM — role in scene
- RIVAL — role in scene

## Dialogue

| Speaker | Line | Notes |
|---------|------|-------|
| MOM | Welcome to our new home in Littleroot! | warm, relieved |
| PLAYER | | silent protagonist |
| NARRATOR | (optional) | use sparingly |

## Story flags / triggers
- Sets VAR_LITTLEROOT_INTRO_STATE = 1 when complete
- Unlocks: Route 101 Birch rescue

## Implementation notes
Map scripts, cutscenes, battles, item gifts, or faction spawns the builder should wire.
\`\`\`

### Dialogue rules
- **Speaker** must be uppercase ID: \`MOM\`, \`BIRCH\`, \`RIVAL\`, \`GRUNT\`, \`LEADER_X\`, \`PLAYER\` (silent), \`SIGN\`
- **Line** max **250 characters** (GBA text box limit ~2 boxes)
- Use \`\\n\` only when the player must press A mid-line
- No emoji, no markdown inside cells

---

## 00-overview.md format

\`\`\`markdown
# [Your Hack Title]

## Elevator pitch
3 sentences max.

## Themes
- theme 1
- theme 2

## Protagonist
Name default, backstory, starting goal, end goal.

## Rival
Name, personality, 3-beat arc (early / mid / late).

## Antagonist / faction
Organization name, leader, motive, why player opposes them.
State whether Team Magma/Aqua are replaced or rewritten.

## Legendaries
Which appear in story and whether required for plot.

## Act structure

| Act | Region progress | Main conflict |
|-----|-----------------|---------------|
| 1 | Littleroot → Stone Badge | |
| 2 | → Knuckle Badge | |
| 3 | → Dynamo Badge | mid-game twist |
| 4 | → Heat Badge | |
| 5 | → Feather Badge | |
| 6 | → Champion | climax + epilogue |

## New named NPCs
| Name | Role | First scene file |
|------|------|------------------|
| | | |

## Tone & content rating
(e.g. PG, serious drama, light comedy — no explicit content)
\`\`\`

---

## Hoenn story spine — scenes you MUST cover

Write a unique story for each beat (do not copy vanilla Team Magma/Aqua unless instructed):

### Act 1 — Awakening
1. Truck arrival / house intro (\`LittlerootTown\`)
2. Clock + rival house (\`LittlerootTown\`, rival bedroom)
3. Route 101 — professor rescue + starter (\`Route101\`, \`ProfBirch\`)
4. Route 103 — first rival battle (\`Route103\`)
5. Petalburg — Norman / Wally (\`PetalburgCity\`)
6. Route 102 → Petalburg Woods faction intro
7. Rustboro — Roxanne + Devon / research plot
8. Route 116 — tunnel / first dungeon beat

### Act 2 — Expansion
9. Dewford — Brawly + rival rematch
10. Slateport — Oceanic Museum / faction operation
11. Route 110 — Trick House or alternate setpiece
12. Mauville — Wattson + city event
13. Fallarbor — meteor / alternate McGuffin
14. Mt. Chimney — major faction clash (replaces Groudon/Kyogre awakening OR recontextualizes it)

### Act 3 — Convergence
15. Lavaridge — Flannery
16. Petalburg Gym — Norman
17. Fortree — Winona + spy/reveal scene
18. Mt. Pyre — lore / macguffin
19. Lilycove — hideout discovery
20. Mossdeep — Tate & Liza + pre-climax planning

### Act 4 — Climax
21. Seafloor Cavern OR your climax dungeon
22. Sootopolis — legendary confrontation (rewrite entirely)
23. Rayquaza / legendary resolution (your mythology)

### Act 5 — Victory Road
24. Wallace / Juan story beats if used
25. Elite Four flavor + champion battle dialogue
26. Epilogue — homecoming or sequel hook

---

## Quality bar

- **Detailed**: every scene has 8–20 dialogue lines minimum for major scenes, 4+ for minor
- **Consistent**: names, faction goals, and timeline never contradict \`00-overview.md\`
- **Playable**: every scene lists \`map\` and \`vanilla_event\` when replacing a known event; if original, say \`vanilla_event: NEW\`
- **Branching awareness**: note if scene differs by player gender (May/Brendan) — write both variants in separate rows prefixed \`MOM (if Brendan)\`

---

## Output instruction

Produce all files now. Start with:

\`\`\`
=== FILE: 00-overview.md ===
\`\`\`

Then each scene file in act order. Do not omit files. Do not wrap the entire output in a single code block.
`;
}

export function generateFormatOnlyPrompt(): string {
  return `You are a formatter. The user will paste a rough story idea.
Expand it into the full multi-file Story Builder format described below.
${generateStoryPrompt({
  valid: true,
  title: "POKEMON EMER",
  gameCode: "BPEE",
  size: 16777216,
  sha256Prefix: "unknown",
  errors: [],
})}`;
}
