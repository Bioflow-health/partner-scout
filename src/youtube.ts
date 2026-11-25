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
  complete?: boolean;
  searches: { term: string; response: SearchResponse }[];
  videos: VideosResponse[];
  channels: ChannelsResponse[];
};

export type FetchOptions = {
  fetchImpl?: typeof fetch;
  onProgress?: (run: RawRun) => Promise<void> | void;
};

const TIMEOUT_MS = 15_000;

const isRetryable = (status: number, body: string) =>
  (status === 429 || status >= 500) && !body.includes("quotaExceeded");

const get = async <T>(
  fetchImpl: typeof fetch,
  endpoint: string,
  params: Record<string, string>,
  apiKey: string,
): Promise<T> => {
  const url = `${API_BASE}/${endpoint}?${new URLSearchParams(params)}`;
  for (let attempt = 1; ; attempt += 1) {
    const response = await fetchImpl(url, {
      headers: { "x-goog-api-key": apiKey },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (response.ok) return (await response.json()) as T;
    const body = await response.text();
    if (attempt === 1 && isRetryable(response.status, body)) continue;
    throw new Error(
      `YouTube ${endpoint} failed: HTTP ${response.status} ${body.slice(0, 300)}`,
    );
  }
};

const inPages = <T>(items: readonly T[]): T[][] =>
  Array.from({ length: Math.ceil(items.length / PAGE_SIZE) }, (_, page) =>
    items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
  );

export const fetchRun = async (
  terms: readonly string[],
  apiKey: string,
  now: Date,
  { fetchImpl = fetch, onProgress = () => {} }: FetchOptions = {},
): Promise<RawRun> => {
  const publishedAfter = new Date(
    now.getTime() - WINDOW_DAYS * DAY_MS,
  ).toISOString();
  const run: RawRun = {
    fetchedAt: now.toISOString(),
    publishedAfter,
    unitsUsed: 0,
    complete: false,
    searches: [],
    videos: [],
    channels: [],
  };

  for (const term of terms) {
    const response = await get<SearchResponse>(
      fetchImpl,
      "search",
      {
        part: "snippet",
        type: "video",
        q: term,
        publishedAfter,
        maxResults: String(PAGE_SIZE),
      },
      apiKey,
    );
    run.searches.push({ term, response });
    run.unitsUsed += UNITS.search;
    await onProgress(run);
  }

  const videoIds = [
    ...new Set(
      run.searches.flatMap(({ response }) =>
        response.items.map((item) => item.id.videoId),
      ),
    ),
  ];
  for (const ids of inPages(videoIds)) {
    run.videos.push(
      await get<VideosResponse>(
        fetchImpl,
        "videos",
        { part: "snippet,statistics", id: ids.join(",") },
        apiKey,
      ),
    );
    run.unitsUsed += UNITS.list;
    await onProgress(run);
  }

  const channelIds = [
    ...new Set(
      run.videos.flatMap((page) =>
        page.items.map((video) => video.snippet.channelId),
      ),
    ),
  ];
  for (const ids of inPages(channelIds)) {
    run.channels.push(
      await get<ChannelsResponse>(
        fetchImpl,
        "channels",
        { part: "statistics", id: ids.join(",") },
        apiKey,
      ),
    );
    run.unitsUsed += UNITS.list;
    await onProgress(run);
  }

  run.complete = true;
  await onProgress(run);
  return run;
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
