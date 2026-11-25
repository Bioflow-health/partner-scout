import { describe, expect, test } from "vitest";
import { parseArgs, USAGE } from "./args";

describe("parseArgs", () => {
  test.each([
    { args: ["live"], command: { kind: "live" } },
    { args: ["cached"], command: { kind: "cached", path: undefined } },
    {
      args: ["cached", "out/cache/2026-11-24-2.json"],
      command: { kind: "cached", path: "out/cache/2026-11-24-2.json" },
    },
    { args: ["shortlist"], command: { kind: "shortlist", run: undefined } },
    {
      args: ["shortlist", "2026-11-24-2"],
      command: { kind: "shortlist", run: "2026-11-24-2" },
    },
    { args: ["learn"], command: { kind: "learn" } },
  ])("reads $args as a $command.kind command", ({ args, command }) => {
    expect(parseArgs(args)).toEqual(command);
  });

  test.each([
    { why: "no command", args: [] },
    { why: "--help", args: ["--help"] },
    { why: "-h", args: ["-h"] },
    { why: "--help after a command", args: ["live", "--help"] },
    { why: "an extra argument to live", args: ["live", "extra"] },
    { why: "two cache paths", args: ["cached", "a.json", "b.json"] },
    { why: "a flag where a cache path goes", args: ["cached", "--cached"] },
    { why: "an unknown command", args: ["shortlst"] },
    { why: "the old --cached flag", args: ["--cached", "out/cache/x.json"] },
    { why: "two run names", args: ["shortlist", "a", "b"] },
    { why: "an argument to learn", args: ["learn", "x"] },
  ])("asks for usage on $why, so nothing runs by accident", ({ args }) => {
    expect(parseArgs(args)).toEqual({ kind: "usage" });
  });
});

describe("USAGE", () => {
  test("lists every npm script and says which one calls the API", () => {
    expect(USAGE).toBe(
      [
        "Usage:",
        "  npm run scout:live                 Search YouTube (about 510 quota units), then rank and write a new run.",
        "  npm run scout:cached [cache-file]  Re-score a saved cache (the newest by default). No API calls.",
        "  npm run shortlist [run]            Render a run's shortlist (the newest run by default). No API calls.",
        "  npm run learn                      Summarize config/outcomes.csv. No API calls.",
        "",
        "Only scout:live spends YouTube quota.",
      ].join("\n"),
    );
  });
});
