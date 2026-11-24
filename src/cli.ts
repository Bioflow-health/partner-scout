import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { filterCandidates, NO_SIZE_LIMIT } from "./filter";
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

const loadPartners = async (): Promise<ReadonlySet<ChannelId>> => {
  const [, ...rows] = await readLines("config/partners.csv");
  return new Set(
    rows.map((row) => (row.split(",")[0] ?? "").trim() as ChannelId),
  );
};

const loadCachedRun = async () => {
  const files = (await readdir(CACHE_DIR).catch(() => []))
    .filter((file) => file.endsWith(".json"))
    .sort();
  const latest = files.at(-1);
  if (!latest) {
    throw new Error(`No cache in ${CACHE_DIR}/. Run once without --cached.`);
  }
  const path = `${CACHE_DIR}/${latest}`;
  const run = JSON.parse(await readFile(path, "utf8")) as RawRun;
  return { run, source: `cache ${path} (0 new quota units)` };
};

const loadLiveRun = async () => {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error(
      "YOUTUBE_API_KEY is not set. Export it in your shell, then run again.",
    );
  }
  const now = new Date();
  const run = await fetchRun(
    await readLines("config/search-terms.txt"),
    apiKey,
    now,
  );
  const path = `${CACHE_DIR}/${now.toLocaleDateString("en-CA")}.json`;
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(path, JSON.stringify(run, null, 2));
  return {
    run,
    source: `YouTube API (${run.unitsUsed} quota units), saved to ${path}`,
  };
};

const formatCount = (value: number) => value.toLocaleString("en-US");

const main = async () => {
  const { run, source } = process.argv.includes("--cached")
    ? await loadCachedRun()
    : await loadLiveRun();

  const candidates = toCandidates(run);
  const { kept, dropped } = filterCandidates(candidates, {
    partners: await loadPartners(),
    band: NO_SIZE_LIMIT,
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
