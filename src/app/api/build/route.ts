import { NextResponse } from "next/server";
import {
  commitStoryPackage,
  dispatchRomBuild,
  githubActionsUrl,
} from "@/lib/github/trigger-build";
import type { BuildApiResponse, RomInfo, StoryPackage } from "@/lib/story/types";

type BuildRequest = {
  storyPackage: StoryPackage;
  romInfo: RomInfo;
};

export async function POST(request: Request) {
  let body: BuildRequest;

  try {
    body = (await request.json()) as BuildRequest;
  } catch {
    return NextResponse.json(
      { ok: false, message: "Invalid JSON body." } satisfies BuildApiResponse,
      { status: 400 },
    );
  }

  const { storyPackage, romInfo } = body;

  if (!storyPackage?.scenes?.length) {
    return NextResponse.json(
      { ok: false, message: "Story package has no scenes." } satisfies BuildApiResponse,
      { status: 400 },
    );
  }

  if (storyPackage.scenes.length < 5) {
    return NextResponse.json(
      {
        ok: false,
        message: `Only ${storyPackage.scenes.length} scenes found. Minimum 5 for a build (25+ recommended for full game).`,
      } satisfies BuildApiResponse,
      { status: 400 },
    );
  }

  const buildId = crypto.randomUUID();
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;
  const ref = process.env.GITHUB_REF || "main";

  if (!token || !repo) {
    return NextResponse.json({
      ok: true,
      buildId,
      packageValid: true,
      sceneCount: storyPackage.scenes.length,
      githubTriggered: false,
      message:
        "Story validated. Set GITHUB_TOKEN and GITHUB_REPO on Vercel to enable cloud ROM builds. Until then, download the story package (.json) and run the GitHub Action manually (see README).",
    } satisfies BuildApiResponse);
  }

  const [owner, repoName] = repo.split("/");
  if (!owner || !repoName) {
    return NextResponse.json(
      { ok: false, message: "GITHUB_REPO must be owner/repo format." } satisfies BuildApiResponse,
      { status: 500 },
    );
  }

  const commit = await commitStoryPackage(
    owner,
    repoName,
    ref,
    buildId,
    storyPackage,
    token,
  );

  if (!commit.ok) {
    return NextResponse.json(
      { ok: false, message: commit.message } satisfies BuildApiResponse,
      { status: 502 },
    );
  }

  const dispatch = await dispatchRomBuild(
    owner,
    repoName,
    ref,
    buildId,
    storyPackage.hackTitle,
    romInfo.gameCode,
    token,
  );

  if (!dispatch.ok) {
    return NextResponse.json(
      { ok: false, message: dispatch.message } satisfies BuildApiResponse,
      { status: 502 },
    );
  }

  const actionsUrl = githubActionsUrl(owner, repoName);

  return NextResponse.json({
    ok: true,
    buildId,
    packageValid: true,
    sceneCount: storyPackage.scenes.length,
    githubTriggered: true,
    message: `Build queued (ID: ${buildId}). Cloud compile takes ~5–15 min. Track progress: ${actionsUrl} — download the story-rom-${buildId} artifact when done.`,
  } satisfies BuildApiResponse);
}
