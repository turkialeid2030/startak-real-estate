'use strict';

const assert = require('assert');
const {
  PRODUCTION_QUALIFICATION_STATUS,
  NEXT_STEP,
} = require('../../src/runtime/production-qualification-service');
const {
  SECURITY_UAT_STATUS,
} = require('../../src/qualification/independent-security-uat-evidence-gate');
const {
  RELEASE_CANDIDATE_STATUS,
  REQUIRED_OPEN_EXTERNAL_BLOCKERS,
  buildProductizationReleaseCandidateEvidenceBundle,
} = require('../../src/qualification/productization-release-candidate-evidence-bundle');

const results = [];
const COMMIT = 'a'.repeat(40);

async function test(id, fn) {
  try {
    await fn();
    results.push([id, 'PASS']);
    console.log(id + ' PASS');
  } catch (error) {
    results.push([id, 'FAIL: ' + error.message]);
    console.log(id + ' FAIL: ' + error.message);
  }
}

function productionQualification(overrides = {}) {
  return {
    status: PRODUCTION_QUALIFICATION_STATUS.READY_FOR_EXISTING_RELEASE_GOVERNANCE_REVIEW,
    releaseGovernanceReviewEligible: true,
    humanReleaseAuthorityApprovalRequired: true,
    nextStep: NEXT_STEP.EXISTING_RELEASE_GOVERNANCE_REVIEW,
    gates: {
      productionReadiness: { status: 'READY_FOR_PRODUCTION_REVIEW', ready: true },
      independentReleaseQualification: { status: 'READY_FOR_RELEASE_AUTHORITY_REVIEW', ready: true, integrityValid: true },
      institutionalGoLiveReview: { status: 'READY_FOR_HUMAN_GO_LIVE_DECISION', ready: true },
    },
    authority: {
      releaseAuthorized: false,
      mergeAuthorized: false,
      deploymentAuthorized: false,
      goLiveAuthorized: false,
      transactionAuthorized: false,
      productionAuthenticationValidated: false,
      productionPersistenceValidated: false,
      productionSecurityValidated: false,
      productionPerformanceValidated: false,
      legalApprovalEstablished: false,
      certifiedValuationEstablished: false,
    },
    secretConnectionString: 'must-not-leak',
    ...overrides,
  };
}

function securityUat(overrides = {}) {
  return {
    status: SECURITY_UAT_STATUS.INDEPENDENT_SECURITY_UAT_EVIDENCE_COMPLETE_NOT_RELEASE_AUTHORIZED,
    plan: {
      environment: 'staging',
      serviceRef: 'startak-staging-api',
      exactCommitSha: COMMIT,
    },
    evidenceBundleRef: `sha256:${'b'.repeat(64)}`,
    pentestEvidenceRef: `sha256:${'c'.repeat(64)}`,
    uatEvidenceRef: `sha256:${'d'.repeat(64)}`,
    pentest: { openFindingCounts: { CRITICAL: 0, HIGH: 0 } },
    uat: { failedScenarios: 0 },
    productionQualified: false,
    releaseCandidateAuthorityEstablished: false,
    authority: {
      releaseAuthorized: false,
      mergeAuthorized: false,
      deploymentAuthorized: false,
      goLiveAuthorized: false,
      transactionAuthorized: false,
      productionSecurityValidated: false,
      productionUatValidated: false,
      externalEvidenceAuthenticityValidatedHere: false,
    },
    bearerToken: 'must-not-leak-token',
    ...overrides,
  };
}

function input(overrides = {}) {
  return {
    candidateId: 'startak-rc-evidence-2026-09',
    environment: 'staging',
    serviceRef: 'startak-staging-api',
    exactCommitSha: COMMIT,
    productionQualification: productionQualification(),
    securityUatEvidence: securityUat(),
    openExternalBlockers: [...REQUIRED_OPEN_EXTERNAL_BLOCKERS],
    assembledBy: 'release-engineer',
    reviewedBy: 'independent-release-reviewer',
    assembledAt: '2026-09-09T16:00:00.000Z',
    reviewedAt: '2026-09-09T16:30:00.000Z',
    ...overrides,
  };
}

function assertAuthorityClosed(result) {
  assert.strictEqual(result.productionQualified, false);
  assert.strictEqual(result.externalBlockersRemainOpen, true);
  assert.strictEqual(result.humanReleaseAuthorityApprovalRequired, true);
  for (const value of Object.values(result.authority)) assert.strictEqual(value, false);
}

(async () => {
  await test('PRODUCTIZATION-P20-01', async () => {
    const result = buildProductizationReleaseCandidateEvidenceBundle(input());
    assert.strictEqual(result.status, RELEASE_CANDIDATE_STATUS.READY_FOR_EXISTING_RELEASE_GOVERNANCE_REVIEW);
    assert.strictEqual(result.releaseGovernanceReviewEligible, true);
    assert.strictEqual(result.engineeringEvidenceBundleAssembled, true);
    assert.strictEqual(result.issues.length, 0);
    assert.strictEqual(result.manifestHashSha256.length, 64);
    assertAuthorityClosed(result);
  });

  await test('PRODUCTIZATION-P20-02', async () => {
    const result = buildProductizationReleaseCandidateEvidenceBundle(input({
      productionQualification: productionQualification({
        status: PRODUCTION_QUALIFICATION_STATUS.HOLD_PRODUCTION_READINESS,
        releaseGovernanceReviewEligible: false,
      }),
    }));
    assert.strictEqual(result.status, RELEASE_CANDIDATE_STATUS.HOLD_PRODUCTION_QUALIFICATION);
    assert.strictEqual(result.releaseGovernanceReviewEligible, false);
  });

  await test('PRODUCTIZATION-P20-03', async () => {
    const result = buildProductizationReleaseCandidateEvidenceBundle(input({
      securityUatEvidence: securityUat({ status: SECURITY_UAT_STATUS.HOLD_PENTEST_FINDINGS }),
    }));
    assert.strictEqual(result.status, RELEASE_CANDIDATE_STATUS.HOLD_SECURITY_UAT_EVIDENCE);
  });

  await test('PRODUCTIZATION-P20-04', async () => {
    const result = buildProductizationReleaseCandidateEvidenceBundle(input({
      securityUatEvidence: securityUat({
        plan: { environment: 'staging', serviceRef: 'other-service', exactCommitSha: COMMIT },
      }),
    }));
    assert.strictEqual(result.status, RELEASE_CANDIDATE_STATUS.HOLD_SCOPE_MISMATCH);
  });

  await test('PRODUCTIZATION-P20-05', async () => {
    const blockers = REQUIRED_OPEN_EXTERNAL_BLOCKERS.filter((item) => item !== 'HUMAN_RELEASE_AUTHORITY_APPROVAL');
    const result = buildProductizationReleaseCandidateEvidenceBundle(input({ openExternalBlockers: blockers }));
    assert.strictEqual(result.status, RELEASE_CANDIDATE_STATUS.HOLD_EXTERNAL_BLOCKER_REGISTER);
    assert.ok(result.issues.includes('MISSING_OPEN_EXTERNAL_BLOCKER:HUMAN_RELEASE_AUTHORITY_APPROVAL'));
  });

  await test('PRODUCTIZATION-P20-06', async () => {
    const result = buildProductizationReleaseCandidateEvidenceBundle(input({
      assembledBy: 'same-person',
      reviewedBy: 'same-person',
    }));
    assert.strictEqual(result.status, RELEASE_CANDIDATE_STATUS.HOLD_REVIEW_GOVERNANCE);
  });

  await test('PRODUCTIZATION-P20-07', async () => {
    assert.throws(
      () => buildProductizationReleaseCandidateEvidenceBundle(input({ releaseAuthorized: true })),
      /CALLER_RELEASE_CANDIDATE_AUTHORITY_OVERRIDE_NOT_ALLOWED/,
    );
  });

  await test('PRODUCTIZATION-P20-08', async () => {
    const first = buildProductizationReleaseCandidateEvidenceBundle(input());
    const second = buildProductizationReleaseCandidateEvidenceBundle(input());
    assert.strictEqual(first.manifestHashSha256, second.manifestHashSha256);
    assert.strictEqual(first.manifestRef, second.manifestRef);
  });

  await test('PRODUCTIZATION-P20-09', async () => {
    const result = buildProductizationReleaseCandidateEvidenceBundle(input());
    const serialized = JSON.stringify(result);
    assert.ok(!serialized.includes('must-not-leak'));
    assert.ok(!serialized.includes('secretConnectionString'));
    assert.ok(!serialized.includes('bearerToken'));
  });

  await test('PRODUCTIZATION-P20-10', async () => {
    assert.throws(
      () => buildProductizationReleaseCandidateEvidenceBundle(input({ environment: 'production' })),
      /environment must be staging/,
    );
  });

  await test('PRODUCTIZATION-P20-11', async () => {
    assert.throws(
      () => buildProductizationReleaseCandidateEvidenceBundle(input({
        openExternalBlockers: [...REQUIRED_OPEN_EXTERNAL_BLOCKERS, REQUIRED_OPEN_EXTERNAL_BLOCKERS[0]],
      })),
      /must not contain duplicates/,
    );
  });

  await test('PRODUCTIZATION-P20-12', async () => {
    const result = buildProductizationReleaseCandidateEvidenceBundle(input());
    assert.strictEqual(result.securityUatEvidence.openCriticalFindings, 0);
    assert.strictEqual(result.securityUatEvidence.openHighFindings, 0);
    assert.strictEqual(result.securityUatEvidence.uatFailedScenarios, 0);
    assert.strictEqual(result.productionQualification.releaseGovernanceReviewEligible, true);
    assertAuthorityClosed(result);
  });

  const failed = results.filter((entry) => entry[1] !== 'PASS');
  console.log(`PRODUCTIZATION_P20_RELEASE_CANDIDATE_EVIDENCE_RESULT=${failed.length === 0 ? 'PASS' : 'FAIL'} ${results.filter((entry) => entry[1] === 'PASS').length}/${results.length}`);
  if (failed.length > 0) process.exit(1);
})().catch((error) => {
  console.error('PRODUCTIZATION_P20_RELEASE_CANDIDATE_EVIDENCE_FATAL', error && error.stack ? error.stack : error);
  process.exit(1);
});
