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

function evidenceFor([controlRef, controlClass], overrides = {}) {
  return createSecurityQualificationEvidence({
    evidenceId: `E-${controlRef}`,
    controlRef,
    controlClass,
    environmentClass: SECURITY_EVIDENCE_ENVIRONMENT.CI_TEST,
    environmentRef: 'GITHUB-ACTIONS-W17A',
    exactCommitSha: commitSha,
    artifactId: `ART-${controlRef}`,
    artifactHashSha256: sha(`artifact-${controlRef}`),
    evidenceRef: `github-actions://${controlRef}`,
    result: 'PASS',
    observedAt: '2026-09-08T07:00:00Z',
    reviewedAt: '2026-09-08T07:20:00Z',
    reviewerRef: 'SECURITY-REVIEWER-W17A',
    issuerRef: 'GITHUB-ACTIONS',
    ...overrides,
  });
}

const evidence = controlDefs.map((item) => evidenceFor(item));
const requiredControlRefs = controlDefs.map(([ref]) => ref);

check(() => assert.strictEqual(Object.keys(SECURITY_EVIDENCE_ENVIRONMENT).length, 3));
check(() => assert.strictEqual(Object.keys(SECURITY_CONTROL_CLASS).length, 10));
check(() => assert.strictEqual(evidence.length, 8));
for (const item of evidence) {
  check(() => assert.strictEqual(verifySecurityQualificationEvidence(item).valid, true));
  check(() => assert.strictEqual(item.environmentClass, SECURITY_EVIDENCE_ENVIRONMENT.CI_TEST));
  check(() => assert.strictEqual(item.exactCommitSha, commitSha));
}

function envelope(overrides = {}) {
  return buildSecurityQualificationEnvelope({
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
    ...overrides,
  });
}

const ready = envelope();
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
check(() => assert.strictEqual(envelope({ evidence: [tamperedEvidence, ...evidence.slice(1)] }).status, SECURITY_QUALIFICATION_STATUS.HOLD_EVIDENCE_INTEGRITY));
check(() => assert.strictEqual(envelope({ targetEnvironmentClass: SECURITY_EVIDENCE_ENVIRONMENT.PRODUCTION, targetEnvironmentRef: 'PROD-W17A' }).status, SECURITY_QUALIFICATION_STATUS.HOLD_ENVIRONMENT_SCOPE));
check(() => assert.strictEqual(envelope({ targetEnvironmentClass: SECURITY_EVIDENCE_ENVIRONMENT.PRODUCTION, targetEnvironmentRef: 'PROD-W17A' }).productionSecurityValidated, false));
check(() => assert.strictEqual(envelope({ maximumEvidenceAgeSeconds: 60 }).status, SECURITY_QUALIFICATION_STATUS.HOLD_EVIDENCE_FRESHNESS));
check(() => assert.strictEqual(envelope({ evidence: evidence.slice(1) }).status, SECURITY_QUALIFICATION_STATUS.HOLD_REQUIRED_CONTROL_EVIDENCE));
check(() => assert.strictEqual(envelope({ upstreamSecurityTrustGate: upstreamHold }).status, SECURITY_QUALIFICATION_STATUS.HOLD_UPSTREAM_SECURITY_EVIDENCE));

const otherCommitEvidence = evidence.map((item, index) => index === 0 ? evidenceFor(controlDefs[0], { exactCommitSha: 'b'.repeat(40) }) : item);
check(() => assert.strictEqual(envelope({ evidence: otherCommitEvidence }).status, SECURITY_QUALIFICATION_STATUS.HOLD_ENVIRONMENT_SCOPE));
check(() => assert.strictEqual(envelope({ evidence: [...evidence, evidence[0]] }).status, SECURITY_QUALIFICATION_STATUS.HOLD_REQUIRED_CONTROL_EVIDENCE));
check(() => assert.throws(() => createSecurityQualificationEvidence({
  evidenceId: 'BAD', controlRef: 'BAD', controlClass: SECURITY_CONTROL_CLASS.AUTHORIZATION,
  environmentClass: SECURITY_EVIDENCE_ENVIRONMENT.CI_TEST, environmentRef: 'CI', exactCommitSha: 'short',
  artifactId: 'A', artifactHashSha256: sha('a'), evidenceRef: 'E', result: 'PASS',
  observedAt: '2026-09-08T07:00:00Z', reviewedAt: '2026-09-08T07:20:00Z', reviewerRef: 'R', issuerRef: 'I',
}), /40-character git SHA/));
check(() => assert.throws(() => evidenceFor(controlDefs[0], { reviewedAt: '2026-09-08T06:59:59Z' }), /must not precede/));
check(() => assert.strictEqual(verifySecurityQualificationEnvelope({ ...ready, reviewedBy: 'tampered' }).valid, false));

console.log(`WAVE_17A_SECURITY_QUALIFICATION=PASS checks=${checks}`);
