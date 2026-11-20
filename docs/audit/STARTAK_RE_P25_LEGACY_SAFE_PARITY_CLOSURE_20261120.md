# STARTAK Real Estate — P25 historical assumption-governance safe migration

> 20 Nov 2026. Decision: **SAFE-PORT IN PROGRESS / LEGACY FEATURE EQUIVALENCE PARTIAL / PRODUCTION HOLD**. Evidence is the historic [PR #461](https://github.com/turkialeid2030/startak-real-estate/pull/461), modern [PR #803](https://github.com/turkialeid2030/startak-real-estate/pull/803), and exact-head tests linked below. This is not evidence of an authorized historic or current real transaction.

## Why literal code-copying was not acceptable

- The original P25 branch had a canonical engine capable of applying a registry-based critical rate override and calculating changed NOI/NPV after reading approval-looking fields. That historical code path was not a substitute for independent, production-qualified user/valuer/committee approval.
- The current engine explicitly disallows registry-based overrides in the public canonical investment entrypoint. It returns **baseline analytical cashflows with `decisionStatus=INCOMPLETE_INPUTS` and `CRITICAL_OVERRIDE_NOT_APPLIED_IN_CANONICAL_ENGINE`**, rather than silently applying a user-declared rate or presenting it as a decision.
- Copying the original engine implementation would silently bypass the newer financial/tenant/authority gates. The safe functional restoration is therefore to **preserve the historic evidence and its HOLD semantics**, not automatically apply the old price-changing capability.

## Restored protections on current draft branch

| Legacy concern | Modern correction/verification | Qualification limits |
|---|---|---|
| P25 temporal approval | `tests/defects/critical_assumption_override_temporal_legacy_parity_v1.js` — 10 synthetic tests: expiry, malformed/future evidence, deterministic as-of, pending approval, duplicate controls | Validates governance function only; not issuer identity or genuine approval |
| Historical engine override integrity | `tests/defects/critical_assumption_override_engine_legacy_parity_v1.js` — 11 scoped checks for signed-looking claims, invalid values, raw payload spoof, LEGACY compatibility, saved deal incomplete provenance and no financial rewrite | Public engine intentionally refuses real override economics; original P25 price-changing workflow not equivalently reinstated |
| P25 UI, saved deal and decision | `tests/defects/critical_assumption_override_ui_legacy_parity_v1.js` — 10 synthetic checks for saved source preservation, UI decision HOLD, default-only NOI/NPV, fail-closed sensitivity and purchase certificate | Actual browser UAT and licensed financial professional approval still required |
| UI and deal lifecycle | `src/assumptions/ui-deal-lifecycle.js`, `src/assumptions/ui-integration-controller.js`, `src/app/App.jsx` preserve registry on load/save/reset and forward it into the governed engine | A UI banner is not authority, and cannot make past approvals true |
| Report and canonical workspace bridge | `src/runtime/saved-deal-canonical-workspace-bridge.js`, `src/contracts/executable-investment-case.js` identify finance and financialModel as `ANALYTICAL_HOLD` and keep the finance lifecycle unresolved; `run_saved_deal_canonical_workspace_bridge.js` exercises this | Actual source appraisal parity/production report permission not established |
| Legacy finance defaults | `canonicalDefaultAssumptionKeys` is separated from `independentlyApprovedAssumptionKeys=[]`; old P27 `approvedAssumptionKeys` name remains a deprecated compatibility alias with `approvalEvidenceStatus=NOT_SUPPLIED` | Real approved assumptions cannot be inferred from the source numeric baseline |

## Exact acceptance protocol

1. Run `node tests/defects/critical_assumption_override_temporal_legacy_parity_v1.js`, `node tests/defects/critical_assumption_override_engine_legacy_parity_v1.js`, `node tests/defects/critical_assumption_override_ui_legacy_parity_v1.js`, then full test discovery, build and all security/browser/finance gates on one pinned commit.
2. Validate a saved synthetic override case from JSON into current React data model, financial calculation, canonical workspace, report export and audit trail; verify no numeric purchase ceiling or certified appraisal is produced while the override is unsupported.
3. Compare old P25 engine computations with a **separate analytical-only what-if facility** if relevant, never transmute synthetic approval fields into signed professional authority. Require expert-approved economic reference results and a second reviewer.
4. Keep original PR #461 open until all 15 changed files are reviewed and a formal no-loss disposition is approved. Three restored negative suites are **adaptations, not byte-for-byte restoration of the old P25 engine**.
5. Require Q03 financial, Q05 security, Q11 professional and Q12 release authorities plus independent evidence before any production decision. Current QCR closed evidence count was 0/36 in the source register.

## Status boundaries

- **Engineering:** synthetic temporal/canonical/UI tests added on current development PR, latest exact-head CI required for verification.
- **Functional original P25 approval-to-economics feature:** intentionally **HOLD** pending trusted signed approval architecture, professional validation and current model reconciliation.
- **Original 17 property appraisals + four supplementary calculations:** full original file-to-engine parity **OPEN**, not certified by synthetic test fixtures.
- **Production:** `HOLD_NOT_AUTHORIZED`. Neither this report nor CI authorizes merger, deployment, sale, appraisal, banking or transaction action.
