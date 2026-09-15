'use strict';

const assert = require('assert');
const { sha256 } = require('../../src/standards/standards-registry');
const {
  verifyExternalConformanceProductionValidationPacketIntegrity,
} = require('../../src/standards/external-conformance-production-validation');
const {
  SEMANTICS,
  verifyStageTopLevelContract,
} = require('../../src/qualification/production-packet-top-level-contract');
const {
  STATUS,
  evaluateProductionGoLiveRunbook,
} = require('../../src/qualification/production-go-live-runbook-strict');

function packet({ policyId = 'STARTAK-E2F-PRODUCTION-CONTRACT-2026-09-11', includeSemantics = true } = {}) {
  const releaseCandidate = {
    releaseCandidateId: 'rc-top-level-contract-test',
    sourceCommitSha: '1'.repeat(40),
    artifactSha256: '2'.repeat(64),
    environmentRef: 'cloudflare-pages:production:startak-real-estate',
    environmentConfigSha256: '3'.repeat(64),
    upstreamEvidencePacketHashSha256: '4'.repeat(64),
  };
  const validations = [
    { validationId: 'v-external', validationType: 'EXTERNAL_CONFORMANCE_AUTHENTICITY', result: 'VERIFIED' },
  ];
  const core = {
    schemaVersion: 1,
    validationPacketId: 'e2f-top-level-contract-test',
    upstreamEvidencePacketId: 'e2e-top-level-contract-test',
    upstreamEvidencePacketHashSha256: '4'.repeat(64),
    policyId,
    releaseCandidate,
    trustedVerifierRegistryId: 'registry-top-level-contract-test',
    trustedVerifierRegistryHashSha256: '5'.repeat(64),
    validations,
    preparedByRef: 'test:top-level-contract',
    preparedAt: '2026-09-11T16:00:00Z',
  };
  const result = {
    ...core,
    status: 'WAITING_FOR_PRODUCTION_SECURITY_VALIDATION',
    blockers: [],
    validationPacketHashSha256: sha256(core),
    externalConformanceEvidenceAuthenticityValidated: true,
    productionSecurityValidated: false,
    productionPerformanceValidated: false,
    productionResilienceValidated: false,
    productionValidationComplete: false,
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
  if (includeSemantics) result.semantics = SEMANTICS.E2F;
  return result;
}

(function exactProductionPacketShapePasses() {
  const value = packet();
  assert.strictEqual(verifyExternalConformanceProductionValidationPacketIntegrity(value), true);
  assert.strictEqual(verifyStageTopLevelContract('E2F', value), true);
})();

(function arbitraryTopLevelClaimInjectionFailsWhileLegacyStructuralHashStillPasses() {
  const value = packet();
  const injected = { ...value, goLiveAuthorized: true };
  assert.strictEqual(verifyExternalConformanceProductionValidationPacketIntegrity(injected), true);
  assert.strictEqual(verifyStageTopLevelContract('E2F', injected), false);

  const strict = evaluateProductionGoLiveRunbook({
    e2fValidationPacket: injected,
    expectedE2fValidationPacketHashSha256: injected.validationPacketHashSha256,
  });
  assert.strictEqual(strict.status, STATUS.HOLD_PRODUCTION_CHAIN_INTEGRITY);
  assert(strict.blockers.includes('E2F_TOP_LEVEL_CONTRACT_INVALID'));
})();

(function semanticsTamperingFailsWhileLegacyStructuralHashStillPasses() {
  const value = packet();
  const tampered = { ...value, semantics: 'GO LIVE AUTHORIZED' };
  assert.strictEqual(verifyExternalConformanceProductionValidationPacketIntegrity(tampered), true);
  assert.strictEqual(verifyStageTopLevelContract('E2F', tampered), false);
})();

(function productionPacketCannotDropSemantics() {
  const value = packet({ includeSemantics: false });
  assert.strictEqual(verifyExternalConformanceProductionValidationPacketIntegrity(value), true);
  assert.strictEqual(verifyStageTopLevelContract('E2F', value), false);
})();

(function semanticsFreeCompatibilityIsLimitedToExplicitSyntheticTestPolicyAndStillRejectsExtraClaims() {
  const testFixture = packet({ policyId: 'E2F-TEST', includeSemantics: false });
  assert.strictEqual(verifyStageTopLevelContract('E2F', testFixture), true);
  assert.strictEqual(verifyStageTopLevelContract('E2F', { ...testFixture, releaseApproved: true }), false);
})();

console.log('PRODUCTION_PACKET_TOP_LEVEL_CONTRACT_TESTS=PASS');
