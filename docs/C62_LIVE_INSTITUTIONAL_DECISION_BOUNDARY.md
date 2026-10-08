# C62 — Live Institutional Valuation Decision Boundary (limited integration stage)

## Actual integration, not only schema
This stage **edits the existing user-facing runtime**, `src/app/existing-building-valuation-runtime.js`, and the live component `src/components/ValuationIntelligenceBasePanel.jsx`. Every configured existing-building Valuation V1 evaluation now runs `assessInstitutionalValuationDecisionBoundary` and exposes a separate `institutionalDecision` result. The Arabic and English panel explicitly warns that the old method calculation is a **preliminary mathematical indication**, that no certified final value or institutional decision has been established, and that evidence/legal/human authority blocks remain in effect.

## Reused gates and anti-bypass controls
The institutional boundary attempts to bind candidate methods to:
- C58 comparable source-record/capture-rights provenance (sale/rent evidence);
- C59 canonical Wave11A depreciation cause allocations, reconciled to existing V1 cost arithmetic;
- C60 predeclared executed NOI/cap/exit/discount-rate evidence;
- C55 dated-development residual, with explicit blocking of any attempt to equate it with legacy terminal-discount residual;
- C61 industrial or hotel specialist provenance if the asset class is specialized.

The institutional result is **always HOLD** until authentic, independently verified transaction/source rights, professional review and an authorized report workflow are implemented. Self-declared `approved` fields and structurally passing fake signed metadata cannot upgrade institutional decision readiness; a new attempted institutional report export is rejected. The raw V1 analytical stage, its archived economics and its existing presentation contract remain unchanged for backward compatibility with previous saved cases and tests. This preserves long-standing V1 method arithmetic but means legacy analytical calculations may still appear AVAILABLE: that is **not** professional, accredited, or public decision readiness.

Optional `institutionalEvidence` object is retained through the versioned valuation-case draft/extension saved-deal serialization; its presence is never approval.

## Explicit scope boundaries
- This stage wires the actual existing-building UI/runtime, not every land, redevelopment, industrial, hotel, mixed-use or other production route.
- Only the new C62 institutional export function blocks export. Older C4/C6 operational report paths have their own existing legal gates and are **not** claimed to be wholly re-wired to C62 here.
- No genuine browser session, real human UAT, independent transaction-document authentication, legal rights or accredited appraisal is provided by CI. Actual C57 eight-sector E2E remains HOLD.
- A separate source-verifier trust anchor, persistent attestations and exact C30 route authority must be added before any result can advance beyond institutional HOLD.
- C62 is not a generic authorization mechanism and must not be reinterpreted as approval by another route.

## Tests
Existing-building live runtime with numerical V1 READY still yields institutional HOLD and no institutional final value; untrusted self-reported reviewer approval fails; saved valuation-case clone/reload retains draft claim but not authority; actual source code shows live integration and Arabic warning; falsified export permit remains unsupported; all old V1 regression, C58-C61, build, release and dependency checks must pass on exact head.
