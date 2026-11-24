import type { ChannelId } from "./types";

export const STAGES = [
  "contacted",
  "replied",
  "signed",
  "first_referral",
  "ten_a_month",
] as const;

export type Stage = (typeof STAGES)[number];

export type OutcomeRow = {
  date: string;
  channelId: ChannelId;
  channel: string;
  stage: Stage;
  notes: string;
};

export type Conversion = { from: Stage; to: Stage; rate: number | null };

export type OutcomeSummary = {
  examplesIgnored: number;
  channels: number;
  reached: { stage: Stage; channels: number }[];
  conversions: Conversion[];
  weakestStep: Conversion | null;
  byTerm: { term: string; reached: Record<Stage, number> }[];
};

const HEADER = "date,channel_id,channel,stage,notes";
const EXAMPLE_ID = "EXAMPLE";

const splitCsvLine = (line: string): string[] => {
  const fields: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line.charAt(i);
    if (quoted && char === '"' && line.charAt(i + 1) === '"') {
      field += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      fields.push(field);
      field = "";
    } else {
      field += char;
    }
  }
  fields.push(field);
  return fields;
};

const isStage = (value: string): value is Stage =>
  (STAGES as readonly string[]).includes(value);

export const parseOutcomes = (csv: string): OutcomeRow[] => {
  const lines = csv.split(/\r?\n/);
  if (lines[0]?.trim() !== HEADER) {
    throw new Error(`expected the header "${HEADER}"`);
  }
  return lines.slice(1).flatMap((line, index) => {
    if (line.trim() === "") return [];
    const [date = "", channelId = "", channel = "", stage = "", ...notes] =
      splitCsvLine(line);
    const trimmedStage = stage.trim();
    if (!isStage(trimmedStage)) {
      throw new Error(`line ${index + 2}: unknown stage "${trimmedStage}"`);
    }
    return [
      {
        date: date.trim(),
        channelId: channelId.trim() as ChannelId,
        channel,
        stage: trimmedStage,
        notes: notes.join(","),
      },
    ];
  });
};

const emptyCounts = () =>
  Object.fromEntries(STAGES.map((stage) => [stage, 0])) as Record<
    Stage,
    number
  >;

export const summarizeOutcomes = (
  rows: readonly OutcomeRow[],
  termByChannel: ReadonlyMap<ChannelId, string>,
): OutcomeSummary => {
  const real = rows.filter((row) => row.channelId !== EXAMPLE_ID);

  const furthest = new Map<ChannelId, number>();
  for (const row of real) {
    const level = STAGES.indexOf(row.stage);
    furthest.set(
      row.channelId,
      Math.max(level, furthest.get(row.channelId) ?? -1),
    );
  }

  const reached = STAGES.map((stage, level) => ({
    stage,
    channels: [...furthest.values()].filter((f) => f >= level).length,
  }));

  const conversions: Conversion[] = reached.flatMap((next, index) => {
    const previous = reached[index - 1];
    return previous
      ? [
          {
            from: previous.stage,
            to: next.stage,
            rate:
              previous.channels === 0
                ? null
                : next.channels / previous.channels,
          },
        ]
      : [];
  });

  const weakestStep = conversions.reduce<Conversion | null>(
    (weakest, step) =>
      step.rate !== null &&
      (weakest === null || step.rate < (weakest.rate ?? 0))
        ? step
        : weakest,
    null,
  );

  const terms = new Map<string, Record<Stage, number>>();
  for (const [channelId, level] of furthest) {
    const term = termByChannel.get(channelId) ?? "unknown";
    const counts = terms.get(term) ?? emptyCounts();
    STAGES.forEach((stage, stageLevel) => {
      if (level >= stageLevel) counts[stage] += 1;
    });
    terms.set(term, counts);
  }

  return {
    examplesIgnored: rows.length - real.length,
    channels: furthest.size,
    reached,
    conversions,
    weakestStep,
    byTerm: [...terms]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([term, counts]) => ({ term, reached: counts })),
  };
};
