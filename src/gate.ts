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

const EMOJI = /[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu;

const occurrences = (text: string, mark: string) => text.split(mark).length - 1;

const coreTitle = (title: string) =>
  (title.split(" | ")[0] ?? title)
    .replace(EMOJI, "")
    .replace(/\s+/g, " ")
    .trim();

export const checkDraft = (
  { text, videoTitle }: Draft,
  { bannedWords, aiTells }: GateConfig,
): GateResult => {
  const fullTitle = videoTitle.trim();
  const core = coreTitle(fullTitle);
  const titles = [...new Set([fullTitle, core])].filter((t) => t !== "");
  const namesVideo = titles.some((t) =>
    text.toLowerCase().includes(t.toLowerCase()),
  );
  const body = titles.reduce(
    (remaining, t) => remaining.replace(new RegExp(escapeRegExp(t), "gi"), " "),
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
  if (!namesVideo) {
    failures.push({
      rule: "missing-video-title",
      detail:
        core === fullTitle
          ? `title not found: "${videoTitle}"`
          : `title not found: "${videoTitle}" or its core "${core}"`,
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
