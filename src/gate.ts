import { escapeRegExp, phrasePattern } from "./text";

export type GateRule =
  | "em-dash"
  | "too-long"
  | "banned-word"
  | "number"
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

const MAX_WORDS = 90;
const EM_DASH = "—";

const EMOJI = /[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu;

const occurrences = (text: string, mark: string) => text.split(mark).length - 1;

const NUMBER = /[$€£]?(?<![\p{L}\p{N}_])\d[\d.,]*(?![\p{L}\p{N}_])%?/gu;
const ASK = /partner program/i;

const questionSentence = (body: string) =>
  body.split(/(?<=[.!?])\s+/).find((sentence) => sentence.includes("?")) ?? "";

const CORE_MIN_WORDS = 2;
const CORE_MIN_CHARACTERS = 12;

const coreTitle = (title: string) =>
  (title.split(" | ")[0] ?? title)
    .replace(EMOJI, "")
    .replace(/\s+/g, " ")
    .trim();

const usableCore = (fullTitle: string) => {
  const core = coreTitle(fullTitle);
  return core !== fullTitle &&
    core.split(" ").length >= CORE_MIN_WORDS &&
    [...core].length >= CORE_MIN_CHARACTERS
    ? core
    : undefined;
};

const quotedTitle = (title: string, flags: string) =>
  new RegExp(`["“]\\s*${escapeRegExp(title)}[.,]?\\s*["”]`, flags);

export const checkDraft = (
  { text, videoTitle }: Draft,
  { bannedWords, aiTells }: GateConfig,
): GateResult => {
  const fullTitle = videoTitle.trim();
  const core = usableCore(fullTitle);
  const titles = [fullTitle, core].filter(
    (t): t is string => t !== undefined && t !== "",
  );
  const namesVideo = titles.some((t) => quotedTitle(t, "i").test(text));
  const body = titles.reduce(
    (remaining, t) => remaining.replace(quotedTitle(t, "gi"), " "),
    text,
  );
  const words = text.split(/\s+/).filter(Boolean).length;
  const emDashes = occurrences(body, EM_DASH);
  const questions = occurrences(body, "?");

  const failures: GateFailure[] = [];
  if (emDashes > 0) {
    failures.push({ rule: "em-dash", detail: `em dashes: ${emDashes}` });
  }
  if (words > MAX_WORDS) {
    failures.push({
      rule: "too-long",
      detail: `words: ${words}, max ${MAX_WORDS}`,
    });
  }
  for (const word of bannedWords) {
    if (phrasePattern(word).test(body)) {
      failures.push({ rule: "banned-word", detail: `"${word}"` });
    }
  }
  const numbers = (body.match(NUMBER) ?? []).map((n) =>
    n.replace(/[.,]+$/, ""),
  );
  if (numbers.length > 0) {
    failures.push({
      rule: "number",
      detail: `numbers outside the video title: ${numbers.join(", ")}`,
    });
  }
  if (!namesVideo) {
    failures.push({
      rule: "missing-video-title",
      detail: core
        ? `title not found: "${videoTitle}" or its core "${core}"`
        : `title not found: "${videoTitle}"`,
    });
  }
  if (questions !== 1) {
    failures.push({
      rule: "call-to-action",
      detail: `question marks: ${questions}, need exactly 1`,
    });
  } else if (!ASK.test(questionSentence(body))) {
    failures.push({
      rule: "call-to-action",
      detail: "the one question must ask about the partner program",
    });
  }
  for (const tell of aiTells) {
    const match = body.match(tell);
    if (match) failures.push({ rule: "ai-tell", detail: `"${match[0]}"` });
  }

  return { pass: failures.length === 0, failures };
};
