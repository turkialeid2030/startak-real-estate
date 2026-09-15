'use strict';

const assert = require('assert');
const crypto = require('crypto');

const security = require('../../src/security/security-qualification-evidence.js');
const perf = require('../../src/qualification/performance-resilience-qualification.js');
const release = require('../../src/qualification/independent-release-qualification.js');
const baseSecurity = require('../../src/security/security-readiness-orchestrator.js');
const productionSecurity = require('../../src/security/production-security-readiness-gate.js');
const attestation = require('../../src/security/security-evidence-attestation.js');
const trustGate = require('../../src/security/security-evidence-trust-gate.js');

let checks = 0;
function check(fn) { fn(); checks += 1; }
function sha(value) { return crypto.createHash('sha256').update(String(value)).digest('hex'); }

const COMMIT = '1'.repeat(40);
const ASSESSED = '2026-09-08T10:00:00Z';

// Existing security architecture must coexist with Wave 17 additions.
[
  [baseSecurity, 'buildSecurityReadinessAssessment'],
  [productionSecurity, 'buildProductionSecurityReadinessGate'],
  [attestation, 'evaluateSecurityEvidenceAttestation'],
  [trustGate, 'buildSecurityEvidenceTrustGate'],
  [security, 'createSecurityQualificationEvidence'],
  [security, 'buildSecurityQualificationEnvelope'],
  [perf, 'createPerformanceSlo'],
  [perf, 'createPerformanceRunEvidence'],
  [perf, 'createResilienceEvidence'],
  [perf, 'buildPerformanceResilienceQualification'],
  [release, 'createCanonicalReleaseEvidence'],
  [release, 'createIndependentReviewRecord'],
  [release, 'buildIndependentReleaseQualification'],
].forEach(([surface, name]) => check(() => assert.strictEqual(typeof surface[name], 'function', `${name} missing`)));

function secEvidence(control) {
  return security.createSecurityQualificationEvidence({
    evidenceId: `SEC-${control}`,
    controlClass: control,
    environment: security.SECURITY_EVIDENCE_ENVIRONMENT.CI_TEST,
    targetRef: 'W17-CANDIDATE',
    exactCommitSha: COMMIT,
    sourceKind: security.SECURITY_EVIDENCE_SOURCE_KIND.CI_RUN,
    sourceArtifactId: `SEC-ART-${control}`,
    sourceArtifactHashSha256: sha(`sec-art-${control}`),
    evidenceRef: `SEC-REF-${control}`,
    evidenceContentHashSha256: sha(`sec-content-${control}`),
    outcome: security.SECURITY_EVIDENCE_OUTCOME.PASS,
    issuerRef: 'W17-ENGINEERING-EVIDENCE',
    verificationMethod: 'Wave 17 closeout deterministic regression evidence.',
    observedAt: '2026-09-08T06:00:00Z',
    verifiedAt: '2026-09-08T07:00:00Z',
    reviewedAt: '2026-09-08T08:00:00Z',
    preparedBy: 'SECURITY-ENGINEER',
    reviewedBy: 'SECURITY-REVIEWER',
    evidenceRefs: [`SEC-TRACE-${control}`],
  });
}

const controls = Object.values(security.SECURITY_CONTROL_CLASS);
const securityRecords = controls.map(secEvidence);
const securityAgePolicy = Object.fromEntries(controls.map((control) => [control, 7]));
const securityQ = security.buildSecurityQualificationEnvelope({
  qualificationId: 'W17D-SEC-Q',
  expectedEnvironment: security.SECURITY_EVIDENCE_ENVIRONMENT.CI_TEST,
  exactCommitSha: COMMIT,
  upstreamSecurityAssessmentRef: 'UPSTREAM-SECURITY-GATE',
  upstreamSecurityAssessmentHashSha256: sha('upstream-security-gate'),
  upstreamSecurityAssessmentStatus: security.READY_UPSTREAM_STATUS,
  assessedAt: ASSESSED,
  requiredControlClasses: controls,
  maximumEvidenceAgeDaysByControl: securityAgePolicy,
  evidenceRecords: securityRecords,
});
check(() => assert.strictEqual(securityQ.status, security.SECURITY_QUALIFICATION_STATUS.READY_FOR_INDEPENDENT_SECURITY_VALIDATION));
check(() => assert.strictEqual(security.verifySecurityQualificationEnvelope(securityQ).valid, true));
check(() => assert.strictEqual(securityQ.productionSecurityValidated, false));
check(() => assert.strictEqual(securityQ.deploymentAuthorized, false));

function makeSlo(workload) {
  return perf.createPerformanceSlo({
    sloId: `SLO-${workload}`,
    workloadClass: workload,
    maxP95LatencyMs: 500,
    maxP99LatencyMs: 900,
    minThroughputPerSecond: 10,
    maxErrorRatePct: 1,
    minimumSampleCount: 100,
    policySourceRef: `PERF-POLICY-${workload}`,
    rationale: 'Explicit closeout regression threshold; not a production SLA.',
    effectiveAt: '2026-09-01T00:00:00Z',
    owner: 'PERF-OWNER',
    reviewedBy: 'PERF-POLICY-REVIEWER',
    reviewedAt: '2026-09-02T00:00:00Z',
  });
}
function makeRun(workload) {
  return perf.createPerformanceRunEvidence({
    runId: `RUN-${workload}`,
    workloadClass: workload,
    environment: perf.QUALIFICATION_ENVIRONMENT.CI_TEST,
    exactCommitSha: COMMIT,
    targetRef: 'W17-CANDIDATE',
    concurrentUsers: 25,
    durationSeconds: 300,
    sampleCount: 500,
    p50LatencyMs: 100,
    p95LatencyMs: 300,
    p99LatencyMs: 600,
    throughputPerSecond: 20,
    errorRatePct: 0.2,
    sourceArtifactId: `PERF-ART-${workload}`,
    sourceArtifactHashSha256: sha(`perf-art-${workload}`),
    startedAt: '2026-09-08T06:00:00Z',
    finishedAt: '2026-09-08T06:10:00Z',
    preparedBy: 'PERF-ENGINEER',
    reviewedBy: 'PERF-REVIEWER',
    reviewedAt: '2026-09-08T08:00:00Z',
    evidenceRefs: [`PERF-TRACE-${workload}`],
  });
}
function makeResilience(scenario) {
  return perf.createResilienceEvidence({
    resilienceEvidenceId: `RES-${scenario}`,
    scenario,
    environment: perf.QUALIFICATION_ENVIRONMENT.CI_TEST,
    exactCommitSha: COMMIT,
    targetRef: 'W17-CANDIDATE',
    maximumRecoveryTimeSeconds: 300,
    observedRecoveryTimeSeconds: 120,
    maximumDataLossSeconds: 0,
    observedDataLossSeconds: 0,
    duplicateSideEffectsObserved: false,
    unreconciledDataCorruptionObserved: false,
    objectiveSourceRef: `RES-OBJECTIVE-${scenario}`,
    sourceArtifactId: `RES-ART-${scenario}`,
    sourceArtifactHashSha256: sha(`res-art-${scenario}`),
    observedAt: '2026-09-08T07:00:00Z',
    preparedBy: 'RELIABILITY-ENGINEER',
    reviewedBy: 'RELIABILITY-REVIEWER',
    reviewedAt: '2026-09-08T08:00:00Z',
    evidenceRefs: [`RES-TRACE-${scenario}`],
  });
}

const workloads = Object.values(perf.WORKLOAD_CLASS);
const slos = workloads.map(makeSlo);
const runs = workloads.map(makeRun);
const evaluations = slos.map((slo, i) => perf.evaluatePerformanceRun({ slo, runEvidence: runs[i] }));
const scenarios = Object.values(perf.RESILIENCE_SCENARIO);
const resilienceRecords = scenarios.map(makeResilience);
const perfQ = perf.buildPerformanceResilienceQualification({
  qualificationId: 'W17D-PERF-Q',
  expectedEnvironment: perf.QUALIFICATION_ENVIRONMENT.CI_TEST,
  exactCommitSha: COMMIT,
  assessedAt: ASSESSED,
  maximumEvidenceAgeDays: 7,
  requiredWorkloadClasses: workloads,
  requiredResilienceScenarios: scenarios,
  performanceEvaluations: evaluations,
  runEvidenceRecords: runs,
  resilienceEvidenceRecords: resilienceRecords,
});
check(() => assert.strictEqual(perfQ.status, perf.PERFORMANCE_QUALIFICATION_STATUS.READY_FOR_INDEPENDENT_PERFORMANCE_VALIDATION));
check(() => assert.strictEqual(perf.verifyPerformanceResilienceQualification(perfQ).valid, true));
check(() => assert.strictEqual(perfQ.productionPerformanceValidated, false));
check(() => assert.strictEqual(perfQ.productionResilienceValidated, false));
check(() => assert.strictEqual(perfQ.deploymentAuthorized, false));

const releaseEvidence = release.createCanonicalReleaseEvidence({
  releaseEvidenceId: 'W17D-REL-E',
  exactCommitSha: COMMIT,
  workflowRunRef: 'W17D-CANONICAL-RELEASE-VERIFY',
  workflowArtifactHashSha256: sha('w17d-release-artifact'),
  regressionTotal: 291,
  regressionPassed: 291,
  testDiscoveryAndRegressionPass: true,
  productionBuildPass: true,
  packageVerificationPass: true,
  auditThresholdPass: true,
  canonicalSourceHashVerificationPass: true,
  releaseVerifyPass: true,
  testedAt: '2026-09-08T08:00:00Z',
  preparedBy: 'RELEASE-ENGINEER',
  reviewedBy: 'RELEASE-REVIEWER',
  reviewedAt: '2026-09-08T09:00:00Z',
  evidenceRefs: ['W17D-RELEASE-TRACE'],
});
const independentReview = release.createIndependentReviewRecord({
  reviewId: 'W17D-INDEPENDENT-REVIEW',
  exactCommitSha: COMMIT,
  reviewerRef: 'INDEPENDENT-REVIEWER',
  reviewerOrganizationRef: 'INDEPENDENT-REVIEW-ORG',
  independenceType: release.INDEPENDENCE_TYPE.INTERNAL_INDEPENDENT,
  independenceAttestedByReviewer: true,
  conflictDeclared: false,
  reviewedScope: ['SECURITY', 'PERFORMANCE_RESILIENCE', 'RELEASE_REGRESSION'],
  reviewReportRef: 'W17D-INDEPENDENT-REPORT',
  reviewReportHashSha256: sha('w17d-independent-report'),
  decision: release.REVIEW_DECISION.PASS,
  materialOpenFindings: 0,
  findingRefs: [],
  reviewedAt: '2026-09-08T09:30:00Z',
});

const releaseQ = release.buildIndependentReleaseQualification({
  qualificationId: 'W17D-RELEASE-Q',
  exactCommitSha: COMMIT,
  securityQualificationRef: securityQ.qualificationId,
  securityQualificationHashSha256: securityQ.qualificationHashSha256,
  securityQualificationStatus: securityQ.status,
  performanceQualificationRef: perfQ.qualificationId,
  performanceQualificationHashSha256: perfQ.qualificationHashSha256,
  performanceQualificationStatus: perfQ.status,
  releaseEvidence,
  independentReview,
});

check(() => assert.strictEqual(releaseQ.status, release.RELEASE_QUALIFICATION_STATUS.READY_FOR_RELEASE_AUTHORITY_REVIEW));
check(() => assert.strictEqual(release.verifyIndependentReleaseQualification(releaseQ).valid, true));
check(() => assert.strictEqual(releaseQ.securityQualificationHashSha256, securityQ.qualificationHashSha256));
check(() => assert.strictEqual(releaseQ.performanceQualificationHashSha256, perfQ.qualificationHashSha256));
check(() => assert.strictEqual(releaseQ.independentEngineeringReviewRecorded, true));
check(() => assert.strictEqual(releaseQ.reviewerCredentialsVerifiedByThisModule, false));
check(() => assert.strictEqual(releaseQ.reviewerIndependenceVerifiedByThisModule, false));
check(() => assert.strictEqual(releaseQ.productionSecurityValidated, false));
check(() => assert.strictEqual(releaseQ.productionPerformanceValidated, false));
check(() => assert.strictEqual(releaseQ.pdplComplianceEstablished, false));
check(() => assert.strictEqual(releaseQ.certifiedValuationAuthorityEstablished, false));
check(() => assert.strictEqual(releaseQ.releaseAuthorized, false));
check(() => assert.strictEqual(releaseQ.mergeAuthorized, false));
check(() => assert.strictEqual(releaseQ.deploymentAuthorized, false));
check(() => assert.strictEqual(releaseQ.humanReleaseAuthorityApprovalRequired, true));
check(() => assert.strictEqual(releaseQ.transactionAuthorized, false));

// Tampering across layer hashes must invalidate the qualification record.
const tampered = { ...releaseQ, securityQualificationHashSha256: sha('tampered') };
check(() => assert.strictEqual(release.verifyIndependentReleaseQualification(tampered).valid, false));

// Closeout remains engineering-only and must not erase current compliance boundaries.
[
  securityQ.productionSecurityValidated,
  perfQ.productionPerformanceValidated,
  perfQ.productionResilienceValidated,
  releaseQ.productionSecurityValidated,
  releaseQ.productionPerformanceValidated,
  releaseQ.pdplComplianceEstablished,
  releaseQ.certifiedValuationAuthorityEstablished,
  releaseQ.releaseAuthorized,
  releaseQ.mergeAuthorized,
  releaseQ.deploymentAuthorized,
  releaseQ.transactionAuthorized,
].forEach((value) => check(() => assert.strictEqual(value, false)));

console.log(`WAVE_17D_ENGINEERING_CLOSEOUT=PASS checks=${checks}`);
