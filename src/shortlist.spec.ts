import { describe, expect, test } from "vitest";
import { draftHash } from "./checks";
import type { CheckVerdict } from "./checks";
import { makeCandidate } from "./fixtures";
import type { GateResult } from "./gate";
import {
  buildRows,
  entryStatus,
  orphanedDrafts,
  renderShortlist,
  renderShortlistCsv,
} from "./shortlist";
import type { DraftEntry, ShortlistRow } from "./shortlist";
import type { ChannelId, VideoId } from "./types";

const gatePass: GateResult = { pass: true, failures: [] };
const gateFail: GateResult = {
  pass: false,
  failures: [{ rule: "em-dash", detail: "em dashes: 1" }],
};
const FIRST = "first draft";
const SECOND = "second draft";
const verdict = (draft: string, pass: boolean): CheckVerdict => ({
  videoId: "v1",
  draftSha256: draftHash(draft),
  pass,
  reason: "the checker's reason",
});
const fit = (...drafts: string[]): DraftEntry => ({
  videoId: "v1",
  fit: true,
  reason: "teaches a clipping workflow",
  attempts: drafts.map((draft) => ({ draft })),
});
const skip: DraftEntry = {
  videoId: "v1",
  fit: false,
  reason: "skip: a general coding tutorial",
  attempts: [],
};

describe("entryStatus", () => {
  test.each([
    {
      state: "no drafts entry",
      entry: undefined,
      gates: [],
      verdicts: [],
      expected: "pending-draft",
    },
    {
      state: "a skip",
      entry: skip,
      gates: [],
      verdicts: [],
      expected: "skipped",
    },
    {
      state: "a fit with no draft yet",
      entry: fit(),
      gates: [],
      verdicts: [],
      expected: "pending-draft",
    },
    {
      state: "a first draft that fails the gate",
      entry: fit(FIRST),
      gates: [gateFail],
      verdicts: [],
      expected: "pending-revision",
    },
    {
      state: "a first draft that passes the gate, not yet checked",
      entry: fit(FIRST),
      gates: [gatePass],
      verdicts: [],
      expected: "pending-checker",
    },
    {
      state: "a first draft the checker fails",
      entry: fit(FIRST),
      gates: [gatePass],
      verdicts: [verdict(FIRST, false)],
      expected: "pending-revision",
    },
    {
      state: "a first draft that passes both",
      entry: fit(FIRST),
      gates: [gatePass],
      verdicts: [verdict(FIRST, true)],
      expected: "ready",
    },
    {
      state: "a draft the checker passed but the gate now fails",
      entry: fit(FIRST),
      gates: [gateFail],
      verdicts: [verdict(FIRST, true)],
      expected: "pending-revision",
    },
    {
      state: "a draft edited after the checker passed it",
      entry: fit(`${FIRST} edited`),
      gates: [gatePass],
      verdicts: [verdict(FIRST, true)],
      expected: "needs-recheck",
    },
    {
      state: "a verdict for another video only",
      entry: fit(FIRST),
      gates: [gatePass],
      verdicts: [{ ...verdict(FIRST, true), videoId: "v2" }],
      expected: "pending-checker",
    },
    {
      state: "a revision not yet checked",
      entry: fit(FIRST, SECOND),
      gates: [gatePass, gatePass],
      verdicts: [verdict(FIRST, false)],
      expected: "pending-checker",
    },
    {
      state: "a revision that fails the gate",
      entry: fit(FIRST, SECOND),
      gates: [gatePass, gateFail],
      verdicts: [verdict(FIRST, false)],
      expected: "blocked",
    },
    {
      state: "a revision the checker passed but the gate now fails",
      entry: fit(FIRST, SECOND),
      gates: [gatePass, gateFail],
      verdicts: [verdict(FIRST, false), verdict(SECOND, true)],
      expected: "blocked",
    },
    {
      state: "a revision the checker fails",
      entry: fit(FIRST, SECOND),
      gates: [gatePass, gatePass],
      verdicts: [verdict(FIRST, false), verdict(SECOND, false)],
      expected: "blocked",
    },
    {
      state: "a revision that passes both",
      entry: fit(FIRST, SECOND),
      gates: [gatePass, gatePass],
      verdicts: [verdict(FIRST, false), verdict(SECOND, true)],
      expected: "ready",
    },
  ])("is $expected for $state", ({ entry, gates, verdicts, expected }) => {
    expect(entryStatus(entry, gates, verdicts)).toBe(expected);
  });
});

describe("orphanedDrafts", () => {
  test("lists drafted videos that are not in the new top 10, in draft order, once each", () => {
    expect(
      orphanedDrafts(["v3", "v1", "v9", "v3", "v7"], ["v1", "v2", "v3"]),
    ).toEqual(["v9", "v7"]);
  });

  test("returns nothing when every drafted video is still a candidate", () => {
    expect(orphanedDrafts(["v1", "v2"], ["v2", "v1", "v5"])).toEqual([]);
  });
});

const VIDEO_ID = "AAAAAAAAAAA" as VideoId;
const CHANNEL_ID = "UCaaaaaaaaaaaaaaaaaaaaaa" as ChannelId;

const row = (
  overrides: Partial<ShortlistRow> & { candidateFields?: object } = {},
): ShortlistRow => {
  const { candidateFields = {}, ...rest } = overrides;
  return {
    rank: 1,
    candidate: {
      ...makeCandidate("a", {
        videoId: VIDEO_ID,
        channelId: CHANNEL_ID,
        channelTitle: "Build Lab",
        videoTitle: "Clip streams live",
        views: 5_000,
        subscribers: 1_000,
        searchTerm: "claude code social media automation",
        ...candidateFields,
      }),
      momentum: 5,
    },
    entry: undefined,
    gates: [],
    verdicts: [],
    ...rest,
  };
};

const READY_DRAFT =
  'Hi, in "Clip streams live", one skill clips a stream while it is live.';
const readyEntry: DraftEntry = {
  videoId: VIDEO_ID,
  fit: true,
  reason: "teaches clipping",
  attempts: [{ draft: READY_DRAFT }],
};
const passFor = (draft: string): CheckVerdict => ({
  videoId: VIDEO_ID,
  draftSha256: draftHash(draft),
  pass: true,
  reason: "grounded",
});
const failFor = (draft: string): CheckVerdict => ({
  ...passFor(draft),
  pass: false,
  reason: "rule 5: praise",
});
const linesOf = (rows: ShortlistRow[]) =>
  renderShortlist(
    "r1",
    "cache out/cache/x.json (0 new quota units)",
    rows,
  ).split("\n");

describe("renderShortlist", () => {
  test("renders a ready row in full, with links built from its IDs", () => {
    expect(
      renderShortlist("r1", "cache out/cache/x.json (0 new quota units)", [
        row({
          entry: readyEntry,
          gates: [gatePass],
          verdicts: [passFor(READY_DRAFT)],
        }),
      ]),
    ).toBe(
      [
        "# Partner shortlist, r1",
        "",
        "Source: cache out/cache/x.json (0 new quota units).",
        "",
        "Watch the video before approving. A human sends every message.",
        "",
        "Nothing here has been sent. Tick approve or skip for each ready draft, and add the program terms before sending.",
        "",
        "Status: ready 1",
        "",
        "---",
        "",
        "## 1. Build Lab",
        "",
        "- Channel: Build Lab, <https://www.youtube.com/channel/UCaaaaaaaaaaaaaaaaaaaaaa>",
        "- Video: Clip streams live, <https://youtu.be/AAAAAAAAAAA>",
        "- Momentum: 5.00 = 5,000 views / 1,000 subscribers (term: claude code social media automation)",
        "- Fit: yes. teaches clipping",
        "",
        "**Draft**",
        "",
        `> ${READY_DRAFT}`,
        "",
        "- Code gate: pass",
        "- Checker: pass. grounded",
        "",
        "**Decision:** [ ] approve [ ] skip",
        "",
      ].join("\n"),
    );
  });

  test("escapes a spoofed title and channel name, and gives no link for IDs that are not YouTube IDs", () => {
    const lines = linesOf([
      row({
        candidateFields: {
          videoId: "bad id!!",
          channelId: "not-a-channel",
          channelTitle: "Evil*Co\nInjected",
          videoTitle: "Foo](https://evil.example) x",
        },
      }),
    ]);

    expect(
      lines.filter((line) => /^(## |- Channel|- Video)/.test(line)),
    ).toEqual([
      "## 1. Evil\\*Co Injected",
      "- Channel: Evil\\*Co Injected, (no link: unexpected channel ID)",
      "- Video: Foo\\]\\(https://evil.example\\) x, (no link: unexpected video ID)",
    ]);
  });

  test("collapses and escapes a checker reason, so it cannot add a decision line", () => {
    const verdict = {
      ...failFor(READY_DRAFT),
      reason: "fails\n\n**Decision:** [ ] approve [ ] skip",
    };
    const lines = linesOf([
      row({ entry: readyEntry, gates: [gatePass], verdicts: [verdict] }),
    ]);

    expect([
      lines.filter((line) => line.startsWith("**Decision:**")),
      lines.filter((line) => line.startsWith("- Checker:")),
    ]).toEqual([
      ["**Decision:** waiting for the writer's one revision"],
      [
        "- Checker: fail. fails \\*\\*Decision:\\*\\* \\[ \\] approve \\[ \\] skip",
      ],
    ]);
  });

  test("puts an approve box only on ready rows, and counts every status", () => {
    const second = "second draft";
    const lines = linesOf([
      row({
        entry: readyEntry,
        gates: [gatePass],
        verdicts: [passFor(READY_DRAFT)],
      }),
      row({
        entry: {
          ...readyEntry,
          fit: false,
          reason: "skip: vendor channel",
          attempts: [],
        },
      }),
      row({
        entry: {
          ...readyEntry,
          attempts: [{ draft: READY_DRAFT }, { draft: second }],
        },
        gates: [gatePass, gateFail],
        verdicts: [failFor(READY_DRAFT)],
      }),
      row({ entry: readyEntry, gates: [gatePass] }),
      row({
        entry: readyEntry,
        gates: [gatePass],
        verdicts: [passFor("an older text")],
      }),
      row({ entry: readyEntry, gates: [gateFail] }),
    ]);

    expect([
      lines.filter((line) => line.includes("[ ] approve")).length,
      lines.find((line) => line.startsWith("Status:")),
    ]).toEqual([
      1,
      "Status: ready 1 | skipped 1 | blocked 1 | pending-checker 1 | needs-recheck 1 | pending-revision 1",
    ]);
  });

  test("shows a checker pass next to a gate failure as waiting for the revision", () => {
    const lines = linesOf([
      row({
        entry: readyEntry,
        gates: [gateFail],
        verdicts: [passFor(READY_DRAFT)],
      }),
    ]);

    expect(
      lines.filter((line) =>
        /^(- Code gate|- Checker|\*\*Decision)/.test(line),
      ),
    ).toEqual([
      "- Code gate: fail (em-dash: em dashes: 1)",
      "- Checker: pass. grounded",
      "**Decision:** waiting for the writer's one revision",
    ]);
  });

  test("shows a skip reason without a doubled skip prefix", () => {
    const lines = linesOf([
      row({
        entry: {
          ...readyEntry,
          fit: false,
          reason: "skip: vendor channel",
          attempts: [],
        },
      }),
    ]);

    expect(lines.filter((line) => line.startsWith("- Fit:"))).toEqual([
      "- Fit: skip. vendor channel",
    ]);
  });

  test("quotes every line of a multi-line draft", () => {
    const draft = "Line one.\nLine two.";
    const rendered = renderShortlist("r1", "s", [
      row({
        entry: { ...readyEntry, attempts: [{ draft }] },
        gates: [gatePass],
      }),
    ]);

    expect(rendered).toContain("\n> Line one.\n> Line two.\n");
  });

  test("pairs each earlier attempt with its own gate result and verdict", () => {
    const second = "second draft";
    const lines = linesOf([
      row({
        entry: {
          ...readyEntry,
          attempts: [{ draft: READY_DRAFT }, { draft: second }],
        },
        gates: [gateFail, gatePass],
        verdicts: [failFor(READY_DRAFT), passFor(second)],
      }),
    ]);

    expect(
      lines.filter((line) =>
        /^(\*\*Draft|\*\*Earlier|- Code gate|- Checker)/.test(line),
      ),
    ).toEqual([
      "**Draft (revised once)**",
      "- Code gate: pass",
      "- Checker: pass. grounded",
      "**Earlier attempt 1, sent back to the writer**",
      "- Code gate: fail (em-dash: em dashes: 1)",
      "- Checker: fail. rule 5: praise",
    ]);
  });
});

describe("renderShortlistCsv", () => {
  const HEADER =
    "rank,status,channel,channel_id,channel_url,video_title,video_url,subscribers,views,momentum,search_term,fit,fit_reason,draft,checker_result,attempts,decision";
  const CHANNEL_CELLS = `Build Lab,${CHANNEL_ID},https://www.youtube.com/channel/${CHANNEL_ID}`;
  const VIDEO_URL = `https://youtu.be/${VIDEO_ID}`;
  const NUMBER_CELLS = "1000,5000,5.00,claude code social media automation";
  const skipped = (rank: number, videoTitle = "Clip streams live") =>
    row({
      rank,
      candidateFields: { videoTitle },
      entry: { ...skip, videoId: VIDEO_ID },
    });

  test("writes a header and one row per candidate in shortlist order, with the draft only on ready rows", () => {
    const multiLine =
      'Hi, in "Clip streams live", one skill clips a stream.\nWould you be open to hearing about Blotato\'s partner program?';
    const pendingEntry: DraftEntry = {
      videoId: VIDEO_ID,
      fit: true,
      reason: "teaches posting",
      attempts: [{ draft: "an unchecked draft" }],
    };

    expect(
      renderShortlistCsv([
        row({
          entry: { ...readyEntry, attempts: [{ draft: multiLine }] },
          gates: [gatePass],
          verdicts: [passFor(multiLine)],
        }),
        row({ rank: 2, entry: pendingEntry, gates: [gatePass] }),
        skipped(3),
      ]),
    ).toBe(
      [
        `\uFEFF${HEADER}`,
        `1,ready,${CHANNEL_CELLS},Clip streams live,${VIDEO_URL},${NUMBER_CELLS},yes,teaches clipping,"Hi, in ""Clip streams live"", one skill clips a stream.\nWould you be open to hearing about Blotato's partner program?",pass. grounded,1,`,
        `2,pending-checker,${CHANNEL_CELLS},Clip streams live,${VIDEO_URL},${NUMBER_CELLS},yes,teaches posting,,not run yet,1,`,
        `3,skipped,${CHANNEL_CELLS},Clip streams live,${VIDEO_URL},${NUMBER_CELLS},no,a general coding tutorial,,,0,`,
        "",
      ].join("\r\n"),
    );
  });

  test.each([
    {
      label: 'a title starting with "=HYPERLINK(" is defused',
      title: '=HYPERLINK("https://example.test","click")',
      cell: '"\'=HYPERLINK(""https://example.test"",""click"")"',
    },
    {
      label: 'a title starting with "+" is defused',
      title: "+5 hooks for Reels",
      cell: "'+5 hooks for Reels",
    },
    {
      label: "a title with a comma and quotes is quoted",
      title: 'Hooks, formats and the "live" skill',
      cell: '"Hooks, formats and the ""live"" skill"',
    },
    {
      label: "a title with an emoji is kept as it is",
      title: "🔥 Clip streams live",
      cell: "🔥 Clip streams live",
    },
  ])("$label", ({ title, cell }) => {
    expect(renderShortlistCsv([skipped(1, title)]).split("\r\n")[1]).toBe(
      `1,skipped,${CHANNEL_CELLS},${cell},${VIDEO_URL},${NUMBER_CELLS},no,a general coding tutorial,,,0,`,
    );
  });
});

describe("buildRows", () => {
  const gateConfig = { bannedWords: ["epic"], aiTells: [] };
  const first =
    'Hi, in "Clip streams live", one skill clips a stream. That was epic. Would you be open to hearing about the partner program?';
  const second =
    'Hi, in "Clip streams live", one skill clips a stream. Would you be open to hearing about the partner program?';

  test("ranks candidates, matches their drafts, gates every attempt in order, and keeps only their own verdicts", () => {
    const withDrafts = row().candidate;
    const without = {
      ...row({ candidateFields: { videoId: "BBBBBBBBBBB" as VideoId } })
        .candidate,
    };
    const entry: DraftEntry = {
      ...readyEntry,
      attempts: [{ draft: first }, { draft: second }],
    };
    const ownVerdict = passFor(second);
    const otherVerdict = { ...passFor(second), videoId: "BBBBBBBBBBB" };

    expect(
      buildRows(
        [withDrafts, without],
        [entry],
        [ownVerdict, otherVerdict],
        gateConfig,
      ),
    ).toEqual([
      {
        rank: 1,
        candidate: withDrafts,
        entry,
        gates: [
          {
            pass: false,
            failures: [{ rule: "banned-word", detail: '"epic"' }],
          },
          { pass: true, failures: [] },
        ],
        verdicts: [ownVerdict],
      },
      {
        rank: 2,
        candidate: without,
        entry: undefined,
        gates: [],
        verdicts: [otherVerdict],
      },
    ]);
  });
});
