# STARTAK Real Estate — Wave 7 Standards Registry & Executable Rule Engine 2026

Status: **DRAFT — BRANCH ONLY / NON-ENFORCING**  
Baseline: `main@ca3c24ad83a7d3d777b7f10d1435ef231383dfdf`

## 1. Purpose

This specification converts standards management from a reference list into a governed, versioned, testable rule-control layer. It is designed to support Saudi professional/regulatory requirements, IVS, reporting frameworks, sector regulators, best-practice guidance, and internal policy without allowing an external publication, draft, future standard, AI process, or current date to alter production behavior automatically.

The registry is evidence and routing infrastructure. It is not a legal opinion and does not establish that STARTAK is licensed to issue certified valuations.

## 2. Standard registry contract

A `Standard` record must include at least:

- `standardId`
- `titleAr`, `titleEn`
- `issuer`
- `jurisdiction`
- `category`
- `version`
- `publicationDate`
- `effectiveDate`
- `expiryDate`
- `status`
- `sourceUrl`
- `officialSource`
- `sourceContentHash` where technically obtainable
- `lastVerifiedAt`
- `nextReviewAt`
- `supersedesStandardIds[]`
- `supersededByStandardIds[]`
- `applicableAssetTypes[]`
- `applicablePurposes[]`
- `authorityLevel`
- `guidanceOrMandatory`
- `ruleVersionHash`
- `professionalReviewer`
- `legalReviewStatus`
- `recordedAt`, `supersededAt`

Allowed `status` values are exactly:
`ACTIVE`, `FUTURE`, `DRAFT`, `SUPERSEDED`, `RETIRED`, `SUSPENDED`, `UNDER_REVIEW`.

Unknown or unverified 2026 references enter as `UNDER_REVIEW` or the verified publication status. They MUST NOT be labeled `ACTIVE` merely because the master directive names them.

## 3. Executable StandardRule contract

Every behaviorally relevant provision must be represented separately from the bibliographic `Standard` record.

Required fields:

- `ruleId`
- `standardId`
- `provisionReference`
- `ruleTitle`
- `ruleType`
- `authorityLevel`
- `enforcementClass`
- `jurisdiction`
- `appliesWhen`
- `excludesWhen`
- `purposeScope[]`
- `assetScope[]`
- `regulatedEntityScope[]`
- `transactionScope[]`
- `financingScope[]`
- `applicabilityDateBasis`
- `effectiveFrom`, `effectiveTo`
- `severity`
- `requiredInputs[]`
- `validationExpression` or deterministic evaluator id
- `calculationEffect`
- `reportingEffect`
- `blockingEffect`
- `implementationVersion`
- `testIds[]`
- `evidenceIds[]`
- `reviewStatus`
- `activationApprovalId`
- `recordedAt`, `supersededAt`

### 3.1 Applicability date basis

Rules must explicitly state which date controls applicability. Allowed initial values:
- `VALUATION_DATE`
- `REPORT_DATE`
- `ENGAGEMENT_DATE`
- `TRANSACTION_DATE`
- `FINANCING_DECISION_DATE`
- `OTHER_REVIEW_REQUIRED`

The router must not assume all standards are governed by valuation date.

### 3.2 Authority level

Initial controlled categories:
- `SAUDI_LAW_OR_REGULATION`
- `SAUDI_MANDATORY_PROFESSIONAL`
- `SECTOR_REGULATOR`
- `FINANCIAL_REPORTING_FRAMEWORK`
- `INTERNATIONAL_VALUATION_STANDARD`
- `PROFESSIONAL_BEST_PRACTICE`
- `INTERNAL_GOVERNANCE_POLICY`

These categories provide routing metadata, not a universal legal hierarchy. Precedence can depend on purpose, jurisdiction, regulated-entity status, adoption/endorsement relationships, and the particular provision.

### 3.3 Enforcement class

Initial controlled values:
- `BLOCKING`
- `REQUIRED_DISCLOSURE`
- `REQUIRED_REVIEW`
- `CALCULATION_RULE`
- `REPORTING_RULE`
- `GUIDANCE_ONLY`
- `FUTURE_READINESS_ONLY`

## 4. Purpose-Based Standards Router

Required input envelope:

- jurisdiction
- valuation purpose
- intended use
- intended users
- asset type
- valued property interest/right
- reporting framework
- regulated entity status
- transaction context
- financing context
- engagement date
- valuation date
- report date

Required output:

- `routerVersion`
- `routerInputHash`
- `applicableStandardIds[]`
- `applicableRuleIds[]`
- `excludedRuleIds[]` with reasons
- `conflictRecords[]`
- `requiredReviews[]`
- `standardsSnapshotCandidate`
- `blockingCodes[]`

The router is deterministic. AI may explain the result but may not add, remove, activate, or override an applicable rule.

## 5. Conflict and precedence engine

A static global precedence ladder is insufficient. The system must evaluate explicit authority and adoption metadata and preserve the reason for the resolution.

Conflict states:
- `NO_CONFLICT`
- `INTERPRETATION_REQUIRED`
- `CONFLICT_RESOLVED_BY_RULE`
- `LEGAL_OR_PROFESSIONAL_REVIEW_REQUIRED`

A conflict record must include competing rule ids, subject, resolution mechanism, reviewer when required, evidence, and resulting action. If a material conflict cannot be deterministically resolved by an approved precedence rule, the system must fail closed to review rather than choose the most recent or highest-labeled source.

## 6. Activation lifecycle

Required lifecycle:

`DETECT -> VERIFY_SOURCE -> CLASSIFY -> IMPACT_ASSESS -> IMPLEMENT -> TEST -> PROFESSIONAL_LEGAL_REVIEW -> RELEASE_APPROVE -> ACTIVATE -> MONITOR`.

Publication or arrival of `effectiveDate` does not activate code.

Activation requires all of the following:
- official source verified
- status/version/effective date verified
- professional/legal review completed when required
- impact analysis complete
- affected code/templates/workflows updated
- regression and conformance tests pass
- historical reproducibility tests pass
- release approval event exists
- `activationApprovalId` bound to the active rule set

Only then may a `FUTURE` or `UNDER_REVIEW` item become production-enforceable `ACTIVE`. Prior applicable versions transition according to an approved supersession event; historical snapshots remain immutable.

## 7. DRAFT and FUTURE hard boundary

`DRAFT`:
- may support gap analysis, future-readiness analysis, impact assessment, and engineering planning;
- MUST NOT change a production valuation conclusion, calculation, compliance outcome, report approval, or transaction state.

`FUTURE`:
- MUST NOT apply before its effective date;
- MUST NOT activate merely because its date has arrived;
- remains non-enforcing until the controlled activation lifecycle completes.

Mandatory regression: adding a newer DRAFT or unactivated FUTURE standard cannot change the same production input's routed rules or deterministic conclusion.

## 8. StandardsSnapshot

A snapshot must be immutable and content-addressed.

Required fields:
- `standardsSnapshotId`
- `snapshotVersion`
- `snapshotHash`
- `createdAt`
- `routerVersion`
- `routerInputHash`
- `standardRefs[]` with version/status/source/effective metadata
- `ruleRefs[]` with implementation version and rule hash
- `activationApprovalRefs[]`
- `valuationDate`
- `reportDate`
- `engagementDate`

`standardsSnapshotVersion` without immutable `snapshotHash` is insufficient for institutional reproducibility.

## 9. Saved-deal and historical behavior

Each persisted professional/decision case that depends on standards must bind its snapshot id/hash. Loading an old case after a standards release must not silently reroute or recalculate it.

Explicit actions may include:
- reproduce historical result with bound snapshot;
- clone into a new current-standards case;
- run a non-destructive impact comparison;
- migrate only through an approved migration workflow.

Default behavior is prospective, not retrospective.

## 10. Staleness

When a required verification record exceeds its review cadence, emit `STANDARD_VERIFICATION_STALE` and prevent the stale state from being represented as a final legal/professional compliance conclusion. The response depends on rule severity and may require review or blocking.

## 11. Conformance tests

Every release affecting standards must prove at minimum:

1. only approved ACTIVE rules can enforce production behavior;
2. DRAFT rules do not alter production outputs;
3. FUTURE rules do not apply before their effective date;
4. unapproved FUTURE rules do not auto-activate after effective date;
5. router selects rules using the correct applicability-date basis;
6. unresolved material conflicts fail closed;
7. snapshot hash changes when the bound rule set changes;
8. historical reports/cases remain reproducible with their prior snapshot;
9. current rule activation cannot rewrite an old snapshot;
10. AI output cannot mutate registry, activation, or router decisions.

## 12. Initial implementation mode

Wave 7 must begin in **non-enforcing registry mode**. Initial records should be `UNDER_REVIEW`, `DRAFT`, `FUTURE`, or another source-verified status until authoritative source and professional/legal review are complete. No new standards entry created by this branch changes production calculations or certified-status claims.

## 13. Release-blocking codes

Initial controlled blocking taxonomy:
- `STANDARD_SOURCE_UNVERIFIED`
- `STANDARD_VERSION_UNVERIFIED`
- `STANDARD_VERIFICATION_STALE`
- `STANDARD_RULESET_CONFLICT`
- `STANDARD_RULE_UNAPPROVED`
- `STANDARD_SNAPSHOT_MISSING`
- `STANDARD_SNAPSHOT_HASH_MISMATCH`
- `VALUATION_SCOPE_INCOMPLETE`
- `PROFESSIONAL_REVIEW_REQUIRED`

This taxonomy extends rather than replaces existing compliance, evidence, and calculation error codes.
