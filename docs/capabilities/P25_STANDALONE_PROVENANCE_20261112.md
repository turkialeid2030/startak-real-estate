# STARTAK RE P25 — isolated critical-assumption source verification

**Date:** 2026-11-12. **Scope:** STARTAK Real Estate only.

## Verified historic source and modern compatibility
- Historic qualified P25 source [PR #461](https://github.com/turkialeid2030/startak-real-estate/pull/461), SHA `73e6f04b61105c7ffb7fc29a1a03f7c2e19556b5`.
- Pure governance logic restored at `src/assumptions/critical-assumption-override-governance.js` without modifying current canonical `src/engines/index.js`, V2 economics, owner UI or saved deals.
- Original code imports historic `V2_CANONICAL_ASSUMPTIONS`; current `src/assumptions/assumption-model.js` only exports the semantically identical (numeric) `V2_APPROVED_ASSUMPTIONS`. A **local alias of the imported baseline object only** is used: the word APPROVED in the legacy symbol is not evidence of a genuine authorized economic override. This is compatibility for *standalone source analysis*, not a full P25 integration.
- Negative regression covers missing source/date/ref/reason/approver, duplicate override, expired/future-dated approval and source, invalid numeric value, and immutable original economic object.
- An internal structurally READY review packet does **not** independently authenticate signatures, rights, approved economic assumptions, or production authority.

## Strict non-activation
The existing modern finance code returns `HOLD_UNSUPPORTED_OVERRIDE_PATH` when a requested critical override cannot safely be transported/applied. This patch **does not bypass** that. The P27 reference cases must still be invariant on the final exact SHA, and rejected critical overrides must not alter baseline cashflows.

**Not delivered:** governed Symbol-capability economic override transport, replayable changed cashflows, UI provenance/save/restore, independent reviewer sign-off, 17 private golden properties and production decision authorization. Full P25 remains **PARTIAL** until those are integrated and tested separately.

`P25_PROVENANCE_STANDALONE=READY_FOR_CI`; `P25_ECONOMIC_OVERRIDE_ACTIVE=FALSE`; `COMMERCIAL_GO_LIVE=HOLD_NOT_AUTHORIZED`.
