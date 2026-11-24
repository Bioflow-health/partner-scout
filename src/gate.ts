import { escapeRegExp, phrasePattern } from "./text";

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

const MAX_WORDS = 90;
const EM_DASH = "—";

const occurrences = (text: string, mark: string) => text.split(mark).length - 1;

export const checkDraft = (
  { text, videoTitle }: Draft,
  { bannedWords, aiTells }: GateConfig,
): GateResult => {
  const title = videoTitle.trim();
  const namesVideo =
    title !== "" && text.toLowerCase().includes(title.toLowerCase());
  const body =
    title === ""
      ? text
      : text.replace(new RegExp(escapeRegExp(title), "gi"), " ");
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
  if (!namesVideo) {
    failures.push({
      rule: "missing-video-title",
      detail: `title not found: "${videoTitle}"`,
    });
  }
  if (questions !== 1) {
    failures.push({
      rule: "call-to-action",
      detail: `question marks: ${questions}, need exactly 1`,
    });
  }
  for (const tell of aiTells) {
    const match = body.match(tell);
    if (match) failures.push({ rule: "ai-tell", detail: `"${match[0]}"` });
  }

  return { pass: failures.length === 0, failures };
};
