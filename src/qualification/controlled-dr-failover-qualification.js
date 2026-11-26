'use strict';

const crypto = require('crypto');
const {
  BACKUP_RESTORE_STATUS,
} = require('./controlled-backup-restore-qualification');
const {
  QUALIFICATION_ENVIRONMENT,
  RESILIENCE_SCENARIO,
  PERFORMANCE_STATUS,
  createResilienceEvidence,
} = require('./performance-resilience-qualification');

const DR_FAILOVER_STATUS = Object.freeze({
  DRY_RUN_READY: 'DRY_RUN_READY',
  HOLD_BACKUP_RESTORE_QUALIFICATION: 'HOLD_BACKUP_RESTORE_QUALIFICATION',
  HOLD_AUTHORIZATION: 'HOLD_AUTHORIZATION',
  HOLD_PREFLIGHT: 'HOLD_PREFLIGHT',
  HOLD_FAILOVER: 'HOLD_FAILOVER',
  HOLD_FAILOVER_VERIFICATION: 'HOLD_FAILOVER_VERIFICATION',
  HOLD_FAILBACK: 'HOLD_FAILBACK',
  HOLD_FAILBACK_VERIFICATION: 'HOLD_FAILBACK_VERIFICATION',
  HOLD_RECOVERY_OBJECTIVE: 'HOLD_RECOVERY_OBJECTIVE',
  DR_FAILOVER_EVIDENCE_COMPLETE_NOT_PRODUCTION_CERTIFIED: 'DR_FAILOVER_EVIDENCE_COMPLETE_NOT_PRODUCTION_CERTIFIED',
});

const AUTHORITY = Object.freeze({
  releaseAuthorized: false,
  mergeAuthorized: false,
  deploymentAuthorized: false,
  goLiveAuthorized: false,
  transactionAuthorized: false,
  productionPersistenceValidated: false,
  productionSecurityValidated: false,
  productionResilienceValidated: false,
});

const SHA256_RE = /^[a-f0-9]{64}$/i;
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

function requiredSha256(value, field) {
  const normalized = requiredString(value, field).toLowerCase();
  if (!SHA256_RE.test(normalized)) throw new TypeError(`${field} must be a SHA-256 hex digest`);
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

function nonNegativeInteger(value, field) {
  if (!Number.isInteger(value) || value < 0) throw new TypeError(`${field} must be a non-negative integer`);
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

function normalizeEnvironment(value) {
  const normalized = requiredString(value, 'environment').toLowerCase();
  if (normalized !== 'staging') throw new TypeError('environment must be staging');
  return normalized;
}

function normalizeObjectives(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('recoveryObjectives must be an object');
  return freeze({
    maximumRecoveryTimeSeconds: nonNegativeNumber(value.maximumRecoveryTimeSeconds, 'recoveryObjectives.maximumRecoveryTimeSeconds'),
    maximumDataLossSeconds: nonNegativeNumber(value.maximumDataLossSeconds, 'recoveryObjectives.maximumDataLossSeconds'),
    objectiveSourceRef: requiredString(value.objectiveSourceRef, 'recoveryObjectives.objectiveSourceRef'),
  });
}

function normalizeAuthorization(value, target) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const normalized = {
    approved: value.approved === true,
    allowFailover: value.allowFailover === true,
    allowFailback: value.allowFailback === true,
    approvedBy: typeof value.approvedBy === 'string' ? value.approvedBy.trim() : '',
    reviewedBy: typeof value.reviewedBy === 'string' ? value.reviewedBy.trim() : '',
    approvedAt: typeof value.approvedAt === 'string' ? value.approvedAt.trim() : '',
    changeControlRef: typeof value.changeControlRef === 'string' ? value.changeControlRef.trim() : '',
    environment: typeof value.environment === 'string' ? value.environment.trim().toLowerCase() : '',
    primaryDatabaseRef: typeof value.primaryDatabaseRef === 'string' ? value.primaryDatabaseRef.trim() : '',
    primaryDatabaseName: typeof value.primaryDatabaseName === 'string' ? value.primaryDatabaseName.trim() : '',
    standbyDatabaseRef: typeof value.standbyDatabaseRef === 'string' ? value.standbyDatabaseRef.trim() : '',
    standbyDatabaseName: typeof value.standbyDatabaseName === 'string' ? value.standbyDatabaseName.trim() : '',
  };
  let approvedAtValid = false;
  try { requiredTimestamp(normalized.approvedAt, 'authorization.approvedAt'); approvedAtValid = true; } catch (_) { approvedAtValid = false; }
  const accepted = Boolean(
    normalized.approved
    && normalized.allowFailover
    && normalized.allowFailback
    && normalized.approvedBy
    && normalized.reviewedBy
    && normalized.approvedBy !== normalized.reviewedBy
    && approvedAtValid
    && Date.parse(normalized.approvedAt)<=target.assessedAtMillis
    && normalized.changeControlRef
    && normalized.environment === target.environment
    && normalized.primaryDatabaseRef === target.primaryDatabaseRef
    && normalized.primaryDatabaseName === target.primaryDatabaseName
    && normalized.standbyDatabaseRef === target.standbyDatabaseRef
    && normalized.standbyDatabaseName === target.standbyDatabaseName,
  );
  return freeze({
    accepted,
    approvedBy: accepted ? normalized.approvedBy : null,
    reviewedBy: accepted ? normalized.reviewedBy : null,
    approvedAt: accepted ? normalized.approvedAt : null,
    changeControlRef: accepted ? normalized.changeControlRef : null,
  });
}

function normalizePreflightResult(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('preflightExecutor result must be an object');
  const primaryLatest = requiredTimestamp(value.latestPrimaryDataAt, 'preflight.latestPrimaryDataAt');
  const standbyLatest = requiredTimestamp(value.latestStandbyDataAt, 'preflight.latestStandbyDataAt');
  return freeze({
    primaryHealthy: value.primaryHealthy === true,
    standbyReachable: value.standbyReachable === true,
    replicationHealthy: value.replicationHealthy === true,
    replicationLagSeconds: nonNegativeNumber(value.replicationLagSeconds, 'preflight.replicationLagSeconds'),
    latestPrimaryDataAt: primaryLatest.value,
    latestStandbyDataAt: standbyLatest.value,
    ready: value.primaryHealthy === true && value.standbyReachable === true && value.replicationHealthy === true,
  });
}

function normalizeTransitionResult(value, field, expectedRef, expectedName) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${field} result must be an object`);
  const started = requiredTimestamp(value.startedAt, `${field}.startedAt`);
  const finished = requiredTimestamp(value.finishedAt, `${field}.finishedAt`);
  if (finished.millis < started.millis) throw new TypeError(`${field}.finishedAt must be on or after ${field}.startedAt`);
  const activeDatabaseRef = requiredString(value.activeDatabaseRef, `${field}.activeDatabaseRef`);
  const activeDatabaseName = requiredString(value.activeDatabaseName, `${field}.activeDatabaseName`);
  return freeze({
    startedAt: started.value,
    finishedAt: finished.value,
    activeDatabaseRef,
    activeDatabaseName,
    expectedTargetActivated: activeDatabaseRef === expectedRef && activeDatabaseName === expectedName,
  });
}

function normalizeVerificationResult(value, field, expectedRef, expectedName) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${field} result must be an object`);
  const observed = requiredTimestamp(value.observedAt, `${field}.observedAt`);
  const latestPrimary = requiredTimestamp(value.latestPrimaryDataAt, `${field}.latestPrimaryDataAt`);
  const latestActive = requiredTimestamp(value.latestActiveDataAt, `${field}.latestActiveDataAt`);
  if(latestPrimary.millis>observed.millis||latestActive.millis>observed.millis)throw new TypeError(`${field} data timestamps must not follow observation`);
  for (const flag of ['duplicateSideEffectsObserved', 'unreconciledDataCorruptionObserved']) {
    if (typeof value[flag] !== 'boolean') throw new TypeError(`${field}.${flag} must be an explicit boolean`);
  }
  const sourceCount = nonNegativeInteger(value.sourceRecordCount, `${field}.sourceRecordCount`);
  const activeCount = nonNegativeInteger(value.activeRecordCount, `${field}.activeRecordCount`);
  const sourceFingerprint = requiredSha256(value.sourceFingerprintSha256, `${field}.sourceFingerprintSha256`);
  const activeFingerprint = requiredSha256(value.activeFingerprintSha256, `${field}.activeFingerprintSha256`);
  const activeDatabaseRef = requiredString(value.activeDatabaseRef, `${field}.activeDatabaseRef`);
  const activeDatabaseName = requiredString(value.activeDatabaseName, `${field}.activeDatabaseName`);
  return freeze({
    observedAt: observed.value,
    latestPrimaryDataAt: latestPrimary.value,
    latestActiveDataAt: latestActive.value,
    activeDatabaseRef,
    activeDatabaseName,
    expectedTargetActive: activeDatabaseRef === expectedRef && activeDatabaseName === expectedName,
    readPathHealthy: value.readPathHealthy === true,
    writePathHealthy: value.writePathHealthy === true,
    sourceRecordCount: sourceCount,
    activeRecordCount: activeCount,
    recordCountsMatch: sourceCount === activeCount,
    sourceFingerprintSha256: sourceFingerprint,
    activeFingerprintSha256: activeFingerprint,
    fingerprintsMatch: sourceFingerprint === activeFingerprint,
    duplicateSideEffectsObserved: value.duplicateSideEffectsObserved === true,
    unreconciledDataCorruptionObserved: value.unreconciledDataCorruptionObserved === true,
  });
}

function makeResult({ status, plan, authorization, preflight, failover, failoverVerification, failback, failbackVerification, resilienceEvidence }) {
  const executionCore = {
    schemaVersion: 1,
    status,
    planHashSha256: plan.planHashSha256,
    backupRestoreQualificationRef: plan.backupRestoreQualificationRef,
    authorizationAccepted: authorization?.accepted === true,
    preflightReady: preflight?.ready === true && status !== DR_FAILOVER_STATUS.HOLD_PREFLIGHT,
    failoverTargetActivated: failover?.expectedTargetActivated === true && status !== DR_FAILOVER_STATUS.HOLD_FAILOVER,
    failoverVerified: failoverVerification && status !== DR_FAILOVER_STATUS.HOLD_FAILOVER_VERIFICATION ? Boolean(
      failoverVerification.expectedTargetActive
      && failoverVerification.readPathHealthy
      && failoverVerification.writePathHealthy
      && failoverVerification.recordCountsMatch
      && failoverVerification.fingerprintsMatch
      && !failoverVerification.unreconciledDataCorruptionObserved
    ) : false,
    failbackTargetActivated: failback?.expectedTargetActivated === true && status !== DR_FAILOVER_STATUS.HOLD_FAILBACK,
    failbackVerified: failbackVerification && status !== DR_FAILOVER_STATUS.HOLD_FAILBACK_VERIFICATION ? Boolean(
      failbackVerification.expectedTargetActive
      && failbackVerification.readPathHealthy
      && failbackVerification.writePathHealthy
      && failbackVerification.recordCountsMatch
      && failbackVerification.fingerprintsMatch
      && !failbackVerification.unreconciledDataCorruptionObserved
    ) : false,
    resilienceEvidenceRef: resilienceEvidence ? `sha256:${resilienceEvidence.resilienceEvidenceHashSha256}` : null,
    // Bind sanitized stage observations even when execution stops before resilience evidence exists.
    stageEvidenceHashSha256: sha256Object({
      authorization: authorization || null,
      preflight: preflight || null,
      failover: failover || null,
      failoverVerification: failoverVerification || null,
      failback: failback || null,
      failbackVerification: failbackVerification || null,
    }),
  };
  const executionHashSha256 = sha256Object(executionCore);
  return freeze({
    ...executionCore,
    plan,
    authorization: authorization || null,
    preflight: preflight || null,
    failover: failover || null,
    failoverVerification: failoverVerification || null,
    failback: failback || null,
    failbackVerification: failbackVerification || null,
    resilienceEvidence: resilienceEvidence || null,
    executionHashSha256,
    evidenceRef: `sha256:${executionHashSha256}`,
    productionQualified: false,
    authority: AUTHORITY,
    semantics: 'This staging-only runner orchestrates host-injected DR preflight, database failover, failover verification, failback, and failback verification. It can produce DATABASE_UNAVAILABLE resilience evidence against caller-supplied RTO/RPO objectives. It does not contain infrastructure credentials, implement provider failover itself, certify production resilience, or authorize release, merge, deployment, go-live, or transactions.',
  });
}

function createControlledDrFailoverQualification({
  preflightExecutor,
  failoverExecutor,
  verificationExecutor,
  failbackExecutor,
} = {}) {
  return async function qualify({
    backupRestoreQualification,
    environment,
    primaryDatabaseRef,
    primaryDatabaseName,
    standbyDatabaseRef,
    standbyDatabaseName,
    exactCommitSha,
    recoveryObjectives,
    authorization,
    execute = false,
    drillId = 'p17-dr-failover',
    assessedAt,
  } = {}) {
    const env = normalizeEnvironment(environment);
    const primaryRef = requiredString(primaryDatabaseRef, 'primaryDatabaseRef');
    const primaryName = requiredString(primaryDatabaseName, 'primaryDatabaseName');
    const standbyRef = requiredString(standbyDatabaseRef, 'standbyDatabaseRef');
    const standbyName = requiredString(standbyDatabaseName, 'standbyDatabaseName');
    if (primaryRef === standbyRef || primaryName === standbyName) throw new TypeError('standby database must be distinct from primary database');
    const commitSha = requiredCommitSha(exactCommitSha);
    const objectives = normalizeObjectives(recoveryObjectives);
    const normalizedDrillId = requiredString(drillId, 'drillId');
    // An explicit assessment is a retrospective evidence cutoff. In live
    // adapter execution the cutoff must advance after each asynchronous stage.
    const retrospective = assessedAt !== undefined;
    const assessed = requiredTimestamp(retrospective ? assessedAt : new Date().toISOString(), 'assessedAt');
    const evidenceCutoff = () => retrospective ? assessed.millis : Date.now();

    const backupRestoreComplete = Boolean(
      backupRestoreQualification
      && backupRestoreQualification.status === BACKUP_RESTORE_STATUS.BACKUP_RESTORE_EVIDENCE_COMPLETE_NOT_PRODUCTION_CERTIFIED
      && typeof backupRestoreQualification.bundleHashSha256==='string'
      && /^[a-f0-9]{64}$/i.test(backupRestoreQualification.bundleHashSha256)
      && backupRestoreQualification.plan?.environment === env
      && backupRestoreQualification.plan?.sourceDatabaseRef === primaryRef
      && backupRestoreQualification.plan?.sourceDatabaseName === primaryName
      && backupRestoreQualification.plan?.exactCommitSha === commitSha
      && backupRestoreQualification.productionQualified === false
      && backupRestoreQualification.authority?.releaseAuthorized === false,
    );
    const backupRestoreQualificationRef = backupRestoreComplete
      ? `sha256:${backupRestoreQualification.bundleHashSha256.toLowerCase()}`
      : null;

    const planCore = {
      schemaVersion: 1,
      environment: env,
      primaryDatabaseRef: primaryRef,
      primaryDatabaseName: primaryName,
      standbyDatabaseRef: standbyRef,
      standbyDatabaseName: standbyName,
      exactCommitSha: commitSha,
      assessedAt: assessed.value,
      assessmentMode: retrospective ? 'RETROSPECTIVE_CUTOFF' : 'LIVE_CLOCK',
      drillId: normalizedDrillId,
      recoveryObjectives: objectives,
      backupRestoreQualificationRef,
      executionOrder: ['preflight', 'failover', 'failoverVerification', 'failback', 'failbackVerification', 'resilienceEvidence'],
    };
    const plan = freeze({ ...planCore, planHashSha256: sha256Object(planCore) });

    if (!backupRestoreComplete) {
      return makeResult({ status: DR_FAILOVER_STATUS.HOLD_BACKUP_RESTORE_QUALIFICATION, plan });
    }
    if (execute !== true) {
      return makeResult({ status: DR_FAILOVER_STATUS.DRY_RUN_READY, plan });
    }

    const target = {
      environment: env,
      primaryDatabaseRef: primaryRef,
      primaryDatabaseName: primaryName,
      standbyDatabaseRef: standbyRef,
      standbyDatabaseName: standbyName,
      assessedAtMillis: assessed.millis,
    };
    const auth = normalizeAuthorization(authorization, target);
    if (!auth?.accepted) {
      return makeResult({ status: DR_FAILOVER_STATUS.HOLD_AUTHORIZATION, plan, authorization: auth });
    }

    if (typeof preflightExecutor !== 'function') throw new TypeError('preflightExecutor must be a function when execute=true');
    if (typeof failoverExecutor !== 'function') throw new TypeError('failoverExecutor must be a function when execute=true');
    if (typeof verificationExecutor !== 'function') throw new TypeError('verificationExecutor must be a function when execute=true');
    if (typeof failbackExecutor !== 'function') throw new TypeError('failbackExecutor must be a function when execute=true');

    let preflight;
    try {
      preflight = normalizePreflightResult(await preflightExecutor({
        environment: env,
        primaryDatabaseRef: primaryRef,
        primaryDatabaseName: primaryName,
        standbyDatabaseRef: standbyRef,
        standbyDatabaseName: standbyName,
        planHashSha256: plan.planHashSha256,
      }));
    } catch (_) {
      return makeResult({ status: DR_FAILOVER_STATUS.HOLD_PREFLIGHT, plan, authorization: auth });
    }
    if (!preflight.ready || Date.parse(preflight.latestPrimaryDataAt)>evidenceCutoff() || Date.parse(preflight.latestStandbyDataAt)>evidenceCutoff()) {
      return makeResult({ status: DR_FAILOVER_STATUS.HOLD_PREFLIGHT, plan, authorization: auth, preflight });
    }

    let failover;
    try {
      failover = normalizeTransitionResult(await failoverExecutor({
        environment: env,
        fromDatabaseRef: primaryRef,
        fromDatabaseName: primaryName,
        toDatabaseRef: standbyRef,
        toDatabaseName: standbyName,
        planHashSha256: plan.planHashSha256,
      }), 'failover', standbyRef, standbyName);
    } catch (_) {
      return makeResult({ status: DR_FAILOVER_STATUS.HOLD_FAILOVER, plan, authorization: auth, preflight });
    }
    if (!failover.expectedTargetActivated || Date.parse(failover.startedAt)<Math.max(Date.parse(auth.approvedAt),Date.parse(preflight.latestPrimaryDataAt),Date.parse(preflight.latestStandbyDataAt)) || Date.parse(failover.finishedAt)>evidenceCutoff()) {
      return makeResult({ status: DR_FAILOVER_STATUS.HOLD_FAILOVER, plan, authorization: auth, preflight, failover });
    }

    let failoverVerification;
    try {
      failoverVerification = normalizeVerificationResult(await verificationExecutor({
        phase: 'failover',
        environment: env,
        primaryDatabaseRef: primaryRef,
        activeDatabaseRef: standbyRef,
        activeDatabaseName: standbyName,
        planHashSha256: plan.planHashSha256,
      }), 'failoverVerification', standbyRef, standbyName);
    } catch (_) {
      return makeResult({ status: DR_FAILOVER_STATUS.HOLD_FAILOVER_VERIFICATION, plan, authorization: auth, preflight, failover });
    }

    const failoverIntegrityPass = Boolean(
      failoverVerification.expectedTargetActive
      && failoverVerification.readPathHealthy
      && failoverVerification.writePathHealthy
      && failoverVerification.recordCountsMatch
      && failoverVerification.fingerprintsMatch
      && !failoverVerification.unreconciledDataCorruptionObserved,
    );
    if (!failoverIntegrityPass || Date.parse(failoverVerification.observedAt)<Date.parse(failover.finishedAt) || Date.parse(failoverVerification.observedAt)>evidenceCutoff()) {
      return makeResult({ status: DR_FAILOVER_STATUS.HOLD_FAILOVER_VERIFICATION, plan, authorization: auth, preflight, failover, failoverVerification });
    }

    let failback;
    try {
      failback = normalizeTransitionResult(await failbackExecutor({
        environment: env,
        fromDatabaseRef: standbyRef,
        fromDatabaseName: standbyName,
        toDatabaseRef: primaryRef,
        toDatabaseName: primaryName,
        planHashSha256: plan.planHashSha256,
      }), 'failback', primaryRef, primaryName);
    } catch (_) {
      return makeResult({ status: DR_FAILOVER_STATUS.HOLD_FAILBACK, plan, authorization: auth, preflight, failover, failoverVerification });
    }
    if (!failback.expectedTargetActivated || Date.parse(failback.startedAt)<Date.parse(failoverVerification.observedAt) || Date.parse(failback.finishedAt)>evidenceCutoff()) {
      return makeResult({ status: DR_FAILOVER_STATUS.HOLD_FAILBACK, plan, authorization: auth, preflight, failover, failoverVerification, failback });
    }

    let failbackVerification;
    try {
      failbackVerification = normalizeVerificationResult(await verificationExecutor({
        phase: 'failback',
        environment: env,
        primaryDatabaseRef: primaryRef,
        activeDatabaseRef: primaryRef,
        activeDatabaseName: primaryName,
        planHashSha256: plan.planHashSha256,
      }), 'failbackVerification', primaryRef, primaryName);
    } catch (_) {
      return makeResult({ status: DR_FAILOVER_STATUS.HOLD_FAILBACK_VERIFICATION, plan, authorization: auth, preflight, failover, failoverVerification, failback });
    }

    const failbackIntegrityPass = Boolean(
      failbackVerification.expectedTargetActive
      && failbackVerification.readPathHealthy
      && failbackVerification.writePathHealthy
      && failbackVerification.recordCountsMatch
      && failbackVerification.fingerprintsMatch
      && !failbackVerification.unreconciledDataCorruptionObserved,
    );
    if (!failbackIntegrityPass || Date.parse(failbackVerification.observedAt)<Date.parse(failback.finishedAt) || Date.parse(failbackVerification.observedAt)>evidenceCutoff()) {
      return makeResult({ status: DR_FAILOVER_STATUS.HOLD_FAILBACK_VERIFICATION, plan, authorization: auth, preflight, failover, failoverVerification, failback, failbackVerification });
    }

    const failoverStarted = requiredTimestamp(failover.startedAt, 'failover.startedAt');
    const failoverVerifiedAt = requiredTimestamp(failoverVerification.observedAt, 'failoverVerification.observedAt');
    const latestPrimary = requiredTimestamp(failoverVerification.latestPrimaryDataAt, 'failoverVerification.latestPrimaryDataAt');
    const latestActive = requiredTimestamp(failoverVerification.latestActiveDataAt, 'failoverVerification.latestActiveDataAt');
    const failbackStarted = requiredTimestamp(failback.startedAt,'failback.startedAt');
    const failbackVerifiedAt = requiredTimestamp(failbackVerification.observedAt,'failbackVerification.observedAt');
    // Conservative qualification objective: the slower of the two transitions.
    const observedRecoveryTimeSeconds = Math.max(failoverVerifiedAt.millis-failoverStarted.millis,failbackVerifiedAt.millis-failbackStarted.millis)/1000;
    const observedDataLossSeconds = Math.max(0, (latestPrimary.millis - latestActive.millis) / 1000);
    const duplicateSideEffectsObserved = Boolean(
      failoverVerification.duplicateSideEffectsObserved || failbackVerification.duplicateSideEffectsObserved,
    );
    const unreconciledDataCorruptionObserved = Boolean(
      failoverVerification.unreconciledDataCorruptionObserved || failbackVerification.unreconciledDataCorruptionObserved,
    );

    const drillArtifactCore = {
      planHashSha256: plan.planHashSha256,
      preflight,
      failover,
      failoverVerification,
      failback,
      failbackVerification,
    };
    const drillArtifactHashSha256 = sha256Object(drillArtifactCore);

    const resilienceEvidence = createResilienceEvidence({
      resilienceEvidenceId: normalizedDrillId,
      scenario: RESILIENCE_SCENARIO.DATABASE_UNAVAILABLE,
      environment: QUALIFICATION_ENVIRONMENT.STAGING,
      exactCommitSha: commitSha,
      targetRef: `${primaryRef}->${standbyRef}->${primaryRef}`,
      maximumRecoveryTimeSeconds: objectives.maximumRecoveryTimeSeconds,
      observedRecoveryTimeSeconds,
      maximumDataLossSeconds: objectives.maximumDataLossSeconds,
      observedDataLossSeconds,
      duplicateSideEffectsObserved,
      unreconciledDataCorruptionObserved,
      objectiveSourceRef: objectives.objectiveSourceRef,
      sourceArtifactId: `dr-drill:${normalizedDrillId}`,
      sourceArtifactHashSha256: drillArtifactHashSha256,
      observedAt: failbackVerification.observedAt,
      preparedBy: auth.approvedBy,
      reviewedBy: auth.reviewedBy,
      reviewedAt: retrospective ? assessed.value : new Date().toISOString(),
      evidenceRefs: [
        `sha256:${plan.planHashSha256}`,
        backupRestoreQualificationRef,
        `sha256:${drillArtifactHashSha256}`,
      ],
    });

    const status = resilienceEvidence.status === PERFORMANCE_STATUS.PASS
      ? DR_FAILOVER_STATUS.DR_FAILOVER_EVIDENCE_COMPLETE_NOT_PRODUCTION_CERTIFIED
      : DR_FAILOVER_STATUS.HOLD_RECOVERY_OBJECTIVE;

    return makeResult({
      status,
      plan,
      authorization: auth,
      preflight,
      failover,
      failoverVerification,
      failback,
      failbackVerification,
      resilienceEvidence,
    });
  };
}

module.exports = {
  DR_FAILOVER_STATUS,
  AUTHORITY,
  createControlledDrFailoverQualification,
};
