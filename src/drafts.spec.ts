import { describe, expect, test } from "vitest";
import { parseDrafts } from "./drafts";

const PATH = "out/drafts-r.json";
const CANDIDATES = new Set(["v1", "v2", "v3"]);

const fitEntry = (videoId: string, drafts: string[]) => ({
  videoId,
  fit: true,
  reason: "teaches a clipping workflow",
  attempts: drafts.map((draft) => ({ draft })),
});

describe("parseDrafts", () => {
  test("reads a valid drafts file", () => {
    const json = {
      entries: [
        fitEntry("v1", ["first", "second"]),
        {
          videoId: "v2",
          fit: false,
          reason: "skip: vendor channel",
          attempts: [],
        },
        fitEntry("v3", []),
      ],
    };

    expect(parseDrafts(json, PATH, CANDIDATES)).toEqual(json.entries);
  });

  test.each([
    {
      problem: "a top-level array",
      json: [],
      error: `${PATH}: expected an object with an "entries" array`,
    },
    {
      problem: "no entries",
      json: {},
      error: `${PATH}: expected an object with an "entries" array`,
    },
    {
      problem: "a non-object entry",
      json: { entries: ["v1"] },
      error: `${PATH}: entries[0] must be an object`,
    },
    {
      problem: "a missing videoId",
      json: { entries: [{ fit: true, reason: "", attempts: [] }] },
      error: `${PATH}: entries[0].videoId must be a non-empty string`,
    },
    {
      problem: "a video that is not a candidate in this run",
      json: { entries: [fitEntry("v9", [])] },
      error: `${PATH}: entries[0].videoId "v9" is not a candidate in this run`,
    },
    {
      problem: "the same video twice",
      json: { entries: [fitEntry("v1", []), fitEntry("v1", ["x"])] },
      error: `${PATH}: entries[1].videoId "v1" is listed twice`,
    },
    {
      problem: "fit as a string",
      json: { entries: [{ ...fitEntry("v1", []), fit: "false" }] },
      error: `${PATH}: entries[0].fit must be true or false`,
    },
    {
      problem: "a missing reason",
      json: { entries: [{ videoId: "v1", fit: true, attempts: [] }] },
      error: `${PATH}: entries[0].reason must be a string`,
    },
    {
      problem: "missing attempts",
      json: { entries: [{ videoId: "v1", fit: true, reason: "" }] },
      error: `${PATH}: entries[0].attempts must be an array`,
    },
    {
      problem: "three attempts",
      json: { entries: [fitEntry("v1", ["a", "b", "c"])] },
      error: `${PATH}: entries[0].attempts has 3 attempts; at most 2 are allowed (one draft and one revision)`,
    },
    {
      problem: "a skip with a draft",
      json: { entries: [{ ...fitEntry("v1", ["a"]), fit: false }] },
      error: `${PATH}: entries[0].attempts must be empty for a skip`,
    },
    {
      problem: "an attempt without draft text",
      json: { entries: [{ ...fitEntry("v1", []), attempts: [{ text: "a" }] }] },
      error: `${PATH}: entries[0].attempts[0].draft must be a string`,
    },
  ])(
    "rejects $problem, naming the file, index and field",
    ({ json, error }) => {
      expect(() => parseDrafts(json, PATH, CANDIDATES)).toThrow(error);
    },
  );
});
