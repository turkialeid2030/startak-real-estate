# STARTAK Real Estate — Integration, Data & Decision Architecture v1.0

Status: **DRAFT IMPLEMENTATION BASELINE — BRANCH ONLY**  
Branch: `feat/integration-data-decision-architecture-v1`  
Baseline main commit: `f9cb66e06911f9a2a50dcbd9aeb2c328f2c882f8`

## 1. Purpose

This document defines the operating architecture that governs how STARTAK Real Estate should ingest data, preserve evidence provenance, run deterministic analytical engines, call bounded AI services, and present decision-control outputs for human review.

It is intentionally narrower than a generic enterprise architecture. It is a decision-intelligence control architecture for real-estate underwriting and investment review.

## 2. Governing principles

1. **Source data is not automatically authoritative.**
2. **Document ≠ Evidence ≠ Verified Fact ≠ Decision Value.**
3. **Deterministic calculations own financial and valuation arithmetic.**
4. **AI may interpret bounded context but may not override deterministic outputs or authorize a transaction.**
5. **Every material fact must carry case/project scope and provenance.**
6. **Cross-case data contamination is prohibited.**
7. **Missing, stale, conflicting, or insufficient evidence fails closed.**
8. **Human decision authority remains explicit and outside automated execution.**
9. **External tools are adapters, not alternate sources of truth by default.**
10. **All writes affecting decision state require attributable audit events.**

## 3. Current platform baseline confirmed in repository

The current production code already establishes the following control primitives:

- End-to-end study orchestration with required analytical stages:
  - property
  - tenant
  - regulatory
  - valuation
  - financial
  - scenarioRisk
  - decisionThresholds
- Evidence readiness as a precondition before underwriting progression.
- Fail-closed analytical-stage readiness checks.
- Explicit decision-control and decision-quality gates.
- Bounded AI analyst/challenger/synthesizer roles.
- AI outputs cannot authorize a transaction or override deterministic outputs.
- Professional-review and investment-committee dossier gates.
- Valuation intelligence with explicit evidence quality, reconciliation, single-method governance, and Critical Evidence Requirements.
- Existing Building valuation UI integration and Saved Deals compatibility.
- Document Intelligence foundation with immutable document identity, evidence facts, reconciliation, and explicit verification promotion.

This v1 architecture therefore **extends the existing control plane**; it does not replace it.

## 4. Target logical architecture

```text
SOURCE SYSTEMS / FILES
  |
  |-- Google Drive / uploaded documents
  |-- Spreadsheets / financial workbooks
  |-- Airtable / operational case records (future)
  |-- Aleph / governed enterprise source layer (future, when justified)
  |-- Saudi official / licensed data connectors (future)
  v
INGESTION & ADAPTER LAYER
  |
  |-- file/document adapters
  |-- spreadsheet adapters
  |-- API/connectors
  |-- source identity + content hash
  v
DOCUMENT & EVIDENCE INTELLIGENCE
  |
  |-- classify
  |-- extract
  |-- normalize
  |-- evidence fact contract
  |-- reconcile
  |-- verify
  |-- readiness gate
  v
CANONICAL CASE DATA MODEL
  |
  |-- case/project identity
  |-- property
  |-- tenant/lease
  |-- regulatory
  |-- market evidence
  |-- valuation inputs
  |-- financial inputs
  |-- scenario/risk inputs
  |-- decision thresholds
  |-- evidence references
  v
DETERMINISTIC ANALYTICAL ENGINES
  |
  |-- Property
  |-- Tenant
  |-- Regulatory
  |-- Valuation
  |-- Financial
  |-- Scenario/Risk
  |-- Decision Thresholds
  v
DECISION CONTROL / QUALITY
  |
  |-- readiness
  |-- conflicts
  |-- required diligence
  |-- professional review
  |-- committee dossier
  v
BOUNDED AI INTERPRETATION
  |
  |-- Analyst
  |-- Challenger
  |-- Synthesizer
  |-- evidence-bound narrative
  v
HUMAN INVESTMENT REVIEW
  |
  `-- final human decision / no automated transaction authorization
```

## 5. Source-of-truth model

STARTAK must not have a single global source of truth for all fields. It should use **domain-specific authoritative-source policy**.

### 5.1 Source classes

- `OFFICIAL_PRIMARY` — official registry, government, regulator, authenticated authority.
- `CONTRACTUAL_PRIMARY` — executed lease, signed contract, lender term sheet, binding legal instrument.
- `PROFESSIONAL_PRIMARY` — licensed appraisal, engineering report, legal opinion within its professional scope.
- `OWNER_SUPPLIED` — owner/client supplied evidence not independently verified.
- `MARKET_OBSERVED` — qualified comparable or market observation with source and date.
- `SYSTEM_CALCULATED` — deterministic STARTAK calculation derived from qualified inputs.
- `AI_INTERPRETATION` — model-generated narrative/analysis only; never authoritative fact.

### 5.2 Authority rule

The authority of a field is determined by explicit policy for that semantic field, not by the storage system in which the value happens to reside.

Example: Google Drive may hold a title deed PDF, but Drive is not the authority; the deed/registry provenance is. Airtable may store a rent figure, but Airtable is not automatically the authority; the executed lease or verified rent roll may be.

## 6. Canonical case data domains

Every canonical record affecting underwriting must carry at minimum:

- `caseId`
- `projectId`
- `schemaVersion`
- `sourceRef` or deterministic derivation reference
- `evidenceRefs[]` where material
- `observedAt` / `effectiveDate` where temporal validity matters
- `createdAt`
- `createdBy` / actor identity when persistent
- `verificationStatus`
- `dataQualityStatus`

### Core domains

1. **Case** — identity, status, ownership, workflow state.
2. **Property** — location, parcel/building attributes, use, area, age, access, physical condition.
3. **Tenant & Lease** — tenant identity, lease economics, expiry, guarantees, concentration, payment performance.
4. **Regulatory** — title, zoning, permits, land-use constraints, compliance facts.
5. **Market Evidence** — rents, yields, comparable transactions, supply/demand observations.
6. **Valuation** — method inputs, evidence policy, critical evidence requirements, reconciliation, indication.
7. **Financial** — income, opex, capex, financing, cash flow, NPV/IRR/DSCR and related deterministic outputs.
8. **Scenario & Risk** — base/downside/upside assumptions, sensitivities, risk events, stress outputs.
9. **Decision Thresholds** — explicit policy thresholds and exceptions.
10. **Decision Quality** — reliability, gaps, conflicts, diligence actions.
11. **Investment Committee Dossier** — bounded presentation of facts, calculations, uncertainties, review requirements.
12. **Audit** — immutable material-state change history.

## 7. Tool role allocation

### OpenAI Platform

**Role:** bounded interpretation and structured analytical assistance.  
**May read:** curated case context, deterministic outputs, qualified evidence references.  
**May write:** non-authoritative AI analysis objects through validated schemas.  
**Must not:** write directly into authoritative financial/valuation inputs, change evidence verification, override decision gates, or authorize transactions.

### Data Analytics

**Role:** analytical workbench for validation, sensitivity, anomaly detection, portfolio-level analysis, and model QA.  
**May read:** canonical exports or controlled snapshots.  
**May write:** derived analysis artifacts; production writes require a dedicated validated adapter.  
**Must not:** become an implicit alternate calculation engine for production metrics without explicit model governance.

### Spreadsheets

**Role:** transparent financial modelling, imports/exports, rent rolls, comparable schedules, review packs.  
**May read/write:** controlled case workbooks through explicit import/export contracts.  
**Must not:** silently overwrite canonical case state. Cell-to-field mapping, units, version, source and import approval must be explicit.

### Google Drive

**Role:** document repository / source carrier.  
**May supply:** documents to Document Intelligence through controlled ingestion.  
**Must not:** imply authenticity solely from file location or filename.

### Airtable — future operating layer

**Role:** workflow and structured operational records for deals/cases, tasks and evidence queues.  
**May write:** operational state under schema and authorization controls.  
**Must not:** supersede domain-authoritative evidence or deterministic outputs.

### Aleph — future governed enterprise data layer

**Role:** governed cross-system data access when multiple enterprise systems materially justify it.  
**Entry criterion:** at least two independent enterprise systems with repeated reconciliation/integration burden and a documented ownership model.  
**Must not:** be introduced merely as another copy of STARTAK data.

### GitHub

**Role:** code, architecture-as-code, tests, CI/CD, release governance, traceable technical change.  
**Must remain:** technical source of truth for application code and versioned architecture contracts.

## 8. Write-authority matrix

| Target state | Allowed writer | Required control |
|---|---|---|
| Raw document record | ingestion adapter | hash + case scope + immutable source identity |
| Extracted evidence | parser/AI extraction adapter | evidence contract + source locator + extraction method |
| Verified fact | verification workflow | explicit verifier + method + reference |
| Canonical economic input | human/approved adapter | schema validation + evidence link + audit |
| Deterministic output | governed engine only | versioned engine + qualified inputs |
| AI interpretation | AI adapter only | bounded schema + evidence refs + context hash |
| Decision-control state | control engine only | fail-closed gate evaluation |
| Final investment decision | authorized human process only | attribution + committee/governance record |

## 9. AI boundary

AI is positioned **after** evidence qualification and deterministic analytics for decision interpretation. AI may also assist upstream extraction, but upstream AI extraction must remain explicitly classified as extracted/unverified evidence until separately verified.

AI production calls must preserve:

- case/project scope
- context version
- evidence hash
- allowed evidence references
- role instructions
- structured output validation
- prohibited final-decision language controls
- no uncalibrated numeric confidence
- no transaction authorization

## 10. Evidence lifecycle

```text
DOCUMENT
  -> EXTRACTED_EVIDENCE
  -> NORMALIZED_EVIDENCE
  -> RECONCILIATION
  -> VERIFIED_FACT (only by explicit verification)
  -> QUALIFIED_UNDERWRITING_INPUT
  -> DETERMINISTIC OUTPUT
  -> DECISION CONTROL
```

No adapter may bypass this lifecycle for material facts merely because the source is convenient or machine-readable.

## 11. Failure policy

### HOLD conditions include

- missing required evidence
- unresolved material conflict
- unit mismatch
- stale source beyond policy
- source/case/project mismatch
- unsupported adapter
- failed schema validation
- missing critical evidence
- analytical stage not ready
- decision-quality hold
- professional review required but incomplete
- AI context stale or mismatched

### READY means

`READY` only means the named gate is technically satisfied. It does **not** mean the asset should be acquired or sold.

## 12. Audit requirements

For each material state change, record:

- event id
- timestamp
- actor/service identity
- caseId/projectId
- action
- prior state hash where applicable
- new state hash where applicable
- source/evidence refs
- reason code
- adapter/tool identity
- schema/engine version
- correlation id

No external connector should receive unrestricted write authority.

## 13. Integration contract pattern

Every external adapter should implement a common control envelope:

```json
{
  "schemaVersion": 1,
  "adapterId": "...",
  "operation": "READ|INGEST|PROPOSE_WRITE|EXPORT",
  "caseId": "...",
  "projectId": "...",
  "sourceSystem": "...",
  "sourceObjectId": "...",
  "sourceVersion": "...",
  "observedAt": "...",
  "payload": {},
  "contentHash": "...",
  "requestedBy": "..."
}
```

Direct external writes into deterministic engine outputs or decision status are prohibited.

## 14. Pilot definition — existing investment building in Riyadh

The first end-to-end integration pilot should prove one real case through the following path:

1. Create scoped `caseId` + `projectId`.
2. Ingest title/ownership, lease/rent roll, operating-cost evidence, valuation/market evidence and relevant permits.
3. Hash/classify each source.
4. Extract evidence with source locators.
5. Reconcile material fields.
6. Complete required human verification steps.
7. Build canonical property/tenant/regulatory/valuation/financial inputs.
8. Run deterministic analytical stages.
9. Run scenario/risk and decision thresholds.
10. Evaluate end-to-end orchestration gates.
11. Call bounded AI Analyst/Challenger/Synthesizer only from the accepted case context.
12. Produce an investment-committee review dossier.
13. Record human review outcome separately from automated outputs.

## 15. Pilot acceptance criteria

The pilot is accepted only if all of the following are proven:

- No cross-case data can enter the case.
- Every material input is traceable to evidence or an explicit documented assumption.
- Conflicting material sources produce HOLD rather than silent winner selection.
- Spreadsheet imports cannot overwrite canonical values without validation.
- AI cannot introduce an unknown evidence reference.
- AI cannot alter deterministic engine output.
- AI cannot issue transaction authorization.
- Missing Critical Evidence Requirements hold the relevant valuation method/stage.
- Existing study orchestration reaches READY only when all required analytical stages are ready.
- Every material write creates an attributable audit event.
- Legacy Saved Deals without new integration metadata remain readable.
- Release verification remains green.

## 16. Delivery sequence

### Phase A — Architecture control baseline

- [x] Create isolated branch.
- [x] Define architecture baseline.
- [ ] Add Source-of-Truth Matrix.
- [ ] Add Tool Governance Matrix.
- [ ] Add Pilot Acceptance Matrix.
- [ ] Validate against existing source modules/tests.

### Phase B — Canonical integration contracts

- [ ] Define connector envelope contract in code.
- [ ] Define canonical source/evidence metadata contract.
- [ ] Add adapter permission model.
- [ ] Add audit-event contract.
- [ ] Add architecture tests.

### Phase C — First controlled connector

Recommended first connector: **Google Drive/document ingestion**, because it feeds the existing Document Intelligence foundation without granting authority to an external operational database.

### Phase D — Spreadsheet controlled import/export

- explicit workbook schema
- cell/range mapping
- unit validation
- import diff
- human approval before canonical write

### Phase E — Production AI/Data Analytics integration refinement

- keep deterministic calculations authoritative
- consume only curated canonical snapshots
- preserve context/evidence hashes
- structured validated outputs only

### Phase F — Airtable operational workflow

Introduce only after canonical case and write-authority contracts are stable.

### Phase G — Aleph enterprise layer

Introduce only when cross-system complexity meets the documented entry criterion.

## 17. Non-goals for this architecture baseline

This document does not claim that Google Drive, Airtable, Aleph, Data Analytics or spreadsheet connectors are already implemented in the production application. It defines their permitted roles and the control contracts required before implementation.

It also does not change production financial or valuation calculations, migrate existing saved records, authorize a transaction, or grant any external tool unrestricted write access.

## 18. Immediate next implementation task

**Task IA-1 — Source-of-Truth + Tool Governance Contracts**

Deliverables:

1. machine-readable Source-of-Truth matrix;
2. machine-readable Tool Governance matrix;
3. canonical integration-envelope contract;
4. fail-closed validation tests;
5. no production deployment until reviewed and explicitly approved.
