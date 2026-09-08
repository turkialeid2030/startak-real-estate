'use strict';

const assert = require('assert');
const crypto = require('crypto');
const {
  SECURITY_QUALIFICATION_STATUS,
  SECURITY_EVIDENCE_ENVIRONMENT,
  SECURITY_CONTROL_CLASS,
  createSecurityQualificationEvidence,
  verifySecurityQualificationEvidence,
  buildSecurityQualificationEnvelope,
  verifySecurityQualificationEnvelope,
} = require('../../src/security/security-qualification-envelope.js');
const { SECURITY_EVIDENCE_TRUST_STATUS } = require('../../src/security/security-evidence-trust-gate.js');

let checks = 0;
function check(fn) { fn(); checks += 1; }
function sha(value) { return crypto.createHash('sha256').update(String(value)).digest('hex'); }

const commitSha = 'a'.repeat(40);
const upstreamReady = Object.freeze({ status: SECURITY_EVIDENCE_TRUST_STATUS.READY_FOR_INDEPENDENT_SECURITY_REVIEW });
const upstreamHold = Object.freeze({ status: SECURITY_EVIDENCE_TRUST_STATUS.HOLD_ATTESTATION_EVIDENCE });

const controlDefs = [
  ['CTRL-RLS', SECURITY_CONTROL_CLASS.TENANT_ISOLATION_RLS],
  ['CTRL-ID', SECURITY_CONTROL_CLASS.RUNTIME_IDENTITY],
  ['CTRL-AUTHZ', SECURITY_CONTROL_CLASS.AUTHORIZATION],
  ['CTRL-STORAGE', SECURITY_CONTROL_CLASS.STORAGE_SECURITY],
  ['CTRL-REPLAY', SECURITY_CONTROL_CLASS.REPLAY_AND_BINDING],
  ['CTRL-AUDIT', SECURITY_CONTROL_CLASS.AUDIT_AND_TELEMETRY],
  ['CTRL-KEYS', SECURITY_CONTROL_CLASS.KEY_ROTATION_AND_BREAK_GLASS],
  ['CTRL-SUPPLY', SECURITY_CONTROL_CLASS.DEPENDENCY_AND_SUPPLY_CHAIN],
];

function evidenceFor([controlRef, controlClass], environmentClass = SECURITY_EVIDENCE_ENVIRONMENT.CI_TEST, environmentRef = 'GITHUB-ACTIONS-W17A', exactCommitSha = commitSha, reviewedAt = '2026-09-08T07:20:00Z') {
  return createSecurityQualificationEvidence({
    evidenceId: `E-${controlRef}`,
    controlRef,
    controlClass,
    environmentClass,
    environmentRef,
    exactCommitSha,
    artifactId: `ART-${controlRef}`,
    artifactHashSha256: sha(`artifact-${controlRef}`),
    evidenceRef: `github-actions://${controlRef}`,
    result: 'PASS',
    observedAt: '2026-09-08T07:00:00Z',
    reviewedAt,
    reviewerRef: 'SECURITY-REVIEWER-W17A',
    issuerRef: 'GITHUB-ACTIONS',
  });
}

const evidence = controlDefs.map((item) => evidenceFor(item));

check(() => assert.strictEqual(Object.keys(SECURITY_EVIDENCE_ENVIRONMENT).length, 3));
check(() => assert.strictEqual(Object.keys(SECURITY_CONTROL_CLASS).length, 10));
check(() => assert.strictEqual(evidence.length, 8));
for (const item of evidence) {
  check(() => assert.strictEqual(verifySecurityQualificationEvidence(item).valid, true));
  check(() => assert.strictEqual(item.environmentClass, SECURITY_EVIDENCE_ENVIRONMENT.CI_TEST));
  check(() => assert.strictEqual(item.exactCommitSha, commitSha));
}

const requiredControlRefs = controlDefs.map(([ref]) => ref);
const ready = buildSecurityQualificationEnvelope({
  qualificationId: 'W17A-CI-QUALIFICATION-1',
  upstreamSecurityTrustGate: upstreamReady,
  targetEnvironmentClass: SECURITY_EVIDENCE_ENVIRONMENT.CI_TEST,
  targetEnvironmentRef: 'GITHUB-ACTIONS-W17A',
  exactCommitSha: commitSha,
  requiredControlRefs,
  evidence,
  maximumEvidenceAgeSeconds: 86400,
  assessedAt: '2026-09-08T08:00:00Z',
  preparedBy: 'SECURITY-ENGINEER-W17A',
  reviewedBy: 'SECURITY-REVIEWER-W17A',
  preparedAt: '2026-09-08T07:30:00Z',
  reviewedAt: '2026-09-08T07:45:00Z',
});

check(() => assert.strictEqual(ready.status, SECURITY_QUALIFICATION_STATUS.READY_FOR_INDEPENDENT_SECURITY_VALIDATION));
check(() => assert.strictEqual(verifySecurityQualificationEnvelope(ready).valid, true));
check(() => assert.strictEqual(ready.targetEnvironmentClass, SECURITY_EVIDENCE_ENVIRONMENT.CI_TEST));
check(() => assert.strictEqual(ready.requiredControlRefs.length, requiredControlRefs.length));
check(() => assert.strictEqual(ready.evidenceHashesSha256.length, requiredControlRefs.length));
check(() => assert.strictEqual(ready.productionSecurityValidated, false));
check(() => assert.strictEqual(ready.pdplComplianceEstablished, false));
check(() => assert.strictEqual(ready.externalPenetrationTestEstablished, false));
check(() => assert.strictEqual(ready.certifiedSecurityEstablished, false));
check(() => assert.strictEqual(ready.liveEnvironmentTestingPerformedHere, false));
check(() => assert.strictEqual(ready.independentSecurityValidationRequired, true));
check(() => assert.strictEqual(ready.mergeAuthorized, false));
check(() => assert.strictEqual(ready.deploymentAuthorized, false));
check(() => assert.strictEqual(ready.transactionAuthorized, false));

const tamperedEvidence = { ...evidence[0], artifactId: 'TAMPERED' };
check(() => assert.strictEqual(verifySecurityQualificationEvidence(tamperedEvidence).valid, false));
const integrityHold = buildSecurityQualificationEnvelope({
  qualificationId: 'W17A-INTEGRITY-HOLD', upstreamSecurityTrustGate: upstreamReady,
  targetEnvironmentClass: SECURITY_EVIDENCE_ENVIRONMENT.CI_TEST, targetEnvironmentRef: 'GITHUB-ACTIONS-W17A', exactCommitSha: commitSha,
  requiredControlRefs, evidence: [tamperedEvidence, ...evidence.slice(1)], maximumEvidenceAgeSeconds: 86400,
  assessedAt: '2026-09-08T08:00:00Z', preparedBy: 'P', reviewedBy: 'R', preparedAt: '2026-09-08T07:30:00Z', reviewedAt: '2026-09-08T07:45:00Z',
});
check(() => assert.strictEqual(integrityHold.status, SECURITY_QUALIFICATION_STATUS.HOLD_EVIDENCE_INTEGRITY));

const productionScopeHold = buildSecurityQualificationEnvelope({
  qualificationId: 'W17A-PROD-SCOPE-HOLD', upstreamSecurityTrustGate: upstreamReady,
  targetEnvironmentClass: SECURITY_EVIDENCE_ENVIRONMENT.PRODUCTION, targetEnvironmentRef: 'PROD-W17A', exactCommitSha: commitSha,
  requiredControlRefs, evidence, maximumEvidenceAgeSeconds: 86400,
  assessedAt: '2026-09-08T08:00:00Z', preparedBy: 'P', reviewedBy: 'R', preparedAt: '2026-09-08T07:30:00Z', reviewedAt: '2026-09-08T07:45:00Z',
});
check(() => assert.strictEqual(productionScopeHold.status, SECURITY_QUALIFICATION_STATUS.HOLD_ENVIRONMENT_SCOPE));
check(() => assert.strictEqual(productionScopeHold.productionSecurityValidated, false));

const staleEvidence = evidence.map((item, index) => index === 0 ? evidenceFor(controlDefs[0], SECURITY_EVIDENCE_ENVIRONMENT.CI_TEST, 'GITHUB-ACTIONS-W17A', commitSha, '2026-09-01T07:20:00Z') : item);
const staleHold = buildSecurityQualificationEnvelope({
  qualificationId: 'W17A-STALE-HOLD', upstreamSecurityTrustGate: upstreamReady,
  targetEnvironmentClass: SECURITY_EVIDENCE_ENVIRONMENT.CI_TEST, targetEnvironmentRef: 'GITHUB-ACTIONS-W17A', exactCommitSha: commitSha,
  requiredControlRefs, evidence: staleEvidence, maximumEvidenceAgeSeconds: 86400,
  assessedAt: '2026-09-08T08:00:00Z', preparedBy: 'P', reviewedBy: 'R', preparedAt: '2026-09-08T07:30:00Z', reviewedAt: '2026-09-08T07:45:00Z',
});
check(() => assert.strictEqual(staleHold.status, SECURITY_QUALIFICATION_STATUS.HOLD_EVIDENCE_FRESHNESS));

const missingHold = buildSecurityQualificationEnvelope({
  qualificationId: 'W17A-MISSING-HOLD', upstreamSecurityTrustGate: upstreamReady,
  targetEnvironmentClass: SECURITY_EVIDENCE_ENVIRONMENT.CI_TEST, targetEnvironmentRef: 'GITHUB-ACTIONS-W17A', exactCommitSha: commitSha,
  requiredControlRefs, evidence: evidence.slice(1), maximumEvidenceAgeSeconds: 86400,
  assessedAt: '2026-09-08T08:00:00Z', preparedBy: 'P', reviewedBy: 'R', preparedAt: '2026-09-08T07:30:00Z', reviewedAt: '2026-09-08T07:45:00Z',
});
check(() => assert.strictEqual(missingHold.status, SECURITY_QUALIFICATION_STATUS.HOLD_REQUIRED_CONTROL_EVIDENCE));

const upstreamHoldEnvelope = buildSecurityQualificationEnvelope({
  qualificationId: 'W17A-UPSTREAM-HOLD', upstreamSecurityTrustGate: upstreamHold,
  targetEnvironmentClass: SECURITY_EVIDENCE_ENVIRONMENT.CI_TEST, targetEnvironmentRef: 'GITHUB-ACTIONS-W17A', exactCommitSha: commitSha,
  requiredControlRefs, evidence, maximumEvidenceAgeSeconds: 86400,
  assessedAt: '2026-09-08T08:00:00Z', preparedBy: 'P', reviewedBy: 'R', preparedAt: '2026-09-08T07:30:00Z', reviewedAt: '2026-09-08T07:45:00Z',
});
check(() => assert.strictEqual(upstreamHoldEnvelope.status, SECURITY_QUALIFICATION_STATUS.HOLD_UPSTREAM_SECURITY_EVIDENCE));

const otherCommitEvidence = evidence.map((item, index) => index === 0 ? evidenceFor(controlDefs[0], SECURITY_EVIDENCE_ENVIRONMENT.CI_TEST, 'GITHUB-ACTIONS-W17A', 'b'.repeat(40)) : item);
const commitHold = buildSecurityQualificationEnvelope({
  qualificationId: 'W17A-COMMIT-HOLD', upstreamSecurityTrustGate: upstreamReady,
  targetEnvironmentClass: SECURITY_EVIDENCE_ENVIRONMENT.CI_TEST, targetEnvironmentRef: 'GITHUB-ACTIONS-W17A', exactCommitSha: commitSha,
  requiredControlRefs, evidence: otherCommitEvidence, maximumEvidenceAgeSeconds: 86400,
  assessedAt: '2026-09-08T08:00:00Z', preparedBy: 'P', reviewedBy: 'R', preparedAt: '2026-09-08T07:30:00Z', reviewedAt: '2026-09-08T07:45:00Z',
});
check(() => assert.strictEqual(commitHold.status, SECURITY_QUALIFICATION_STATUS.HOLD_ENVIRONMENT_SCOPE));

const duplicateHold = buildSecurityQualificationEnvelope({
  qualificationId: 'W17A-DUPLICATE-HOLD', upstreamSecurityTrustGate: upstreamReady,
  targetEnvironmentClass: SECURITY_EVIDENCE_ENVIRONMENT.CI_TEST, targetEnvironmentRef: 'GITHUB-ACTIONS-W17A', exactCommitSha: commitSha,
  requiredControlRefs, evidence: [...evidence, evidence[0]], maximumEvidenceAgeSeconds: 86400,
  assessedAt: '2026-09-08T08:00:00Z', preparedBy: 'P', reviewedBy: 'R', preparedAt: '2026-09-08T07:30:00Z', reviewedAt: '2026-09-08T07:45:00Z',
});
check(() => assert.strictEqual(duplicateHold.status, SECURITY_QUALIFICATION_STATUS.HOLD_REQUIRED_CONTROL_EVIDENCE));

check(() => assert.throws(() => createSecurityQualificationEvidence({
  evidenceId: 'BAD', controlRef: 'BAD', controlClass: SECURITY_CONTROL_CLASS.AUTHORIZATION,
  environmentClass: SECURITY_EVIDENCE_ENVIRONMENT.CI_TEST, environmentRef: 'CI', exactCommitSha: 'short',
  artifactId: 'A', artifactHashSha256: sha('a'), evidenceRef: 'E', result: 'PASS', observedAt: '2026-09-08T07:00:00Z',
  reviewedAt: '2026-09-08T07:20:00Z', reviewerRef: 'R', issuerRef: 'I',
}), /40-character git SHA/));
check(() => assert.strictEqual(verifySecurityQualificationEnvelope({ ...ready, reviewedBy: 'tampered' }).valid, false));

console.log(`WAVE_17A_SECURITY_QUALIFICATION=PASS checks=${checks}`);
