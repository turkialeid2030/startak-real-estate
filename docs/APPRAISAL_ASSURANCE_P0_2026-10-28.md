# STARTAK — Appraisal Assurance P0 (28 October 2026)

## Release boundary

This is a **non-certified, pure-data review engine** built as a **stacked change** on the personal research feature branch feature/location-market-valuation-20261027 (PR #763). It does not merge or deploy, authorize the release, extract files from user uploads, verify title deeds, or provide professional valuation advice.

## Included and code locations

- src/market/appraisal-assurance.js: auditAppraisal, compareVersions, classifyReportIds, and locale-aware number parser.
- src/market/index.js: exposes the module under appraisalAssurance and its named functions. Existing economics and Saved Deals remain unchanged.
- tests/valuation/appraisal-assurance.test.js: 12 regression cases with **synthetic** facts, no source reports or client data.
- src/market/valuation-decision-gate.js: optionally accepts appraisalReview. Its HOLD result adds APPRAISAL_AUDIT_HOLD to the existing hard gate; no audit result can grant approval.
- tests/valuation/appraisal-decision-bridge.test.js: 3 additional regression cases for the restrictive-only bridge.
- tools/release-verify.js and tests/verify_package.js: include valuation test folder in mandatory test discovery.

## Input contract (selected fields)

Use *manually reviewed structured input* only. Do not claim scanned PDF ingestion is implemented.

| Input | Purpose |
| --- | --- |
| reportId, valuationDate | Version identity / as-of |
| property.deedNumber, property.owner, property.rightType, property.areaSqm | Identifying mismatches; data remain in authorized private runtime |
| reported.capitalValueSar, reported.marketRentSar | Quoted valuation and rent |
| income.annualGrossRevenueSar, income.vacancyLossSar, income.operatingExpensesSar, income.annualNoiSar | NOI bridge |
| income.capitalizationRatePct, income.indicatedValueSar | Income-approach arithmetic |
| marketRent.annualRentSar, marketRent.capitalValueBasisSar, marketRent.percentOfCapitalValue, marketRent.derivation | Rent independence check |
| income.rentUsesThisEstimate, marketRent.usedAsIncomeApproachEvidence | Explicit circular dependence |
| pages.income, pages.rent | Page numbers for manual review |
| provenance.reportFileHash | Private input fingerprint; do not commit actual source hashes alongside client identities |
| provenance.comparableEvidenceIndependentlyVerified | Attested evidence flag; NOT automated source verification |

The return state is HOLD (material arithmetic/circularity issue) or REVIEW_REQUIRED (no detected blocker but never approved), always with certification: NOT_AUTHORIZED and approvedForPublication: false.

### Example (synthetic)

~~~js
const { auditAppraisal } = require('./src/market/appraisal-assurance');
const result = auditAppraisal({
  reportId:'SYNTHETIC-1', valuationDate:'2026-01-01',
  income:{annualNoiSar:2_100_000, capitalizationRatePct:7, indicatedValueSar:55_000_000},
  pages:{income:42}
});
// result.status === 'HOLD', with INCOME_CAPITALIZATION_MISMATCH
~~~

## Acceptance and non-acceptance

The 12 standalone synthetic unit checks passed locally under Node 22. Three additional bridge tests have been committed but have not been validated locally; repository CI must confirm all 15 cases and full regression for the final SHA. This is not equivalent to a production or professional qualification.

Unimplemented, therefore **open**:
1. OCR / PDF ingestion and page-level extraction with manual corrections;
2. protected evidence-store, reviewer workflow and automated authenticated evidence verification;
3. UI integration / rendering of provenance, issue severity and reasons; the headless optional decision gate bridge is implemented but is not end-to-end UI enforcement;
4. qualified hotel / fuel station / logistics / shopping-center segment models;
5. independent Saudi market benchmarking / out-of-sample validation and model calibration;
6. E2F/E2G professional, data-rights, regulatory, security, approval and production-deployment gates.

Never put confidential reports, actual deed numbers, owners, rental amounts linked to real property or private training datasets in a public repository. New review code does not change the existing HOLD/NOT_AUTHORIZED launch posture.

## Follow-up implementation plan

- P0-A: UI form for manual report fields, evidence status and discrepancy table; browser screenshots and accessibility.
- P0-B: private report version store with SHA256, deduplication by licensed property rights and as-of, not report ID alone.
- P0-C: admissibility decision connected to current decision-governance gate; no export of unsupported valuations.
- P1: sector-specific NOI/DCF models and scenario/hold/invest decision ranges, with legal rent review and investment risk.
- P2: independently licensed completed transactions, holdout QA, sector/geography MAE/MAPE and drift monitoring.


## P0-A manual workbench delivery (28 October 2026, additional changes)

- src/components/AppraisalAssuranceWorkbench.jsx mounts under the existing local document evidence workspace; RTL first, accessible labels and explicit open/close.
- Existing LocalDocumentEvidenceIntakePanel remains the only PDF/document intake path. The appraisal workbench *does not auto-import or trust OCR*; users manually enter and check numbers and page references.
- Digest from the existing local intake is shown to the reviewer; working inputs exist only in React memory and reset when the source digest changes or the reviewer presses Reset.
- The workbench shows independent NOI/cap-rate recalculation, HOLD/REVIEW_REQUIRED findings and their referenced pages, and version comparisons. There is no certified export or single-click approval action.
- tests/e2e/run_appraisal_assurance_ci.mjs exercises the RTL browser path with synthetic data; .github/workflows/location-market-study-verify.yml makes that browser test mandatory.
- **No full professional gate claim**: this review is **not yet** bound to a specific current financial Saved Deal, nor does it supersede all existing export routes; the existing optional valuation-decision-gate bridge is restrictive-only. An identity-checked canonical link and end-to-end cross-route negative tests remain required for full P0-C closure.
- **No institutionally secured document store**: existing local extraction with SHA256 is not equivalent to durable encrypted RBAC storage, retention controls or independent reviewer approval. P0-B remains open.
- Browser CI result must be checked on the final PR head SHA. Source changes above do not, by themselves, demonstrate deployment or market accuracy.
