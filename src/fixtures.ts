import type { Candidate, ChannelId, VideoId } from "./types";

export const makeCandidate = (
  id: string,
  overrides: Partial<Candidate> = {},
): Candidate => ({
  videoId: `video-${id}` as VideoId,
  videoTitle: "Claude Code tutorial for beginners",
  description: "A step-by-step build of a posting workflow.",
  views: 5_000,
  channelId: `channel-${id}` as ChannelId,
  channelTitle: `Channel ${id}`,
  subscribers: 1_000,
  searchTerm: "claude code",
  ...overrides,
});
