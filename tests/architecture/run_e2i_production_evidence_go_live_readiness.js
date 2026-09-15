'use strict';

const assert = require('assert');
const crypto = require('crypto');
const policy = require('../../governance/e2i-production-evidence-go-live-readiness-policy-2026-09-08.json');
const { sha256 } = require('../../src/standards/standards-registry');
const {
  E2H_STATUS,
  verifyExecutionPostDeploymentCloseoutPacketIntegrity,
} = require('../../src/standards/execution-attestation-post-deployment-closeout');
const {
  E2I_STATUS,
  EVIDENCE_TYPE,
  EVIDENCE_RESULT,
  validatePolicy,
  normalizeReadinessVerifierRegistry,
  createReadinessEvidenceSigningPayload,
  normalizeReadinessEvidence,
  verifyReadinessEvidenceSignature,
  createProductionEvidenceGoLiveReadinessPacket,
  verifyProductionEvidenceGoLiveReadinessPacketIntegrity,
} = require('../../src/standards/production-evidence-go-live-readiness');

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
  releaseCandidateId: 'RC-E2I-001',
  sourceCommitSha: '1'.repeat(40),
  artifactSha256: h('a'),
  environmentRef: 'production-saudi-primary',
  environmentConfigSha256: h('b'),
  upstreamEvidencePacketHashSha256: h('c'),
};

const upstreamCore = {
  schemaVersion: 1,
  closeoutPacketId: 'E2H-PACKET-FOR-E2I',
  upstreamDecisionPacketId: 'E2G-PACKET-001',
  upstreamDecisionPacketHashSha256: h('d'),
  policyId: 'STARTAK-E2H-EXECUTION-ATTESTATION-POST-DEPLOYMENT-CLOSEOUT-POLICY-2026-09-08',
  releaseCandidate,
  executionAttestorRegistryId: 'EXECUTION-ATTESTOR-REGISTRY-001',
  executionAttestorRegistryHashSha256: h('e'),
  attestations: [],
  preparedByRef: 'e2h-preparer',
  preparedAt: '2026-09-08T13:00:00.000Z',
};
const upstream = Object.freeze({
  ...upstreamCore,
  status: E2H_STATUS.EXECUTION_AND_POST_DEPLOYMENT_CLOSEOUT_COMPLETE,
  blockers: Object.freeze([]),
  closeoutPacketHashSha256: sha256(upstreamCore),
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
});

const keys = { governance: keyPair(), assurance: keyPair(), single: keyPair() };
const governanceTypes = [
  EVIDENCE_TYPE.CANONICAL_SOURCE_HASH_COMPARISON,
  EVIDENCE_TYPE.SAUDI_LEGAL_OPERATING_MODE_REVIEW,
  EVIDENCE_TYPE.PROFESSIONAL_STANDARDS_SCOPE_REVIEW,
];
const assuranceTypes = [
  EVIDENCE_TYPE.PDPL_DATA_GOVERNANCE_REVIEW,
  EVIDENCE_TYPE.PRODUCTION_EXECUTION_CHAIN_CONFIRMATION,
  EVIDENCE_TYPE.OPERATING_MODE_CLAIMS_RESTRICTION_CONFIRMATION,
];

const rawRegistry = {
  registryId: 'STARTAK-PRODUCTION-READINESS-VERIFIER-REGISTRY-TEST',
  governanceArtifactSha256: h('f'),
  verifiers: [
    {
      verifierId: 'governance-verifier-001',
      verifierSubjectRef: 'external-governance-reviewer-001',
      allowedEvidenceTypes: governanceTypes,
      publicKeyPem: keys.governance.publicKeyPem,
      publicKeySha256: sha256(keys.governance.publicKeyPem),
      governanceEvidenceRef: 'governance/readiness-governance-verifier-appointment',
      activeFrom: '2026-01-01T00:00:00Z',
    },
    {
      verifierId: 'assurance-verifier-001',
      verifierSubjectRef: 'external-assurance-reviewer-001',
      allowedEvidenceTypes: assuranceTypes,
      publicKeyPem: keys.assurance.publicKeyPem,
      publicKeySha256: sha256(keys.assurance.publicKeyPem),
      governanceEvidenceRef: 'governance/readiness-assurance-verifier-appointment',
      activeFrom: '2026-01-01T00:00:00Z',
    },
  ],
};
const registry = normalizeReadinessVerifierRegistry(rawRegistry);

function verifierForType(type) {
  if (governanceTypes.includes(type)) return { verifierId: 'governance-verifier-001', privateKey: keys.governance.privateKey };
  return { verifierId: 'assurance-verifier-001', privateKey: keys.assurance.privateKey };
}

function signEvidence(type, index, { result = EVIDENCE_RESULT.VERIFIED, verifierOverride = null, privateKeyOverride = null } = {}) {
  const selected = verifierForType(type);
  const verifierId = verifierOverride || selected.verifierId;
  const privateKey = privateKeyOverride || selected.privateKey;
  const unsigned = {
    evidenceId: `READY-EVIDENCE-${String(index).padStart(2, '0')}`,
    evidenceType: type,
    upstreamCloseoutPacketHashSha256: upstream.closeoutPacketHashSha256,
    releaseCandidateId: releaseCandidate.releaseCandidateId,
    sourceCommitSha: releaseCandidate.sourceCommitSha,
    artifactSha256: releaseCandidate.artifactSha256,
    environmentRef: releaseCandidate.environmentRef,
    environmentConfigSha256: releaseCandidate.environmentConfigSha256,
    verifierId,
    sourceRef: `external-readiness-source/${String(index).padStart(2, '0')}`,
    evidenceArtifactSha256: sha256(`readiness-artifact-${index}`),
    verifiedAt: `2026-09-08T13:${String(10 + index).padStart(2, '0')}:00Z`,
    result,
    scopeRef: `scope/readiness-${String(index).padStart(2, '0')}`,
    signatureAlgorithm: 'RSA-SHA256',
  };
  const payload = createReadinessEvidenceSigningPayload(unsigned, policy);
  const signatureBase64 = crypto.sign('RSA-SHA256', Buffer.from(stableStringify(payload), 'utf8'), privateKey).toString('base64');
  return { ...unsigned, signatureBase64 };
}

const allTypes = policy.requiredEvidenceTypes;
const completeEvidence = allTypes.map((type, index) => signEvidence(type, index + 1));

check(() => assert.strictEqual(policy.policyId, 'STARTAK-E2I-PRODUCTION-EVIDENCE-GO-LIVE-READINESS-POLICY-2026-09-08'));
check(() => assert.strictEqual(policy.operatingMode, 'UNLICENSED_DECISION_SUPPORT'));
check(() => assert.strictEqual(policy.architecturalStop, true));
check(() => assert.strictEqual(policy.productionReadinessVerifierRegistryConfigured, false));
check(() => assert.strictEqual(policy.productionCanonicalSourceComparisonEvidencePresent, false));
check(() => assert.strictEqual(policy.productionSaudiLegalOperatingModeEvidencePresent, false));
check(() => assert.strictEqual(policy.productionPdplReviewEvidencePresent, false));
check(() => assert.strictEqual(policy.productionProfessionalStandardsScopeEvidencePresent, false));
check(() => assert.strictEqual(policy.productionExecutionChainConfirmationPresent, false));
check(() => assert.strictEqual(policy.productionOperatingModeClaimsRestrictionEvidencePresent, false));
check(() => assert.strictEqual(policy.automaticGoLiveApprovalAllowed, false));
check(() => assert.strictEqual(policy.automaticProfessionalAuthorityPromotionAllowed, false));
check(() => assert.strictEqual(policy.automaticRuleActivationAllowed, false));
check(() => assert.strictEqual(validatePolicy(policy), true));
check(() => assert.strictEqual(verifyExecutionPostDeploymentCloseoutPacketIntegrity(upstream), true));
check(() => assert.strictEqual(registry.verifiers.length, 2));
check(() => assert.strictEqual(/^[a-f0-9]{64}$/.test(registry.registryHashSha256), true));

const normalized = normalizeReadinessEvidence(completeEvidence[0], policy);
check(() => assert.strictEqual(normalized.evidenceType, EVIDENCE_TYPE.CANONICAL_SOURCE_HASH_COMPARISON));
check(() => assert.strictEqual(normalized.result, EVIDENCE_RESULT.VERIFIED));
check(() => assert.strictEqual(/^[a-f0-9]{64}$/.test(normalized.evidencePayloadHashSha256), true));
check(() => assert.strictEqual(verifyReadinessEvidenceSignature(normalized, registry.verifiers[0], policy), true));

const waiting = createProductionEvidenceGoLiveReadinessPacket({
  readinessPacketId: 'E2I-WAITING',
  upstreamCloseoutPacket: upstream,
  policy,
  readinessVerifierRegistry: rawRegistry,
  expectedReadinessVerifierRegistryHashSha256: registry.registryHashSha256,
  readinessEvidence: completeEvidence.slice(0, 3),
  preparedByRef: 'e2i-preparer',
  preparedAt: '2026-09-08T13:30:00Z',
});
check(() => assert.strictEqual(waiting.status, E2I_STATUS.WAITING_FOR_PRODUCTION_READINESS_EVIDENCE));
check(() => assert.strictEqual(waiting.goLiveReady, false));
check(() => assert.strictEqual(waiting.goLiveOperatingMode, 'UNLICENSED_DECISION_SUPPORT'));
check(() => assert.strictEqual(waiting.missingEvidenceTypes.length, 3));
check(() => assert.strictEqual(waiting.noFurtherInternalGateCanSubstituteForExternalEvidence, true));
check(() => assert.strictEqual(verifyProductionEvidenceGoLiveReadinessPacketIntegrity(waiting), true));

const ready = createProductionEvidenceGoLiveReadinessPacket({
  readinessPacketId: 'E2I-READY',
  upstreamCloseoutPacket: upstream,
  policy,
  readinessVerifierRegistry: rawRegistry,
  expectedReadinessVerifierRegistryHashSha256: registry.registryHashSha256,
  readinessEvidence: completeEvidence,
  preparedByRef: 'e2i-preparer',
  preparedAt: '2026-09-08T13:30:00Z',
});
check(() => assert.strictEqual(ready.status, E2I_STATUS.GO_LIVE_READY_FOR_UNLICENSED_DECISION_SUPPORT));
check(() => assert.strictEqual(ready.goLiveReady, true));
check(() => assert.strictEqual(ready.goLiveOperatingMode, 'UNLICENSED_DECISION_SUPPORT'));
check(() => assert.strictEqual(ready.missingEvidenceTypes.length, 0));
check(() => assert.strictEqual(ready.architecturalStop, true));
check(() => assert.strictEqual(ready.noFurtherInternalGateCanSubstituteForExternalEvidence, true));
check(() => assert.strictEqual(ready.formalStandardsConformanceEstablished, false));
check(() => assert.strictEqual(ready.standardsOrRulesActivated, false));
check(() => assert.strictEqual(ready.saudiProfessionalLicensingEstablished, false));
check(() => assert.strictEqual(ready.certifiedValuationAuthorityEstablished, false));
check(() => assert.strictEqual(ready.externalProfessionalValuationIssuanceAuthorized, false));
check(() => assert.strictEqual(ready.transactionAuthorized, false));
check(() => assert.strictEqual(verifyProductionEvidenceGoLiveReadinessPacketIntegrity(ready), true));

const tampered = JSON.parse(JSON.stringify(ready));
tampered.releaseCandidate.artifactSha256 = h('9');
check(() => assert.strictEqual(verifyProductionEvidenceGoLiveReadinessPacketIntegrity(tampered), false));

const badUpstream = JSON.parse(JSON.stringify(upstream));
badUpstream.rollbackReadinessValidated = false;
const heldUpstream = createProductionEvidenceGoLiveReadinessPacket({
  readinessPacketId: 'E2I-HOLD-UPSTREAM', upstreamCloseoutPacket: badUpstream, policy,
  readinessVerifierRegistry: rawRegistry, expectedReadinessVerifierRegistryHashSha256: registry.registryHashSha256,
  readinessEvidence: [], preparedByRef: 'e2i-preparer', preparedAt: '2026-09-08T13:30:00Z',
});
check(() => assert.strictEqual(heldUpstream.status, E2I_STATUS.HOLD_E2H_CLOSEOUT_PACKET));
check(() => assert.strictEqual(heldUpstream.goLiveReady, false));

const heldRoot = createProductionEvidenceGoLiveReadinessPacket({
  readinessPacketId: 'E2I-HOLD-ROOT', upstreamCloseoutPacket: upstream, policy,
  readinessVerifierRegistry: rawRegistry, expectedReadinessVerifierRegistryHashSha256: h('9'),
  readinessEvidence: [], preparedByRef: 'e2i-preparer', preparedAt: '2026-09-08T13:30:00Z',
});
check(() => assert.strictEqual(heldRoot.status, E2I_STATUS.HOLD_READINESS_TRUST_ROOT));
check(() => assert.strictEqual(heldRoot.blockers.includes('READINESS_VERIFIER_REGISTRY_HASH_MISMATCH'), true));

const badSignatureEvidence = [...completeEvidence];
badSignatureEvidence[0] = { ...badSignatureEvidence[0], signatureBase64: Buffer.from('invalid').toString('base64') };
const heldSignature = createProductionEvidenceGoLiveReadinessPacket({
  readinessPacketId: 'E2I-HOLD-SIGNATURE', upstreamCloseoutPacket: upstream, policy,
  readinessVerifierRegistry: rawRegistry, expectedReadinessVerifierRegistryHashSha256: registry.registryHashSha256,
  readinessEvidence: badSignatureEvidence, preparedByRef: 'e2i-preparer', preparedAt: '2026-09-08T13:30:00Z',
});
check(() => assert.strictEqual(heldSignature.status, E2I_STATUS.HOLD_READINESS_EVIDENCE_INTEGRITY));
check(() => assert.strictEqual(heldSignature.blockers.some((x) => x.startsWith('READINESS_EVIDENCE_SIGNATURE_INVALID:')), true));

const rejectedEvidence = [...completeEvidence];
rejectedEvidence[1] = signEvidence(allTypes[1], 2, { result: EVIDENCE_RESULT.REJECTED });
const rejected = createProductionEvidenceGoLiveReadinessPacket({
  readinessPacketId: 'E2I-HOLD-REJECTED', upstreamCloseoutPacket: upstream, policy,
  readinessVerifierRegistry: rawRegistry, expectedReadinessVerifierRegistryHashSha256: registry.registryHashSha256,
  readinessEvidence: rejectedEvidence, preparedByRef: 'e2i-preparer', preparedAt: '2026-09-08T13:30:00Z',
});
check(() => assert.strictEqual(rejected.status, E2I_STATUS.HOLD_READINESS_REJECTED));
check(() => assert.strictEqual(rejected.goLiveReady, false));

const inconclusiveEvidence = [...completeEvidence];
inconclusiveEvidence[2] = signEvidence(allTypes[2], 3, { result: EVIDENCE_RESULT.INCONCLUSIVE });
const inconclusive = createProductionEvidenceGoLiveReadinessPacket({
  readinessPacketId: 'E2I-INCONCLUSIVE', upstreamCloseoutPacket: upstream, policy,
  readinessVerifierRegistry: rawRegistry, expectedReadinessVerifierRegistryHashSha256: registry.registryHashSha256,
  readinessEvidence: inconclusiveEvidence, preparedByRef: 'e2i-preparer', preparedAt: '2026-09-08T13:30:00Z',
});
check(() => assert.strictEqual(inconclusive.status, E2I_STATUS.WAITING_FOR_PRODUCTION_READINESS_EVIDENCE));
check(() => assert.strictEqual(inconclusive.goLiveReady, false));
check(() => assert.strictEqual(inconclusive.missingEvidenceTypes.includes(allTypes[2]), true));

const mismatchedEvidence = [...completeEvidence];
const rawMismatch = { ...mismatchedEvidence[0], artifactSha256: h('8') };
const mismatchPayload = createReadinessEvidenceSigningPayload(rawMismatch, policy);
rawMismatch.signatureBase64 = crypto.sign('RSA-SHA256', Buffer.from(stableStringify(mismatchPayload), 'utf8'), keys.governance.privateKey).toString('base64');
mismatchedEvidence[0] = rawMismatch;
const mismatch = createProductionEvidenceGoLiveReadinessPacket({
  readinessPacketId: 'E2I-HOLD-BINDING', upstreamCloseoutPacket: upstream, policy,
  readinessVerifierRegistry: rawRegistry, expectedReadinessVerifierRegistryHashSha256: registry.registryHashSha256,
  readinessEvidence: mismatchedEvidence, preparedByRef: 'e2i-preparer', preparedAt: '2026-09-08T13:30:00Z',
});
check(() => assert.strictEqual(mismatch.status, E2I_STATUS.HOLD_READINESS_EVIDENCE_INTEGRITY));
check(() => assert.strictEqual(mismatch.blockers.some((x) => x.startsWith('READINESS_ARTIFACT_HASH_MISMATCH:')), true));

const duplicateEvidence = [...completeEvidence, completeEvidence[0]];
const duplicate = createProductionEvidenceGoLiveReadinessPacket({
  readinessPacketId: 'E2I-HOLD-DUPLICATE', upstreamCloseoutPacket: upstream, policy,
  readinessVerifierRegistry: rawRegistry, expectedReadinessVerifierRegistryHashSha256: registry.registryHashSha256,
  readinessEvidence: duplicateEvidence, preparedByRef: 'e2i-preparer', preparedAt: '2026-09-08T13:30:00Z',
});
check(() => assert.strictEqual(duplicate.status, E2I_STATUS.HOLD_READINESS_EVIDENCE_INTEGRITY));
check(() => assert.strictEqual(duplicate.blockers.some((x) => x.startsWith('DUPLICATE_READINESS_EVIDENCE_ID:')), true));
check(() => assert.strictEqual(duplicate.blockers.some((x) => x.startsWith('DUPLICATE_READINESS_EVIDENCE_TYPE:')), true));

const singleRegistryRaw = {
  registryId: 'STARTAK-SINGLE-READINESS-VERIFIER-TEST',
  governanceArtifactSha256: h('7'),
  verifiers: [{
    verifierId: 'single-verifier-001',
    verifierSubjectRef: 'single-readiness-subject',
    allowedEvidenceTypes: allTypes,
    publicKeyPem: keys.single.publicKeyPem,
    publicKeySha256: sha256(keys.single.publicKeyPem),
    governanceEvidenceRef: 'governance/single-verifier-test',
    activeFrom: '2026-01-01T00:00:00Z',
  }],
};
const singleRegistry = normalizeReadinessVerifierRegistry(singleRegistryRaw);
const singleEvidence = allTypes.map((type, index) => signEvidence(type, index + 1, {
  verifierOverride: 'single-verifier-001', privateKeyOverride: keys.single.privateKey,
}));
const singleVerifier = createProductionEvidenceGoLiveReadinessPacket({
  readinessPacketId: 'E2I-HOLD-SINGLE-VERIFIER', upstreamCloseoutPacket: upstream, policy,
  readinessVerifierRegistry: singleRegistryRaw, expectedReadinessVerifierRegistryHashSha256: singleRegistry.registryHashSha256,
  readinessEvidence: singleEvidence, preparedByRef: 'e2i-preparer', preparedAt: '2026-09-08T13:30:00Z',
});
check(() => assert.strictEqual(singleVerifier.status, E2I_STATUS.HOLD_READINESS_EVIDENCE_INTEGRITY));
check(() => assert.strictEqual(singleVerifier.blockers.includes('SINGLE_VERIFIER_SUBJECT_FOR_ALL_READINESS_EVIDENCE_PROHIBITED'), true));

console.log(`E2I_PRODUCTION_EVIDENCE_GO_LIVE_READINESS=PASS checks=${checks}`);
