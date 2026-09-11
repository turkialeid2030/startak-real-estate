'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  STATUS,
  verifyCanonicalBaselineRegistryFile,
} = require('../../tools/canonical-baseline-registry-gate');
const { buildSuccessorFreshActiveFixture, sha256Text } = require('../fixtures/successor_fresh_active_fixture');

function writeJson(dir, name, value) {
  const file = path.join(dir, name);
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  return file;
}

(function run() {
  const fixture = buildSuccessorFreshActiveFixture();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p77-successor-gate-'));
  try {
    const registryPath = path.join(dir, 'canonical-baseline.json');
    fs.writeFileSync(registryPath, fixture.activeRegistryContent, { encoding: 'utf8', mode: 0o600 });
    const env = {
      SUCCESSOR_FRESH_CANONICAL_ACTIVATION_CONTRACT_PATH: writeJson(dir, 'contract.json', fixture.activationChangeContract),
      SUCCESSOR_FRESH_CANONICAL_REVIEW_PACKET_PATH: writeJson(dir, 'review-packet.json', fixture.successorReviewPacket),
      SUCCESSOR_FRESH_CANONICAL_REVIEWER_LIFECYCLE_PATH: writeJson(dir, 'reviewer-lifecycle.json', fixture.reviewerLifecycle),
      SUCCESSOR_FRESH_CANONICAL_ACTIVATION_PLAN_PATH: writeJson(dir, 'activation-plan.json', fixture.activationPlan),
      SUCCESSOR_FRESH_CANONICAL_COMPOSITE_CANDIDATE_PATH: writeJson(dir, 'candidate.json', fixture.successorFreshCompositeCandidate),
      SUCCESSOR_FRESH_CANONICAL_SHADOW_PATH: writeJson(dir, 'shadow.json', fixture.successorFreshShadowEvaluation),
      SUCCESSOR_FRESH_CANONICAL_CUTOVER_REHEARSAL_PATH: writeJson(dir, 'rehearsal.json', fixture.successorFreshRehearsalResult),
      SUCCESSOR_FRESH_CANONICAL_CUTOVER_SAFETY_GUARD_PATH: writeJson(dir, 'safety.json', fixture.safetyGuard),
      SUCCESSOR_FRESH_CANONICAL_OWNER_AUTHORITY_REGISTRY_PATH: writeJson(dir, 'owner-registry.json', fixture.successorFreshOwnerAuthorityRegistry),
      EXPECTED_SUCCESSOR_FRESH_CANONICAL_OWNER_AUTHORITY_REGISTRY_SHA256: fixture.expectedSuccessorFreshOwnerAuthorityRegistryHashSha256,
      SUCCESSOR_FRESH_CANONICAL_SIGNED_OWNER_DECISION_PATH: writeJson(dir, 'owner-decision.json', fixture.signedOwnerDecision),
    };

    const verified = verifyCanonicalBaselineRegistryFile({ filePath: registryPath, env });
    assert.strictEqual(verified.status, STATUS.VERIFIED);
    assert.strictEqual(verified.verified, true);
    assert.strictEqual(verified.activeMode, 'GOVERNED_COMPOSITE_BASELINE');
    assert.strictEqual(verified.registrySchemaVersion, 4);
    assert.strictEqual(verified.verificationMode, 'SUCCESSOR_FRESH_GOVERNED_COMPOSITE_WITH_REVERIFIED_OWNER_AUTHORIZATION');
    assert.strictEqual(verified.p75ActivationChangeContractVerified, true);
    assert.strictEqual(verified.successorOwnerAuthorizationReverified, true);
    assert.strictEqual(verified.rollbackRegistryVerified, true);
    assert.strictEqual(verified.rollbackRawContentVerified, true);
    assert.strictEqual(verified.activationAuthorizationGrantedByGate, false);
    assert.strictEqual(verified.activationAppliedObserved, true);
    assert.strictEqual(verified.canonicalBaselineChangedObserved, true);
    assert.strictEqual(verified.releaseAuthorized, false);
    assert.strictEqual(verified.mergeAuthorized, false);
    assert.strictEqual(verified.deploymentAuthorized, false);
    assert.strictEqual(verified.goLiveAuthorized, false);
    assert.strictEqual(verified.transactionAuthorized, false);
    assert.strictEqual(verified.registryHashSha256, fixture.activationChangeContract.proposedRegistryHashSha256);
    assert.strictEqual(verified.registryContentSha256, fixture.activationChangeContract.proposedRegistryContentSha256);

    const missing = verifyCanonicalBaselineRegistryFile({ filePath: registryPath, env: {} });
    assert.strictEqual(missing.status, STATUS.REGISTRY_HOLD);
    assert.strictEqual(missing.reasonCode, 'SUCCESSOR_FRESH_COMPOSITE_BASELINE_ACTIVATION_EVIDENCE_REQUIRED');
    assert(missing.blockers.includes('MISSING_ACTIVATIONCONTRACT'));
    assert.strictEqual(missing.activationAuthorizationGrantedByGate, false);

    const partial = verifyCanonicalBaselineRegistryFile({
      filePath: registryPath,
      env: { SUCCESSOR_FRESH_CANONICAL_ACTIVATION_CONTRACT_PATH: env.SUCCESSOR_FRESH_CANONICAL_ACTIVATION_CONTRACT_PATH },
    });
    assert.strictEqual(partial.status, STATUS.REGISTRY_HOLD);
    assert.strictEqual(partial.reasonCode, 'SUCCESSOR_FRESH_COMPOSITE_BASELINE_ACTIVATION_EVIDENCE_REQUIRED');

    const badDecision = { ...fixture.signedOwnerDecision, signatureBase64: Buffer.alloc(256, 9).toString('base64') };
    const badDecisionPath = writeJson(dir, 'bad-owner-decision.json', badDecision);
    const invalidSignature = verifyCanonicalBaselineRegistryFile({
      filePath: registryPath,
      env: { ...env, SUCCESSOR_FRESH_CANONICAL_SIGNED_OWNER_DECISION_PATH: badDecisionPath },
    });
    assert.strictEqual(invalidSignature.status, STATUS.REGISTRY_HOLD);
    assert.strictEqual(invalidSignature.reasonCode, 'SUCCESSOR_FRESH_COMPOSITE_BASELINE_ACTIVATION_EVIDENCE_NOT_VERIFIED');
    assert(invalidSignature.blockers.includes('SUCCESSOR_FRESH_OWNER_SIGNATURE_INVALID'));

    const wrongTrustHash = verifyCanonicalBaselineRegistryFile({
      filePath: registryPath,
      env: { ...env, EXPECTED_SUCCESSOR_FRESH_CANONICAL_OWNER_AUTHORITY_REGISTRY_SHA256: sha256Text('wrong-owner-registry') },
    });
    assert.strictEqual(wrongTrustHash.status, STATUS.REGISTRY_HOLD);
    assert.strictEqual(wrongTrustHash.reasonCode, 'SUCCESSOR_FRESH_COMPOSITE_BASELINE_ACTIVATION_EVIDENCE_NOT_VERIFIED');
    assert(wrongTrustHash.blockers.includes('SUCCESSOR_FRESH_OWNER_AUTHORITY_REGISTRY_HASH_MISMATCH'));

    const rawDriftPath = path.join(dir, 'raw-drift-registry.json');
    fs.writeFileSync(rawDriftPath, `${fixture.activeRegistryContent} `, 'utf8');
    const rawDrift = verifyCanonicalBaselineRegistryFile({ filePath: rawDriftPath, env });
    assert.strictEqual(rawDrift.status, STATUS.REGISTRY_HOLD);
    assert.strictEqual(rawDrift.reasonCode, 'SUCCESSOR_FRESH_COMPOSITE_BASELINE_ACTIVATION_EVIDENCE_NOT_VERIFIED');
    assert(rawDrift.blockers.includes('OBSERVED_ACTIVE_REGISTRY_CONTENT_NOT_CANONICAL'));

    const unsupportedRegistry = JSON.parse(JSON.stringify(fixture.activeRegistry));
    unsupportedRegistry.schemaVersion = 5;
    const unsupportedPath = writeJson(dir, 'unsupported.json', unsupportedRegistry);
    const unsupported = verifyCanonicalBaselineRegistryFile({ filePath: unsupportedPath, env });
    assert.strictEqual(unsupported.status, STATUS.REGISTRY_HOLD);
    assert.strictEqual(unsupported.reasonCode, 'CANONICAL_BASELINE_COMPOSITE_SCHEMA_UNSUPPORTED');
    assert(Array.isArray(unsupported.blockers));
    assert(unsupported.blockers.includes('UNSUPPORTED_COMPOSITE_SCHEMA_VERSION:5'));

    const symlinkDecisionPath = path.join(dir, 'symlink-decision.json');
    fs.symlinkSync(env.SUCCESSOR_FRESH_CANONICAL_SIGNED_OWNER_DECISION_PATH, symlinkDecisionPath);
    const symlinked = verifyCanonicalBaselineRegistryFile({
      filePath: registryPath,
      env: { ...env, SUCCESSOR_FRESH_CANONICAL_SIGNED_OWNER_DECISION_PATH: symlinkDecisionPath },
    });
    assert.strictEqual(symlinked.status, STATUS.REGISTRY_HOLD);
    assert.strictEqual(symlinked.reasonCode, 'SUCCESSOR_FRESH_CANONICAL_SIGNED_OWNER_DECISION_SYMLINK_REJECTED');

    const legacyMinifiedPath = path.join(dir, 'legacy-minified.json');
    fs.writeFileSync(legacyMinifiedPath, JSON.stringify(fixture.currentRegistry), 'utf8');
    const legacy = verifyCanonicalBaselineRegistryFile({ filePath: legacyMinifiedPath, env: {} });
    assert.strictEqual(legacy.status, STATUS.VERIFIED);
    assert.strictEqual(legacy.activeMode, 'LEGACY_FILE_SHA256');
    assert.strictEqual(legacy.registrySchemaVersion, 1);
    assert.strictEqual(legacy.verificationMode, 'LEGACY_STRICT');
    assert.strictEqual(legacy.activationAuthorizationGrantedByGate, false);

    process.stdout.write('P77 successor fresh canonical registry release gate tests passed\n');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
})();
