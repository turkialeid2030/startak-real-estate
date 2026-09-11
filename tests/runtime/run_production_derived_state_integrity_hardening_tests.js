'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { sha256 } = require('../../src/standards/standards-registry');
const { verifyExternalConformanceProductionValidationPacketIntegrity } = require('../../src/standards/external-conformance-production-validation');
const { verifyHumanReleaseAuthorityDecisionPacketIntegrity } = require('../../src/standards/human-release-authority-deployment-decision');
const { verifyExecutionPostDeploymentCloseoutPacketIntegrity } = require('../../src/standards/execution-attestation-post-deployment-closeout');
const { verifyProductionEvidenceGoLiveReadinessPacketIntegrity, EVIDENCE_TYPE } = require('../../src/standards/production-evidence-go-live-readiness');
const {
  verifyE2fDerivedStateIntegrity,
  verifyE2gDerivedStateIntegrity,
  verifyE2hDerivedStateIntegrity,
  verifyE2iDerivedStateIntegrity,
} = require('../../src/qualification/production-stage-derived-state-integrity');
const {
  STATUS,
  evaluateProductionGoLiveRunbook,
  preparePinnedE2gDecisionSigningRequest,
} = require('../../src/qualification/production-go-live-runbook-strict');

const candidate = Object.freeze({
  releaseCandidateId: 'startak-production-rc-derived-state-test',
  sourceCommitSha: '1'.repeat(40),
  artifactSha256: '2'.repeat(64),
  environmentRef: 'cloudflare-pages:production:startak-real-estate',
  environmentConfigSha256: '3'.repeat(64),
  upstreamEvidencePacketHashSha256: '4'.repeat(64),
});

function e2fPacket(complete = true) {
  const types = ['EXTERNAL_CONFORMANCE_AUTHENTICITY', 'PRODUCTION_SECURITY_VALIDATION', 'PRODUCTION_PERFORMANCE_VALIDATION', 'PRODUCTION_RESILIENCE_VALIDATION'];
  const validations = (complete ? types : types.slice(0, 1)).map((validationType, index) => ({ validationId: `v-${index}`, validationType, result: 'VERIFIED' }));
  const core = {
    schemaVersion: 1,
    validationPacketId: 'e2f-derived-state-test',
    upstreamEvidencePacketId: 'e2e-test',
    upstreamEvidencePacketHashSha256: '4'.repeat(64),
    policyId: 'E2F-TEST',
    releaseCandidate: candidate,
    trustedVerifierRegistryId: 'registry-e2f-test',
    trustedVerifierRegistryHashSha256: '5'.repeat(64),
    validations,
    preparedByRef: 'test:derived-state',
    preparedAt: '2026-09-11T16:00:00Z',
  };
  return {
    ...core,
    status: complete ? 'EXTERNAL_CONFORMANCE_AND_PRODUCTION_VALIDATION_COMPLETE_PENDING_RELEASE_AUTHORITY' : 'WAITING_FOR_PRODUCTION_SECURITY_VALIDATION',
    blockers: [],
    validationPacketHashSha256: sha256(core),
    externalConformanceEvidenceAuthenticityValidated: true,
    productionSecurityValidated: complete,
    productionPerformanceValidated: complete,
    productionResilienceValidated: complete,
    productionValidationComplete: complete,
    humanReleaseAuthorityRequired: true,
    formalStandardsConformanceEstablished: false,
    standardsOrRulesActivated: false,
    saudiProfessionalLicensingEstablished: false,
    certifiedValuationAuthorityEstablished: false,
    externalIssuanceAuthorized: false,
    releaseAuthorized: false,
    mergeAuthorized: false,
    deploymentAuthorized: false,
    transactionAuthorized: false,
  };
}

function e2gPacket(e2f, complete = true) {
  const decisions = complete ? [
    { decisionId: 'd-release', decisionType: 'RELEASE_APPROVAL', result: 'APPROVE' },
    { decisionId: 'd-merge', decisionType: 'MERGE_APPROVAL', result: 'APPROVE' },
    { decisionId: 'd-deploy', decisionType: 'DEPLOYMENT_APPROVAL', result: 'APPROVE' },
  ] : [];
  const core = {
    schemaVersion: 1,
    decisionPacketId: 'e2g-derived-state-test',
    upstreamValidationPacketId: e2f.validationPacketId,
    upstreamValidationPacketHashSha256: e2f.validationPacketHashSha256,
    policyId: 'E2G-TEST',
    releaseCandidate: candidate,
    releaseAuthorityRegistryId: 'registry-e2g-test',
    releaseAuthorityRegistryHashSha256: '6'.repeat(64),
    decisions,
    preparedByRef: 'test:derived-state',
    preparedAt: '2026-09-11T17:00:00Z',
  };
  return {
    ...core,
    status: complete ? 'HUMAN_RELEASE_DECISIONS_COMPLETE_PENDING_EXECUTION' : 'WAITING_FOR_RELEASE_APPROVAL',
    blockers: [],
    decisionPacketHashSha256: sha256(core),
    releaseAuthorized: complete,
    mergeAuthorized: complete,
    deploymentAuthorized: complete,
    mergeExecuted: false,
    deploymentExecuted: false,
    postDecisionExecutionAttestationRequired: true,
    formalStandardsConformanceEstablished: false,
    standardsOrRulesActivated: false,
    saudiProfessionalLicensingEstablished: false,
    certifiedValuationAuthorityEstablished: false,
    externalIssuanceAuthorized: false,
    transactionAuthorized: false,
  };
}

function e2hPacket(e2g, complete = true) {
  const mergeSha = '7'.repeat(40);
  const deploymentId = 'deployment-derived-state-test';
  const attestations = complete ? [
    { attestationId: 'a-merge', attestationType: 'MERGE_EXECUTION_ATTESTATION', result: 'VERIFIED', resultingMergeCommitSha: mergeSha },
    { attestationId: 'a-deploy', attestationType: 'DEPLOYMENT_EXECUTION_ATTESTATION', result: 'VERIFIED', resultingMergeCommitSha: mergeSha, deploymentId },
    { attestationId: 'a-smoke', attestationType: 'POST_DEPLOYMENT_SMOKE_VALIDATION', result: 'VERIFIED', deploymentId },
    { attestationId: 'a-rollback', attestationType: 'ROLLBACK_READINESS_VALIDATION', result: 'VERIFIED', deploymentId },
  ] : [];
  const core = {
    schemaVersion: 1,
    closeoutPacketId: 'e2h-derived-state-test',
    upstreamDecisionPacketId: e2g.decisionPacketId,
    upstreamDecisionPacketHashSha256: e2g.decisionPacketHashSha256,
    policyId: 'E2H-TEST',
    releaseCandidate: candidate,
    executionAttestorRegistryId: 'registry-e2h-test',
    executionAttestorRegistryHashSha256: '8'.repeat(64),
    attestations,
    preparedByRef: 'test:derived-state',
    preparedAt: '2026-09-11T18:00:00Z',
  };
  return {
    ...core,
    status: complete ? 'EXECUTION_AND_POST_DEPLOYMENT_CLOSEOUT_COMPLETE' : 'WAITING_FOR_MERGE_EXECUTION',
    blockers: [],
    closeoutPacketHashSha256: sha256(core),
    releaseAuthorized: true,
    mergeAuthorized: true,
    deploymentAuthorized: true,
    mergeExecuted: complete,
    deploymentExecuted: complete,
    postDeploymentSmokePassed: complete,
    rollbackReadinessValidated: complete,
    executionCloseoutComplete: complete,
    formalStandardsConformanceEstablished: false,
    standardsOrRulesActivated: false,
    saudiProfessionalLicensingEstablished: false,
    certifiedValuationAuthorityEstablished: false,
    externalIssuanceAuthorized: false,
    transactionAuthorized: false,
  };
}

function e2iPacket(e2h, complete = true) {
  const types = Object.values(EVIDENCE_TYPE);
  const readinessEvidence = (complete ? types : types.slice(0, 1)).map((evidenceType, index) => ({ evidenceId: `e-${index}`, evidenceType, result: 'VERIFIED' }));
  const missingEvidenceTypes = complete ? [] : types.slice(1);
  const core = {
    schemaVersion: 1,
    readinessPacketId: 'e2i-derived-state-test',
    upstreamCloseoutPacketId: e2h.closeoutPacketId,
    upstreamCloseoutPacketHashSha256: e2h.closeoutPacketHashSha256,
    policyId: 'E2I-TEST',
    releaseCandidate: candidate,
    readinessVerifierRegistryId: 'registry-e2i-test',
    readinessVerifierRegistryHashSha256: '9'.repeat(64),
    readinessEvidence,
    missingEvidenceTypes,
    preparedByRef: 'test:derived-state',
    preparedAt: '2026-09-11T19:00:00Z',
  };
  return {
    ...core,
    status: complete ? 'GO_LIVE_READY_FOR_UNLICENSED_DECISION_SUPPORT' : 'WAITING_FOR_PRODUCTION_READINESS_EVIDENCE',
    blockers: [],
    readinessPacketHashSha256: sha256(core),
    goLiveReady: complete,
    goLiveOperatingMode: 'UNLICENSED_DECISION_SUPPORT',
    noFurtherInternalGateCanSubstituteForExternalEvidence: true,
    architecturalStop: true,
    formalStandardsConformanceEstablished: false,
    standardsOrRulesActivated: false,
    saudiProfessionalLicensingEstablished: false,
    certifiedValuationAuthorityEstablished: false,
    externalProfessionalValuationIssuanceAuthorized: false,
    transactionAuthorized: false,
  };
}

(function consistentPacketsPassStrictChecks() {
  const e2f = e2fPacket(); const e2g = e2gPacket(e2f); const e2h = e2hPacket(e2g); const e2i = e2iPacket(e2h);
  assert.strictEqual(verifyE2fDerivedStateIntegrity(e2f), true);
  assert.strictEqual(verifyE2gDerivedStateIntegrity(e2g), true);
  assert.strictEqual(verifyE2hDerivedStateIntegrity(e2h), true);
  assert.strictEqual(verifyE2iDerivedStateIntegrity(e2i), true);
})();

(function derivedOnlyEscalationsAreRejected() {
  const waitingE2f = e2fPacket(false);
  const forgedE2f = { ...waitingE2f, status: 'EXTERNAL_CONFORMANCE_AND_PRODUCTION_VALIDATION_COMPLETE_PENDING_RELEASE_AUTHORITY', productionSecurityValidated: true, productionPerformanceValidated: true, productionResilienceValidated: true, productionValidationComplete: true };
  assert.strictEqual(verifyExternalConformanceProductionValidationPacketIntegrity(forgedE2f), true);
  assert.strictEqual(verifyE2fDerivedStateIntegrity(forgedE2f), false);

  const waitingE2g = e2gPacket(e2fPacket(), false);
  const forgedE2g = { ...waitingE2g, status: 'HUMAN_RELEASE_DECISIONS_COMPLETE_PENDING_EXECUTION', releaseAuthorized: true, mergeAuthorized: true, deploymentAuthorized: true };
  assert.strictEqual(verifyHumanReleaseAuthorityDecisionPacketIntegrity(forgedE2g), true);
  assert.strictEqual(verifyE2gDerivedStateIntegrity(forgedE2g), false);

  const validE2g = e2gPacket(e2fPacket());
  const waitingE2h = e2hPacket(validE2g, false);
  const forgedE2h = { ...waitingE2h, status: 'EXECUTION_AND_POST_DEPLOYMENT_CLOSEOUT_COMPLETE', mergeExecuted: true, deploymentExecuted: true, postDeploymentSmokePassed: true, rollbackReadinessValidated: true, executionCloseoutComplete: true };
  assert.strictEqual(verifyExecutionPostDeploymentCloseoutPacketIntegrity(forgedE2h), true);
  assert.strictEqual(verifyE2hDerivedStateIntegrity(forgedE2h), false);

  const validE2h = e2hPacket(validE2g);
  const waitingE2i = e2iPacket(validE2h, false);
  const forgedE2i = { ...waitingE2i, status: 'GO_LIVE_READY_FOR_UNLICENSED_DECISION_SUPPORT', goLiveReady: true };
  assert.strictEqual(verifyProductionEvidenceGoLiveReadinessPacketIntegrity(forgedE2i), true);
  assert.strictEqual(verifyE2iDerivedStateIntegrity(forgedE2i), false);
})();

(function strictSigningWrapperRejectsEscalatedE2fBeforeLowerLevelIntake() {
  const waiting = e2fPacket(false);
  const forged = { ...waiting, status: 'EXTERNAL_CONFORMANCE_AND_PRODUCTION_VALIDATION_COMPLETE_PENDING_RELEASE_AUTHORITY', productionSecurityValidated: true, productionPerformanceValidated: true, productionResilienceValidated: true, productionValidationComplete: true };
  const result = preparePinnedE2gDecisionSigningRequest({ upstreamValidationPacket: forged, expectedUpstreamValidationPacketHashSha256: forged.validationPacketHashSha256 });
  assert.strictEqual(result.status, STATUS.HOLD_PRODUCTION_CHAIN_INTEGRITY);
  assert(result.blockers.includes('E2F_DERIVED_STATE_INTEGRITY_INVALID'));
})();

(function strictRunbookRejectsE2iFlagForgeryAndAcceptsConsistentChain() {
  const e2f = e2fPacket(); const e2g = e2gPacket(e2f); const e2h = e2hPacket(e2g); const e2i = e2iPacket(e2h);
  const common = {
    e2fValidationPacket: e2f, expectedE2fValidationPacketHashSha256: e2f.validationPacketHashSha256,
    e2gDecisionPacket: e2g, expectedE2gDecisionPacketHashSha256: e2g.decisionPacketHashSha256,
    e2hCloseoutPacket: e2h, expectedE2hCloseoutPacketHashSha256: e2h.closeoutPacketHashSha256,
  };
  const ok = evaluateProductionGoLiveRunbook({ ...common, e2iReadinessPacket: e2i, expectedE2iReadinessPacketHashSha256: e2i.readinessPacketHashSha256 });
  assert.strictEqual(ok.status, STATUS.GO_LIVE_READINESS_CONFIRMED_UNLICENSED_DECISION_SUPPORT);
  assert.strictEqual(ok.authority.goLiveAuthorizedByRunbook, false);

  const waiting = e2iPacket(e2h, false);
  const forged = { ...waiting, status: 'GO_LIVE_READY_FOR_UNLICENSED_DECISION_SUPPORT', goLiveReady: true };
  const blocked = evaluateProductionGoLiveRunbook({ ...common, e2iReadinessPacket: forged, expectedE2iReadinessPacketHashSha256: forged.readinessPacketHashSha256 });
  assert.strictEqual(blocked.status, STATUS.HOLD_PRODUCTION_CHAIN_INTEGRITY);
  assert(blocked.blockers.includes('E2I_DERIVED_STATE_INTEGRITY_INVALID'));
})();

(function strictCliAcceptsConsistentPinnedChain() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'startak-strict-runbook-'));
  const e2f = e2fPacket(); const e2g = e2gPacket(e2f); const e2h = e2hPacket(e2g); const e2i = e2iPacket(e2h);
  const files = Object.fromEntries(['e2f', 'e2g', 'e2h', 'e2i'].map((name) => [name, path.join(dir, `${name}.json`)]));
  files.out = path.join(dir, 'out.json');
  fs.writeFileSync(files.e2f, JSON.stringify(e2f)); fs.writeFileSync(files.e2g, JSON.stringify(e2g)); fs.writeFileSync(files.e2h, JSON.stringify(e2h)); fs.writeFileSync(files.e2i, JSON.stringify(e2i));
  const script = path.join(__dirname, '../../tools/production-go-live-runbook-strict.js');
  const run = spawnSync(process.execPath, [script, 'status', '--e2f', files.e2f, '--e2f-pin', e2f.validationPacketHashSha256, '--e2g', files.e2g, '--e2g-pin', e2g.decisionPacketHashSha256, '--e2h', files.e2h, '--e2h-pin', e2h.closeoutPacketHashSha256, '--e2i', files.e2i, '--e2i-pin', e2i.readinessPacketHashSha256, '--out', files.out], { encoding: 'utf8' });
  assert.strictEqual(run.status, 0, run.stderr);
  assert.strictEqual(JSON.parse(fs.readFileSync(files.out, 'utf8')).status, STATUS.GO_LIVE_READINESS_CONFIRMED_UNLICENSED_DECISION_SUPPORT);
  assert.strictEqual(fs.statSync(files.out).mode & 0o777, 0o600);
  fs.rmSync(dir, { recursive: true, force: true });
})();

console.log('PRODUCTION_DERIVED_STATE_INTEGRITY_HARDENING_TESTS=PASS');
