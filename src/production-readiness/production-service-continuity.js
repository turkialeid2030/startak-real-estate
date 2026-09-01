'use strict';

const { explicitTimezoneTimestamp } = require('./controlled-production-activation');

const PRODUCTION_SERVICE_CONTINUITY_STATUS = Object.freeze({
  READY_FOR_HUMAN_CONTINUITY_REVIEW: 'READY_FOR_HUMAN_CONTINUITY_REVIEW',
  HOLD_SCOPE: 'HOLD_SCOPE',
  HOLD_POST_DEPLOYMENT_REVIEW: 'HOLD_POST_DEPLOYMENT_REVIEW',
  HOLD_MONITORING_POLICY: 'HOLD_MONITORING_POLICY',
  HOLD_WINDOW: 'HOLD_WINDOW',
  HOLD_OBSERVATIONS: 'HOLD_OBSERVATIONS',
  HOLD_CONDITIONS: 'HOLD_CONDITIONS',
  HOLD_INCIDENTS: 'HOLD_INCIDENTS',
  HOLD_ROLLBACK_READINESS: 'HOLD_ROLLBACK_READINESS',
  HOLD_EVIDENCE_CHAIN: 'HOLD_EVIDENCE_CHAIN',
});

const ALLOWED_OBSERVATION_RESULT = new Set(['PASS', 'WARN', 'FAIL']);

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function cleanRefs(refs) {
  return Array.isArray(refs) ? [...new Set(refs.filter(nonEmptyString).map((ref) => ref.trim()))] : [];
}

function hold(status, reasons, context = {}, diagnostics = {}) {
  return Object.freeze({
    schemaVersion: 1,
    caseId: context.caseId || null,
    projectId: context.projectId || null,
    status,
    reasons: Object.freeze(reasons),
    diagnostics: Object.freeze({ ...diagnostics }),
    readyForHumanContinuityReview: false,
    continuedProductionUseAuthorizedByThisModule: false,
    rollbackAuthorizedByThisModule: false,
    productionDeploymentVerifiedByThisModule: false,
    productionSecurityCertified: false,
    legalApprovalEstablished: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
  });
}

function normalizeMonitoringPolicy(policy) {
  if (!policy || typeof policy !== 'object' || Array.isArray(policy)) return null;
  if (!nonEmptyString(policy.policyId) || !nonEmptyString(policy.policyEvidenceRef)) return null;
  if (!Array.isArray(policy.requiredSignalIds) || policy.requiredSignalIds.length === 0) return null;
  const requiredSignalIds = [...new Set(policy.requiredSignalIds.filter(nonEmptyString).map((v) => v.trim()))];
  if (requiredSignalIds.length !== policy.requiredSignalIds.length) return null;
  if (!Array.isArray(policy.blockingResults) || policy.blockingResults.length === 0) return null;
  const blockingResults = [...new Set(policy.blockingResults.map((v) => String(v || '').trim().toUpperCase()))];
  if (blockingResults.some((result) => !ALLOWED_OBSERVATION_RESULT.has(result))) return null;
  return Object.freeze({
    policyId: policy.policyId.trim(),
    policyEvidenceRef: policy.policyEvidenceRef.trim(),
    requiredSignalIds: Object.freeze(requiredSignalIds),
    blockingResults: Object.freeze(blockingResults),
  });
}

function normalizeObservations(observations, window) {
  if (!Array.isArray(observations) || observations.length === 0) return null;
  const normalized = [];
  const seen = new Set();
  for (const observation of observations) {
    if (!observation || typeof observation !== 'object' || Array.isArray(observation)) return null;
    if (!nonEmptyString(observation.signalId)
        || !nonEmptyString(observation.observationId)
        || !nonEmptyString(observation.evidenceRef)
        || !nonEmptyString(observation.observedByRef)) return null;
    const observedAt = explicitTimezoneTimestamp(observation.observedAt);
    const result = String(observation.result || '').trim().toUpperCase();
    if (!observedAt || !ALLOWED_OBSERVATION_RESULT.has(result)) return null;
    if (observedAt.epochMs < window.startsAt.epochMs || observedAt.epochMs > window.endsAt.epochMs) return null;
    const key = `${observation.signalId.trim()}::${observation.observationId.trim()}`;
    if (seen.has(key)) return null;
    seen.add(key);
    normalized.push(Object.freeze({
      signalId: observation.signalId.trim(),
      observationId: observation.observationId.trim(),
      observedAt: observedAt.canonical,
      result,
      evidenceRef: observation.evidenceRef.trim(),
      observedByRef: observation.observedByRef.trim(),
    }));
  }
  return Object.freeze(normalized);
}

function normalizeConditionEvidence(conditionEvidence, review) {
  const conditions = review?.review?.monitoringConditions || [];
  if (!Array.isArray(conditionEvidence)) return null;
  if (conditions.length === 0) return conditionEvidence.length === 0 ? Object.freeze([]) : null;
  const byId = new Map();
  for (const item of conditionEvidence) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    if (!nonEmptyString(item.conditionId)
        || !nonEmptyString(item.ownerRef)
        || !nonEmptyString(item.evidenceRef)
        || item.satisfied !== true) return null;
    const satisfiedAt = explicitTimezoneTimestamp(item.satisfiedAt);
    if (!satisfiedAt || byId.has(item.conditionId.trim())) return null;
    byId.set(item.conditionId.trim(), Object.freeze({
      conditionId: item.conditionId.trim(),
      ownerRef: item.ownerRef.trim(),
      satisfiedAt: satisfiedAt.canonical,
      evidenceRef: item.evidenceRef.trim(),
      satisfied: true,
    }));
  }
  if (byId.size !== conditions.length) return null;
  for (const condition of conditions) {
    const item = byId.get(condition.conditionId);
    if (!item || item.ownerRef !== condition.ownerRef) return null;
  }
  return Object.freeze([...byId.values()]);
}

function summarizeIncidents(incidents) {
  if (!Array.isArray(incidents)) return null;
  let unresolvedBlocking = 0;
  let dataLeakage = 0;
  const normalized = [];
  for (const incident of incidents) {
    if (!incident || typeof incident !== 'object' || Array.isArray(incident)) return null;
    if (!nonEmptyString(incident.incidentId) || !nonEmptyString(incident.severity) || !nonEmptyString(incident.type)) return null;
    const severity = incident.severity.trim().toUpperCase();
    const type = incident.type.trim().toUpperCase();
    if (['HIGH', 'CRITICAL'].includes(severity) && incident.resolved !== true) unresolvedBlocking += 1;
    if (type === 'DATA_LEAKAGE') dataLeakage += 1;
    normalized.push(Object.freeze({
      incidentId: incident.incidentId.trim(),
      severity,
      type,
      resolved: incident.resolved === true,
      evidenceRef: nonEmptyString(incident.evidenceRef) ? incident.evidenceRef.trim() : null,
    }));
  }
  return Object.freeze({
    total: normalized.length,
    unresolvedBlocking,
    dataLeakage,
    incidents: Object.freeze(normalized),
  });
}

function buildProductionServiceContinuityEvidence({
  caseId,
  projectId,
  postDeploymentHumanReview,
  monitoringPolicy,
  observationWindow,
  observations,
  conditionEvidence = [],
  incidents = [],
  rollbackReadiness,
  evidenceRefs = [],
} = {}) {
  const context = { caseId, projectId };
  if (!nonEmptyString(caseId) || !nonEmptyString(projectId)) {
    return hold(PRODUCTION_SERVICE_CONTINUITY_STATUS.HOLD_SCOPE, ['caseId/projectId required'], context);
  }
  if (!postDeploymentHumanReview
      || postDeploymentHumanReview.caseId !== caseId
      || postDeploymentHumanReview.projectId !== projectId) {
    return hold(PRODUCTION_SERVICE_CONTINUITY_STATUS.HOLD_SCOPE, ['post-deployment human review scope mismatch'], context);
  }

  const acceptedReview =
    postDeploymentHumanReview.status === 'REVIEW_RECORDED' &&
    postDeploymentHumanReview.humanPostDeploymentReviewRecorded === true &&
    postDeploymentHumanReview.productionServiceUseApprovedByHuman === true &&
    postDeploymentHumanReview.rollbackRequiredByHuman === false &&
    postDeploymentHumanReview.productionUseAuthorizedByThisModule === false &&
    postDeploymentHumanReview.transactionAuthorized === false &&
    ['ACCEPT_PRODUCTION_SERVICE', 'ACCEPT_WITH_MONITORING_CONDITIONS'].includes(postDeploymentHumanReview.review?.outcome);
  if (!acceptedReview) {
    return hold(PRODUCTION_SERVICE_CONTINUITY_STATUS.HOLD_POST_DEPLOYMENT_REVIEW, ['an accepted human post-deployment review is required before continuity monitoring'], context);
  }

  const policy = normalizeMonitoringPolicy(monitoringPolicy);
  if (!policy) {
    return hold(PRODUCTION_SERVICE_CONTINUITY_STATUS.HOLD_MONITORING_POLICY, ['caller-supplied monitoring policy must declare unique required signals, blocking results, and evidence reference'], context);
  }

  const startsAt = explicitTimezoneTimestamp(observationWindow?.startsAt);
  const endsAt = explicitTimezoneTimestamp(observationWindow?.endsAt);
  const reviewedAt = explicitTimezoneTimestamp(postDeploymentHumanReview.review?.reviewedAt);
  if (!startsAt || !endsAt || !reviewedAt || startsAt.epochMs < reviewedAt.epochMs || endsAt.epochMs < startsAt.epochMs) {
    return hold(PRODUCTION_SERVICE_CONTINUITY_STATUS.HOLD_WINDOW, ['observation window must be timezone-explicit, ordered, and start no earlier than the human post-deployment review'], context);
  }

  const normalizedObservations = normalizeObservations(observations, { startsAt, endsAt });
  if (!normalizedObservations) {
    return hold(PRODUCTION_SERVICE_CONTINUITY_STATUS.HOLD_OBSERVATIONS, ['observations must be unique, timezone-explicit, evidenced, human-attributed, and inside the declared window'], context);
  }
  const latestBySignal = new Map();
  for (const observation of normalizedObservations) {
    const current = latestBySignal.get(observation.signalId);
    if (!current || Date.parse(observation.observedAt) > Date.parse(current.observedAt)) latestBySignal.set(observation.signalId, observation);
  }
  const missingSignals = policy.requiredSignalIds.filter((signalId) => !latestBySignal.has(signalId));
  const blockingSignals = policy.requiredSignalIds
    .map((signalId) => latestBySignal.get(signalId))
    .filter(Boolean)
    .filter((observation) => policy.blockingResults.includes(observation.result));
  if (missingSignals.length || blockingSignals.length) {
    return hold(
      PRODUCTION_SERVICE_CONTINUITY_STATUS.HOLD_OBSERVATIONS,
      ['required monitoring signals are missing or have a caller-policy blocking result'],
      context,
      { missingSignals, blockingSignalIds: blockingSignals.map((item) => item.signalId) },
    );
  }

  const normalizedConditionEvidence = normalizeConditionEvidence(conditionEvidence, postDeploymentHumanReview);
  if (!normalizedConditionEvidence) {
    return hold(PRODUCTION_SERVICE_CONTINUITY_STATUS.HOLD_CONDITIONS, ['all human monitoring conditions must be uniquely satisfied by the same owner with timezone-explicit evidence'], context);
  }

  const incidentSummary = summarizeIncidents(incidents);
  if (!incidentSummary || incidentSummary.unresolvedBlocking > 0 || incidentSummary.dataLeakage > 0) {
    return hold(PRODUCTION_SERVICE_CONTINUITY_STATUS.HOLD_INCIDENTS, ['unresolved HIGH/CRITICAL incidents or any recorded DATA_LEAKAGE incident require human intervention'], context, incidentSummary || {});
  }

  const rollbackReady = rollbackReadiness
    && rollbackReadiness.procedureAvailable === true
    && rollbackReadiness.knownGoodReleaseVerified === true
    && nonEmptyString(rollbackReadiness.knownGoodReleaseRef)
    && nonEmptyString(rollbackReadiness.evidenceRef);
  if (!rollbackReady) {
    return hold(PRODUCTION_SERVICE_CONTINUITY_STATUS.HOLD_ROLLBACK_READINESS, ['rollback procedure and verified known-good release evidence are required throughout the continuity window'], context);
  }

  const suppliedRefs = cleanRefs(evidenceRefs);
  const requiredRefs = cleanRefs([
    ...(postDeploymentHumanReview.evidenceRefs || []),
    monitoringPolicy.policyEvidenceRef,
    ...normalizedObservations.flatMap((item) => [item.evidenceRef, item.observedByRef]),
    ...normalizedConditionEvidence.flatMap((item) => [item.ownerRef, item.evidenceRef]),
    ...incidentSummary.incidents.map((item) => item.evidenceRef),
    rollbackReadiness.knownGoodReleaseRef,
    rollbackReadiness.evidenceRef,
  ]);
  const missingRefs = requiredRefs.filter((ref) => !suppliedRefs.includes(ref));
  if (!suppliedRefs.length || missingRefs.length) {
    return hold(PRODUCTION_SERVICE_CONTINUITY_STATUS.HOLD_EVIDENCE_CHAIN, ['continuity evidence reference chain is incomplete'], context, { missingRefCount: missingRefs.length });
  }

  return Object.freeze({
    schemaVersion: 1,
    caseId,
    projectId,
    status: PRODUCTION_SERVICE_CONTINUITY_STATUS.READY_FOR_HUMAN_CONTINUITY_REVIEW,
    reasons: Object.freeze([]),
    monitoringPolicy: policy,
    observationWindow: Object.freeze({ startsAt: startsAt.canonical, endsAt: endsAt.canonical }),
    latestRequiredObservations: Object.freeze(policy.requiredSignalIds.map((signalId) => latestBySignal.get(signalId))),
    conditionEvidence: normalizedConditionEvidence,
    incidentSummary,
    rollbackReadiness: Object.freeze({
      procedureAvailable: true,
      knownGoodReleaseVerified: true,
      knownGoodReleaseRef: rollbackReadiness.knownGoodReleaseRef.trim(),
      evidenceRef: rollbackReadiness.evidenceRef.trim(),
    }),
    evidenceRefs: Object.freeze(suppliedRefs),
    readyForHumanContinuityReview: true,
    continuedProductionUseAuthorizedByThisModule: false,
    rollbackAuthorizedByThisModule: false,
    productionDeploymentVerifiedByThisModule: false,
    productionSecurityCertified: false,
    legalApprovalEstablished: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
    semantics: 'READY_FOR_HUMAN_CONTINUITY_REVIEW means caller-supplied monitoring, condition, incident, rollback, and evidence-chain checks are complete under the caller-supplied policy. It does not independently authorize continued production use, order rollback, attest deployment, certify security/legal/valuation status, infer service quality beyond supplied evidence, or authorize an investment transaction. A separate accountable human continuity decision remains required.',
  });
}

module.exports = {
  PRODUCTION_SERVICE_CONTINUITY_STATUS,
  normalizeMonitoringPolicy,
  buildProductionServiceContinuityEvidence,
};
