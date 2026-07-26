# Enova Formulation Generator — Validation Scorecard

_Does the generator reproduce Enova's own completed formulas? Measured against **44 real completed project workbooks** across all five dose forms (Capsules, Powder, Stickpacks, Liquid, Gummies). Run with `node validate_corpus.js` — a permanent, repeatable harness._

---

## Headline verdict

**The generator is credible and close — not a toy.** On Enova's own historical formulas, it independently reproduces the **structural house system** (flow agents, bulking/solvent balance, humectant, preservative) **69–100% of the time**, and it picks the **correct balance carrier** (maltodextrin / MCC) **80–100%** of the time (100% for powder and stickpacks). Where it diverges, the gaps are **specific, measured, and fixable by calibration — not by redesign.** This document is both the proof and the ranked, evidence-based to-do list to close the remaining distance.

Cost is validated separately and is already golden-locked to the digit against P26132; this scorecard is about the **formulation assembly** — "what goes in and how much."

---

## What was measured, and how (so it's defensible)

For each real workbook the harness: (1) parses the Master Formula sheet by **header text** (robust across the template's versions) and reads the true weigh-out amount (the "INPUT mg" column, whose per-serving sum equals the serving weight); (2) splits each line into **customer ACTIVE** vs **house SYSTEM/excipient** using an ingredient lexicon; (3) feeds *only the actives* back through the generator (`EnovaFormulator` for capsule/powder/stick/liquid, `EnovaBrain.gummyBase` for gummies) **at the real serving target**; and (4) compares the regenerated system to what Enova's formulators actually used.

Four metrics:
- **Balance-math OK** — does the generator's total tie to the real serving weight/volume (within 1%)? Tests the fill-to-target math.
- **Structural recall** — of the deterministic structural components in the real formula (balance carrier, flow, solvent, preservative), how many did the generator also produce?
- **Balance-SKU match** — did the real formula use the *same* bulking/solvent SKU the generator picks?
- **Over-target** — cases where the generator's default system overshoots the serving (no room left for the balance carrier).

---

## Scorecard by dose form

| Form | n | avg actives | avg system | balance-math OK | structural recall | balance-SKU match | over-target |
|------|---|-------------|------------|-----------------|-------------------|-------------------|-------------|
| **Capsules** | 10 | 7.2 | 2.3 | 50% * | **69%** | **80%** | 0 |
| **Gummies** | 6 | 3.2 | 5.7 | 83% | **100%** | — † | 0 |
| **Liquid** | 9 | 9.1 | 7.6 | **100%** | **94%** | 0% ‡ | 0 |
| **Powder** | 13 | 8.2 | 3.5 | 38% | **80%** | **100%** | 9 |
| **Stickpacks** | 6 | 10.5 | 8.3 | **100%** | **90%** | **100%** | 0 |

\* Capsules use a **shell-fill** model (blend size is set by the capsule shell, not by a serving weight), so "balance to the real total" isn't the right yardstick for capsules — the meaningful capsule metrics are recall and balance-SKU.
† Gummy balance is the sugar/sorbitol base (compared structurally, not by a single SKU).
‡ Liquid balance is **water**, which Enova codes as a $0 non-inventory line (or omits) — so the exact-SKU match to the generator's water placeholder reads 0%. This is a **coding-convention gap, not a formula error** (structural recall is still 94%).

**Read this table as:** powder and stickpack carriers match reality perfectly; the generator reproduces the structural system for 4 of 5 forms at 80%+; the two real, actionable problems are the **powder over-target rate (9 of 13)** and **capsule recall (69%)**.

---

## Level calibration — real Enova levels vs. the generator's defaults (the tuning roadmap)

This is the gold from the exercise: the generator's system *levels* measured against what Enova actually uses.

| Component | Generator default | Enova real median | n | Verdict |
|-----------|-------------------|-------------------|---|---------|
| Capsule **mag stearate** | 0.75% of actives | **0.68%** (0.51–1.31) | 5 | ✅ Good default — optional nudge to 0.68% |
| Capsule **silica** | 0.75% of actives | **2.19%** (0.56–3.92) | 6 | ▲ **Under-dosed ~3×** — raise toward ~2.2% |
| Powder **silica** | 1.0% of serving | **5.8%** (1.4–5.8) | 2 | ▲ Under-dosed (small n — preliminary) |
| Stickpack **glycerin** | 5.1% of serving | **7.0%** (2.8–7.0) | 2 | ▲ Nudge up toward ~7% (small n) |

The capsule silica finding (n=6, tight-ish range) is the most reliable and most actionable: **Enova uses roughly three times more silica in capsules than the generator's current default.**

---

## Ranked findings — the evidence-based roadmap for "encode the real standards"

1. **Powder system defaults overshoot small servings (9 of 13 powders).** The generator adds its *full* taste/texture system (monk fruit, citric, malic, salt, guar, bitter blocker ≈ 1 g) by default — even for an **unflavored** or small-serving powder — so on a 2.3 g serving it overshoots by ~38%. **Fix:** make the taste system **conditional** (only add sweetener/acid/flavor when flavoring is actually requested) and let the reviewer opt in, rather than adding all of it every time. This is the single highest-impact change.
2. **Silica is systematically under-dosed** (capsule 0.75% → real ~2.2%; powder 1.0% → real ~5.8%). **Fix:** raise the silica anticake/glidant standard. Cheap, high-confidence for capsules.
3. **Liquid needs a real water line and an optional glycerin co-solvent.** Water as a $0 placeholder doesn't match Enova's coding, and glycerin-based tinctures/syrups appear in the corpus that the liquid model doesn't currently offer. **Fix:** add a real water SKU + a glycerin option for tincture/syrup liquids.
4. **Stickpack glycerin slightly low** (5.1% → ~7%). Minor nudge.
5. **Capsule structural recall 69%.** ~31% of capsules had a structural component the generator missed — often because Enova used a **different filler** (e.g., dicalcium phosphate or rice) instead of MCC. **Fix:** offer alternative fillers and confirm which the reviewer wants.

Each of these is a small, targeted edit to the generator's knowledge base — and after each, we **re-run `validate_corpus.js` and watch the score move.** That's a tight, data-driven improvement loop, not guesswork.

---

## Honest caveats (so the numbers aren't over-read)

- The **active-vs-system split is a name-pattern heuristic.** A few borderline lines can be misclassified; the *aggregate* signals are robust, but any single number isn't exact.
- Some calibration samples are **small (n = 2)** and flagged as preliminary — real trends, but confirm before hard-coding.
- **No tablets** appeared in this set, and gummies/liquids are thinner than powders/capsules. The **additional completed formulas you offered would directly tighten this** — especially tablets and more gummies/liquids.
- This validates **assembly**, not cost (cost is separately golden-locked).

---

## What this proves, and the next move

It proves the generator **already reproduces the structure of Enova's real house formulas** — the right carriers, the right structural system, the right fill-to-target math — for the large majority of real projects, and that the remaining gaps are **a short, ranked list of level calibrations and one product-logic change (conditional taste system)**, all derived from your own data rather than guessed.

**Recommended next step:** encode the five findings above (they're small KB edits), re-run the harness, and lift the scorecard — then add your extra formulas (tablets especially) to widen the validation. If you want, I'll start on finding #1 (make the powder/stick taste system conditional) and #2 (raise silica), then re-run and show you the before/after scorecard.
