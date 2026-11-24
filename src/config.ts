import { readFile } from "node:fs/promises";
import type { ChannelId } from "./types";

export const readLines = async (path: string) =>
  (await readFile(path, "utf8"))
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"));

export type SearchTerm = { phrase: string; topic: string };

export const MAX_SEARCH_TERMS = 5;
export const PARTNERS_HEADER = "channel_id,channel_name";

const numberedLines = (text: string) =>
  text
    .split(/\r?\n/)
    .map((line, index) => ({ number: index + 1, line: line.trim() }))
    .filter(({ line }) => line !== "" && !line.startsWith("#"));

export const parseSearchTerms = (text: string, path: string): SearchTerm[] => {
  const seen = new Set<string>();
  const terms = numberedLines(text).map(({ number, line }) => {
    const parts = line.split("|").map((part) => part.trim());
    const [phrase, topic] = parts;
    if (parts.length !== 2 || phrase === undefined || topic === undefined) {
      throw new Error(
        `${path}:${number}: expected "search phrase | topic keyword"`,
      );
    }
    if (phrase === "") {
      throw new Error(`${path}:${number}: the search phrase is empty`);
    }
    if (topic === "") {
      throw new Error(`${path}:${number}: the topic keyword is empty`);
    }
    if (seen.has(phrase.toLowerCase())) {
      throw new Error(`${path}:${number}: "${phrase}" is listed twice`);
    }
    seen.add(phrase.toLowerCase());
    return { phrase, topic };
  });
  if (terms.length === 0 || terms.length > MAX_SEARCH_TERMS) {
    throw new Error(
      `${path}: needs 1 to ${MAX_SEARCH_TERMS} search terms, found ${terms.length}`,
    );
  }
  return terms;
};

export const parsePartners = (
  text: string,
  path: string,
): ReadonlySet<ChannelId> => {
  const [header, ...rows] = numberedLines(text);
  if (header?.line !== PARTNERS_HEADER) {
    throw new Error(
      `${path}${header ? `:${header.number}` : ""}: the first line must be the header "${PARTNERS_HEADER}"`,
    );
  }
  return new Set(
    rows.map(({ number, line }) => {
      const channelId = (line.split(",")[0] ?? "").trim();
      if (channelId === "") {
        throw new Error(`${path}:${number}: channel_id is empty`);
      }
      return channelId as ChannelId;
    }),
  );
};

const SEARCH_TERMS_PATH = "config/search-terms.txt";
const PARTNERS_PATH = "config/partners.csv";

export const loadSearchTerms = async () =>
  parseSearchTerms(
    await readFile(SEARCH_TERMS_PATH, "utf8"),
    SEARCH_TERMS_PATH,
  );

export const loadPartners = async () =>
  parsePartners(await readFile(PARTNERS_PATH, "utf8"), PARTNERS_PATH);

export const loadBannedWords = async (): Promise<string[]> =>
  (await readLines("config/banned-words.txt")).map((word) =>
    word.toLowerCase(),
  );

export const loadBlotatoFacts = (): Promise<string[]> =>
  readLines("config/blotato-facts.txt");

export const loadAiTells = async (): Promise<RegExp[]> =>
  (await readLines("config/ai-tells.txt")).map(
    (source) => new RegExp(source, "i"),
  );
