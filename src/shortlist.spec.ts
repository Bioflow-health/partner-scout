import { describe, expect, test } from "vitest";
import { draftHash } from "./checks";
import type { CheckVerdict } from "./checks";
import type { GateResult } from "./gate";
import { entryStatus, orphanedDrafts } from "./shortlist";
import type { DraftEntry } from "./shortlist";

const gatePass: GateResult = { pass: true, failures: [] };
const gateFail: GateResult = {
  pass: false,
  failures: [{ rule: "em-dash", detail: "em dashes: 1" }],
};
const FIRST = "first draft";
const SECOND = "second draft";
const verdict = (draft: string, pass: boolean): CheckVerdict => ({
  videoId: "v1",
  draftSha256: draftHash(draft),
  pass,
  reason: "the checker's reason",
});
const fit = (...drafts: string[]): DraftEntry => ({
  videoId: "v1",
  fit: true,
  reason: "teaches a clipping workflow",
  attempts: drafts.map((draft) => ({ draft })),
});
const skip: DraftEntry = {
  videoId: "v1",
  fit: false,
  reason: "skip: a general coding tutorial",
  attempts: [],
};

describe("entryStatus", () => {
  test.each([
    {
      state: "no drafts entry",
      entry: undefined,
      gates: [],
      verdicts: [],
      expected: "pending-draft",
    },
    {
      state: "a skip",
      entry: skip,
      gates: [],
      verdicts: [],
      expected: "skipped",
    },
    {
      state: "a fit with no draft yet",
      entry: fit(),
      gates: [],
      verdicts: [],
      expected: "pending-draft",
    },
    {
      state: "a first draft that fails the gate",
      entry: fit(FIRST),
      gates: [gateFail],
      verdicts: [],
      expected: "pending-revision",
    },
    {
      state: "a first draft that passes the gate, not yet checked",
      entry: fit(FIRST),
      gates: [gatePass],
      verdicts: [],
      expected: "pending-checker",
    },
    {
      state: "a first draft the checker fails",
      entry: fit(FIRST),
      gates: [gatePass],
      verdicts: [verdict(FIRST, false)],
      expected: "pending-revision",
    },
    {
      state: "a first draft that passes both",
      entry: fit(FIRST),
      gates: [gatePass],
      verdicts: [verdict(FIRST, true)],
      expected: "ready",
    },
    {
      state: "a draft the checker passed but the gate now fails",
      entry: fit(FIRST),
      gates: [gateFail],
      verdicts: [verdict(FIRST, true)],
      expected: "pending-revision",
    },
    {
      state: "a draft edited after the checker passed it",
      entry: fit(`${FIRST} edited`),
      gates: [gatePass],
      verdicts: [verdict(FIRST, true)],
      expected: "needs-recheck",
    },
    {
      state: "a verdict for another video only",
      entry: fit(FIRST),
      gates: [gatePass],
      verdicts: [{ ...verdict(FIRST, true), videoId: "v2" }],
      expected: "pending-checker",
    },
    {
      state: "a revision not yet checked",
      entry: fit(FIRST, SECOND),
      gates: [gatePass, gatePass],
      verdicts: [verdict(FIRST, false)],
      expected: "pending-checker",
    },
    {
      state: "a revision that fails the gate",
      entry: fit(FIRST, SECOND),
      gates: [gatePass, gateFail],
      verdicts: [verdict(FIRST, false)],
      expected: "blocked",
    },
    {
      state: "a revision the checker passed but the gate now fails",
      entry: fit(FIRST, SECOND),
      gates: [gatePass, gateFail],
      verdicts: [verdict(FIRST, false), verdict(SECOND, true)],
      expected: "blocked",
    },
    {
      state: "a revision the checker fails",
      entry: fit(FIRST, SECOND),
      gates: [gatePass, gatePass],
      verdicts: [verdict(FIRST, false), verdict(SECOND, false)],
      expected: "blocked",
    },
    {
      state: "a revision that passes both",
      entry: fit(FIRST, SECOND),
      gates: [gatePass, gatePass],
      verdicts: [verdict(FIRST, false), verdict(SECOND, true)],
      expected: "ready",
    },
  ])("is $expected for $state", ({ entry, gates, verdicts, expected }) => {
    expect(entryStatus(entry, gates, verdicts)).toBe(expected);
  });
});

describe("orphanedDrafts", () => {
  test("lists drafted videos that are not in the new top 10, in draft order, once each", () => {
    expect(
      orphanedDrafts(["v3", "v1", "v9", "v3", "v7"], ["v1", "v2", "v3"]),
    ).toEqual(["v9", "v7"]);
  });

  test("returns nothing when every drafted video is still a candidate", () => {
    expect(orphanedDrafts(["v1", "v2"], ["v2", "v1", "v5"])).toEqual([]);
  });
});
