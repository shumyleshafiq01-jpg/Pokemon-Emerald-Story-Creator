import type { StoryPackage } from "@/lib/story/types";

type CommitResult = { ok: true } | { ok: false; message: string };

export async function commitStoryPackage(
  owner: string,
  repo: string,
  ref: string,
  buildId: string,
  storyPackage: StoryPackage,
  token: string,
): Promise<CommitResult> {
  const path = `build-requests/${buildId}/story-package.json`;
  const content = Buffer.from(JSON.stringify(storyPackage, null, 2)).toString("base64");

  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: `chore: story build request ${buildId}`,
        content,
        branch: ref,
      }),
    },
  );

  if (!res.ok) {
    const err = await res.text();
    return { ok: false, message: `GitHub commit failed (${res.status}): ${err}` };
  }

  return { ok: true };
}

export async function dispatchRomBuild(
  owner: string,
  repo: string,
  ref: string,
  buildId: string,
  hackTitle: string,
  romGameCode: string,
  token: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/actions/workflows/build-story-rom.yml/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ref,
        inputs: {
          build_id: buildId,
          hack_title: hackTitle,
          rom_game_code: romGameCode,
        },
      }),
    },
  );

  if (!res.ok) {
    const err = await res.text();
    return { ok: false, message: `GitHub Actions dispatch failed (${res.status}): ${err}` };
  }

  return { ok: true };
}

export function githubActionsUrl(owner: string, repo: string): string {
  return `https://github.com/${owner}/${repo}/actions/workflows/build-story-rom.yml`;
}
