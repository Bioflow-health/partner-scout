import { readFile } from "node:fs/promises";
import type { ChannelId } from "./types";

export const readLines = async (path: string) =>
  (await readFile(path, "utf8"))
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"));

export const loadSearchTerms = async () =>
  (await readLines("config/search-terms.txt")).map((line) => {
    const [phrase = "", topic = phrase] = line
      .split("|")
      .map((part) => part.trim());
    return { phrase, topic };
  });

export const loadPartners = async (): Promise<ReadonlySet<ChannelId>> => {
  const [, ...rows] = await readLines("config/partners.csv");
  return new Set(
    rows.map((row) => (row.split(",")[0] ?? "").trim() as ChannelId),
  );
};

export const loadBannedWords = async (): Promise<string[]> =>
  (await readLines("config/banned-words.txt")).map((word) =>
    word.toLowerCase(),
  );

export const loadAiTells = async (): Promise<RegExp[]> =>
  (await readLines("config/ai-tells.txt")).map(
    (source) => new RegExp(source, "i"),
  );
