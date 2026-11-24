# Partner Scout

**Difficulty:** Intermediate (you need a YouTube Data API key)
**Time:** about 10 minutes to set up and run
**You'll use:** Claude Code, Node.js and the YouTube Data API

## What it does

Partner Scout finds YouTube creators worth a personal partnership message. Each run it:

1. Searches YouTube for videos from the last 30 days on your search terms.
2. Drops existing partners, off-topic videos and channels outside a subscriber band.
3. Ranks the rest by momentum: video views divided by channel subscribers.
4. Drafts a short, personal DM for each creator who fits.
5. Checks every draft twice: once with code, once with a separate AI checker.

The result is a shortlist file. A human reads it, approves or skips each draft, and sends the approved ones by hand. Nothing is ever sent automatically.

## Why

The goal is partners who can each bring in 10 new customers a month. Those are creators who already teach the workflows the product fits into, with an audience large enough to act on a recommendation. Partner Scout puts the best few in front of a human every day, each with a draft that names something specific from their video.

## Before you start

- Node.js 20.19 or newer
- Claude Code
- A YouTube Data API key. Google's guides: [Getting started with the YouTube Data API](https://developers.google.com/youtube/v3/getting-started) and [Setting up API keys](https://support.google.com/googleapi/answer/6158862).

## Step 1: Install

```bash
git clone <this repo's URL>
cd partner-scout
npm install
npm test
```

## Step 2: Set your API key

The code reads the key only from the `YOUTUBE_API_KEY` environment variable and sends it in a request header, never in a URL. Set it yourself, in your own shell:

```bash
export YOUTUBE_API_KEY=your-key-here
```

There's no `.env` file. Keep the key out of the repo.

A live run costs about 510 quota units: 100 per search term, plus a few units for video and channel details. Keep it to five search terms or fewer per run.

## Step 3: Choose your search terms

Edit `config/search-terms.txt`. Each line is `search phrase | topic keyword`. The API searches for the phrase. A video is kept only if its title or description names the topic keyword.

```text
claude code social media automation | claude code
n8n automation tutorial | n8n
```

Add your existing partners' channel IDs to `config/partners.csv` so they're never suggested again.

## Step 4: Run the scout

```bash
npm run scout
```

It prints the top 10 and writes three files to `out/` (which git ignores):

- `out/cache/<date>.json`: the raw API responses. A second run on the same day writes `<date>-2.json`, so nothing is overwritten.
- `out/candidates-<date>.json`: the top 10, for the writer.
- `out/shortlist-<date>.md`: the shortlist, which fills in as drafts are added.

To re-score saved data without any API calls or quota:

```bash
npm run scout -- --cached
npm run scout -- --cached out/cache/2026-11-24.json
```

## Step 5: Draft and check the DMs

Open Claude Code in this folder and ask it to use the `partner-dm-writer` skill on today's candidates. The skill:

1. Judges each creator's topic fit and skips the ones that don't fit, with a reason. Vendors demoing their own product are skipped too.
2. Drafts one DM per fit. Each one names the video, mentions one specific detail in neutral words, asks one question, and stays at 90 words or fewer. It doesn't praise the creator and doesn't pretend the sender watched the video. About Blotato it says only what `config/blotato-facts.txt` says, with at most one clause that applies it to the creator's own work.
3. Runs `npm run shortlist`, which applies the code gate to every draft.
4. Sends each draft that passed the gate to the `dm-checker` agent.
5. Revises a failed draft once. A second failure stays blocked for you.

**The code gate** (`src/gate.ts`) rejects a draft that has an em dash, runs over 90 words, uses a hype word from `config/banned-words.txt`, doesn't name the video, has more or fewer than one question mark, or matches an AI-writing tell from `config/ai-tells.txt`. It accepts the full video title or its core: the text before the first `|`, without emoji.

**The checker** (`.claude/agents/dm-checker.md`) runs on a smaller model with read-only access. It fails a draft for any AI-writing marker from the anti-slop-humanizer skill, any praise, any name, number or claim that isn't in the creator's video data or the Blotato facts file, or a "no" to one question: would a real person send this to a creator they respect, and does it read as written for this creator rather than as a template?

## Step 6: Approve, then send by hand

Open `out/shortlist-<date>.md`. For each ready draft, watch the video first, then tick approve or skip. Send the approved messages yourself and add the program terms.

## Step 7: Log outcomes and learn

Each time a creator reaches a stage, add a row to `config/outcomes.csv`:

```text
date,channel_id,channel,stage,notes
```

The stage is one of `contacted`, `replied`, `signed`, `first_referral` or `ten_a_month`. Rows with the channel ID `EXAMPLE` are ignored. Then run:

```bash
npm run learn
```

It prints how many channels reached each stage, the conversion from each stage to the next, the weakest step (tune that first), and the results for each search term. When a creator signs, add them to `config/partners.csv`.

## How it works

| File                                  | Job                                                     |
| ------------------------------------- | ------------------------------------------------------- |
| `src/youtube.ts`                      | Search, then video and channel details, through the API |
| `src/filter.ts`                       | Partners, subscriber band, topic keyword, duplicates    |
| `src/score.ts`                        | Momentum and ranking                                    |
| `.claude/skills/partner-dm-writer/`   | Fit judgment and drafts                                 |
| `src/gate.ts`                         | The code gate                                           |
| `.claude/agents/dm-checker.md`        | The checker agent                                       |
| `.claude/skills/anti-slop-humanizer/` | The AI-writing marker list the checker uses             |
| `src/shortlist.ts`                    | The approval shortlist                                  |
| `src/learn.ts`                        | The outcomes summary                                    |

## The pressure test

The first version didn't work, and the log says so. [`PIVOTS.md`](PIVOTS.md) sets an acceptance bar before any change: at least 5 of the top 10 must be channels a partner manager would actually message. Then it records every pivot as one commit, with the numbers.

| Version | Change                                               | Top 10 that pass the bar |
| ------- | ---------------------------------------------------- | ------------------------ |
| H1      | Momentum on a single recent video                    | 0                        |
| Pivot 1 | Match a topic keyword, not the whole search phrase   | 0                        |
| Pivot 2 | A 1K to 100K subscriber band                         | 1                        |
| Pivot 3 | Point two coding search phrases at content workflows | 4                        |

The bar of 5 isn't met yet. `PIVOTS.md` explains why and what to try next.

## Limits

- YouTube only.
- Nothing is ever sent. A human approves and sends every message.
- Momentum looks at one recent video per channel, which favors one-off hits.
- The 2,000-view screen for "could bring 10 customers a month" is a rough, optimistic proxy until the outcomes log has real numbers.
- A model judges fit and writes the drafts, and a smaller model checks them. Either can be wrong, so a human reads every draft.

## Next steps

- Point the n8n search phrase at content workflows too.
- Score creators on several videos: the median momentum over their last few, or two or more on-topic videos in 90 days.
- Test a higher subscriber cap than 100K.
- Run the scout daily as a scheduled routine.

## Checks

```bash
npm test
npm run typecheck
npm run lint
npm run format:check
```

The code was built test-first, following the coding rules in `.claude/CLAUDE.md`.

## Credits

- The AI-writing marker list in `.claude/skills/anti-slop-humanizer/` was checked against [blader/humanizer](https://github.com/blader/humanizer) (MIT license). See [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
- The coding rules come from SabrinaRamonov/ai-coding-rules, and this README follows the recipe format of SabrinaRamonov/learn-claude-code.
