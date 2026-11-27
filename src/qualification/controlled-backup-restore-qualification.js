'use strict';

const crypto = require('crypto');
const {
  API_SECURITY_STATUS,
  verifyCompletedStagingApiSecurityQualification,
} = require('./controlled-staging-api-security-qualification');
const {
  QUALIFICATION_ENVIRONMENT,
  RESILIENCE_SCENARIO,
  PERFORMANCE_STATUS,
  createResilienceEvidence,
} = require('./performance-resilience-qualification');

const BACKUP_RESTORE_STATUS = Object.freeze({
  DRY_RUN_READY: 'DRY_RUN_READY',
  HOLD_API_SECURITY_QUALIFICATION: 'HOLD_API_SECURITY_QUALIFICATION',
  HOLD_AUTHORIZATION: 'HOLD_AUTHORIZATION',
  HOLD_BACKUP: 'HOLD_BACKUP',
  HOLD_RESTORE: 'HOLD_RESTORE',
  HOLD_VERIFICATION: 'HOLD_VERIFICATION',
  HOLD_RECOVERY_OBJECTIVE: 'HOLD_RECOVERY_OBJECTIVE',
  BACKUP_RESTORE_EVIDENCE_COMPLETE_NOT_PRODUCTION_CERTIFIED: 'BACKUP_RESTORE_EVIDENCE_COMPLETE_NOT_PRODUCTION_CERTIFIED',
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

function requiredSha256(value, field) {
  const normalized = requiredString(value, field).toLowerCase();
  if (!SHA256_RE.test(normalized)) throw new TypeError(`${field} must be a SHA-256 hex digest`);
  return normalized;
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

function nonNegativeInteger(value, field) {
  if (!Number.isSafeInteger(value) || value < 0) throw new TypeError(`${field} must be a non-negative integer`);
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
    return Object.fromEntries(Object.keys(value).sort().filter(key=>value[key]!==undefined).map(key=>[key,canonicalize(value[key])]));
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
    allowBackup: value.allowBackup === true,
    allowRestore: value.allowRestore === true,
    approvedBy: typeof value.approvedBy === 'string' ? value.approvedBy.trim() : '',
    reviewedBy: typeof value.reviewedBy === 'string' ? value.reviewedBy.trim() : '',
    approvedAt: typeof value.approvedAt === 'string' ? value.approvedAt.trim() : '',
    changeControlRef: typeof value.changeControlRef === 'string' ? value.changeControlRef.trim() : '',
    environment: typeof value.environment === 'string' ? value.environment.trim().toLowerCase() : '',
    sourceDatabaseRef: typeof value.sourceDatabaseRef === 'string' ? value.sourceDatabaseRef.trim() : '',
    sourceDatabaseName: typeof value.sourceDatabaseName === 'string' ? value.sourceDatabaseName.trim() : '',
    restoreTargetDatabaseRef: typeof value.restoreTargetDatabaseRef === 'string' ? value.restoreTargetDatabaseRef.trim() : '',
    restoreTargetDatabaseName: typeof value.restoreTargetDatabaseName === 'string' ? value.restoreTargetDatabaseName.trim() : '',
  };
  let approvedAtValid = false;
  try { requiredTimestamp(normalized.approvedAt, 'authorization.approvedAt'); approvedAtValid = true; } catch (_) { approvedAtValid = false; }
  const accepted = Boolean(
    normalized.approved
    && normalized.allowBackup
    && normalized.allowRestore
    && normalized.approvedBy
    && normalized.reviewedBy
    && normalized.approvedBy !== normalized.reviewedBy
    && normalized.changeControlRef
    && approvedAtValid
    && Date.parse(normalized.approvedAt) <= target.assessedAtMillis
    && normalized.environment === target.environment
    && normalized.sourceDatabaseRef === target.sourceDatabaseRef
    && normalized.sourceDatabaseName === target.sourceDatabaseName
    && normalized.restoreTargetDatabaseRef === target.restoreTargetDatabaseRef
    && normalized.restoreTargetDatabaseName === target.restoreTargetDatabaseName,
  );
  return freeze({
    accepted,
    approvedBy: accepted ? normalized.approvedBy : null,
    reviewedBy: accepted ? normalized.reviewedBy : null,
    approvedAt: accepted ? normalized.approvedAt : null,
    changeControlRef: accepted ? normalized.changeControlRef : null,
  });
}

function normalizeBackupResult(value, sourceRef, sourceName) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('backupExecutor result must be an object');
  if(value.sourceDatabaseRef!==sourceRef || value.sourceDatabaseName!==sourceName)throw new TypeError('backup source identity mismatch');
  const started = requiredTimestamp(value.startedAt, 'backup.startedAt');
  const finished = requiredTimestamp(value.finishedAt, 'backup.finishedAt');
  const snapshot = requiredTimestamp(value.sourceSnapshotAt, 'backup.sourceSnapshotAt');
  if (finished.millis < started.millis) throw new TypeError('backup.finishedAt must be on or after backup.startedAt');
  if (snapshot.millis < started.millis || snapshot.millis > finished.millis) throw new TypeError('backup.sourceSnapshotAt must be within the backup interval');
  if (!Number.isSafeInteger(value.artifactSizeBytes) || value.artifactSizeBytes <= 0) throw new TypeError('backup.artifactSizeBytes must be a positive safe integer');
  return freeze({
    sourceDatabaseRef:sourceRef,
    sourceDatabaseName:sourceName,
    artifactId: requiredString(value.artifactId, 'backup.artifactId'),
    artifactHashSha256: requiredSha256(value.artifactHashSha256, 'backup.artifactHashSha256'),
    artifactSizeBytes: nonNegativeInteger(value.artifactSizeBytes, 'backup.artifactSizeBytes'),
    startedAt: started.value,
    finishedAt: finished.value,
    sourceSnapshotAt: snapshot.value,
  });
}

function normalizeRestoreResult(value, backup, restoreRef, restoreName) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('restoreExecutor result must be an object');
  if(value.restoreTargetDatabaseRef!==restoreRef || value.restoreTargetDatabaseName!==restoreName)throw new TypeError('restore target identity mismatch');
  const started = requiredTimestamp(value.startedAt, 'restore.startedAt');
  const finished = requiredTimestamp(value.finishedAt, 'restore.finishedAt');
  if (finished.millis < started.millis) throw new TypeError('restore.finishedAt must be on or after restore.startedAt');
  const restoredHash = requiredSha256(value.restoredArtifactHashSha256, 'restore.restoredArtifactHashSha256');
  return freeze({
    restoreTargetDatabaseRef:restoreRef,
    restoreTargetDatabaseName:restoreName,
    restoredArtifactHashSha256: restoredHash,
    artifactHashMatchesBackup: restoredHash === backup.artifactHashSha256,
    startedAt: started.value,
    finishedAt: finished.value,
  });
}

function normalizeVerificationResult(value, sourceRef, restoreRef) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('verificationExecutor result must be an object');
  if(value.sourceDatabaseRef!==sourceRef || value.restoreTargetDatabaseRef!==restoreRef)throw new TypeError('verification database identity mismatch');
  const observed = requiredTimestamp(value.observedAt,'verification.observedAt');
  const sourceLatest = requiredTimestamp(value.latestSourceDataAt, 'verification.latestSourceDataAt');
  const restoredLatest = requiredTimestamp(value.latestRestoredDataAt, 'verification.latestRestoredDataAt');
  if(sourceLatest.millis>observed.millis || restoredLatest.millis>observed.millis)throw new TypeError('verification data timestamp exceeds observation');
  for (const flag of ['duplicateSideEffectsObserved','unreconciledDataCorruptionObserved']) {
    if (typeof value[flag] !== 'boolean') throw new TypeError(`verification.${flag} must be an explicit boolean`);
  }
  const sourceCount = nonNegativeInteger(value.sourceRecordCount, 'verification.sourceRecordCount');
  const restoredCount = nonNegativeInteger(value.restoredRecordCount, 'verification.restoredRecordCount');
  const sourceFingerprint = requiredSha256(value.sourceFingerprintSha256, 'verification.sourceFingerprintSha256');
  const restoredFingerprint = requiredSha256(value.restoredFingerprintSha256, 'verification.restoredFingerprintSha256');
  return freeze({
    sourceDatabaseRef:sourceRef,
    restoreTargetDatabaseRef:restoreRef,
    observedAt:observed.value,
    sourceRecordCount: sourceCount,
    restoredRecordCount: restoredCount,
    recordCountsMatch: sourceCount === restoredCount,
    sourceFingerprintSha256: sourceFingerprint,
    restoredFingerprintSha256: restoredFingerprint,
    fingerprintsMatch: sourceFingerprint === restoredFingerprint,
    latestSourceDataAt: sourceLatest.value,
    latestRestoredDataAt: restoredLatest.value,
    duplicateSideEffectsObserved: value.duplicateSideEffectsObserved === true,
    unreconciledDataCorruptionObserved: value.unreconciledDataCorruptionObserved === true,
  });
}

function makeResult({ status, plan, authorization, backup, restore, verification, resilienceEvidence }) {
  const core = {
    schemaVersion: 1,
    status,
    planHashSha256: plan.planHashSha256,
    apiSecurityQualificationRef: plan.apiSecurityQualificationRef,
    authorizationAccepted: authorization?.accepted === true,
    backupArtifactRef: backup ? `sha256:${backup.artifactHashSha256}` : null,
    resilienceEvidenceRef: resilienceEvidence ? `sha256:${resilienceEvidence.resilienceEvidenceHashSha256}` : null,
    stageEvidenceHashSha256: sha256Object({authorization:authorization||null,backup:backup||null,restore:restore||null,verification:verification||null}),
  };
  return freeze({
    ...core,
    plan,
    authorization: authorization || null,
    backup: backup || null,
    restore: restore || null,
    verification: verification || null,
    resilienceEvidence: resilienceEvidence || null,
    bundleHashSha256: sha256Object(core),
    productionQualified: false,
    authority: AUTHORITY,
    semantics: 'This controlled staging runner orchestrates host-injected backup, isolated restore, and verification adapters and can produce a BACKUP_RESTORE resilience evidence record. It does not contain database credentials, implement pg_dump/restore itself, certify production resilience, establish an SLA, or authorize release, merge, deployment, go-live, or transactions.',
  });
}

function createControlledBackupRestoreQualification({
  backupExecutor,
  restoreExecutor,
  verificationExecutor,
} = {}) {
  return async function qualify({
    apiSecurityQualification,
    environment,
    sourceDatabaseRef,
    sourceDatabaseName,
    restoreTargetDatabaseRef,
    restoreTargetDatabaseName,
    exactCommitSha,
    recoveryObjectives,
    authorization,
    execute = false,
    evidenceId = 'p16-backup-restore',
    assessedAt,
  } = {}) {
    const env = normalizeEnvironment(environment);
    const sourceRef = requiredString(sourceDatabaseRef, 'sourceDatabaseRef');
    const sourceName = requiredString(sourceDatabaseName, 'sourceDatabaseName');
    const restoreRef = requiredString(restoreTargetDatabaseRef, 'restoreTargetDatabaseRef');
    const restoreName = requiredString(restoreTargetDatabaseName, 'restoreTargetDatabaseName');
    if (sourceRef === restoreRef || sourceName === restoreName) throw new TypeError('restore target must be isolated from the source database');
    const commitSha = requiredCommitSha(exactCommitSha);
    const objectives = normalizeObjectives(recoveryObjectives);
    // An explicit assessment is a retrospective evidence cutoff. In live
    // adapter execution the cutoff must advance after each asynchronous stage.
    const retrospective = assessedAt !== undefined;
    const assessed = requiredTimestamp(retrospective ? assessedAt : new Date().toISOString(), 'assessedAt');
    if (retrospective && assessed.millis > Date.now()) throw new TypeError('assessedAt must not be in the future');
    const evidenceCutoff = () => retrospective ? assessed.millis : Date.now();
    const normalizedEvidenceId = requiredString(evidenceId, 'evidenceId');

    const apiSecurityComplete = Boolean(
      apiSecurityQualification
      && apiSecurityQualification.status === API_SECURITY_STATUS.STAGING_API_SECURITY_EVIDENCE_COMPLETE_NOT_PRODUCTION_CERTIFIED
      && apiSecurityQualification.environment === env
      && apiSecurityQualification.targetDatabaseRef === sourceRef
      && typeof apiSecurityQualification.bundleHashSha256 === 'string'
      && SHA256_RE.test(apiSecurityQualification.bundleHashSha256)
      && apiSecurityQualification.productionQualified === false
      && verifyCompletedStagingApiSecurityQualification(apiSecurityQualification,assessed.value),
    );
    const apiSecurityQualificationRef = apiSecurityComplete
      ? `sha256:${apiSecurityQualification.bundleHashSha256.toLowerCase()}`
      : null;

    const planCore = {
      schemaVersion: 1,
      environment: env,
      sourceDatabaseRef: sourceRef,
      sourceDatabaseName: sourceName,
      restoreTargetDatabaseRef: restoreRef,
      restoreTargetDatabaseName: restoreName,
      exactCommitSha: commitSha,
      assessedAt: assessed.value,
      assessmentMode: retrospective ? 'RETROSPECTIVE_CUTOFF' : 'LIVE_CLOCK',
      evidenceId: normalizedEvidenceId,
      recoveryObjectives: objectives,
      apiSecurityQualificationRef,
      executionOrder: ['backup', 'isolatedRestore', 'dataVerification', 'resilienceEvidence'],
    };
    const plan = freeze({ ...planCore, planHashSha256: sha256Object(planCore) });

    if (!apiSecurityComplete) {
      return makeResult({ status: BACKUP_RESTORE_STATUS.HOLD_API_SECURITY_QUALIFICATION, plan });
    }

    if (execute !== true) {
      return makeResult({ status: BACKUP_RESTORE_STATUS.DRY_RUN_READY, plan });
    }

    const target = {
      environment: env,
      sourceDatabaseRef: sourceRef,
      sourceDatabaseName: sourceName,
      restoreTargetDatabaseRef: restoreRef,
      restoreTargetDatabaseName: restoreName,
      assessedAtMillis: assessed.millis,
    };
    const auth = normalizeAuthorization(authorization, target);
    if (!auth?.accepted) {
      return makeResult({ status: BACKUP_RESTORE_STATUS.HOLD_AUTHORIZATION, plan, authorization: auth });
    }

    if (typeof backupExecutor !== 'function') throw new TypeError('backupExecutor must be a function when execute=true');
    if (typeof restoreExecutor !== 'function') throw new TypeError('restoreExecutor must be a function when execute=true');
    if (typeof verificationExecutor !== 'function') throw new TypeError('verificationExecutor must be a function when execute=true');

    let backup;
    try {
      backup = normalizeBackupResult(await backupExecutor({
        environment: env,
        sourceDatabaseRef: sourceRef,
        sourceDatabaseName: sourceName,
        planHashSha256: plan.planHashSha256,
      }),sourceRef,sourceName);
    } catch (_) {
      return makeResult({ status: BACKUP_RESTORE_STATUS.HOLD_BACKUP, plan, authorization: auth });
    }

    if (Date.parse(backup.startedAt) < Math.max(Date.parse(auth.approvedAt),Date.parse(apiSecurityQualification.apiEvidence.testedAt),retrospective ? -Infinity : assessed.millis) || Date.parse(backup.finishedAt)>evidenceCutoff()) {
      return makeResult({ status: BACKUP_RESTORE_STATUS.HOLD_BACKUP, plan, authorization: auth, backup });
    }
    let restore;
    try {
      restore = normalizeRestoreResult(await restoreExecutor({
        environment: env,
        restoreTargetDatabaseRef: restoreRef,
        restoreTargetDatabaseName: restoreName,
        artifactId: backup.artifactId,
        artifactHashSha256: backup.artifactHashSha256,
        planHashSha256: plan.planHashSha256,
      }), backup,restoreRef,restoreName);
    } catch (_) {
      return makeResult({ status: BACKUP_RESTORE_STATUS.HOLD_RESTORE, plan, authorization: auth, backup });
    }
    if (!restore.artifactHashMatchesBackup || Date.parse(restore.startedAt) < Date.parse(backup.finishedAt) || Date.parse(restore.finishedAt)>evidenceCutoff()) {
      return makeResult({ status: BACKUP_RESTORE_STATUS.HOLD_RESTORE, plan, authorization: auth, backup, restore });
    }

    let verification;
    try {
      verification = normalizeVerificationResult(await verificationExecutor({
        environment: env,
        sourceDatabaseRef: sourceRef,
        restoreTargetDatabaseRef: restoreRef,
        backupArtifactId: backup.artifactId,
        planHashSha256: plan.planHashSha256,
      }),sourceRef,restoreRef);
    } catch (_) {
      return makeResult({ status: BACKUP_RESTORE_STATUS.HOLD_VERIFICATION, plan, authorization: auth, backup, restore });
    }

    const integrityPass = Boolean(
      Date.parse(verification.observedAt) >= Date.parse(restore.finishedAt)
      && Date.parse(verification.observedAt) <= evidenceCutoff()
      && Date.parse(verification.latestRestoredDataAt) <= Date.parse(backup.sourceSnapshotAt)
      && verification.recordCountsMatch
      && verification.fingerprintsMatch
      && !verification.unreconciledDataCorruptionObserved,
    );
    if (!integrityPass) {
      return makeResult({ status: BACKUP_RESTORE_STATUS.HOLD_VERIFICATION, plan, authorization: auth, backup, restore, verification });
    }

    const restoreStarted = requiredTimestamp(restore.startedAt, 'restore.startedAt');
    const verifiedAt = requiredTimestamp(verification.observedAt, 'verification.observedAt');
    const sourceLatest = requiredTimestamp(verification.latestSourceDataAt, 'verification.latestSourceDataAt');
    const restoredLatest = requiredTimestamp(verification.latestRestoredDataAt, 'verification.latestRestoredDataAt');
    const observedRecoveryTimeSeconds = (verifiedAt.millis - restoreStarted.millis) / 1000;
    const observedDataLossSeconds = Math.max(0, (sourceLatest.millis - restoredLatest.millis) / 1000);

    const resilienceEvidence = createResilienceEvidence({
      resilienceEvidenceId: normalizedEvidenceId,
      scenario: RESILIENCE_SCENARIO.BACKUP_RESTORE,
      environment: QUALIFICATION_ENVIRONMENT.STAGING,
      exactCommitSha: commitSha,
      targetRef: `${sourceRef}->${restoreRef}`,
      maximumRecoveryTimeSeconds: objectives.maximumRecoveryTimeSeconds,
      observedRecoveryTimeSeconds,
      maximumDataLossSeconds: objectives.maximumDataLossSeconds,
      observedDataLossSeconds,
      duplicateSideEffectsObserved: verification.duplicateSideEffectsObserved,
      unreconciledDataCorruptionObserved: verification.unreconciledDataCorruptionObserved,
      objectiveSourceRef: objectives.objectiveSourceRef,
      sourceArtifactId: backup.artifactId,
      sourceArtifactHashSha256: backup.artifactHashSha256,
      observedAt: verification.observedAt,
      preparedBy: auth.approvedBy,
      reviewedBy: auth.reviewedBy,
      reviewedAt: retrospective ? assessed.value : new Date().toISOString(),
      evidenceRefs: [
        `sha256:${plan.planHashSha256}`,
        apiSecurityQualificationRef,
        `sha256:${backup.artifactHashSha256}`,
      ],
    });

    const status = resilienceEvidence.status === PERFORMANCE_STATUS.PASS
      ? BACKUP_RESTORE_STATUS.BACKUP_RESTORE_EVIDENCE_COMPLETE_NOT_PRODUCTION_CERTIFIED
      : BACKUP_RESTORE_STATUS.HOLD_RECOVERY_OBJECTIVE;

    return makeResult({
      status,
      plan,
      authorization: auth,
      backup,
      restore,
      verification,
      resilienceEvidence,
    });
  };
}

module.exports = {
  BACKUP_RESTORE_STATUS,
  AUTHORITY,
  createControlledBackupRestoreQualification,
};
