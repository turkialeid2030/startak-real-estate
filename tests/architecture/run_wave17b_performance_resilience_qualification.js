'use strict';

const assert = require('assert');
const crypto = require('crypto');
const q = require('../../src/qualification/performance-resilience-qualification.js');

let checks = 0;
function check(fn) { fn(); checks += 1; }
function sha(value) { return crypto.createHash('sha256').update(String(value)).digest('hex'); }
function expectThrow(fn, pattern) { check(() => assert.throws(fn, pattern)); }

const COMMIT = 'c'.repeat(40);
const OTHER_COMMIT = 'd'.repeat(40);
const WORKLOADS = Object.values(q.WORKLOAD_CLASS);
const SCENARIOS = Object.values(q.RESILIENCE_SCENARIO);

function slo(workload, overrides = {}) {
  return q.createPerformanceSlo({
    sloId: overrides.sloId || `SLO-${workload}`,
    workloadClass: workload,
    maxP95LatencyMs: overrides.maxP95LatencyMs ?? 500,
    maxP99LatencyMs: overrides.maxP99LatencyMs ?? 900,
    minThroughputPerSecond: overrides.minThroughputPerSecond ?? 10,
    maxErrorRatePct: overrides.maxErrorRatePct ?? 1,
    minimumSampleCount: overrides.minimumSampleCount ?? 100,
    policySourceRef: overrides.policySourceRef || `PERF-POLICY-${workload}`,
    rationale: overrides.rationale || 'Caller-supplied Wave 17B engineering SLO for regression only.',
    effectiveAt: overrides.effectiveAt || '2026-09-01T00:00:00Z',
    owner: overrides.owner || 'PERF-OWNER',
    reviewedBy: overrides.reviewedBy || 'PERF-POLICY-REVIEWER',
    reviewedAt: overrides.reviewedAt || '2026-09-02T00:00:00Z',
  });
}

function run(workload, overrides = {}) {
  return q.createPerformanceRunEvidence({
    runId: overrides.runId || `RUN-${workload}`,
    workloadClass: workload,
    environment: overrides.environment || q.QUALIFICATION_ENVIRONMENT.CI_TEST,
    exactCommitSha: overrides.exactCommitSha || COMMIT,
    targetRef: overrides.targetRef || 'W17B-CANDIDATE',
    concurrentUsers: overrides.concurrentUsers ?? 25,
    durationSeconds: overrides.durationSeconds ?? 300,
    sampleCount: overrides.sampleCount ?? 500,
    p50LatencyMs: overrides.p50LatencyMs ?? 120,
    p95LatencyMs: overrides.p95LatencyMs ?? 300,
    p99LatencyMs: overrides.p99LatencyMs ?? 600,
    throughputPerSecond: overrides.throughputPerSecond ?? 20,
    errorRatePct: overrides.errorRatePct ?? 0.2,
    sourceArtifactId: overrides.sourceArtifactId || `PERF-ART-${workload}`,
    sourceArtifactHashSha256: overrides.sourceArtifactHashSha256 || sha(`perf-art-${workload}`),
    startedAt: overrides.startedAt || '2026-09-08T04:00:00Z',
    finishedAt: overrides.finishedAt || '2026-09-08T04:10:00Z',
    preparedBy: overrides.preparedBy || 'PERF-ENGINEER',
    reviewedBy: overrides.reviewedBy || 'PERF-REVIEWER',
    reviewedAt: overrides.reviewedAt || '2026-09-08T05:00:00Z',
    evidenceRefs: overrides.evidenceRefs || [`PERF-TRACE-${workload}`],
  });
}

function resilience(scenario, overrides = {}) {
  return q.createResilienceEvidence({
    resilienceEvidenceId: overrides.resilienceEvidenceId || `RES-${scenario}`,
    scenario,
    environment: overrides.environment || q.QUALIFICATION_ENVIRONMENT.CI_TEST,
    exactCommitSha: overrides.exactCommitSha || COMMIT,
    targetRef: overrides.targetRef || 'W17B-CANDIDATE',
    maximumRecoveryTimeSeconds: overrides.maximumRecoveryTimeSeconds ?? 300,
    observedRecoveryTimeSeconds: overrides.observedRecoveryTimeSeconds ?? 120,
    maximumDataLossSeconds: overrides.maximumDataLossSeconds ?? 0,
    observedDataLossSeconds: overrides.observedDataLossSeconds ?? 0,
    duplicateSideEffectsObserved: overrides.duplicateSideEffectsObserved ?? false,
    unreconciledDataCorruptionObserved: overrides.unreconciledDataCorruptionObserved ?? false,
    objectiveSourceRef: overrides.objectiveSourceRef || `RES-OBJECTIVE-${scenario}`,
    sourceArtifactId: overrides.sourceArtifactId || `RES-ART-${scenario}`,
    sourceArtifactHashSha256: overrides.sourceArtifactHashSha256 || sha(`res-art-${scenario}`),
    observedAt: overrides.observedAt || '2026-09-08T04:30:00Z',
    preparedBy: overrides.preparedBy || 'RELIABILITY-ENGINEER',
    reviewedBy: overrides.reviewedBy || 'RELIABILITY-REVIEWER',
    reviewedAt: overrides.reviewedAt || '2026-09-08T05:30:00Z',
    evidenceRefs: overrides.evidenceRefs || [`RES-TRACE-${scenario}`],
  });
}

function qualification(evaluations, runs, resiliences, overrides = {}) {
  return q.buildPerformanceResilienceQualification({
    qualificationId: overrides.qualificationId || 'W17B-Q-1',
    expectedEnvironment: overrides.expectedEnvironment || q.QUALIFICATION_ENVIRONMENT.CI_TEST,
    exactCommitSha: overrides.exactCommitSha || COMMIT,
    assessedAt: overrides.assessedAt || '2026-09-08T08:00:00Z',
    maximumEvidenceAgeDays: overrides.maximumEvidenceAgeDays ?? 7,
    requiredWorkloadClasses: overrides.requiredWorkloadClasses || WORKLOADS,
    requiredResilienceScenarios: overrides.requiredResilienceScenarios || SCENARIOS,
    performanceEvaluations: evaluations,
    runEvidenceRecords: runs,
    resilienceEvidenceRecords: resiliences,
  });
}

[
  'createPerformanceSlo', 'verifyPerformanceSlo', 'createPerformanceRunEvidence',
  'verifyPerformanceRunEvidence', 'evaluatePerformanceRun', 'createResilienceEvidence',
  'verifyResilienceEvidence', 'buildPerformanceResilienceQualification',
  'verifyPerformanceResilienceQualification',
].forEach((name) => check(() => assert.strictEqual(typeof q[name], 'function', `${name} missing`)));
check(() => assert.strictEqual(WORKLOADS.length, 7));
check(() => assert.strictEqual(SCENARIOS.length, 7));
check(() => assert.deepStrictEqual(Object.values(q.QUALIFICATION_ENVIRONMENT), ['CI_TEST', 'STAGING', 'PRODUCTION']));

const slos = WORKLOADS.map((workload) => slo(workload));
const runs = WORKLOADS.map((workload) => run(workload));
const evaluations = slos.map((item, index) => q.evaluatePerformanceRun({ slo: item, runEvidence: runs[index] }));
const resiliences = SCENARIOS.map((scenario) => resilience(scenario));

slos.forEach((item) => check(() => assert.strictEqual(q.verifyPerformanceSlo(item).valid, true)));
runs.forEach((item) => check(() => assert.strictEqual(q.verifyPerformanceRunEvidence(item).valid, true)));
resiliences.forEach((item) => check(() => assert.strictEqual(q.verifyResilienceEvidence(item).valid, true)));
check(() => assert.strictEqual(evaluations.every((item) => item.status === q.PERFORMANCE_STATUS.PASS), true));
check(() => assert.strictEqual(resiliences.every((item) => item.status === q.PERFORMANCE_STATUS.PASS), true));
check(() => assert.strictEqual(slos.every((item) => item.thresholdsInventedByThisModule === false), true));
check(() => assert.strictEqual(resiliences.every((item) => item.objectivesInventedByThisModule === false), true));

const ready = qualification(evaluations, runs, resiliences);
check(() => assert.strictEqual(ready.status, q.PERFORMANCE_QUALIFICATION_STATUS.READY_FOR_INDEPENDENT_PERFORMANCE_VALIDATION));
check(() => assert.strictEqual(q.verifyPerformanceResilienceQualification(ready).valid, true));
check(() => assert.strictEqual(ready.callerSuppliedSlosRequired, true));
check(() => assert.strictEqual(ready.callerSuppliedRecoveryObjectivesRequired, true));
check(() => assert.strictEqual(ready.thresholdsInventedByThisModule, false));
check(() => assert.strictEqual(ready.productionPerformanceValidated, false));
check(() => assert.strictEqual(ready.productionResilienceValidated, false));
check(() => assert.strictEqual(ready.capacityPlanEstablished, false));
check(() => assert.strictEqual(ready.slaEstablished, false));
check(() => assert.strictEqual(ready.independentPerformanceValidationRequired, true));
check(() => assert.strictEqual(ready.humanReleaseApprovalRequired, true));
check(() => assert.strictEqual(ready.mergeAuthorized, false));
check(() => assert.strictEqual(ready.deploymentAuthorized, false));
check(() => assert.strictEqual(ready.transactionAuthorized, false));

// SLO evaluation fails closed against caller-supplied thresholds.
const slowRun = run(WORKLOADS[0], { p95LatencyMs: 700, p99LatencyMs: 800 });
const slowEval = q.evaluatePerformanceRun({ slo: slos[0], runEvidence: slowRun });
check(() => assert.strictEqual(slowEval.status, q.PERFORMANCE_STATUS.FAIL));
check(() => assert.strictEqual(slowEval.failureCodes.includes('P95_LATENCY_EXCEEDED'), true));
const errorRun = run(WORKLOADS[0], { errorRatePct: 2 });
const errorEval = q.evaluatePerformanceRun({ slo: slos[0], runEvidence: errorRun });
check(() => assert.strictEqual(errorEval.failureCodes.includes('ERROR_RATE_EXCEEDED'), true));
const lowThroughput = q.evaluatePerformanceRun({ slo: slos[0], runEvidence: run(WORKLOADS[0], { throughputPerSecond: 5 }) });
check(() => assert.strictEqual(lowThroughput.failureCodes.includes('MINIMUM_THROUGHPUT_NOT_MET'), true));
const lowSamples = q.evaluatePerformanceRun({ slo: slos[0], runEvidence: run(WORKLOADS[0], { sampleCount: 10 }) });
check(() => assert.strictEqual(lowSamples.failureCodes.includes('MINIMUM_SAMPLE_COUNT_NOT_MET'), true));

const failedEvals = [...evaluations];
failedEvals[0] = slowEval;
const failedRuns = [...runs];
failedRuns[0] = slowRun;
const perfHold = qualification(failedEvals, failedRuns, resiliences);
check(() => assert.strictEqual(perfHold.status, q.PERFORMANCE_QUALIFICATION_STATUS.HOLD_PERFORMANCE_SLO));

// Required workload/scenario coverage is explicit.
const missingWorkload = qualification(evaluations.slice(1), runs.slice(1), resiliences);
check(() => assert.strictEqual(missingWorkload.status, q.PERFORMANCE_QUALIFICATION_STATUS.HOLD_REQUIRED_WORKLOADS));
const missingScenario = qualification(evaluations, runs, resiliences.slice(1));
check(() => assert.strictEqual(missingScenario.status, q.PERFORMANCE_QUALIFICATION_STATUS.HOLD_REQUIRED_RESILIENCE_SCENARIOS));

// Resilience objectives are caller-supplied; breaches remain holds.
const lateRecovery = resilience(SCENARIOS[0], { observedRecoveryTimeSeconds: 600 });
check(() => assert.strictEqual(lateRecovery.status, q.PERFORMANCE_STATUS.FAIL));
check(() => assert.strictEqual(lateRecovery.failureCodes.includes('RECOVERY_TIME_OBJECTIVE_EXCEEDED'), true));
const dataLoss = resilience(SCENARIOS[0], { maximumDataLossSeconds: 0, observedDataLossSeconds: 30 });
check(() => assert.strictEqual(dataLoss.failureCodes.includes('DATA_LOSS_OBJECTIVE_EXCEEDED'), true));
const duplicates = resilience(SCENARIOS[0], { duplicateSideEffectsObserved: true });
check(() => assert.strictEqual(duplicates.failureCodes.includes('DUPLICATE_SIDE_EFFECTS_OBSERVED'), true));
const corruption = resilience(SCENARIOS[0], { unreconciledDataCorruptionObserved: true });
check(() => assert.strictEqual(corruption.failureCodes.includes('UNRECONCILED_DATA_CORRUPTION_OBSERVED'), true));
const failedRes = [...resiliences]; failedRes[0] = lateRecovery;
const resHold = qualification(evaluations, runs, failedRes);
check(() => assert.strictEqual(resHold.status, q.PERFORMANCE_QUALIFICATION_STATUS.HOLD_RESILIENCE_OBJECTIVE));

// Exact commit/environment/freshness/reviewer binding.
const wrongEnvRuns = runs.map((item, i) => i === 0 ? run(item.workloadClass, { environment: q.QUALIFICATION_ENVIRONMENT.STAGING }) : item);
const wrongEnvEvals = evaluations.map((item, i) => i === 0 ? q.evaluatePerformanceRun({ slo: slos[0], runEvidence: wrongEnvRuns[0] }) : item);
check(() => assert.strictEqual(qualification(wrongEnvEvals, wrongEnvRuns, resiliences).status, q.PERFORMANCE_QUALIFICATION_STATUS.HOLD_SCOPE_MISMATCH));
const wrongCommitRuns = runs.map((item, i) => i === 0 ? run(item.workloadClass, { exactCommitSha: OTHER_COMMIT }) : item);
const wrongCommitEvals = evaluations.map((item, i) => i === 0 ? q.evaluatePerformanceRun({ slo: slos[0], runEvidence: wrongCommitRuns[0] }) : item);
check(() => assert.strictEqual(qualification(wrongCommitEvals, wrongCommitRuns, resiliences).status, q.PERFORMANCE_QUALIFICATION_STATUS.HOLD_SCOPE_MISMATCH));
const staleRuns = runs.map((item, i) => i === 0 ? run(item.workloadClass, { startedAt: '2026-08-01T04:00:00Z', finishedAt: '2026-08-01T04:10:00Z', reviewedAt: '2026-08-01T05:00:00Z' }) : item);
const staleEvals = evaluations.map((item, i) => i === 0 ? q.evaluatePerformanceRun({ slo: slos[0], runEvidence: staleRuns[0] }) : item);
check(() => assert.strictEqual(qualification(staleEvals, staleRuns, resiliences, { maximumEvidenceAgeDays: 1 }).status, q.PERFORMANCE_QUALIFICATION_STATUS.HOLD_STALE_EVIDENCE));
const selfReviewedRuns = runs.map((item, i) => i === 0 ? run(item.workloadClass, { preparedBy: 'SAME', reviewedBy: 'SAME' }) : item);
const selfReviewedEvals = evaluations.map((item, i) => i === 0 ? q.evaluatePerformanceRun({ slo: slos[0], runEvidence: selfReviewedRuns[0] }) : item);
check(() => assert.strictEqual(qualification(selfReviewedEvals, selfReviewedRuns, resiliences).status, q.PERFORMANCE_QUALIFICATION_STATUS.HOLD_REVIEW_EVIDENCE));

// Production-labelled evidence still reaches only independent validation readiness.
const prodRuns = WORKLOADS.map((workload) => run(workload, { environment: q.QUALIFICATION_ENVIRONMENT.PRODUCTION }));
const prodEvals = slos.map((item, index) => q.evaluatePerformanceRun({ slo: item, runEvidence: prodRuns[index] }));
const prodRes = SCENARIOS.map((scenario) => resilience(scenario, { environment: q.QUALIFICATION_ENVIRONMENT.PRODUCTION }));
const prodQ = qualification(prodEvals, prodRuns, prodRes, { expectedEnvironment: q.QUALIFICATION_ENVIRONMENT.PRODUCTION, qualificationId: 'W17B-PROD-Q' });
check(() => assert.strictEqual(prodQ.status, q.PERFORMANCE_QUALIFICATION_STATUS.READY_FOR_INDEPENDENT_PERFORMANCE_VALIDATION));
check(() => assert.strictEqual(prodQ.productionPerformanceValidated, false));
check(() => assert.strictEqual(prodQ.productionResilienceValidated, false));
check(() => assert.strictEqual(prodQ.deploymentAuthorized, false));

// Content-addressing and input invariants.
const tamperedRun = { ...runs[0], p95LatencyMs: 1 };
check(() => assert.strictEqual(q.verifyPerformanceRunEvidence(tamperedRun).valid, false));
const tamperedSlo = { ...slos[0], maxP95LatencyMs: 9999 };
check(() => assert.strictEqual(q.verifyPerformanceSlo(tamperedSlo).valid, false));
const tamperedRes = { ...resiliences[0], observedRecoveryTimeSeconds: 9999 };
check(() => assert.strictEqual(q.verifyResilienceEvidence(tamperedRes).valid, false));
const tamperedQ = { ...ready, assessedAt: '2026-09-08T09:00:00Z' };
check(() => assert.strictEqual(q.verifyPerformanceResilienceQualification(tamperedQ).valid, false));
expectThrow(() => run(WORKLOADS[0], { p50LatencyMs: 700, p95LatencyMs: 300, p99LatencyMs: 600 }), /p50 <= p95 <= p99/);
expectThrow(() => run(WORKLOADS[0], { exactCommitSha: 'bad' }), /git commit SHA/);
expectThrow(() => slo(WORKLOADS[0], { maxErrorRatePct: 101 }), /between 0 and 100/);
expectThrow(() => qualification(evaluations, runs, resiliences, { requiredWorkloadClasses: [WORKLOADS[0], WORKLOADS[0]] }), /must not contain duplicates/);
expectThrow(() => qualification(evaluations, runs, resiliences, { requiredResilienceScenarios: [SCENARIOS[0], SCENARIOS[0]] }), /must not contain duplicates/);

console.log(`WAVE_17B_PERFORMANCE_RESILIENCE_QUALIFICATION=PASS checks=${checks}`);
