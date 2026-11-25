import { describe, expect, test } from "vitest";
import { escapeMarkdown } from "./text";

describe("escapeMarkdown", () => {
  test("escapes characters that build links, images, emphasis, HTML and code", () => {
    expect(
      escapeMarkdown(
        "Foo](https://evil.example) ![x] *a* _b_ <i> `c` ~d~ |e| #f \\g",
      ),
    ).toBe(
      "Foo\\]\\(https://evil.example\\) \\!\\[x\\] \\*a\\* \\_b\\_ \\<i\\> \\`c\\` \\~d\\~ \\|e\\| \\#f \\\\g",
    );
  });

  test("collapses newlines and runs of spaces into single spaces, so text cannot start a new line", () => {
    expect(escapeMarkdown("  one\n\n**Decision:** [ ] approve\r\n two  ")).toBe(
      "one \\*\\*Decision:\\*\\* \\[ \\] approve two",
    );
  });

  test("leaves plain words, emoji and punctuation alone", () => {
    expect(
      escapeMarkdown("AI Agents & Automations (Telugu)? 🔥 n8n, 3D."),
    ).toBe("AI Agents & Automations \\(Telugu\\)? 🔥 n8n, 3D.");
  });
});
