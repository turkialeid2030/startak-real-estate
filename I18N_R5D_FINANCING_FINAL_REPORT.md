# I18N_R5D_FINANCING_FINAL_REPORT

## Inventory
21 rows: 12 control (6 Building + 6 Land) + 9 property (5 note + 2 warnText + 2 options). Exact CSV match.

## financingStructureLabel raw/display separation
2 raw values (مرابحة, إجارة منتهية بالتمليك), confirmed DISPLAY_ONLY (zero `===` comparisons anywhere). Added `getFinancingStructureLabel`/`FINANCING_STRUCTURE_PRESENTATION_KEYS` to `domain-presentation.js`, reusing the exact pattern established for leaseStatus/buildingTypeLabel/buildingPermitStatus in R5-C -- no new architecture invented. Verified via real browser: `<option value="مرابحة">Murabaha</option>` -- raw Arabic value preserved as the `value` attribute, only display text translated.

## Meaningful divergence between Building and Land (not accidental duplication)
- **LTV vs LTC**: Building uses "Loan-to-Value Ratio (LTV)" (against purchase price); Land uses "Loan-to-Cost Ratio (LTC)" (against total cost) -- different metric, different warning text. Kept as fully separate keys, never merged.
- **loanRate note**: Land-only -- explains capitalized interest during construction (no cash payment). Building has no equivalent note.
- **loanTenor note**: both studies have one, but the wording differs (deducted from *sale* proceeds vs. *exit* proceeds) and Land's label adds "(from Operations Start)".
- **Toggle label and note, section title**: verified genuinely identical between studies (not an oversight) -- both reused the pre-existing `financing.toggle` key (already correctly localized from an earlier wave) and a single `financingInput.toggleNote`.

## Critical behavioral fact confirmed
The financing Section renders unconditionally in both input panels -- `leverageEnabled` only toggles the Toggle control's own checked state, never the surrounding section's visibility (unlike Dashboard's `MetricGroup`s, which do conditionally hide). Verified via real browser: financing fields visible in the DOM regardless of toggle state.

## SelectField backward compatibility (established in R5-C, reused here)
`financingStructureLabel`'s two instances now use the `{value, label}` object form; verified no other `SelectField` usage broke via full regression before and after.

## R5-A/B/C freeze guards
`grep`-confirmed: `buildingPermitStatus === "صادر"` byte-identical; `leaseStatus`/`buildingTypeLabel` raw values untouched (verified via R5-C's own closure test, re-run clean after R5-D changes).

## R5 completion proof
Scoped scan of the **entire** `BuildingInputPanel` and `LandInputPanel` functions (not just R5-D's lines) found **zero** remaining hardcoded Arabic `label=`/`note=`/`warnText=` attributes in either panel -- confirming all 128 rows across R5-A/B/C/D are genuinely complete, not just individually reconciled.

## Test suite maintenance (not regressions)
`run_r5a_full_closure.js` and `run_r5c_full_closure.js` each had one stale "R5-D untouched" assertion (correct when written, now legitimately false) -- updated to check for the new central-mapper usage, consistent with the same pattern applied when R5-C completed.

## Regression
42/42 direct (20 new R5-D assertions). Core 6/6, Secondary 7/7, 0 page errors. Canonical source unchanged throughout all of R5.

## Final R5 inventory state
R5-A=55, R5-B=45, R5-C=7, R5-D=21 → **128/128 localized, 0 unlocalized**.

## Gate
I18N_R5D_GATE = PASS
R5-A/B/C/D = CLOSED/FROZEN
I18N_R5_GATE = HOLD -- R5-E integrated closure still required before declaring R5 fully closed.
