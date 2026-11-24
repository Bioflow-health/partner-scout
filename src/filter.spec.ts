import { describe, expect, test } from "vitest";
import { makeCandidate } from "./fixtures";
import { filterCandidates, NO_SIZE_LIMIT } from "./filter";
import type { FilterOptions } from "./filter";

const noLimits: FilterOptions = {
  partners: new Set(),
  band: NO_SIZE_LIMIT,
  topics: new Map(),
};

describe("filterCandidates", () => {
  test("keeps an on-topic candidate that breaks no rule", () => {
    const candidate = makeCandidate("a");

    expect(filterCandidates([candidate], noLimits)).toEqual({
      kept: [candidate],
      dropped: [],
    });
  });

  test("drops a channel that is already a partner", () => {
    const partner = makeCandidate("a");
    const newcomer = makeCandidate("b");
    const options = { ...noLimits, partners: new Set([partner.channelId]) };

    expect(filterCandidates([partner, newcomer], options)).toEqual({
      kept: [newcomer],
      dropped: [{ candidate: partner, reason: "existing-partner" }],
    });
  });

  test.each([
    { label: "hidden", subscribers: null },
    { label: "zero", subscribers: 0 },
  ])("drops a channel whose subscriber count is $label", ({ subscribers }) => {
    const candidate = makeCandidate("a", { subscribers });

    expect(filterCandidates([candidate], noLimits)).toEqual({
      kept: [],
      dropped: [{ candidate, reason: "no-subscriber-count" }],
    });
  });

  test("keeps channels of any size when the band has no limits", () => {
    const tiny = makeCandidate("a", { subscribers: 1 });
    const huge = makeCandidate("b", { subscribers: 50_000_000 });

    expect(filterCandidates([tiny, huge], noLimits)).toEqual({
      kept: [tiny, huge],
      dropped: [],
    });
  });

  test("drops channels outside a set band and keeps those on its edges", () => {
    const band = { min: 1_000, max: 100_000 };
    const below = makeCandidate("a", { subscribers: band.min - 1 });
    const atMin = makeCandidate("b", { subscribers: band.min });
    const atMax = makeCandidate("c", { subscribers: band.max });
    const above = makeCandidate("d", { subscribers: band.max + 1 });

    expect(
      filterCandidates([below, atMin, atMax, above], { ...noLimits, band }),
    ).toEqual({
      kept: [atMin, atMax],
      dropped: [
        { candidate: below, reason: "outside-size-band" },
        { candidate: above, reason: "outside-size-band" },
      ],
    });
  });

  test.each([
    {
      where: "in the title",
      videoTitle: "Claude Code in 10 minutes",
      description: "",
    },
    {
      where: "in the description, in another case",
      videoTitle: "My posting setup",
      description: "Everything I schedule runs through CLAUDE CODE.",
    },
  ])(
    "keeps a video with the whole search phrase $where",
    ({ videoTitle, description }) => {
      const candidate = makeCandidate("a", { videoTitle, description });

      expect(filterCandidates([candidate], noLimits)).toEqual({
        kept: [candidate],
        dropped: [],
      });
    },
  );

  test.each([
    {
      problem: "has the words in the wrong order",
      videoTitle: "Code with Claude",
    },
    {
      problem: "has only part of the phrase",
      videoTitle: "Claude for writers",
    },
    {
      problem: "has the phrase inside a longer word",
      videoTitle: "Claude Coder diaries",
    },
  ])("drops a video that $problem as off-topic", ({ videoTitle }) => {
    const candidate = makeCandidate("a", { videoTitle, description: "" });

    expect(filterCandidates([candidate], noLimits)).toEqual({
      kept: [],
      dropped: [{ candidate, reason: "off-topic" }],
    });
  });

  test("keeps a video that names the search term's topic keyword but not the whole phrase", () => {
    const candidate = makeCandidate("a", {
      searchTerm: "claude code tutorial",
      videoTitle: "Claude Code: Build Your First AI Agent in 20 Minutes",
      description: "",
    });
    const options = {
      ...noLimits,
      topics: new Map([["claude code tutorial", "claude code"]]),
    };

    expect(filterCandidates([candidate], options)).toEqual({
      kept: [candidate],
      dropped: [],
    });
  });

  test("drops a video that has the rest of the search phrase but not its topic keyword", () => {
    const candidate = makeCandidate("a", {
      searchTerm: "mcp server tutorial",
      videoTitle: "Home server tutorial for beginners",
      description: "",
    });
    const options = {
      ...noLimits,
      topics: new Map([["mcp server tutorial", "mcp"]]),
    };

    expect(filterCandidates([candidate], options)).toEqual({
      kept: [],
      dropped: [{ candidate, reason: "off-topic" }],
    });
  });

  test("falls back to the whole search phrase when the term has no topic keyword", () => {
    const candidate = makeCandidate("a", {
      searchTerm: "claude code tutorial",
      videoTitle: "Claude Code: Build Your First AI Agent in 20 Minutes",
      description: "",
    });

    expect(filterCandidates([candidate], noLimits)).toEqual({
      kept: [],
      dropped: [{ candidate, reason: "off-topic" }],
    });
  });

  test("keeps only the most-viewed video from each channel", () => {
    const lower = makeCandidate("a", { views: 2_000 });
    const higher = makeCandidate("b", {
      channelId: lower.channelId,
      views: 8_000,
    });
    const otherChannel = makeCandidate("c");

    expect(filterCandidates([lower, higher, otherChannel], noLimits)).toEqual({
      kept: [higher, otherChannel],
      dropped: [{ candidate: lower, reason: "duplicate" }],
    });
  });

  test("keeps the first copy of a video found by two search terms", () => {
    const first = makeCandidate("a", { searchTerm: "claude code" });
    const again = { ...first, searchTerm: "claude code tutorial" };

    expect(filterCandidates([first, again], noLimits)).toEqual({
      kept: [first],
      dropped: [{ candidate: again, reason: "duplicate" }],
    });
  });

  test("chooses a channel's video to keep only from its eligible videos", () => {
    const offTopicHit = makeCandidate("a", {
      videoTitle: "Weekend vlog",
      description: "",
      views: 90_000,
    });
    const onTopic = makeCandidate("b", {
      channelId: offTopicHit.channelId,
      views: 3_000,
    });

    expect(filterCandidates([offTopicHit, onTopic], noLimits)).toEqual({
      kept: [onTopic],
      dropped: [{ candidate: offTopicHit, reason: "off-topic" }],
    });
  });

  test("reports an existing partner as existing-partner even when it breaks other rules too", () => {
    const candidate = makeCandidate("a", {
      subscribers: null,
      videoTitle: "Weekend vlog",
      description: "",
    });
    const options = { ...noLimits, partners: new Set([candidate.channelId]) };

    expect(filterCandidates([candidate], options)).toEqual({
      kept: [],
      dropped: [{ candidate, reason: "existing-partner" }],
    });
  });
});
