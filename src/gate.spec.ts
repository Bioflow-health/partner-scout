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

  test.each([
    { mark: "a question mark", videoTitle: "Is n8n worth it?" },
    { mark: "an em dash", videoTitle: "Clipping streams—the easy way" },
    { mark: "a banned word", videoTitle: "My EPIC posting setup" },
    { mark: "an AI tell", videoTitle: "This game-changer posts for me" },
  ])("ignores $mark inside the video title", ({ videoTitle }) => {
    const text = CLEAN.replace(TITLE, videoTitle);

    expect(checkDraft({ text, videoTitle }, config)).toEqual({
      pass: true,
      failures: [],
    });
  });

  test("counts the video title's words toward the word limit", () => {
    const longTitle =
      "How I schedule a full month of short clips for every platform in one quiet afternoon with two simple tools";
    const draftWordsWithLongTitle = 53;
    const text = [
      CLEAN.replace(TITLE, longTitle),
      ...Array.from(
        { length: SPEC_MAX_WORDS + 1 - draftWordsWithLongTitle },
        () => "more",
      ),
    ].join(" ");

    expect(checkDraft({ text, videoTitle: longTitle }, config)).toEqual({
      pass: false,
      failures: [
        {
          rule: "too-long",
          detail: `words: ${SPEC_MAX_WORDS + 1}, max ${SPEC_MAX_WORDS}`,
        },
      ],
    });
  });

  describe("core title", () => {
    const COURSE_TITLE =
      "🔥AI Agents & Automations Full Course (Telugu) | n8n Basic to Advanced | 11+ Hours";
    const COURSE_CORE = "AI Agents & Automations Full Course (Telugu)";

    test("passes a draft that names only the core: the text before the first ' | ', without emoji", () => {
      const text = CLEAN.replace(TITLE, COURSE_CORE);

      expect(checkDraft({ text, videoTitle: COURSE_TITLE }, config)).toEqual({
        pass: true,
        failures: [],
      });
    });

    test("finds the core of a title with no ' | ' by removing its emoji", () => {
      const text = CLEAN.replace(TITLE, "What Is n8n? Build Workflows");

      expect(
        checkDraft(
          { text, videoTitle: "🤖 What Is n8n? ⚡ Build Workflows" },
          config,
        ),
      ).toEqual({ pass: true, failures: [] });
    });

    test("ignores a question mark inside the core title", () => {
      const text = CLEAN.replace(TITLE, "Is n8n worth it?");

      expect(
        checkDraft(
          { text, videoTitle: "Is n8n worth it? | A full walkthrough" },
          config,
        ),
      ).toEqual({ pass: true, failures: [] });
    });

    test("fails a draft that names only part of the core, and quotes both forms", () => {
      const text = CLEAN.replace(TITLE, "AI Agents");

      expect(checkDraft({ text, videoTitle: COURSE_TITLE }, config)).toEqual({
        pass: false,
        failures: [
          {
            rule: "missing-video-title",
            detail: `title not found: "${COURSE_TITLE}" or its core "${COURSE_CORE}"`,
          },
        ],
      });
    });
  });

  describe("title loophole", () => {
    test("requires the title inside quotes: an unquoted mention of a one-word title does not count", () => {
      const text =
        "Hi, Blotato schedules posts from one place. Would you be open to hearing about a partner program?";

      expect(checkDraft({ text, videoTitle: "Blotato" }, config)).toEqual({
        pass: false,
        failures: [
          { rule: "missing-video-title", detail: 'title not found: "Blotato"' },
        ],
      });
    });

    test("accepts a quoted one-word title", () => {
      const text = CLEAN.replace(TITLE, "Blotato");

      expect(checkDraft({ text, videoTitle: "Blotato" }, config)).toEqual({
        pass: true,
        failures: [],
      });
    });

    test("accepts curly quotes around the title", () => {
      const text = CLEAN.replace(`"${TITLE}"`, `“${TITLE}”`);

      expect(checkDraft({ text, videoTitle: TITLE }, config)).toEqual({
        pass: true,
        failures: [],
      });
    });

    test("ignores a core shorter than 2 words and requires the full title instead", () => {
      const text = CLEAN.replace(TITLE, "AI");

      expect(
        checkDraft({ text, videoTitle: "AI | Build agents" }, config),
      ).toEqual({
        pass: false,
        failures: [
          {
            rule: "missing-video-title",
            detail: 'title not found: "AI | Build agents"',
          },
        ],
      });
    });

    test.each([
      {
        core: "Clipping Tips",
        title: "Clipping Tips | part two",
        accepted: true,
      },
      { core: "Reels Guide", title: "Reels Guide | part two", accepted: false },
    ])(
      "counts a 2-word core only from 12 characters: $core is accepted: $accepted",
      ({ core, title, accepted }) => {
        const text = CLEAN.replace(TITLE, core);

        expect(checkDraft({ text, videoTitle: title }, config).pass).toBe(
          accepted,
        );
      },
    );

    test("removes only the quoted title, so a short title cannot hide text inside other words", () => {
      const text = `I hope this email finds you well. ${CLEAN.replace(TITLE, "AI | Build agents")}`;

      expect(
        checkDraft({ text, videoTitle: "AI | Build agents" }, config),
      ).toEqual({
        pass: false,
        failures: [
          { rule: "ai-tell", detail: '"I hope this email finds you well"' },
        ],
      });
    });
  });

  describe("rulebook rules the gate can check", () => {
    test("fails a draft with numbers outside the quoted title, and quotes them", () => {
      const text = CLEAN.replace(
        "batch posts.",
        "batch 30 posts for $300 a month, up 20%.",
      );

      expect(checkDraft({ text, videoTitle: TITLE }, config)).toEqual({
        pass: false,
        failures: [
          {
            rule: "number",
            detail: "numbers outside the video title: 30, $300, 20%",
          },
        ],
      });
    });

    test("allows numbers inside the quoted title", () => {
      const title = "Top 5 tips for 2026";
      const text = CLEAN.replace(TITLE, title);

      expect(checkDraft({ text, videoTitle: title }, config)).toEqual({
        pass: true,
        failures: [],
      });
    });

    test("treats names that contain digits, like n8n and 3D, as words", () => {
      const text = CLEAN.replace(
        "batch posts.",
        "batch n8n flows and 3D clips.",
      );

      expect(checkDraft({ text, videoTitle: TITLE }, config)).toEqual({
        pass: true,
        failures: [],
      });
    });

    test("fails a draft whose one question is not the partner-program ask", () => {
      const text = CLEAN.replace(
        "Would you be open to a quick chat about a partner program?",
        "Did you plan the scheduling part?",
      );

      expect(checkDraft({ text, videoTitle: TITLE }, config)).toEqual({
        pass: false,
        failures: [
          {
            rule: "call-to-action",
            detail: "the one question must ask about the partner program",
          },
        ],
      });
    });
  });
});
