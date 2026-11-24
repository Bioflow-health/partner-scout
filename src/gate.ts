export type GateRule =
  | "em-dash"
  | "too-long"
  | "banned-word"
  | "missing-video-title"
  | "call-to-action"
  | "ai-tell";

export type GateFailure = { rule: GateRule; detail: string };

export type GateResult = { pass: boolean; failures: GateFailure[] };

export type GateConfig = {
  bannedWords: readonly string[];
  aiTells: readonly RegExp[];
};

export type Draft = { text: string; videoTitle: string };

export const checkDraft = (_draft: Draft, _config: GateConfig): GateResult => {
  throw new Error("not implemented");
};
