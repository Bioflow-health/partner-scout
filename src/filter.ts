import type { Candidate, ChannelId } from "./types";

export type SizeBand = { min: number; max: number };

export const NO_SIZE_LIMIT: SizeBand = {
  min: 0,
  max: Number.POSITIVE_INFINITY,
};

export type DropReason =
  | "existing-partner"
  | "no-subscriber-count"
  | "outside-size-band"
  | "off-topic"
  | "duplicate";

export type Dropped = { candidate: Candidate; reason: DropReason };

export type FilterResult = { kept: Candidate[]; dropped: Dropped[] };

export type FilterOptions = {
  partners: ReadonlySet<ChannelId>;
  band: SizeBand;
};

export const filterCandidates = (
  _candidates: readonly Candidate[],
  _options: FilterOptions,
): FilterResult => {
  throw new Error("not implemented");
};
