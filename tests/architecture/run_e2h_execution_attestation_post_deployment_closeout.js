'use strict';

const assert = require('assert');
const crypto = require('crypto');
const policy = require('../../governance/e2h-execution-attestation-post-deployment-closeout-policy-2026-09-08.json');
const { sha256 } = require('../../src/standards/standards-registry');
const {
  E2G_STATUS,
  verifyHumanReleaseAuthorityDecisionPacketIntegrity,
} = require('../../src/standards/human-release-authority-deployment-decision');
const {
  E2H_STATUS,
  ATTESTATION_TYPE,
  ATTESTATION_RESULT,
  validatePolicy,
  normalizeExecutionAttestorRegistry,
  createExecutionAttestationSigningPayload,
  normalizeAttestation,
  verifyAttestationSignature,
  createExecutionPostDeploymentCloseoutPacket,
  verifyExecutionPostDeploymentCloseoutPacketIntegrity,
} = require('../../src/standards/execution-attestation-post-deployment-closeout');

let checks = 0;
function check(fn) { fn(); checks += 1; }

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

function keyPair() {
  const pair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  return {
    privateKey: pair.privateKey,
    publicKeyPem: pair.publicKey.export({ type: 'spki', format: 'pem' }).toString().trim(),
  };
}

const h = (char) => char.repeat(64);
const releaseCandidate = {
  releaseCandidateId: 'RC-E2H-001',
  sourceCommitSha: '1'.repeat(40),
  artifactSha256: h('a'),
  environmentRef: 'production-saudi-primary',
  environmentConfigSha256: h('b'),
  upstreamEvidencePacketHashSha256: h('c'),
};

const upstreamCore = {
  schemaVersion: 1,
  decisionPacketId: 'E2G-PACKET-FOR-E2H',
  upstreamValidationPacketId: 'E2F-PACKET-001',
  upstreamValidationPacketHashSha256: h('d'),
  policyId: 'STARTAK-E2G-HUMAN-RELEASE-AUTHORITY-DEPLOYMENT-DECISION-POLICY-2026-09-08',
  releaseCandidate,
  releaseAuthorityRegistryId: 'RELEASE-AUTHORITY-REGISTRY-001',
  releaseAuthorityRegistryHashSha256: h('e'),
  decisions: [],
  preparedByRef: 'e2g-preparer',
  preparedAt: '2026-09-08T13:00:00.000Z',
};
const upstream = Object.freeze({
  ...upstreamCore,
  status: E2G_STATUS.HUMAN_RELEASE_DECISIONS_COMPLETE_PENDING_EXECUTION,
  blockers: Object.freeze([]),
  decisionPacketHashSha256: sha256(upstreamCore),
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
});

const keys = { merge: keyPair(), deploy: keyPair(), smoke: keyPair(), rollback: keyPair() };
const rawRegistry = {
  registryId: 'STARTAK-EXECUTION-ATTESTOR-REGISTRY-TEST',
  governanceArtifactSha256: h('f'),
  attestors: [
    {
      attestorId: 'merge-attestor-001', attestorSubjectRef: 'scm-observer-001',
      allowedAttestationTypes: [ATTESTATION_TYPE.MERGE_EXECUTION_ATTESTATION],
      publicKeyPem: keys.merge.publicKeyPem, publicKeySha256: sha256(keys.merge.publicKeyPem),
      governanceEvidenceRef: 'governance/scm-observer-appointment', activeFrom: '2026-01-01T00:00:00Z',
    },
    {
      attestorId: 'deploy-attestor-001', attestorSubjectRef: 'deployment-observer-001',
      allowedAttestationTypes: [ATTESTATION_TYPE.DEPLOYMENT_EXECUTION_ATTESTATION],
      publicKeyPem: keys.deploy.publicKeyPem, publicKeySha256: sha256(keys.deploy.publicKeyPem),
      governanceEvidenceRef: 'governance/deployment-observer-appointment', activeFrom: '2026-01-01T00:00:00Z',
    },
    {
      attestorId: 'smoke-attestor-001', attestorSubjectRef: 'independent-smoke-observer-001',
      allowedAttestationTypes: [ATTESTATION_TYPE.POST_DEPLOYMENT_SMOKE_VALIDATION],
      publicKeyPem: keys.smoke.publicKeyPem, publicKeySha256: sha256(keys.smoke.publicKeyPem),
      governanceEvidenceRef: 'governance/smoke-observer-appointment', activeFrom: '2026-01-01T00:00:00Z',
    },
    {
      attestorId: 'rollback-attestor-001', attestorSubjectRef: 'rollback-observer-001',
      allowedAttestationTypes: [ATTESTATION_TYPE.ROLLBACK_READINESS_VALIDATION],
      publicKeyPem: keys.rollback.publicKeyPem, publicKeySha256: sha256(keys.rollback.publicKeyPem),
      governanceEvidenceRef: 'governance/rollback-observer-appointment', activeFrom: '2026-01-01T00:00:00Z',
    },
  ],
};
const registry = normalizeExecutionAttestorRegistry(rawRegistry);

function signAttestation({ id, type, attestorId, privateKey, observedAt, result = ATTESTATION_RESULT.VERIFIED, evidenceChar, extra = {} }) {
  const unsigned = {
    attestationId: id,
    attestationType: type,
    decisionPacketHashSha256: upstream.decisionPacketHashSha256,
    releaseCandidateId: releaseCandidate.releaseCandidateId,
    approvedSourceCommitSha: releaseCandidate.sourceCommitSha,
    artifactSha256: releaseCandidate.artifactSha256,
    environmentRef: releaseCandidate.environmentRef,
    environmentConfigSha256: releaseCandidate.environmentConfigSha256,
    attestorId,
    evidenceSourceRef: `execution-evidence/${id}`,
    evidenceArtifactSha256: h(evidenceChar),
    observedAt,
    result,
    signatureAlgorithm: 'RSA-SHA256',
    ...extra,
  };
  const payload = createExecutionAttestationSigningPayload(unsigned, policy);
  const signatureBase64 = crypto.sign('RSA-SHA256', Buffer.from(stableStringify(payload), 'utf8'), privateKey).toString('base64');
  return { ...unsigned, signatureBase64 };
}

const mergeCommitSha = '2'.repeat(40);
const deploymentId = 'deploy-prod-2026-09-08-001';
const mergeAtt = signAttestation({
  id: 'EXEC-MERGE-001', type: ATTESTATION_TYPE.MERGE_EXECUTION_ATTESTATION,
  attestorId: 'merge-attestor-001', privateKey: keys.merge.privateKey, observedAt: '2026-09-08T13:05:00Z', evidenceChar: '1',
  extra: { targetBranchRef: 'main', resultingMergeCommitSha: mergeCommitSha },
});
const deployAtt = signAttestation({
  id: 'EXEC-DEPLOY-001', type: ATTESTATION_TYPE.DEPLOYMENT_EXECUTION_ATTESTATION,
  attestorId: 'deploy-attestor-001', privateKey: keys.deploy.privateKey, observedAt: '2026-09-08T13:06:00Z', evidenceChar: '2',
  extra: { resultingMergeCommitSha: mergeCommitSha, deploymentId },
});
const smokeAtt = signAttestation({
  id: 'EXEC-SMOKE-001', type: ATTESTATION_TYPE.POST_DEPLOYMENT_SMOKE_VALIDATION,
  attestorId: 'smoke-attestor-001', privateKey: keys.smoke.privateKey, observedAt: '2026-09-08T13:07:00Z', evidenceChar: '3',
  extra: { deploymentId, checkSuiteRef: 'smoke-suite/prod-v1' },
});
const rollbackAtt = signAttestation({
  id: 'EXEC-ROLLBACK-001', type: ATTESTATION_TYPE.ROLLBACK_READINESS_VALIDATION,
  attestorId: 'rollback-attestor-001', privateKey: keys.rollback.privateKey, observedAt: '2026-09-08T13:08:00Z', evidenceChar: '4',
  extra: { deploymentId, rollbackPlanArtifactSha256: h('5'), restorePointRef: 'restore-point/pre-deploy-001' },
});

check(() => assert.strictEqual(policy.policyId, 'STARTAK-E2H-EXECUTION-ATTESTATION-POST-DEPLOYMENT-CLOSEOUT-POLICY-2026-09-08'));
check(() => assert.strictEqual(policy.operatingMode, 'UNLICENSED_DECISION_SUPPORT'));
check(() => assert.strictEqual(policy.productionExecutionAttestorRegistryConfigured, false));
check(() => assert.strictEqual(policy.productionMergeExecutionEvidencePresent, false));
check(() => assert.strictEqual(policy.productionDeploymentExecutionEvidencePresent, false));
check(() => assert.strictEqual(policy.productionPostDeploymentSmokeEvidencePresent, false));
check(() => assert.strictEqual(policy.productionRollbackReadinessEvidencePresent, false));
check(() => assert.strictEqual(policy.automaticMergeExecutionAllowed, false));
check(() => assert.strictEqual(policy.automaticDeploymentExecutionAllowed, false));
check(() => assert.strictEqual(validatePolicy(policy), true));
check(() => assert.strictEqual(verifyHumanReleaseAuthorityDecisionPacketIntegrity(upstream), true));
check(() => assert.strictEqual(registry.attestors.length, 4));
check(() => assert.strictEqual(/^[a-f0-9]{64}$/.test(registry.registryHashSha256), true));

const normalizedMerge = normalizeAttestation(mergeAtt, policy);
check(() => assert.strictEqual(normalizedMerge.attestationType, ATTESTATION_TYPE.MERGE_EXECUTION_ATTESTATION));
check(() => assert.strictEqual(normalizedMerge.resultingMergeCommitSha, mergeCommitSha));
check(() => assert.strictEqual(/^[a-f0-9]{64}$/.test(normalizedMerge.attestationPayloadHashSha256), true));
check(() => assert.strictEqual(verifyAttestationSignature(normalizedMerge, registry.attestors[0], policy), true));

const waitingMerge = createExecutionPostDeploymentCloseoutPacket({
  closeoutPacketId: 'E2H-WAITING-MERGE', upstreamDecisionPacket: upstream, policy,
  executionAttestorRegistry: rawRegistry, expectedExecutionAttestorRegistryHashSha256: registry.registryHashSha256,
  attestations: [], preparedByRef: 'e2h-preparer', preparedAt: '2026-09-08T13:10:00Z',
});
check(() => assert.strictEqual(waitingMerge.status, E2H_STATUS.WAITING_FOR_MERGE_EXECUTION));
check(() => assert.strictEqual(waitingMerge.mergeExecuted, false));
check(() => assert.strictEqual(waitingMerge.deploymentExecuted, false));
check(() => assert.strictEqual(verifyExecutionPostDeploymentCloseoutPacketIntegrity(waitingMerge), true));

const waitingDeploy = createExecutionPostDeploymentCloseoutPacket({
  closeoutPacketId: 'E2H-WAITING-DEPLOY', upstreamDecisionPacket: upstream, policy,
  executionAttestorRegistry: rawRegistry, expectedExecutionAttestorRegistryHashSha256: registry.registryHashSha256,
  attestations: [mergeAtt], preparedByRef: 'e2h-preparer', preparedAt: '2026-09-08T13:10:00Z',
});
check(() => assert.strictEqual(waitingDeploy.status, E2H_STATUS.WAITING_FOR_DEPLOYMENT_EXECUTION));
check(() => assert.strictEqual(waitingDeploy.mergeExecuted, true));
check(() => assert.strictEqual(waitingDeploy.deploymentExecuted, false));
check(() => assert.strictEqual(verifyExecutionPostDeploymentCloseoutPacketIntegrity(waitingDeploy), true));

const waitingSmoke = createExecutionPostDeploymentCloseoutPacket({
  closeoutPacketId: 'E2H-WAITING-SMOKE', upstreamDecisionPacket: upstream, policy,
  executionAttestorRegistry: rawRegistry, expectedExecutionAttestorRegistryHashSha256: registry.registryHashSha256,
  attestations: [mergeAtt, deployAtt], preparedByRef: 'e2h-preparer', preparedAt: '2026-09-08T13:10:00Z',
});
check(() => assert.strictEqual(waitingSmoke.status, E2H_STATUS.WAITING_FOR_POST_DEPLOYMENT_SMOKE));
check(() => assert.strictEqual(waitingSmoke.mergeExecuted, true));
check(() => assert.strictEqual(waitingSmoke.deploymentExecuted, true));
check(() => assert.strictEqual(waitingSmoke.postDeploymentSmokePassed, false));

const waitingRollback = createExecutionPostDeploymentCloseoutPacket({
  closeoutPacketId: 'E2H-WAITING-ROLLBACK', upstreamDecisionPacket: upstream, policy,
  executionAttestorRegistry: rawRegistry, expectedExecutionAttestorRegistryHashSha256: registry.registryHashSha256,
  attestations: [mergeAtt, deployAtt, smokeAtt], preparedByRef: 'e2h-preparer', preparedAt: '2026-09-08T13:10:00Z',
});
check(() => assert.strictEqual(waitingRollback.status, E2H_STATUS.WAITING_FOR_ROLLBACK_READINESS));
check(() => assert.strictEqual(waitingRollback.postDeploymentSmokePassed, true));
check(() => assert.strictEqual(waitingRollback.rollbackReadinessValidated, false));

const complete = createExecutionPostDeploymentCloseoutPacket({
  closeoutPacketId: 'E2H-COMPLETE', upstreamDecisionPacket: upstream, policy,
  executionAttestorRegistry: rawRegistry, expectedExecutionAttestorRegistryHashSha256: registry.registryHashSha256,
  attestations: [mergeAtt, deployAtt, smokeAtt, rollbackAtt], preparedByRef: 'e2h-preparer', preparedAt: '2026-09-08T13:10:00Z',
});
check(() => assert.strictEqual(complete.status, E2H_STATUS.EXECUTION_AND_POST_DEPLOYMENT_CLOSEOUT_COMPLETE));
check(() => assert.strictEqual(complete.releaseAuthorized, true));
check(() => assert.strictEqual(complete.mergeAuthorized, true));
check(() => assert.strictEqual(complete.deploymentAuthorized, true));
check(() => assert.strictEqual(complete.mergeExecuted, true));
check(() => assert.strictEqual(complete.deploymentExecuted, true));
check(() => assert.strictEqual(complete.postDeploymentSmokePassed, true));
check(() => assert.strictEqual(complete.rollbackReadinessValidated, true));
check(() => assert.strictEqual(complete.executionCloseoutComplete, true));
check(() => assert.strictEqual(complete.formalStandardsConformanceEstablished, false));
check(() => assert.strictEqual(complete.standardsOrRulesActivated, false));
check(() => assert.strictEqual(complete.saudiProfessionalLicensingEstablished, false));
check(() => assert.strictEqual(complete.certifiedValuationAuthorityEstablished, false));
check(() => assert.strictEqual(complete.externalIssuanceAuthorized, false));
check(() => assert.strictEqual(complete.transactionAuthorized, false));
check(() => assert.strictEqual(verifyExecutionPostDeploymentCloseoutPacketIntegrity(complete), true));

const tampered = JSON.parse(JSON.stringify(complete));
tampered.attestations[0].resultingMergeCommitSha = '9'.repeat(40);
check(() => assert.strictEqual(verifyExecutionPostDeploymentCloseoutPacketIntegrity(tampered), false));

const badUpstream = JSON.parse(JSON.stringify(upstream));
badUpstream.deploymentAuthorized = false;
const heldUpstream = createExecutionPostDeploymentCloseoutPacket({
  closeoutPacketId: 'E2H-HOLD-UPSTREAM', upstreamDecisionPacket: badUpstream, policy,
  executionAttestorRegistry: rawRegistry, expectedExecutionAttestorRegistryHashSha256: registry.registryHashSha256,
  attestations: [], preparedByRef: 'e2h-preparer', preparedAt: '2026-09-08T13:10:00Z',
});
check(() => assert.strictEqual(heldUpstream.status, E2H_STATUS.HOLD_E2G_DECISION_PACKET));

const badRoot = createExecutionPostDeploymentCloseoutPacket({
  closeoutPacketId: 'E2H-HOLD-ROOT', upstreamDecisionPacket: upstream, policy,
  executionAttestorRegistry: rawRegistry, expectedExecutionAttestorRegistryHashSha256: h('9'),
  attestations: [], preparedByRef: 'e2h-preparer', preparedAt: '2026-09-08T13:10:00Z',
});
check(() => assert.strictEqual(badRoot.status, E2H_STATUS.HOLD_EXECUTION_TRUST_ROOT));
check(() => assert.strictEqual(badRoot.blockers.includes('EXECUTION_ATTESTOR_REGISTRY_HASH_MISMATCH'), true));

const badSigMerge = { ...mergeAtt, signatureBase64: Buffer.from('invalid').toString('base64') };
const badSig = createExecutionPostDeploymentCloseoutPacket({
  closeoutPacketId: 'E2H-HOLD-SIGNATURE', upstreamDecisionPacket: upstream, policy,
  executionAttestorRegistry: rawRegistry, expectedExecutionAttestorRegistryHashSha256: registry.registryHashSha256,
  attestations: [badSigMerge], preparedByRef: 'e2h-preparer', preparedAt: '2026-09-08T13:10:00Z',
});
check(() => assert.strictEqual(badSig.status, E2H_STATUS.HOLD_EXECUTION_ATTESTATION_INTEGRITY));
check(() => assert.strictEqual(badSig.blockers.some((x) => x.startsWith('EXECUTION_ATTESTATION_SIGNATURE_INVALID:')), true));

const rejectedMerge = signAttestation({
  id: 'EXEC-MERGE-REJECT', type: ATTESTATION_TYPE.MERGE_EXECUTION_ATTESTATION,
  attestorId: 'merge-attestor-001', privateKey: keys.merge.privateKey, observedAt: '2026-09-08T13:05:00Z', evidenceChar: '6', result: ATTESTATION_RESULT.REJECTED,
  extra: { targetBranchRef: 'main', resultingMergeCommitSha: mergeCommitSha },
});
const rejected = createExecutionPostDeploymentCloseoutPacket({
  closeoutPacketId: 'E2H-HOLD-REJECTED', upstreamDecisionPacket: upstream, policy,
  executionAttestorRegistry: rawRegistry, expectedExecutionAttestorRegistryHashSha256: registry.registryHashSha256,
  attestations: [rejectedMerge], preparedByRef: 'e2h-preparer', preparedAt: '2026-09-08T13:10:00Z',
});
check(() => assert.strictEqual(rejected.status, E2H_STATUS.HOLD_EXECUTION_REJECTED));
check(() => assert.strictEqual(rejected.mergeExecuted, false));

const deployOnly = createExecutionPostDeploymentCloseoutPacket({
  closeoutPacketId: 'E2H-HOLD-ORDER', upstreamDecisionPacket: upstream, policy,
  executionAttestorRegistry: rawRegistry, expectedExecutionAttestorRegistryHashSha256: registry.registryHashSha256,
  attestations: [deployAtt], preparedByRef: 'e2h-preparer', preparedAt: '2026-09-08T13:10:00Z',
});
check(() => assert.strictEqual(deployOnly.status, E2H_STATUS.HOLD_EXECUTION_ATTESTATION_INTEGRITY));
check(() => assert.strictEqual(deployOnly.blockers.includes('DEPLOYMENT_EXECUTION_REQUIRES_VERIFIED_MERGE_EXECUTION'), true));

const deployMismatch = signAttestation({
  id: 'EXEC-DEPLOY-MISMATCH', type: ATTESTATION_TYPE.DEPLOYMENT_EXECUTION_ATTESTATION,
  attestorId: 'deploy-attestor-001', privateKey: keys.deploy.privateKey, observedAt: '2026-09-08T13:06:00Z', evidenceChar: '7',
  extra: { resultingMergeCommitSha: '3'.repeat(40), deploymentId },
});
const mismatch = createExecutionPostDeploymentCloseoutPacket({
  closeoutPacketId: 'E2H-HOLD-MERGE-MISMATCH', upstreamDecisionPacket: upstream, policy,
  executionAttestorRegistry: rawRegistry, expectedExecutionAttestorRegistryHashSha256: registry.registryHashSha256,
  attestations: [mergeAtt, deployMismatch], preparedByRef: 'e2h-preparer', preparedAt: '2026-09-08T13:10:00Z',
});
check(() => assert.strictEqual(mismatch.status, E2H_STATUS.HOLD_EXECUTION_ATTESTATION_INTEGRITY));
check(() => assert.strictEqual(mismatch.blockers.includes('DEPLOYMENT_MERGE_COMMIT_MISMATCH'), true));

const sameActorRegistryRaw = {
  ...rawRegistry,
  registryId: 'STARTAK-EXECUTION-SAME-ACTOR-TEST',
  attestors: rawRegistry.attestors.map((record) => {
    if (record.attestorId === 'deploy-attestor-001' || record.attestorId === 'smoke-attestor-001') return { ...record, attestorSubjectRef: 'same-deploy-smoke-actor' };
    return record;
  }),
};
const sameActorRegistry = normalizeExecutionAttestorRegistry(sameActorRegistryRaw);
const sameActor = createExecutionPostDeploymentCloseoutPacket({
  closeoutPacketId: 'E2H-HOLD-SAME-ACTOR', upstreamDecisionPacket: upstream, policy,
  executionAttestorRegistry: sameActorRegistryRaw, expectedExecutionAttestorRegistryHashSha256: sameActorRegistry.registryHashSha256,
  attestations: [mergeAtt, deployAtt, smokeAtt], preparedByRef: 'e2h-preparer', preparedAt: '2026-09-08T13:10:00Z',
});
check(() => assert.strictEqual(sameActor.status, E2H_STATUS.HOLD_EXECUTION_ATTESTATION_INTEGRITY));
check(() => assert.strictEqual(sameActor.blockers.includes('DEPLOYMENT_AND_SMOKE_SAME_ACTOR_PROHIBITED'), true));

const duplicate = createExecutionPostDeploymentCloseoutPacket({
  closeoutPacketId: 'E2H-HOLD-DUPLICATE', upstreamDecisionPacket: upstream, policy,
  executionAttestorRegistry: rawRegistry, expectedExecutionAttestorRegistryHashSha256: registry.registryHashSha256,
  attestations: [mergeAtt, mergeAtt], preparedByRef: 'e2h-preparer', preparedAt: '2026-09-08T13:10:00Z',
});
check(() => assert.strictEqual(duplicate.status, E2H_STATUS.HOLD_EXECUTION_ATTESTATION_INTEGRITY));
check(() => assert.strictEqual(duplicate.blockers.some((x) => x.startsWith('DUPLICATE_ATTESTATION_ID:')), true));
check(() => assert.strictEqual(duplicate.blockers.some((x) => x.startsWith('DUPLICATE_ATTESTATION_TYPE:')), true));

console.log(`E2H_EXECUTION_ATTESTATION_POST_DEPLOYMENT_CLOSEOUT=PASS checks=${checks}`);
