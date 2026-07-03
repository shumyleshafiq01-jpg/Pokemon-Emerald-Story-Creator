export type RomInfo = {
  valid: boolean;
  title: string;
  gameCode: string;
  size: number;
  sha256Prefix: string;
  errors: string[];
};

export type StoryScene = {
  id: string;
  title: string;
  map?: string;
  vanillaEvent?: string;
  act?: number;
  dialogue: { speaker: string; line: string; note?: string }[];
  flags?: string[];
  rawBody: string;
};

export type StoryPackage = {
  version: 1;
  hackTitle: string;
  romGameCode: string;
  createdAt: string;
  overview?: string;
  scenes: StoryScene[];
  files: { name: string; content: string }[];
};

export type BuildJobStatus =
  | { state: "idle" }
  | { state: "validating" }
  | { state: "queued"; buildId: string; message: string }
  | { state: "building"; buildId: string; message: string }
  | { state: "ready"; buildId: string; downloadUrl?: string; message: string }
  | { state: "error"; message: string };

export type BuildApiResponse = {
  ok: boolean;
  buildId?: string;
  message: string;
  githubTriggered?: boolean;
  packageValid?: boolean;
  sceneCount?: number;
};
