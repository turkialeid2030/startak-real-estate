# STARTAK RE — PR #461 P25 Financial Override Governance: Source Parity Review

> 20 Nov 2026. Scope: **15 filenames** changed by [PR #461](https://github.com/turkialeid2030/startak-real-estate/pull/461) compared with their counterparts on the latest `security/hardening-v1` branch. This document is a no-loss assessment; it authorizes no merge, financial issuance, investment decision, or production deployment.

## Executive finding

- PR #461 `p25-critical-assumption-override-governance` is **open / non-draft / GitHub mergeable=false** relative to `main`. Its old base is not a qualified current `main` merge candidate.
- **12 shared files** exist on the latest security branch but are **not byte-identical** to PR #461's head. **3 P25-specific negative regression files are not present** in the latest security branch:
  - `tests/defects/critical_assumption_override_governance_p25.js`
  - `tests/defects/critical_assumption_override_temporal_governance_p25.js`
  - `tests/defects/critical_assumption_override_ui_governance_p25.js`
- The modern branch already implements parts of critical-override governance, but it is **not evidence of complete P25 functional parity**. Direct copying the old PR's files risks overwriting newer financial engine and workflow changes.
- Verified a concrete disclosure inconsistency: the modern branch had an `approvedAssumptionKeys` list populated from numeric V2 baseline defaults while simultaneously declaring `userApprovedAssumptions=false` and `canonicalDefaultsAreApprovalEvidence=false`. This ambiguity also flowed into export metadata. Draft PR #803 preserves P27's populated **deprecated legacy alias** `approvedAssumptionKeys` (for old clients), exposes the identical `canonicalDefaultAssumptionKeys`, and adds an explicit **empty** `independentlyApprovedAssumptionKeys` plus `approvalEvidenceStatus='NOT_SUPPLIED'` without changing numeric calculations. It preserves the older disclosure schemaVersion 3; this is a **targeted compatibility-safe fix only**, not a full P25 port.
- The current model's V2 research-override semantics and temporal approval evidence checks differ from PR #461, and the three original P25 tests are absent. **Do not mark W10/W16 or PR #461 closed** until semantic tests and reviewer approval are complete.

## Per-file status against P25 head

| Path | Modern branch file? | Exact parity? | Required disposition |
|---|---|---|---|
| `src/assumptions/assumption-disclosure.js` | Yes | Different | Targeted baseline/approval split implemented; compare all critical override fields and output schema |
| `src/assumptions/assumption-model.js` | Yes | Different | Canonical alias added, but compare override and simulation capability semantics |
| `src/assumptions/assumption-registry.js` | Yes | Different | Reconcile override provenance and policy checks |
| `src/assumptions/critical-assumption-override-governance.js` | Yes | Different | Verify semantic equivalence, blocker logic, and missing evidence guards |
| `src/assumptions/saved-deal-assumption-registry.js` | Yes | Different | Reconcile saved-deal backfills and version compatibility |
| `src/assumptions/ui-assumption-governance.js` | Yes | Different | Review sensitivity/decision readiness fail-closed gating |
| `src/assumptions/ui-deal-lifecycle.js` | Yes | Different | Preserve application lifecycle and control state semantics |
| `src/assumptions/ui-integration-controller.js` | Yes | Different | Verify UI/exports no longer imply signed approval of defaults |
| `src/contracts/financial-result.js` | Yes | Different | Audit financial result disclosures and decision readiness |
| `src/engines/index.js` | Yes | Different | Compare financial calculations and guarded overrides without numerical drift |
| `tests/architecture/run_wave2_assumption_version_exit_cap.js` | Yes | Different | Modern regression asserts defaults vs approved empty keys |
| `tests/characterization/run_triple_path.js` | Yes | Different | Compare three-path valuation characterization outputs |
| `tests/defects/critical_assumption_override_governance_p25.js` | **No** | **Absent** | Adapt/import verified negative test logic against modern interfaces |
| `tests/defects/critical_assumption_override_temporal_governance_p25.js` | **No** | **Absent** | Restore historical/expiry/date provenance negative scenarios |
| `tests/defects/critical_assumption_override_ui_governance_p25.js` | **No** | **Absent** | Restore UI/decision/exports fail-closed negative scenarios |

## Mandatory acceptance before PR #461 disposition

1. Compare all **15 PR changes** semantically, not merely filename or commit dates; record required behavior and whether modern implementation passes each original invariant.
2. Port or adapt the three P25 negative regression suites without copying old incompatible engine modules. Run exact-SHA CI, numeric no-drift tests, and browser decision gates.
3. Have a professional financial reviewer validate assumptions/override documentation, effective dates, saved deals and export semantics. **No user/valuer/lender/committee approval may be inferred from defaults in source code.**
4. Keep PR #461 and its evidence until reviewed disposition (port / retain / superseded with proof). Do not bypass GitHub mergeability=false via force merge or silent closing.
5. Keep Q03/Q11/Q12 independent financial, valuation and GO/HOLD signoffs **OPEN**.

**Decision: PARTIAL ENGINEERING FIX / FULL P25 PARITY NOT ACCEPTED / `HOLD_NOT_AUTHORIZED`.**
