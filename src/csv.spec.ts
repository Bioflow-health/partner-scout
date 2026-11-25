import { describe, expect, test } from "vitest";
import { csvCell, toCsv } from "./csv";

describe("csvCell", () => {
  test.each([
    { label: "plain text as it is", value: "Build Lab", cell: "Build Lab" },
    { label: "an empty cell empty", value: "", cell: "" },
    {
      label: "an emoji as it is",
      value: "🔥 Clip streams",
      cell: "🔥 Clip streams",
    },
    { label: "a later equals sign as it is", value: "a=b", cell: "a=b" },
    {
      label: "a comma inside quotes",
      value: "Hi, Ashton",
      cell: '"Hi, Ashton"',
    },
    {
      label: "double quotes doubled, inside quotes",
      value: 'the "live" skill',
      cell: '"the ""live"" skill"',
    },
    {
      label: "a line break inside quotes",
      value: "one\ntwo",
      cell: '"one\ntwo"',
    },
  ])("keeps $label (RFC 4180)", ({ value, cell }) => {
    expect(csvCell(value)).toBe(cell);
  });

  test.each([
    { start: "=", value: "=1+1", cell: "'=1+1" },
    { start: "+", value: "+5 hooks", cell: "'+5 hooks" },
    { start: "-", value: "-2 steps", cell: "'-2 steps" },
    { start: "@", value: "@SUM(A1)", cell: "'@SUM(A1)" },
    { start: "a tab", value: "\tx", cell: "'\tx" },
    { start: "a carriage return", value: "\rx", cell: '"\'\rx"' },
    {
      start: "=HYPERLINK( with quotes and a comma",
      value: '=HYPERLINK("https://example.test","click")',
      cell: '"\'=HYPERLINK(""https://example.test"",""click"")"',
    },
  ])(
    "puts an apostrophe before a cell that starts with $start",
    ({ value, cell }) => {
      expect(csvCell(value)).toBe(cell);
    },
  );
});

describe("toCsv", () => {
  test("starts with a byte-order mark and ends every row with CRLF", () => {
    expect(
      toCsv([
        ["rank", "channel"],
        ["1", "Build Lab, live"],
      ]),
    ).toBe('\uFEFFrank,channel\r\n1,"Build Lab, live"\r\n');
  });
});
