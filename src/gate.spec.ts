import { describe, expect, test } from "vitest";
import { checkDraft } from "./gate";
import type { GateConfig } from "./gate";

const SPEC_MAX_WORDS = 90;
const TITLE = "Ship It Friday: my agent stack";
const CLEAN = `Hi Sam, your video "${TITLE}" made me rethink how I batch posts. The step-by-step part on scheduling clips was clear and practical. Would you be open to a quick chat about a partner program?`;
const CLEAN_WORD_COUNT = 39;

const config: GateConfig = {
  bannedWords: ["epic", "crushing it", "insane"],
  aiTells: [
    /I hope this (message|email) finds you well/i,
    /\b(game-changer|unlock)\b/i,
    /\bnot just\b[^.?!]*\bbut\b/i,
    /\b\w+, \w+,? (and|or) \w+\b/i,
  ],
};

const padTo = (words: number) =>
  [
    CLEAN,
    ...Array.from({ length: words - CLEAN_WORD_COUNT }, () => "more"),
  ].join(" ");

describe("checkDraft", () => {
  test("passes a clean draft", () => {
    expect(checkDraft({ text: CLEAN, videoTitle: TITLE }, config)).toEqual({
      pass: true,
      failures: [],
    });
  });

  test("fails a draft with em dashes and reports how many", () => {
    const text = CLEAN.replace(
      "batch posts.",
      "batch posts—and clips—every week.",
    );

    expect(checkDraft({ text, videoTitle: TITLE }, config)).toEqual({
      pass: false,
      failures: [{ rule: "em-dash", detail: "em dashes: 2" }],
    });
  });

  test(`passes a draft of exactly ${SPEC_MAX_WORDS} words`, () => {
    const text = padTo(SPEC_MAX_WORDS);

    expect(checkDraft({ text, videoTitle: TITLE }, config)).toEqual({
      pass: true,
      failures: [],
    });
  });

  test(`fails a draft of ${SPEC_MAX_WORDS + 1} words`, () => {
    const text = padTo(SPEC_MAX_WORDS + 1);

    expect(checkDraft({ text, videoTitle: TITLE }, config)).toEqual({
      pass: false,
      failures: [
        {
          rule: "too-long",
          detail: `words: ${SPEC_MAX_WORDS + 1}, max ${SPEC_MAX_WORDS}`,
        },
      ],
    });
  });

  test.each([
    {
      found: "a banned word in capitals",
      word: "epic",
      text: CLEAN.replace("clear and practical", "EPIC"),
    },
    {
      found: "a banned two-word phrase",
      word: "crushing it",
      text: CLEAN.replace("was clear and practical", "was crushing it"),
    },
  ])("fails a draft containing $found", ({ word, text }) => {
    expect(checkDraft({ text, videoTitle: TITLE }, config)).toEqual({
      pass: false,
      failures: [{ rule: "banned-word", detail: `"${word}"` }],
    });
  });

  test("passes a draft where a banned word only appears inside a longer word", () => {
    const text = CLEAN.replace("clear and practical", "the epicenter of it");

    expect(checkDraft({ text, videoTitle: TITLE }, config)).toEqual({
      pass: true,
      failures: [],
    });
  });

  test("fails a draft that does not name the creator's video", () => {
    const text = CLEAN.replace(`your video "${TITLE}"`, "your latest video");

    expect(checkDraft({ text, videoTitle: TITLE }, config)).toEqual({
      pass: false,
      failures: [
        { rule: "missing-video-title", detail: `title not found: "${TITLE}"` },
      ],
    });
  });

  test("passes a draft that names the video in another case", () => {
    const text = CLEAN.replace(TITLE, TITLE.toLowerCase());

    expect(checkDraft({ text, videoTitle: TITLE }, config)).toEqual({
      pass: true,
      failures: [],
    });
  });

  test.each([
    {
      label: "no question mark",
      count: 0,
      text: CLEAN.replace("program?", "program."),
    },
    {
      label: "two question marks",
      count: 2,
      text: CLEAN.replace("posts.", "posts. Did you plan that?"),
    },
  ])("fails a draft with $label", ({ count, text }) => {
    expect(checkDraft({ text, videoTitle: TITLE }, config)).toEqual({
      pass: false,
      failures: [
        {
          rule: "call-to-action",
          detail: `question marks: ${count}, need exactly 1`,
        },
      ],
    });
  });

  test.each([
    {
      tell: "a stock opener",
      text: `I hope this message finds you well. ${CLEAN}`,
      matched: "I hope this message finds you well",
    },
    {
      tell: "an inflated word",
      text: CLEAN.replace("clear and practical", "a game-changer"),
      matched: "game-changer",
    },
    {
      tell: "not just X, but Y phrasing",
      text: CLEAN.replace(
        "was clear and practical",
        "was not just clear, but practical",
      ),
      matched: "not just clear, but",
    },
    {
      tell: "a tidy group of three",
      text: CLEAN.replace("clear and practical", "clear, calm, and practical"),
      matched: "clear, calm, and practical",
    },
  ])(
    "fails a draft with $tell and quotes the matched text",
    ({ text, matched }) => {
      expect(checkDraft({ text, videoTitle: TITLE }, config)).toEqual({
        pass: false,
        failures: [{ rule: "ai-tell", detail: `"${matched}"` }],
      });
    },
  );

  test("reports every failure at once, in rule order", () => {
    const text =
      "I hope this message finds you well. Your latest video was epic—truly. Let's talk.";

    expect(checkDraft({ text, videoTitle: TITLE }, config)).toEqual({
      pass: false,
      failures: [
        { rule: "em-dash", detail: "em dashes: 1" },
        { rule: "banned-word", detail: '"epic"' },
        { rule: "missing-video-title", detail: `title not found: "${TITLE}"` },
        { rule: "call-to-action", detail: "question marks: 0, need exactly 1" },
        { rule: "ai-tell", detail: '"I hope this message finds you well"' },
      ],
    });
  });
});
