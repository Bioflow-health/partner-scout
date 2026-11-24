import type { Candidate } from "./types";

export type Scored = Candidate & { momentum: number };

export const momentum = (
  _views: number,
  _subscribers: number | null,
): number | null => {
  throw new Error("not implemented");
};

export const rankByMomentum = (_candidates: readonly Candidate[]): Scored[] => {
  throw new Error("not implemented");
};
