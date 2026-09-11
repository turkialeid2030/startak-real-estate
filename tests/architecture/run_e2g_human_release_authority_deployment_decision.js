'use strict';

const assert = require('assert');
const crypto = require('crypto');
const policy = require('../../governance/e2g-human-release-authority-deployment-decision-policy-2026-09-08.json');
const { sha256 } = require('../../src/standards/standards-registry');
const {
  E2F_STATUS,
  verifyExternalConformanceProductionValidationPacketIntegrity,
} = require('../../src/standards/external-conformance-production-validation');
const {
  E2G_STATUS,
  DECISION_TYPE,
  DECISION_RESULT,
  validatePolicy,
  normalizeReleaseAuthorityRegistry,
  createReleaseDecisionSigningPayload,
  normalizeDecision,
  verifyDecisionSignature,
  createHumanReleaseAuthorityDecisionPacket,
  verifyHumanReleaseAuthorityDecisionPacketIntegrity,
} = require('../../src/standards/human-release-authority-deployment-decision');

let checks = 0;
function check(fn) { fn(); checks += 1; }

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function keyPair() {
  const pair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const publicKeyPem = pair.publicKey.export({ type: 'spki', format: 'pem' }).toString().trim();
  return { privateKey: pair.privateKey, publicKeyPem };
}

const keys = {
  release: keyPair(),
  merge: keyPair(),
  deploy: keyPair(),
  alternate: keyPair(),
};

const h = (char) => char.repeat(64);
const releaseCandidate = {
  releaseCandidateId: 'RC-E2G-001',
  sourceCommitSha: '1'.repeat(40),
  artifactSha256: h('a'),
  environmentRef: 'production-saudi-primary',
  environmentConfigSha256: h('b'),
  upstreamEvidencePacketHashSha256: h('c'),
};

const upstreamCore = {
  schemaVersion: 1,
  validationPacketId: 'E2F-PACKET-FOR-E2G',
  upstreamEvidencePacketId: 'E2E-PACKET-001',
  upstreamEvidencePacketHashSha256: h('c'),
  policyId: 'STARTAK-E2F-EXTERNAL-CONFORMANCE-PRODUCTION-VALIDATION-POLICY-2026-09-08',
  releaseCandidate,
  trustedVerifierRegistryId: 'EXTERNAL-VALIDATORS-001',
  trustedVerifierRegistryHashSha256: h('d'),
  validations: [],
  preparedByRef: 'e2f-gate-preparer',
  preparedAt: '2026-09-08T13:00:00.000Z',
};
const upstream = Object.freeze({
  ...upstreamCore,
  status: E2F_STATUS.EXTERNAL_CONFORMANCE_AND_PRODUCTION_VALIDATION_COMPLETE_PENDING_RELEASE_AUTHORITY,
  blockers: Object.freeze([]),
  validationPacketHashSha256: sha256(upstreamCore),
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
});

const rawRegistry = {
  registryId: 'STARTAK-PRODUCTION-RELEASE-AUTHORITY-REGISTRY-TEST',
  governanceArtifactSha256: h('e'),
  authorities: [
    {
      authorityId: 'release-authority-001',
      authoritySubjectRef: 'human-release-authority-001',
      allowedDecisionTypes: [DECISION_TYPE.RELEASE_APPROVAL],
      publicKeyPem: keys.release.publicKeyPem,
      publicKeySha256: sha256(keys.release.publicKeyPem),
      governanceEvidenceRef: 'governance/release-authority-appointment-001',
      activeFrom: '2026-01-01T00:00:00Z',
    },
    {
      authorityId: 'merge-authority-001',
      authoritySubjectRef: 'human-merge-authority-001',
      allowedDecisionTypes: [DECISION_TYPE.MERGE_APPROVAL],
      publicKeyPem: keys.merge.publicKeyPem,
      publicKeySha256: sha256(keys.merge.publicKeyPem),
      governanceEvidenceRef: 'governance/merge-authority-appointment-001',
      activeFrom: '2026-01-01T00:00:00Z',
    },
    {
      authorityId: 'deployment-authority-001',
      authoritySubjectRef: 'human-deployment-authority-001',
      allowedDecisionTypes: [DECISION_TYPE.DEPLOYMENT_APPROVAL],
      publicKeyPem: keys.deploy.publicKeyPem,
      publicKeySha256: sha256(keys.deploy.publicKeyPem),
      governanceEvidenceRef: 'governance/deployment-authority-appointment-001',
      activeFrom: '2026-01-01T00:00:00Z',
    },
  ],
};
const registry = normalizeReleaseAuthorityRegistry(rawRegistry);

function signDecision({ id, type, authorityId, privateKey, result = DECISION_RESULT.APPROVE, decidedAt, artifactChar }) {
  const unsigned = {
    decisionId: id,
    decisionType: type,
    releaseCandidateId: releaseCandidate.releaseCandidateId,
    validationPacketHashSha256: upstream.validationPacketHashSha256,
    sourceCommitSha: releaseCandidate.sourceCommitSha,
    artifactSha256: releaseCandidate.artifactSha256,
    environmentRef: releaseCandidate.environmentRef,
    environmentConfigSha256: releaseCandidate.environmentConfigSha256,
    authorityId,
    decisionSourceRef: `human-decision-source/${id}`,
    decisionArtifactSha256: h(artifactChar),
    decidedAt,
    result,
    rationaleRef: `rationale/${id}`,
    signatureAlgorithm: 'RSA-SHA256',
  };
  const payload = createReleaseDecisionSigningPayload(unsigned, policy);
  const signatureBase64 = crypto.sign('RSA-SHA256', Buffer.from(stableStringify(payload), 'utf8'), privateKey).toString('base64');
  return { ...unsigned, signatureBase64 };
}

const releaseDecision = signDecision({
  id: 'DEC-RELEASE-001', type: DECISION_TYPE.RELEASE_APPROVAL, authorityId: 'release-authority-001',
  privateKey: keys.release.privateKey, decidedAt: '2026-09-08T13:05:00Z', artifactChar: '1',
});
const mergeDecision = signDecision({
  id: 'DEC-MERGE-001', type: DECISION_TYPE.MERGE_APPROVAL, authorityId: 'merge-authority-001',
  privateKey: keys.merge.privateKey, decidedAt: '2026-09-08T13:06:00Z', artifactChar: '2',
});
const deployDecision = signDecision({
  id: 'DEC-DEPLOY-001', type: DECISION_TYPE.DEPLOYMENT_APPROVAL, authorityId: 'deployment-authority-001',
  privateKey: keys.deploy.privateKey, decidedAt: '2026-09-08T13:07:00Z', artifactChar: '3',
});

check(() => assert.strictEqual(policy.policyId, 'STARTAK-E2G-HUMAN-RELEASE-AUTHORITY-DEPLOYMENT-DECISION-POLICY-2026-09-08'));
check(() => assert.strictEqual(policy.operatingMode, 'UNLICENSED_DECISION_SUPPORT'));
check(() => assert.strictEqual(policy.productionHumanReleaseAuthorityRegistryConfigured, false));
check(() => assert.strictEqual(policy.productionHumanReleaseDecisionsPresent, false));
check(() => assert.strictEqual(policy.automaticReleaseAllowed, false));
check(() => assert.strictEqual(policy.automaticMergeAllowed, false));
check(() => assert.strictEqual(policy.automaticDeploymentAllowed, false));
check(() => assert.strictEqual(policy.automaticRuleActivationAllowed, false));
check(() => assert.strictEqual(policy.sameActorMayAuthorizeMergeAndDeployment, false));
check(() => assert.strictEqual(validatePolicy(policy), true));
check(() => assert.strictEqual(verifyExternalConformanceProductionValidationPacketIntegrity(upstream), true));
check(() => assert.strictEqual(registry.registryId, rawRegistry.registryId));
check(() => assert.strictEqual(registry.authorities.length, 3));
check(() => assert.strictEqual(/^[a-f0-9]{64}$/.test(registry.registryHashSha256), true));
check(() => assert.strictEqual(registry.authorities[0].publicKeySha256, sha256(keys.release.publicKeyPem)));

const normalized = normalizeDecision(releaseDecision, policy);
check(() => assert.strictEqual(normalized.decisionType, DECISION_TYPE.RELEASE_APPROVAL));
check(() => assert.strictEqual(normalized.result, DECISION_RESULT.APPROVE));
check(() => assert.strictEqual(/^[a-f0-9]{64}$/.test(normalized.decisionPayloadHashSha256), true));
check(() => assert.strictEqual(verifyDecisionSignature(normalized, registry.authorities[0], policy), true));

const waitingRelease = createHumanReleaseAuthorityDecisionPacket({
  decisionPacketId: 'E2G-WAITING-RELEASE', upstreamValidationPacket: upstream, policy,
  releaseAuthorityRegistry: rawRegistry, expectedReleaseAuthorityRegistryHashSha256: registry.registryHashSha256,
  decisions: [], preparedByRef: 'e2g-preparer', preparedAt: '2026-09-08T13:10:00Z',
});
check(() => assert.strictEqual(waitingRelease.status, E2G_STATUS.WAITING_FOR_RELEASE_APPROVAL));
check(() => assert.strictEqual(waitingRelease.releaseAuthorized, false));
check(() => assert.strictEqual(waitingRelease.mergeAuthorized, false));
check(() => assert.strictEqual(waitingRelease.deploymentAuthorized, false));
check(() => assert.strictEqual(verifyHumanReleaseAuthorityDecisionPacketIntegrity(waitingRelease), true));

const waitingMerge = createHumanReleaseAuthorityDecisionPacket({
  decisionPacketId: 'E2G-WAITING-MERGE', upstreamValidationPacket: upstream, policy,
  releaseAuthorityRegistry: rawRegistry, expectedReleaseAuthorityRegistryHashSha256: registry.registryHashSha256,
  decisions: [releaseDecision], preparedByRef: 'e2g-preparer', preparedAt: '2026-09-08T13:10:00Z',
});
check(() => assert.strictEqual(waitingMerge.status, E2G_STATUS.WAITING_FOR_MERGE_APPROVAL));
check(() => assert.strictEqual(waitingMerge.releaseAuthorized, true));
check(() => assert.strictEqual(waitingMerge.mergeAuthorized, false));
check(() => assert.strictEqual(waitingMerge.deploymentAuthorized, false));
check(() => assert.strictEqual(verifyHumanReleaseAuthorityDecisionPacketIntegrity(waitingMerge), true));

const waitingDeploy = createHumanReleaseAuthorityDecisionPacket({
  decisionPacketId: 'E2G-WAITING-DEPLOY', upstreamValidationPacket: upstream, policy,
  releaseAuthorityRegistry: rawRegistry, expectedReleaseAuthorityRegistryHashSha256: registry.registryHashSha256,
  decisions: [releaseDecision, mergeDecision], preparedByRef: 'e2g-preparer', preparedAt: '2026-09-08T13:10:00Z',
});
check(() => assert.strictEqual(waitingDeploy.status, E2G_STATUS.WAITING_FOR_DEPLOYMENT_APPROVAL));
check(() => assert.strictEqual(waitingDeploy.releaseAuthorized, true));
check(() => assert.strictEqual(waitingDeploy.mergeAuthorized, true));
check(() => assert.strictEqual(waitingDeploy.deploymentAuthorized, false));
check(() => assert.strictEqual(verifyHumanReleaseAuthorityDecisionPacketIntegrity(waitingDeploy), true));

const complete = createHumanReleaseAuthorityDecisionPacket({
  decisionPacketId: 'E2G-COMPLETE', upstreamValidationPacket: upstream, policy,
  releaseAuthorityRegistry: rawRegistry, expectedReleaseAuthorityRegistryHashSha256: registry.registryHashSha256,
  decisions: [releaseDecision, mergeDecision, deployDecision], preparedByRef: 'e2g-preparer', preparedAt: '2026-09-08T13:10:00Z',
});
check(() => assert.strictEqual(complete.status, E2G_STATUS.HUMAN_RELEASE_DECISIONS_COMPLETE_PENDING_EXECUTION));
check(() => assert.strictEqual(complete.releaseAuthorized, true));
check(() => assert.strictEqual(complete.mergeAuthorized, true));
check(() => assert.strictEqual(complete.deploymentAuthorized, true));
check(() => assert.strictEqual(complete.mergeExecuted, false));
check(() => assert.strictEqual(complete.deploymentExecuted, false));
check(() => assert.strictEqual(complete.postDecisionExecutionAttestationRequired, true));
check(() => assert.strictEqual(complete.formalStandardsConformanceEstablished, false));
check(() => assert.strictEqual(complete.standardsOrRulesActivated, false));
check(() => assert.strictEqual(complete.saudiProfessionalLicensingEstablished, false));
check(() => assert.strictEqual(complete.certifiedValuationAuthorityEstablished, false));
check(() => assert.strictEqual(complete.externalIssuanceAuthorized, false));
check(() => assert.strictEqual(complete.transactionAuthorized, false));
check(() => assert.strictEqual(verifyHumanReleaseAuthorityDecisionPacketIntegrity(complete), true));

const tampered = JSON.parse(JSON.stringify(complete));
tampered.releaseCandidate.artifactSha256 = h('9');
check(() => assert.strictEqual(verifyHumanReleaseAuthorityDecisionPacketIntegrity(tampered), false));

const badUpstream = JSON.parse(JSON.stringify(upstream));
badUpstream.productionSecurityValidated = false;
const heldUpstream = createHumanReleaseAuthorityDecisionPacket({
  decisionPacketId: 'E2G-HOLD-UPSTREAM', upstreamValidationPacket: badUpstream, policy,
  releaseAuthorityRegistry: rawRegistry, expectedReleaseAuthorityRegistryHashSha256: registry.registryHashSha256,
  decisions: [], preparedByRef: 'e2g-preparer', preparedAt: '2026-09-08T13:10:00Z',
});
check(() => assert.strictEqual(heldUpstream.status, E2G_STATUS.HOLD_E2F_VALIDATION_PACKET));
check(() => assert.strictEqual(heldUpstream.releaseAuthorized, false));

const heldRoot = createHumanReleaseAuthorityDecisionPacket({
  decisionPacketId: 'E2G-HOLD-ROOT', upstreamValidationPacket: upstream, policy,
  releaseAuthorityRegistry: rawRegistry, expectedReleaseAuthorityRegistryHashSha256: h('f'),
  decisions: [], preparedByRef: 'e2g-preparer', preparedAt: '2026-09-08T13:10:00Z',
});
check(() => assert.strictEqual(heldRoot.status, E2G_STATUS.HOLD_RELEASE_AUTHORITY_ROOT));
check(() => assert.strictEqual(heldRoot.blockers.includes('RELEASE_AUTHORITY_REGISTRY_HASH_MISMATCH'), true));

const badSignature = { ...releaseDecision, signatureBase64: Buffer.from('bad-signature').toString('base64') };
const heldSignature = createHumanReleaseAuthorityDecisionPacket({
  decisionPacketId: 'E2G-HOLD-SIGNATURE', upstreamValidationPacket: upstream, policy,
  releaseAuthorityRegistry: rawRegistry, expectedReleaseAuthorityRegistryHashSha256: registry.registryHashSha256,
  decisions: [badSignature], preparedByRef: 'e2g-preparer', preparedAt: '2026-09-08T13:10:00Z',
});
check(() => assert.strictEqual(heldSignature.status, E2G_STATUS.HOLD_DECISION_INTEGRITY));
check(() => assert.strictEqual(heldSignature.blockers.some((x) => x.startsWith('DECISION_SIGNATURE_INVALID:')), true));

const rejectedRelease = signDecision({
  id: 'DEC-RELEASE-REJECT', type: DECISION_TYPE.RELEASE_APPROVAL, authorityId: 'release-authority-001',
  privateKey: keys.release.privateKey, result: DECISION_RESULT.REJECT, decidedAt: '2026-09-08T13:05:00Z', artifactChar: '4',
});
const heldRejected = createHumanReleaseAuthorityDecisionPacket({
  decisionPacketId: 'E2G-HOLD-REJECTED', upstreamValidationPacket: upstream, policy,
  releaseAuthorityRegistry: rawRegistry, expectedReleaseAuthorityRegistryHashSha256: registry.registryHashSha256,
  decisions: [rejectedRelease], preparedByRef: 'e2g-preparer', preparedAt: '2026-09-08T13:10:00Z',
});
check(() => assert.strictEqual(heldRejected.status, E2G_STATUS.HOLD_HUMAN_DECISION_REJECTED));
check(() => assert.strictEqual(heldRejected.releaseAuthorized, false));

const heldReleaseDecision = signDecision({
  id: 'DEC-RELEASE-HOLD', type: DECISION_TYPE.RELEASE_APPROVAL, authorityId: 'release-authority-001',
  privateKey: keys.release.privateKey, result: DECISION_RESULT.HOLD, decidedAt: '2026-09-08T13:05:00Z', artifactChar: '5',
});
const heldHuman = createHumanReleaseAuthorityDecisionPacket({
  decisionPacketId: 'E2G-HOLD-HUMAN', upstreamValidationPacket: upstream, policy,
  releaseAuthorityRegistry: rawRegistry, expectedReleaseAuthorityRegistryHashSha256: registry.registryHashSha256,
  decisions: [heldReleaseDecision], preparedByRef: 'e2g-preparer', preparedAt: '2026-09-08T13:10:00Z',
});
check(() => assert.strictEqual(heldHuman.status, E2G_STATUS.HOLD_HUMAN_DECISION));

const mergeWithoutRelease = createHumanReleaseAuthorityDecisionPacket({
  decisionPacketId: 'E2G-HOLD-ORDER', upstreamValidationPacket: upstream, policy,
  releaseAuthorityRegistry: rawRegistry, expectedReleaseAuthorityRegistryHashSha256: registry.registryHashSha256,
  decisions: [mergeDecision], preparedByRef: 'e2g-preparer', preparedAt: '2026-09-08T13:10:00Z',
});
check(() => assert.strictEqual(mergeWithoutRelease.status, E2G_STATUS.HOLD_DECISION_INTEGRITY));
check(() => assert.strictEqual(mergeWithoutRelease.blockers.includes('MERGE_APPROVAL_REQUIRES_RELEASE_APPROVAL'), true));

const deployWithoutMerge = createHumanReleaseAuthorityDecisionPacket({
  decisionPacketId: 'E2G-HOLD-DEPLOY-ORDER', upstreamValidationPacket: upstream, policy,
  releaseAuthorityRegistry: rawRegistry, expectedReleaseAuthorityRegistryHashSha256: registry.registryHashSha256,
  decisions: [releaseDecision, deployDecision], preparedByRef: 'e2g-preparer', preparedAt: '2026-09-08T13:10:00Z',
});
check(() => assert.strictEqual(deployWithoutMerge.status, E2G_STATUS.HOLD_DECISION_INTEGRITY));
check(() => assert.strictEqual(deployWithoutMerge.blockers.includes('DEPLOYMENT_APPROVAL_REQUIRES_MERGE_APPROVAL'), true));

const wrongRoleDecision = signDecision({
  id: 'DEC-MERGE-WRONG-ROLE', type: DECISION_TYPE.MERGE_APPROVAL, authorityId: 'release-authority-001',
  privateKey: keys.release.privateKey, decidedAt: '2026-09-08T13:06:00Z', artifactChar: '6',
});
const wrongRole = createHumanReleaseAuthorityDecisionPacket({
  decisionPacketId: 'E2G-HOLD-WRONG-ROLE', upstreamValidationPacket: upstream, policy,
  releaseAuthorityRegistry: rawRegistry, expectedReleaseAuthorityRegistryHashSha256: registry.registryHashSha256,
  decisions: [releaseDecision, wrongRoleDecision], preparedByRef: 'e2g-preparer', preparedAt: '2026-09-08T13:10:00Z',
});
check(() => assert.strictEqual(wrongRole.status, E2G_STATUS.HOLD_DECISION_INTEGRITY));
check(() => assert.strictEqual(wrongRole.blockers.some((x) => x.includes('DECISION_AUTHORITY_TYPE_NOT_ALLOWED')), true));

const sameActorRegistryRaw = {
  ...rawRegistry,
  registryId: 'STARTAK-RELEASE-AUTHORITY-SAME-ACTOR-TEST',
  authorities: [
    rawRegistry.authorities[0],
    { ...rawRegistry.authorities[1], authoritySubjectRef: 'same-ops-authority' },
    { ...rawRegistry.authorities[2], authoritySubjectRef: 'same-ops-authority' },
  ],
};
const sameActorRegistry = normalizeReleaseAuthorityRegistry(sameActorRegistryRaw);
const sameActor = createHumanReleaseAuthorityDecisionPacket({
  decisionPacketId: 'E2G-HOLD-SAME-ACTOR', upstreamValidationPacket: upstream, policy,
  releaseAuthorityRegistry: sameActorRegistryRaw, expectedReleaseAuthorityRegistryHashSha256: sameActorRegistry.registryHashSha256,
  decisions: [releaseDecision, mergeDecision, deployDecision], preparedByRef: 'e2g-preparer', preparedAt: '2026-09-08T13:10:00Z',
});
check(() => assert.strictEqual(sameActor.status, E2G_STATUS.HOLD_DECISION_INTEGRITY));
check(() => assert.strictEqual(sameActor.blockers.includes('MERGE_AND_DEPLOYMENT_SAME_ACTOR_PROHIBITED'), true));

const duplicate = createHumanReleaseAuthorityDecisionPacket({
  decisionPacketId: 'E2G-HOLD-DUPLICATE', upstreamValidationPacket: upstream, policy,
  releaseAuthorityRegistry: rawRegistry, expectedReleaseAuthorityRegistryHashSha256: registry.registryHashSha256,
  decisions: [releaseDecision, releaseDecision], preparedByRef: 'e2g-preparer', preparedAt: '2026-09-08T13:10:00Z',
});
check(() => assert.strictEqual(duplicate.status, E2G_STATUS.HOLD_DECISION_INTEGRITY));
check(() => assert.strictEqual(duplicate.blockers.some((x) => x.startsWith('DUPLICATE_DECISION_ID:')), true));
check(() => assert.strictEqual(duplicate.blockers.some((x) => x.startsWith('DUPLICATE_DECISION_TYPE:')), true));

console.log(`E2G_HUMAN_RELEASE_AUTHORITY_DEPLOYMENT_DECISION=PASS checks=${checks}`);
