---
name: anti-slop-humanizer
description: "The list of 29 AI-writing markers the dm-checker agent scans every DM draft for. Detection only, no rewrites."
---

# Anti-slop humanizer

A reference list, not a scorer. The `dm-checker` agent reads [references/markers-29.md](references/markers-29.md) and fails any DM draft that contains one of the markers. Words inside the quoted video title are exempt (rule 2 in `config/dm-rules.md`). The skill never rewrites a draft.

The list was checked against blader/humanizer (MIT license); the notice is in `THIRD_PARTY_NOTICES.md` at the repo root. When models change, refresh the list from that project and Wikipedia's "Signs of AI writing", and record the commit you checked against.
