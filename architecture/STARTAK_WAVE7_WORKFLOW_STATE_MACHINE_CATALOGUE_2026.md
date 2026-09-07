# STARTAK Real Estate — Wave 7 Workflow & State Machine Catalogue 2026

Status: **DRAFT — BRANCH ONLY / NON-PRODUCTION**

## 1. Purpose

This catalogue defines fail-closed state transitions for the first professional-valuation foundation. States are explicit domain state, not UI labels. Every material transition must produce an attributable audit event and must be reproducible from persisted state and evidence.

Current production remains `UNLICENSED_DECISION_SUPPORT`. These workflows may be implemented behind a feature/control boundary before any certified professional output is permitted.

## 2. Assignment acceptance state machine

Primary states:

`DRAFT -> SCOPE_REVIEW -> CONFLICT_REVIEW -> COMPETENCE_REVIEW -> DATA_AVAILABILITY_REVIEW -> TERMS_REVIEW -> AUTHORIZED_FOR_ANALYSIS`

Alternative/terminal states:
- `HOLD_SCOPE_INCOMPLETE`
- `HOLD_CONFLICT_REVIEW_REQUIRED`
- `DECLINED_CONFLICT`
- `HOLD_SPECIALIST_REQUIRED`
- `DECLINED_OUTSIDE_COMPETENCE`
- `HOLD_DATA_INSUFFICIENT`
- `DECLINED_TERMS`
- `CANCELLED`

### 2.1 DRAFT -> SCOPE_REVIEW gate

Required minimum: client, intended use/user, purpose, asset/property identity, proposed valued interest, basis of value candidate, valuation date candidate, scope owner.

Missing critical scope fields emits `VALUATION_SCOPE_INCOMPLETE`.

### 2.2 SCOPE_REVIEW -> CONFLICT_REVIEW gate

Scope must explicitly record:
- property/right being valued
- basis of value
- valuation date
- report/engagement date where known
- assumptions/special assumptions
- limitations
- reliance restrictions
- planned inspection/data scope
- reporting expectation

### 2.3 Conflict state

Allowed conflict outcomes:
- `CLEAR`
- `DISCLOSURE_REQUIRED`
- `REVIEW_REQUIRED`
- `CANNOT_PROCEED`

`CANNOT_PROCEED` cannot transition to authorized analysis without a new engagement/review context; software must not override it.

### 2.4 Competence state

Allowed outcomes:
- `COMPETENT`
- `SPECIALIST_REQUIRED`
- `OUTSIDE_COMPETENCE`
- `PROFESSIONAL_REVIEW_REQUIRED`

Specialized property classes may require a named specialist/reviewer before analysis continues.

## 3. Standards lifecycle state machine

Bibliographic status is separate from activation approval.

Publication lifecycle:
`DETECTED -> SOURCE_VERIFICATION -> CLASSIFIED -> IMPACT_ASSESSMENT -> IMPLEMENTATION -> CONFORMANCE_TEST -> PROFESSIONAL_LEGAL_REVIEW -> RELEASE_APPROVAL -> ACTIVATED -> MONITORING`

A standard may have bibliographic status `FUTURE` while its implementation lifecycle is `CONFORMANCE_TEST`, for example. Date alone never causes an activation transition.

Rejected/held states include:
- `HOLD_SOURCE_UNVERIFIED`
- `HOLD_VERSION_UNVERIFIED`
- `HOLD_IMPACT_INCOMPLETE`
- `HOLD_TEST_FAILURE`
- `HOLD_REVIEW_REQUIRED`
- `HOLD_RELEASE_APPROVAL`
- `SUSPENDED`

## 4. Evidence lifecycle

Reuse the repository's existing evidence model and preserve the conceptual lifecycle:

`SOURCE_DOCUMENT -> EXTRACTED -> NORMALIZED -> RECONCILED -> VERIFIED -> QUALIFIED_INPUT`

Additional professional states:
- `CONFLICTED`
- `STALE`
- `SUPERSEDED`
- `REJECTED`
- `REVIEW_REQUIRED`

An extracted field does not become a qualified professional input merely because model confidence is high.

## 5. Property-data conflict state machine

When deed/registry/license/plan/inspection/measurement evidence disagree materially:

`NO_CONFLICT -> POTENTIAL_CONFLICT -> MATERIAL_CONFLICT -> REVIEW -> RESOLVED | ACCEPTED_WITH_DISCLOSURE | UNRESOLVED_BLOCK`

A material unresolved conflict emits `MATERIAL_PROPERTY_DATA_CONFLICT` and blocks dependent professional conclusions.

Disposition must preserve all competing evidence and the reviewer rationale; resolution must not delete the losing observation.

## 6. Comparable evidence state machine

`DISCOVERED -> SOURCE_CAPTURED -> DUPLICATE_CHECK -> VERIFICATION -> NORMALIZATION -> ADJUSTMENT_REVIEW -> QUALIFIED | REJECTED`

Hold states:
- `SOURCE_INSUFFICIENT`
- `DATE_STALE_REVIEW`
- `ABNORMAL_TRANSACTION_REVIEW`
- `OUTLIER_REVIEW`
- `CONTRADICTION_REVIEW`

A comparable's qualification record must identify source hierarchy, verifier, date, adjustments, confidence basis, and rejection reason where applicable.

## 7. HBU workflow

A scenario advances sequentially only:

`CANDIDATE -> LEGALLY_PERMISSIBLE -> PHYSICALLY_POSSIBLE -> FINANCIALLY_FEASIBLE -> PRODUCTIVITY_COMPARISON -> HBU_CONCLUSION`

Failure at an earlier gate prevents a scenario from being presented as HBU even if its residual value or IRR is high. Multiple feasible scenarios must reach productivity comparison; the engine must not shortcut to a single preselected use.

## 8. Valuation-run workflow

`CONFIGURED -> INPUT_READINESS -> METHOD_EXECUTION -> METHOD_QA -> RECONCILIATION_ELIGIBLE -> RECONCILED -> REVIEW_REQUIRED -> REPORT_ELIGIBLE`

Hold/block states include:
- `SCOPE_INCOMPLETE`
- `INPUTS_INCOMPLETE`
- `EVIDENCE_INSUFFICIENT`
- `NONFINITE_CALCULATION`
- `METHOD_NOT_APPLICABLE`
- `MATERIAL_CONFLICT`
- `STANDARD_RULESET_HOLD`
- `PROFESSIONAL_REVIEW_HOLD`

Reconciliation may not hide failed methods by averaging them with valid methods.

## 9. Reconciliation workflow

`METHOD_SET_READY -> RELEVANCE_ASSESSMENT -> EVIDENCE_RELIABILITY_ASSESSMENT -> WEIGHT_OR_REASON_SELECTION -> RECONCILIATION -> OVERRIDE_REVIEW -> FINAL_RECONCILED_INDICATION`

No automatic arithmetic mean is a default rule. Any human override must preserve previous machine output, override rationale, actor, time, and review state.

## 10. Report lifecycle

`DRAFT_ANALYTICAL -> QA_CHECK -> PROFESSIONAL_REVIEW_REQUIRED -> REVIEWED -> ISSUE_AUTHORIZATION -> ISSUED`

`REPORT_BLOCKED` is entered for critical missing scope, evidence, calculation, standards snapshot, review, or report-completeness failures.

The system may generate a draft analytical artifact while production is unlicensed, but must not promote it to `FINAL_BY_AUTHORIZED_PROFESSIONAL` unless the separate human/compliance authority boundary explicitly permits that state.

## 11. Review workflow

`PENDING -> ASSIGNED -> IN_REVIEW -> FINDINGS_OPEN -> FINDINGS_RESOLVED -> SIGN_OFF_ELIGIBLE -> SIGNED_OFF`

Review levels should be explicit, for example:
- technical calculation review
- evidence/data review
- professional valuation review
- legal/regulatory review
- independent quality review

Reviewer and originator identities must remain distinct where independence is required.

## 12. Saved-deal / historical standards workflow

Loading historical case:

`LOAD_BOUND_SNAPSHOT -> HASH_VERIFY -> REPRODUCE_OR_HOLD`

Permitted user pathways after successful load:
- `REPRODUCE_HISTORICAL`
- `CLONE_TO_CURRENT_STANDARDS`
- `RUN_NON_DESTRUCTIVE_IMPACT_COMPARE`

There is no implicit `AUTO_MIGRATE_TO_CURRENT` transition.

## 13. AI workflow boundary

AI interpretation lifecycle:

`CONTEXT_BUILD -> EVIDENCE_SCOPE_CHECK -> DETERMINISTIC_OUTPUT_BIND -> MODEL_CALL -> SCHEMA_VALIDATE -> CLAIM_GROUNDING_CHECK -> POLICY_CHECK -> HUMAN_VISIBLE_OUTPUT`

Fail states include:
- `INSUFFICIENT_EVIDENCE`
- `UNBOUND_NUMERIC_CLAIM`
- `PROHIBITED_AUTHORITY_CLAIM`
- `CONTEXT_HASH_MISMATCH`
- `SCHEMA_INVALID`

AI cannot transition any engagement, valuation, report, standards activation, or transaction into a human-authority final state.

## 14. Universal transition contract

Every persistent transition must record:
- entity id/type
- from-state and to-state
- transition id/version
- initiating actor
- timestamp
- reason
- evidence refs
- applicable rule refs where relevant
- standards snapshot id/hash where relevant
- correlation id
- approval id when required
- software/model version

## 15. Release gate

A Wave 7 implementation is not deployable merely because states exist. Release must prove forbidden transitions are unreachable, Draft/Future standards are non-enforcing, historical snapshots reproduce, current Saudi compliance boundary is preserved, and all new state transitions are covered by deterministic tests.
