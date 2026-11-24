import type { Candidate, ChannelId, VideoId } from "./types";

const API_BASE = "https://www.googleapis.com/youtube/v3";
const WINDOW_DAYS = 30;
const DAY_MS = 86_400_000;
const PAGE_SIZE = 50;
const UNITS = { search: 100, list: 1 } as const;

type SearchResponse = {
  items: { id: { videoId: string } }[];
};

type VideosResponse = {
  items: {
    id: string;
    snippet: {
      title: string;
      description: string;
      channelId: string;
      channelTitle: string;
      publishedAt: string;
    };
    statistics: { viewCount?: string };
  }[];
};

type ChannelsResponse = {
  items: {
    id: string;
    statistics: { subscriberCount?: string; hiddenSubscriberCount: boolean };
  }[];
};

export type RawRun = {
  fetchedAt: string;
  publishedAfter: string;
  unitsUsed: number;
  searches: { term: string; response: SearchResponse }[];
  videos: VideosResponse[];
  channels: ChannelsResponse[];
};

const get = async <T>(
  endpoint: string,
  params: Record<string, string>,
  apiKey: string,
): Promise<T> => {
  const response = await fetch(
    `${API_BASE}/${endpoint}?${new URLSearchParams(params)}`,
    { headers: { "x-goog-api-key": apiKey } },
  );
  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `YouTube ${endpoint} failed: HTTP ${response.status} ${body.slice(0, 300)}`,
    );
  }
  return (await response.json()) as T;
};

const inPages = <T>(items: readonly T[]): T[][] =>
  Array.from({ length: Math.ceil(items.length / PAGE_SIZE) }, (_, page) =>
    items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
  );

export const fetchRun = async (
  terms: readonly string[],
  apiKey: string,
  now: Date,
): Promise<RawRun> => {
  const publishedAfter = new Date(
    now.getTime() - WINDOW_DAYS * DAY_MS,
  ).toISOString();

  const searches = await Promise.all(
    terms.map(async (term) => ({
      term,
      response: await get<SearchResponse>(
        "search",
        {
          part: "snippet",
          type: "video",
          q: term,
          publishedAfter,
          maxResults: String(PAGE_SIZE),
        },
        apiKey,
      ),
    })),
  );

  const videoIds = [
    ...new Set(
      searches.flatMap(({ response }) =>
        response.items.map((item) => item.id.videoId),
      ),
    ),
  ];
  const videos = await Promise.all(
    inPages(videoIds).map((ids) =>
      get<VideosResponse>(
        "videos",
        { part: "snippet,statistics", id: ids.join(",") },
        apiKey,
      ),
    ),
  );

  const channelIds = [
    ...new Set(
      videos.flatMap((page) => page.items.map((v) => v.snippet.channelId)),
    ),
  ];
  const channels = await Promise.all(
    inPages(channelIds).map((ids) =>
      get<ChannelsResponse>(
        "channels",
        { part: "statistics", id: ids.join(",") },
        apiKey,
      ),
    ),
  );

  return {
    fetchedAt: now.toISOString(),
    publishedAfter,
    unitsUsed:
      searches.length * UNITS.search +
      (videos.length + channels.length) * UNITS.list,
    searches,
    videos,
    channels,
  };
};

export const toCandidates = (run: RawRun): Candidate[] => {
  const videos = new Map(
    run.videos.flatMap((page) => page.items).map((v) => [v.id, v]),
  );
  const channels = new Map(
    run.channels.flatMap((page) => page.items).map((c) => [c.id, c]),
  );

  return run.searches.flatMap(({ term, response }) =>
    response.items.flatMap((hit) => {
      const video = videos.get(hit.id.videoId);
      const channel = video && channels.get(video.snippet.channelId);
      if (!video || !channel) return [];
      return [
        {
          videoId: video.id as VideoId,
          videoTitle: video.snippet.title,
          description: video.snippet.description,
          views: Number(video.statistics.viewCount ?? 0),
          channelId: channel.id as ChannelId,
          channelTitle: video.snippet.channelTitle,
          subscribers: channel.statistics.hiddenSubscriberCount
            ? null
            : Number(channel.statistics.subscriberCount ?? 0),
          searchTerm: term,
        },
      ];
    }),
  );
};
