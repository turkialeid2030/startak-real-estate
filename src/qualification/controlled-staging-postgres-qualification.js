'use strict';

const crypto = require('crypto');
const {
  MIGRATION_STATUS,
  runControlledCanonicalWorkspaceMigration,
} = require('../storage/controlled-postgres-migration-runner');
const {
  RLS_PROBE_STATUS,
  runPostgresRuntimeRlsProbe,
} = require('../security/postgres-runtime-rls-probe');
const {
  VERIFICATION_STATUS,
  evaluateRuntimeRlsVerification,
} = require('../security/runtime-rls-verification');

const STAGING_QUALIFICATION_STATUS = Object.freeze({
  DRY_RUN_READY: 'DRY_RUN_READY',
  HOLD_MIGRATION: 'HOLD_MIGRATION',
  HOLD_RUNTIME_RLS: 'HOLD_RUNTIME_RLS',
  HOLD_PRIVILEGED_PATH_EVIDENCE: 'HOLD_PRIVILEGED_PATH_EVIDENCE',
  STAGING_EVIDENCE_COMPLETE_NOT_PRODUCTION_CERTIFIED: 'STAGING_EVIDENCE_COMPLETE_NOT_PRODUCTION_CERTIFIED',
});

const AUTHORITY = Object.freeze({
  releaseAuthorized: false,
  mergeAuthorized: false,
  deploymentAuthorized: false,
  goLiveAuthorized: false,
  transactionAuthorized: false,
  productionPersistenceValidated: false,
  productionSecurityValidated: false,
});

const ALLOWED_ENVIRONMENTS = Object.freeze(['staging', 'preproduction']);

function requiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}

function normalizeEnvironment(value) {
  const normalized = requiredString(value, 'environment').toLowerCase();
  if (!ALLOWED_ENVIRONMENTS.includes(normalized)) {
    throw new TypeError(`environment must be one of: ${ALLOWED_ENVIRONMENTS.join(', ')}`);
  }
  return normalized;
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) freeze(child);
  return value;
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function normalizePrivilegedPathEvidence(value, { environment, targetDatabaseRef, runtimeRole }) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const evidenceRef = typeof value.evidenceRef === 'string' ? value.evidenceRef.trim() : '';
  const testedAt = typeof value.testedAt === 'string' ? value.testedAt.trim() : '';
  const reviewedBy = typeof value.reviewedBy === 'string' ? value.reviewedBy.trim() : '';
  const evidenceEnvironment = typeof value.environment === 'string' ? value.environment.trim().toLowerCase() : '';
  const evidenceTarget = typeof value.targetDatabaseRef === 'string' ? value.targetDatabaseRef.trim() : '';
  const evidenceRuntimeRole = typeof value.runtimeRole === 'string' ? value.runtimeRole.trim() : '';
  const accepted = Boolean(
    value.status === 'PASS'
    && value.ownerOrAdminPathTested === true
    && evidenceRef
    && testedAt
    && reviewedBy
    && evidenceEnvironment === environment
    && evidenceTarget === targetDatabaseRef
    && evidenceRuntimeRole === runtimeRole,
  );
  return Object.freeze({
    accepted,
    evidenceRef: accepted ? evidenceRef : null,
    testedAt: accepted ? testedAt : null,
    reviewedBy: accepted ? reviewedBy : null,
    status: accepted ? 'PASS' : 'REJECTED_OR_INCOMPLETE',
  });
}

function buildBundle({ environment, targetDatabaseRef, migrationResult, rlsProbeResult, privilegedPathEvidence, verification }) {
  const bundleCore = {
    schemaVersion: 1,
    environment,
    targetDatabaseRef,
    migrationPlanRef: migrationResult?.plan?.planHashSha256
      ? `sha256:${migrationResult.plan.planHashSha256}`
      : null,
    rlsProbeRef: rlsProbeResult?.evidenceRef || null,
    privilegedPathEvidenceRef: privilegedPathEvidence?.evidenceRef || null,
    runtimeRlsVerificationStatus: verification?.status || null,
  };
  return freeze({
    ...bundleCore,
    bundleHashSha256: sha256(JSON.stringify(bundleCore)),
  });
}

function result({ status, environment, targetDatabaseRef, migration, rlsProbe, privilegedPathEvidence, runtimeRlsVerification }) {
  const evidenceBundle = buildBundle({
    environment,
    targetDatabaseRef,
    migrationResult: migration,
    rlsProbeResult: rlsProbe,
    privilegedPathEvidence,
    verification: runtimeRlsVerification,
  });
  return freeze({
    schemaVersion: 1,
    status,
    environment,
    targetDatabaseRef,
    migration,
    rlsProbe,
    privilegedPathEvidence,
    runtimeRlsVerification,
    evidenceBundle,
    productionQualified: false,
    authority: AUTHORITY,
    semantics: 'This staging/preproduction orchestrator can compose the controlled migration runner, runtime PostgreSQL RLS probe, and deterministic RLS evidence evaluator. It does not validate external privileged-path evidence authenticity, certify production security or persistence, or authorize release, merge, deployment, go-live, or transactions.',
  });
}

function createControlledStagingPostgresQualification({
  migrationRunner = runControlledCanonicalWorkspaceMigration,
  rlsProbeRunner = runPostgresRuntimeRlsProbe,
  rlsEvaluator = evaluateRuntimeRlsVerification,
} = {}) {
  if (typeof migrationRunner !== 'function') throw new TypeError('migrationRunner must be a function');
  if (typeof rlsProbeRunner !== 'function') throw new TypeError('rlsProbeRunner must be a function');
  if (typeof rlsEvaluator !== 'function') throw new TypeError('rlsEvaluator must be a function');

  return async function qualify({
    migrationPool,
    runtimePool,
    environment,
    targetDatabaseRef,
    expectedDatabaseName,
    expectedMigrationRole,
    runtimeRole,
    authorization,
    execute = false,
    probeRunId,
    testedAt = new Date().toISOString(),
    privilegedPathEvidence,
    schemaName = 'public',
    tableName = 'canonical_workspaces',
    tenantSetting = 'app.tenant_id',
  } = {}) {
    const env = normalizeEnvironment(environment);
    const databaseRef = requiredString(targetDatabaseRef, 'targetDatabaseRef');
    const normalizedRuntimeRole = requiredString(runtimeRole, 'runtimeRole');
    const timestamp = requiredString(testedAt, 'testedAt');

    const migration = await migrationRunner({
      migrationPool,
      environment: env,
      targetDatabaseRef: databaseRef,
      expectedDatabaseName,
      expectedMigrationRole,
      runtimeRole: normalizedRuntimeRole,
      authorization,
      execute: execute === true,
      schemaName,
      tableName,
      tenantSetting,
    });

    if (execute !== true) {
      return result({
        status: STAGING_QUALIFICATION_STATUS.DRY_RUN_READY,
        environment: env,
        targetDatabaseRef: databaseRef,
        migration,
        rlsProbe: null,
        privilegedPathEvidence: null,
        runtimeRlsVerification: null,
      });
    }

    if (!migration || migration.status !== MIGRATION_STATUS.APPLIED_NOT_PRODUCTION_CERTIFIED) {
      return result({
        status: STAGING_QUALIFICATION_STATUS.HOLD_MIGRATION,
        environment: env,
        targetDatabaseRef: databaseRef,
        migration: migration || null,
        rlsProbe: null,
        privilegedPathEvidence: null,
        runtimeRlsVerification: null,
      });
    }

    if (!runtimePool || typeof runtimePool.connect !== 'function') {
      throw new TypeError('runtimePool.connect is required after successful migration execution');
    }

    const rlsProbe = await rlsProbeRunner({
      pool: runtimePool,
      expectedRuntimeRole: normalizedRuntimeRole,
      environment: env,
      targetDatabaseRef: databaseRef,
      probeRunId,
      testedAt: timestamp,
      schemaName,
      tableName,
      tenantSetting,
    });

    if (!rlsProbe || rlsProbe.status !== RLS_PROBE_STATUS.PASS_NOT_PRODUCTION_CERTIFIED) {
      return result({
        status: STAGING_QUALIFICATION_STATUS.HOLD_RUNTIME_RLS,
        environment: env,
        targetDatabaseRef: databaseRef,
        migration,
        rlsProbe: rlsProbe || null,
        privilegedPathEvidence: null,
        runtimeRlsVerification: null,
      });
    }

    const privileged = normalizePrivilegedPathEvidence(privilegedPathEvidence, {
      environment: env,
      targetDatabaseRef: databaseRef,
      runtimeRole: normalizedRuntimeRole,
    });

    const checks = {
      runtimeRoleIsSuperuser: rlsProbe.checks?.runtimeRoleIsSuperuser === true,
      runtimeRoleBypassesRls: rlsProbe.checks?.runtimeRoleBypassesRls === true,
      forceRlsEnabled: rlsProbe.checks?.forceRlsEnabled === true,
      sameTenantCrudAllowed: rlsProbe.checks?.sameTenantCrudAllowed === true,
      crossTenantCrudDenied: rlsProbe.checks?.crossTenantCrudDenied === true,
      missingTenantContextDenied: rlsProbe.checks?.missingTenantContextDenied === true,
      tenantContextResetBetweenRequests: rlsProbe.checks?.tenantContextResetBetweenRequests === true,
      privilegedPathSeparatelyTested: privileged?.accepted === true,
    };

    const evidenceRefs = [
      `sha256:${migration.plan.planHashSha256}`,
      rlsProbe.evidenceRef,
    ];
    if (privileged?.evidenceRef) evidenceRefs.push(privileged.evidenceRef);

    const runtimeRlsVerification = rlsEvaluator({
      testedAt: timestamp,
      environment: env,
      targetDatabaseRef: databaseRef,
      evidenceRefs,
      checks,
    });

    const status = runtimeRlsVerification?.status === VERIFICATION_STATUS.VERIFICATION_EVIDENCE_COMPLETE
      ? STAGING_QUALIFICATION_STATUS.STAGING_EVIDENCE_COMPLETE_NOT_PRODUCTION_CERTIFIED
      : STAGING_QUALIFICATION_STATUS.HOLD_PRIVILEGED_PATH_EVIDENCE;

    return result({
      status,
      environment: env,
      targetDatabaseRef: databaseRef,
      migration,
      rlsProbe,
      privilegedPathEvidence: privileged,
      runtimeRlsVerification,
    });
  };
}

const runControlledStagingPostgresQualification = createControlledStagingPostgresQualification();

module.exports = {
  STAGING_QUALIFICATION_STATUS,
  AUTHORITY,
  ALLOWED_ENVIRONMENTS,
  createControlledStagingPostgresQualification,
  runControlledStagingPostgresQualification,
};
