# DEF-001-DECISION-BRIEF

> **⚠ DECISION MADE**: This brief's neutral analysis informed the final decision. Both studies were standardized on **Convention B (Forward NOI Cap)**. See `FINAL_CLOSURE_SUMMARY.md` for the execution record. This brief is retained as historical decision-support documentation.
STATUS: AWAITING HUMAN PRODUCT DECISION. No code has been changed as a result of this document.

## The question
Both study engines calculate an exit-year sale/completion value by capitalizing a forecast NOI. They currently use two different, both legitimate, real-world valuation conventions for the final year's NOI figure used in that capitalization:

**Convention A — "Direct Cap" (currently used by Existing Building)**
`saleValue = noiYear / marketCapRate`
The NOI already realized in the exit year (after applying `rentGrowthRate` for `holdPeriod-1` compounding steps) is capitalized directly, with no further growth step.

**Convention B — "Forward NOI Cap" (currently used by Land Development)**
`exitValue = (noiYear * (1 + rentGrowthRate)) / exitCapRate`
The exit-year NOI is grown one additional year forward before capitalization, reflecting the NOI a *buyer* would expect to receive in the first year *after* acquiring the asset at exit.

Both conventions appear in real-world commercial real estate valuation practice under different names ("in-place cap" vs. "forward cap" / "year-1 forward NOI"). Neither is inherently more correct in the abstract — the choice depends on the specific valuation methodology the business intends to standardize on, and possibly on what convention third-party appraisers or lenders in the target market expect.

## Why this was flagged as a defect, not just a stylistic difference
The asymmetry is undocumented and (based on the source's own commenting pattern — a nearby construction-timing fix elsewhere in the code IS explicitly commented as intentional) does not appear to have been a deliberate design decision. It is also invisible in the current golden test fixtures: `RE-GOLD-002` (Existing Building) uses `rentGrowthRate: 0` by default, at which point both conventions produce an identical result (see table below, 0% row) — so no existing test would catch a future accidental change to either engine's convention.

## Quantitative impact (neutral, both conventions computed from the SAME underlying inputs)
Source: `tools/def001_impact_calculator.js`, run against RE-GOLD-002's actual input set with `rentGrowthRate` varied. Full machine-readable table: `DECISION-DEF-001/impact-table.json`.

| rentGrowthRate | Convention A (Direct Cap) | Convention B (Forward NOI Cap) | Difference (SAR) | Difference (%) |
|---|---|---|---|---|
| -3% | 187,934,207 | 182,296,181 | -5,638,026 | -3.00% |
| -2% | 195,804,740 | 191,888,646 | -3,916,095 | -2.00% |
| -1% | 203,919,932 | 201,880,733 | -2,039,199 | -1.00% |
| 0% (current building default) | 212,284,800 | 212,284,800 | 0 | 0.00% |
| 1% | 220,904,414 | 223,113,458 | 2,209,044 | 1.00% |
| 2% | 229,783,895 | 234,379,572 | 4,595,678 | 2.00% |
| 3% (current land default) | 238,928,413 | 246,096,265 | 7,167,852 | 3.00% |
| 4% | 248,343,190 | 258,276,918 | 9,933,728 | 4.00% |
| 5% | 258,033,501 | 270,935,176 | 12,901,675 | 5.00% |

The relationship is exactly linear: `Difference % = rentGrowthRate %` (since Convention B = Convention A × (1 + rentGrowthRate) by construction). This is a mechanical consequence of the formulas, not a finding requiring further investigation.

## What this means in practice, without recommending an answer
- At the Existing Building study's own current default (`rentGrowthRate=0`), the choice is moot — both conventions agree exactly.
- At the Land Development study's own current default (`rentGrowthRate=0.03`), switching Land Development to Convention A would reduce every land deal's computed exit value by exactly 3%, which is large enough to move a marginal deal across the `marketValueAfterCompletion >= totalProjectCost` (criterion c4) threshold.
- Any Existing Building study run with a non-zero growth assumption is currently using Convention A; if the intended house standard is Convention B, every such study to date understated exit value by an amount equal to its growth rate.

## Three possible resolutions (presented neutrally — this brief does not endorse one)
1. **Standardize on Convention A** (Direct Cap) for both studies — Land Development's engine would need a one-line change to drop its extra growth step.
2. **Standardize on Convention B** (Forward NOI Cap) for both studies — Existing Building's engine would need a one-line change to add the growth step.
3. **Keep both conventions as an intentional, documented, per-study-type modeling choice** — in which case DEF-001 should be reclassified from POTENTIAL_DEFECT to INTENTIONAL_MODEL_DIFFERENCE, and this brief itself becomes the documentation that was previously missing.

## What is explicitly NOT proposed by this document
No code change. No default value change. No reclassification of DEF-001's status in DEFECT_REGISTER.csv (that requires the decision this brief exists to support). No new characterization fixture covering non-zero-growth Existing Building behavior (COV-001) — that would itself need to wait until the convention question is resolved, since building such a fixture today would freeze in whichever convention is currently implemented without it being a deliberate choice.
