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

const escapeRegExp = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const mentionsSearchPhrase = (candidate: Candidate) => {
  const words = candidate.searchTerm.trim().split(/\s+/).map(escapeRegExp);
  const phrase = new RegExp(`\\b${words.join("\\s+")}\\b`, "i");
  return (
    phrase.test(candidate.videoTitle) || phrase.test(candidate.description)
  );
};

const firstBrokenRule = (
  candidate: Candidate,
  { partners, band }: FilterOptions,
): DropReason | null => {
  if (partners.has(candidate.channelId)) return "existing-partner";
  if (!candidate.subscribers) return "no-subscriber-count";
  if (candidate.subscribers < band.min || candidate.subscribers > band.max)
    return "outside-size-band";
  if (!mentionsSearchPhrase(candidate)) return "off-topic";
  return null;
};

export const filterCandidates = (
  candidates: readonly Candidate[],
  options: FilterOptions,
): FilterResult => {
  const checked = candidates.map((candidate) => ({
    candidate,
    reason: firstBrokenRule(candidate, options),
  }));

  const bestIndexByChannel = new Map<ChannelId, number>();
  checked.forEach(({ candidate, reason }, index) => {
    if (reason !== null) return;
    const bestIndex = bestIndexByChannel.get(candidate.channelId);
    const best = bestIndex === undefined ? undefined : candidates[bestIndex];
    if (!best || candidate.views > best.views)
      bestIndexByChannel.set(candidate.channelId, index);
  });

  const kept: Candidate[] = [];
  const dropped: Dropped[] = [];
  checked.forEach(({ candidate, reason }, index) => {
    const finalReason =
      reason ??
      (bestIndexByChannel.get(candidate.channelId) === index
        ? null
        : "duplicate");
    if (finalReason === null) kept.push(candidate);
    else dropped.push({ candidate, reason: finalReason });
  });

  return { kept, dropped };
};
