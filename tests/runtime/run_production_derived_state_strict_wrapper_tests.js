'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { sha256 } = require('../../src/standards/standards-registry');
const {
  STATUS,
  evaluateProductionGoLiveRunbook,
  preparePinnedE2hAttestationSigningRequest,
  preparePinnedE2iEvidenceSigningRequest,
} = require('../../src/qualification/production-go-live-runbook-strict');

const candidate = Object.freeze({
  releaseCandidateId: 'startak-production-rc-strict-wrapper-test',
  sourceCommitSha: '1'.repeat(40),
  artifactSha256: '2'.repeat(64),
  environmentRef: 'cloudflare-pages:production:startak-real-estate',
  environmentConfigSha256: '3'.repeat(64),
  upstreamEvidencePacketHashSha256: '4'.repeat(64),
});

function e2fPacket(complete = true) {
  const types = [
    'EXTERNAL_CONFORMANCE_AUTHENTICITY',
    'PRODUCTION_SECURITY_VALIDATION',
    'PRODUCTION_PERFORMANCE_VALIDATION',
    'PRODUCTION_RESILIENCE_VALIDATION',
  ];
  const validations = (complete ? types : types.slice(0, 1)).map((validationType, index) => ({
    validationId: `v-${index}`,
    validationType,
    result: 'VERIFIED',
  }));
  const core = {
    schemaVersion: 1,
    validationPacketId: 'e2f-strict-wrapper-test',
    upstreamEvidencePacketId: 'e2e-test',
    upstreamEvidencePacketHashSha256: '4'.repeat(64),
    policyId: 'E2F-TEST',
    releaseCandidate: candidate,
    trustedVerifierRegistryId: 'registry-e2f-test',
    trustedVerifierRegistryHashSha256: '5'.repeat(64),
    validations,
    preparedByRef: 'test:strict-wrapper',
    preparedAt: '2026-09-11T16:00:00Z',
  };
  return {
    ...core,
    status: complete
      ? 'EXTERNAL_CONFORMANCE_AND_PRODUCTION_VALIDATION_COMPLETE_PENDING_RELEASE_AUTHORITY'
      : 'WAITING_FOR_PRODUCTION_SECURITY_VALIDATION',
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
    decisionPacketId: 'e2g-strict-wrapper-test',
    upstreamValidationPacketId: e2f.validationPacketId,
    upstreamValidationPacketHashSha256: e2f.validationPacketHashSha256,
    policyId: 'E2G-TEST',
    releaseCandidate: candidate,
    releaseAuthorityRegistryId: 'registry-e2g-test',
    releaseAuthorityRegistryHashSha256: '6'.repeat(64),
    decisions,
    preparedByRef: 'test:strict-wrapper',
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
  const deploymentId = 'deployment-strict-wrapper-test';
  const attestations = complete ? [
    { attestationId: 'a-merge', attestationType: 'MERGE_EXECUTION_ATTESTATION', result: 'VERIFIED', resultingMergeCommitSha: mergeSha },
    { attestationId: 'a-deploy', attestationType: 'DEPLOYMENT_EXECUTION_ATTESTATION', result: 'VERIFIED', resultingMergeCommitSha: mergeSha, deploymentId },
    { attestationId: 'a-smoke', attestationType: 'POST_DEPLOYMENT_SMOKE_VALIDATION', result: 'VERIFIED', deploymentId },
    { attestationId: 'a-rollback', attestationType: 'ROLLBACK_READINESS_VALIDATION', result: 'VERIFIED', deploymentId },
  ] : [];
  const core = {
    schemaVersion: 1,
    closeoutPacketId: 'e2h-strict-wrapper-test',
    upstreamDecisionPacketId: e2g.decisionPacketId,
    upstreamDecisionPacketHashSha256: e2g.decisionPacketHashSha256,
    policyId: 'E2H-TEST',
    releaseCandidate: candidate,
    executionAttestorRegistryId: 'registry-e2h-test',
    executionAttestorRegistryHashSha256: '8'.repeat(64),
    attestations,
    preparedByRef: 'test:strict-wrapper',
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

(function legitimateWaitingE2fRemainsWaitingNotIntegrityHold() {
  const waiting = e2fPacket(false);
  const result = evaluateProductionGoLiveRunbook({
    e2fValidationPacket: waiting,
    expectedE2fValidationPacketHashSha256: waiting.validationPacketHashSha256,
  });
  assert.strictEqual(result.status, STATUS.WAITING_FOR_E2F_PRODUCTION_VALIDATION);
  assert.strictEqual(result.productionMutationPerformed, false);
})();

(function strictE2hSigningWrapperRejectsForgedE2gDerivedAuthorization() {
  const e2f = e2fPacket();
  const waiting = e2gPacket(e2f, false);
  const forged = {
    ...waiting,
    status: 'HUMAN_RELEASE_DECISIONS_COMPLETE_PENDING_EXECUTION',
    releaseAuthorized: true,
    mergeAuthorized: true,
    deploymentAuthorized: true,
  };
  const result = preparePinnedE2hAttestationSigningRequest({
    upstreamDecisionPacket: forged,
    expectedUpstreamDecisionPacketHashSha256: forged.decisionPacketHashSha256,
  });
  assert.strictEqual(result.status, STATUS.HOLD_PRODUCTION_CHAIN_INTEGRITY);
  assert(result.blockers.includes('E2G_DERIVED_STATE_INTEGRITY_INVALID'));
})();

(function strictE2iSigningWrapperRejectsForgedE2hExecutionState() {
  const e2f = e2fPacket();
  const e2g = e2gPacket(e2f);
  const waiting = e2hPacket(e2g, false);
  const forged = {
    ...waiting,
    status: 'EXECUTION_AND_POST_DEPLOYMENT_CLOSEOUT_COMPLETE',
    mergeExecuted: true,
    deploymentExecuted: true,
    postDeploymentSmokePassed: true,
    rollbackReadinessValidated: true,
    executionCloseoutComplete: true,
  };
  const result = preparePinnedE2iEvidenceSigningRequest({
    upstreamCloseoutPacket: forged,
    expectedUpstreamCloseoutPacketHashSha256: forged.closeoutPacketHashSha256,
  });
  assert.strictEqual(result.status, STATUS.HOLD_PRODUCTION_CHAIN_INTEGRITY);
  assert(result.blockers.includes('E2H_DERIVED_STATE_INTEGRITY_INVALID'));
})();

(function authorityBoundaryEscalationIsRejectedEvenWhenStructuralHashStillMatches() {
  const e2f = e2fPacket();
  const escalated = { ...e2f, transactionAuthorized: true };
  const result = evaluateProductionGoLiveRunbook({
    e2fValidationPacket: escalated,
    expectedE2fValidationPacketHashSha256: escalated.validationPacketHashSha256,
  });
  assert.strictEqual(result.status, STATUS.HOLD_PRODUCTION_CHAIN_INTEGRITY);
  assert(result.blockers.includes('E2F_DERIVED_STATE_INTEGRITY_INVALID'));
})();

(function strictCliFailsClosedOnForgedE2gPacket() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'startak-strict-wrapper-cli-'));
  try {
    const e2f = e2fPacket();
    const waiting = e2gPacket(e2f, false);
    const forged = {
      ...waiting,
      status: 'HUMAN_RELEASE_DECISIONS_COMPLETE_PENDING_EXECUTION',
      releaseAuthorized: true,
      mergeAuthorized: true,
      deploymentAuthorized: true,
    };
    const e2fPath = path.join(dir, 'e2f.json');
    const e2gPath = path.join(dir, 'e2g.json');
    const outPath = path.join(dir, 'out.json');
    fs.writeFileSync(e2fPath, JSON.stringify(e2f));
    fs.writeFileSync(e2gPath, JSON.stringify(forged));
    const script = path.join(__dirname, '../../tools/production-go-live-runbook-strict.js');
    const run = spawnSync(process.execPath, [
      script,
      'status',
      '--e2f', e2fPath,
      '--e2f-pin', e2f.validationPacketHashSha256,
      '--e2g', e2gPath,
      '--e2g-pin', forged.decisionPacketHashSha256,
      '--out', outPath,
    ], { encoding: 'utf8' });
    assert.strictEqual(run.status, 2, run.stderr);
    const result = JSON.parse(fs.readFileSync(outPath, 'utf8'));
    assert.strictEqual(result.status, STATUS.HOLD_PRODUCTION_CHAIN_INTEGRITY);
    assert(result.blockers.includes('E2G_DERIVED_STATE_INTEGRITY_INVALID'));
    assert.strictEqual(fs.statSync(outPath).mode & 0o777, 0o600);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
})();

console.log('PRODUCTION_DERIVED_STATE_STRICT_WRAPPER_TESTS=PASS');
