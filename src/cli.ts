import { readFile, readdir, writeFile } from "node:fs/promises";
import { basename } from "node:path";
import { parseArgs, USAGE } from "./args";
import { capDescription, renderWriterBrief } from "./brief";
import {
  loadAiTells,
  loadBannedWords,
  loadPartners,
  loadSearchTerms,
} from "./config";
import type { SearchTerm } from "./config";
import { draftHash, parseChecks, recordVerdict } from "./checks";
import { parseDrafts } from "./drafts";
import { newestFile, writeNew } from "./files";
import { filterCandidates, PARTNER_BAND } from "./filter";
import { parseOutcomes, summarizeOutcomes } from "./learn";
import { rankByMomentum } from "./score";
import type { Scored } from "./score";
import {
  buildRows,
  entryStatus,
  orphanedDrafts,
  renderShortlist,
} from "./shortlist";
import type { DraftEntry } from "./shortlist";
import type { ChannelId } from "./types";
import { fetchRun, toCandidates } from "./youtube";
import type { RawRun } from "./youtube";

const OUT_DIR = "out";
const CACHE_DIR = "out/cache";
const TOP = 10;
const VERSION = { separator: "-v" };

type LoadedRun = { run: RawRun; source: string; cachePath: string };
type CandidatesFile = { source: string; entries: Scored[] };

const readJson = async <T>(path: string): Promise<T | undefined> => {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
};

const loadCachedRun = async (
  requestedPath: string | undefined,
): Promise<LoadedRun> => {
  const cachePath = requestedPath ?? (await newestFile(CACHE_DIR, "", ".json"));
  if (!cachePath) {
    throw new Error(`No cache in ${CACHE_DIR}/. Run npm run scout:live first.`);
  }
  const run = JSON.parse(await readFile(cachePath, "utf8")) as RawRun;
  if (run.complete === false) {
    console.warn(
      `Warning: ${cachePath} is from a run that stopped early, so some videos or channels have no details.`,
    );
  }
  return { run, source: `cache ${cachePath} (0 new quota units)`, cachePath };
};

const loadLiveRun = async (phrases: readonly string[]): Promise<LoadedRun> => {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error(
      "YOUTUBE_API_KEY is not set. Export it in your shell, then run again.",
    );
  }
  const now = new Date();
  let cachePath: string | undefined;
  const saveProgress = async (snapshot: RawRun) => {
    const content = JSON.stringify(snapshot, null, 2);
    if (cachePath) await writeFile(cachePath, content);
    else {
      cachePath = await writeNew(
        CACHE_DIR,
        now.toLocaleDateString("en-CA"),
        ".json",
        content,
      );
    }
  };
  try {
    const run = await fetchRun(phrases, apiKey, now, {
      onProgress: saveProgress,
    });
    const path = cachePath ?? "";
    return {
      run,
      source: `YouTube API (${run.unitsUsed} quota units), saved to ${path}`,
      cachePath: path,
    };
  } catch (error) {
    if (!cachePath) throw error;
    throw new Error(
      `${error instanceof Error ? error.message : String(error)}\nThe responses received so far are saved in ${cachePath}. Replay them with npm run scout:cached ${cachePath} (no new quota).`,
      { cause: error },
    );
  }
};

const formatCount = (value: number) => value.toLocaleString("en-US");

const runOf = (candidatesPath: string) =>
  basename(candidatesPath, ".json").slice("candidates-".length);

const newestRun = async () => {
  const path = await newestFile(OUT_DIR, "candidates-", ".json");
  if (!path) {
    throw new Error(
      `No ${OUT_DIR}/candidates-*.json. Run npm run scout:cached (free) or npm run scout:live first.`,
    );
  }
  return runOf(path);
};

const loadCandidates = async (run: string) => {
  const candidatesPath = `${OUT_DIR}/candidates-${run}.json`;
  const candidates = await readJson<CandidatesFile>(candidatesPath);
  if (!candidates) {
    throw new Error(
      `No ${candidatesPath}. Run npm run scout:cached (free) or npm run scout:live first.`,
    );
  }
  return candidates;
};

const draftsPath = (run: string) => `${OUT_DIR}/drafts-${run}.json`;

const loadDrafts = async (
  run: string,
  candidates: CandidatesFile,
): Promise<DraftEntry[]> => {
  const json = await readJson<unknown>(draftsPath(run));
  return json === undefined
    ? []
    : parseDrafts(
        json,
        draftsPath(run),
        new Set(candidates.entries.map((candidate) => candidate.videoId)),
      );
};

const writeShortlist = async (run: string) => {
  const candidates = await loadCandidates(run);
  const drafts = await loadDrafts(run, candidates);
  const verdicts = await loadChecks(run);
  const gateConfig = {
    bannedWords: await loadBannedWords(),
    aiTells: await loadAiTells(),
  };
  const rows = buildRows(candidates.entries, drafts, verdicts, gateConfig);
  const path = await writeNew(
    OUT_DIR,
    `shortlist-${run}`,
    ".md",
    renderShortlist(run, candidates.source, rows),
    { ...VERSION, reuseIfSame: true },
  );

  console.log(`\nShortlist: ${path}`);
  for (const row of rows) {
    const gate = row.gates.at(-1);
    const failures =
      gate && !gate.pass
        ? ` | gate: ${gate.failures.map((f) => `${f.rule} (${f.detail})`).join("; ")}`
        : "";
    console.log(
      `${row.rank}. ${row.candidate.channelTitle.trim()} | ${entryStatus(row.entry, row.gates, row.verdicts)}${failures}`,
    );
  }
};

const checksPath = (run: string) => `${OUT_DIR}/checks-${run}.json`;

const loadChecks = async (run: string) => {
  const json = await readJson<unknown>(checksPath(run));
  return json === undefined ? [] : parseChecks(json, checksPath(run));
};

const recordCheck = async ({
  run,
  videoId,
  pass,
  reason,
}: {
  run: string;
  videoId: string;
  pass: boolean;
  reason: string;
}) => {
  const drafts = await loadDrafts(run, await loadCandidates(run));
  const draft = drafts
    .find((entry) => entry.videoId === videoId)
    ?.attempts.at(-1)?.draft;
  if (draft === undefined) {
    throw new Error(`${draftsPath(run)} has no draft for ${videoId}.`);
  }
  const verdict = { videoId, draftSha256: draftHash(draft), pass, reason };
  await writeFile(
    checksPath(run),
    JSON.stringify(
      { checks: recordVerdict(await loadChecks(run), verdict) },
      null,
      2,
    ),
  );
  console.log(
    `Recorded ${pass ? "pass" : "fail"} for ${videoId} in ${checksPath(run)} (draft sha256 ${verdict.draftSha256.slice(0, 12)}).`,
  );
};

const warnAboutOrphanedDrafts = async (
  cacheName: string,
  run: string,
  candidates: readonly Scored[],
) => {
  const names = (await readdir(OUT_DIR).catch(() => [])).filter(
    (name) =>
      name.startsWith(`drafts-${cacheName}`) &&
      name.endsWith(".json") &&
      name !== `drafts-${run}.json`,
  );
  for (const name of names) {
    const drafts = await readJson<{ entries?: { videoId?: unknown }[] }>(
      `${OUT_DIR}/${name}`,
    );
    const orphans = orphanedDrafts(
      (drafts?.entries ?? []).map((entry) => String(entry.videoId)),
      candidates.map((candidate) => candidate.videoId),
    );
    if (orphans.length > 0) {
      console.warn(
        `Warning: ${OUT_DIR}/${name} has drafts for ${orphans.length} videos that are not in this run's top ${TOP}: ${orphans.join(", ")}`,
      );
    }
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

const scout = async (
  terms: SearchTerm[],
  { run, source, cachePath }: LoadedRun,
) => {
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

  const top = ranked.slice(0, TOP).map((candidate) => ({
    ...candidate,
    description: capDescription(candidate.description),
  }));
  top.forEach((entry, index) => {
    console.log(
      `\n${index + 1}. ${entry.channelTitle} | momentum ${entry.momentum.toFixed(2)}`,
    );
    console.log(`   video: ${entry.videoTitle}`);
    console.log(
      `   ${formatCount(entry.views)} views / ${formatCount(entry.subscribers ?? 0)} subscribers | https://youtu.be/${entry.videoId} | term: ${entry.searchTerm}`,
    );
  });

  const cacheName = basename(cachePath, ".json");
  const candidatesFile: CandidatesFile = { source, entries: top };
  const candidatesPath = await writeNew(
    OUT_DIR,
    `candidates-${cacheName}`,
    ".json",
    JSON.stringify(candidatesFile, null, 2),
    VERSION,
  );
  const runName = runOf(candidatesPath);
  const briefPath = await writeNew(
    OUT_DIR,
    `brief-${runName}`,
    ".md",
    renderWriterBrief(runName, top),
    VERSION,
  );
  console.log(`\nRun: ${runName}`);
  console.log(
    `Writer brief (untrusted creator text in marked blocks): ${briefPath}`,
  );
  console.log(`Candidates: ${candidatesPath}`);
  await warnAboutOrphanedDrafts(cacheName, runName, top);
  await writeShortlist(runName);
};

const main = async () => {
  const command = parseArgs(process.argv.slice(2));
  if (command.kind === "usage") {
    console.error(USAGE);
    process.exitCode = 2;
    return;
  }
  if (command.kind === "learn") return learn();
  if (command.kind === "check") return recordCheck(command);
  if (command.kind === "shortlist") {
    return writeShortlist(command.run ?? (await newestRun()));
  }
  const terms = await loadSearchTerms();
  return scout(
    terms,
    command.kind === "live"
      ? await loadLiveRun(terms.map((term) => term.phrase))
      : await loadCachedRun(command.path),
  );
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
