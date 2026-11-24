import { describe, expect, test } from "vitest";
import type { GateResult } from "./gate";
import { entryStatus } from "./shortlist";
import type { Attempt, DraftEntry } from "./shortlist";

const gatePass: GateResult = { pass: true, failures: [] };
const gateFail: GateResult = {
  pass: false,
  failures: [{ rule: "em-dash", detail: "em dashes: 1" }],
};
const unchecked: Attempt = { draft: "a draft" };
const checked = (pass: boolean): Attempt => ({
  draft: "a draft",
  checker: { pass, reason: "the checker's reason" },
});
const fit = (attempts: Attempt[]): DraftEntry => ({
  videoId: "v1",
  fit: true,
  reason: "teaches a clipping workflow",
  attempts,
});
const skip: DraftEntry = {
  videoId: "v1",
  fit: false,
  reason: "a general coding tutorial",
  attempts: [],
};

describe("entryStatus", () => {
  test.each([
    {
      state: "no drafts entry",
      entry: undefined,
      gates: [],
      expected: "pending-draft",
    },
    { state: "a skip", entry: skip, gates: [], expected: "skipped" },
    {
      state: "a fit with no draft yet",
      entry: fit([]),
      gates: [],
      expected: "pending-draft",
    },
    {
      state: "a first draft that fails the gate",
      entry: fit([unchecked]),
      gates: [gateFail],
      expected: "pending-revision",
    },
    {
      state: "a first draft that passes the gate, not yet checked",
      entry: fit([unchecked]),
      gates: [gatePass],
      expected: "pending-checker",
    },
    {
      state: "a first draft the checker fails",
      entry: fit([checked(false)]),
      gates: [gatePass],
      expected: "pending-revision",
    },
    {
      state: "a first draft that passes both",
      entry: fit([checked(true)]),
      gates: [gatePass],
      expected: "ready",
    },
    {
      state: "a revision that fails the gate",
      entry: fit([checked(false), unchecked]),
      gates: [gatePass, gateFail],
      expected: "blocked",
    },
    {
      state: "a revision the checker fails",
      entry: fit([checked(false), checked(false)]),
      gates: [gatePass, gatePass],
      expected: "blocked",
    },
    {
      state: "a revision that passes both",
      entry: fit([checked(false), checked(true)]),
      gates: [gatePass, gatePass],
      expected: "ready",
    },
  ])("is $expected for $state", ({ entry, gates, expected }) => {
    expect(entryStatus(entry, gates)).toBe(expected);
  });
});
