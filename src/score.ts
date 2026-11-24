import type { Candidate } from "./types";

export type Scored = Candidate & { momentum: number };

export const momentum = (
  views: number,
  subscribers: number | null,
): number | null => (subscribers ? views / subscribers : null);

export const rankByMomentum = (candidates: readonly Candidate[]): Scored[] =>
  candidates
    .flatMap((candidate) => {
      const score = momentum(candidate.views, candidate.subscribers);
      return score === null ? [] : [{ ...candidate, momentum: score }];
    })
    .sort((a, b) => b.momentum - a.momentum || b.views - a.views);
