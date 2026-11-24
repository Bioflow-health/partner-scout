import { describe, expect, test } from "vitest";
import { loadAiTells } from "../src/config";
import { checkDraft } from "../src/gate";

const TITLE = "Ship It Friday: my agent stack";
const draftWith = (sentence: string) =>
  `Hi Sam, your video "${TITLE}" stuck with me. ${sentence} Would you be open to a quick chat about a partner program?`;

describe("config/ai-tells.txt", () => {
  test("compiles every pattern to match in any case", async () => {
    const aiTells = await loadAiTells();

    expect(aiTells.map((tell) => tell.flags)).toEqual(aiTells.map(() => "i"));
  });

  test.each([
    {
      tell: "a stock opener",
      sentence: "I hope this message finds you well.",
      matched: "I hope this message finds you well",
    },
    {
      tell: "another stock opener",
      sentence: "I wanted to reach out about your channel.",
      matched: "I wanted to reach out",
    },
    {
      tell: "an inflated word",
      sentence: "Your setup is a game-changer.",
      matched: "game-changer",
    },
    {
      tell: "unlock",
      sentence: "It could unlock new income.",
      matched: "unlock",
    },
    {
      tell: "not just X, but Y phrasing",
      sentence: "It is not just fast, but simple.",
      matched: "not just fast, but",
    },
    {
      tell: "a tidy group of three",
      sentence: "It is fast, simple, and fun.",
      matched: "fast, simple, and fun",
    },
  ])("makes the gate reject $tell", async ({ sentence, matched }) => {
    const aiTells = await loadAiTells();

    expect(
      checkDraft(
        { text: draftWith(sentence), videoTitle: TITLE },
        { bannedWords: [], aiTells },
      ),
    ).toEqual({
      pass: false,
      failures: [{ rule: "ai-tell", detail: `"${matched}"` }],
    });
  });

  test("lets a plain, specific draft through", async () => {
    const aiTells = await loadAiTells();
    const text = draftWith(
      "The part where you batch a week of clips in one sitting changed how I plan Mondays.",
    );

    expect(
      checkDraft({ text, videoTitle: TITLE }, { bannedWords: [], aiTells }),
    ).toEqual({ pass: true, failures: [] });
  });
});
