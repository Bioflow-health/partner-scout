import { describe, expect, test } from "vitest";
import { parseOutcomes, summarizeOutcomes } from "./learn";
import type { OutcomeRow, Stage } from "./learn";
import type { ChannelId } from "./types";

const HEADER = "date,channel_id,channel,stage,notes";

const row = (channelId: string, stage: Stage): OutcomeRow => ({
  date: "2026-11-25",
  channelId: channelId as ChannelId,
  channel: `Channel ${channelId}`,
  stage,
  notes: "",
});

const counts = (
  contacted: number,
  replied: number,
  signed: number,
  first_referral: number,
  ten_a_month: number,
) => ({ contacted, replied, signed, first_referral, ten_a_month });

describe("parseOutcomes", () => {
  test("reads every row after the header, including quoted fields that contain commas", () => {
    const csv = [
      HEADER,
      '2026-11-25,UC1,"Build, Ship and Post",contacted,"sent by hand, no reply yet"',
      "2026-11-27,UC1,Build Ship and Post,replied,",
      "",
    ].join("\n");

    expect(parseOutcomes(csv)).toEqual([
      {
        date: "2026-11-25",
        channelId: "UC1",
        channel: "Build, Ship and Post",
        stage: "contacted",
        notes: "sent by hand, no reply yet",
      },
      {
        date: "2026-11-27",
        channelId: "UC1",
        channel: "Build Ship and Post",
        stage: "replied",
        notes: "",
      },
    ]);
  });

  test("rejects a row with an unknown stage and names its line", () => {
    const csv = [HEADER, "2026-11-25,UC1,Build,maybe,"].join("\n");

    expect(() => parseOutcomes(csv)).toThrow('line 2: unknown stage "maybe"');
  });

  test("rejects a file whose header is not the expected columns", () => {
    expect(() => parseOutcomes("date,channel,stage\n")).toThrow(
      `expected the header "${HEADER}"`,
    );
  });
});

describe("summarizeOutcomes", () => {
  test("ignores EXAMPLE rows entirely", () => {
    expect(summarizeOutcomes([row("EXAMPLE", "signed")], new Map())).toEqual({
      examplesIgnored: 1,
      channels: 0,
      reached: [
        { stage: "contacted", channels: 0 },
        { stage: "replied", channels: 0 },
        { stage: "signed", channels: 0 },
        { stage: "first_referral", channels: 0 },
        { stage: "ten_a_month", channels: 0 },
      ],
      conversions: [
        { from: "contacted", to: "replied", rate: null },
        { from: "replied", to: "signed", rate: null },
        { from: "signed", to: "first_referral", rate: null },
        { from: "first_referral", to: "ten_a_month", rate: null },
      ],
      weakestStep: null,
      byTerm: [],
    });
  });

  test("counts each channel once, at its furthest stage and every stage before it, with conversions and the weakest step", () => {
    const rows = [
      row("A", "contacted"),
      row("A", "contacted"),
      row("A", "replied"),
      row("B", "contacted"),
      row("C", "signed"),
    ];
    const termByChannel = new Map([
      ["A" as ChannelId, "blotato"],
      ["B" as ChannelId, "blotato"],
    ]);

    expect(summarizeOutcomes(rows, termByChannel)).toEqual({
      examplesIgnored: 0,
      channels: 3,
      reached: [
        { stage: "contacted", channels: 3 },
        { stage: "replied", channels: 2 },
        { stage: "signed", channels: 1 },
        { stage: "first_referral", channels: 0 },
        { stage: "ten_a_month", channels: 0 },
      ],
      conversions: [
        { from: "contacted", to: "replied", rate: 2 / 3 },
        { from: "replied", to: "signed", rate: 1 / 2 },
        { from: "signed", to: "first_referral", rate: 0 },
        { from: "first_referral", to: "ten_a_month", rate: null },
      ],
      weakestStep: { from: "signed", to: "first_referral", rate: 0 },
      byTerm: [
        { term: "blotato", reached: counts(2, 1, 0, 0, 0) },
        { term: "unknown", reached: counts(1, 1, 1, 0, 0) },
      ],
    });
  });
});
