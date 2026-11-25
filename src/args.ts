export type Command =
  | { kind: "live" }
  | { kind: "cached"; path: string | undefined }
  | { kind: "shortlist"; run: string | undefined }
  | { kind: "learn" }
  | {
      kind: "check";
      run: string;
      videoId: string;
      pass: boolean;
      reason: string;
    }
  | { kind: "usage" };

export const USAGE = [
  "Usage:",
  "  npm run scout:live                 Search YouTube (about 510 quota units), then rank and write a new run.",
  "  npm run scout:cached [cache-file]  Re-score a saved cache (the newest by default). No API calls.",
  "  npm run shortlist [run]            Render a run's shortlist (the newest run by default). No API calls.",
  "  npm run learn                      Summarize config/outcomes.csv. No API calls.",
  "  npm run check:record <run> <videoId> <pass|fail> <reason>",
  "                                     Record a dm-checker verdict for the current draft. No API calls.",
  "",
  "Only scout:live spends YouTube quota.",
].join("\n");

const USAGE_COMMAND: Command = { kind: "usage" };

const isFlag = (arg: string | undefined) => arg?.startsWith("-") ?? false;

const parseCheck = (rest: readonly string[]): Command => {
  const [run, videoId, verdict, ...reason] = rest;
  if (
    run === undefined ||
    videoId === undefined ||
    [run, videoId, verdict].some(isFlag) ||
    (verdict !== "pass" && verdict !== "fail") ||
    reason.length === 0
  ) {
    return USAGE_COMMAND;
  }
  return {
    kind: "check",
    run,
    videoId,
    pass: verdict === "pass",
    reason: reason.join(" "),
  };
};

export const parseArgs = (args: readonly string[]): Command => {
  const [command, ...rest] = args;
  if (command === "check") return parseCheck(rest);
  if (args.some(isFlag)) return USAGE_COMMAND;
  if (command === "live" && rest.length === 0) return { kind: "live" };
  if (command === "cached" && rest.length <= 1) {
    return { kind: "cached", path: rest[0] };
  }
  if (command === "shortlist" && rest.length <= 1) {
    return { kind: "shortlist", run: rest[0] };
  }
  if (command === "learn" && rest.length === 0) return { kind: "learn" };
  return USAGE_COMMAND;
};
