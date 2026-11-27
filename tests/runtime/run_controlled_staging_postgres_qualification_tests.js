'use strict';

const assert = require('assert');
const {
  MIGRATION_STATUS,
} = require('../../src/storage/controlled-postgres-migration-runner');
const {
  RLS_PROBE_STATUS,
} = require('../../src/security/postgres-runtime-rls-probe');
const {
  VERIFICATION_STATUS,
} = require('../../src/security/runtime-rls-verification');
const {
  STAGING_QUALIFICATION_STATUS,
  createControlledStagingPostgresQualification,
} = require('../../src/qualification/controlled-staging-postgres-qualification');

const results = [];
const crypto=require('node:crypto');
const digest=v=>crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
const closed={releaseAuthorized:false,mergeAuthorized:false,deploymentAuthorized:false,goLiveAuthorized:false,transactionAuthorized:false,productionPersistenceValidated:false,productionSecurityValidated:false};

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

function migrationResult(status = MIGRATION_STATUS.APPLIED_NOT_PRODUCTION_CERTIFIED) {
 const core={schemaVersion:1,environment:'staging',targetDatabaseRef:'staging-db-ref',expectedDatabaseName:'startak_staging',expectedMigrationRole:'startak_migrator',runtimeRole:'startak_runtime',schemaName:'public',tableName:'canonical_workspaces',tenantSetting:'app.tenant_id',schemaHashSha256:'b'.repeat(64),rlsHashSha256:'c'.repeat(64),executionOrder:['schema','rls']};
 const applied=status===MIGRATION_STATUS.APPLIED_NOT_PRODUCTION_CERTIFIED;
 return {schemaVersion:1,status,plan:{...core,planHashSha256:digest(core)},productionQualified:false,authority:{...closed},execution:{mutationRequested:applied,mutationExecuted:applied,preflightPassed:applied,schemaApplied:applied,rlsApplied:applied,postcheckPassed:applied,mutationAttempted:applied,transactionCommitted:applied,rollbackConfirmed:false,transactionOutcomeUnknown:false,actualDatabaseName:'startak_staging',actualMigrationRole:'startak_migrator'}};
}
function rlsProbeResult(status=RLS_PROBE_STATUS.PASS_NOT_PRODUCTION_CERTIFIED){
 const core={schemaVersion:1,status,environment:'staging',targetDatabaseRef:'staging-db-ref',probeRunId:'probe-1',probeInstanceId:'8e1b4ce7-dcbe-4bc1-8c0a-d8bb98242691',testedAt:'2026-09-09T15:45:00.000Z',tableRef:'public.canonical_workspaces',runtimeRole:'startak_runtime',tenantSetting:'app.tenant_id',checks:{runtimeRoleMatchesExpected:true,runtimeDatabaseMatchesExpected:true,runtimeRoleIsSuperuser:false,runtimeRoleBypassesRls:false,forceRlsEnabled:true,sameTenantCrudAllowed:true,crossTenantCrudDenied:true,missingTenantContextDenied:true,tenantContextResetBetweenRequests:true,privilegedPathSeparatelyTested:false,cleanupComplete:true}};
 const probeHashSha256=digest(core);
 return {...core,probeHashSha256,evidenceRef:'sha256:'+probeHashSha256,mutationExecuted:true,productionSecurityVerifiedByThisModule:false,requiresIndependentRuntimeEvidence:true,privilegedPathSeparatelyTested:false,authority:{...closed}};
}

function privilegedEvidence(overrides = {}) {
  return {
    status: 'PASS',
    ownerOrAdminPathTested: true,
    evidenceRef: 'evidence://privileged-path/test-1',
    testedAt: '2026-09-09T15:40:00.000Z',
    reviewedBy: 'independent-reviewer',
    environment: 'staging',
    targetDatabaseRef: 'staging-db-ref',
    runtimeRole: 'startak_runtime',
    ...overrides,
  };
}

function baseInput(overrides = {}) {
  return {
    environment: 'staging',
    targetDatabaseRef: 'staging-db-ref',
    expectedDatabaseName: 'startak_staging',
    expectedMigrationRole: 'startak_migrator',
    runtimeRole: 'startak_runtime',
    authorization: { approved: true },
    probeRunId: 'probe-1',
    testedAt: '2026-09-09T15:45:00.000Z',
    ...overrides,
  };
}

function runtimePool() {
  return { connect() { throw new Error('stub runner must not call pool directly'); } };
}

function buildHarness({ migrationStatus, probeStatus, migrationValue, probeValue } = {}) {
  const calls = { migration: [], probe: [] };
  const migrationRunner = async (input) => {
    calls.migration.push(input);
    if (migrationValue !== undefined) return migrationValue;
    return migrationResult(input.execute === true
      ? (migrationStatus || MIGRATION_STATUS.APPLIED_NOT_PRODUCTION_CERTIFIED)
      : MIGRATION_STATUS.DRY_RUN_READY);
  };
  const rlsProbeRunner = async (input) => {
    calls.probe.push(input);
    if (probeValue !== undefined) return probeValue;
    return rlsProbeResult(probeStatus || RLS_PROBE_STATUS.PASS_NOT_PRODUCTION_CERTIFIED);
  };
  const qualify = createControlledStagingPostgresQualification({ migrationRunner, rlsProbeRunner });
  return { qualify, calls };
}

function assertAuthorityClosed(result) {
  assert.strictEqual(result.productionQualified, false);
  for (const value of Object.values(result.authority)) assert.strictEqual(value, false);
}

(async () => {
  await test('PRODUCTIZATION-P14-01', async () => {
    const { qualify, calls } = buildHarness();
    const result = await qualify(baseInput({ execute: false }));
    assert.strictEqual(result.status, STAGING_QUALIFICATION_STATUS.DRY_RUN_READY);
    assert.strictEqual(calls.migration.length, 1);
    assert.strictEqual(calls.migration[0].execute, false);
    assert.strictEqual(calls.probe.length, 0);
    assert.strictEqual(result.rlsProbe, null);
    assertAuthorityClosed(result);
  });

  await test('PRODUCTIZATION-P14-02', async () => {
    const { qualify, calls } = buildHarness({ migrationStatus: MIGRATION_STATUS.HOLD_AUTHORIZATION });
    const result = await qualify(baseInput({ execute: true, runtimePool: runtimePool() }));
    assert.strictEqual(result.status, STAGING_QUALIFICATION_STATUS.HOLD_MIGRATION);
    assert.strictEqual(calls.probe.length, 0);
  });

  await test('PRODUCTIZATION-P14-03', async () => {
    const { qualify } = buildHarness({ probeStatus: RLS_PROBE_STATUS.HOLD_CROSS_TENANT });
    const result = await qualify(baseInput({ execute: true, runtimePool: runtimePool() }));
    assert.strictEqual(result.status, STAGING_QUALIFICATION_STATUS.HOLD_RUNTIME_RLS);
    assert.strictEqual(result.runtimeRlsVerification, null);
  });

  await test('PRODUCTIZATION-P14-04', async () => {
    const { qualify } = buildHarness();
    const result = await qualify(baseInput({ execute: true, runtimePool: runtimePool() }));
    assert.strictEqual(result.status, STAGING_QUALIFICATION_STATUS.HOLD_PRIVILEGED_PATH_EVIDENCE);
    assert.strictEqual(result.runtimeRlsVerification.status, VERIFICATION_STATUS.HOLD_RUNTIME_EVIDENCE);
    assert.strictEqual(result.runtimeRlsVerification.checks.privilegedPathSeparatelyTested, false);
  });

  await test('PRODUCTIZATION-P14-05', async () => {
    const { qualify } = buildHarness();
    const result = await qualify(baseInput({
      execute: true,
      runtimePool: runtimePool(),
      privilegedPathEvidence: privilegedEvidence({ targetDatabaseRef: 'other-db-ref', secret: 'must-not-leak' }),
    }));
    assert.strictEqual(result.status, STAGING_QUALIFICATION_STATUS.HOLD_PRIVILEGED_PATH_EVIDENCE);
    assert.strictEqual(result.privilegedPathEvidence.accepted, false);
    assert.strictEqual(result.privilegedPathEvidence.evidenceRef, null);
    assert.ok(!JSON.stringify(result).includes('must-not-leak'));
  });

  await test('PRODUCTIZATION-P14-06', async () => {
    const { qualify, calls } = buildHarness();
    const result = await qualify(baseInput({
      execute: true,
      runtimePool: runtimePool(),
      privilegedPathEvidence: privilegedEvidence(),
    }));
    assert.strictEqual(result.status, STAGING_QUALIFICATION_STATUS.STAGING_EVIDENCE_COMPLETE_NOT_PRODUCTION_CERTIFIED);
    assert.strictEqual(result.privilegedPathEvidence.accepted, true);
    assert.strictEqual(result.runtimeRlsVerification.status, VERIFICATION_STATUS.VERIFICATION_EVIDENCE_COMPLETE);
    assert.strictEqual(result.runtimeRlsVerification.productionSecurityVerifiedByThisModule, false);
    assert.strictEqual(calls.probe.length, 1);
    assert.strictEqual(calls.probe[0].environment, 'staging');
    assert.strictEqual(calls.probe[0].targetDatabaseRef, 'staging-db-ref');
    assert.strictEqual(calls.probe[0].expectedRuntimeRole, 'startak_runtime');
    assertAuthorityClosed(result);
  });

  await test('PRODUCTIZATION-P14-07', async () => {
    const { qualify, calls } = buildHarness();
    await assert.rejects(
      () => qualify(baseInput({ environment: 'production', execute: false })),
      /environment must be one of/,
    );
    assert.strictEqual(calls.migration.length, 0);
  });

  await test('PRODUCTIZATION-P14-08', async () => {
    const { qualify } = buildHarness();
    await assert.rejects(
      () => qualify(baseInput({ execute: true, runtimePool: null })),
      /runtimePool.connect is required/,
    );
  });

  await test('PRODUCTIZATION-P14-09', async () => {
    const { qualify } = buildHarness();
    const input = baseInput({
      execute: true,
      runtimePool: runtimePool(),
      privilegedPathEvidence: privilegedEvidence(),
    });
    const first = await qualify(input);
    const second = await qualify(input);
    assert.strictEqual(first.evidenceBundle.bundleHashSha256.length, 64);
    assert.strictEqual(first.evidenceBundle.bundleHashSha256, second.evidenceBundle.bundleHashSha256);
    assert.strictEqual(first.evidenceBundle.migrationPlanRef, `sha256:${migrationResult().plan.planHashSha256}`);
    assert.strictEqual(first.evidenceBundle.rlsProbeRef, rlsProbeResult().evidenceRef);
  });

  await test('PRODUCTIZATION-P14-10', async () => {
    const { qualify, calls } = buildHarness({ migrationValue: null });
    const result = await qualify(baseInput({ execute: true, runtimePool: runtimePool() }));
    assert.strictEqual(result.status, STAGING_QUALIFICATION_STATUS.HOLD_MIGRATION);
    assert.strictEqual(result.migration, null);
    assert.strictEqual(calls.probe.length, 0);
  });

  await test('P14-DRY-RUN-NOT-FALSE-PASS',async()=>{
    const {qualify}=buildHarness({migrationValue:null});
    const out=await qualify(baseInput({execute:false}));
    assert.strictEqual(out.status,STAGING_QUALIFICATION_STATUS.HOLD_MIGRATION);
  });
  await test('P14-PREFLIGHT-BEFORE-MUTATION',async()=>{
    const {qualify,calls}=buildHarness();
    await assert.rejects(()=>qualify(baseInput({execute:true,runtimePool:null})),/runtimePool.connect is required/);
    await assert.rejects(()=>qualify(baseInput({execute:true,runtimePool:runtimePool(),testedAt:'bad'})),/valid timestamp/);
    assert.strictEqual(calls.migration.length,0);
  });
  for(const [id,patch] of [['WRONG-DB',{targetDatabaseRef:'other'}],['WRONG-ROLE',{runtimeRole:'other'}],['INVALID-DIGEST',{planHashSha256:['a'.repeat(64)]}]]) await test('P14-MIGRATION-'+id,async()=>{
    const m=migrationResult();Object.assign(m.plan,patch);
    const {qualify,calls}=buildHarness({migrationValue:m});
    const out=await qualify(baseInput({execute:true,runtimePool:runtimePool()}));
    assert.strictEqual(out.status,STAGING_QUALIFICATION_STATUS.HOLD_MIGRATION);
    assert.strictEqual(calls.probe.length,0);assertAuthorityClosed(out);
  });
  for(const [id,patch] of [['CLEANUP',{cleanupComplete:false}],['MISSING-SUPERUSER',{runtimeRoleIsSuperuser:undefined}],['MISSING-BYPASS',{runtimeRoleBypassesRls:null}],['DB-MISMATCH',{runtimeDatabaseMatchesExpected:false}],['ROLE-MISMATCH',{runtimeRoleMatchesExpected:false}]]) await test('P14-PROBE-'+id,async()=>{
    const probe=rlsProbeResult();Object.assign(probe.checks,patch);
    const {qualify}=buildHarness({probeValue:probe});
    const out=await qualify(baseInput({execute:true,runtimePool:runtimePool(),privilegedPathEvidence:privilegedEvidence()}));
    assert.strictEqual(out.status,STAGING_QUALIFICATION_STATUS.HOLD_RUNTIME_RLS);assertAuthorityClosed(out);
  });
  for(const [id,patch] of [['WRONG-TARGET',{targetDatabaseRef:'other'}],['WRONG-IDENTITY',{probeRunId:'other'}],['WRONG-DIGEST',{evidenceRef:'sha256:'+ 'e'.repeat(64)}]]) await test('P14-EVIDENCE-'+id,async()=>{
    const probe=Object.assign(rlsProbeResult(),patch);
    const {qualify}=buildHarness({probeValue:probe});
    const out=await qualify(baseInput({execute:true,runtimePool:runtimePool(),privilegedPathEvidence:privilegedEvidence()}));
    assert.strictEqual(out.status,STAGING_QUALIFICATION_STATUS.HOLD_RUNTIME_RLS);
  });
  for(const testedAt of ['invalid','2026-09-10T00:00:00Z']) await test('P14-PRIVILEGED-TIME-'+testedAt,async()=>{
    const {qualify}=buildHarness();
    const out=await qualify(baseInput({execute:true,runtimePool:runtimePool(),privilegedPathEvidence:privilegedEvidence({testedAt})}));
    assert.strictEqual(out.status,STAGING_QUALIFICATION_STATUS.HOLD_PRIVILEGED_PATH_EVIDENCE);
  });
  for(const patch of [{transactionCommitted:false},{transactionOutcomeUnknown:true},{rollbackConfirmed:true},{actualDatabaseName:'other'},{actualMigrationRole:'other'}])await test('P14-V625-MIGRATION-EXECUTION-'+Object.keys(patch)[0],async()=>{
    const m=migrationResult();Object.assign(m.execution,patch);
    const {qualify,calls}=buildHarness({migrationValue:m});
    const out=await qualify(baseInput({execute:true,runtimePool:runtimePool()}));assert.strictEqual(out.status,STAGING_QUALIFICATION_STATUS.HOLD_MIGRATION);assert.strictEqual(calls.probe.length,0);
  });
  for(const patch of [{tableRef:'public.other'},{tenantSetting:'app.other'},{probeInstanceId:'bad'},{authority:{...closed,mergeAuthorized:true}},{checks:{...rlsProbeResult().checks,crossTenantCrudDenied:false}}])await test('P14-V625-PROBE-'+Object.keys(patch)[0],async()=>{
    const probe={...rlsProbeResult(),...patch};
    const core=Object.fromEntries(['schemaVersion','status','environment','targetDatabaseRef','probeRunId','probeInstanceId','testedAt','tableRef','runtimeRole','tenantSetting','checks'].map(k=>[k,probe[k]]));
    probe.probeHashSha256=digest(core);probe.evidenceRef='sha256:'+probe.probeHashSha256;
    const {qualify}=buildHarness({probeValue:probe});
    assert.strictEqual((await qualify(baseInput({execute:true,runtimePool:runtimePool(),privilegedPathEvidence:privilegedEvidence()}))).status,STAGING_QUALIFICATION_STATUS.HOLD_RUNTIME_RLS);
  });
  await test('P14-V625-FUTURE-PREFLIGHT',async()=>{
    const {qualify,calls}=buildHarness();await assert.rejects(()=>qualify(baseInput({testedAt:'2999-01-01T00:00:00Z',execute:true,runtimePool:runtimePool()})),/future/);assert.strictEqual(calls.migration.length,0);
  });
  await test('P14-V625-EVALUATOR-STATUS-ONLY',async()=>{
    const qualify=createControlledStagingPostgresQualification({migrationRunner:async()=>migrationResult(),rlsProbeRunner:async()=>rlsProbeResult(),rlsEvaluator:()=>({status:VERIFICATION_STATUS.VERIFICATION_EVIDENCE_COMPLETE})});
    assert.strictEqual((await qualify(baseInput({execute:true,runtimePool:runtimePool(),privilegedPathEvidence:privilegedEvidence()}))).status,STAGING_QUALIFICATION_STATUS.HOLD_PRIVILEGED_PATH_EVIDENCE);
  });
  const failed = results.filter((entry) => entry[1] !== 'PASS');
  console.log(`PRODUCTIZATION_P14_STAGING_POSTGRES_QUALIFICATION_RESULT=${failed.length === 0 ? 'PASS' : 'FAIL'} ${results.filter((entry) => entry[1] === 'PASS').length}/${results.length}`);
  if (failed.length > 0) process.exit(1);
})().catch((error) => {
  console.error('PRODUCTIZATION_P14_STAGING_POSTGRES_QUALIFICATION_FATAL', error && error.stack ? error.stack : error);
  process.exit(1);
});
