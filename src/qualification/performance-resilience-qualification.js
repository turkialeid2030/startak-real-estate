'use strict';

const crypto = require('crypto');
const {strictCalendarDateMs} = require('../validation/strict-calendar-instant');

const QUALIFICATION_ENVIRONMENT = Object.freeze({
  CI_TEST: 'CI_TEST',
  STAGING: 'STAGING',
  PRODUCTION: 'PRODUCTION',
});

const WORKLOAD_CLASS = Object.freeze({
  INTERACTIVE_READ: 'INTERACTIVE_READ',
  INTERACTIVE_WRITE: 'INTERACTIVE_WRITE',
  VALUATION_COMPUTE: 'VALUATION_COMPUTE',
  REPORT_GENERATION: 'REPORT_GENERATION',
  MONTE_CARLO: 'MONTE_CARLO',
  BULK_IMPORT: 'BULK_IMPORT',
  PUBLIC_API: 'PUBLIC_API',
});

const RESILIENCE_SCENARIO = Object.freeze({
  DEPENDENCY_TIMEOUT: 'DEPENDENCY_TIMEOUT',
  DATABASE_UNAVAILABLE: 'DATABASE_UNAVAILABLE',
  PROCESS_RESTART: 'PROCESS_RESTART',
  RATE_LIMITING: 'RATE_LIMITING',
  PARTIAL_SERVICE_OUTAGE: 'PARTIAL_SERVICE_OUTAGE',
  BACKUP_RESTORE: 'BACKUP_RESTORE',
  DEGRADED_MODE: 'DEGRADED_MODE',
});

const PERFORMANCE_STATUS = Object.freeze({
  PASS: 'PASS',
  FAIL: 'FAIL',
});

const PERFORMANCE_QUALIFICATION_STATUS = Object.freeze({
  READY_FOR_INDEPENDENT_PERFORMANCE_VALIDATION: 'READY_FOR_INDEPENDENT_PERFORMANCE_VALIDATION',
  HOLD_REQUIRED_WORKLOADS: 'HOLD_REQUIRED_WORKLOADS',
  HOLD_REQUIRED_RESILIENCE_SCENARIOS: 'HOLD_REQUIRED_RESILIENCE_SCENARIOS',
  HOLD_EVIDENCE_INTEGRITY: 'HOLD_EVIDENCE_INTEGRITY',
  HOLD_SCOPE_MISMATCH: 'HOLD_SCOPE_MISMATCH',
  HOLD_STALE_EVIDENCE: 'HOLD_STALE_EVIDENCE',
  HOLD_PERFORMANCE_SLO: 'HOLD_PERFORMANCE_SLO',
  HOLD_RESILIENCE_OBJECTIVE: 'HOLD_RESILIENCE_OBJECTIVE',
  HOLD_REVIEW_EVIDENCE: 'HOLD_REVIEW_EVIDENCE',
});

const SHA256_RE = /^[a-f0-9]{64}$/i;
const COMMIT_SHA_RE = /^[a-f0-9]{40}$/i;

function requiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}

function requiredEnum(value, allowed, field) {
  const normalized = requiredString(value, field);
  if (!Object.values(allowed).includes(normalized)) throw new TypeError(`${field} has unsupported value: ${normalized}`);
  return normalized;
}

function requiredSha256(value, field) {
  const normalized = requiredString(value, field);
  if (!SHA256_RE.test(normalized)) throw new TypeError(`${field} must be a 64-character SHA-256 hex digest`);
  return normalized.toLowerCase();
}

function requiredCommitSha(value, field) {
  const normalized = requiredString(value, field);
  if (!COMMIT_SHA_RE.test(normalized)) throw new TypeError(`${field} must be a 40-character git commit SHA`);
  return normalized.toLowerCase();
}

function requiredTimestamp(value, field) {
  const normalized = requiredString(value, field);
  const millis = strictCalendarDateMs(normalized);
  if (!Number.isFinite(millis)) throw new TypeError(`${field} must be a valid calendar date or explicit-zone ISO timestamp`);
  return Object.freeze({ value: normalized, millis });
}

function nonNegativeNumber(value, field) {
  if (!Number.isFinite(value) || value < 0) throw new TypeError(`${field} must be a finite non-negative number`);
  return value;
}

function positiveNumber(value, field) {
  if (!Number.isFinite(value) || value <= 0) throw new TypeError(`${field} must be a finite positive number`);
  return value;
}

function percentage(value, field) {
  const normalized = nonNegativeNumber(value, field);
  if (normalized > 100) throw new TypeError(`${field} must be between 0 and 100`);
  return normalized;
}

function stringArray(value, field) {
  if (!Array.isArray(value) || value.length === 0) throw new TypeError(`${field} must be a non-empty array`);
  return Object.freeze(value.map((item, index) => requiredString(item, `${field}[${index}]`)));
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((result, key) => {
      if (value[key] !== undefined) result[key] = canonicalize(value[key]);
      return result;
    }, {});
  }
  return value;
}

function sha256Object(value) {
  return crypto.createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
}

function createPerformanceSlo(input = {}) {
  const effective = requiredTimestamp(input.effectiveAt, 'effectiveAt');
  const reviewed = requiredTimestamp(input.reviewedAt, 'reviewedAt');
  if (reviewed.millis < effective.millis) throw new TypeError('reviewedAt must be on or after effectiveAt');

  const core = {
    sloId: requiredString(input.sloId, 'sloId'),
    workloadClass: requiredEnum(input.workloadClass, WORKLOAD_CLASS, 'workloadClass'),
    maxP95LatencyMs: positiveNumber(input.maxP95LatencyMs, 'maxP95LatencyMs'),
    maxP99LatencyMs: positiveNumber(input.maxP99LatencyMs, 'maxP99LatencyMs'),
    minThroughputPerSecond: nonNegativeNumber(input.minThroughputPerSecond, 'minThroughputPerSecond'),
    maxErrorRatePct: percentage(input.maxErrorRatePct, 'maxErrorRatePct'),
    minimumSampleCount: positiveNumber(input.minimumSampleCount, 'minimumSampleCount'),
    policySourceRef: requiredString(input.policySourceRef, 'policySourceRef'),
    rationale: requiredString(input.rationale, 'rationale'),
    effectiveAt: effective.value,
    owner: requiredString(input.owner, 'owner'),
    reviewedBy: requiredString(input.reviewedBy, 'reviewedBy'),
    reviewedAt: reviewed.value,
  };

  if(core.maxP95LatencyMs>core.maxP99LatencyMs||!Number.isSafeInteger(core.minimumSampleCount))throw new TypeError('SLO_THRESHOLD_ORDER_OR_SAMPLE_COUNT_INVALID');
  return Object.freeze({ ...core, sloHashSha256: sha256Object(core), callerSuppliedThresholds: true, thresholdsInventedByThisModule: false });
}

function verifyPerformanceSlo(slo) {
  if (!slo || typeof slo !== 'object' || Array.isArray(slo)) return Object.freeze({ valid: false, reasonCode: 'SLO_OBJECT_REQUIRED' });
  try {
    const core = {
      sloId: requiredString(slo.sloId, 'sloId'),
      workloadClass: requiredEnum(slo.workloadClass, WORKLOAD_CLASS, 'workloadClass'),
      maxP95LatencyMs: positiveNumber(slo.maxP95LatencyMs, 'maxP95LatencyMs'),
      maxP99LatencyMs: positiveNumber(slo.maxP99LatencyMs, 'maxP99LatencyMs'),
      minThroughputPerSecond: nonNegativeNumber(slo.minThroughputPerSecond, 'minThroughputPerSecond'),
      maxErrorRatePct: percentage(slo.maxErrorRatePct, 'maxErrorRatePct'),
      minimumSampleCount: positiveNumber(slo.minimumSampleCount, 'minimumSampleCount'),
      policySourceRef: requiredString(slo.policySourceRef, 'policySourceRef'),
      rationale: requiredString(slo.rationale, 'rationale'),
      effectiveAt: requiredTimestamp(slo.effectiveAt, 'effectiveAt').value,
      owner: requiredString(slo.owner, 'owner'),
      reviewedBy: requiredString(slo.reviewedBy, 'reviewedBy'),
      reviewedAt: requiredTimestamp(slo.reviewedAt, 'reviewedAt').value,
    };
    if(core.maxP95LatencyMs>core.maxP99LatencyMs||!Number.isSafeInteger(core.minimumSampleCount)||strictCalendarDateMs(core.reviewedAt)<strictCalendarDateMs(core.effectiveAt))return Object.freeze({valid:false,reasonCode:'SLO_THRESHOLD_OR_CHRONOLOGY_INVALID'});
    const expectedHash = sha256Object(core);
    return Object.freeze({ valid: slo.sloHashSha256 === expectedHash, reasonCode: slo.sloHashSha256 === expectedHash ? null : 'SLO_HASH_MISMATCH', expectedHash });
  } catch (error) {
    return Object.freeze({ valid: false, reasonCode: 'SLO_SCHEMA_INVALID', error: error.message });
  }
}

function createPerformanceRunEvidence(input = {}) {
  const started = requiredTimestamp(input.startedAt, 'startedAt');
  const finished = requiredTimestamp(input.finishedAt, 'finishedAt');
  const reviewed = requiredTimestamp(input.reviewedAt, 'reviewedAt');
  if (finished.millis < started.millis) throw new TypeError('finishedAt must be on or after startedAt');
  if (reviewed.millis < finished.millis) throw new TypeError('reviewedAt must be on or after finishedAt');

  const sampleCount = positiveNumber(input.sampleCount, 'sampleCount');
  if(!Number.isSafeInteger(sampleCount)||!Number.isSafeInteger(input.concurrentUsers))throw new TypeError('RUN_COUNTS_MUST_BE_INTEGERS');
  const p50 = nonNegativeNumber(input.p50LatencyMs, 'p50LatencyMs');
  const p95 = nonNegativeNumber(input.p95LatencyMs, 'p95LatencyMs');
  const p99 = nonNegativeNumber(input.p99LatencyMs, 'p99LatencyMs');
  if (!(p50 <= p95 && p95 <= p99)) throw new TypeError('latency percentiles must satisfy p50 <= p95 <= p99');

  const core = {
    runId: requiredString(input.runId, 'runId'),
    workloadClass: requiredEnum(input.workloadClass, WORKLOAD_CLASS, 'workloadClass'),
    environment: requiredEnum(input.environment, QUALIFICATION_ENVIRONMENT, 'environment'),
    exactCommitSha: requiredCommitSha(input.exactCommitSha, 'exactCommitSha'),
    targetRef: requiredString(input.targetRef, 'targetRef'),
    concurrentUsers: nonNegativeNumber(input.concurrentUsers, 'concurrentUsers'),
    durationSeconds: positiveNumber(input.durationSeconds, 'durationSeconds'),
    sampleCount,
    p50LatencyMs: p50,
    p95LatencyMs: p95,
    p99LatencyMs: p99,
    throughputPerSecond: nonNegativeNumber(input.throughputPerSecond, 'throughputPerSecond'),
    errorRatePct: percentage(input.errorRatePct, 'errorRatePct'),
    sourceArtifactId: requiredString(input.sourceArtifactId, 'sourceArtifactId'),
    sourceArtifactHashSha256: requiredSha256(input.sourceArtifactHashSha256, 'sourceArtifactHashSha256'),
    startedAt: started.value,
    finishedAt: finished.value,
    preparedBy: requiredString(input.preparedBy, 'preparedBy'),
    reviewedBy: requiredString(input.reviewedBy, 'reviewedBy'),
    reviewedAt: reviewed.value,
    evidenceRefs: stringArray(input.evidenceRefs, 'evidenceRefs'),
  };

  return Object.freeze({ ...core, runEvidenceHashSha256: sha256Object(core), productionPerformanceValidated: false, deploymentAuthorized: false });
}

function verifyPerformanceRunEvidence(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return Object.freeze({ valid: false, reasonCode: 'RUN_OBJECT_REQUIRED' });
  try {
    const core = {
      runId: requiredString(record.runId, 'runId'),
      workloadClass: requiredEnum(record.workloadClass, WORKLOAD_CLASS, 'workloadClass'),
      environment: requiredEnum(record.environment, QUALIFICATION_ENVIRONMENT, 'environment'),
      exactCommitSha: requiredCommitSha(record.exactCommitSha, 'exactCommitSha'),
      targetRef: requiredString(record.targetRef, 'targetRef'),
      concurrentUsers: nonNegativeNumber(record.concurrentUsers, 'concurrentUsers'),
      durationSeconds: positiveNumber(record.durationSeconds, 'durationSeconds'),
      sampleCount: positiveNumber(record.sampleCount, 'sampleCount'),
      p50LatencyMs: nonNegativeNumber(record.p50LatencyMs, 'p50LatencyMs'),
      p95LatencyMs: nonNegativeNumber(record.p95LatencyMs, 'p95LatencyMs'),
      p99LatencyMs: nonNegativeNumber(record.p99LatencyMs, 'p99LatencyMs'),
      throughputPerSecond: nonNegativeNumber(record.throughputPerSecond, 'throughputPerSecond'),
      errorRatePct: percentage(record.errorRatePct, 'errorRatePct'),
      sourceArtifactId: requiredString(record.sourceArtifactId, 'sourceArtifactId'),
      sourceArtifactHashSha256: requiredSha256(record.sourceArtifactHashSha256, 'sourceArtifactHashSha256'),
      startedAt: requiredTimestamp(record.startedAt, 'startedAt').value,
      finishedAt: requiredTimestamp(record.finishedAt, 'finishedAt').value,
      preparedBy: requiredString(record.preparedBy, 'preparedBy'),
      reviewedBy: requiredString(record.reviewedBy, 'reviewedBy'),
      reviewedAt: requiredTimestamp(record.reviewedAt, 'reviewedAt').value,
      evidenceRefs: [...stringArray(record.evidenceRefs, 'evidenceRefs')],
    };
    if(!Number.isSafeInteger(core.sampleCount)||!Number.isSafeInteger(core.concurrentUsers))return Object.freeze({valid:false,reasonCode:'RUN_COUNTS_MUST_BE_INTEGERS'});
    if (!(core.p50LatencyMs <= core.p95LatencyMs && core.p95LatencyMs <= core.p99LatencyMs)) return Object.freeze({ valid: false, reasonCode: 'LATENCY_PERCENTILE_ORDER_INVALID' });
    if (strictCalendarDateMs(core.finishedAt) < strictCalendarDateMs(core.startedAt) || strictCalendarDateMs(core.reviewedAt) < strictCalendarDateMs(core.finishedAt)) return Object.freeze({ valid: false, reasonCode: 'RUN_TIME_ORDER_INVALID' });
    const expectedHash = sha256Object(core);
    return Object.freeze({ valid: record.runEvidenceHashSha256 === expectedHash, reasonCode: record.runEvidenceHashSha256 === expectedHash ? null : 'RUN_HASH_MISMATCH', expectedHash });
  } catch (error) {
    return Object.freeze({ valid: false, reasonCode: 'RUN_SCHEMA_INVALID', error: error.message });
  }
}

function evaluatePerformanceRun({ slo, runEvidence } = {}) {
  const sloCheck = verifyPerformanceSlo(slo);
  const runCheck = verifyPerformanceRunEvidence(runEvidence);
  if (!sloCheck.valid) throw new TypeError(`slo integrity failed: ${sloCheck.reasonCode}`);
  if (!runCheck.valid) throw new TypeError(`runEvidence integrity failed: ${runCheck.reasonCode}`);
  if (slo.workloadClass !== runEvidence.workloadClass) throw new TypeError('slo and runEvidence workloadClass must match');

  const failures = [];
  if(strictCalendarDateMs(slo.effectiveAt)>strictCalendarDateMs(runEvidence.startedAt)||strictCalendarDateMs(slo.reviewedAt)>strictCalendarDateMs(runEvidence.startedAt))failures.push('SLO_NOT_APPROVED_BEFORE_RUN');
  if (runEvidence.sampleCount < slo.minimumSampleCount) failures.push('MINIMUM_SAMPLE_COUNT_NOT_MET');
  if (runEvidence.p95LatencyMs > slo.maxP95LatencyMs) failures.push('P95_LATENCY_EXCEEDED');
  if (runEvidence.p99LatencyMs > slo.maxP99LatencyMs) failures.push('P99_LATENCY_EXCEEDED');
  if (runEvidence.throughputPerSecond < slo.minThroughputPerSecond) failures.push('MINIMUM_THROUGHPUT_NOT_MET');
  if (runEvidence.errorRatePct > slo.maxErrorRatePct) failures.push('ERROR_RATE_EXCEEDED');

  const core = {
    sloId: slo.sloId,
    sloHashSha256: slo.sloHashSha256,
    runId: runEvidence.runId,
    runEvidenceHashSha256: runEvidence.runEvidenceHashSha256,
    workloadClass: runEvidence.workloadClass,
    status: failures.length === 0 ? PERFORMANCE_STATUS.PASS : PERFORMANCE_STATUS.FAIL,
    failureCodes: failures,
  };
  return Object.freeze({ ...core, evaluationHashSha256: sha256Object(core), sloEvidence:Object.freeze({...slo}), thresholdsInventedByThisModule: false, deploymentAuthorized: false });
}

function createResilienceEvidence(input = {}) {
  const observed = requiredTimestamp(input.observedAt, 'observedAt');
  const reviewed = requiredTimestamp(input.reviewedAt, 'reviewedAt');
  if (reviewed.millis < observed.millis) throw new TypeError('reviewedAt must be on or after observedAt');
  const core = {
    resilienceEvidenceId: requiredString(input.resilienceEvidenceId, 'resilienceEvidenceId'),
    scenario: requiredEnum(input.scenario, RESILIENCE_SCENARIO, 'scenario'),
    environment: requiredEnum(input.environment, QUALIFICATION_ENVIRONMENT, 'environment'),
    exactCommitSha: requiredCommitSha(input.exactCommitSha, 'exactCommitSha'),
    targetRef: requiredString(input.targetRef, 'targetRef'),
    maximumRecoveryTimeSeconds: nonNegativeNumber(input.maximumRecoveryTimeSeconds, 'maximumRecoveryTimeSeconds'),
    observedRecoveryTimeSeconds: nonNegativeNumber(input.observedRecoveryTimeSeconds, 'observedRecoveryTimeSeconds'),
    maximumDataLossSeconds: nonNegativeNumber(input.maximumDataLossSeconds, 'maximumDataLossSeconds'),
    observedDataLossSeconds: nonNegativeNumber(input.observedDataLossSeconds, 'observedDataLossSeconds'),
    duplicateSideEffectsObserved: input.duplicateSideEffectsObserved === true,
    unreconciledDataCorruptionObserved: input.unreconciledDataCorruptionObserved === true,
    objectiveSourceRef: requiredString(input.objectiveSourceRef, 'objectiveSourceRef'),
    sourceArtifactId: requiredString(input.sourceArtifactId, 'sourceArtifactId'),
    sourceArtifactHashSha256: requiredSha256(input.sourceArtifactHashSha256, 'sourceArtifactHashSha256'),
    observedAt: observed.value,
    preparedBy: requiredString(input.preparedBy, 'preparedBy'),
    reviewedBy: requiredString(input.reviewedBy, 'reviewedBy'),
    reviewedAt: reviewed.value,
    evidenceRefs: stringArray(input.evidenceRefs, 'evidenceRefs'),
  };
  if(typeof input.duplicateSideEffectsObserved!=='boolean'||typeof input.unreconciledDataCorruptionObserved!=='boolean')throw new TypeError('RESILIENCE_OBSERVATION_FLAGS_REQUIRED');
  const failureCodes = [];
  if (core.observedRecoveryTimeSeconds > core.maximumRecoveryTimeSeconds) failureCodes.push('RECOVERY_TIME_OBJECTIVE_EXCEEDED');
  if (core.observedDataLossSeconds > core.maximumDataLossSeconds) failureCodes.push('DATA_LOSS_OBJECTIVE_EXCEEDED');
  if (core.duplicateSideEffectsObserved) failureCodes.push('DUPLICATE_SIDE_EFFECTS_OBSERVED');
  if (core.unreconciledDataCorruptionObserved) failureCodes.push('UNRECONCILED_DATA_CORRUPTION_OBSERVED');
  const resultCore = { ...core, status: failureCodes.length === 0 ? PERFORMANCE_STATUS.PASS : PERFORMANCE_STATUS.FAIL, failureCodes };
  return Object.freeze({ ...resultCore, resilienceEvidenceHashSha256: sha256Object(resultCore), objectivesCallerSupplied: true, objectivesInventedByThisModule: false, productionResilienceValidated: false, deploymentAuthorized: false });
}

function verifyResilienceEvidence(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return Object.freeze({ valid: false, reasonCode: 'RESILIENCE_OBJECT_REQUIRED' });
  try {
    const core = {
      resilienceEvidenceId: requiredString(record.resilienceEvidenceId, 'resilienceEvidenceId'),
      scenario: requiredEnum(record.scenario, RESILIENCE_SCENARIO, 'scenario'),
      environment: requiredEnum(record.environment, QUALIFICATION_ENVIRONMENT, 'environment'),
      exactCommitSha: requiredCommitSha(record.exactCommitSha, 'exactCommitSha'),
      targetRef: requiredString(record.targetRef, 'targetRef'),
      maximumRecoveryTimeSeconds: nonNegativeNumber(record.maximumRecoveryTimeSeconds, 'maximumRecoveryTimeSeconds'),
      observedRecoveryTimeSeconds: nonNegativeNumber(record.observedRecoveryTimeSeconds, 'observedRecoveryTimeSeconds'),
      maximumDataLossSeconds: nonNegativeNumber(record.maximumDataLossSeconds, 'maximumDataLossSeconds'),
      observedDataLossSeconds: nonNegativeNumber(record.observedDataLossSeconds, 'observedDataLossSeconds'),
      duplicateSideEffectsObserved: record.duplicateSideEffectsObserved === true,
      unreconciledDataCorruptionObserved: record.unreconciledDataCorruptionObserved === true,
      objectiveSourceRef: requiredString(record.objectiveSourceRef, 'objectiveSourceRef'),
      sourceArtifactId: requiredString(record.sourceArtifactId, 'sourceArtifactId'),
      sourceArtifactHashSha256: requiredSha256(record.sourceArtifactHashSha256, 'sourceArtifactHashSha256'),
      observedAt: requiredTimestamp(record.observedAt, 'observedAt').value,
      preparedBy: requiredString(record.preparedBy, 'preparedBy'),
      reviewedBy: requiredString(record.reviewedBy, 'reviewedBy'),
      reviewedAt: requiredTimestamp(record.reviewedAt, 'reviewedAt').value,
      evidenceRefs: [...stringArray(record.evidenceRefs, 'evidenceRefs')],
      status: requiredEnum(record.status, PERFORMANCE_STATUS, 'status'),
      failureCodes: Array.isArray(record.failureCodes) ? [...record.failureCodes] : [],
    };
    if(typeof record.duplicateSideEffectsObserved!=='boolean'||typeof record.unreconciledDataCorruptionObserved!=='boolean'||strictCalendarDateMs(core.reviewedAt)<strictCalendarDateMs(core.observedAt))return Object.freeze({valid:false,reasonCode:'RESILIENCE_OBSERVATION_OR_TIME_INVALID'});
    const rebuilt=createResilienceEvidence(core);
    if(rebuilt.status!==core.status||JSON.stringify(rebuilt.failureCodes)!==JSON.stringify(core.failureCodes))return Object.freeze({valid:false,reasonCode:'RESILIENCE_OUTCOME_REPLAY_MISMATCH'});
    const expectedHash = sha256Object(core);
    return Object.freeze({ valid: record.resilienceEvidenceHashSha256 === expectedHash, reasonCode: record.resilienceEvidenceHashSha256 === expectedHash ? null : 'RESILIENCE_HASH_MISMATCH', expectedHash });
  } catch (error) {
    return Object.freeze({ valid: false, reasonCode: 'RESILIENCE_SCHEMA_INVALID', error: error.message });
  }
}

function buildPerformanceResilienceQualification(input = {}) {
  const qualificationId = requiredString(input.qualificationId, 'qualificationId');
  const environment = requiredEnum(input.expectedEnvironment, QUALIFICATION_ENVIRONMENT, 'expectedEnvironment');
  const expectedTargetRef = requiredString(input.expectedTargetRef, 'expectedTargetRef');
  const exactCommitSha = requiredCommitSha(input.exactCommitSha, 'exactCommitSha');
  const assessed = requiredTimestamp(input.assessedAt, 'assessedAt');
  const maximumEvidenceAgeDays = nonNegativeNumber(input.maximumEvidenceAgeDays, 'maximumEvidenceAgeDays');
  const requiredWorkloads = [...new Set(stringArray(input.requiredWorkloadClasses, 'requiredWorkloadClasses').map((value) => requiredEnum(value, WORKLOAD_CLASS, 'requiredWorkloadClasses')))];
  const requiredScenarios = [...new Set(stringArray(input.requiredResilienceScenarios, 'requiredResilienceScenarios').map((value) => requiredEnum(value, RESILIENCE_SCENARIO, 'requiredResilienceScenarios')))];
  if (requiredWorkloads.length !== input.requiredWorkloadClasses.length) throw new TypeError('requiredWorkloadClasses must not contain duplicates');
  if (requiredScenarios.length !== input.requiredResilienceScenarios.length) throw new TypeError('requiredResilienceScenarios must not contain duplicates');
  if (!Array.isArray(input.performanceEvaluations)) throw new TypeError('performanceEvaluations must be an array');
  if (!Array.isArray(input.runEvidenceRecords)) throw new TypeError('runEvidenceRecords must be an array');
  if (!Array.isArray(input.resilienceEvidenceRecords)) throw new TypeError('resilienceEvidenceRecords must be an array');

  let status = PERFORMANCE_QUALIFICATION_STATUS.READY_FOR_INDEPENDENT_PERFORMANCE_VALIDATION;
  const issues = [];
  const runsById = new Map(input.runEvidenceRecords.map((record) => [record?.runId, record]));
  const evaluationIds=new Set();
  if(runsById.size!==input.runEvidenceRecords.length||new Set(input.resilienceEvidenceRecords.map(r=>r?.resilienceEvidenceId)).size!==input.resilienceEvidenceRecords.length){status=PERFORMANCE_QUALIFICATION_STATUS.HOLD_EVIDENCE_INTEGRITY;issues.push('DUPLICATE_EVIDENCE_IDS');}

  for (const record of input.runEvidenceRecords) {
    const check = verifyPerformanceRunEvidence(record);
    if (!check.valid) {
      status = PERFORMANCE_QUALIFICATION_STATUS.HOLD_EVIDENCE_INTEGRITY;
      issues.push(`INVALID_RUN_EVIDENCE:${record?.runId || 'UNKNOWN'}:${check.reasonCode}`);
      continue;
    }
    if (record.environment !== environment || record.exactCommitSha !== exactCommitSha || record.targetRef !== expectedTargetRef) {
      status = PERFORMANCE_QUALIFICATION_STATUS.HOLD_SCOPE_MISMATCH;
      issues.push(`RUN_SCOPE_MISMATCH:${record.runId}`);
    }
    // A recent review must not renew the age of old measured results.
    const ageDays = (assessed.millis - strictCalendarDateMs(record.finishedAt)) / 86400000;
    if (ageDays < 0 || ageDays > maximumEvidenceAgeDays || strictCalendarDateMs(record.reviewedAt) > assessed.millis) {
      status = PERFORMANCE_QUALIFICATION_STATUS.HOLD_STALE_EVIDENCE;
      issues.push(`RUN_EVIDENCE_OUTSIDE_FRESHNESS:${record.runId}`);
    }
    if (record.preparedBy === record.reviewedBy) {
      status = PERFORMANCE_QUALIFICATION_STATUS.HOLD_REVIEW_EVIDENCE;
      issues.push(`RUN_NOT_INDEPENDENTLY_REVIEWED:${record.runId}`);
    }
  }

  for (const evaluation of input.performanceEvaluations) {
    const run = runsById.get(evaluation?.runId);
    if (!run || evaluation.runEvidenceHashSha256 !== run.runEvidenceHashSha256 || evaluationIds.has(evaluation.runId)) {
      status = PERFORMANCE_QUALIFICATION_STATUS.HOLD_EVIDENCE_INTEGRITY;
      issues.push('EVALUATION_RUN_BINDING_INVALID:'+(evaluation?.runId||'UNKNOWN'));
      continue;
    }
    evaluationIds.add(evaluation.runId);
    try{
      const replay=evaluatePerformanceRun({slo:evaluation.sloEvidence,runEvidence:run});
      if(replay.evaluationHashSha256!==evaluation.evaluationHashSha256||replay.status!==evaluation.status||replay.workloadClass!==evaluation.workloadClass||replay.sloId!==evaluation.sloId||replay.sloHashSha256!==evaluation.sloHashSha256||JSON.stringify(replay.failureCodes)!==JSON.stringify(evaluation.failureCodes))throw Error('replay mismatch');
    }catch{
      status=PERFORMANCE_QUALIFICATION_STATUS.HOLD_EVIDENCE_INTEGRITY;
      issues.push('EVALUATION_SLO_REPLAY_INVALID:'+evaluation.runId);
    }
  }

  for (const record of input.runEvidenceRecords) {
    if (record && !evaluationIds.has(record.runId)) {
      status = PERFORMANCE_QUALIFICATION_STATUS.HOLD_EVIDENCE_INTEGRITY;
      issues.push('RUN_EVALUATION_MISSING:' + (record.runId || 'UNKNOWN'));
    }
  }

  if (status === PERFORMANCE_QUALIFICATION_STATUS.READY_FOR_INDEPENDENT_PERFORMANCE_VALIDATION) {
    for (const workload of requiredWorkloads) {
      const candidates = input.performanceEvaluations.filter((evaluation) => evaluation.workloadClass === workload);
      if (candidates.length === 0) {
        status = PERFORMANCE_QUALIFICATION_STATUS.HOLD_REQUIRED_WORKLOADS;
        issues.push(`MISSING_REQUIRED_WORKLOAD:${workload}`);
        break;
      }
      // A passing run cannot silently supersede a failing submitted run.
      if (candidates.some((evaluation) => evaluation.status !== PERFORMANCE_STATUS.PASS)) {
        status = PERFORMANCE_QUALIFICATION_STATUS.HOLD_PERFORMANCE_SLO;
        issues.push(`FAILING_WORKLOAD_EVIDENCE:${workload}`);
        break;
      }
    }
  }

  for (const record of input.resilienceEvidenceRecords) {
    const check = verifyResilienceEvidence(record);
    if (!check.valid) {
      status = PERFORMANCE_QUALIFICATION_STATUS.HOLD_EVIDENCE_INTEGRITY;
      issues.push(`INVALID_RESILIENCE_EVIDENCE:${record?.resilienceEvidenceId || 'UNKNOWN'}:${check.reasonCode}`);
      continue;
    }
    if (record.environment !== environment || record.exactCommitSha !== exactCommitSha || record.targetRef !== expectedTargetRef) {
      status = PERFORMANCE_QUALIFICATION_STATUS.HOLD_SCOPE_MISMATCH;
      issues.push(`RESILIENCE_SCOPE_MISMATCH:${record.resilienceEvidenceId}`);
    }
    const ageDays = (assessed.millis - strictCalendarDateMs(record.observedAt)) / 86400000;
    if (ageDays < 0 || ageDays > maximumEvidenceAgeDays || strictCalendarDateMs(record.reviewedAt) > assessed.millis) {
      status = PERFORMANCE_QUALIFICATION_STATUS.HOLD_STALE_EVIDENCE;
      issues.push(`RESILIENCE_EVIDENCE_OUTSIDE_FRESHNESS:${record.resilienceEvidenceId}`);
    }
    if (record.preparedBy === record.reviewedBy) {
      status = PERFORMANCE_QUALIFICATION_STATUS.HOLD_REVIEW_EVIDENCE;
      issues.push(`RESILIENCE_NOT_INDEPENDENTLY_REVIEWED:${record.resilienceEvidenceId}`);
    }
  }

  if (status === PERFORMANCE_QUALIFICATION_STATUS.READY_FOR_INDEPENDENT_PERFORMANCE_VALIDATION) {
    for (const scenario of requiredScenarios) {
      const candidates = input.resilienceEvidenceRecords.filter((record) => record.scenario === scenario);
      if (candidates.length === 0) {
        status = PERFORMANCE_QUALIFICATION_STATUS.HOLD_REQUIRED_RESILIENCE_SCENARIOS;
        issues.push(`MISSING_REQUIRED_RESILIENCE_SCENARIO:${scenario}`);
        break;
      }
      if (candidates.some((record) => record.status !== PERFORMANCE_STATUS.PASS)) {
        status = PERFORMANCE_QUALIFICATION_STATUS.HOLD_RESILIENCE_OBJECTIVE;
        issues.push(`FAILING_RESILIENCE_EVIDENCE:${scenario}`);
        break;
      }
    }
  }

  const core = {
    qualificationId,
    expectedEnvironment: environment,
    expectedTargetRef,
    exactCommitSha,
    assessedAt: assessed.value,
    maximumEvidenceAgeDays,
    requiredWorkloadClasses: requiredWorkloads,
    requiredResilienceScenarios: requiredScenarios,
    performanceEvaluationHashesSha256: Array.from(input.performanceEvaluations, item => item?.evaluationHashSha256 || null),
    runEvidenceHashesSha256: Array.from(input.runEvidenceRecords, item => item?.runEvidenceHashSha256 || null),
    resilienceEvidenceHashesSha256: Array.from(input.resilienceEvidenceRecords, item => item?.resilienceEvidenceHashSha256 || null),
    status,
    issues,
  };

  return Object.freeze({
    ...core,
    qualificationHashSha256: sha256Object(core),
    callerSuppliedSlosRequired: true,
    callerSuppliedRecoveryObjectivesRequired: true,
    thresholdsInventedByThisModule: false,
    productionPerformanceValidated: false,
    productionResilienceValidated: false,
    capacityPlanEstablished: false,
    slaEstablished: false,
    independentPerformanceValidationRequired: true,
    humanReleaseApprovalRequired: true,
    mergeAuthorized: false,
    deploymentAuthorized: false,
    transactionAuthorized: false,
    semantics: 'READY_FOR_INDEPENDENT_PERFORMANCE_VALIDATION means only that caller-supplied performance SLOs, exact-commit run evidence, and caller-supplied resilience objectives passed deterministic scope, freshness, integrity, coverage, outcome and review checks for the declared environment. This module does not execute load tests, chaos tests, failovers or restores; does not establish an SLA/capacity plan; and does not authorize merge or deployment.',
  });
}

function verifyPerformanceResilienceQualification(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return Object.freeze({ valid: false, reasonCode: 'QUALIFICATION_OBJECT_REQUIRED' });
  const invalid = reasonCode => Object.freeze({valid:false,reasonCode});
  const arrays=['requiredWorkloadClasses','requiredResilienceScenarios','performanceEvaluationHashesSha256','runEvidenceHashesSha256','resilienceEvidenceHashesSha256','issues'];
  if(arrays.some(key=>!Array.isArray(record[key])))return invalid('QUALIFICATION_SCHEMA_INVALID');
  try {
    requiredString(record.expectedTargetRef,'expectedTargetRef');
    requiredCommitSha(record.exactCommitSha,'exactCommitSha');
    requiredEnum(record.expectedEnvironment,QUALIFICATION_ENVIRONMENT,'expectedEnvironment');
    requiredEnum(record.status,PERFORMANCE_QUALIFICATION_STATUS,'status');
    if(['productionPerformanceValidated','productionResilienceValidated','capacityPlanEstablished','slaEstablished','mergeAuthorized','deploymentAuthorized','transactionAuthorized','thresholdsInventedByThisModule'].some(key=>record[key]!==false)||
       ['callerSuppliedSlosRequired','callerSuppliedRecoveryObjectivesRequired','independentPerformanceValidationRequired','humanReleaseApprovalRequired'].some(key=>record[key]!==true))
      return invalid('QUALIFICATION_AUTHORITY_INVALID');
    if(record.status===PERFORMANCE_QUALIFICATION_STATUS.READY_FOR_INDEPENDENT_PERFORMANCE_VALIDATION){
      if(record.issues.length||record.performanceEvaluationHashesSha256.length!==record.runEvidenceHashesSha256.length||
         ['performanceEvaluationHashesSha256','runEvidenceHashesSha256','resilienceEvidenceHashesSha256'].some(key=>!record[key].length||record[key].some(hash=>typeof hash!=='string'||!SHA256_RE.test(hash))))
        return invalid('QUALIFICATION_READY_EVIDENCE_INVALID');
    }
  }catch{return invalid('QUALIFICATION_SCHEMA_INVALID');}
  const core = {
    qualificationId: record.qualificationId,
    expectedEnvironment: record.expectedEnvironment,
    expectedTargetRef: record.expectedTargetRef,
    exactCommitSha: record.exactCommitSha,
    assessedAt: record.assessedAt,
    maximumEvidenceAgeDays: record.maximumEvidenceAgeDays,
    requiredWorkloadClasses: [...(record.requiredWorkloadClasses || [])],
    requiredResilienceScenarios: [...(record.requiredResilienceScenarios || [])],
    performanceEvaluationHashesSha256: [...(record.performanceEvaluationHashesSha256 || [])],
    runEvidenceHashesSha256: [...(record.runEvidenceHashesSha256 || [])],
    resilienceEvidenceHashesSha256: [...(record.resilienceEvidenceHashesSha256 || [])],
    status: record.status,
    issues: [...(record.issues || [])],
  };
  const expectedHash = sha256Object(core);
  return Object.freeze({ valid: record.qualificationHashSha256 === expectedHash, reasonCode: record.qualificationHashSha256 === expectedHash ? null : 'QUALIFICATION_HASH_MISMATCH', expectedHash });
}

module.exports = {
  QUALIFICATION_ENVIRONMENT,
  WORKLOAD_CLASS,
  RESILIENCE_SCENARIO,
  PERFORMANCE_STATUS,
  PERFORMANCE_QUALIFICATION_STATUS,
  createPerformanceSlo,
  verifyPerformanceSlo,
  createPerformanceRunEvidence,
  verifyPerformanceRunEvidence,
  evaluatePerformanceRun,
  createResilienceEvidence,
  verifyResilienceEvidence,
  buildPerformanceResilienceQualification,
  verifyPerformanceResilienceQualification,
};
