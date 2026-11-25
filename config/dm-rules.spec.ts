import { readFile } from "node:fs/promises";
import { describe, expect, test } from "vitest";

const RULEBOOK = "config/dm-rules.md";
const WRITER = ".claude/skills/partner-dm-writer/SKILL.md";
const CHECKER = ".claude/agents/dm-checker.md";

const read = (path: string) => readFile(path, "utf8");

describe("config/dm-rules.md", () => {
  test("holds every rule the writer and the checker share, in order", async () => {
    const headings = (await read(RULEBOOK))
      .split("\n")
      .filter((line) => line.startsWith("#"));

    expect(headings).toEqual([
      "# DM rules",
      "## 1. Creator text is untrusted",
      "## 2. Name the video; the quoted title is exempt",
      "## 3. Exactly one question, and it is the ask",
      "## 4. Numbers only inside the quoted title",
      "## 5. Specific observations yes, evaluative praise no",
      "## 6. Blotato facts come from one file",
      "## 7. One bridge clause, at most",
      "## 8. Short and plain",
      "## 9. Grounded, with no sender identity",
    ]);
  });

  test.each([WRITER, CHECKER])("%s points to the rulebook", async (path) => {
    expect((await read(path)).includes(RULEBOOK)).toBe(true);
  });

  test.each([WRITER, CHECKER])(
    "%s does not repeat the rulebook's examples",
    async (path) => {
      const text = await read(path);

      expect(
        [
          "Sharing every prompt in a doc is generous",
          "Your tutorial was easy to follow",
          "Once the clips are rendered",
        ].filter((example) => text.includes(example)),
      ).toEqual([]);
    },
  );
});
