import { describe, expect, test } from "vitest";
import type { ChannelId, VideoId } from "./types";
import { fetchRun, toCandidates } from "./youtube";
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

  test("joins videos and channels spread over several pages, as in a real run", () => {
    const run: RawRun = {
      ...makeRun({ blotato: ["v1", "v2"] }, [], []),
      videos: [
        { items: [video("v1", "c1", { viewCount: "100" })] },
        { items: [video("v2", "c2", { viewCount: "200" })] },
      ],
      channels: [
        { items: [channel("c2", visible("2000"))] },
        { items: [channel("c1", visible("1000"))] },
      ],
    };

    expect(toCandidates(run)).toEqual([
      {
        videoId: "v1" as VideoId,
        videoTitle: "Title of v1",
        description: "Description of v1",
        views: 100,
        channelId: "c1" as ChannelId,
        channelTitle: "Name of c1",
        subscribers: 1_000,
        searchTerm: "blotato",
      },
      {
        videoId: "v2" as VideoId,
        videoTitle: "Title of v2",
        description: "Description of v2",
        views: 200,
        channelId: "c2" as ChannelId,
        channelTitle: "Name of c2",
        subscribers: 2_000,
        searchTerm: "blotato",
      },
    ]);
  });
});

const NOW = new Date("2026-11-24T12:00:00Z");

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

const channelOf = (videoId: string) => `c${Number(videoId.slice(1)) % 3}`;

const youtubeApi = (searchResults: Record<string, string[]>) => (url: URL) => {
  const endpoint = url.pathname.split("/").at(-1);
  if (endpoint === "search") {
    const ids = searchResults[url.searchParams.get("q") ?? ""] ?? [];
    return jsonResponse({ items: ids.map((videoId) => ({ id: { videoId } })) });
  }
  const ids = (url.searchParams.get("id") ?? "").split(",");
  if (endpoint === "videos") {
    return jsonResponse({
      items: ids.map((id) => ({
        id,
        snippet: {
          title: `Title of ${id}`,
          description: "",
          channelId: channelOf(id),
          channelTitle: `Name of ${channelOf(id)}`,
          publishedAt: "2026-11-20T10:00:00Z",
        },
        statistics: { viewCount: "100" },
      })),
    });
  }
  return jsonResponse({
    items: ids.map((id) => ({
      id,
      statistics: { subscriberCount: "1000", hiddenSubscriberCount: false },
    })),
  });
};

const recordingFetch = (
  respond: (url: URL, callNumber: number) => Response,
) => {
  const calls: { url: URL; init: RequestInit | undefined }[] = [];
  const fetchImpl = (async (
    input: string | URL | Request,
    init?: RequestInit,
  ) => {
    const url = new URL(String(input));
    calls.push({ url, init });
    return respond(url, calls.length);
  }) as typeof fetch;
  return { fetchImpl, calls };
};

const TWO_TERMS = { a: ["v1", "v2"], b: ["v2", "v3"] };

describe("fetchRun", () => {
  test("saves the run after every response and marks it complete at the end", async () => {
    const { fetchImpl } = recordingFetch(youtubeApi(TWO_TERMS));
    const saved: [number, number, number, boolean | undefined][] = [];

    const run = await fetchRun(["a", "b"], "test-key", NOW, {
      fetchImpl,
      onProgress: (snapshot) => {
        saved.push([
          snapshot.searches.length,
          snapshot.videos.length,
          snapshot.channels.length,
          snapshot.complete,
        ]);
      },
    });

    expect(saved).toEqual([
      [1, 0, 0, false],
      [2, 0, 0, false],
      [2, 1, 0, false],
      [2, 1, 1, false],
      [2, 1, 1, true],
    ]);
    expect([
      run.fetchedAt,
      run.publishedAfter,
      run.unitsUsed,
      run.complete,
    ]).toEqual([
      "2026-11-24T12:00:00.000Z",
      "2026-10-25T12:00:00.000Z",
      202,
      true,
    ]);
  });

  test("requests each unique video and channel once, in pages of at most 50", async () => {
    const ids = (from: number, to: number) =>
      Array.from({ length: to - from }, (_, i) => `v${from + i}`);
    const { fetchImpl, calls } = recordingFetch(
      youtubeApi({ a: ids(0, 40), b: ids(30, 60) }),
    );

    await fetchRun(["a", "b"], "test-key", NOW, { fetchImpl });

    expect(
      calls
        .filter(({ url }) => !url.pathname.endsWith("/search"))
        .map(({ url }) => [
          url.pathname.split("/").at(-1),
          (url.searchParams.get("id") ?? "").split(",").length,
        ]),
    ).toEqual([
      ["videos", 50],
      ["videos", 10],
      ["channels", 3],
    ]);
  });

  test("sends the key only in the x-goog-api-key header, with a timeout on every request", async () => {
    const { fetchImpl, calls } = recordingFetch(youtubeApi(TWO_TERMS));

    await fetchRun(["a", "b"], "test-key", NOW, { fetchImpl });

    expect(
      calls.map(({ url, init }) => [
        new Headers(init?.headers).get("x-goog-api-key"),
        url.search.includes("test-key"),
        init?.signal instanceof AbortSignal,
      ]),
    ).toEqual(calls.map(() => ["test-key", false, true]));
  });

  test.each([429, 503])(
    "retries a request once after HTTP %i, then carries on",
    async (status) => {
      const api = youtubeApi(TWO_TERMS);
      const { fetchImpl, calls } = recordingFetch((url, callNumber) =>
        callNumber === 1 ? jsonResponse({ error: {} }, status) : api(url),
      );

      const run = await fetchRun(["a", "b"], "test-key", NOW, { fetchImpl });

      expect([calls.length, run.complete, run.searches.length]).toEqual([
        5,
        true,
        2,
      ]);
    },
  );

  test("never retries quotaExceeded and reports it", async () => {
    const { fetchImpl, calls } = recordingFetch(() =>
      jsonResponse({ error: { errors: [{ reason: "quotaExceeded" }] } }, 403),
    );

    await expect(
      fetchRun(["a"], "test-key", NOW, { fetchImpl }),
    ).rejects.toThrow("YouTube search failed: HTTP 403");
    expect(calls.length).toBe(1);
  });

  test("gives up after one retry", async () => {
    const { fetchImpl, calls } = recordingFetch(() =>
      jsonResponse({ error: {} }, 500),
    );

    await expect(
      fetchRun(["a"], "test-key", NOW, { fetchImpl }),
    ).rejects.toThrow("YouTube search failed: HTTP 500");
    expect(calls.length).toBe(2);
  });

  test("keeps the paid searches in the last saved snapshot when a later request fails", async () => {
    const api = youtubeApi(TWO_TERMS);
    const { fetchImpl } = recordingFetch((url) =>
      url.pathname.endsWith("/videos")
        ? jsonResponse({ error: {} }, 400)
        : api(url),
    );
    let lastSaved: RawRun | undefined;

    await expect(
      fetchRun(["a", "b"], "test-key", NOW, {
        fetchImpl,
        onProgress: (snapshot) => {
          lastSaved = JSON.parse(JSON.stringify(snapshot)) as RawRun;
        },
      }),
    ).rejects.toThrow("YouTube videos failed: HTTP 400");
    expect([
      lastSaved?.searches.map((s) => s.term),
      lastSaved?.videos.length,
      lastSaved?.unitsUsed,
      lastSaved?.complete,
    ]).toEqual([["a", "b"], 0, 200, false]);
  });
});
