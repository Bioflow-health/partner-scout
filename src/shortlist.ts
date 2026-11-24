import type { GateResult } from "./gate";
import type { Scored } from "./score";

export type CheckerResult = { pass: boolean; reason: string };

export type Attempt = { draft: string; checker?: CheckerResult };

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
  | "ready"
  | "blocked";

export type ShortlistRow = {
  rank: number;
  candidate: Scored;
  entry: DraftEntry | undefined;
  gates: GateResult[];
};

export const entryStatus = (
  entry: DraftEntry | undefined,
  gates: readonly GateResult[],
): EntryStatus => {
  if (!entry) return "pending-draft";
  if (!entry.fit) return "skipped";
  const attempt = entry.attempts.at(-1);
  const gate = gates.at(-1);
  if (!attempt || !gate) return "pending-draft";
  const revised = entry.attempts.length > 1;
  if (!gate.pass) return revised ? "blocked" : "pending-revision";
  if (!attempt.checker) return "pending-checker";
  if (!attempt.checker.pass) return revised ? "blocked" : "pending-revision";
  return "ready";
};

const formatCount = (value: number) => value.toLocaleString("en-US");

const gateLine = (gate: GateResult | undefined) =>
  !gate
    ? "not run"
    : gate.pass
      ? "pass"
      : `fail (${gate.failures.map((f) => `${f.rule}: ${f.detail}`).join("; ")})`;

const checkerLine = (attempt: Attempt) =>
  !attempt.checker
    ? "not run yet"
    : `${attempt.checker.pass ? "pass" : "fail"}. ${attempt.checker.reason}`;

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
};

const renderRow = ({ rank, candidate, entry, gates }: ShortlistRow) => {
  const status = entryStatus(entry, gates);
  const lines = [
    `## ${rank}. ${candidate.channelTitle.trim()}`,
    "",
    `- Channel: https://www.youtube.com/channel/${candidate.channelId}`,
    `- Video: [${candidate.videoTitle}](https://youtu.be/${candidate.videoId})`,
    `- Momentum: ${candidate.momentum.toFixed(2)} = ${formatCount(candidate.views)} views / ${formatCount(candidate.subscribers ?? 0)} subscribers (term: ${candidate.searchTerm})`,
    `- Fit: ${!entry ? "not judged yet" : entry.fit ? `yes. ${entry.reason}` : `skip. ${entry.reason}`}`,
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
      `- Checker: ${checkerLine(final)}`,
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
      `- Checker: ${checkerLine(earlier)}`,
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
    const status = entryStatus(row.entry, row.gates);
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
    "Nothing here has been sent. Tick approve or skip for each ready draft. A human sends every approved message by hand and adds the program terms.",
    "",
    `Status: ${summary}`,
    "",
    ...rows.flatMap((row) => ["---", "", renderRow(row), ""]),
  ].join("\n");
};
