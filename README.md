# PKMN EXP — Story Builder

Web app for Pokémon Emerald story hacks: **ROM → AI prompt → Markdown → compiled `.gba`**.

- **UI:** Next.js on [Vercel](https://vercel.com)
- **ROM compile:** [GitHub Actions](https://github.com/features/actions) (devkitARM + pokeemerald-expansion)
- **No prebuilt hacked ROMs** — builds from [rh-hideout/pokeemerald-expansion](https://github.com/rh-hideout/pokeemerald-expansion)

## Story Builder flow

1. **Upload ROM** — validates Pokémon Emerald (BPEE) client-side
2. **Copy AI prompt** — paste into Claude, GPT, Gemini, Cursor, DeepSeek, etc.
3. **Upload `.md` files** — AI returns `00-overview.md` + scene files
4. **Create new ROM** — queues GitHub Actions build

## Local dev

```bash
cd story-builder
npm install
npm run dev
```

Open [http://localhost:3000/story-builder](http://localhost:3000/story-builder)

## Deploy to Vercel

1. Push this folder to GitHub
2. Import repo in Vercel (root = `story-builder`)
3. Add environment variables (see `.env.local.example`):
   - `GITHUB_TOKEN` — fine-grained PAT with **Contents: Read/Write** and **Actions: Read/Write**
   - `GITHUB_REPO` — `owner/repo`
   - `GITHUB_REF` — `main`

When a user clicks **Create new ROM**, the API commits the story JSON to `build-requests/{buildId}/` on GitHub, then triggers the workflow. No size limit issues, no Ubuntu on the user's PC.

## Test locally without AI

1. `npm run dev` → open `/story-builder`
2. Upload your Emerald `.gba`
3. Skip the prompt step — download files from `/examples/` (also in `public/examples/`)
4. Upload all 6 example `.md` files in Step 3
5. Step 4 validates and queues a build (needs GitHub token) or downloads story package JSON

## Manual ROM build (no Vercel token)

1. Download **story package (.json)** from Step 4
2. GitHub → Actions → **Build Story ROM** → Run workflow
3. Paste JSON into `story_json` input (or commit as `story-package.json` and adjust workflow)
4. Download `story-rom-*.gba` artifact

## Story Markdown format

See the generated prompt in the app, or `story/STORY_BIBLE.md` in the parent PKMN EXP folder.

## Architecture note

Vercel cannot run `make` for GBA ROMs (time + toolchain limits). The web app validates and orchestrates; **GitHub Actions compiles** the ROM. Wiring map scripts to every scene is ongoing — v1 injects custom dialogue text into the expansion source tree.

## License

Story Builder app: your project. pokeemerald-expansion: respective upstream licenses.
