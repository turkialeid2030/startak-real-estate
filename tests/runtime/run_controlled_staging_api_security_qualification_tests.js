'use strict';

const assert = require('assert');
const {
  STAGING_QUALIFICATION_STATUS,
} = require('../../src/qualification/controlled-staging-postgres-qualification');
const {
  API_SECURITY_STATUS,
  createControlledStagingApiSecurityQualification,
  verifyCompletedStagingApiSecurityQualification,
} = require('../../src/qualification/controlled-staging-api-security-qualification');

const results = [];
const crypto=require('node:crypto');
const digest=v=>crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
const authority={releaseAuthorized:false,mergeAuthorized:false,deploymentAuthorized:false,goLiveAuthorized:false,transactionAuthorized:false,productionPersistenceValidated:false,productionSecurityValidated:false};

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

function postgresQualification(overrides = {}) {
 const environment='staging',targetDatabaseRef='staging-db-ref',runtimeRole='startak_runtime',testedAt='2026-09-09T15:45:00.000Z';
 const planCore={schemaVersion:1,environment,targetDatabaseRef,expectedDatabaseName:'startak_staging',expectedMigrationRole:'startak_migrator',runtimeRole,schemaName:'public',tableName:'canonical_workspaces',tenantSetting:'app.tenant_id',schemaHashSha256:'b'.repeat(64),rlsHashSha256:'c'.repeat(64),executionOrder:['schema','rls']};
 const plan={...planCore,planHashSha256:digest(planCore)};
 const migration={schemaVersion:1,status:'APPLIED_NOT_PRODUCTION_CERTIFIED',plan,execution:{mutationRequested:true,mutationExecuted:true,preflightPassed:true,schemaApplied:true,rlsApplied:true,postcheckPassed:true,mutationAttempted:true,transactionCommitted:true,rollbackConfirmed:false,transactionOutcomeUnknown:false,actualDatabaseName:plan.expectedDatabaseName,actualMigrationRole:plan.expectedMigrationRole},productionQualified:false,authority:{...authority}};
 const checks={runtimeRoleMatchesExpected:true,runtimeDatabaseMatchesExpected:true,runtimeRoleIsSuperuser:false,runtimeRoleBypassesRls:false,forceRlsEnabled:true,sameTenantCrudAllowed:true,crossTenantCrudDenied:true,missingTenantContextDenied:true,tenantContextResetBetweenRequests:true,privilegedPathSeparatelyTested:false,cleanupComplete:true};
 const probeCore={schemaVersion:1,status:'PASS_NOT_PRODUCTION_CERTIFIED',environment,targetDatabaseRef,probeRunId:'probe-1',probeInstanceId:'8e1b4ce7-dcbe-4bc1-8c0a-d8bb98242691',testedAt,tableRef:'public.canonical_workspaces',runtimeRole,tenantSetting:plan.tenantSetting,checks};
 const probeHashSha256=digest(probeCore),rlsProbe={...probeCore,probeHashSha256,evidenceRef:'sha256:'+probeHashSha256,mutationExecuted:true,productionSecurityVerifiedByThisModule:false,requiresIndependentRuntimeEvidence:true,privilegedPathSeparatelyTested:false,authority:{...authority}};
 const privilegedPathEvidence={accepted:true,status:'PASS',evidenceRef:'SYNTH-PRIV',testedAt:'2026-09-09T15:40:00.000Z',reviewedBy:'SYNTH-REVIEWER'};
 const runtimeRlsVerification={status:'VERIFICATION_EVIDENCE_COMPLETE',environment,targetDatabaseRef,testedAt,productionSecurityVerifiedByThisModule:false,transactionAuthorized:false,evidenceRefs:['sha256:'+plan.planHashSha256,rlsProbe.evidenceRef,privilegedPathEvidence.evidenceRef],checks:{...checks,privilegedPathSeparatelyTested:true}};
 const core={schemaVersion:1,environment,targetDatabaseRef,migrationPlanRef:'sha256:'+plan.planHashSha256,rlsProbeRef:rlsProbe.evidenceRef,privilegedPathEvidenceRef:privilegedPathEvidence.evidenceRef,runtimeRlsVerificationStatus:runtimeRlsVerification.status};
 return {schemaVersion:1,status:STAGING_QUALIFICATION_STATUS.STAGING_EVIDENCE_COMPLETE_NOT_PRODUCTION_CERTIFIED,environment,targetDatabaseRef,migration,rlsProbe,privilegedPathEvidence,runtimeRlsVerification,evidenceBundle:{...core,bundleHashSha256:digest(core)},productionQualified:false,authority:{...authority},...overrides};
}

function baseInput(overrides = {}) {
  return {
    postgresQualification: postgresQualification(),
    environment: 'staging',
    targetApiRef: 'staging-api-ref',
    targetDatabaseRef: 'staging-db-ref',
    apiBaseUrl: 'https://staging.example.test',
    workspaceId: 'workspace-1',
    tenantAAuthorizationHeader: 'Bearer tenant-a-token',
    tenantBAuthorizationHeader: 'Bearer tenant-b-token',
    adminAuthorizationHeader: 'Bearer admin-token',
    nonAdminAuthorizationHeader: 'Bearer analyst-token',
    testedAt: '2026-09-09T15:50:00.000Z',
    operationId: 'p15-test',
    ...overrides,
  };
}

function successfulRequestExecutor(overrides = {}) {
  const calls = [];
  const executor = async (input) => {
    calls.push(input);
    if (input.scenario === 'TENANT_A_READ') {
      return overrides.tenantA || {
        statusCode: 200,
        body: { status: 'OK', data: { workspace: { workspaceId: 'workspace-1' }, tenantId: 'tenant-a' } },
      };
    }
    if (input.scenario === 'CROSS_TENANT_READ') {
      return overrides.crossTenant || { statusCode: 404, body: { error: { code: 'WORKSPACE_NOT_FOUND' } } };
    }
    if (input.scenario === 'UNAUTHENTICATED_READ') {
      return overrides.unauthenticated || { statusCode: 401, body: { error: { code: 'AUTHENTICATION_REQUIRED' } } };
    }
    throw new Error('unexpected scenario');
  };
  return { executor, calls };
}

function successfulAdminInspector(overrides = {}) {
  const calls = [];
  const inspector = async (input) => {
    calls.push(input);
    if (input.authorizationHeader === 'Bearer admin-token') {
      if (overrides.adminError) throw overrides.adminError;
      return overrides.adminResult || {
        status: 'HOLD_EXTERNAL_PRODUCTION_EVIDENCE',
        readOnly: true,
        secretsExposed: false,
        scope: { workspaceId: 'workspace-1', tenantId: 'tenant-a' },
      };
    }
    if (input.authorizationHeader === 'Bearer analyst-token') {
      if (overrides.nonAdminResult) return overrides.nonAdminResult;
      const error = new Error('ROLE_NOT_AUTHORIZED');
      error.code = overrides.nonAdminErrorCode || 'ROLE_NOT_AUTHORIZED';
      throw error;
    }
    throw new Error('unexpected authorization');
  };
  return { inspector, calls };
}

function assertAuthorityClosed(result) {
  assert.strictEqual(result.productionQualified, false);
  for (const value of Object.values(result.authority)) assert.strictEqual(value, false);
}

(async () => {
  await test('PRODUCTIZATION-P15-01', async () => {
    const { executor, calls: requestCalls } = successfulRequestExecutor();
    const { inspector, calls: adminCalls } = successfulAdminInspector();
    const qualify = createControlledStagingApiSecurityQualification({ requestExecutor: executor, adminInspector: inspector });
    const result = await qualify(baseInput());
    assert.strictEqual(result.status, API_SECURITY_STATUS.STAGING_API_SECURITY_EVIDENCE_COMPLETE_NOT_PRODUCTION_CERTIFIED);
    assert.strictEqual(requestCalls.length, 3);
    assert.strictEqual(adminCalls.length, 2);
    assert.strictEqual(result.apiEvidence.checks.tenantAReadAllowed, true);
    assert.strictEqual(result.apiEvidence.checks.crossTenantReadDenied, true);
    assert.strictEqual(result.apiEvidence.checks.unauthenticatedReadDenied, true);
    assert.strictEqual(result.adminApplicationPathEvidence.checks.adminReadOnlyInspectionAllowed, true);
    assert.strictEqual(result.adminApplicationPathEvidence.checks.nonAdminInspectionDenied, true);
    assert.strictEqual(result.adminApplicationPathEvidence.databaseOwnerOrBypassRlsPathTestedHere, false);
    assertAuthorityClosed(result);
  });

  await test('PRODUCTIZATION-P15-02', async () => {
    const { executor, calls } = successfulRequestExecutor();
    const { inspector } = successfulAdminInspector();
    const qualify = createControlledStagingApiSecurityQualification({ requestExecutor: executor, adminInspector: inspector });
    const result = await qualify(baseInput({
      postgresQualification: postgresQualification({ status: STAGING_QUALIFICATION_STATUS.HOLD_PRIVILEGED_PATH_EVIDENCE }),
    }));
    assert.strictEqual(result.status, API_SECURITY_STATUS.HOLD_POSTGRES_QUALIFICATION);
    assert.strictEqual(calls.length, 0);
    assert.strictEqual(result.apiEvidence, null);
  });

  await test('PRODUCTIZATION-P15-03', async () => {
    const { executor } = successfulRequestExecutor({
      crossTenant: { statusCode: 200, body: { data: { workspace: { workspaceId: 'workspace-1' }, secret: 'cross-tenant-leak' } } },
    });
    const { inspector, calls } = successfulAdminInspector();
    const qualify = createControlledStagingApiSecurityQualification({ requestExecutor: executor, adminInspector: inspector });
    const result = await qualify(baseInput());
    assert.strictEqual(result.status, API_SECURITY_STATUS.HOLD_API_IDOR_BOLA);
    assert.strictEqual(result.apiEvidence.checks.crossTenantReadDenied, false);
    assert.strictEqual(calls.length, 0);
    assert.ok(!JSON.stringify(result).includes('cross-tenant-leak'));
  });

  await test('PRODUCTIZATION-P15-04', async () => {
    const { executor } = successfulRequestExecutor({
      unauthenticated: { statusCode: 200, body: { data: { workspaceId: 'workspace-1' } } },
    });
    const { inspector } = successfulAdminInspector();
    const qualify = createControlledStagingApiSecurityQualification({ requestExecutor: executor, adminInspector: inspector });
    const result = await qualify(baseInput());
    assert.strictEqual(result.status, API_SECURITY_STATUS.HOLD_API_IDOR_BOLA);
    assert.strictEqual(result.apiEvidence.checks.unauthenticatedReadDenied, false);
  });

  await test('PRODUCTIZATION-P15-05', async () => {
    const executor = async () => { throw new Error('database host secret=must-not-leak'); };
    const { inspector } = successfulAdminInspector();
    const qualify = createControlledStagingApiSecurityQualification({ requestExecutor: executor, adminInspector: inspector });
    const result = await qualify(baseInput());
    assert.strictEqual(result.status, API_SECURITY_STATUS.HOLD_API_EXECUTION);
    assert.ok(!JSON.stringify(result).includes('must-not-leak'));
  });

  await test('PRODUCTIZATION-P15-06', async () => {
    const { executor } = successfulRequestExecutor();
    const { inspector } = successfulAdminInspector({
      nonAdminResult: {
        readOnly: true,
        secretsExposed: false,
        scope: { workspaceId: 'workspace-1', tenantId: 'tenant-a' },
      },
    });
    const qualify = createControlledStagingApiSecurityQualification({ requestExecutor: executor, adminInspector: inspector });
    const result = await qualify(baseInput());
    assert.strictEqual(result.status, API_SECURITY_STATUS.HOLD_ADMIN_APPLICATION_PATH);
    assert.strictEqual(result.adminApplicationPathEvidence.checks.nonAdminInspectionDenied, false);
  });

  await test('PRODUCTIZATION-P15-07', async () => {
    const { executor } = successfulRequestExecutor();
    const adminError = new Error('secret connection string must-not-leak');
    adminError.code = 'DB_ADMIN_INSPECTION_FAILED';
    const { inspector } = successfulAdminInspector({ adminError });
    const qualify = createControlledStagingApiSecurityQualification({ requestExecutor: executor, adminInspector: inspector });
    const result = await qualify(baseInput());
    assert.strictEqual(result.status, API_SECURITY_STATUS.HOLD_ADMIN_APPLICATION_PATH);
    assert.strictEqual(result.adminApplicationPathEvidence.adminFailureCode, 'DB_ADMIN_INSPECTION_FAILED');
    assert.ok(!JSON.stringify(result).includes('must-not-leak'));
  });

  await test('PRODUCTIZATION-P15-08', async () => {
    const { executor } = successfulRequestExecutor();
    const { inspector } = successfulAdminInspector();
    const qualify = createControlledStagingApiSecurityQualification({ requestExecutor: executor, adminInspector: inspector });
    await assert.rejects(
      () => qualify(baseInput({ environment: 'production' })),
      /environment must be one of/,
    );
    await assert.rejects(
      () => qualify(baseInput({ apiBaseUrl: 'http://staging.example.test' })),
      /apiBaseUrl must use https/,
    );
  });

  await test('PRODUCTIZATION-P15-09', async () => {
    const { executor } = successfulRequestExecutor();
    const { inspector } = successfulAdminInspector();
    const qualify = createControlledStagingApiSecurityQualification({ requestExecutor: executor, adminInspector: inspector });
    const input = baseInput();
    const first = await qualify(input);
    const second = await qualify(input);
    assert.strictEqual(first.bundleHashSha256.length, 64);
    assert.strictEqual(first.bundleHashSha256, second.bundleHashSha256);
    assert.ok(first.apiEvidence.evidenceRef.startsWith('api-idor-bola:sha256:'));
    assert.ok(first.adminApplicationPathEvidence.evidenceRef.startsWith('admin-application-path:sha256:'));
    assert.ok(!JSON.stringify(first).includes('tenant-a-token'));
    assert.ok(!JSON.stringify(first).includes('admin-token'));
  });

  for (const [id, overrides] of [
    ['INVALID-DIGEST', {evidenceBundle:{bundleHashSha256:['a'.repeat(64)]}}],
    ['MISSING-DIGEST', {evidenceBundle:{}}],
    ['PRODUCTION-CLAIM', {productionQualified:true}],
    ['RELEASE-CLAIM', {authority:{releaseAuthorized:true}}]
  ]) await test('P15-'+id, async()=>{
    const {executor,calls}=successfulRequestExecutor();
    const {inspector}=successfulAdminInspector();
    const qualify=createControlledStagingApiSecurityQualification({requestExecutor:executor,adminInspector:inspector});
    const out=await qualify(baseInput({postgresQualification:postgresQualification(overrides)}));
    assert.strictEqual(out.status,API_SECURITY_STATUS.HOLD_POSTGRES_QUALIFICATION);
    assert.strictEqual(out.postgresQualificationRef,null);
    assert.strictEqual(calls.length,0);assertAuthorityClosed(out);
  });
  await test('P15-DISTINCT-CREDENTIALS-AND-DATE',async()=>{
    const {executor,calls}=successfulRequestExecutor();
    const {inspector}=successfulAdminInspector();
    const qualify=createControlledStagingApiSecurityQualification({requestExecutor:executor,adminInspector:inspector});
    await assert.rejects(()=>qualify(baseInput({tenantBAuthorizationHeader:'bearer tenant-a-token'})),/distinct role credentials/);
    await assert.rejects(()=>qualify(baseInput({testedAt:'invalid'})),/valid timestamp/);
    assert.strictEqual(calls.length,0);
  });
  await test('P15-STRICT-HTTP-STATUS',async()=>{
    const {executor}=successfulRequestExecutor({crossTenant:{statusCode:'404',body:null}});
    const {inspector}=successfulAdminInspector();
    const qualify=createControlledStagingApiSecurityQualification({requestExecutor:executor,adminInspector:inspector});
    assert.strictEqual((await qualify(baseInput())).status,API_SECURITY_STATUS.HOLD_API_EXECUTION);
  });
  await test('P15-WRONG-ADMIN-TENANT',async()=>{
    const {executor}=successfulRequestExecutor();
    const {inspector}=successfulAdminInspector({adminResult:{readOnly:true,secretsExposed:false,scope:{workspaceId:'workspace-1',tenantId:'tenant-b'}}});
    const qualify=createControlledStagingApiSecurityQualification({requestExecutor:executor,adminInspector:inspector});
    const out=await qualify(baseInput());
    assert.strictEqual(out.status,API_SECURITY_STATUS.HOLD_ADMIN_APPLICATION_PATH);
    assert.strictEqual(out.adminApplicationPathEvidence.checks.adminScopeMatchesWorkspace,false);
  });
  const valid=postgresQualification();
  for(const [id,patch] of [
    ['STATUS-ONLY',{migration:undefined}],
    ['COMMIT-UNKNOWN',{migration:{...valid.migration,execution:{...valid.migration.execution,transactionOutcomeUnknown:true}}}],
    ['PROBE-DIGEST',{rlsProbe:{...valid.rlsProbe,probeHashSha256:'0'.repeat(64)}}],
    ['PRIVILEGED-REF',{privilegedPathEvidence:{...valid.privilegedPathEvidence,evidenceRef:'OTHER'}}],
    ['VERIFICATION-SCOPE',{runtimeRlsVerification:{...valid.runtimeRlsVerification,targetDatabaseRef:'OTHER'}}],
    ['AUTHORITY',{authority:{...authority,mergeAuthorized:true}}],
    ['BUNDLE-DIGEST',{evidenceBundle:{...valid.evidenceBundle,bundleHashSha256:'0'.repeat(64)}}]
  ])await test('P15-V626-'+id,async()=>{
    const {executor,calls}=successfulRequestExecutor();const {inspector,calls:adminCalls}=successfulAdminInspector();
    const qualify=createControlledStagingApiSecurityQualification({requestExecutor:executor,adminInspector:inspector});
    const out=await qualify(baseInput({postgresQualification:postgresQualification(patch)}));
    assert.strictEqual(out.status,API_SECURITY_STATUS.HOLD_POSTGRES_QUALIFICATION);assert.strictEqual(out.postgresQualificationRef,null);assert.strictEqual(calls.length,0);assert.strictEqual(adminCalls.length,0);
  });
  await test('P15-V626-TIME-BOUNDARY',async()=>{
    const {executor,calls}=successfulRequestExecutor();const {inspector}=successfulAdminInspector();
    const qualify=createControlledStagingApiSecurityQualification({requestExecutor:executor,adminInspector:inspector});
    assert.strictEqual((await qualify(baseInput({testedAt:'2026-09-09T15:44:00Z'}))).status,API_SECURITY_STATUS.HOLD_POSTGRES_QUALIFICATION);
    await assert.rejects(()=>qualify(baseInput({testedAt:'2999-01-01T00:00:00Z'})),/future/);assert.strictEqual(calls.length,0);
  });
  for(const [id,data,status] of [
    ['WORKSPACE-CONFLICT',{workspaceId:'other',workspace:{workspaceId:'workspace-1'},tenantId:'tenant-a'},API_SECURITY_STATUS.HOLD_API_IDOR_BOLA],
    ['TENANT-CONFLICT',{workspace:{workspaceId:'workspace-1',tenantId:'tenant-b'},tenantId:'tenant-a'},API_SECURITY_STATUS.HOLD_ADMIN_APPLICATION_PATH]
  ])await test('P15-V626-'+id,async()=>{
    const {executor}=successfulRequestExecutor({tenantA:{statusCode:200,body:{data}}});const {inspector}=successfulAdminInspector();
    const qualify=createControlledStagingApiSecurityQualification({requestExecutor:executor,adminInspector:inspector});
    assert.strictEqual((await qualify(baseInput())).status,status);
  });
  await test('P15-V627-REVALIDATE-ACTUAL-RESULT',async()=>{
    const {executor}=successfulRequestExecutor();const {inspector}=successfulAdminInspector();
    const qualify=createControlledStagingApiSecurityQualification({requestExecutor:executor,adminInspector:inspector});
    const out=await qualify(baseInput());
    assert.strictEqual(verifyCompletedStagingApiSecurityQualification(JSON.parse(JSON.stringify(out)),baseInput().testedAt),true);
    assert.strictEqual(verifyCompletedStagingApiSecurityQualification(out,'2026-09-09T15:49:00Z'),false);
    for(const [field,patch] of [['apiEvidence',{observedStatusCodes:{...out.apiEvidence.observedStatusCodes,crossTenant:200}}],['apiEvidence',{checks:{...out.apiEvidence.checks,crossTenantReadDenied:false}}],['adminApplicationPathEvidence',{targetDatabaseRef:'other'}],['adminApplicationPathEvidence',{nonAdminFailureCode:'UNEXPECTED_ERROR'}],['adminApplicationPathEvidence',{databaseOwnerOrBypassRlsPathTestedHere:true}]]){
      const stage={...out[field],...patch};const {evidenceRef,productionSecurityVerifiedByThisModule,...core}=stage;
      stage.evidenceRef=(field==='apiEvidence'?'api-idor-bola':'admin-application-path')+':sha256:'+digest(core);
      const changed={...out,[field]:stage,[field+'Ref']:stage.evidenceRef};
      const bundleCore=Object.fromEntries(['schemaVersion','status','environment','targetApiRef','targetDatabaseRef','workspaceId','postgresQualificationRef','apiEvidenceRef','adminApplicationPathEvidenceRef'].map(k=>[k,changed[k]]));
      changed.bundleHashSha256=digest(bundleCore);
      assert.strictEqual(verifyCompletedStagingApiSecurityQualification(changed,baseInput().testedAt),false);
    }
  });
  const failed = results.filter((entry) => entry[1] !== 'PASS');
  console.log(`PRODUCTIZATION_P15_STAGING_API_SECURITY_QUALIFICATION_RESULT=${failed.length === 0 ? 'PASS' : 'FAIL'} ${results.filter((entry) => entry[1] === 'PASS').length}/${results.length}`);
  if (failed.length > 0) process.exit(1);
})().catch((error) => {
  console.error('PRODUCTIZATION_P15_STAGING_API_SECURITY_QUALIFICATION_FATAL', error && error.stack ? error.stack : error);
  process.exit(1);
});
