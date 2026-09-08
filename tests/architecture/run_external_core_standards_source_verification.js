'use strict';

const assert = require('assert');
const path = require('path');
const batch = require(path.join('../../governance/external-core-standards-source-verification-2026.json'));
const verification = require('../../src/standards/external-source-verification.js');

let checks = 0;
function check(fn) { fn(); checks += 1; }
function expectThrow(fn, pattern) { check(() => assert.throws(fn, pattern)); }

check(() => assert.strictEqual(batch.blockerId, 'OFFICIAL_STANDARDS_SOURCE_VERIFICATION'));
check(() => assert.strictEqual(batch.blockerDisposition, 'PARTIALLY_RESOLVED_CORE_VALUATION_SOURCES_VERIFIED'));
check(() => assert.strictEqual(batch.officialStandardsSourceVerificationComplete, false));
check(() => assert.strictEqual(batch.productionStandardsActivationAuthorized, false));
check(() => assert.strictEqual(batch.formalStandardsConformanceEstablished, false));
check(() => assert.strictEqual(batch.professionalReviewRequired, true));
check(() => assert.strictEqual(batch.legalApplicabilityReviewRequired, true));
check(() => assert.strictEqual(batch.candidateHeadSha, 'f5cce13e9ac7bb7b5a2d55936f41b3151b8733d5'));
check(() => assert.strictEqual(batch.verifiedAt, '2026-09-08'));
check(() => assert.strictEqual(batch.records.length, 9));
check(() => assert.strictEqual(batch.remainingSourceVerificationWork.length >= 6, true));

const assessment = verification.assessExternalStandardsSourceBatch(batch);
check(() => assert.strictEqual(assessment.status, verification.BATCH_STATUS.CORE_SOURCES_VERIFIED_PENDING_APPLICABILITY_REVIEW));
check(() => assert.strictEqual(verification.verifyExternalStandardsSourceBatchAssessment(assessment).valid, true));
check(() => assert.strictEqual(assessment.sourceRecordsValidated, 9));
check(() => assert.strictEqual(assessment.officialStandardsSourceVerificationComplete, false));
check(() => assert.strictEqual(assessment.productionStandardsActivationAuthorized, false));
check(() => assert.strictEqual(assessment.formalStandardsConformanceEstablished, false));
check(() => assert.strictEqual(assessment.sourceVerificationCanChangeRegistryStatusToActive, false));
check(() => assert.strictEqual(assessment.draftSourcesCanAffectProduction, false));
check(() => assert.strictEqual(assessment.professionalReviewRequired, true));
check(() => assert.strictEqual(assessment.legalApplicabilityReviewRequired, true));
check(() => assert.strictEqual(assessment.mergeAuthorized, false));
check(() => assert.strictEqual(assessment.deploymentAuthorized, false));
check(() => assert.strictEqual(assessment.transactionAuthorized, false));

const byId = new Map(batch.records.map((record) => [record.sourceId, record]));
const ivs = byId.get('IVSC-IVS-EFFECTIVE-2025-01-31');
check(() => assert.strictEqual(ivs.sourceStatus, 'CURRENT_EFFECTIVE'));
check(() => assert.strictEqual(ivs.publicationDate, '2024-01-31'));
check(() => assert.strictEqual(ivs.effectiveDate, '2025-01-31'));
check(() => assert.strictEqual(ivs.officialDomain, 'ivsc.org'));
check(() => assert.strictEqual(ivs.productionEnforcementEligible, false));

const taqeemIvs = byId.get('TAQEEM-IVS-AR-EFFECTIVE-2025-01-31');
check(() => assert.strictEqual(taqeemIvs.officialDomain, 'taqeem.gov.sa'));
check(() => assert.strictEqual(taqeemIvs.effectiveDate, '2025-01-31'));
check(() => assert.match(taqeemIvs.applicabilityConclusion, /NO_AUTOMATIC_LEGAL_APPLICABILITY_CONCLUSION/));

const redBook = byId.get('RICS-RED-BOOK-GLOBAL-2025');
check(() => assert.strictEqual(redBook.sourceStatus, 'CURRENT_EFFECTIVE'));
check(() => assert.strictEqual(redBook.effectiveDate, '2025-01-31'));
check(() => assert.strictEqual(redBook.officialDomain, 'rics.org'));

const esg = byId.get('RICS-ESG-COMMERCIAL-VALUATION-4E-2026');
check(() => assert.strictEqual(esg.publicationDate, '2026-01-28'));
check(() => assert.strictEqual(esg.effectiveDate, '2026-04-30'));
check(() => assert.strictEqual(esg.productionEnforcementEligible, false));

const comparableCurrent = byId.get('RICS-COMPARABLE-EVIDENCE-1E-CURRENT');
check(() => assert.strictEqual(comparableCurrent.sourceStatus, 'CURRENT_UNTIL_SUCCESSOR_FINAL'));
check(() => assert.strictEqual(comparableCurrent.reissuedDate, '2023-04-19'));

const comparableDraft = byId.get('RICS-COMPARABLE-EVIDENCE-2E-DRAFT-2026');
check(() => assert.strictEqual(comparableDraft.sourceStatus, 'DRAFT_CONSULTATION'));
check(() => assert.strictEqual(comparableDraft.consultationClosesDate, '2026-09-18'));
check(() => assert.strictEqual(comparableDraft.productionEnforcementEligible, false));
check(() => assert.match(comparableDraft.applicabilityConclusion, /DRAFT_MUST_NOT_AFFECT_PRODUCTION/));

const taqeemLaw = byId.get('TAQEEM-ACCREDITED-VALUERS-LAW-CURRENT-SOURCE');
check(() => assert.strictEqual(taqeemLaw.sourceStatus, 'CURRENT_OFFICIAL_SOURCE'));
check(() => assert.strictEqual(taqeemLaw.productionEnforcementEligible, false));
check(() => assert.match(taqeemLaw.applicabilityConclusion, /LEGAL_APPLICABILITY_REVIEW_STILL_REQUIRED/));

const rega = byId.get('REGA-REAL-ESTATE-CONSULTATION-ANALYSIS-REGULATION');
check(() => assert.strictEqual(rega.sourceStatus, 'ACTIVE_REGULATION'));
check(() => assert.strictEqual(rega.officialDomain, 'rega.gov.sa'));
check(() => assert.strictEqual(rega.productionEnforcementEligible, false));
check(() => assert.match(rega.applicabilityConclusion, /LEGAL_SCOPE_REVIEW_STILL_REQUIRED/));

batch.records.forEach((record, index) => {
  check(() => assert.strictEqual(verification.validateSourceRecord(record, index).productionEnforcementEligible, false));
});

// Draft content can never be made production-enforcing merely through source verification.
const draftViolation = JSON.parse(JSON.stringify(batch));
draftViolation.records.find((record) => record.sourceStatus === 'DRAFT_CONSULTATION').productionEnforcementEligible = true;
const draftViolationAssessment = verification.assessExternalStandardsSourceBatch(draftViolation);
check(() => assert.strictEqual(draftViolationAssessment.status, verification.BATCH_STATUS.HOLD_DRAFT_ENFORCEMENT_VIOLATION));
check(() => assert.strictEqual(draftViolationAssessment.issues.some((issue) => issue.startsWith('DRAFT_PRODUCTION_ENFORCEMENT_FORBIDDEN:')), true));

// Even current official sources do not independently authorize production enforcement.
const currentViolation = JSON.parse(JSON.stringify(batch));
currentViolation.records.find((record) => record.sourceStatus === 'CURRENT_EFFECTIVE').productionEnforcementEligible = true;
const currentViolationAssessment = verification.assessExternalStandardsSourceBatch(currentViolation);
check(() => assert.strictEqual(currentViolationAssessment.status, verification.BATCH_STATUS.HOLD_PRODUCTION_ENFORCEMENT_ASSERTION));

// The batch must remain explicitly incomplete until the remaining official/legal/professional work is closed.
const completionViolation = { ...batch, officialStandardsSourceVerificationComplete: true };
const completionAssessment = verification.assessExternalStandardsSourceBatch(completionViolation);
check(() => assert.strictEqual(completionAssessment.status, verification.BATCH_STATUS.HOLD_REVIEW_BOUNDARY));
const activationViolation = { ...batch, productionStandardsActivationAuthorized: true };
check(() => assert.strictEqual(verification.assessExternalStandardsSourceBatch(activationViolation).status, verification.BATCH_STATUS.HOLD_REVIEW_BOUNDARY));
const conformanceViolation = { ...batch, formalStandardsConformanceEstablished: true };
check(() => assert.strictEqual(verification.assessExternalStandardsSourceBatch(conformanceViolation).status, verification.BATCH_STATUS.HOLD_REVIEW_BOUNDARY));
const reviewViolation = { ...batch, professionalReviewRequired: false };
check(() => assert.strictEqual(verification.assessExternalStandardsSourceBatch(reviewViolation).status, verification.BATCH_STATUS.HOLD_REVIEW_BOUNDARY));

// Official domain and URL scope are fail-closed.
const badHost = JSON.parse(JSON.stringify(batch.records[0]));
badHost.sourceUrl = 'https://example.com/not-official';
expectThrow(() => verification.validateSourceRecord(badHost, 0), /hostname does not match officialDomain/);
const badDomain = JSON.parse(JSON.stringify(batch.records[0]));
badDomain.officialDomain = 'example.com';
expectThrow(() => verification.validateSourceRecord(badDomain, 0), /officialDomain is not allow-listed/);
const insecure = JSON.parse(JSON.stringify(batch.records[0]));
insecure.sourceUrl = 'http://ivsc.org/example';
expectThrow(() => verification.validateSourceRecord(insecure, 0), /must use https/);
const badDate = JSON.parse(JSON.stringify(batch.records[0]));
badDate.effectiveDate = '2025-99-99';
expectThrow(() => verification.validateSourceRecord(badDate, 0), /ISO date/);

// Duplicate source IDs fail source-integrity assessment.
const duplicateBatch = JSON.parse(JSON.stringify(batch));
duplicateBatch.records.push({ ...duplicateBatch.records[0] });
const duplicateAssessment = verification.assessExternalStandardsSourceBatch(duplicateBatch);
check(() => assert.strictEqual(duplicateAssessment.status, verification.BATCH_STATUS.HOLD_SCHEMA_OR_SOURCE_INTEGRITY));
check(() => assert.strictEqual(duplicateAssessment.issues.some((issue) => issue.startsWith('DUPLICATE_SOURCE_ID:')), true));

// Content-addressed assessment detects mutation.
const tampered = { ...assessment, blockerDisposition: 'TAMPERED' };
check(() => assert.strictEqual(verification.verifyExternalStandardsSourceBatchAssessment(tampered).valid, false));

console.log(`EXTERNAL_CORE_STANDARDS_SOURCE_VERIFICATION=PASS checks=${checks}`);
