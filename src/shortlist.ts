import { draftHash } from "./checks";
import type { CheckVerdict } from "./checks";
import type { GateResult } from "./gate";
import type { Scored } from "./score";

export type Attempt = { draft: string };

export type DraftEntry = {
  videoId: string;
  fit: boolean;
  reason: string;
  attempts: Attempt[];
};

export type EntryStatus =
  | "pending-draft"
  | "skipped"
  | "pending-revision"
  | "pending-checker"
  | "needs-recheck"
  | "ready"
  | "blocked";

export type ShortlistRow = {
  rank: number;
  candidate: Scored;
  entry: DraftEntry | undefined;
  gates: GateResult[];
  verdicts: CheckVerdict[];
};

export const orphanedDrafts = (
  draftVideoIds: readonly string[],
  candidateVideoIds: readonly string[],
): string[] => {
  const candidates = new Set(candidateVideoIds);
  return [...new Set(draftVideoIds)].filter((id) => !candidates.has(id));
};

const verdictFor = (
  verdicts: readonly CheckVerdict[],
  videoId: string,
  draft: string,
) => {
  const hash = draftHash(draft);
  return verdicts.find(
    (verdict) => verdict.videoId === videoId && verdict.draftSha256 === hash,
  );
};

export const entryStatus = (
  entry: DraftEntry | undefined,
  gates: readonly GateResult[],
  verdicts: readonly CheckVerdict[],
): EntryStatus => {
  if (!entry) return "pending-draft";
  if (!entry.fit) return "skipped";
  const attempt = entry.attempts.at(-1);
  const gate = gates.at(-1);
  if (!attempt || !gate) return "pending-draft";
  const revised = entry.attempts.length > 1;
  if (!gate.pass) return revised ? "blocked" : "pending-revision";
  const verdict = verdictFor(verdicts, entry.videoId, attempt.draft);
  if (!verdict) {
    const earlier = new Set(
      entry.attempts.slice(0, -1).map((a) => draftHash(a.draft)),
    );
    const stale = verdicts.some(
      (v) => v.videoId === entry.videoId && !earlier.has(v.draftSha256),
    );
    return stale ? "needs-recheck" : "pending-checker";
  }
  if (!verdict.pass) return revised ? "blocked" : "pending-revision";
  return "ready";
};

const formatCount = (value: number) => value.toLocaleString("en-US");

const gateLine = (gate: GateResult | undefined) =>
  !gate
    ? "not run"
    : gate.pass
      ? "pass"
      : `fail (${gate.failures.map((f) => `${f.rule}: ${f.detail}`).join("; ")})`;

const checkerLine = (verdict: CheckVerdict | undefined, stale: boolean) =>
  verdict
    ? `${verdict.pass ? "pass" : "fail"}. ${verdict.reason}`
    : stale
      ? "needs re-check: the draft changed after the checker saw it"
      : "not run yet";

const quote = (text: string) =>
  text
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");

const DECISION: Record<EntryStatus, string> = {
  ready: "**Decision:** [ ] approve [ ] skip",
  skipped: "**Decision:** none needed (not a fit, no draft)",
  blocked:
    "**Decision:** blocked. The revision failed too; rewrite by hand or skip: [ ] skip",
  "pending-draft": "**Decision:** waiting for a draft",
  "pending-revision": "**Decision:** waiting for the writer's one revision",
  "pending-checker": "**Decision:** waiting for the checker",
  "needs-recheck":
    "**Decision:** waiting for a re-check (the draft changed after the checker saw it)",
};

const renderRow = ({
  rank,
  candidate,
  entry,
  gates,
  verdicts,
}: ShortlistRow) => {
  const status = entryStatus(entry, gates, verdicts);
  const verdictOf = (attempt: Attempt) =>
    verdictFor(verdicts, candidate.videoId, attempt.draft);
  const lines = [
    `## ${rank}. ${candidate.channelTitle.trim()}`,
    "",
    `- Channel: https://www.youtube.com/channel/${candidate.channelId}`,
    `- Video: [${candidate.videoTitle}](https://youtu.be/${candidate.videoId})`,
    `- Momentum: ${candidate.momentum.toFixed(2)} = ${formatCount(candidate.views)} views / ${formatCount(candidate.subscribers ?? 0)} subscribers (term: ${candidate.searchTerm})`,
    `- Fit: ${!entry ? "not judged yet" : entry.fit ? `yes. ${entry.reason}` : `skip. ${entry.reason.replace(/^skip:\s*/i, "")}`}`,
  ];

  const attempts = entry?.attempts ?? [];
  const final = attempts.at(-1);
  if (final) {
    lines.push(
      "",
      attempts.length > 1 ? "**Draft (revised once)**" : "**Draft**",
      "",
      quote(final.draft),
      "",
      `- Code gate: ${gateLine(gates.at(-1))}`,
      `- Checker: ${checkerLine(verdictOf(final), status === "needs-recheck")}`,
    );
  }
  attempts.slice(0, -1).forEach((earlier, index) => {
    lines.push(
      "",
      `**Earlier attempt ${index + 1}, sent back to the writer**`,
      "",
      quote(earlier.draft),
      "",
      `- Code gate: ${gateLine(gates[index])}`,
      `- Checker: ${checkerLine(verdictOf(earlier), false)}`,
    );
  });

  lines.push("", DECISION[status]);
  return lines.join("\n");
};

export const renderShortlist = (
  date: string,
  source: string,
  rows: readonly ShortlistRow[],
) => {
  const counts = new Map<EntryStatus, number>();
  for (const row of rows) {
    const status = entryStatus(row.entry, row.gates, row.verdicts);
    counts.set(status, (counts.get(status) ?? 0) + 1);
  }
  const summary = [...counts]
    .map(([status, count]) => `${status} ${count}`)
    .join(" | ");

  return [
    `# Partner shortlist, ${date}`,
    "",
    `Source: ${source}.`,
    "",
    "Watch the video before approving. A human sends every message.",
    "",
    "Nothing here has been sent. Tick approve or skip for each ready draft, and add the program terms before sending.",
    "",
    `Status: ${summary}`,
    "",
    ...rows.flatMap((row) => ["---", "", renderRow(row), ""]),
  ].join("\n");
};
