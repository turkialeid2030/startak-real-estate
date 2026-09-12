'use strict';

const crypto = require('crypto');
const {
  DR_FAILOVER_STATUS,
} = require('./controlled-dr-failover-qualification');

const OBSERVABILITY_STATUS = Object.freeze({
  DRY_RUN_READY: 'DRY_RUN_READY',
  HOLD_DR_FAILOVER_QUALIFICATION: 'HOLD_DR_FAILOVER_QUALIFICATION',
  HOLD_AUTHORIZATION: 'HOLD_AUTHORIZATION',
  HOLD_METRICS: 'HOLD_METRICS',
  HOLD_ALERT_DELIVERY: 'HOLD_ALERT_DELIVERY',
  HOLD_INCIDENT_RESPONSE: 'HOLD_INCIDENT_RESPONSE',
  HOLD_OBJECTIVES: 'HOLD_OBJECTIVES',
  OBSERVABILITY_INCIDENT_EVIDENCE_COMPLETE_NOT_PRODUCTION_CERTIFIED: 'OBSERVABILITY_INCIDENT_EVIDENCE_COMPLETE_NOT_PRODUCTION_CERTIFIED',
});

const AUTHORITY = Object.freeze({
  releaseAuthorized: false,
  mergeAuthorized: false,
  deploymentAuthorized: false,
  goLiveAuthorized: false,
  transactionAuthorized: false,
  productionMonitoringValidated: false,
  productionIncidentResponseValidated: false,
  productionSecurityValidated: false,
  productionResilienceValidated: false,
});

const COMMIT_SHA_RE = /^[a-f0-9]{40}$/i;

function requiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}

function requiredCommitSha(value) {
  const normalized = requiredString(value, 'exactCommitSha').toLowerCase();
  if (!COMMIT_SHA_RE.test(normalized)) throw new TypeError('exactCommitSha must be a 40-character git commit SHA');
  return normalized;
}

function requiredTimestamp(value, field) {
  const normalized = requiredString(value, field);
  const millis = Date.parse(normalized);
  if (!Number.isFinite(millis)) throw new TypeError(`${field} must be an ISO-compatible timestamp`);
  return { value: normalized, millis };
}

function nonNegativeNumber(value, field) {
  if (!Number.isFinite(value) || value < 0) throw new TypeError(`${field} must be a finite non-negative number`);
  return value;
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) freeze(child);
  return value;
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
  return crypto.createHash('sha256').update(JSON.stringify(canonicalize(value)), 'utf8').digest('hex');
}

function sha256Text(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function hashReference(value, field) {
  return `sha256:${sha256Text(requiredString(value, field))}`;
}

function normalizeEnvironment(value) {
  const normalized = requiredString(value, 'environment').toLowerCase();
  if (normalized !== 'staging') throw new TypeError('environment must be staging');
  return normalized;
}

function normalizeRequiredSignals(value) {
  if (!Array.isArray(value) || value.length === 0) throw new TypeError('monitoringObjectives.requiredSignals must be a non-empty array');
  const normalized = value.map((item, index) => requiredString(item, `monitoringObjectives.requiredSignals[${index}]`));
  if (new Set(normalized).size !== normalized.length) throw new TypeError('monitoringObjectives.requiredSignals must not contain duplicates');
  return Object.freeze([...normalized].sort());
}

function normalizeObjectives(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('monitoringObjectives must be an object');
  return freeze({
    requiredSignals: normalizeRequiredSignals(value.requiredSignals),
    maximumMetricFreshnessSeconds: nonNegativeNumber(value.maximumMetricFreshnessSeconds, 'monitoringObjectives.maximumMetricFreshnessSeconds'),
    maximumAlertDeliverySeconds: nonNegativeNumber(value.maximumAlertDeliverySeconds, 'monitoringObjectives.maximumAlertDeliverySeconds'),
    maximumIncidentAcknowledgeSeconds: nonNegativeNumber(value.maximumIncidentAcknowledgeSeconds, 'monitoringObjectives.maximumIncidentAcknowledgeSeconds'),
    objectiveSourceRef: requiredString(value.objectiveSourceRef, 'monitoringObjectives.objectiveSourceRef'),
  });
}

function normalizeAuthorization(value, target) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const normalized = {
    approved: value.approved === true,
    allowSyntheticAlert: value.allowSyntheticAlert === true,
    approvedBy: typeof value.approvedBy === 'string' ? value.approvedBy.trim() : '',
    reviewedBy: typeof value.reviewedBy === 'string' ? value.reviewedBy.trim() : '',
    approvedAt: typeof value.approvedAt === 'string' ? value.approvedAt.trim() : '',
    changeControlRef: typeof value.changeControlRef === 'string' ? value.changeControlRef.trim() : '',
    environment: typeof value.environment === 'string' ? value.environment.trim().toLowerCase() : '',
    serviceRef: typeof value.serviceRef === 'string' ? value.serviceRef.trim() : '',
    exactCommitSha: typeof value.exactCommitSha === 'string' ? value.exactCommitSha.trim().toLowerCase() : '',
  };
  let approvedAtValid = false;
  try { requiredTimestamp(normalized.approvedAt, 'authorization.approvedAt'); approvedAtValid = true; } catch (_) { approvedAtValid = false; }
  const accepted = Boolean(
    normalized.approved
    && normalized.allowSyntheticAlert
    && normalized.approvedBy
    && normalized.reviewedBy
    && normalized.approvedBy !== normalized.reviewedBy
    && approvedAtValid
    && normalized.changeControlRef
    && normalized.environment === target.environment
    && normalized.serviceRef === target.serviceRef
    && normalized.exactCommitSha === target.exactCommitSha,
  );
  return freeze({
    accepted,
    approvedBy: accepted ? normalized.approvedBy : null,
    reviewedBy: accepted ? normalized.reviewedBy : null,
    approvedAt: accepted ? normalized.approvedAt : null,
    changeControlRef: accepted ? normalized.changeControlRef : null,
  });
}

function normalizeMetricsResult(value, objectives) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('metricsExecutor result must be an object');
  const observed = requiredTimestamp(value.observedAt, 'metrics.observedAt');
  const latest = requiredTimestamp(value.latestSampleAt, 'metrics.latestSampleAt');
  if (latest.millis > observed.millis) throw new TypeError('metrics.latestSampleAt must not be after metrics.observedAt');
  if (!Array.isArray(value.availableSignals)) throw new TypeError('metrics.availableSignals must be an array');
  const available = new Set(value.availableSignals.filter((item) => typeof item === 'string').map((item) => item.trim()).filter(Boolean));
  const requiredSignalChecks = objectives.requiredSignals.map((signal) => Object.freeze({ signal, present: available.has(signal) }));
  const missingRequiredSignals = requiredSignalChecks.filter((item) => !item.present).map((item) => item.signal);
  const freshnessSeconds = (observed.millis - latest.millis) / 1000;
  return freeze({
    observedAt: observed.value,
    latestSampleAt: latest.value,
    freshnessSeconds,
    queryHealthy: value.queryHealthy === true,
    requiredSignalChecks,
    missingRequiredSignals,
    metricsBackendRef: hashReference(value.metricsBackendRef, 'metrics.metricsBackendRef'),
  });
}

function normalizeAlertResult(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('alertExecutor result must be an object');
  const triggered = requiredTimestamp(value.triggeredAt, 'alert.triggeredAt');
  const delivered = requiredTimestamp(value.deliveredAt, 'alert.deliveredAt');
  if (delivered.millis < triggered.millis) throw new TypeError('alert.deliveredAt must be on or after alert.triggeredAt');
  return freeze({
    triggeredAt: triggered.value,
    deliveredAt: delivered.value,
    deliverySeconds: (delivered.millis - triggered.millis) / 1000,
    deliveryConfirmed: value.deliveryConfirmed === true,
    alertIdRef: hashReference(value.alertId, 'alert.alertId'),
    routeRef: hashReference(value.routeRef, 'alert.routeRef'),
    receiverRef: hashReference(value.receiverRef, 'alert.receiverRef'),
  });
}

function normalizeIncidentResult(value, alert) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('incidentExecutor result must be an object');
  const opened = requiredTimestamp(value.openedAt, 'incident.openedAt');
  const acknowledged = requiredTimestamp(value.acknowledgedAt, 'incident.acknowledgedAt');
  const resolved = requiredTimestamp(value.resolvedAt, 'incident.resolvedAt');
  const delivered = requiredTimestamp(alert.deliveredAt, 'alert.deliveredAt');
  if (opened.millis < delivered.millis) throw new TypeError('incident.openedAt must be on or after alert.deliveredAt');
  if (acknowledged.millis < opened.millis) throw new TypeError('incident.acknowledgedAt must be on or after incident.openedAt');
  if (resolved.millis < acknowledged.millis) throw new TypeError('incident.resolvedAt must be on or after incident.acknowledgedAt');
  return freeze({
    openedAt: opened.value,
    acknowledgedAt: acknowledged.value,
    resolvedAt: resolved.value,
    acknowledgeSecondsFromDelivery: (acknowledged.millis - delivered.millis) / 1000,
    acknowledgementConfirmed: value.acknowledgementConfirmed === true,
    runbookAvailable: value.runbookAvailable === true,
    incidentRef: hashReference(value.incidentRef, 'incident.incidentRef'),
    runbookRef: hashReference(value.runbookRef, 'incident.runbookRef'),
    onCallOwnerRef: hashReference(value.onCallOwnerRef, 'incident.onCallOwnerRef'),
    escalationPolicyRef: hashReference(value.escalationPolicyRef, 'incident.escalationPolicyRef'),
  });
}

function makeResult({ status, plan, authorization, metrics, alert, incident }) {
  const evidenceCore = {
    schemaVersion: 1,
    status,
    planHashSha256: plan.planHashSha256,
    drFailoverQualificationRef: plan.drFailoverQualificationRef,
    authorizationAccepted: authorization?.accepted === true,
    metricsRef: metrics ? `sha256:${sha256Object(metrics)}` : null,
    alertRef: alert ? `sha256:${sha256Object(alert)}` : null,
    incidentRef: incident ? `sha256:${sha256Object(incident)}` : null,
  };
  const evidenceHashSha256 = sha256Object(evidenceCore);
  return freeze({
    ...evidenceCore,
    plan,
    authorization: authorization || null,
    metrics: metrics || null,
    alert: alert || null,
    incident: incident || null,
    evidenceHashSha256,
    evidenceRef: `sha256:${evidenceHashSha256}`,
    productionQualified: false,
    authority: AUTHORITY,
    semantics: 'This staging-only qualification orchestrates host-injected metrics inspection, synthetic alert delivery, and incident acknowledgement/runbook checks against caller-supplied monitoring objectives. It hashes external operational references instead of returning them raw. It does not certify production monitoring or incident response, establish an SLA, or authorize release, merge, deployment, go-live, or transactions.',
  });
}

function createControlledObservabilityIncidentQualification({
  metricsExecutor,
  alertExecutor,
  incidentExecutor,
} = {}) {
  return async function qualify({
    drFailoverQualification,
    environment,
    serviceRef,
    exactCommitSha,
    monitoringObjectives,
    authorization,
    execute = false,
    probeId = 'p18-observability-incident',
    assessedAt = new Date().toISOString(),
  } = {}) {
    const env = normalizeEnvironment(environment);
    const service = requiredString(serviceRef, 'serviceRef');
    const commitSha = requiredCommitSha(exactCommitSha);
    const objectives = normalizeObjectives(monitoringObjectives);
    const normalizedProbeId = requiredString(probeId, 'probeId');
    const assessed = requiredTimestamp(assessedAt, 'assessedAt');

    const drComplete = Boolean(
      drFailoverQualification
      && drFailoverQualification.status === DR_FAILOVER_STATUS.DR_FAILOVER_EVIDENCE_COMPLETE_NOT_PRODUCTION_CERTIFIED
      && drFailoverQualification.plan?.environment === env
      && drFailoverQualification.plan?.exactCommitSha === commitSha,
    );
    const drFailoverQualificationRef = drFailoverQualification?.executionHashSha256
      ? `sha256:${drFailoverQualification.executionHashSha256}`
      : null;

    const planCore = {
      schemaVersion: 1,
      environment: env,
      serviceRef: service,
      exactCommitSha: commitSha,
      probeId: normalizedProbeId,
      monitoringObjectives: objectives,
      drFailoverQualificationRef,
      executionOrder: ['metricsInspection', 'syntheticAlert', 'incidentAcknowledgementAndRunbook'],
    };
    const plan = freeze({ ...planCore, planHashSha256: sha256Object(planCore) });

    if (!drComplete) {
      return makeResult({ status: OBSERVABILITY_STATUS.HOLD_DR_FAILOVER_QUALIFICATION, plan });
    }
    if (execute !== true) {
      return makeResult({ status: OBSERVABILITY_STATUS.DRY_RUN_READY, plan });
    }

    const auth = normalizeAuthorization(authorization, { environment: env, serviceRef: service, exactCommitSha: commitSha });
    if (!auth?.accepted) {
      return makeResult({ status: OBSERVABILITY_STATUS.HOLD_AUTHORIZATION, plan, authorization: auth });
    }

    if (typeof metricsExecutor !== 'function') throw new TypeError('metricsExecutor must be a function when execute=true');
    if (typeof alertExecutor !== 'function') throw new TypeError('alertExecutor must be a function when execute=true');
    if (typeof incidentExecutor !== 'function') throw new TypeError('incidentExecutor must be a function when execute=true');

    let metrics;
    try {
      metrics = normalizeMetricsResult(await metricsExecutor({
        environment: env,
        serviceRef: service,
        exactCommitSha: commitSha,
        requiredSignals: objectives.requiredSignals,
        planHashSha256: plan.planHashSha256,
      }), objectives);
    } catch (_) {
      return makeResult({ status: OBSERVABILITY_STATUS.HOLD_METRICS, plan, authorization: auth });
    }

    if (!metrics.queryHealthy || metrics.missingRequiredSignals.length > 0) {
      return makeResult({ status: OBSERVABILITY_STATUS.HOLD_METRICS, plan, authorization: auth, metrics });
    }
    if (metrics.freshnessSeconds > objectives.maximumMetricFreshnessSeconds) {
      return makeResult({ status: OBSERVABILITY_STATUS.HOLD_OBJECTIVES, plan, authorization: auth, metrics });
    }

    let alert;
    try {
      alert = normalizeAlertResult(await alertExecutor({
        environment: env,
        serviceRef: service,
        probeId: normalizedProbeId,
        planHashSha256: plan.planHashSha256,
      }));
    } catch (_) {
      return makeResult({ status: OBSERVABILITY_STATUS.HOLD_ALERT_DELIVERY, plan, authorization: auth, metrics });
    }

    if (!alert.deliveryConfirmed) {
      return makeResult({ status: OBSERVABILITY_STATUS.HOLD_ALERT_DELIVERY, plan, authorization: auth, metrics, alert });
    }
    if (alert.deliverySeconds > objectives.maximumAlertDeliverySeconds) {
      return makeResult({ status: OBSERVABILITY_STATUS.HOLD_OBJECTIVES, plan, authorization: auth, metrics, alert });
    }

    let incident;
    try {
      incident = normalizeIncidentResult(await incidentExecutor({
        environment: env,
        serviceRef: service,
        probeId: normalizedProbeId,
        alertIdRef: alert.alertIdRef,
        planHashSha256: plan.planHashSha256,
      }), alert);
    } catch (_) {
      return makeResult({ status: OBSERVABILITY_STATUS.HOLD_INCIDENT_RESPONSE, plan, authorization: auth, metrics, alert });
    }

    if (!incident.acknowledgementConfirmed || !incident.runbookAvailable) {
      return makeResult({ status: OBSERVABILITY_STATUS.HOLD_INCIDENT_RESPONSE, plan, authorization: auth, metrics, alert, incident });
    }
    if (incident.acknowledgeSecondsFromDelivery > objectives.maximumIncidentAcknowledgeSeconds) {
      return makeResult({ status: OBSERVABILITY_STATUS.HOLD_OBJECTIVES, plan, authorization: auth, metrics, alert, incident });
    }

    if (assessed.millis < Date.parse(incident.resolvedAt)) {
      return makeResult({ status: OBSERVABILITY_STATUS.HOLD_INCIDENT_RESPONSE, plan, authorization: auth, metrics, alert, incident });
    }

    return makeResult({
      status: OBSERVABILITY_STATUS.OBSERVABILITY_INCIDENT_EVIDENCE_COMPLETE_NOT_PRODUCTION_CERTIFIED,
      plan,
      authorization: auth,
      metrics,
      alert,
      incident,
    });
  };
}

module.exports = {
  OBSERVABILITY_STATUS,
  AUTHORITY,
  createControlledObservabilityIncidentQualification,
};
