import { describe, expect, test } from "vitest";
import { draftHash, parseChecks, recordVerdict } from "./checks";

const PATH = "out/checks-r.json";
const HASH_ABC =
  "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

describe("draftHash", () => {
  test("is the hex sha256 of the exact draft text", () => {
    expect(draftHash("abc")).toBe(HASH_ABC);
  });

  test("changes when a single character changes", () => {
    expect(draftHash("abc ") === draftHash("abc")).toBe(false);
  });
});

describe("parseChecks", () => {
  test("reads a valid checks file", () => {
    const verdict = {
      videoId: "TG0RWzk4nK0",
      draftSha256: HASH_ABC,
      pass: true,
      reason: "grounded",
    };

    expect(parseChecks({ checks: [verdict] }, PATH)).toEqual([verdict]);
  });

  test.each([
    {
      problem: "no checks array",
      json: {},
      error: `${PATH}: expected an object with a "checks" array`,
    },
    {
      problem: "a non-object entry",
      json: { checks: [1] },
      error: `${PATH}: checks[0] must be an object`,
    },
    {
      problem: "a missing videoId",
      json: { checks: [{ draftSha256: HASH_ABC, pass: true, reason: "" }] },
      error: `${PATH}: checks[0].videoId must be a non-empty string`,
    },
    {
      problem: "a malformed hash",
      json: {
        checks: [{ videoId: "v", draftSha256: "abc", pass: true, reason: "" }],
      },
      error: `${PATH}: checks[0].draftSha256 must be a 64-character hex sha256`,
    },
    {
      problem: "pass as a string",
      json: {
        checks: [
          { videoId: "v", draftSha256: HASH_ABC, pass: "true", reason: "" },
        ],
      },
      error: `${PATH}: checks[0].pass must be true or false`,
    },
    {
      problem: "a missing reason",
      json: { checks: [{ videoId: "v", draftSha256: HASH_ABC, pass: false }] },
      error: `${PATH}: checks[0].reason must be a string`,
    },
  ])(
    "rejects $problem, naming the file, index and field",
    ({ json, error }) => {
      expect(() => parseChecks(json, PATH)).toThrow(error);
    },
  );
});

describe("recordVerdict", () => {
  const verdict = (videoId: string, draftSha256: string, pass: boolean) => ({
    videoId,
    draftSha256,
    pass,
    reason: pass ? "ok" : "fails rule 5",
  });

  test("appends a verdict for a new draft", () => {
    const first = verdict("v1", "a".repeat(64), false);
    const second = verdict("v1", "b".repeat(64), true);

    expect(recordVerdict([first], second)).toEqual([first, second]);
  });

  test("replaces the earlier verdict for the same video and the same draft text", () => {
    const other = verdict("v2", "a".repeat(64), true);
    const before = verdict("v1", "a".repeat(64), false);
    const after = verdict("v1", "a".repeat(64), true);

    expect(recordVerdict([before, other], after)).toEqual([other, after]);
  });
});
