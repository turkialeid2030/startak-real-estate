'use strict';

const assert = require('assert');
const {
  OBSERVABILITY_STATUS,
} = require('../../src/qualification/controlled-observability-incident-qualification');
const {
  SECURITY_UAT_STATUS,
  evaluateIndependentSecurityUatEvidence,
} = require('../../src/qualification/independent-security-uat-evidence-gate');

const results = [];
const COMMIT = 'a'.repeat(40);
const REPORT_HASH = 'b'.repeat(64);
const UAT_HASH = 'c'.repeat(64);

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

function observability(overrides = {}) {
  return {
    status: OBSERVABILITY_STATUS.OBSERVABILITY_INCIDENT_EVIDENCE_COMPLETE_NOT_PRODUCTION_CERTIFIED,
    evidenceHashSha256: 'd'.repeat(64),
    plan: {
      environment: 'staging',
      serviceRef: 'startak-staging-api',
      exactCommitSha: COMMIT,
    },
    ...overrides,
  };
}

function pentest(overrides = {}) {
  return {
    status: 'PASS',
    environment: 'staging',
    serviceRef: 'startak-staging-api',
    exactCommitSha: COMMIT,
    reportRef: 'secure://pentest/report-2026-09',
    reportHashSha256: REPORT_HASH,
    testerOrganization: 'Independent Security Lab',
    preparedBy: 'external-tester',
    reviewedBy: 'external-reviewer',
    independentAssessorAttested: true,
    scopeIncludesAuthentication: true,
    scopeIncludesTenantIsolation: true,
    scopeIncludesApiAuthorization: true,
    scopeIncludesServerRuntime: true,
    retestCompletedForRemediatedCriticalHigh: true,
    findingCounts: { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 1 },
    openFindingCounts: { CRITICAL: 0, HIGH: 0, MEDIUM: 1, LOW: 2, INFO: 1 },
    startedAt: '2026-09-05T08:00:00.000Z',
    completedAt: '2026-09-06T08:00:00.000Z',
    reviewedAt: '2026-09-07T08:00:00.000Z',
    password: 'must-not-leak',
    ...overrides,
  };
}

function uat(overrides = {}) {
  return {
    status: 'PASS',
    environment: 'staging',
    serviceRef: 'startak-staging-api',
    exactCommitSha: COMMIT,
    acceptanceRef: 'secure://uat/acceptance-2026-09',
    acceptanceArtifactHashSha256: UAT_HASH,
    businessOwner: 'business-owner',
    reviewedBy: 'uat-independent-reviewer',
    criticalWorkflowCoverageComplete: true,
    tenantBoundaryAcceptanceComplete: true,
    authorizationWorkflowAcceptanceComplete: true,
    requiredScenarios: 24,
    passedScenarios: 24,
    failedScenarios: 0,
    startedAt: '2026-09-06T09:00:00.000Z',
    completedAt: '2026-09-07T09:00:00.000Z',
    reviewedAt: '2026-09-08T09:00:00.000Z',
    bearerToken: 'must-not-leak-token',
    ...overrides,
  };
}

function input(overrides = {}) {
  return {
    observabilityQualification: observability(),
    environment: 'staging',
    serviceRef: 'startak-staging-api',
    exactCommitSha: COMMIT,
    assessedAt: '2026-09-09T12:00:00.000Z',
    maximumEvidenceAgeDays: 30,
    pentestEvidence: pentest(),
    uatEvidence: uat(),
    ...overrides,
  };
}

function assertAuthorityClosed(result) {
  assert.strictEqual(result.productionQualified, false);
  assert.strictEqual(result.releaseCandidateAuthorityEstablished, false);
  for (const value of Object.values(result.authority)) assert.strictEqual(value, false);
}

(async () => {
  await test('PRODUCTIZATION-P19-01', async () => {
    const result = evaluateIndependentSecurityUatEvidence(input());
    assert.strictEqual(result.status, SECURITY_UAT_STATUS.INDEPENDENT_SECURITY_UAT_EVIDENCE_COMPLETE_NOT_RELEASE_AUTHORIZED);
    assert.strictEqual(result.issues.length, 0);
    assert.strictEqual(result.pentest.openFindingCounts.HIGH, 0);
    assert.strictEqual(result.uat.failedScenarios, 0);
    assert.strictEqual(result.evidenceBundleHashSha256.length, 64);
    assertAuthorityClosed(result);
  });

  await test('PRODUCTIZATION-P19-02', async () => {
    const result = evaluateIndependentSecurityUatEvidence(input({
      observabilityQualification: observability({ status: OBSERVABILITY_STATUS.HOLD_OBJECTIVES }),
    }));
    assert.strictEqual(result.status, SECURITY_UAT_STATUS.HOLD_OBSERVABILITY_QUALIFICATION);
    assert.strictEqual(result.pentest, null);
  });

  await test('PRODUCTIZATION-P19-03', async () => {
    const result = evaluateIndependentSecurityUatEvidence(input({
      pentestEvidence: pentest({ reportHashSha256: 'not-a-hash' }),
    }));
    assert.strictEqual(result.status, SECURITY_UAT_STATUS.HOLD_PENTEST_EVIDENCE);
    assert.ok(result.issues.includes('PENTEST_EVIDENCE_INVALID_OR_INCOMPLETE'));
  });

  await test('PRODUCTIZATION-P19-04', async () => {
    const result = evaluateIndependentSecurityUatEvidence(input({
      pentestEvidence: pentest({ exactCommitSha: 'e'.repeat(40) }),
    }));
    assert.strictEqual(result.status, SECURITY_UAT_STATUS.HOLD_SCOPE_MISMATCH);
    assert.ok(result.issues.includes('PENTEST_SCOPE_MISMATCH'));
  });

  await test('PRODUCTIZATION-P19-05', async () => {
    const result = evaluateIndependentSecurityUatEvidence(input({
      maximumEvidenceAgeDays: 1,
      assessedAt: '2026-09-09T12:00:00.000Z',
    }));
    assert.strictEqual(result.status, SECURITY_UAT_STATUS.HOLD_STALE_EVIDENCE);
    assert.ok(result.issues.some((item) => item.includes('PENTEST_EVIDENCE_OUTSIDE_FRESHNESS')));
  });

  await test('PRODUCTIZATION-P19-06', async () => {
    const result = evaluateIndependentSecurityUatEvidence(input({
      pentestEvidence: pentest({ openFindingCounts: { CRITICAL: 0, HIGH: 1, MEDIUM: 0, LOW: 0, INFO: 0 } }),
    }));
    assert.strictEqual(result.status, SECURITY_UAT_STATUS.HOLD_PENTEST_FINDINGS);
    assert.deepStrictEqual(result.issues, ['OPEN_CRITICAL_OR_HIGH_PENTEST_FINDINGS']);
  });

  await test('PRODUCTIZATION-P19-07', async () => {
    const result = evaluateIndependentSecurityUatEvidence(input({
      pentestEvidence: pentest({ retestCompletedForRemediatedCriticalHigh: false }),
    }));
    assert.strictEqual(result.status, SECURITY_UAT_STATUS.HOLD_PENTEST_FINDINGS);
    assert.deepStrictEqual(result.issues, ['CRITICAL_HIGH_REMEDIATION_RETEST_NOT_COMPLETE']);
  });

  await test('PRODUCTIZATION-P19-08', async () => {
    const result = evaluateIndependentSecurityUatEvidence(input({
      uatEvidence: uat({ status: 'FAIL', requiredScenarios: 24, passedScenarios: 23, failedScenarios: 1 }),
    }));
    assert.strictEqual(result.status, SECURITY_UAT_STATUS.HOLD_UAT_EVIDENCE);
    assert.ok(result.issues.includes('UAT_STATUS_NOT_PASS'));
    assert.ok(result.issues.includes('UAT_SCENARIOS_NOT_ALL_PASSING'));
  });

  await test('PRODUCTIZATION-P19-09', async () => {
    const result = evaluateIndependentSecurityUatEvidence(input({
      pentestEvidence: pentest({ independentAssessorAttested: false }),
    }));
    assert.strictEqual(result.status, SECURITY_UAT_STATUS.HOLD_PENTEST_EVIDENCE);
    assert.ok(result.issues.includes('PENTEST_INDEPENDENT_ASSESSOR_NOT_ATTESTED'));
  });

  await test('PRODUCTIZATION-P19-10', async () => {
    const result = evaluateIndependentSecurityUatEvidence(input({
      uatEvidence: uat({ businessOwner: 'same-person', reviewedBy: 'same-person' }),
    }));
    assert.strictEqual(result.status, SECURITY_UAT_STATUS.HOLD_UAT_EVIDENCE);
    assert.ok(result.issues.includes('UAT_REVIEWER_NOT_SEPARATE'));
  });

  await test('PRODUCTIZATION-P19-11', async () => {
    const result = evaluateIndependentSecurityUatEvidence(input());
    const serialized = JSON.stringify(result);
    assert.ok(!serialized.includes('secure://pentest/report-2026-09'));
    assert.ok(!serialized.includes('secure://uat/acceptance-2026-09'));
    assert.ok(!serialized.includes('must-not-leak'));
    assert.ok(!serialized.includes('Independent Security Lab'));
    assert.ok(result.pentest.reportRef.startsWith('sha256:'));
    assert.ok(result.uat.acceptanceRef.startsWith('sha256:'));
  });

  await test('PRODUCTIZATION-P19-12', async () => {
    const first = evaluateIndependentSecurityUatEvidence(input());
    const second = evaluateIndependentSecurityUatEvidence(input());
    assert.strictEqual(first.evidenceBundleHashSha256, second.evidenceBundleHashSha256);
    assert.strictEqual(first.plan.planHashSha256, second.plan.planHashSha256);
  });

  await test('PRODUCTIZATION-P19-13', async () => {
    assert.throws(
      () => evaluateIndependentSecurityUatEvidence(input({ environment: 'production' })),
      /environment must be staging/,
    );
  });

  await test('PRODUCTIZATION-P19-14', async () => {
    const result = evaluateIndependentSecurityUatEvidence(input({
      pentestEvidence: pentest({
        findingCounts: { CRITICAL: 0, HIGH: 0, MEDIUM: 4, LOW: 2, INFO: 0 },
        openFindingCounts: { CRITICAL: 0, HIGH: 0, MEDIUM: 2, LOW: 1, INFO: 0 },
        retestCompletedForRemediatedCriticalHigh: false,
      }),
    }));
    assert.strictEqual(result.status, SECURITY_UAT_STATUS.INDEPENDENT_SECURITY_UAT_EVIDENCE_COMPLETE_NOT_RELEASE_AUTHORIZED);
  });

  const failed = results.filter((entry) => entry[1] !== 'PASS');
  console.log(`PRODUCTIZATION_P19_INDEPENDENT_SECURITY_UAT_RESULT=${failed.length === 0 ? 'PASS' : 'FAIL'} ${results.filter((entry) => entry[1] === 'PASS').length}/${results.length}`);
  if (failed.length > 0) process.exit(1);
})().catch((error) => {
  console.error('PRODUCTIZATION_P19_INDEPENDENT_SECURITY_UAT_FATAL', error && error.stack ? error.stack : error);
  process.exit(1);
});
