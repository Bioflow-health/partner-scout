type Brand<T, B extends string> = T & { readonly __brand: B };

export type ChannelId = Brand<string, "ChannelId">;
export type VideoId = Brand<string, "VideoId">;

export type Candidate = {
  videoId: VideoId;
  videoTitle: string;
  description: string;
  views: number;
  channelId: ChannelId;
  channelTitle: string;
  subscribers: number | null;
  searchTerm: string;
};
