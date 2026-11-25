# Pivots

The pressure-test log. Each entry: objective, hypothesis, result, change. Each pivot is one commit whose message says why.

Unless an entry says otherwise, every result below scores the same data: `out/cache/2026-11-24.json` (one live run, 509 quota units), replayed with `npm run scout:cached out/cache/2026-11-24.json` (the command was `npm run scout -- --cached` when these runs were made). To reproduce entries 1 to 3 exactly, use `config/search-terms.txt` as of commit `460c5fd`. Pivot 3 retired two of those phrases, and a phrase missing from the config falls back to the whole-phrase rule.

## 0. The acceptance bar (set before any pivot)

**Objective (from the posting):** recruit partners who each refer 10 new customers a month.

**Bar:** at least 5 of the top 10 are channels a partner manager would actually message: 1K–100K subscribers, on-topic tutorials for Blotato workflows, plausibly 10 referred customers a month.

**How each entry is judged.** All three checks must hold. They are fixed here, before any pivot, so later results can't move the goalposts.

1. **Size:** 1,000 to 100,000 subscribers.
2. **On-topic tutorial:** the found video is a how-to or walkthrough (not news, a reaction or an ad). Its subject is creating, repurposing, scheduling or automating social or marketing content, or building that kind of workflow with the tools Blotato plugs into (n8n, Make, Claude, MCP). A general coding tutorial doesn't count.
3. **Plausibly 10 referrals a month:** the found video has at least 2,000 views. This is a low-confidence proxy. It assumes about 2% of viewers click a partner link and about 25% of those sign up, so 10 customers takes roughly 2,000 views of relevant content a month. The outcomes log will replace this guess with real numbers.

> **Note added after the pivot 3 review (no results re-scored):** the 2,000-view proxy is optimistic, and it stays as the v1 screen. Conservative assumptions (1% of viewers click, 10% of those pay) imply about 10,000 views a month for 10 customers. The outcomes log replaces both estimates with measured rates.

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

## 2. Pivot 1: match a topic keyword, not the whole search phrase

**Hypothesis:** the verbatim-phrase rule caused the 94 drops, not the creators. Matching one topic keyword per search term keeps real creators and still drops off-topic videos.

**Change:** `config/search-terms.txt` now holds `search phrase | topic keyword`. A video is kept if its title or description names the keyword (whole words, in order, any case). The search phrase sent to the API is unchanged.

**Result (same 250 videos):**

- Off-topic drops fell from 155 to 26. Videos from 1K+ channels dropped as off-topic fell from 94 to 20 (of 141).
- Kept channels rose from 55 to 158: 84 have 1K+ subscribers (46 between 1K and 100K, 38 above 100K) and 74 have fewer than 1K.
- Duplicates rose from 34 to 60, because more channels now have two or more eligible videos. The most-viewed one is kept.
- 17 of the 20 remaining 1K+ off-topic drops come from "social media automation", whose keyword is the whole phrase. The other 3 come from "claude code tutorial".
- **The top 10 still fails, 0 of 10.** All ten have 50 or fewer subscribers, and #1 is unchanged (4 subscribers, momentum 305). Fixing the filter put real creators back in the pool, but views / subscribers still ranks the tiniest channels first.

**Change:** pivot 2, the size band.

## 3. Pivot 2: a 1K–100K subscriber band

**Hypothesis:** with real creators back in the pool, a subscriber band stops one viral video on a tiny channel from topping the list. The top 10 then becomes channels worth messaging.

**Change:** the scout uses `PARTNER_BAND` (1,000 to 100,000 subscribers, edges included) instead of no limit.

**Result (same 250 videos):** 46 channels kept, and 164 videos dropped as outside the band. **Fails the bar, 1 of 10.**

| #   | Channel                      | Subscribers | Views   | Size | On-topic tutorial                                                                                                             | 2,000+ views | Verdict |
| --- | ---------------------------- | ----------- | ------- | ---- | ----------------------------------------------------------------------------------------------------------------------------- | ------------ | ------- |
| 1   | AI Hub for Students (Telugu) | 4,470       | 70,940  | yes  | borderline yes: an n8n course whose projects include a LinkedIn auto-post scheduler and a LinkedIn and YouTube content engine | yes          | pass    |
| 2   | Nick Automates               | 66,400      | 175,054 | yes  | no: a list of AI plugins, not a content workflow                                                                              | yes          | fail    |
| 3   | AI Career Lab                | 8,770       | 18,294  | yes  | no: an MCP coding project (task manager)                                                                                      | yes          | fail    |
| 4   | Matteo AI                    | 11,100      | 21,870  | yes  | no: vibe-coding a business app                                                                                                | yes          | fail    |
| 5   | Aaghaz                       | 25,700      | 43,071  | yes  | no: n8n product news. The channel itself sells social content automation, so it's worth a manual look                         | yes          | fail    |
| 6   | Easy AI Coding               | 11,100      | 18,347  | yes  | no: building a task app                                                                                                       | yes          | fail    |
| 7   | Tony Lotis                   | 12,400      | 18,758  | yes  | no: a general first AI agent (French)                                                                                         | yes          | fail    |
| 8   | AI with Thiru                | 55,800      | 78,460  | yes  | no: running a coding agent for free with local models                                                                         | yes          | fail    |
| 9   | ReachMora                    | 73,000      | 86,444  | yes  | no: using a coding agent for free                                                                                             | yes          | fail    |
| 10  | Zinho Automates              | 87,900      | 91,111  | yes  | no: web design with a coding agent                                                                                            | yes          | fail    |

- Size and reach now hold for all ten. Topic is what fails: 8 of the ten come from "claude code tutorial" (7) and "mcp server tutorial" (1), and those phrases bring back general coding tutorials.
- Re-ranking can't fix it. Of the 46 channels in the band, only 2 videos pass all three checks: #1 above, and a French video on editing with an AI agent and publishing everywhere with Blotato (2,246 views, 41,800 subscribers, ranked #28). Most on-topic content videos are small. "Hermes Agent Creates & Posts My Reels Automatically!" has 1,423 views on 11,300 subscribers and ranks #24.
- So the limit is the intake: what the search phrases bring back, not how the scout ranks it.

**Change:** pivot 3, one intake change.

## 4. Pivot 3: retarget the two coding phrases at content workflows

**Hypothesis:** the coding phrases, not the ranking, filled the list with coding tutorials. Pointing those two phrases at content workflows, with the same topic keywords, brings back creators who teach the workflows Blotato serves.

**Change:** `claude code tutorial` became `claude code social media automation | claude code`, and `mcp server tutorial` became `mcp social media posting | mcp`. The other three terms are unchanged.

**Run:** one new live run of **509 quota units** (5 searches at 100 units each, 5 videos.list pages and 4 channels.list pages). It's saved to `out/cache/2026-11-24-2.json`, and the baseline cache is kept. These are new videos, so this result doesn't share data with entries 1 to 3.

**Result:** 250 videos found, 28 channels kept, 176 videos dropped as outside the band. **Fails the bar, 4 of 10 (two of the four are borderline).**

| #   | Channel                      | Subscribers | Views   | Size | On-topic tutorial                                                                              | 2,000+ views | Verdict |
| --- | ---------------------------- | ----------- | ------- | ---- | ---------------------------------------------------------------------------------------------- | ------------ | ------- |
| 1   | Ashton Voss                  | 3,280       | 110,187 | yes  | yes: auto-clips streams into vertical clips for TikTok, Reels and Shorts with agent skills     | yes          | pass    |
| 2   | George Clicks                | 11,000      | 219,949 | yes  | borderline yes: how to build a faceless YouTube channel with an AI agent, told as a case study | yes          | pass    |
| 3   | AI Hub for Students (Telugu) | 4,480       | 71,099  | yes  | borderline yes: the same n8n course as in pivot 2                                              | yes          | pass    |
| 4   | Jacksons AI                  | 76,500      | 237,047 | yes  | yes: a tutorial on making viral 3D animation videos with AI                                    | yes          | pass    |
| 5   | Nick Automates               | 66,400      | 175,295 | yes  | no: a list of AI plugins                                                                       | yes          | fail    |
| 6   | Zinho Automates              | 87,900      | 46,116  | yes  | no: building and deploying an app                                                              | yes          | fail    |
| 7   | Manish Digital Academy       | 41,700      | 18,295  | yes  | no: a WhatsApp reply and lead-capture bot, not content                                         | yes          | fail    |
| 8   | Favikon                      | 1,260       | 286     | yes  | yes: writing LinkedIn posts from real post data over MCP                                       | no           | fail    |
| 9   | SaasTuto SaaS & WP vids      | 7,800       | 1,532   | yes  | no: installing n8n on a server                                                                 | no           | fail    |
| 10  | Coding Dialect               | 2,600       | 333     | yes  | no: a short explainer                                                                          | no           | fail    |

- The retargeting worked where it was applied. "claude code social media automation" supplied 3 of the 4 passes (#1, #2, #4). In pivot 2, "claude code tutorial" supplied none.
- "mcp social media posting" finds on-topic videos, but small ones. Its best is #8, with 286 views.
- "n8n automation tutorial" wasn't changed, and it fills 4 of the ten with general n8n courses. Only 1 of them passes.
- "blotato" is the most on-topic term. It kept 9 channels, but none ranks above #11, because their videos have few views next to their subscriber counts and momentum on a single video ranks them down.
- Kept channels fell from 46 to 28, because the new phrases pull in bigger channels: 176 of 250 videos fall outside the band.

**Change:** none. The pressure test stops after pivot 3, as planned.

## Where it stands

**The bar is not met.** The best list is pivot 3's, with 4 of 10. Across H1 and the three pivots, the count went 0, 0, 1, then 4 of 10.

What the evidence points to next (not done):

1. Retarget "n8n automation tutorial" at content workflows, the same way pivot 3 retargeted the other two phrases. It now supplies 4 of the ten and only 1 pass.
2. Score a creator on more than one video: the median momentum over their last N videos, or 2+ on-topic videos in 90 days. That would lift consistent on-topic creators like the "blotato" results, which single-video momentum ranks low.
3. Test a higher subscriber cap. The 100K cap drops many of the creators pivot 1 recovered: after pivot 1, 38 of the 84 kept channels with 1K+ subscribers were above 100K.

**Worth a manual look (for the outcomes log):**

- **Aaghaz** (25,700 subscribers). The channel sells social content automation. The found video was n8n news, so it failed the topic check. https://youtu.be/iQIrOBjp52c
- **Dr. Firas** (41,800 subscribers). A French video on editing with an AI agent and publishing everywhere with Blotato, with 2,246 views. It ranked #28 in pivot 2. https://youtu.be/vhEC7rFPjJk

## Drafting notes

- After the P4 review, the writer skips vendor or company channels demoing their own product (`skip: vendor channel`). This is a drafting rule only: the bar and every score above are unchanged.
