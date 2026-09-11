'use strict';

const assert = require('assert');
const crypto = require('crypto');
const security = require('../../src/security/security-qualification-evidence.js');

let checks = 0;
function check(fn) { fn(); checks += 1; }
function sha(value) { return crypto.createHash('sha256').update(String(value)).digest('hex'); }
function expectThrow(fn, pattern) { check(() => assert.throws(fn, pattern)); }

const COMMIT = 'a'.repeat(40);
const OTHER_COMMIT = 'b'.repeat(40);
const ASSESSED_AT = '2026-09-08T08:00:00Z';
const CONTROLS = Object.values(security.SECURITY_CONTROL_CLASS);

function sourceKindFor(control) {
  const map = {
    [security.SECURITY_CONTROL_CLASS.IDENTITY_AUTHENTICATION]: security.SECURITY_EVIDENCE_SOURCE_KIND.RUNTIME_ATTESTATION,
    [security.SECURITY_CONTROL_CLASS.AUTHORIZATION_TENANT_ISOLATION]: security.SECURITY_EVIDENCE_SOURCE_KIND.RUNTIME_ATTESTATION,
    [security.SECURITY_CONTROL_CLASS.RLS_DATABASE]: security.SECURITY_EVIDENCE_SOURCE_KIND.DATABASE_RUNTIME_TEST,
    [security.SECURITY_CONTROL_CLASS.AUDIT_LOGGING]: security.SECURITY_EVIDENCE_SOURCE_KIND.RUNTIME_ATTESTATION,
    [security.SECURITY_CONTROL_CLASS.STORAGE_INTEGRITY]: security.SECURITY_EVIDENCE_SOURCE_KIND.CONFIGURATION_SNAPSHOT,
    [security.SECURITY_CONTROL_CLASS.SECRET_KEY_MANAGEMENT]: security.SECURITY_EVIDENCE_SOURCE_KIND.MANUAL_REVIEW,
    [security.SECURITY_CONTROL_CLASS.REPLAY_IDEMPOTENCY]: security.SECURITY_EVIDENCE_SOURCE_KIND.CI_RUN,
    [security.SECURITY_CONTROL_CLASS.INCIDENT_BREAK_GLASS]: security.SECURITY_EVIDENCE_SOURCE_KIND.MANUAL_REVIEW,
    [security.SECURITY_CONTROL_CLASS.VULNERABILITY_DEPENDENCY]: security.SECURITY_EVIDENCE_SOURCE_KIND.DEPENDENCY_SCAN,
    [security.SECURITY_CONTROL_CLASS.APPLICATION_RUNTIME]: security.SECURITY_EVIDENCE_SOURCE_KIND.CI_RUN,
    [security.SECURITY_CONTROL_CLASS.BACKUP_RECOVERY]: security.SECURITY_EVIDENCE_SOURCE_KIND.MANUAL_REVIEW,
  };
  return map[control];
}

function evidence(control, overrides = {}) {
  const id = overrides.evidenceId || `E-${control}`;
  return security.createSecurityQualificationEvidence({
    evidenceId: id,
    controlClass: control,
    environment: overrides.environment || security.SECURITY_EVIDENCE_ENVIRONMENT.CI_TEST,
    targetRef: overrides.targetRef || 'STARTAK-W17A-CANDIDATE',
    exactCommitSha: overrides.exactCommitSha || COMMIT,
    sourceKind: overrides.sourceKind || sourceKindFor(control),
    sourceArtifactId: overrides.sourceArtifactId || `ART-${control}`,
    sourceArtifactHashSha256: overrides.sourceArtifactHashSha256 || sha(`artifact-${control}`),
    evidenceRef: overrides.evidenceRef || `REF-${control}`,
    evidenceContentHashSha256: overrides.evidenceContentHashSha256 || sha(`evidence-${control}`),
    outcome: overrides.outcome || security.SECURITY_EVIDENCE_OUTCOME.PASS,
    issuerRef: overrides.issuerRef || 'GITHUB-ACTIONS-AND-REVIEW-EVIDENCE',
    verificationMethod: overrides.verificationMethod || 'Deterministic evidence verification for Wave 17A regression.',
    observedAt: overrides.observedAt || '2026-09-08T05:00:00Z',
    verifiedAt: overrides.verifiedAt || '2026-09-08T06:00:00Z',
    reviewedAt: overrides.reviewedAt || '2026-09-08T07:00:00Z',
    preparedBy: overrides.preparedBy || 'SECURITY-ENGINEER',
    reviewedBy: overrides.reviewedBy || 'SECURITY-REVIEWER',
    evidenceRefs: overrides.evidenceRefs || [`TRACE-${control}`],
    notes: overrides.notes === undefined ? 'Non-production qualification evidence.' : overrides.notes,
  });
}

function agePolicy(days = 7) {
  return Object.fromEntries(CONTROLS.map((control) => [control, days]));
}

function envelope(records, overrides = {}) {
  return security.buildSecurityQualificationEnvelope({
    qualificationId: overrides.qualificationId || 'W17A-Q-1',
    expectedEnvironment: overrides.expectedEnvironment || security.SECURITY_EVIDENCE_ENVIRONMENT.CI_TEST,
    exactCommitSha: overrides.exactCommitSha || COMMIT,
    upstreamSecurityAssessmentRef: overrides.upstreamSecurityAssessmentRef || 'SECURITY-TRUST-GATE-REF',
    upstreamSecurityAssessmentHashSha256: overrides.upstreamSecurityAssessmentHashSha256 || sha('upstream-security-assessment'),
    upstreamSecurityAssessmentStatus: overrides.upstreamSecurityAssessmentStatus || security.READY_UPSTREAM_STATUS,
    assessedAt: overrides.assessedAt || ASSESSED_AT,
    requiredControlClasses: overrides.requiredControlClasses || CONTROLS,
    maximumEvidenceAgeDaysByControl: overrides.maximumEvidenceAgeDaysByControl || agePolicy(),
    evidenceRecords: records,
  });
}

// Export surface and classification vocabulary.
[
  'createSecurityQualificationEvidence',
  'verifySecurityQualificationEvidence',
  'buildSecurityQualificationEnvelope',
  'verifySecurityQualificationEnvelope',
].forEach((name) => check(() => assert.strictEqual(typeof security[name], 'function', `${name} missing`)));
check(() => assert.deepStrictEqual(Object.values(security.SECURITY_EVIDENCE_ENVIRONMENT), ['CI_TEST', 'STAGING', 'PRODUCTION']));
check(() => assert.strictEqual(CONTROLS.length, 11));
check(() => assert.strictEqual(security.READY_UPSTREAM_STATUS, 'READY_FOR_INDEPENDENT_SECURITY_REVIEW'));

const records = CONTROLS.map((control) => evidence(control));
records.forEach((record) => check(() => assert.strictEqual(security.verifySecurityQualificationEvidence(record).valid, true)));
check(() => assert.strictEqual(records.every((record) => /^[a-f0-9]{64}$/.test(record.evidenceHashSha256)), true));
check(() => assert.strictEqual(records.every((record) => record.productionSecurityValidated === false), true));
check(() => assert.strictEqual(records.every((record) => record.deploymentAuthorized === false), true));

const ready = envelope(records);
check(() => assert.strictEqual(ready.status, security.SECURITY_QUALIFICATION_STATUS.READY_FOR_INDEPENDENT_SECURITY_VALIDATION));
check(() => assert.strictEqual(security.verifySecurityQualificationEnvelope(ready).valid, true));
check(() => assert.strictEqual(ready.controlSummaries.length, CONTROLS.length));
check(() => assert.strictEqual(ready.controlSummaries.every((item) => item.passingEvidenceIds.length === 1), true));
check(() => assert.strictEqual(ready.evidenceEnvironmentIsExplicit, true));
check(() => assert.strictEqual(ready.testEvidenceCanQualifyProductionScope, false));
check(() => assert.strictEqual(ready.productionSecurityValidated, false));
check(() => assert.strictEqual(ready.pdplComplianceEstablished, false));
check(() => assert.strictEqual(ready.externalPenetrationTestEstablished, false));
check(() => assert.strictEqual(ready.certifiedSecurityEstablished, false));
check(() => assert.strictEqual(ready.independentSecurityValidationRequired, true));
check(() => assert.strictEqual(ready.humanSecurityApprovalRequired, true));
check(() => assert.strictEqual(ready.mergeAuthorized, false));
check(() => assert.strictEqual(ready.deploymentAuthorized, false));
check(() => assert.strictEqual(ready.transactionAuthorized, false));

// Exact content addressing must detect mutation.
const tamperedRecord = { ...records[0], verificationMethod: 'tampered' };
check(() => assert.strictEqual(security.verifySecurityQualificationEvidence(tamperedRecord).valid, false));
check(() => assert.strictEqual(security.verifySecurityQualificationEvidence(tamperedRecord).reasonCode, 'EVIDENCE_HASH_MISMATCH'));
const tamperedEnvelope = { ...ready, assessedAt: '2026-09-08T09:00:00Z' };
check(() => assert.strictEqual(security.verifySecurityQualificationEnvelope(tamperedEnvelope).valid, false));
check(() => assert.strictEqual(security.verifySecurityQualificationEnvelope(tamperedEnvelope).reasonCode, 'QUALIFICATION_HASH_MISMATCH'));

// Missing a mandatory control holds qualification.
const missing = envelope(records.slice(1));
check(() => assert.strictEqual(missing.status, security.SECURITY_QUALIFICATION_STATUS.HOLD_REQUIRED_CONTROLS));
check(() => assert.strictEqual(missing.issues.includes(`MISSING_REQUIRED_CONTROL:${CONTROLS[0]}`), true));

// Failed evidence does not qualify a control.
const failed = records.map((record, index) => index === 0 ? evidence(record.controlClass, { outcome: security.SECURITY_EVIDENCE_OUTCOME.FAIL }) : record);
const failedResult = envelope(failed);
check(() => assert.strictEqual(failedResult.status, security.SECURITY_QUALIFICATION_STATUS.HOLD_CONTROL_FAILURE));
check(() => assert.strictEqual(failedResult.issues[0], `NO_PASSING_EVIDENCE:${CONTROLS[0]}`));

// Stale and future verification evidence both fail freshness.
const stale = records.map((record, index) => index === 0 ? evidence(record.controlClass, { observedAt: '2026-08-01T05:00:00Z', verifiedAt: '2026-08-01T06:00:00Z', reviewedAt: '2026-08-01T07:00:00Z' }) : record);
const staleResult = envelope(stale, { maximumEvidenceAgeDaysByControl: agePolicy(1) });
check(() => assert.strictEqual(staleResult.status, security.SECURITY_QUALIFICATION_STATUS.HOLD_STALE_EVIDENCE));
const future = records.map((record, index) => index === 0 ? evidence(record.controlClass, { observedAt: '2026-09-09T05:00:00Z', verifiedAt: '2026-09-09T06:00:00Z', reviewedAt: '2026-09-09T07:00:00Z' }) : record);
const futureResult = envelope(future);
check(() => assert.strictEqual(futureResult.status, security.SECURITY_QUALIFICATION_STATUS.HOLD_STALE_EVIDENCE));

// Same-person preparation/review cannot satisfy the independent-review requirement.
const selfReviewed = records.map((record, index) => index === 0 ? evidence(record.controlClass, { preparedBy: 'SAME-REVIEWER', reviewedBy: 'SAME-REVIEWER' }) : record);
const selfReviewedResult = envelope(selfReviewed);
check(() => assert.strictEqual(selfReviewedResult.status, security.SECURITY_QUALIFICATION_STATUS.HOLD_REVIEW_EVIDENCE));

// CI evidence cannot be relabelled as production evidence; exact commit is also fail-closed.
const wrongEnvironment = envelope(records, { expectedEnvironment: security.SECURITY_EVIDENCE_ENVIRONMENT.PRODUCTION });
check(() => assert.strictEqual(wrongEnvironment.status, security.SECURITY_QUALIFICATION_STATUS.HOLD_SCOPE_MISMATCH));
check(() => assert.strictEqual(wrongEnvironment.productionSecurityValidated, false));
const wrongCommit = records.map((record, index) => index === 0 ? evidence(record.controlClass, { exactCommitSha: OTHER_COMMIT }) : record);
const wrongCommitResult = envelope(wrongCommit);
check(() => assert.strictEqual(wrongCommitResult.status, security.SECURITY_QUALIFICATION_STATUS.HOLD_SCOPE_MISMATCH));

// A production-labelled set may reach only independent validation readiness, never production-security certification.
const productionRecords = CONTROLS.map((control) => evidence(control, { environment: security.SECURITY_EVIDENCE_ENVIRONMENT.PRODUCTION }));
const productionEnvelope = envelope(productionRecords, { expectedEnvironment: security.SECURITY_EVIDENCE_ENVIRONMENT.PRODUCTION, qualificationId: 'W17A-PROD-Q' });
check(() => assert.strictEqual(productionEnvelope.status, security.SECURITY_QUALIFICATION_STATUS.READY_FOR_INDEPENDENT_SECURITY_VALIDATION));
check(() => assert.strictEqual(productionEnvelope.productionSecurityValidated, false));
check(() => assert.strictEqual(productionEnvelope.externalPenetrationTestEstablished, false));
check(() => assert.strictEqual(productionEnvelope.deploymentAuthorized, false));

// Caller-supplied upstream readiness remains mandatory and cannot be inferred by this module.
const upstreamHold = envelope(records, { upstreamSecurityAssessmentStatus: 'HOLD_RLS_EVIDENCE' });
check(() => assert.strictEqual(upstreamHold.status, security.SECURITY_QUALIFICATION_STATUS.HOLD_UPSTREAM_SECURITY_READINESS));
check(() => assert.strictEqual(upstreamHold.independentSecurityValidationRequired, true));

// Duplicate evidence IDs and schema/timing errors fail closed.
const duplicate = [...records, evidence(CONTROLS[1], { evidenceId: records[0].evidenceId })];
const duplicateResult = envelope(duplicate);
check(() => assert.strictEqual(duplicateResult.status, security.SECURITY_QUALIFICATION_STATUS.HOLD_EVIDENCE_INTEGRITY));
expectThrow(() => evidence(CONTROLS[0], { exactCommitSha: 'short' }), /git commit SHA/);
expectThrow(() => evidence(CONTROLS[0], { sourceArtifactHashSha256: 'bad' }), /SHA-256/);
expectThrow(() => security.createSecurityQualificationEvidence({}), /evidenceId|observedAt/);
expectThrow(() => evidence(CONTROLS[0], { observedAt: '2026-09-08T07:00:00Z', verifiedAt: '2026-09-08T06:00:00Z' }), /verifiedAt must be on or after observedAt/);
expectThrow(() => evidence(CONTROLS[0], { reviewedAt: '2026-09-08T05:00:00Z' }), /reviewedAt must be on or after verifiedAt/);
expectThrow(() => envelope(records, { requiredControlClasses: [CONTROLS[0], CONTROLS[0]] }), /must not contain duplicates/);
expectThrow(() => envelope(records, { maximumEvidenceAgeDaysByControl: { [CONTROLS[0]]: 1 } }), /finite non-negative number/);

console.log(`WAVE_17A_SECURITY_QUALIFICATION_EVIDENCE=PASS checks=${checks}`);
