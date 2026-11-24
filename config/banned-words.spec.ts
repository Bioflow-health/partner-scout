import { describe, expect, test } from "vitest";
import { loadBannedWords } from "../src/config";
import { checkDraft } from "../src/gate";

const TITLE = "Ship It Friday: my agent stack";
const draftSaying = (phrase: string) =>
  `Hi Sam, your video "${TITLE}" was ${phrase}. Would you be open to a quick chat about a partner program?`;

describe("config/banned-words.txt", () => {
  test("loads as trimmed lowercase entries with no duplicates", async () => {
    const words = await loadBannedWords();

    expect(words).toEqual([
      ...new Set(words.map((word) => word.trim().toLowerCase())),
    ]);
  });

  test.each([
    "amazing",
    "insane",
    "revolutionary",
    "mind-blowing",
    "crushing it",
    "10x",
  ])("makes the gate reject %s", async (word) => {
    const bannedWords = await loadBannedWords();

    expect(
      checkDraft(
        { text: draftSaying(word.toUpperCase()), videoTitle: TITLE },
        { bannedWords, aiTells: [] },
      ),
    ).toEqual({
      pass: false,
      failures: [{ rule: "banned-word", detail: `"${word}"` }],
    });
  });

  test("lets a plain, specific draft through", async () => {
    const bannedWords = await loadBannedWords();
    const text = draftSaying(
      "the clearest walkthrough of batching clips I have seen this month",
    );

    expect(
      checkDraft({ text, videoTitle: TITLE }, { bannedWords, aiTells: [] }),
    ).toEqual({ pass: true, failures: [] });
  });
});
