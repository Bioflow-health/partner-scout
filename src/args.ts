export type Command =
  | { kind: "live" }
  | { kind: "cached"; path: string | undefined }
  | { kind: "shortlist"; run: string | undefined }
  | { kind: "learn" }
  | { kind: "usage" };

export const USAGE = [
  "Usage:",
  "  npm run scout:live                 Search YouTube (about 510 quota units), then rank and write a new run.",
  "  npm run scout:cached [cache-file]  Re-score a saved cache (the newest by default). No API calls.",
  "  npm run shortlist [run]            Render a run's shortlist (the newest run by default). No API calls.",
  "  npm run learn                      Summarize config/outcomes.csv. No API calls.",
  "",
  "Only scout:live spends YouTube quota.",
].join("\n");

const USAGE_COMMAND: Command = { kind: "usage" };

export const parseArgs = (args: readonly string[]): Command => {
  if (args.some((arg) => arg.startsWith("-"))) return USAGE_COMMAND;
  const [command, ...rest] = args;
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
