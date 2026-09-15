'use strict';

const assert = require('assert');
const {
  AUTHORITY,
  stableStringify,
} = require('../../src/qualification/canonical-baseline-registry');
const { STATUS: P75_STATUS } = require('../../src/qualification/successor-fresh-activation-change-contract');
const {
  STATUS,
  SUCCESSOR_TOP_LEVEL_KEYS,
  SUCCESSOR_BASELINE_KEYS,
  p75ContractCore,
  verifySuccessorCompositeRegistryShape,
  validateP75ContractBoundary,
  verifySuccessorFreshDualModeCanonicalRegistry,
} = require('../../src/qualification/successor-fresh-dual-mode-canonical-registry-verifier');
const {
  parseArgs,
  requireSuccessorArgs,
} = require('../../tools/successor-fresh-dual-mode-canonical-registry-verifier');
const {
  sha256Text,
  sha256Object,
  buildSuccessorFreshActiveFixture,
} = require('../fixtures/successor_fresh_active_fixture');

function clone(value) { return JSON.parse(JSON.stringify(value)); }

(function run() {
  const fixture = buildSuccessorFreshActiveFixture();
  assert.strictEqual(fixture.activationChangeContract.status, P75_STATUS.SUCCESSOR_FRESH_ACTIVATION_CHANGE_CONTRACT_READY_OWNER_AUTH_VERIFIED_NOT_APPLIED);
  assert.strictEqual(fixture.activationChangeContract.verified, true);
  assert.strictEqual(fixture.activeRegistry.schemaVersion, 4);

  const legacy = verifySuccessorFreshDualModeCanonicalRegistry({
    registry: fixture.currentRegistry,
    observedRegistryContent: fixture.currentRegistryContent,
  });
  assert.strictEqual(legacy.status, STATUS.LEGACY_BASELINE_VERIFIED);
  assert.strictEqual(legacy.verified, true);
  assert.strictEqual(legacy.legacyBaselineVerified, true);
  assert.strictEqual(legacy.activationAppliedObserved, false);
  assert.strictEqual(legacy.activationAuthorizedByThisVerifier, false);
  assert.strictEqual(legacy.mutationPerformedByThisVerifier, false);
  for (const key of Object.keys(AUTHORITY)) assert.strictEqual(legacy[key], false);

  const input = {
    registry: fixture.activeRegistry,
    observedRegistryContent: fixture.activeRegistryContent,
    activationChangeContract: fixture.activationChangeContract,
    successorReviewPacket: fixture.successorReviewPacket,
    reviewerLifecycle: fixture.reviewerLifecycle,
    activationPlan: fixture.activationPlan,
    successorFreshCompositeCandidate: fixture.successorFreshCompositeCandidate,
    successorFreshShadowEvaluation: fixture.successorFreshShadowEvaluation,
    successorFreshRehearsalResult: fixture.successorFreshRehearsalResult,
    safetyGuard: fixture.safetyGuard,
    successorFreshOwnerAuthorityRegistry: fixture.successorFreshOwnerAuthorityRegistry,
    expectedSuccessorFreshOwnerAuthorityRegistryHashSha256: fixture.expectedSuccessorFreshOwnerAuthorityRegistryHashSha256,
    signedOwnerDecision: fixture.signedOwnerDecision,
  };

  const result = verifySuccessorFreshDualModeCanonicalRegistry(input);
  assert.strictEqual(result.status, STATUS.SUCCESSOR_FRESH_COMPOSITE_BASELINE_VERIFIED_WITH_SUCCESSOR_OWNER_AUTHORIZATION);
  assert.strictEqual(result.verified, true);
  assert.strictEqual(result.registrySchemaVersion, 4);
  assert.strictEqual(result.successorCompositeRegistryShapeVerified, true);
  assert.strictEqual(result.p69CandidateReverified, true);
  assert.strictEqual(result.p75ActivationChangeContractVerified, true);
  assert.strictEqual(result.successorOwnerAuthorizationReverified, true);
  assert.strictEqual(result.rollbackRegistryVerified, true);
  assert.strictEqual(result.rollbackRawContentVerified, true);
  assert.strictEqual(result.observedRegistryContentVerified, true);
  assert.strictEqual(result.activationAppliedObserved, true);
  assert.strictEqual(result.activationAuthorizedByThisVerifier, false);
  assert.strictEqual(result.mutationPerformedByThisVerifier, false);
  assert.strictEqual(result.releaseStillBlocked, true);
  assert.strictEqual(result.registryHashSha256, fixture.activationChangeContract.proposedRegistryHashSha256);
  assert.strictEqual(result.registryContentSha256, fixture.activationChangeContract.proposedRegistryContentSha256);
  assert.strictEqual(result.expectedPriorRegistryHashSha256, fixture.activationChangeContract.rollbackRegistryHashSha256);
  assert.strictEqual(result.expectedPriorRegistryContentSha256, fixture.activationChangeContract.rollbackRegistryContentSha256);
  for (const key of Object.keys(AUTHORITY)) assert.strictEqual(result[key], false);

  assert.deepStrictEqual(Object.keys(fixture.activeRegistry).sort(), [...SUCCESSOR_TOP_LEVEL_KEYS].sort());
  assert.deepStrictEqual(Object.keys(fixture.activeRegistry.governedCompositeBaseline).sort(), [...SUCCESSOR_BASELINE_KEYS].sort());
  assert.deepStrictEqual(verifySuccessorCompositeRegistryShape(fixture.activeRegistry), []);
  assert.deepStrictEqual(validateP75ContractBoundary(fixture.activationChangeContract), []);
  assert.strictEqual(sha256Object(p75ContractCore(fixture.activationChangeContract)), fixture.activationChangeContract.successorFreshActivationChangeContractHashSha256);
  assert.strictEqual(stableStringify(result), stableStringify(verifySuccessorFreshDualModeCanonicalRegistry(input)));

  const missingRaw = verifySuccessorFreshDualModeCanonicalRegistry({ ...input, observedRegistryContent: undefined });
  assert.strictEqual(missingRaw.status, STATUS.HOLD_SUCCESSOR_FRESH_DUAL_MODE_CANONICAL_REGISTRY);
  assert(missingRaw.blockers.includes('OBSERVED_ACTIVE_REGISTRY_CONTENT_REQUIRED'));

  const rawDrift = verifySuccessorFreshDualModeCanonicalRegistry({ ...input, observedRegistryContent: `${fixture.activeRegistryContent} ` });
  assert.strictEqual(rawDrift.status, STATUS.HOLD_SUCCESSOR_FRESH_DUAL_MODE_CANONICAL_REGISTRY);
  assert(rawDrift.blockers.includes('OBSERVED_ACTIVE_REGISTRY_CONTENT_NOT_CANONICAL'));

  const unknownTopLevel = clone(fixture.activeRegistry);
  unknownTopLevel.unexpected = true;
  const badShape = verifySuccessorFreshDualModeCanonicalRegistry({ ...input, registry: unknownTopLevel, observedRegistryContent: `${JSON.stringify(unknownTopLevel, null, 2)}\n` });
  assert.strictEqual(badShape.status, STATUS.HOLD_SUCCESSOR_FRESH_DUAL_MODE_CANONICAL_REGISTRY);
  assert(badShape.blockers.some((x) => /missing or unknown fields/.test(x)));

  const schema3 = clone(fixture.activeRegistry);
  schema3.schemaVersion = 3;
  const oldSchema = verifySuccessorFreshDualModeCanonicalRegistry({ ...input, registry: schema3, observedRegistryContent: `${JSON.stringify(schema3, null, 2)}\n` });
  assert.strictEqual(oldSchema.status, STATUS.HOLD_SUCCESSOR_FRESH_DUAL_MODE_CANONICAL_REGISTRY);
  assert(oldSchema.blockers.some((x) => /schemaVersion must equal 4/.test(x)));

  const tamperedContract = clone(fixture.activationChangeContract);
  tamperedContract.successorFreshActivationChangeContractHashSha256 = sha256Text('tampered-contract');
  const badContract = verifySuccessorFreshDualModeCanonicalRegistry({ ...input, activationChangeContract: tamperedContract });
  assert.strictEqual(badContract.status, STATUS.HOLD_SUCCESSOR_FRESH_DUAL_MODE_CANONICAL_REGISTRY);
  assert(badContract.blockers.includes('P75_SUCCESSOR_FRESH_ACTIVATION_CHANGE_CONTRACT_HASH_MISMATCH'));

  const tamperedCandidate = clone(fixture.successorFreshCompositeCandidate);
  tamperedCandidate.successorFreshCompositeRegistryCandidateHashSha256 = sha256Text('tampered-candidate');
  const badCandidate = verifySuccessorFreshDualModeCanonicalRegistry({ ...input, successorFreshCompositeCandidate: tamperedCandidate });
  assert.strictEqual(badCandidate.status, STATUS.HOLD_SUCCESSOR_FRESH_DUAL_MODE_CANONICAL_REGISTRY);
  assert(badCandidate.blockers.some((x) => /P69/.test(x)));

  const tamperedSignedDecision = { ...fixture.signedOwnerDecision, signatureBase64: Buffer.alloc(256, 5).toString('base64') };
  const badOwnerSignature = verifySuccessorFreshDualModeCanonicalRegistry({ ...input, signedOwnerDecision: tamperedSignedDecision });
  assert.strictEqual(badOwnerSignature.status, STATUS.HOLD_SUCCESSOR_FRESH_DUAL_MODE_CANONICAL_REGISTRY);
  assert(badOwnerSignature.blockers.includes('SUCCESSOR_FRESH_OWNER_SIGNATURE_INVALID'));

  const tamperedRollbackContract = clone(fixture.activationChangeContract);
  tamperedRollbackContract.rollbackRegistryContent = `${tamperedRollbackContract.rollbackRegistryContent} `;
  const badRollbackRaw = verifySuccessorFreshDualModeCanonicalRegistry({ ...input, activationChangeContract: tamperedRollbackContract });
  assert.strictEqual(badRollbackRaw.status, STATUS.HOLD_SUCCESSOR_FRESH_DUAL_MODE_CANONICAL_REGISTRY);
  assert(badRollbackRaw.blockers.includes('P75_ROLLBACK_REGISTRY_CONTENT_BINDING_MISMATCH') || badRollbackRaw.blockers.includes('P75_SUCCESSOR_FRESH_ACTIVATION_CHANGE_CONTRACT_HASH_MISMATCH'));

  const escalated = verifySuccessorFreshDualModeCanonicalRegistry({ ...input, releaseAuthorized: true });
  assert.strictEqual(escalated.status, STATUS.HOLD_SUCCESSOR_FRESH_DUAL_MODE_CANONICAL_REGISTRY);
  assert(escalated.blockers.includes('CALLER_AUTHORITY_ESCALATION_NOT_ALLOWED'));

  const forbiddenKey = verifySuccessorFreshDualModeCanonicalRegistry({ ...input, nested: { privateKeyPem: 'forbidden' } });
  assert.strictEqual(forbiddenKey.status, STATUS.HOLD_SUCCESSOR_FRESH_DUAL_MODE_CANONICAL_REGISTRY);
  assert(forbiddenKey.blockers.some((x) => x.startsWith('PRIVATE_OR_SECRET_KEY_MATERIAL_REJECTED:')));

  assert.throws(() => parseArgs(['--registry', 'a.json', '--registry', 'b.json']), /duplicate argument/);
  assert.throws(() => parseArgs(['--private-key', 'key.pem']), /private or secret signing key argument rejected/);
  assert.throws(() => parseArgs(['--unknown', 'x']), /unknown argument/);
  assert.throws(() => requireSuccessorArgs({}), /missing required argument for successor fresh composite mode/);

  process.stdout.write('P76 successor fresh dual-mode canonical registry verifier tests passed\n');
})();
