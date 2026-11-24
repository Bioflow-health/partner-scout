import { describe, expect, test } from "vitest";
import { makeCandidate } from "./fixtures";
import { momentum, rankByMomentum } from "./score";

describe("momentum", () => {
  test.each([
    {
      label: "5 for 5,000 views on 1,000 subscribers",
      views: 5_000,
      subscribers: 1_000,
      expected: 5,
    },
    {
      label: "0.5 for 1,500 views on 3,000 subscribers",
      views: 1_500,
      subscribers: 3_000,
      expected: 0.5,
    },
    {
      label: "0 for a video with no views",
      views: 0,
      subscribers: 1_000,
      expected: 0,
    },
  ])(
    "returns views divided by subscribers: $label",
    ({ views, subscribers, expected }) => {
      expect(momentum(views, subscribers)).toBe(expected);
    },
  );

  test.each([
    { label: "hidden", subscribers: null },
    { label: "zero", subscribers: 0 },
  ])("returns null when the subscriber count is $label", ({ subscribers }) => {
    expect(momentum(5_000, subscribers)).toBeNull();
  });
});

describe("rankByMomentum", () => {
  test("orders candidates by momentum, highest first, with the score attached", () => {
    const steady = makeCandidate("a", { views: 2_000, subscribers: 1_000 });
    const breakout = makeCandidate("b", { views: 9_000, subscribers: 1_000 });
    const quiet = makeCandidate("c", { views: 500, subscribers: 1_000 });

    expect(rankByMomentum([steady, breakout, quiet])).toEqual([
      { ...breakout, momentum: 9 },
      { ...steady, momentum: 2 },
      { ...quiet, momentum: 0.5 },
    ]);
  });

  test("puts the video with more views first when momentum ties", () => {
    const small = makeCandidate("a", { views: 1_000, subscribers: 500 });
    const large = makeCandidate("b", { views: 4_000, subscribers: 2_000 });

    expect(rankByMomentum([small, large])).toEqual([
      { ...large, momentum: 2 },
      { ...small, momentum: 2 },
    ]);
  });

  test("leaves out candidates whose momentum cannot be computed", () => {
    const hidden = makeCandidate("a", { subscribers: null });
    const scored = makeCandidate("b", { views: 3_000, subscribers: 1_000 });

    expect(rankByMomentum([hidden, scored])).toEqual([
      { ...scored, momentum: 3 },
    ]);
  });
});
