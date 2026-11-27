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

const digest=v=>sha256(JSON.stringify(v));
const isDigest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const closedAuthority=v=>!!v&&Object.keys(v).length===Object.keys(AUTHORITY).length&&Object.keys(AUTHORITY).every(k=>Object.hasOwn(v,k)&&v[k]===false);
function digestFields(record,keys){return digest(Object.fromEntries(keys.map(k=>[k,record[k]])));}
const MIGRATION_PLAN_KEYS=['schemaVersion','environment','targetDatabaseRef','expectedDatabaseName','expectedMigrationRole','runtimeRole','schemaName','tableName','tenantSetting','schemaHashSha256','rlsHashSha256','executionOrder'];
const PROBE_CORE_KEYS=['schemaVersion','status','environment','targetDatabaseRef','probeRunId','probeInstanceId','testedAt','tableRef','runtimeRole','tenantSetting','checks'];
function normalizePrivilegedPathEvidence(value, { environment, targetDatabaseRef, runtimeRole, assessedAt }) {
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
    && Number.isFinite(Date.parse(testedAt))
    && Date.parse(testedAt) <= Date.parse(assessedAt)
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
    if (!Number.isFinite(Date.parse(timestamp))) throw new TypeError('testedAt must be a valid timestamp');
    if(Date.parse(timestamp)>Date.now())throw new TypeError('testedAt must not be in the future');
    if (execute === true && (!runtimePool || typeof runtimePool.connect !== 'function')) {
      throw new TypeError('runtimePool.connect is required before migration execution');
    }

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

    const migrationPlanValid = migration?.plan?.environment === env
      && migration?.plan?.targetDatabaseRef === databaseRef
      && migration?.plan?.expectedDatabaseName === expectedDatabaseName
      && migration?.plan?.runtimeRole === normalizedRuntimeRole
      && migration.schemaVersion===1 && migration.plan.schemaVersion===1
      && migration.plan.expectedMigrationRole===expectedMigrationRole
      && migration.plan.schemaName===schemaName&&migration.plan.tableName===tableName&&migration.plan.tenantSetting===tenantSetting
      && isDigest(migration.plan.schemaHashSha256)&&isDigest(migration.plan.rlsHashSha256)
      && Array.isArray(migration.plan.executionOrder)
      && isDigest(migration.plan.planHashSha256)&&digestFields(migration.plan,MIGRATION_PLAN_KEYS)===migration.plan.planHashSha256
      && migration.productionQualified === false
      && closedAuthority(migration.authority);
    if (execute !== true) {
      return result({
        status: migrationPlanValid && migration.status === MIGRATION_STATUS.DRY_RUN_READY
          ? STAGING_QUALIFICATION_STATUS.DRY_RUN_READY : STAGING_QUALIFICATION_STATUS.HOLD_MIGRATION,
        environment: env,
        targetDatabaseRef: databaseRef,
        migration,
        rlsProbe: null,
        privilegedPathEvidence: null,
        runtimeRlsVerification: null,
      });
    }

    const execution=migration?.execution;
    const committed=!!execution&&['mutationRequested','mutationExecuted','preflightPassed','schemaApplied','rlsApplied','postcheckPassed','mutationAttempted','transactionCommitted'].every(k=>execution[k]===true)&&execution.rollbackConfirmed===false&&execution.transactionOutcomeUnknown===false&&execution.actualDatabaseName===expectedDatabaseName&&execution.actualMigrationRole===expectedMigrationRole;
    if (!migrationPlanValid || migration.status !== MIGRATION_STATUS.APPLIED_NOT_PRODUCTION_CERTIFIED || !committed) {
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

    const rlsProbe = await rlsProbeRunner({
      pool: runtimePool,
      expectedRuntimeRole: normalizedRuntimeRole,
      expectedDatabaseName,
      environment: env,
      targetDatabaseRef: databaseRef,
      probeRunId,
      testedAt: timestamp,
      schemaName,
      tableName,
      tenantSetting,
    });

    const probeValid = rlsProbe?.status === RLS_PROBE_STATUS.PASS_NOT_PRODUCTION_CERTIFIED
      && rlsProbe.environment === env
      && rlsProbe.targetDatabaseRef === databaseRef
      && rlsProbe.runtimeRole === normalizedRuntimeRole
      && rlsProbe.testedAt === timestamp
      && rlsProbe.probeRunId === probeRunId
      && typeof rlsProbe.probeHashSha256 === 'string'
      && /^[a-f0-9]{64}$/i.test(rlsProbe.probeHashSha256)
      && rlsProbe.evidenceRef === `sha256:${rlsProbe.probeHashSha256}`
      && rlsProbe.productionSecurityVerifiedByThisModule === false
      && rlsProbe.schemaVersion===1&&rlsProbe.tableRef===`${schemaName}.${tableName}`&&rlsProbe.tenantSetting===tenantSetting
      && typeof rlsProbe.probeInstanceId==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(rlsProbe.probeInstanceId)
      && digestFields(rlsProbe,PROBE_CORE_KEYS)===rlsProbe.probeHashSha256
      && rlsProbe.mutationExecuted===true&&rlsProbe.requiresIndependentRuntimeEvidence===true&&rlsProbe.privilegedPathSeparatelyTested===false
      && closedAuthority(rlsProbe.authority)
      && rlsProbe.checks?.runtimeRoleMatchesExpected === true
      && rlsProbe.checks?.runtimeDatabaseMatchesExpected === true
      && rlsProbe.checks?.runtimeRoleIsSuperuser === false
      && rlsProbe.checks?.runtimeRoleBypassesRls === false
      && rlsProbe.checks?.cleanupComplete === true
      && ['forceRlsEnabled','sameTenantCrudAllowed','crossTenantCrudDenied','missingTenantContextDenied','tenantContextResetBetweenRequests'].every(k=>rlsProbe.checks[k]===true)
      && rlsProbe.checks.privilegedPathSeparatelyTested===false;
    if (!probeValid) {
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
      assessedAt: timestamp,
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

    const verified=runtimeRlsVerification?.status===VERIFICATION_STATUS.VERIFICATION_EVIDENCE_COMPLETE&&privileged?.accepted===true&&runtimeRlsVerification.productionSecurityVerifiedByThisModule===false&&runtimeRlsVerification.transactionAuthorized===false&&runtimeRlsVerification.environment===env&&runtimeRlsVerification.targetDatabaseRef===databaseRef&&runtimeRlsVerification.testedAt===timestamp&&Object.keys(checks).every(k=>runtimeRlsVerification.checks?.[k]===checks[k])&&JSON.stringify(runtimeRlsVerification.evidenceRefs)===JSON.stringify(evidenceRefs);
    const status = verified
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

// Recheck the completed handoff before any downstream API credential is sent.
// Recomputed hashes establish structural consistency, not external authenticity.
function verifyCompletedStagingPostgresQualification(value,asOf){
 try{
  if(value?.schemaVersion!==1||value.status!==STAGING_QUALIFICATION_STATUS.STAGING_EVIDENCE_COMPLETE_NOT_PRODUCTION_CERTIFIED||value.productionQualified!==false||!closedAuthority(value.authority))return false;
  const {environment,targetDatabaseRef,migration:m,rlsProbe:p,privilegedPathEvidence:priv,runtimeRlsVerification:v,evidenceBundle:b}=value;
  if(normalizeEnvironment(environment)!==environment||requiredString(targetDatabaseRef,'targetDatabaseRef')!==targetDatabaseRef)return false;
  const plan=m?.plan,e=m?.execution;
  if(m?.schemaVersion!==1||m.status!==MIGRATION_STATUS.APPLIED_NOT_PRODUCTION_CERTIFIED||m.productionQualified!==false||!closedAuthority(m.authority)||
     plan?.schemaVersion!==1||plan.environment!==environment||plan.targetDatabaseRef!==targetDatabaseRef||!isDigest(plan.schemaHashSha256)||!isDigest(plan.rlsHashSha256)||!isDigest(plan.planHashSha256)||digestFields(plan,MIGRATION_PLAN_KEYS)!==plan.planHashSha256||
     !Array.isArray(plan.executionOrder)||!e||!['mutationRequested','mutationExecuted','preflightPassed','schemaApplied','rlsApplied','postcheckPassed','mutationAttempted','transactionCommitted'].every(k=>e[k]===true)||e.rollbackConfirmed!==false||e.transactionOutcomeUnknown!==false||e.actualDatabaseName!==plan.expectedDatabaseName||e.actualMigrationRole!==plan.expectedMigrationRole)return false;
  if(!['expectedDatabaseName','expectedMigrationRole','runtimeRole','schemaName','tableName'].every(k=>typeof plan[k]==='string'&&/^[a-z_][a-z0-9_]*$/.test(plan[k]))||plan.expectedMigrationRole===plan.runtimeRole||typeof plan.tenantSetting!=='string'||!/^[a-z_][a-z0-9_]*(\.[a-z_][a-z0-9_]*)+$/.test(plan.tenantSetting))return false;
  if(p?.schemaVersion!==1||p.status!==RLS_PROBE_STATUS.PASS_NOT_PRODUCTION_CERTIFIED||p.environment!==environment||p.targetDatabaseRef!==targetDatabaseRef||p.runtimeRole!==plan.runtimeRole||p.tableRef!==plan.schemaName+'.'+plan.tableName||p.tenantSetting!==plan.tenantSetting||
     typeof p.probeInstanceId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(p.probeInstanceId)||typeof p.probeRunId!=='string'||!p.probeRunId.trim()||!isDigest(p.probeHashSha256)||digestFields(p,PROBE_CORE_KEYS)!==p.probeHashSha256||p.evidenceRef!=='sha256:'+p.probeHashSha256||
     p.productionSecurityVerifiedByThisModule!==false||p.requiresIndependentRuntimeEvidence!==true||p.mutationExecuted!==true||p.privilegedPathSeparatelyTested!==false||!closedAuthority(p.authority))return false;
  const checks=p.checks;
  if(!checks||!['runtimeRoleMatchesExpected','runtimeDatabaseMatchesExpected','cleanupComplete','forceRlsEnabled','sameTenantCrudAllowed','crossTenantCrudDenied','missingTenantContextDenied','tenantContextResetBetweenRequests'].every(k=>checks[k]===true)||!['runtimeRoleIsSuperuser','runtimeRoleBypassesRls','privilegedPathSeparatelyTested'].every(k=>checks[k]===false))return false;
  const at=Date.parse(asOf),tested=Date.parse(p.testedAt),privAt=Date.parse(priv?.testedAt);
  if(typeof asOf!=='string'||typeof p.testedAt!=='string'||typeof priv?.testedAt!=='string'||![at,tested,privAt].every(Number.isFinite)||at>Date.now()||tested>at||privAt>tested||priv?.accepted!==true||priv.status!=='PASS'||typeof priv.evidenceRef!=='string'||!priv.evidenceRef.trim()||typeof priv.reviewedBy!=='string'||!priv.reviewedBy.trim())return false;
  const expectedChecks={runtimeRoleIsSuperuser:false,runtimeRoleBypassesRls:false,forceRlsEnabled:true,sameTenantCrudAllowed:true,crossTenantCrudDenied:true,missingTenantContextDenied:true,tenantContextResetBetweenRequests:true,privilegedPathSeparatelyTested:true};
  const refs=['sha256:'+plan.planHashSha256,p.evidenceRef,priv.evidenceRef];
  if(v?.status!==VERIFICATION_STATUS.VERIFICATION_EVIDENCE_COMPLETE||v.productionSecurityVerifiedByThisModule!==false||v.transactionAuthorized!==false||v.environment!==environment||v.targetDatabaseRef!==targetDatabaseRef||v.testedAt!==p.testedAt||!Object.keys(expectedChecks).every(k=>v.checks?.[k]===expectedChecks[k])||JSON.stringify(v.evidenceRefs)!==JSON.stringify(refs))return false;
  const expected=buildBundle({environment,targetDatabaseRef,migrationResult:m,rlsProbeResult:p,privilegedPathEvidence:priv,verification:v});
  return !!b&&Object.keys(expected).length===Object.keys(b).length&&Object.keys(expected).every(k=>Object.hasOwn(b,k)&&b[k]===expected[k]);
 }catch{return false;}
}
const runControlledStagingPostgresQualification = createControlledStagingPostgresQualification();

module.exports = {
  STAGING_QUALIFICATION_STATUS,
  AUTHORITY,
  ALLOWED_ENVIRONMENTS,
  createControlledStagingPostgresQualification,
  runControlledStagingPostgresQualification,
  verifyCompletedStagingPostgresQualification,
};
