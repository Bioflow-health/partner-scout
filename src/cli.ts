import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { filterCandidates, PARTNER_BAND } from "./filter";
import { rankByMomentum } from "./score";
import type { ChannelId } from "./types";
import { fetchRun, toCandidates } from "./youtube";
import type { RawRun } from "./youtube";

const CACHE_DIR = "out/cache";
const TOP = 10;

const readLines = async (path: string) =>
  (await readFile(path, "utf8"))
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"));

const loadSearchTerms = async () =>
  (await readLines("config/search-terms.txt")).map((line) => {
    const [phrase = "", topic = phrase] = line
      .split("|")
      .map((part) => part.trim());
    return { phrase, topic };
  });

const loadPartners = async (): Promise<ReadonlySet<ChannelId>> => {
  const [, ...rows] = await readLines("config/partners.csv");
  return new Set(
    rows.map((row) => (row.split(",")[0] ?? "").trim() as ChannelId),
  );
};

const newestCachePath = async () => {
  const files = (await readdir(CACHE_DIR).catch(() => [])).filter((file) =>
    file.endsWith(".json"),
  );
  const dated = await Promise.all(
    files.map(async (file) => ({
      path: `${CACHE_DIR}/${file}`,
      modified: (await stat(`${CACHE_DIR}/${file}`)).mtimeMs,
    })),
  );
  const newest = dated.sort((a, b) => b.modified - a.modified)[0];
  if (!newest) {
    throw new Error(`No cache in ${CACHE_DIR}/. Run once without --cached.`);
  }
  return newest.path;
};

const loadCachedRun = async (requestedPath: string | undefined) => {
  const path = requestedPath ?? (await newestCachePath());
  const run = JSON.parse(await readFile(path, "utf8")) as RawRun;
  return { run, source: `cache ${path} (0 new quota units)` };
};

const saveRun = async (run: RawRun, date: string) => {
  await mkdir(CACHE_DIR, { recursive: true });
  for (let copy = 1; ; copy += 1) {
    const path = `${CACHE_DIR}/${date}${copy === 1 ? "" : `-${copy}`}.json`;
    try {
      await writeFile(path, JSON.stringify(run, null, 2), { flag: "wx" });
      return path;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
  }
};

const loadLiveRun = async (phrases: readonly string[]) => {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error(
      "YOUTUBE_API_KEY is not set. Export it in your shell, then run again.",
    );
  }
  const now = new Date();
  const run = await fetchRun(phrases, apiKey, now);
  const path = await saveRun(run, now.toLocaleDateString("en-CA"));
  return {
    run,
    source: `YouTube API (${run.unitsUsed} quota units), saved to ${path}`,
  };
};

const formatCount = (value: number) => value.toLocaleString("en-US");

const main = async () => {
  const terms = await loadSearchTerms();
  const cachedFlag = process.argv.indexOf("--cached");
  const { run, source } =
    cachedFlag === -1
      ? await loadLiveRun(terms.map((term) => term.phrase))
      : await loadCachedRun(process.argv[cachedFlag + 1]);

  const candidates = toCandidates(run);
  const { kept, dropped } = filterCandidates(candidates, {
    partners: await loadPartners(),
    band: PARTNER_BAND,
    topics: new Map(terms.map((term) => [term.phrase, term.topic])),
  });
  const ranked = rankByMomentum(kept);

  const dropCounts = new Map<string, number>();
  for (const { reason } of dropped) {
    dropCounts.set(reason, (dropCounts.get(reason) ?? 0) + 1);
  }
  const dropSummary = [...dropCounts]
    .map(([reason, count]) => `${reason} ${count}`)
    .join(", ");

  console.log(`Source: ${source}`);
  console.log(`Search terms: ${run.searches.map((s) => s.term).join(" | ")}`);
  console.log(`Topic keywords: ${terms.map((t) => t.topic).join(" | ")}`);
  console.log(`Published after: ${run.publishedAfter}`);
  console.log(
    `Videos found: ${candidates.length} | kept: ${kept.length} | dropped: ${dropped.length} (${dropSummary || "none"})`,
  );
  console.log(`\nTop ${TOP} by momentum (views / subscribers):`);

  ranked.slice(0, TOP).forEach((entry, index) => {
    console.log(
      `\n${index + 1}. ${entry.channelTitle} | momentum ${entry.momentum.toFixed(2)}`,
    );
    console.log(`   video: ${entry.videoTitle}`);
    console.log(
      `   ${formatCount(entry.views)} views / ${formatCount(entry.subscribers ?? 0)} subscribers | https://youtu.be/${entry.videoId} | term: ${entry.searchTerm}`,
    );
  });
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
