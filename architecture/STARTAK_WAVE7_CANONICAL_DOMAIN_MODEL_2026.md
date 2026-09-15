# STARTAK Real Estate — Wave 7 Canonical Domain Model 2026

Status: **DRAFT — BRANCH ONLY / NON-PRODUCTION**  
Baseline: `main@ca3c24ad83a7d3d777b7f10d1435ef231383dfdf`  
Branch: `wave-7-foundation-standards-router`

## 1. Purpose

This contract defines the minimum canonical domain model required to evolve STARTAK from underwriting decision support into a governed Saudi real-estate valuation and investment-decision intelligence operating system without duplicating existing evidence, calculation, compliance, or decision-control primitives.

This document is an architecture contract only. It does not enable certified valuation, legal advice, brokerage, regulated investment advice, or transaction authority. Production remains governed by `SAUDI_COMPLIANCE_LAUNCH_BOUNDARY.md` and `UNLICENSED_DECISION_SUPPORT` until authorized human legal/professional review changes that boundary.

## 2. Reuse rule

The existing repository remains authoritative for implemented primitives including Document Intelligence, evidence qualification, deterministic calculation engines, saved-deal versioning, decision controls, AI boundaries, and Saudi compliance engineering guards. New Wave 7 capabilities MUST extend those primitives rather than create parallel sources of truth or alternate calculation paths.

## 3. Canonical aggregate roots

### 3.1 Engagement

Required identity and scope envelope for a professional valuation workflow.

Fields:
- `engagementId`
- `caseId`
- `clientPartyId`
- `intendedUserPartyIds[]`
- `purposeCode`
- `intendedUseCode`
- `jurisdiction`
- `valuationDate`
- `reportDate`
- `engagementDate`
- `basisOfValueCode`
- `propertyInterestIds[]`
- `scopeVersion`
- `assignmentState`
- `conflictStatus`
- `competenceStatus`
- `independenceStatus`
- `reviewerPartyId`
- `standardsSnapshotId`
- `createdAt`, `createdBy`, `updatedAt`, `updatedBy`

An engagement may not produce an official professional valuation conclusion when basis of value, valuation date, valued interest/right, or purpose is incomplete. The machine state must fail closed with `VALUATION_SCOPE_INCOMPLETE`.

### 3.2 Party

Represents client, intended user, owner, tenant, valuer, reviewer, adviser, lender, fund/regulated entity, specialist, or other participating organization/person.

Core fields: `partyId`, `partyType`, `legalName`, `roleCodes[]`, `jurisdiction`, `professionalCapacity`, `licenseRef`, `verificationStatus`.

A license reference is evidence metadata only; software must not infer professional authorization solely from a populated field.

### 3.3 Property

Core real-property identity: `propertyId`, `caseId`, location, parcel/building identifiers, property class, use, tenure/rights references, physical facts, area measures, planning references, and evidence links.

### 3.4 PropertyInterestGraph

A property may contain multiple legal/economic interests. The model must represent nodes and relationships rather than flattening ownership into a single text field.

Node types include `OWNERSHIP`, `LEASEHOLD`, `USUFRUCT`, `EASEMENT`, `MORTGAGE`, `RESTRICTION`, `OTHER_REVIEW_REQUIRED`.

Each interest must carry:
- `propertyInterestId`
- `propertyId`
- `interestType`
- `holderPartyId`
- `burdenedInterestId` / `benefitedInterestId` where relevant
- `effectiveFrom`, `effectiveTo`
- `sourceRefs[]`
- `verificationStatus`
- `professionalReviewStatus`
- `isValuedInterest`

The engagement must identify exactly which interest or combination of interests is being valued.

### 3.5 SourceDocument

Immutable document identity envelope: `documentId`, `caseId`, `sourceSystem`, `sourceLocator`, `contentHash`, `receivedAt`, `documentDate`, `documentType`, `classification`, `retentionClass`, `confidentialityClass`.

No extracted fact may silently replace the source document. Document identity and content hash remain independently auditable.

### 3.6 EvidenceClaim

Universal evidence object for material assertions.

Fields:
- `evidenceId`
- `caseId`
- `claimType`
- `semanticField`
- `value`
- `unit`
- `sourceDocumentId`
- `pageOrLocator`
- `extractionMethod`
- `extractionModelVersion`
- `confidence`
- `verificationStatus`
- `verifiedBy`
- `verifiedAt`
- `observedAt`
- `effectiveFrom`, `effectiveTo`
- `recordedAt`, `supersededAt`
- `evidenceHash`

The model is bitemporal: business validity and system-record validity are separate. This is required for historical reproducibility.

### 3.7 DataPoint

Canonical semantic input/output object. `dataClass` must be one of:
- `FACT`
- `ASSUMPTION`
- `DERIVED`
- `PROFESSIONAL_JUDGMENT`

Fields include `dataPointId`, `semanticField`, `value`, `unit`, `dataClass`, `evidenceRefs[]`, `assumptionRefs[]`, `calculationRunId`, `judgmentRationale`, `reviewStatus`, temporal validity, and audit metadata.

A `PROFESSIONAL_JUDGMENT` must never be presented as a verified fact.

### 3.8 Inspection

`inspectionId`, property, inspector, inspection scope, timestamp, GPS evidence, device metadata, photo/media hashes, EXIF availability, measurements, observed condition, defects, occupancy, construction/MEP observations, surroundings, limitations, manipulation flags, and review status.

### 3.9 Measurement

`measurementId`, property, measure type (`LAND`, `GFA`, `BUA`, `NLA`, `GLA`, `RENTABLE`, `COMMON`, etc.), value, unit, measurement standard/reference, source, method, verification, effective date.

Material conflicts across deed/registry/license/plan/inspection must raise `MATERIAL_PROPERTY_DATA_CONFLICT` until resolved or explicitly dispositioned by an authorized professional review.

### 3.10 Comparable

Comparable evidence object with transaction/offer type, property descriptors, date, price/rent/yield, source hierarchy, verification state, normalization, duplicate/outlier/staleness flags, adjustment records, and reviewer state.

### 3.11 Lease

Lease-level DCF object: tenant, area, contract rent, market rent, start/expiry, escalation, break, renewal, incentives, recoveries, operating-expense treatment, guarantees, evidence provenance, and verification.

### 3.12 MarketStudy

Market evidence set, segmentation, date range, geography, source coverage, methodology, quality flags, derived market conclusions, and reviewer state.

### 3.13 HBUScenario

Highest-and-best-use scenario object with sequential gates:
1. legal permissibility
2. physical possibility
3. financial feasibility
4. maximum productivity

Each scenario carries assumptions, planning evidence, development program, financial output references, uncertainty, and comparative rank. HBU is not a binary checkbox.

### 3.14 ValuationMethod and ValuationRun

`ValuationMethod` defines method family and governed configuration. `ValuationRun` captures method version, input snapshot, calculation-engine version, timing convention, output, reconciliation eligibility, warnings/errors, and full provenance.

No UI, report, spreadsheet adapter, or AI component may independently recalculate production valuation metrics that belong to the governed calculation engine.

### 3.15 Assumption

Explicit assumption entity with provenance, owner, rationale, effective scope, scenario scope, sensitivity classification, evidence support, review status, version, and supersession history.

### 3.16 FinancialScenario

Separates unlevered property economics, debt economics, and equity economics. Metrics may include NPV, IRR, MIRR, Equity IRR, DSCR, LTV/LTC, ICR, Debt Yield, Equity Multiple, and Yield on Cost, but the semantic owner and calculation engine must be explicit.

### 3.17 Standard, StandardRule and StandardsSnapshot

These entities are governed by `STARTAK_WAVE7_STANDARDS_RULE_ENGINE_SPEC_2026.md`.

### 3.18 Review

Review record with `reviewId`, review type/level, reviewer, independence status, scope, findings, dispositions, changed-by vs reviewed-by attribution, sign-off state, and evidence references. A reviewer must not silently alter the original valuer/analyst conclusion.

### 3.19 Report

Report object with report type, version, engagement, standards snapshot, valuation/calculation runs, evidence completeness, review status, issue date, immutable content hash, and output classification.

Permitted governance classifications include:
- `DRAFT_ANALYTICAL`
- `PROFESSIONAL_REVIEW_REQUIRED`
- `FINAL_BY_AUTHORIZED_PROFESSIONAL`

The final classification is only available when an externally authorized professional workflow and current compliance boundary permit it; software must never self-certify.

### 3.20 DecisionMemo / InvestmentCommitteePack

Separate investment-decision artifact referencing professional valuation outputs but not mutating them. It may include scenario, risk, financing, committee thresholds, and human decision records.

### 3.21 AuditEvent

Append-only material-state event: actor, action, object, before/after references or hashes, reason, timestamp, correlation id, approval reference, and system version.

## 4. Decision Provenance Graph

Every material conclusion must be traversable through:

`Conclusion -> Method/Decision Logic -> Assumptions/Judgments -> Evidence -> Source Documents -> Applicable Standards -> Executable Rules -> Calculation/Model Version -> Review -> Report/Decision`.

The graph is a first-class governance requirement, not a reporting decoration.

## 5. Historical reproducibility contract

A historical valuation/decision must bind immutable references to:
- engagement/scope version
- property-interest snapshot
- evidence snapshot
- assumptions snapshot
- `standardsSnapshotId`
- `standardsSnapshotHash`
- calculation/model versions
- report version/content hash
- reviewer/sign-off records

A later standard, assumption model, or calculation release must not silently recalculate or rewrite a historical saved deal/report. Migration is prospective by default and requires an explicit impact gate.

## 6. Temporal model

Standards, evidence, property/planning facts, leases, and professional judgments must support both:
- **valid time** — when the fact/rule applies in the real world; and
- **system time** — when STARTAK recorded or superseded it.

This prevents a current database row from destroying the historical state required to reproduce an earlier conclusion.

## 7. Non-negotiable invariants

1. One canonical semantic field has one governed write authority at a time.
2. Document, evidence, verified fact, assumption, judgment, deterministic output, AI interpretation, and human decision remain distinguishable.
3. Every material persisted change is attributable.
4. Professional certification/signature is a human authority boundary.
5. Current production compliance restrictions remain in force until separately reviewed and approved.
