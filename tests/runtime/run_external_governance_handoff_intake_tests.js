'use strict';

const assert = require('assert');
const reviewer = require('../../tools/production-required-reviewer-designation-intake');
const pin = require('../../tools/e2c-out-of-band-pin-intake');

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}: ${error.stack || error.message}`);
    process.exitCode = 1;
  }
}

function reviewerDesignation(overrides = {}) {
  return {
    environmentName: 'production',
    ownerSubjectRef: 'github:test-owner',
    reviewerGitHubLogin: 'independent-reviewer',
    reviewerSubjectRef: 'github:independent-reviewer',
    designationEvidenceRef: 'evidence:test-designation',
    effectiveFrom: '2026-09-21T08:00:00Z',
    independentFromOwner: true,
    requiredReviewerProtectionIntended: true,
    ...overrides,
  };
}

function trustRootCandidate() {
  return {
    schemaVersion: 1,
    status: 'READY_FOR_INDEPENDENT_OUT_OF_BAND_PINNING',
    registry: {
      schemaVersion: 1,
      registryId: 'e2c-registry-test',
      status: 'EXTERNALLY_GOVERNED',
      governanceOwnerRef: 'github:test-owner',
      verifiers: [
        {
          verifierId: 'verifier-test',
          verifierSubjectRef: 'human:verifier-test',
        },
      ],
      registryHashSha256: 'a'.repeat(64),
    },
    registryHashSha256: 'a'.repeat(64),
  };
}

function pinRecord(overrides = {}) {
  return {
    registryId: 'e2c-registry-test',
    registryHashSha256: 'a'.repeat(64),
    pinnedBySubjectRef: 'human:independent-pinner',
    pinnedAt: '2026-09-21T08:05:00Z',
    pinChannelRef: 'out-of-band:test-channel',
    pinEvidenceRef: 'evidence:test-pin',
    attestedOutOfBand: true,
    independentFromGovernanceOwner: true,
    ...overrides,
  };
}

test('required reviewer designation emits only configuration readiness', () => {
  const result = reviewer.prepareDesignationCandidate({ designation: reviewerDesignation() });
  assert.strictEqual(result.status, reviewer.READY_STATUS);
  assert.strictEqual(result.environmentName, 'production');
  assert.strictEqual(result.githubEnvironmentConfigured, false);
  assert.strictEqual(result.githubAccountExistenceVerified, false);
  assert.strictEqual(result.administratorEvidencePresent, false);
  assert.strictEqual(result.approvalCreated, false);
  assert.strictEqual(result.deploymentAuthorized, false);
  assert.strictEqual(result.authorityEffect, 'NONE');
});

test('required reviewer designation rejects owner identity and template placeholders', () => {
  assert.throws(
    () => reviewer.prepareDesignationCandidate({ designation: reviewerDesignation({ reviewerGitHubLogin: 'test-owner' }) }),
    /MUST_BE_DISTINCT_FROM_OWNER/,
  );
  assert.throws(
    () => reviewer.prepareDesignationCandidate({ designation: reviewerDesignation({ reviewerSubjectRef: '<REAL_REVIEWER>' }) }),
    /unresolved template placeholders/,
  );
});

test('required reviewer designation rejects wrong environment and malformed login', () => {
  assert.throws(
    () => reviewer.prepareDesignationCandidate({ designation: reviewerDesignation({ environmentName: 'Production' }) }),
    /exactly production/,
  );
  assert.throws(
    () => reviewer.prepareDesignationCandidate({ designation: reviewerDesignation({ reviewerGitHubLogin: '-bad-' }) }),
    /valid GitHub login shape/,
  );
});

test('E2C pin intake qualifies only a matching supplied pin record', () => {
  const result = pin.preparePinReceipt({ candidate: trustRootCandidate(), pin: pinRecord() });
  assert.strictEqual(result.status, pin.READY_STATUS);
  assert.strictEqual(result.registryHashSha256, 'a'.repeat(64));
  assert.strictEqual(result.attestedOutOfBand, true);
  assert.strictEqual(result.independentFromGovernanceOwner, true);
  assert.strictEqual(result.externalChannelAuthenticatedByTool, false);
  assert.strictEqual(result.pinSubstanceCreatedByTool, false);
  assert.strictEqual(result.authorityEffect, 'NONE');
});

test('E2C pin intake rejects hash mismatch and governance-owner self pin', () => {
  assert.throws(
    () => pin.preparePinReceipt({ candidate: trustRootCandidate(), pin: pinRecord({ registryHashSha256: 'b'.repeat(64) }) }),
    /E2C_PIN_REGISTRY_HASH_MISMATCH/,
  );
  assert.throws(
    () => pin.preparePinReceipt({ candidate: trustRootCandidate(), pin: pinRecord({ pinnedBySubjectRef: 'github:test-owner' }) }),
    /E2C_PINNER_MUST_BE_DISTINCT_FROM_GOVERNANCE_OWNER/,
  );
});

test('E2C pin intake does not silently claim external-channel authentication', () => {
  const result = pin.preparePinReceipt({
    candidate: trustRootCandidate(),
    pin: pinRecord({ pinnedBySubjectRef: 'human:verifier-test' }),
  });
  assert.strictEqual(result.pinnerMatchesVerifierSubject, true);
  assert.strictEqual(result.externalChannelAuthenticatedByTool, false);
  assert.strictEqual(result.signatureCreatedByTool, false);
  assert.strictEqual(result.validationAuthorityGranted, false);
});

if (!process.exitCode) {
  console.log(`EXTERNAL_GOVERNANCE_HANDOFF_INTAKE_TESTS=PASS ${passed}/${passed}`);
  console.log('SYNTHETIC_TEST_FIXTURES_ARE_NOT_PRODUCTION_EVIDENCE=true');
  console.log('HUMAN_IDENTITIES_INVENTED=false');
  console.log('GITHUB_ENVIRONMENT_MUTATED=false');
  console.log('OUT_OF_BAND_PIN_CREATED=false');
  console.log('AUTHORITY_EFFECT=NONE');
}
