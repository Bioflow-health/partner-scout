import { describe, expect, test } from "vitest";
import type { ChannelId, VideoId } from "./types";
import { toCandidates } from "./youtube";
import type { RawRun } from "./youtube";

type VideoItem = RawRun["videos"][number]["items"][number];
type ChannelItem = RawRun["channels"][number]["items"][number];

const video = (
  id: string,
  channelId: string,
  statistics: VideoItem["statistics"],
): VideoItem => ({
  id,
  snippet: {
    title: `Title of ${id}`,
    description: `Description of ${id}`,
    channelId,
    channelTitle: `Name of ${channelId}`,
    publishedAt: "2026-11-20T10:00:00Z",
  },
  statistics,
});

const channel = (
  id: string,
  statistics: ChannelItem["statistics"],
): ChannelItem => ({ id, statistics });

const makeRun = (
  searches: Record<string, string[]>,
  videos: VideoItem[],
  channels: ChannelItem[],
): RawRun => ({
  fetchedAt: "2026-11-24T21:14:19.606Z",
  publishedAfter: "2026-10-25T21:14:19.606Z",
  unitsUsed: 0,
  searches: Object.entries(searches).map(([term, videoIds]) => ({
    term,
    response: { items: videoIds.map((videoId) => ({ id: { videoId } })) },
  })),
  videos: [{ items: videos }],
  channels: [{ items: channels }],
});

const visible = (subscriberCount: string) => ({
  subscriberCount,
  hiddenSubscriberCount: false,
});

describe("toCandidates", () => {
  test("builds a candidate from the video's details and its channel's subscriber count", () => {
    const run = makeRun(
      { "claude code tutorial": ["v1"] },
      [video("v1", "c1", { viewCount: "12345" })],
      [channel("c1", visible("4200"))],
    );

    expect(toCandidates(run)).toEqual([
      {
        videoId: "v1" as VideoId,
        videoTitle: "Title of v1",
        description: "Description of v1",
        views: 12_345,
        channelId: "c1" as ChannelId,
        channelTitle: "Name of c1",
        subscribers: 4_200,
        searchTerm: "claude code tutorial",
      },
    ]);
  });

  test("gives a channel with a hidden subscriber count null subscribers", () => {
    const run = makeRun(
      { blotato: ["v1"] },
      [video("v1", "c1", { viewCount: "900" })],
      [channel("c1", { hiddenSubscriberCount: true })],
    );

    expect(toCandidates(run).map((c) => c.subscribers)).toEqual([null]);
  });

  test("counts a video with no public view count as 0 views", () => {
    const run = makeRun(
      { blotato: ["v1"] },
      [video("v1", "c1", {})],
      [channel("c1", visible("4200"))],
    );

    expect(toCandidates(run).map((c) => c.views)).toEqual([0]);
  });

  test("skips search hits whose video or channel details are missing", () => {
    const run = makeRun(
      { blotato: ["v1", "no-video", "v3"] },
      [
        video("v1", "c1", { viewCount: "900" }),
        video("v3", "no-channel", { viewCount: "900" }),
      ],
      [channel("c1", visible("4200"))],
    );

    expect(toCandidates(run).map((c) => c.videoId)).toEqual(["v1"]);
  });

  test("keeps one candidate per search term when two terms find the same video", () => {
    const run = makeRun(
      { "social media automation": ["v1"], blotato: ["v1"] },
      [video("v1", "c1", { viewCount: "900" })],
      [channel("c1", visible("4200"))],
    );

    expect(toCandidates(run).map((c) => [c.videoId, c.searchTerm])).toEqual([
      ["v1", "social media automation"],
      ["v1", "blotato"],
    ]);
  });
});
