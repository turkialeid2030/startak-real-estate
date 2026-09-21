'use strict';

const assert = require('assert');
const intake = require('../../tools/production-required-reviewer-evidence-intake');

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

function designationCandidate(overrides = {}) {
  return {
    schemaVersion: 1,
    status: 'READY_FOR_GITHUB_ENVIRONMENT_CONFIGURATION',
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

function configurationEvidence(overrides = {}) {
  return {
    environmentName: 'production',
    configuredReviewerGitHubLogin: 'independent-reviewer',
    configuredReviewerSubjectRef: 'github:independent-reviewer',
    configurationEvidenceRef: 'evidence:test-admin-ui',
    configuredAt: '2026-09-21T08:10:00Z',
    requiredReviewerEnabled: true,
    productionBranchScopeMainOnly: true,
    adminBypassDisabled: true,
    cloudflareTokenEnvironmentScoped: true,
    repositoryLevelCloudflareTokenRemoved: true,
    ...overrides,
  };
}

test('admin evidence intake qualifies internally consistent supplied metadata only', () => {
  const result = intake.prepareAdminEvidenceRecord({
    designationCandidate: designationCandidate(),
    configurationEvidence: configurationEvidence(),
  });
  assert.strictEqual(result.status, intake.READY_STATUS);
  assert.strictEqual(result.requiredReviewerEnabled, true);
  assert.strictEqual(result.githubAdministratorStateAuthenticatedByTool, false);
  assert.strictEqual(result.screenshotOrUiEvidenceAuthenticatedByTool, false);
  assert.strictEqual(result.issue327ClosureAuthorized, false);
  assert.strictEqual(result.deploymentAuthorized, false);
  assert.strictEqual(result.authorityEffect, 'NONE');
});

test('admin evidence intake rejects reviewer identity mismatch', () => {
  assert.throws(
    () => intake.prepareAdminEvidenceRecord({
      designationCandidate: designationCandidate(),
      configurationEvidence: configurationEvidence({ configuredReviewerGitHubLogin: 'someone-else' }),
    }),
    /CONFIGURED_REVIEWER_LOGIN_MISMATCH/,
  );
});

test('admin evidence intake rejects incomplete control assertions', () => {
  assert.throws(
    () => intake.prepareAdminEvidenceRecord({
      designationCandidate: designationCandidate(),
      configurationEvidence: configurationEvidence({ requiredReviewerEnabled: false }),
    }),
    /requiredReviewerEnabled must be true/,
  );
  assert.throws(
    () => intake.prepareAdminEvidenceRecord({
      designationCandidate: designationCandidate(),
      configurationEvidence: configurationEvidence({ adminBypassDisabled: false }),
    }),
    /adminBypassDisabled must be true/,
  );
});

test('admin evidence intake rejects configuration before designation effective time', () => {
  assert.throws(
    () => intake.prepareAdminEvidenceRecord({
      designationCandidate: designationCandidate(),
      configurationEvidence: configurationEvidence({ configuredAt: '2026-09-21T07:59:59Z' }),
    }),
    /CONFIGURATION_PRECEDES_DESIGNATION_EFFECTIVE_TIME/,
  );
});

test('admin evidence intake rejects template placeholders', () => {
  assert.throws(
    () => intake.prepareAdminEvidenceRecord({
      designationCandidate: designationCandidate(),
      configurationEvidence: configurationEvidence({ configurationEvidenceRef: '<REAL_EVIDENCE>' }),
    }),
    /unresolved template placeholders/,
  );
});

if (!process.exitCode) {
  console.log(`PRODUCTION_REQUIRED_REVIEWER_EVIDENCE_INTAKE_TESTS=PASS ${passed}/${passed}`);
  console.log('SYNTHETIC_TEST_FIXTURES_ARE_NOT_ADMIN_EVIDENCE=true');
  console.log('GITHUB_ADMIN_STATE_AUTHENTICATED=false');
  console.log('ISSUE_327_CLOSURE_AUTHORIZED=false');
  console.log('AUTHORITY_EFFECT=NONE');
}
