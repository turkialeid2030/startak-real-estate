'use strict';

const assert = require('assert');
const crypto = require('crypto');
const rc = require('../../src/qualification/final-engineering-release-candidate.js');

let checks = 0;
function check(fn) { fn(); checks += 1; }
function sha(value) { return crypto.createHash('sha256').update(String(value)).digest('hex'); }
function expectThrow(fn, pattern) { check(() => assert.throws(fn, pattern)); }

const QUALIFIED_PARENT = rc.WAVE17_QUALIFIED_HEADS.WAVE_17D;

function scopeEvidence(scope, index = 0, overrides = {}) {
  return {
    scope,
    status: overrides.status || rc.ENGINEERING_SCOPE_STATUS.ENGINEERING_QUALIFIED,
    closeoutRef: overrides.closeoutRef || `CLOSEOUT-${scope}`,
    closeoutHashSha256: overrides.closeoutHashSha256 || sha(`closeout-${scope}`),
    exactHeadSha: overrides.exactHeadSha || String(index + 2).repeat(40).slice(0, 40),
    qualificationRef: overrides.qualificationRef || `QUALIFICATION-${scope}`,
  };
}

function scopes() {
  return Object.values(rc.PROGRAM_SCOPE).map((scope, index) => scopeEvidence(scope, index));
}

function candidate(overrides = {}) {
  return rc.createFinalEngineeringReleaseCandidate({
    candidateId: overrides.candidateId || 'STARTAK-FINAL-ENGINEERING-RC-2026-09-08',
    candidateParentSha: overrides.candidateParentSha || QUALIFIED_PARENT,
    programScopeEvidence: overrides.programScopeEvidence || scopes(),
    canonicalReleaseEvidenceRef: overrides.canonicalReleaseEvidenceRef || 'CANONICAL-RELEASE-VERIFY-FINAL-RC',
    canonicalReleaseEvidenceHashSha256: overrides.canonicalReleaseEvidenceHashSha256 || sha('canonical-release-evidence-final-rc'),
    openExternalBlockers: overrides.openExternalBlockers || [...rc.REQUIRED_EXTERNAL_BLOCKERS],
    assembledBy: overrides.assembledBy || 'ENGINEERING-ASSEMBLER',
    reviewedBy: overrides.reviewedBy || 'ENGINEERING-REVIEWER',
    assembledAt: overrides.assembledAt || '2026-09-08T08:00:00Z',
    reviewedAt: overrides.reviewedAt || '2026-09-08T09:00:00Z',
  });
}

// Export surface and immutable program constants.
check(() => assert.strictEqual(typeof rc.createFinalEngineeringReleaseCandidate, 'function'));
check(() => assert.strictEqual(typeof rc.verifyFinalEngineeringReleaseCandidate, 'function'));
check(() => assert.strictEqual(rc.OPERATING_MODE, 'UNLICENSED_DECISION_SUPPORT'));
check(() => assert.strictEqual(rc.WAVE17_QUALIFIED_HEADS.WAVE_17A, '49c5b406c2b342f458b74053f28421c653821dce'));
check(() => assert.strictEqual(rc.WAVE17_QUALIFIED_HEADS.WAVE_17B, 'a2fdc0d04548e864c18688da9835453c14b6631f'));
check(() => assert.strictEqual(rc.WAVE17_QUALIFIED_HEADS.WAVE_17C, 'f64a484988d529bdcbd3c23e9a4d5a3bdb20d754'));
check(() => assert.strictEqual(rc.WAVE17_QUALIFIED_HEADS.WAVE_17D, 'f30d89bd737c43046023a3aeb5da17e8c3511774'));
check(() => assert.strictEqual(Object.values(rc.PROGRAM_SCOPE).length, 4));
check(() => assert.strictEqual(rc.REQUIRED_EXTERNAL_BLOCKERS.length, 9));
check(() => assert.strictEqual(new Set(rc.REQUIRED_EXTERNAL_BLOCKERS).size, rc.REQUIRED_EXTERNAL_BLOCKERS.length));
[
  'OFFICIAL_STANDARDS_SOURCE_VERIFICATION',
  'SAUDI_PROFESSIONAL_LICENSING_AND_LEGAL_REVIEW',
  'PDPL_AND_DATA_GOVERNANCE_EXTERNAL_REVIEW',
  'INDEPENDENT_PRODUCTION_SECURITY_VALIDATION',
  'INDEPENDENT_PRODUCTION_PERFORMANCE_RESILIENCE_VALIDATION',
  'REVIEWER_CREDENTIAL_AND_INDEPENDENCE_VERIFICATION',
  'CANONICAL_EXTERNAL_SOURCE_HASH_COMPARISON',
  'HUMAN_RELEASE_AUTHORITY_APPROVAL',
  'MERGE_AND_DEPLOY_AUTHORIZATION',
].forEach((blocker) => check(() => assert.strictEqual(rc.REQUIRED_EXTERNAL_BLOCKERS.includes(blocker), true, `${blocker} missing`)));

const ready = candidate();
check(() => assert.strictEqual(ready.status, rc.FINAL_ENGINEERING_STATUS.ENGINEERING_RELEASE_CANDIDATE_ASSEMBLED_WITH_EXTERNAL_BLOCKERS));
check(() => assert.strictEqual(rc.verifyFinalEngineeringReleaseCandidate(ready).valid, true));
check(() => assert.strictEqual(ready.engineeringScopeComplete, true));
check(() => assert.strictEqual(ready.numberedEngineeringWavesThrough17Closed, true));
check(() => assert.strictEqual(ready.externalBlockersRemainOpen, true));
check(() => assert.strictEqual(ready.programScopeEvidence.length, 4));
check(() => assert.strictEqual(new Set(ready.programScopeEvidence.map((item) => item.scope)).size, 4));
check(() => assert.strictEqual(ready.openExternalBlockers.length, rc.REQUIRED_EXTERNAL_BLOCKERS.length));
check(() => assert.strictEqual(ready.candidateParentSha, QUALIFIED_PARENT));
check(() => assert.strictEqual(ready.operatingMode, rc.OPERATING_MODE));
check(() => assert.strictEqual(/^[a-f0-9]{64}$/.test(ready.manifestHashSha256), true));

// Engineering completion must never collapse external/regulatory/release authority boundaries.
[
  'formalStandardsConformanceEstablished',
  'officialStandardsSourceVerificationComplete',
  'saudiProfessionalLicensingEstablished',
  'saudiLegalReviewComplete',
  'pdplComplianceEstablished',
  'productionSecurityValidated',
  'productionPerformanceValidated',
  'productionResilienceValidated',
  'externalPenetrationTestEstablished',
  'reviewerCredentialsVerified',
  'reviewerIndependenceVerified',
  'certifiedValuationAuthorityEstablished',
  'professionalReportExternalIssuanceAuthorized',
  'releaseAuthorized',
  'mergeAuthorized',
  'deploymentAuthorized',
  'transactionAuthorized',
].forEach((field) => check(() => assert.strictEqual(ready[field], false, `${field} must remain false`)));
check(() => assert.strictEqual(ready.humanReleaseAuthorityApprovalRequired, true));

// Parent must be the exact qualified Wave 17D closeout head.
const wrongParent = candidate({ candidateParentSha: '9'.repeat(40) });
check(() => assert.strictEqual(wrongParent.status, rc.FINAL_ENGINEERING_STATUS.HOLD_PARENT_SCOPE));
check(() => assert.strictEqual(wrongParent.engineeringScopeComplete, false));
check(() => assert.strictEqual(wrongParent.issues.includes('CANDIDATE_PARENT_MUST_EQUAL_QUALIFIED_WAVE17D_HEAD'), true));

// Every program scope must be represented exactly once.
const missingScope = candidate({ programScopeEvidence: scopes().slice(1) });
check(() => assert.strictEqual(missingScope.status, rc.FINAL_ENGINEERING_STATUS.HOLD_PROGRAM_SCOPE));
check(() => assert.strictEqual(missingScope.engineeringScopeComplete, false));
check(() => assert.strictEqual(missingScope.issues.some((issue) => issue.startsWith('MISSING_PROGRAM_SCOPE:')), true));
const duplicateScopes = [...scopes(), scopeEvidence(rc.PROGRAM_SCOPE.FOUNDATION_AND_PROFESSIONAL_VALUATION, 9)];
const duplicateScope = candidate({ programScopeEvidence: duplicateScopes });
check(() => assert.strictEqual(duplicateScope.status, rc.FINAL_ENGINEERING_STATUS.HOLD_SCOPE_EVIDENCE_INTEGRITY));
check(() => assert.strictEqual(duplicateScope.issues.includes(`DUPLICATE_PROGRAM_SCOPE:${rc.PROGRAM_SCOPE.FOUNDATION_AND_PROFESSIONAL_VALUATION}`), true));

// External blocker register is mandatory; engineering qualification cannot silently erase external work.
const missingBlockerList = rc.REQUIRED_EXTERNAL_BLOCKERS.filter((item) => item !== 'PDPL_AND_DATA_GOVERNANCE_EXTERNAL_REVIEW');
const missingBlocker = candidate({ openExternalBlockers: missingBlockerList });
check(() => assert.strictEqual(missingBlocker.status, rc.FINAL_ENGINEERING_STATUS.HOLD_EXTERNAL_BLOCKER_REGISTER));
check(() => assert.strictEqual(missingBlocker.engineeringScopeComplete, false));
check(() => assert.strictEqual(missingBlocker.issues.includes('MISSING_REQUIRED_EXTERNAL_BLOCKER:PDPL_AND_DATA_GOVERNANCE_EXTERNAL_REVIEW'), true));
const emptyBlockers = candidate({ openExternalBlockers: [] });
check(() => assert.strictEqual(emptyBlockers.status, rc.FINAL_ENGINEERING_STATUS.HOLD_EXTERNAL_BLOCKER_REGISTER));
check(() => assert.strictEqual(emptyBlockers.externalBlockersRemainOpen, true));

// Final candidate requires accountable two-person review separation.
const selfReviewed = candidate({ assembledBy: 'SAME-PERSON', reviewedBy: 'SAME-PERSON' });
check(() => assert.strictEqual(selfReviewed.status, rc.FINAL_ENGINEERING_STATUS.HOLD_REVIEW_GOVERNANCE));
check(() => assert.strictEqual(selfReviewed.engineeringScopeComplete, false));

// Integrity hash binds the program evidence, blockers, dates and authority state.
const tamperedId = { ...ready, candidateId: 'TAMPERED' };
check(() => assert.strictEqual(rc.verifyFinalEngineeringReleaseCandidate(tamperedId).valid, false));
check(() => assert.strictEqual(rc.verifyFinalEngineeringReleaseCandidate(tamperedId).reasonCode, 'FINAL_CANDIDATE_HASH_MISMATCH'));
const tamperedBlockers = { ...ready, openExternalBlockers: ready.openExternalBlockers.slice(1) };
check(() => assert.strictEqual(rc.verifyFinalEngineeringReleaseCandidate(tamperedBlockers).valid, false));
const tamperedScope = { ...ready, programScopeEvidence: ready.programScopeEvidence.map((item, index) => index === 0 ? { ...item, qualificationRef: 'TAMPERED' } : item) };
check(() => assert.strictEqual(rc.verifyFinalEngineeringReleaseCandidate(tamperedScope).valid, false));
const tamperedParent = { ...ready, candidateParentSha: '8'.repeat(40) };
check(() => assert.strictEqual(rc.verifyFinalEngineeringReleaseCandidate(tamperedParent).valid, false));

// Invalid source evidence / schema cannot be promoted into the final candidate.
expectThrow(() => candidate({ candidateParentSha: 'short' }), /git commit SHA/);
expectThrow(() => candidate({ canonicalReleaseEvidenceHashSha256: 'bad' }), /SHA-256/);
expectThrow(() => candidate({ assembledAt: 'not-a-date' }), /ISO-compatible timestamp/);
expectThrow(() => candidate({ assembledAt: '2026-09-08T10:00:00Z', reviewedAt: '2026-09-08T09:00:00Z' }), /reviewedAt must be on or after assembledAt/);
expectThrow(() => candidate({ programScopeEvidence: [scopeEvidence('UNKNOWN_SCOPE')] }), /scope unsupported/);
expectThrow(() => candidate({ programScopeEvidence: [scopeEvidence(rc.PROGRAM_SCOPE.FOUNDATION_AND_PROFESSIONAL_VALUATION, 0, { status: 'HOLD' })] }), /status must be ENGINEERING_QUALIFIED/);
expectThrow(() => candidate({ programScopeEvidence: [scopeEvidence(rc.PROGRAM_SCOPE.FOUNDATION_AND_PROFESSIONAL_VALUATION, 0, { closeoutHashSha256: 'bad' })] }), /SHA-256/);
expectThrow(() => candidate({ programScopeEvidence: [scopeEvidence(rc.PROGRAM_SCOPE.FOUNDATION_AND_PROFESSIONAL_VALUATION, 0, { exactHeadSha: 'bad' })] }), /git commit SHA/);

console.log(`FINAL_ENGINEERING_RELEASE_CANDIDATE=PASS checks=${checks}`);
