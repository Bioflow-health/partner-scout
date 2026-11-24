# 29 AI-Writing Markers

Sources:

- `blader/humanizer` (MIT license) — README self-versioned 2.5.1. Checked against blader/humanizer@a32f244 (2026-11-19). License notice: `THIRD_PARTY_NOTICES.md` at the repo root.
- Wikipedia: "Signs of AI Writing" — secondary consolidation.

Each marker below has: description + example.

1. **Inflated symbolism** — trivial events described as "profound" / "transformative".
   - ex: "This simple function marks a pivotal moment in our architecture."
2. **AI vocabulary crutches** — overuse of: _realm, facet, embark, journey, tapestry, landscape, navigate, delve_.
   - ex: "Let us delve into the realm of testing."
3. **Em-dash overuse** — more than 1 em-dash per 200 words.
4. **Title-case headings** — Capitalizing Every Major Word in running subheads (not house-style-correct).
5. **Chatbot system-prompt leak** — phrases like "As an AI language model", "I cannot", "my training".
6. **Knowledge-cutoff disclaimers** — "As of my last update…", "Up to my knowledge cutoff…".
7. **Rule-of-three forcing** — contrived triplets: "fast, reliable, and scalable" when two would do.
8. **Negative parallelisms** — "not just X, but Y" pattern repeated.
9. **-ing superficial analyses** — "Examining this, we find…", "Looking at the data, we see…".
10. **Vague attributions** — "many believe", "experts agree", "it is often said".
11. **Sycophantic openers** — "Great question!", "That's a fascinating point!".
12. **Filler phrases** — "it's worth noting", "it's important to mention", "needless to say".
13. **Excessive hedging** — "perhaps", "somewhat", "arguably" stacked.
14. **Generic conclusions** — "In conclusion", "To summarize", "Ultimately".
15. **Notability name-dropping** — citing famous names without evidentiary purpose.
16. **Passive-voice drift** — "mistakes were made", "it was decided".
17. **Subjectless fragments** — "Leading to improved outcomes."
18. **Bullet-list bloat** — every paragraph converted to bullets even when prose fits.
19. **Parallel sentence structure overuse** — 3+ consecutive sentences with identical syntax.
20. **Hedge-then-assert** — "While some argue X, it is clear that Y."
21. **Transitional stacking** — "Furthermore,", "Moreover,", "Additionally," in sequence.
22. **Weasel adverbs** — "essentially", "basically", "fundamentally" as filler.
23. **Generic superlatives** — "unparalleled", "unprecedented", "game-changing".
24. **Meta-commentary** — "In this section, we will explore…".
25. **False precision** — "approximately 47.3%" when source says "about half".
26. **Scope-creep qualifiers** — "in many cases", "under certain conditions" without specifics.
27. **Over-structured lists** — nested sub-bullets deeper than 2 levels.
28. **Formal-tone drift** — academic register in casual contexts.
29. **Closing platitudes** — "The possibilities are endless", "Only time will tell".

## Threshold

`pass_threshold = 3`. More than 3 distinct markers → REVISE verdict.
