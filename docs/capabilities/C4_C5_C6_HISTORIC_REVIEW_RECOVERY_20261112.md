# C4/C5/C6 historical investor-decision and controlled-review recovery — STARTAK Real Estate

**Audit date:** 2026-11-12. **Historical source:** [C4 #479](https://github.com/turkialeid2030/startak-real-estate/pull/479), [C5 #481](https://github.com/turkialeid2030/startak-real-estate/pull/481), [C6 #483](https://github.com/turkialeid2030/startak-real-estate/pull/483), original C6 stack SHA `9f234980efaafb6d1cba66fb54a7190b82284782`.

## Verified source-level recoveries
- `src/contracts/valuation-reconciliation.js`: old C3 method and unit of comparison contract.
- `src/contracts/governed-deal-decision.js`: decision/report schemas and hard non-authority boundary.
- `src/contracts/governed-human-review.js`: reviewer recommendation restricted to diligence, modify, evidence hold, do not advance.
- `src/decision-intelligence/governed-deal-decision.js`: C4 immutability, C3 result binding and evidence lineage SHA hashes.
- `src/app/governed-decision-operational.js`: C5 current-time and state-bound non-authorizing export.
- `src/decision-intelligence/governed-human-review.js`: C6 human review binding, duplicate-review rejection, tamper-resistant reviewed JSON envelope.
- `tests/fixtures/c6-governed-saved-deal.js`: synthetic historical fixture, no private user records.

Original source is restored to its historical path **without changing** modern `src/app/valuation-saved-deal-bridge.js`, modern saved-deal validation, App or report UI. Legacy SHA-256 helper is byte-identical in the modern stage. A dedicated modern-source regression runs actual C4/C5/C6 operations against an isolated synthetic case, exercising no-approved-transaction flag, altered-input invalidation, reviewer duplication, disallowed 'APPROVE_TRANSACTION', immutable current-case data and reviewed export SHA integrity.

## Not implied by standalone restoration
- It does NOT wire an old button into modern owner console, bypass modern RBAC/tenant isolation, or grant a human review role.
- It does NOT establish licensed or professional property valuation, verify real deed/lease rights, authorize a property purchase or certify a report.
- The old C5/C6 `saved-deal-schema.js` and `valuation-saved-deal-bridge.js` differ from the current application; porting them directly would overwrite recent safeguards for Kite, property case, source provenance and V2 finance. These are **deliberately not replaced**.
- The old C6 Chromium browser proof ran against the old App; this isolated-source test is **not** a modern end-to-end UX parity proof.

## Required separate integration and acceptance
1. Map current authenticated owner and organization roles and audit events to the C4/C6 review identity.
2. Bind a saved-deal snapshot to the current real property source and evidence freshness gate, preserving tamper checks.
3. Wire *review only* UI (not investment approval) to current validated case with backward-compatible saved-reload and JSON report; deny stale cases and unverified source rights.
4. Run actual modern Chromium/Firefox/WebKit Arabic and English workflows, keyboard/mobile viewports, tampering, unauthorized tenant, subsequent mutation and audit trace tests.
5. Only then consider external UAT and signed production release.

**Release classification:** `HISTORIC_SOURCE_RECOVERED_NONPRODUCTION`, `OWNER_UI_REVIEW_WORKFLOW=OPEN`, `MAIN_AND_CLOUDFLARE_UNCHANGED`, `COMMERCIAL_GO_LIVE=HOLD_NOT_AUTHORIZED`.
