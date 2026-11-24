# anti-slop-humanizer — Overview

Detection-only AI-writing marker scanner. No rewrites.

## What it does

1. Scans draft text for **29 AI-writing markers** (see [references/markers-29.md](references/markers-29.md)).
2. Emits JSON verdict: `PASS` / `REVISE` / `ESCALATE`.
3. Computes `voice_preservation_score` when a prior version is supplied.

## Why detection-only

Rewrites change voice. This skill surfaces issues; the human (or the dm-checker agent) decides how to address them. A rewriter pretending to preserve voice is worse than silence.

## Marker list (summary)

29 markers across 4 categories:

- **Lexical** (crutch words, em-dash overuse, title-case).
- **Structural** (rule-of-three, parallelism overuse, bullet bloat).
- **Rhetorical** (hedging, sycophancy, filler).
- **Disclosure** (chatbot artifacts, knowledge-cutoff leaks).

Threshold: more than 3 distinct markers → `REVISE`.

## Quarterly Refresh

AI writing styles drift. Maintainers should refresh the marker list every quarter from:

- `blader/humanizer` (pin commit SHA at refresh time).
- Wikipedia "Signs of AI Writing".

Update `references/markers-29.md` and note refresh date.

## Human Override

Per-project whitelist: append marker names to `.humanizer-whitelist` at project root. Whitelisted markers are excluded from the count. Use sparingly — whitelisting is a voice decision, not a bypass.

## Invoked By

- The dm-checker agent (`.claude/agents/dm-checker.md`).
