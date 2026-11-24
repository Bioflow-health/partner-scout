# Partner Scout: project rules

Partner Scout finds YouTube creators worth a personal partnership message and drafts that message for a human to approve. The goal behind it: recruit partners who each refer 10 new customers a month. Nothing is ever sent automatically.

## Pipeline

| Step      | What happens                                                                                                                                   | Where                                         |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| 1 Intake  | For each line in `config/search-terms.txt`, find videos from the last 30 days                                                                  | `src/youtube.ts`                              |
| 2 Clear   | Drop existing partners (`config/partners.csv`), hidden or zero subscriber counts, channels outside the size band, off-topic videos, duplicates | `src/filter.ts`                               |
| 3 Score   | Momentum = video views / channel subscribers, ranked highest first                                                                             | `src/score.ts`                                |
| 4 Draft   | A personal DM per creator that names their video (planned)                                                                                     | `.claude/skills/partner-dm-writer/`           |
| 5 Check   | A code gate, then a separate checker agent (planned)                                                                                           | `src/gate.ts`, `.claude/agents/dm-checker.md` |
| 6 Approve | A human marks each entry approve or skip (planned)                                                                                             | `out/shortlist-<date>.md`                     |
| 7 Learn   | A human logs replies, sign-ups and referrals; a summary shows what to tune (planned)                                                           | `config/outcomes.csv`, `npm run learn`        |

## Commands

- `npm run scout`: live run. Searches YouTube, saves the raw responses to `out/cache/<date>.json`, prints the ranked top 10.
- `npm run scout -- --cached`: re-scores the latest cache file. No API calls, no quota.
- `npm test`, `npm run typecheck`, `npm run lint`, `npm run format:check`: all must pass before a commit.

## Secrets and quota

- The code reads the key only from `process.env.YOUTUBE_API_KEY` and sends it in the `x-goog-api-key` header, never in a URL.
- Never print, log, write or commit the key. There is no `.env` file. Each user sets `YOUTUBE_API_KEY` in their own shell (see the README).
- Budget per live run: 5 search terms or fewer. A search costs 100 units; `videos.list` and `channels.list` cost 1 unit per 50 IDs. One run is about 510 units.
- Comparing pivots? Use `--cached` so every variant scores the same data.

## Coding rules (from SabrinaRamonov/ai-coding-rules)

- **BP-1** Ask clarifying questions before starting work.
- **C-1** Test-driven: stub, then a failing test, then the code.
- **C-3 / C-4 / C-9** Small, simple functions. No classes. Don't extract a function without a reason.
- **C-5** Branded types for IDs (`ChannelId`, `VideoId`).
- **C-6** `import type` for type-only imports (ESLint enforces it).
- **T-1** Colocated `*.spec.ts` files.
- **T-6 / T-9** Strong assertions on the whole structure.
- **G-1 / G-2** Prettier, typecheck and lint pass.
- **GH-1** Conventional Commits.
- **GH-2** Never mention Claude or Anthropic in commit messages. No co-author lines.

## Changing the scoring

Every pivot is one commit whose message says why, plus an entry in `PIVOTS.md`: objective, hypothesis, result, change.

## Neutrality

No partner, brand or personal names in code, config or docs, other than the search terms, the creator data the API returns, and attribution credits (authors, upstream repos and licenses).
