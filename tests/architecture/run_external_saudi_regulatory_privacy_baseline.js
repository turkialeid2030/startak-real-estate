'use strict';

const assert = require('assert');
const batch = require('../../governance/external-saudi-regulatory-privacy-baseline-2026.json');
const guard = require('../../src/compliance/saudi-regulatory-privacy-source-baseline.js');

let checks = 0;
function check(fn) { fn(); checks += 1; }
function expectThrow(fn, pattern) { check(() => assert.throws(fn, pattern)); }

check(() => assert.strictEqual(batch.verificationBatchId, 'STARTAK-EXT-SAUDI-REG-PRIVACY-2026-09-08-B'));
check(() => assert.strictEqual(batch.verifiedAt, '2026-09-08'));
check(() => assert.strictEqual(batch.candidateHeadSha, '12394a6968c33d5b1c4a34d553235b8f4c93fc3f'));
check(() => assert.strictEqual(batch.records.length, 8));
check(() => assert.strictEqual(batch.blockers.length, 2));
check(() => assert.strictEqual(batch.blockers.every((item) => item.closed === false), true));
check(() => assert.strictEqual(batch.legalApplicabilityReviewComplete, false));
check(() => assert.strictEqual(batch.pdplComplianceEstablished, false));
check(() => assert.strictEqual(batch.saudiProfessionalLicensingEstablished, false));
check(() => assert.strictEqual(batch.productionControlImplementationVerified, false));
check(() => assert.strictEqual(batch.externalLegalOpinionEstablished, false));
check(() => assert.strictEqual(batch.mergeAuthorized, false));
check(() => assert.strictEqual(batch.deploymentAuthorized, false));
check(() => assert.strictEqual(batch.remainingExternalReview.length >= 5, true));

const assessment = guard.assessSaudiRegulatoryPrivacyBaseline(batch);
check(() => assert.strictEqual(assessment.status, guard.BATCH_STATUS.OFFICIAL_SOURCE_BASELINE_READY_FOR_EXTERNAL_LEGAL_PRIVACY_REVIEW));
check(() => assert.strictEqual(assessment.sourceRecordsValidated, 8));
check(() => assert.strictEqual(guard.verifySaudiRegulatoryPrivacyBaselineAssessment(assessment).valid, true));
check(() => assert.strictEqual(assessment.legalApplicabilityReviewComplete, false));
check(() => assert.strictEqual(assessment.pdplComplianceEstablished, false));
check(() => assert.strictEqual(assessment.saudiProfessionalLicensingEstablished, false));
check(() => assert.strictEqual(assessment.productionControlImplementationVerified, false));
check(() => assert.strictEqual(assessment.externalLegalOpinionEstablished, false));
check(() => assert.strictEqual(assessment.privacyOfficerOrCounselReviewRequired, true));
check(() => assert.strictEqual(assessment.saudiProfessionalLegalReviewRequired, true));
check(() => assert.strictEqual(assessment.productionEvidenceRequired, true));
check(() => assert.strictEqual(assessment.mergeAuthorized, false));
check(() => assert.strictEqual(assessment.deploymentAuthorized, false));
check(() => assert.strictEqual(assessment.transactionAuthorized, false));

const byId = new Map(batch.records.map((item) => [item.sourceId, item]));
const pdpl = byId.get('SDAIA-PDPL-CURRENT');
check(() => assert.strictEqual(pdpl.sourceStatus, 'ACTIVE'));
check(() => assert.strictEqual(pdpl.effectiveDate, '2023-09-14'));
check(() => assert.strictEqual(pdpl.domain, 'dgp.sdaia.gov.sa'));
check(() => assert.strictEqual(pdpl.platformControlImplications.includes('DATA_INVENTORY_AND_CLASSIFICATION_REQUIRED'), true));

const pdplReg = byId.get('SDAIA-PDPL-IMPLEMENTING-REGULATION');
check(() => assert.strictEqual(pdplReg.sourceStatus, 'ACTIVE'));
check(() => assert.strictEqual(pdplReg.effectiveDate, '2023-09-14'));
check(() => assert.strictEqual(pdplReg.verifiedFacts.some((fact) => /72 hours/.test(fact)), true));
check(() => assert.strictEqual(pdplReg.verifiedFacts.some((fact) => /five years/.test(fact)), true));
check(() => assert.strictEqual(pdplReg.platformControlImplications.includes('DPIA_TRIGGER_AND_EVIDENCE_WORKFLOW'), true));
check(() => assert.strictEqual(pdplReg.platformControlImplications.includes('PROCESSOR_AND_SUBPROCESSOR_REGISTER'), true));
check(() => assert.strictEqual(pdplReg.platformControlImplications.includes('ROPA_RETENTION_AND_AUDITABILITY'), true));

const transfer = byId.get('SDAIA-PDPL-CROSS-BORDER-TRANSFER-REGULATION');
check(() => assert.strictEqual(transfer.sourceStatus, 'ACTIVE'));
check(() => assert.strictEqual(transfer.platformControlImplications.includes('TRANSFER_RISK_ASSESSMENT_GATE'), true));
check(() => assert.strictEqual(transfer.verifiedFacts.some((fact) => /Binding Common Rules/.test(fact)), true));

const taqeemReg = byId.get('TAQEEM-IMPLEMENTING-REGULATION-CURRENT');
check(() => assert.strictEqual(taqeemReg.domain, 'taqeem.gov.sa'));
check(() => assert.strictEqual(taqeemReg.sourceStatus, 'CURRENT_OFFICIAL_SOURCE'));
check(() => assert.strictEqual(taqeemReg.platformControlImplications.includes('LICENSE_AND_MEMBERSHIP_CREDENTIALS_REQUIRE_EXTERNAL_VERIFICATION'), true));

const conduct = byId.get('TAQEEM-CODE-OF-CONDUCT-2023-CURRENT');
check(() => assert.strictEqual(conduct.verifiedFacts.some((fact) => /24 July 2023/.test(fact)), true));
check(() => assert.strictEqual(conduct.platformControlImplications.includes('NO_AI_OR_SYSTEM_SIGNATURE_AS_ACCREDITED_VALUER'), true));

const financing = byId.get('TAQEEM-FINANCING-VALUATION-RULES-CURRENT');
check(() => assert.strictEqual(financing.sourceStatus, 'CURRENT_OFFICIAL_SOURCE'));
check(() => assert.strictEqual(financing.verifiedFacts.some((fact) => /Saudi Central Bank/.test(fact)), true));
check(() => assert.strictEqual(financing.platformControlImplications.includes('SAMA_CONTEXT_REMAINS_SEPARATE_PURPOSE_DEPENDENT_ROUTER'), true));

const realEstate = byId.get('TAQEEM-REAL-ESTATE-SECTOR-OBLIGATIONS-2026');
check(() => assert.strictEqual(realEstate.verifiedFacts.some((fact) => /complete work file/i.test(fact)), true));
check(() => assert.strictEqual(realEstate.platformControlImplications.includes('WORKFILE_CHAIN_OF_CUSTODY_REQUIRED'), true));
check(() => assert.strictEqual(realEstate.platformControlImplications.includes('REPORT_SIGNING_AND_CREDENTIAL_VALIDATION_EXTERNAL_GATE'), true));

const reportTemplate = byId.get('TAQEEM-APPROVED-MINIMUM-REPORT-TEMPLATE-LIBRARY-2026');
check(() => assert.strictEqual(reportTemplate.sourceStatus, 'CURRENT_OFFICIAL_SOURCE_AVAILABLE'));
check(() => assert.strictEqual(reportTemplate.platformControlImplications.includes('REPORT_CONFORMANCE_CANNOT_BE_CLAIMED_FROM_LIBRARY_LISTING_ALONE'), true));

batch.records.forEach((record, index) => check(() => assert.match(guard.normalizeRecord(record, index).sourceFactHashSha256, /^[a-f0-9]{64}$/)));

// Both blockers must remain explicitly open.
for (const blockerId of guard.REQUIRED_OPEN_BLOCKERS) {
  const mutation = JSON.parse(JSON.stringify(batch));
  mutation.blockers.find((item) => item.blockerId === blockerId).closed = true;
  const result = guard.assessSaudiRegulatoryPrivacyBaseline(mutation);
  check(() => assert.strictEqual(result.status, guard.BATCH_STATUS.HOLD_BLOCKER_BOUNDARY));
  check(() => assert.strictEqual(result.issues.includes(`REQUIRED_BLOCKER_MUST_REMAIN_OPEN:${blockerId}`), true));
}

// Source recording cannot be converted into legal, PDPL, licensing, production, merge, or deployment claims.
for (const field of [
  'legalApplicabilityReviewComplete', 'pdplComplianceEstablished', 'saudiProfessionalLicensingEstablished',
  'productionControlImplementationVerified', 'externalLegalOpinionEstablished', 'mergeAuthorized', 'deploymentAuthorized',
]) {
  const mutation = { ...batch, [field]: true };
  const result = guard.assessSaudiRegulatoryPrivacyBaseline(mutation);
  check(() => assert.strictEqual(result.status, guard.BATCH_STATUS.HOLD_PRODUCTION_CLAIM));
  check(() => assert.strictEqual(result.issues.includes(`FORBIDDEN_COMPLETION_OR_AUTHORITY_CLAIM:${field}`), true));
}

// Official URL/domain checks are fail closed.
const badHost = JSON.parse(JSON.stringify(batch.records[0]));
badHost.sourceUrl = 'https://example.com/pdpl';
expectThrow(() => guard.normalizeRecord(badHost, 0), /hostname does not match domain/);
const badDomain = JSON.parse(JSON.stringify(batch.records[0]));
badDomain.domain = 'example.com';
expectThrow(() => guard.normalizeRecord(badDomain, 0), /domain is not allow-listed/);
const insecure = JSON.parse(JSON.stringify(batch.records[0]));
insecure.sourceUrl = 'http://dgp.sdaia.gov.sa/pdpl';
expectThrow(() => guard.normalizeRecord(insecure, 0), /must use https/);
const badDate = JSON.parse(JSON.stringify(batch.records[0]));
badDate.effectiveDate = '2023-99-99';
expectThrow(() => guard.normalizeRecord(badDate, 0), /valid date/);

// Duplicate source IDs invalidate source integrity.
const duplicate = JSON.parse(JSON.stringify(batch));
duplicate.records.push({ ...duplicate.records[0] });
const duplicateResult = guard.assessSaudiRegulatoryPrivacyBaseline(duplicate);
check(() => assert.strictEqual(duplicateResult.status, guard.BATCH_STATUS.HOLD_SCHEMA_OR_SOURCE_INTEGRITY));
check(() => assert.strictEqual(duplicateResult.issues.some((issue) => issue.startsWith('DUPLICATE_SOURCE_ID:')), true));

// Assessment is content-addressed.
const tampered = { ...assessment, status: guard.BATCH_STATUS.HOLD_PRODUCTION_CLAIM };
check(() => assert.strictEqual(guard.verifySaudiRegulatoryPrivacyBaselineAssessment(tampered).valid, false));

console.log(`EXTERNAL_SAUDI_REGULATORY_PRIVACY_BASELINE=PASS checks=${checks}`);
