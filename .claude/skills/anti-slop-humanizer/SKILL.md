---
name: anti-slop-humanizer
description: "Detects 29 AI-writing markers. Detection only, no rewrites."
user-invocable: true
metadata:
  capabilities: ai-marker-detection, voice-preservation-scoring
  triggers: AI slop, em-dash overuse, sounds like AI, humanize, anti-slop, voice check
  domain: universal
---

# Anti-Slop Humanizer

Detection-only. Does NOT rewrite. Called by the dm-checker agent.

## Input

A Markdown or plain-text draft + (optional) prior version for voice comparison.

## Output contract

```json
{
  "markers_detected": ["em-dash-overuse", "rule-of-three", "..."],
  "total_markers": 0,
  "pass_threshold": 3,
  "voice_preservation_score": 0.0,
  "verdict": "PASS" | "REVISE" | "ESCALATE"
}
```

## Verdict logic

- `total_markers <= pass_threshold (3)` → `PASS`
- `total_markers <= 8` → `REVISE`
- else → `ESCALATE`

`voice_preservation_score` (0.0–1.0) compares vivid-language n-grams between versions when prior version supplied; `1.0` when first pass.

## References

- [references/markers-29.md](references/markers-29.md) — 29-marker enumerated list (blader/humanizer MIT + Wikipedia).

## Quarterly refresh

Markers list drifts as models evolve. Refresh quarterly from primary sources. Human override: any marker can be whitelisted per-project by appending to `.humanizer-whitelist`.
