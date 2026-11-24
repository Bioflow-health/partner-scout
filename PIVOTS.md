# Pivots

The pressure-test log. Each entry: objective, hypothesis, result, change. Each pivot is one commit whose message says why.

Unless an entry says otherwise, every result below scores the same data: `out/cache/2026-11-24.json` (one live run, 509 quota units), replayed with `npm run scout -- --cached`.

## 0. The acceptance bar (set before any pivot)

**Objective (from the posting):** recruit partners who each refer 10 new customers a month.

**Bar:** at least 5 of the top 10 are channels a partner manager would actually message: 1K–100K subscribers, on-topic tutorials for Blotato workflows, plausibly 10 referred customers a month.

**How each entry is judged.** All three checks must hold. They are fixed here, before any pivot, so later results can't move the goalposts.

1. **Size:** 1,000 to 100,000 subscribers.
2. **On-topic tutorial:** the found video is a how-to or walkthrough (not news, a reaction or an ad). Its subject is creating, repurposing, scheduling or automating social or marketing content, or building that kind of workflow with the tools Blotato plugs into (n8n, Make, Claude, MCP). A general coding tutorial doesn't count.
3. **Plausibly 10 referrals a month:** the found video has at least 2,000 views. This is a low-confidence proxy. It assumes about 2% of viewers click a partner link and about 25% of those sign up, so 10 customers takes roughly 2,000 views of relevant content a month. The outcomes log will replace this guess with real numbers.

## 1. H1: momentum on a single recent video

**Hypothesis:** momentum on one recent video (views / subscribers, published in the last 30 days) finds good partner candidates.

**Test:** 5 search terms, 250 videos from 180 channels. 96 of those channels have 1K+ subscribers.

**Result: fails the bar, 0 of 10.**

- 8 of the top 10 have 7 or fewer subscribers, and the largest has 66. None passes check 1.
- #1 is 1,220 views on a 4-subscriber channel, so momentum is 305.
- The bigger problem is upstream of the score. 155 of 250 videos were dropped as off-topic, including 94 of the 141 videos from channels with 1K+ subscribers. The rule demands the whole search phrase verbatim, so "Claude Code: Build Your First AI Agent in 20 Minutes (100% No Coding)" (153K subscribers) fails "claude code tutorial" because it never says "tutorial".
- Videos from 1K+ channels kept, by term: claude code tutorial 6 of 50, mcp server tutorial 0 of 22, n8n automation tutorial 1 of 13, social media automation 5 of 23, blotato 12 of 33.
- With most real creators filtered out, views / subscribers rewards the tiniest channels.

**Change:** pivot 1 fixes the off-topic rule. Pivot 2 adds the size band.
