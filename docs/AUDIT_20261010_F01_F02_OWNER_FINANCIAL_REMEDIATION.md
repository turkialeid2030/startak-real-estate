# Startak 2026-10-10 Arabic owner audit — financial P0 remediations F01/F02

## Audited source
`Startak_Audit_Arabic_2026-10-10(1).docx`, 17-page independently produced visual and arithmetic audit of the public site. The auditor did not inspect this repository. The observed errors must be reproduced against source before attributing root cause.

## F01: silently coerced negative purchase price — root cause confirmed
`src/app/App.jsx` NumField previously executed `Math.max(min, parsed)`. Entering `-1` in a purchase field whose minimum is `0.01` became `0.01` without an error and produced misleading yields. The canonical `src/validation/numeric-safety.js` already correctly rejects `buildingPrice <= 0` and land prices below zero, but was never given the rejected original value.

**Remediation:** no numeric input ever silently floors a user-supplied price at entry. Send the typed numeric value as-is to the canonical validator, allowing the existing invalid-input warning, last-known-valid result provenance, and no-save/no-export safeguards to operate. This is a data integrity fix, not a changed financial formula. A single `-` interim edit still uses the existing text field behavior; further full-form accessibility improvements should follow.

## F02: maximum justifiable land purchase price computed from wrong payback definition
Former `LAND_WAVE_A_2.0` calculated the displayed land threshold as a multiple of stabilized NOI, adjusted for construction cost. However the decision criterion `CUMULATIVE_PROJECT_PAYBACK` and reported `cumulativeProjectPaybackYears` use:
- Year 0 land acquisition with commission, transfer and professional acquisition costs.
- Negative actual construction draws across `constructionPeriod` calendar years.
- Year-by-year operating NOI after construction, including lease-up/growth, and **excluding** terminal sale proceeds.

**Remediation:** exact monotone binary inversion of the actual calendar cashflow payback function for the user-entered max years; output cent-rounded downward and assert recomputed payback at that price passes, while one cent above fails. If the price is economically infeasible even at 0 SAR/m², return **null/unavailable**, not a fake zero-valued maximum. The investment IRR/NPV formulas are unchanged; their outputs naturally change with actual hypothetical price as before.

Caveat: an output `maxJustifiedLandPricePerSqm` based on payback addresses **only that threshold**, not simultaneous lender, NPV, IRR, return or market constraints; it is not an appraisal nor a verified executable transaction price. Further work should distinguish this payback ceiling from an integrated acquisition offer cap with all hard-gate constraints.

## Additional findings — not silently treated as closed
- F03 building recovery: current engine has cumulative payback mechanics; need confirm label in live UI and distinguish annual simple, calendar operating, and sold-with-exit timing.
- F04/F05 Arabic fallback obscuring technical messages and corrupting user-provided deal names: prioritize as next wave.
- F06 valuation context lost on switching tab or real estate mode: persist draft case parameters without incorrectly approving them.
- F07 personal report exports valuation subset, not the full financial engine: merge one coherent personal financial study, with source model metrics.
- F10/F11 asset-class valuation engines incomplete: show supported/pilot/unsupported and no fabricated analysis for hospitality/industrial.
- F14-F18 professional source/PDF/evidence/identity/committee process: future professional-use enhancement; **not** a prerequisite to owner-only local private study creation.
- Synthetic reference calculations and unsupported real market values remain explicitly labelled. Full 17-page audit includes recommendations beyond the above; use it as a separate verification source, not an assertion that repository bugs have already been fixed.

## Release disposition
PR is for **engineering qualification only**. No merge or Cloudflare deploy until exact-head CI passes. This user's current scope is owner personal research; no institutional-signature P0 permissions needed to save or analyse personal real estate studies.
