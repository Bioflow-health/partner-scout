import { describe, expect, test } from "vitest";
import { loadBlotatoFacts } from "../src/config";

const APPROVED_FACT =
  "Blotato schedules and publishes posts to multiple social platforms from one place, and connects to Claude through its MCP server.";

describe("config/blotato-facts.txt", () => {
  test("holds exactly the one approved sentence", async () => {
    expect(await loadBlotatoFacts()).toEqual([APPROVED_FACT]);
  });
});
