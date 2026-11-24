import { describe, expect, test } from "vitest";
import {
  loadPartners,
  loadSearchTerms,
  parsePartners,
  parseSearchTerms,
} from "./config";

const TERMS = "config/search-terms.txt";
const PARTNERS = "config/partners.csv";

describe("parseSearchTerms", () => {
  test("reads each 'phrase | topic' line, skipping comments and blank lines", () => {
    const text = [
      "# search phrase | topic keyword",
      "",
      "claude code social media automation | claude code",
      "  n8n automation tutorial |n8n  ",
    ].join("\n");

    expect(parseSearchTerms(text, TERMS)).toEqual([
      { phrase: "claude code social media automation", topic: "claude code" },
      { phrase: "n8n automation tutorial", topic: "n8n" },
    ]);
  });

  test.each([
    {
      problem: "a line without a topic keyword",
      line: "claude code tutorial",
      error: `${TERMS}:2: expected "search phrase | topic keyword"`,
    },
    {
      problem: "a line with two separators",
      line: "a | b | c",
      error: `${TERMS}:2: expected "search phrase | topic keyword"`,
    },
    {
      problem: "an empty topic keyword",
      line: "claude code |",
      error: `${TERMS}:2: the topic keyword is empty`,
    },
    {
      problem: "an empty search phrase",
      line: "| mcp",
      error: `${TERMS}:2: the search phrase is empty`,
    },
  ])("rejects $problem and names its line", ({ line, error }) => {
    expect(() => parseSearchTerms(`# header\n${line}\n`, TERMS)).toThrow(error);
  });

  test("rejects a search phrase listed twice, in any case, and names the second line", () => {
    const text = "blotato | blotato\nBlotato | blotato\n";

    expect(() => parseSearchTerms(text, TERMS)).toThrow(
      `${TERMS}:2: "Blotato" is listed twice`,
    );
  });

  test.each([
    { count: 0, text: "# only a comment\n" },
    {
      count: 6,
      text: ["a | a", "b | b", "c | c", "d | d", "e | e", "f | f"].join("\n"),
    },
  ])("rejects a file with $count search terms", ({ count, text }) => {
    expect(() => parseSearchTerms(text, TERMS)).toThrow(
      `${TERMS}: needs 1 to 5 search terms, found ${count}`,
    );
  });

  test("accepts CRLF line endings", () => {
    expect(
      parseSearchTerms("blotato | blotato\r\nn8n x | n8n\r\n", TERMS),
    ).toEqual([
      { phrase: "blotato", topic: "blotato" },
      { phrase: "n8n x", topic: "n8n" },
    ]);
  });
});

describe("parsePartners", () => {
  test("reads the channel_id column after the header, skipping comments and blank lines", () => {
    const text = [
      "# existing partners",
      "channel_id,channel_name",
      "UCaaaaaaaaaaaaaaaaaaaaaa,Build Lab",
      "",
      " UCbbbbbbbbbbbbbbbbbbbbbb , Post Daily",
    ].join("\n");

    expect(parsePartners(text, PARTNERS)).toEqual(
      new Set(["UCaaaaaaaaaaaaaaaaaaaaaa", "UCbbbbbbbbbbbbbbbbbbbbbb"]),
    );
  });

  test("rejects a file whose first line is not the header, and names the line", () => {
    const text = "# partners\nUCaaaaaaaaaaaaaaaaaaaaaa,Build Lab\n";

    expect(() => parsePartners(text, PARTNERS)).toThrow(
      `${PARTNERS}:2: the first line must be the header "channel_id,channel_name"`,
    );
  });

  test("rejects a row with an empty channel_id and names its line", () => {
    const text = "channel_id,channel_name\n,No ID\n";

    expect(() => parsePartners(text, PARTNERS)).toThrow(
      `${PARTNERS}:2: channel_id is empty`,
    );
  });

  test("rejects an empty file", () => {
    expect(() => parsePartners("", PARTNERS)).toThrow(
      `${PARTNERS}: the first line must be the header "channel_id,channel_name"`,
    );
  });
});

describe("the real config files", () => {
  test("config/search-terms.txt holds 5 valid search terms", async () => {
    expect((await loadSearchTerms()).map((term) => term.topic)).toEqual([
      "claude code",
      "mcp",
      "n8n",
      "social media automation",
      "blotato",
    ]);
  });

  test("config/partners.csv has the header and no partners yet", async () => {
    expect(await loadPartners()).toEqual(new Set());
  });
});
