import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import {
  loadAiTells,
  loadBannedWords,
  loadPartners,
  loadSearchTerms,
} from "./config";
import { filterCandidates, PARTNER_BAND } from "./filter";
import { checkDraft } from "./gate";
import { parseOutcomes, summarizeOutcomes } from "./learn";
import { rankByMomentum } from "./score";
import type { Scored } from "./score";
import { entryStatus, renderShortlist } from "./shortlist";
import type { DraftEntry, ShortlistRow } from "./shortlist";
import { fetchRun, toCandidates } from "./youtube";
import type { RawRun } from "./youtube";
import type { ChannelId } from "./types";

const OUT_DIR = "out";
const CACHE_DIR = "out/cache";
const TOP = 10;

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
  if (run.complete === false) {
    console.warn(
      `Warning: ${path} is from a run that stopped early, so some videos or channels have no details.`,
    );
  }
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
  let path: string | undefined;
  const saveProgress = async (snapshot: RawRun) => {
    if (path) await writeFile(path, JSON.stringify(snapshot, null, 2));
    else path = await saveRun(snapshot, now.toLocaleDateString("en-CA"));
  };
  try {
    const run = await fetchRun(phrases, apiKey, now, {
      onProgress: saveProgress,
    });
    return {
      run,
      source: `YouTube API (${run.unitsUsed} quota units), saved to ${path}`,
    };
  } catch (error) {
    if (!path) throw error;
    throw new Error(
      `${error instanceof Error ? error.message : String(error)}\nThe responses received so far are saved in ${path}. Replay them without new quota.`,
      { cause: error },
    );
  }
};

const formatCount = (value: number) => value.toLocaleString("en-US");

const today = () => new Date().toLocaleDateString("en-CA");

type CandidatesFile = { source: string; entries: Scored[] };

const readJson = async <T>(path: string): Promise<T | undefined> => {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
};

const writeShortlist = async (date: string) => {
  const candidates = await readJson<CandidatesFile>(
    `${OUT_DIR}/candidates-${date}.json`,
  );
  if (!candidates) {
    throw new Error(
      `No ${OUT_DIR}/candidates-${date}.json. Run npm run scout first.`,
    );
  }
  const drafts = await readJson<{ entries: DraftEntry[] }>(
    `${OUT_DIR}/drafts-${date}.json`,
  );
  const gateConfig = {
    bannedWords: await loadBannedWords(),
    aiTells: await loadAiTells(),
  };
  const rows: ShortlistRow[] = candidates.entries.map((candidate, index) => {
    const entry = drafts?.entries.find((e) => e.videoId === candidate.videoId);
    return {
      rank: index + 1,
      candidate,
      entry,
      gates: (entry?.attempts ?? []).map((attempt) =>
        checkDraft(
          { text: attempt.draft, videoTitle: candidate.videoTitle },
          gateConfig,
        ),
      ),
    };
  });
  const path = `${OUT_DIR}/shortlist-${date}.md`;
  await writeFile(path, renderShortlist(date, candidates.source, rows));

  console.log(`\nShortlist: ${path}`);
  for (const row of rows) {
    const gate = row.gates.at(-1);
    const failures =
      gate && !gate.pass
        ? ` | gate: ${gate.failures.map((f) => `${f.rule} (${f.detail})`).join("; ")}`
        : "";
    console.log(
      `${row.rank}. ${row.candidate.channelTitle.trim()} | ${entryStatus(row.entry, row.gates)}${failures}`,
    );
  }
};

const OUTCOMES_PATH = "config/outcomes.csv";

const loadTermByChannel = async () => {
  const files = (await readdir(OUT_DIR).catch(() => []))
    .filter((file) => /^candidates-.*\.json$/.test(file))
    .sort();
  const termByChannel = new Map<ChannelId, string>();
  for (const file of files) {
    const candidates = await readJson<CandidatesFile>(`${OUT_DIR}/${file}`);
    for (const entry of candidates?.entries ?? []) {
      termByChannel.set(entry.channelId, entry.searchTerm);
    }
  }
  return termByChannel;
};

const percent = (rate: number | null) =>
  rate === null ? "n/a" : `${Math.round(rate * 100)}%`;

const learn = async () => {
  const rows = parseOutcomes(await readFile(OUTCOMES_PATH, "utf8"));
  const summary = summarizeOutcomes(rows, await loadTermByChannel());

  console.log(
    `Outcomes in ${OUTCOMES_PATH}: ${summary.channels} channels (example rows ignored: ${summary.examplesIgnored})\n`,
  );
  console.log(
    `${"Stage".padEnd(16)}${"Reached".padStart(8)}   From the stage before`,
  );
  summary.reached.forEach(({ stage, channels }, index) => {
    const conversion = summary.conversions[index - 1];
    console.log(
      `${stage.padEnd(16)}${String(channels).padStart(8)}   ${conversion ? percent(conversion.rate) : ""}`,
    );
  });

  const weakest = summary.weakestStep;
  console.log(
    `\nWeakest step: ${weakest ? `${weakest.from} to ${weakest.to} (${percent(weakest.rate)}). Tune this first.` : "not enough data yet"}`,
  );

  console.log("\nBy search term (channels that reached each stage):");
  if (summary.byTerm.length === 0) console.log("  none yet");
  for (const { term, reached } of summary.byTerm) {
    const stages = Object.entries(reached)
      .map(([stage, count]) => `${stage} ${count}`)
      .join(", ");
    console.log(`  ${term}: ${stages}`);
  }
};

const main = async () => {
  if (process.argv[2] === "shortlist") {
    await writeShortlist(today());
    return;
  }
  if (process.argv[2] === "learn") {
    await learn();
    return;
  }

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

  const date = today();
  const candidatesFile: CandidatesFile = {
    source,
    entries: ranked.slice(0, TOP),
  };
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(
    `${OUT_DIR}/candidates-${date}.json`,
    JSON.stringify(candidatesFile, null, 2),
  );
  console.log(
    `\nCandidates for the writer: ${OUT_DIR}/candidates-${date}.json`,
  );
  await writeShortlist(date);
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
