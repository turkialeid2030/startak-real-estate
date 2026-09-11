'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { sha256 } = require('../../src/standards/standards-registry');
const {
  STATUS,
  preparePinnedE2gDecisionSigningRequest,
  preparePinnedE2hAttestationSigningRequest,
  preparePinnedE2iEvidenceSigningRequest,
  evaluateProductionGoLiveRunbook,
} = require('../../src/qualification/production-go-live-runbook');
const tool = require('../../tools/production-go-live-runbook');

function releaseCandidate(overrides = {}) {
  return {
    releaseCandidateId: 'startak-production-rc-001',
    sourceCommitSha: '1'.repeat(40),
    artifactSha256: '2'.repeat(64),
    environmentRef: 'cloudflare-pages:production:startak-real-estate',
    environmentConfigSha256: '3'.repeat(64),
    upstreamEvidencePacketHashSha256: '4'.repeat(64),
    ...overrides,
  };
}

function e2fPacket(candidate = releaseCandidate(), coreOverrides = {}, outputOverrides = {}) {
  const core = {
    schemaVersion: 1,
    validationPacketId: 'e2f-production-validation-001',
    upstreamEvidencePacketId: 'e2e-implementation-evidence-001',
    upstreamEvidencePacketHashSha256: '4'.repeat(64),
    policyId: 'STARTAK-E2F-SYNTHETIC-FIXTURE',
    releaseCandidate: candidate,
    trustedVerifierRegistryId: 'synthetic-e2f-verifier-registry',
    trustedVerifierRegistryHashSha256: '5'.repeat(64),
    validations: [],
    preparedByRef: 'test:fixture',
    preparedAt: '2026-09-11T16:30:00Z',
    ...coreOverrides,
  };
  return {
    ...core,
    status: 'EXTERNAL_CONFORMANCE_AND_PRODUCTION_VALIDATION_COMPLETE_PENDING_RELEASE_AUTHORITY',
    blockers: [],
    validationPacketHashSha256: sha256(core),
    externalConformanceEvidenceAuthenticityValidated: true,
    productionSecurityValidated: true,
    productionPerformanceValidated: true,
    productionResilienceValidated: true,
    productionValidationComplete: true,
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
    ...outputOverrides,
  };
}

function e2gPacket(e2f, candidate = e2f.releaseCandidate, coreOverrides = {}, outputOverrides = {}) {
  const core = {
    schemaVersion: 1,
    decisionPacketId: 'e2g-human-release-decisions-001',
    upstreamValidationPacketId: e2f.validationPacketId,
    upstreamValidationPacketHashSha256: e2f.validationPacketHashSha256,
    policyId: 'STARTAK-E2G-SYNTHETIC-FIXTURE',
    releaseCandidate: candidate,
    releaseAuthorityRegistryId: 'synthetic-e2g-authority-registry',
    releaseAuthorityRegistryHashSha256: '7'.repeat(64),
    decisions: [],
    preparedByRef: 'test:fixture',
    preparedAt: '2026-09-11T17:00:00Z',
    ...coreOverrides,
  };
  return {
    ...core,
    status: 'HUMAN_RELEASE_DECISIONS_COMPLETE_PENDING_EXECUTION',
    blockers: [],
    decisionPacketHashSha256: sha256(core),
    releaseAuthorized: true,
    mergeAuthorized: true,
    deploymentAuthorized: true,
    mergeExecuted: false,
    deploymentExecuted: false,
    postDecisionExecutionAttestationRequired: true,
    formalStandardsConformanceEstablished: false,
    standardsOrRulesActivated: false,
    saudiProfessionalLicensingEstablished: false,
    certifiedValuationAuthorityEstablished: false,
    externalIssuanceAuthorized: false,
    transactionAuthorized: false,
    ...outputOverrides,
  };
}

function e2hPacket(e2g, candidate = e2g.releaseCandidate, coreOverrides = {}, outputOverrides = {}) {
  const core = {
    schemaVersion: 1,
    closeoutPacketId: 'e2h-production-closeout-001',
    upstreamDecisionPacketId: e2g.decisionPacketId,
    upstreamDecisionPacketHashSha256: e2g.decisionPacketHashSha256,
    policyId: 'STARTAK-E2H-SYNTHETIC-FIXTURE',
    releaseCandidate: candidate,
    executionAttestorRegistryId: 'synthetic-e2h-attestor-registry',
    executionAttestorRegistryHashSha256: '9'.repeat(64),
    attestations: [],
    preparedByRef: 'test:fixture',
    preparedAt: '2026-09-11T18:00:00Z',
    ...coreOverrides,
  };
  return {
    ...core,
    status: 'EXECUTION_AND_POST_DEPLOYMENT_CLOSEOUT_COMPLETE',
    blockers: [],
    closeoutPacketHashSha256: sha256(core),
    releaseAuthorized: true,
    mergeAuthorized: true,
    deploymentAuthorized: true,
    mergeExecuted: true,
    deploymentExecuted: true,
    postDeploymentSmokePassed: true,
    rollbackReadinessValidated: true,
    executionCloseoutComplete: true,
    formalStandardsConformanceEstablished: false,
    standardsOrRulesActivated: false,
    saudiProfessionalLicensingEstablished: false,
    certifiedValuationAuthorityEstablished: false,
    externalIssuanceAuthorized: false,
    transactionAuthorized: false,
    ...outputOverrides,
  };
}

function e2iPacket(e2h, candidate = e2h.releaseCandidate, {
  missing = [],
  ready = true,
  coreOverrides = {},
  outputOverrides = {},
} = {}) {
  const core = {
    schemaVersion: 1,
    readinessPacketId: 'e2i-production-readiness-001',
    upstreamCloseoutPacketId: e2h.closeoutPacketId,
    upstreamCloseoutPacketHashSha256: e2h.closeoutPacketHashSha256,
    policyId: 'STARTAK-E2I-SYNTHETIC-FIXTURE',
    releaseCandidate: candidate,
    readinessVerifierRegistryId: 'synthetic-e2i-verifier-registry',
    readinessVerifierRegistryHashSha256: 'b'.repeat(64),
    readinessEvidence: [],
    missingEvidenceTypes: missing,
    preparedByRef: 'test:fixture',
    preparedAt: '2026-09-11T19:00:00Z',
    ...coreOverrides,
  };
  return {
    ...core,
    status: ready ? 'GO_LIVE_READY_FOR_UNLICENSED_DECISION_SUPPORT' : 'WAITING_FOR_PRODUCTION_READINESS_EVIDENCE',
    blockers: [],
    readinessPacketHashSha256: sha256(core),
    goLiveReady: ready,
    goLiveOperatingMode: 'UNLICENSED_DECISION_SUPPORT',
    noFurtherInternalGateCanSubstituteForExternalEvidence: true,
    architecturalStop: true,
    formalStandardsConformanceEstablished: false,
    standardsOrRulesActivated: false,
    saudiProfessionalLicensingEstablished: false,
    certifiedValuationAuthorityEstablished: false,
    externalProfessionalValuationIssuanceAuthorized: false,
    transactionAuthorized: false,
    ...outputOverrides,
  };
}

function completeChain() {
  const e2f = e2fPacket();
  const e2g = e2gPacket(e2f);
  const e2h = e2hPacket(e2g);
  const e2i = e2iPacket(e2h);
  return { e2f, e2g, e2h, e2i };
}

(function testInitialWaitingState() {
  const result = evaluateProductionGoLiveRunbook();
  assert.strictEqual(result.status, STATUS.WAITING_FOR_E2F_PRODUCTION_VALIDATION);
  assert.strictEqual(result.productionMutationPerformed, false);
  assert.strictEqual(result.authority.goLiveAuthorizedByRunbook, false);
})();

(function testE2fReadyForE2g() {
  const e2f = e2fPacket();
  const result = evaluateProductionGoLiveRunbook({
    e2fValidationPacket: e2f,
    expectedE2fValidationPacketHashSha256: e2f.validationPacketHashSha256,
  });
  assert.strictEqual(result.status, STATUS.READY_FOR_E2G_HUMAN_RELEASE_DECISIONS);
  assert.strictEqual(result.lastVerifiedStage, 'E2F');
})();

(function testSelfHashedForgeryRejectedByPinnedProvenance() {
  const trusted = e2fPacket();
  const forged = e2fPacket(releaseCandidate({ artifactSha256: 'f'.repeat(64) }));
  assert.notStrictEqual(forged.validationPacketHashSha256, trusted.validationPacketHashSha256);
  const result = evaluateProductionGoLiveRunbook({
    e2fValidationPacket: forged,
    expectedE2fValidationPacketHashSha256: trusted.validationPacketHashSha256,
  });
  assert.strictEqual(result.status, STATUS.HOLD_PRODUCTION_CHAIN_PROVENANCE_PIN);
  assert(result.blockers.includes('E2F_PACKET_HASH_PIN:MISMATCH'));
})();

(function testStageGapRejected() {
  const { e2h } = completeChain();
  const result = evaluateProductionGoLiveRunbook({ e2hCloseoutPacket: e2h });
  assert.strictEqual(result.status, STATUS.HOLD_PRODUCTION_CHAIN_STAGE_GAP);
})();

(function testE2gReadyForExecution() {
  const e2f = e2fPacket();
  const e2g = e2gPacket(e2f);
  const result = evaluateProductionGoLiveRunbook({
    e2fValidationPacket: e2f,
    expectedE2fValidationPacketHashSha256: e2f.validationPacketHashSha256,
    e2gDecisionPacket: e2g,
    expectedE2gDecisionPacketHashSha256: e2g.decisionPacketHashSha256,
  });
  assert.strictEqual(result.status, STATUS.READY_FOR_AUTHORIZED_EXECUTION_SEQUENCE);
  assert.strictEqual(result.observed.releaseAuthorized, true);
  assert.strictEqual(result.authority.mergeExecutedByRunbook, false);
})();

(function testSelfConsistentE2gWithWrongUpstreamBindingRejected() {
  const e2f = e2fPacket();
  const e2g = e2gPacket(e2f, e2f.releaseCandidate, { upstreamValidationPacketHashSha256: 'd'.repeat(64) });
  const result = evaluateProductionGoLiveRunbook({
    e2fValidationPacket: e2f,
    expectedE2fValidationPacketHashSha256: e2f.validationPacketHashSha256,
    e2gDecisionPacket: e2g,
    expectedE2gDecisionPacketHashSha256: e2g.decisionPacketHashSha256,
  });
  assert.strictEqual(result.status, STATUS.HOLD_PRODUCTION_CHAIN_INTEGRITY);
  assert(result.blockers.includes('E2G_UPSTREAM_E2F_BINDING_MISMATCH'));
})();

(function testReleaseCandidateDriftRejected() {
  const e2f = e2fPacket();
  const e2g = e2gPacket(e2f, releaseCandidate({ sourceCommitSha: 'c'.repeat(40) }));
  const result = evaluateProductionGoLiveRunbook({
    e2fValidationPacket: e2f,
    expectedE2fValidationPacketHashSha256: e2f.validationPacketHashSha256,
    e2gDecisionPacket: e2g,
    expectedE2gDecisionPacketHashSha256: e2g.decisionPacketHashSha256,
  });
  assert.strictEqual(result.status, STATUS.HOLD_RELEASE_CANDIDATE_DRIFT);
  assert(result.blockers.includes('E2F_E2G_RELEASE_CANDIDATE_MISMATCH'));
})();

(function testE2hReadyForE2i() {
  const e2f = e2fPacket();
  const e2g = e2gPacket(e2f);
  const e2h = e2hPacket(e2g);
  const result = evaluateProductionGoLiveRunbook({
    e2fValidationPacket: e2f, expectedE2fValidationPacketHashSha256: e2f.validationPacketHashSha256,
    e2gDecisionPacket: e2g, expectedE2gDecisionPacketHashSha256: e2g.decisionPacketHashSha256,
    e2hCloseoutPacket: e2h, expectedE2hCloseoutPacketHashSha256: e2h.closeoutPacketHashSha256,
  });
  assert.strictEqual(result.status, STATUS.READY_FOR_E2I_EXTERNAL_READINESS_EVIDENCE);
  assert.strictEqual(result.observed.rollbackReadinessValidated, true);
})();

(function testSelfConsistentE2hWithWrongUpstreamBindingRejected() {
  const e2f = e2fPacket();
  const e2g = e2gPacket(e2f);
  const e2h = e2hPacket(e2g, e2g.releaseCandidate, { upstreamDecisionPacketHashSha256: 'e'.repeat(64) });
  const result = evaluateProductionGoLiveRunbook({
    e2fValidationPacket: e2f, expectedE2fValidationPacketHashSha256: e2f.validationPacketHashSha256,
    e2gDecisionPacket: e2g, expectedE2gDecisionPacketHashSha256: e2g.decisionPacketHashSha256,
    e2hCloseoutPacket: e2h, expectedE2hCloseoutPacketHashSha256: e2h.closeoutPacketHashSha256,
  });
  assert.strictEqual(result.status, STATUS.HOLD_PRODUCTION_CHAIN_INTEGRITY);
  assert(result.blockers.includes('E2H_UPSTREAM_E2G_BINDING_MISMATCH'));
})();

(function testE2iWaitingAndFinalStates() {
  const e2f = e2fPacket();
  const e2g = e2gPacket(e2f);
  const e2h = e2hPacket(e2g);
  const waiting = e2iPacket(e2h, e2h.releaseCandidate, { missing: ['SAUDI_LEGAL_OPERATING_MODE_REVIEW'], ready: false });
  const waitingResult = evaluateProductionGoLiveRunbook({
    e2fValidationPacket: e2f, expectedE2fValidationPacketHashSha256: e2f.validationPacketHashSha256,
    e2gDecisionPacket: e2g, expectedE2gDecisionPacketHashSha256: e2g.decisionPacketHashSha256,
    e2hCloseoutPacket: e2h, expectedE2hCloseoutPacketHashSha256: e2h.closeoutPacketHashSha256,
    e2iReadinessPacket: waiting, expectedE2iReadinessPacketHashSha256: waiting.readinessPacketHashSha256,
  });
  assert.strictEqual(waitingResult.status, STATUS.WAITING_FOR_E2I_EXTERNAL_READINESS_EVIDENCE);
  assert.deepStrictEqual([...waitingResult.missingEvidenceTypes], ['SAUDI_LEGAL_OPERATING_MODE_REVIEW']);

  const final = e2iPacket(e2h);
  const finalResult = evaluateProductionGoLiveRunbook({
    e2fValidationPacket: e2f, expectedE2fValidationPacketHashSha256: e2f.validationPacketHashSha256,
    e2gDecisionPacket: e2g, expectedE2gDecisionPacketHashSha256: e2g.decisionPacketHashSha256,
    e2hCloseoutPacket: e2h, expectedE2hCloseoutPacketHashSha256: e2h.closeoutPacketHashSha256,
    e2iReadinessPacket: final, expectedE2iReadinessPacketHashSha256: final.readinessPacketHashSha256,
  });
  assert.strictEqual(finalResult.status, STATUS.GO_LIVE_READINESS_CONFIRMED_UNLICENSED_DECISION_SUPPORT);
  assert.strictEqual(finalResult.goLiveReadinessConfirmed, true);
  assert.strictEqual(finalResult.authority.goLiveAuthorizedByRunbook, false);
  assert.strictEqual(finalResult.authority.transactionAuthorizedByRunbook, false);
})();

(function testSelfConsistentE2iWithWrongUpstreamBindingRejected() {
  const e2f = e2fPacket();
  const e2g = e2gPacket(e2f);
  const e2h = e2hPacket(e2g);
  const e2i = e2iPacket(e2h, e2h.releaseCandidate, { coreOverrides: { upstreamCloseoutPacketHashSha256: 'f'.repeat(64) } });
  const result = evaluateProductionGoLiveRunbook({
    e2fValidationPacket: e2f, expectedE2fValidationPacketHashSha256: e2f.validationPacketHashSha256,
    e2gDecisionPacket: e2g, expectedE2gDecisionPacketHashSha256: e2g.decisionPacketHashSha256,
    e2hCloseoutPacket: e2h, expectedE2hCloseoutPacketHashSha256: e2h.closeoutPacketHashSha256,
    e2iReadinessPacket: e2i, expectedE2iReadinessPacketHashSha256: e2i.readinessPacketHashSha256,
  });
  assert.strictEqual(result.status, STATUS.HOLD_PRODUCTION_CHAIN_INTEGRITY);
  assert(result.blockers.includes('E2I_UPSTREAM_E2H_BINDING_MISMATCH'));
})();

(function testPinnedSigningWrappersRejectWrongPinsBeforeLowerLevelProcessing() {
  const { e2f, e2g, e2h } = completeChain();
  const g = preparePinnedE2gDecisionSigningRequest({
    upstreamValidationPacket: e2f,
    expectedUpstreamValidationPacketHashSha256: '0'.repeat(64),
  });
  assert.strictEqual(g.status, STATUS.HOLD_PRODUCTION_CHAIN_PROVENANCE_PIN);
  assert.strictEqual(g.lowerLevelResult, null);

  const h = preparePinnedE2hAttestationSigningRequest({
    upstreamDecisionPacket: e2g,
    expectedUpstreamDecisionPacketHashSha256: '0'.repeat(64),
  });
  assert.strictEqual(h.status, STATUS.HOLD_PRODUCTION_CHAIN_PROVENANCE_PIN);

  const i = preparePinnedE2iEvidenceSigningRequest({
    upstreamCloseoutPacket: e2h,
    expectedUpstreamCloseoutPacketHashSha256: '0'.repeat(64),
  });
  assert.strictEqual(i.status, STATUS.HOLD_PRODUCTION_CHAIN_PROVENANCE_PIN);
})();

(function testCliStatusAndHardening() {
  assert.throws(() => tool.parseArgs(['status', '--e2f', 'a', '--e2f', 'b']), /duplicate argument/);
  assert.throws(() => tool.parseArgs(['e2g', '--e2f', 'a']), /argument not allowed/);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'startak-runbook-'));
  const { e2f, e2g, e2h, e2i } = completeChain();
  const files = {
    e2f: path.join(dir, 'e2f.json'),
    e2g: path.join(dir, 'e2g.json'),
    e2h: path.join(dir, 'e2h.json'),
    e2i: path.join(dir, 'e2i.json'),
    out: path.join(dir, 'out.json'),
  };
  fs.writeFileSync(files.e2f, JSON.stringify(e2f));
  fs.writeFileSync(files.e2g, JSON.stringify(e2g));
  fs.writeFileSync(files.e2h, JSON.stringify(e2h));
  fs.writeFileSync(files.e2i, JSON.stringify(e2i));
  const script = path.join(__dirname, '../../tools/production-go-live-runbook.js');
  const run = spawnSync(process.execPath, [
    script, 'status',
    '--e2f', files.e2f, '--e2f-pin', e2f.validationPacketHashSha256,
    '--e2g', files.e2g, '--e2g-pin', e2g.decisionPacketHashSha256,
    '--e2h', files.e2h, '--e2h-pin', e2h.closeoutPacketHashSha256,
    '--e2i', files.e2i, '--e2i-pin', e2i.readinessPacketHashSha256,
    '--out', files.out,
  ], { encoding: 'utf8' });
  assert.strictEqual(run.status, 0, run.stderr);
  const output = JSON.parse(fs.readFileSync(files.out, 'utf8'));
  assert.strictEqual(output.status, STATUS.GO_LIVE_READINESS_CONFIRMED_UNLICENSED_DECISION_SUPPORT);
  assert.strictEqual(fs.statSync(files.out).mode & 0o777, 0o600);

  const link = path.join(dir, 'link.json');
  fs.symlinkSync(files.e2f, link);
  assert.throws(() => tool.readBoundedRegularJson(link), /symlink input is not allowed/);
  fs.rmSync(dir, { recursive: true, force: true });
})();

console.log('PRODUCTION_GO_LIVE_RUNBOOK_TESTS=PASS');
