'use strict';

const assert = require('assert');
const {
  API_SECURITY_STATUS,
} = require('../../src/qualification/controlled-staging-api-security-qualification');
const {
  BACKUP_RESTORE_STATUS,
  createControlledBackupRestoreQualification,
} = require('../../src/qualification/controlled-backup-restore-qualification');
const {
  PERFORMANCE_STATUS,
  RESILIENCE_SCENARIO,
} = require('../../src/qualification/performance-resilience-qualification');

const results = [];

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

function apiSecurityQualification(overrides = {}) {
  return {
    status: API_SECURITY_STATUS.STAGING_API_SECURITY_EVIDENCE_COMPLETE_NOT_PRODUCTION_CERTIFIED,
    environment: 'staging',
    targetApiRef: 'staging-api-ref',
    targetDatabaseRef: 'staging-db-ref',
    bundleHashSha256: 'b'.repeat(64),
    productionQualified: false,
    authority: { releaseAuthorized: false },
    ...overrides,
  };
}

function authorization(overrides = {}) {
  return {
    approved: true,
    allowBackup: true,
    allowRestore: true,
    approvedBy: 'staging-operator',
    reviewedBy: 'independent-reviewer',
    approvedAt: '2026-09-09T15:55:00.000Z',
    changeControlRef: 'CHG-P16-001',
    environment: 'staging',
    sourceDatabaseRef: 'staging-db-ref',
    sourceDatabaseName: 'startak_staging',
    restoreTargetDatabaseRef: 'staging-restore-db-ref',
    restoreTargetDatabaseName: 'startak_staging_restore',
    ...overrides,
  };
}

function baseInput(overrides = {}) {
  return {
    apiSecurityQualification: apiSecurityQualification(),
    environment: 'staging',
    sourceDatabaseRef: 'staging-db-ref',
    sourceDatabaseName: 'startak_staging',
    restoreTargetDatabaseRef: 'staging-restore-db-ref',
    restoreTargetDatabaseName: 'startak_staging_restore',
    exactCommitSha: 'a'.repeat(40),
    recoveryObjectives: {
      maximumRecoveryTimeSeconds: 600,
      maximumDataLossSeconds: 60,
      objectiveSourceRef: 'policy://staging-rto-rpo-v1',
    },
    authorization: authorization(),
    execute: true,
    evidenceId: 'p16-backup-restore-test',
    assessedAt: '2026-09-09T16:10:00.000Z',
    ...overrides,
  };
}

function backupResult(overrides = {}) {
  return {
    sourceDatabaseRef:'staging-db-ref',
    sourceDatabaseName:'startak_staging',
    artifactId: 'backup-artifact-001',
    artifactHashSha256: 'c'.repeat(64),
    artifactSizeBytes: 1024,
    startedAt: '2026-09-09T16:00:00.000Z',
    sourceSnapshotAt: '2026-09-09T16:00:30.000Z',
    finishedAt: '2026-09-09T16:01:00.000Z',
    ...overrides,
  };
}

function restoreResult(overrides = {}) {
  return {
    restoreTargetDatabaseRef:'staging-restore-db-ref',
    restoreTargetDatabaseName:'startak_staging_restore',
    restoredArtifactHashSha256: 'c'.repeat(64),
    startedAt: '2026-09-09T16:02:00.000Z',
    finishedAt: '2026-09-09T16:05:00.000Z',
    ...overrides,
  };
}

function verificationResult(overrides = {}) {
  return {
    sourceDatabaseRef:'staging-db-ref',
    restoreTargetDatabaseRef:'staging-restore-db-ref',
    observedAt:'2026-09-09T16:05:20.000Z',
    sourceRecordCount: 100,
    restoredRecordCount: 100,
    sourceFingerprintSha256: 'd'.repeat(64),
    restoredFingerprintSha256: 'd'.repeat(64),
    latestSourceDataAt: '2026-09-09T16:00:30.000Z',
    latestRestoredDataAt: '2026-09-09T16:00:30.000Z',
    duplicateSideEffectsObserved: false,
    unreconciledDataCorruptionObserved: false,
    ...overrides,
  };
}

function buildHarness({ backupValue, restoreValue, verificationValue, backupError, restoreError, verificationError } = {}) {
  const calls = { backup: [], restore: [], verify: [] };
  const backupExecutor = async (input) => {
    calls.backup.push(input);
    if (backupError) throw backupError;
    return backupValue || backupResult();
  };
  const restoreExecutor = async (input) => {
    calls.restore.push(input);
    if (restoreError) throw restoreError;
    return restoreValue || restoreResult();
  };
  const verificationExecutor = async (input) => {
    calls.verify.push(input);
    if (verificationError) throw verificationError;
    return verificationValue || verificationResult();
  };
  const qualify = createControlledBackupRestoreQualification({ backupExecutor, restoreExecutor, verificationExecutor });
  return { qualify, calls };
}

function assertAuthorityClosed(result) {
  assert.strictEqual(result.productionQualified, false);
  for (const value of Object.values(result.authority)) assert.strictEqual(value, false);
}

(async () => {
  await test('PRODUCTIZATION-P16-01', async () => {
    const qualify = createControlledBackupRestoreQualification();
    const result = await qualify(baseInput({ execute: false }));
    assert.strictEqual(result.status, BACKUP_RESTORE_STATUS.DRY_RUN_READY);
    assert.strictEqual(result.backup, null);
    assert.strictEqual(result.restore, null);
    assert.strictEqual(result.resilienceEvidence, null);
    assertAuthorityClosed(result);
  });

  await test('PRODUCTIZATION-P16-02', async () => {
    const { qualify, calls } = buildHarness();
    const result = await qualify(baseInput({
      apiSecurityQualification: apiSecurityQualification({ status: API_SECURITY_STATUS.HOLD_API_IDOR_BOLA }),
    }));
    assert.strictEqual(result.status, BACKUP_RESTORE_STATUS.HOLD_API_SECURITY_QUALIFICATION);
    assert.strictEqual(calls.backup.length, 0);
  });

  await test('PRODUCTIZATION-P16-03', async () => {
    const { qualify, calls } = buildHarness();
    const result = await qualify(baseInput({ authorization: authorization({ restoreTargetDatabaseRef: 'wrong-ref' }) }));
    assert.strictEqual(result.status, BACKUP_RESTORE_STATUS.HOLD_AUTHORIZATION);
    assert.strictEqual(calls.backup.length, 0);
    assert.strictEqual(result.authorization.accepted, false);
  });

  await test('PRODUCTIZATION-P16-04', async () => {
    const { qualify, calls } = buildHarness();
    const result = await qualify(baseInput());
    assert.strictEqual(result.status, BACKUP_RESTORE_STATUS.BACKUP_RESTORE_EVIDENCE_COMPLETE_NOT_PRODUCTION_CERTIFIED);
    assert.strictEqual(calls.backup.length, 1);
    assert.strictEqual(calls.restore.length, 1);
    assert.strictEqual(calls.verify.length, 1);
    assert.strictEqual(result.restore.artifactHashMatchesBackup, true);
    assert.strictEqual(result.verification.recordCountsMatch, true);
    assert.strictEqual(result.verification.fingerprintsMatch, true);
    assert.strictEqual(result.resilienceEvidence.scenario, RESILIENCE_SCENARIO.BACKUP_RESTORE);
    assert.strictEqual(result.resilienceEvidence.status, PERFORMANCE_STATUS.PASS);
    assert.strictEqual(result.resilienceEvidence.observedRecoveryTimeSeconds, 200);
    assert.strictEqual(result.resilienceEvidence.observedDataLossSeconds, 0);
    assertAuthorityClosed(result);
  });

  await test('PRODUCTIZATION-P16-05', async () => {
    const secretError = new Error('postgres password=must-not-leak');
    const { qualify } = buildHarness({ backupError: secretError });
    const result = await qualify(baseInput());
    assert.strictEqual(result.status, BACKUP_RESTORE_STATUS.HOLD_BACKUP);
    assert.ok(!JSON.stringify(result).includes('must-not-leak'));
  });

  await test('PRODUCTIZATION-P16-06', async () => {
    const { qualify } = buildHarness({ restoreValue: restoreResult({ restoredArtifactHashSha256: 'e'.repeat(64) }) });
    const result = await qualify(baseInput());
    assert.strictEqual(result.status, BACKUP_RESTORE_STATUS.HOLD_RESTORE);
    assert.strictEqual(result.restore.artifactHashMatchesBackup, false);
  });

  await test('PRODUCTIZATION-P16-07', async () => {
    const { qualify } = buildHarness({ verificationValue: verificationResult({ restoredRecordCount: 99 }) });
    const result = await qualify(baseInput());
    assert.strictEqual(result.status, BACKUP_RESTORE_STATUS.HOLD_VERIFICATION);
    assert.strictEqual(result.verification.recordCountsMatch, false);
  });

  await test('PRODUCTIZATION-P16-08', async () => {
    const { qualify } = buildHarness({
      restoreValue: restoreResult({ finishedAt: '2026-09-09T16:20:00.000Z' }),
      verificationValue:verificationResult({observedAt:'2026-09-09T16:20:20Z'}),
    });
    const result = await qualify(baseInput({ assessedAt: '2026-09-09T16:25:00.000Z' }));
    assert.strictEqual(result.status, BACKUP_RESTORE_STATUS.HOLD_RECOVERY_OBJECTIVE);
    assert.strictEqual(result.resilienceEvidence.status, PERFORMANCE_STATUS.FAIL);
    assert.ok(result.resilienceEvidence.failureCodes.includes('RECOVERY_TIME_OBJECTIVE_EXCEEDED'));
  });

  await test('PRODUCTIZATION-P16-09', async () => {
    const { qualify } = buildHarness({
      verificationValue: verificationResult({ latestRestoredDataAt: '2026-09-09T15:58:00.000Z' }),
    });
    const result = await qualify(baseInput());
    assert.strictEqual(result.status, BACKUP_RESTORE_STATUS.HOLD_RECOVERY_OBJECTIVE);
    assert.ok(result.resilienceEvidence.failureCodes.includes('DATA_LOSS_OBJECTIVE_EXCEEDED'));
  });

  await test('PRODUCTIZATION-P16-10', async () => {
    const { qualify } = buildHarness();
    await assert.rejects(
      () => qualify(baseInput({ environment: 'production' })),
      /environment must be staging/,
    );
    await assert.rejects(
      () => qualify(baseInput({ restoreTargetDatabaseRef: 'staging-db-ref' })),
      /restore target must be isolated/,
    );
  });

  await test('PRODUCTIZATION-P16-11', async () => {
    const { qualify } = buildHarness();
    const first = await qualify(baseInput());
    const second = await qualify(baseInput());
    assert.strictEqual(first.plan.planHashSha256.length, 64);
    assert.strictEqual(first.plan.planHashSha256, second.plan.planHashSha256);
    assert.strictEqual(first.bundleHashSha256, second.bundleHashSha256);
    assert.ok(!JSON.stringify(first).includes('password'));
    assert.ok(first.resilienceEvidence.evidenceRefs.includes(`sha256:${'b'.repeat(64)}`));
  });

  for (const [id,overrides] of [
    ['WRONG-SOURCE',{targetDatabaseRef:'other-db'}],
    ['MALFORMED-DIGEST',{bundleHashSha256:['b'.repeat(64)]}],
    ['PRODUCTION-CLAIM',{productionQualified:true}],
    ['RELEASE-CLAIM',{authority:{releaseAuthorized:true}}]
  ]) await test('P16-'+id,async()=>{
    const {qualify,calls}=buildHarness();
    const out=await qualify(baseInput({apiSecurityQualification:apiSecurityQualification(overrides)}));
    assert.strictEqual(out.status,BACKUP_RESTORE_STATUS.HOLD_API_SECURITY_QUALIFICATION);
    assert.strictEqual(out.apiSecurityQualificationRef,null);
    assert.strictEqual(calls.backup.length,0);assertAuthorityClosed(out);
  });
  await test('P16-FUTURE-AUTH',async()=>{
    const {qualify,calls}=buildHarness();
    const out=await qualify(baseInput({authorization:authorization({approvedAt:'2026-09-10T00:00:00Z'})}));
    assert.strictEqual(out.status,BACKUP_RESTORE_STATUS.HOLD_AUTHORIZATION);assert.strictEqual(calls.backup.length,0);
  });
  for(const [id,patch,status,next] of [
    ['EMPTY-BACKUP',{backupValue:backupResult({artifactSizeBytes:0})},BACKUP_RESTORE_STATUS.HOLD_BACKUP,'restore'],
    ['BACKUP-PREAUTH',{backupValue:backupResult({startedAt:'2026-09-09T15:54:00Z'})},BACKUP_RESTORE_STATUS.HOLD_BACKUP,'restore'],
    ['RESTORE-OVERLAP',{restoreValue:restoreResult({startedAt:'2026-09-09T16:00:59Z'})},BACKUP_RESTORE_STATUS.HOLD_RESTORE,'verify'],
    ['FUTURE-DATA',{verificationValue:verificationResult({latestRestoredDataAt:'2026-09-10T00:00:00Z'})},BACKUP_RESTORE_STATUS.HOLD_VERIFICATION,null],
    ['MISSING-RISK-FLAG',{verificationValue:verificationResult({duplicateSideEffectsObserved:undefined})},BACKUP_RESTORE_STATUS.HOLD_VERIFICATION,null],
    ['INVALID-RISK-FLAG',{verificationValue:verificationResult({unreconciledDataCorruptionObserved:'false'})},BACKUP_RESTORE_STATUS.HOLD_VERIFICATION,null]
  ]) await test('P16-'+id,async()=>{
    const {qualify,calls}=buildHarness(patch);
    const out=await qualify(baseInput());
    assert.strictEqual(out.status,status);if(next)assert.strictEqual(calls[next].length,0);assertAuthorityClosed(out);
  });
  await test('P16-BIND-PLAN-AND-HOLD-EVIDENCE',async()=>{
    const {qualify}=buildHarness();
    const a=await qualify(baseInput({execute:false}));
    const b=await qualify(baseInput({execute:false,evidenceId:'other'}));
    assert.notStrictEqual(a.plan.planHashSha256,b.plan.planHashSha256);
    const c=await buildHarness({verificationValue:verificationResult({restoredRecordCount:98})}).qualify(baseInput());
    const e=await buildHarness({verificationValue:verificationResult({restoredRecordCount:99})}).qualify(baseInput());
    assert.strictEqual(c.status,e.status);assert.notStrictEqual(c.bundleHashSha256,e.bundleHashSha256);
  });
  for(const [id,patch,status,next] of [
    ['SOURCE-IDENTITY',{backupValue:backupResult({sourceDatabaseName:'other'})},BACKUP_RESTORE_STATUS.HOLD_BACKUP,'restore'],
    ['FUTURE-BACKUP',{backupValue:backupResult({finishedAt:'2026-09-09T16:11:00Z'})},BACKUP_RESTORE_STATUS.HOLD_BACKUP,'restore'],
    ['TARGET-IDENTITY',{restoreValue:restoreResult({restoreTargetDatabaseRef:'other'})},BACKUP_RESTORE_STATUS.HOLD_RESTORE,'verify'],
    ['FUTURE-RESTORE',{restoreValue:restoreResult({finishedAt:'2026-09-09T16:11:00Z'})},BACKUP_RESTORE_STATUS.HOLD_RESTORE,'verify'],
    ['VERIFY-IDENTITY',{verificationValue:verificationResult({sourceDatabaseRef:'other'})},BACKUP_RESTORE_STATUS.HOLD_VERIFICATION,null],
    ['VERIFY-NO-TIME',{verificationValue:verificationResult({observedAt:undefined})},BACKUP_RESTORE_STATUS.HOLD_VERIFICATION,null],
    ['VERIFY-PRE-RESTORE',{verificationValue:verificationResult({observedAt:'2026-09-09T16:04:00Z'})},BACKUP_RESTORE_STATUS.HOLD_VERIFICATION,null],
    ['VERIFY-FUTURE',{verificationValue:verificationResult({observedAt:'2026-09-09T16:11:00Z'})},BACKUP_RESTORE_STATUS.HOLD_VERIFICATION,null],
    ['RESTORED-AFTER-SNAPSHOT',{verificationValue:verificationResult({latestRestoredDataAt:'2026-09-09T16:00:31Z'})},BACKUP_RESTORE_STATUS.HOLD_VERIFICATION,null]
  ])await test('P16-'+id,async()=>{
    const {qualify,calls}=buildHarness(patch);
    const out=await qualify(baseInput());
    assert.strictEqual(out.status,status);if(next)assert.strictEqual(calls[next].length,0);assertAuthorityClosed(out);
  });
  await test('P16-RTO-INCLUDES-VERIFICATION',async()=>{
    const {qualify}=buildHarness();
    const out=await qualify(baseInput({recoveryObjectives:{maximumRecoveryTimeSeconds:190,maximumDataLossSeconds:60,objectiveSourceRef:'policy://staging'}}));
    assert.strictEqual(out.status,BACKUP_RESTORE_STATUS.HOLD_RECOVERY_OBJECTIVE);
    assert.strictEqual(out.resilienceEvidence.observedRecoveryTimeSeconds,200);
  });
  await test('P16-LIVE-REJECTS-STALE-BACKUP',async()=>{
    const {qualify,calls}=buildHarness();
    const out=await qualify(baseInput({assessedAt:undefined}));
    assert.strictEqual(out.status,BACKUP_RESTORE_STATUS.HOLD_BACKUP);assert.strictEqual(calls.restore.length,0);
  });
  await test('P16-FUTURE-CUTOFF',async()=>{
    const {qualify,calls}=buildHarness();
    await assert.rejects(()=>qualify(baseInput({assessedAt:'2999-01-01T00:00:00Z'})),/must not be in the future/);
    assert.strictEqual(calls.backup.length,0);
  });
  await test('P16-UNSAFE-COUNT',async()=>{
    const {qualify}=buildHarness({verificationValue:verificationResult({sourceRecordCount:Number.MAX_SAFE_INTEGER+1,restoredRecordCount:Number.MAX_SAFE_INTEGER+1})});
    assert.strictEqual((await qualify(baseInput())).status,BACKUP_RESTORE_STATUS.HOLD_VERIFICATION);
  });
  const failed = results.filter((entry) => entry[1] !== 'PASS');
  console.log(`PRODUCTIZATION_P16_BACKUP_RESTORE_QUALIFICATION_RESULT=${failed.length === 0 ? 'PASS' : 'FAIL'} ${results.filter((entry) => entry[1] === 'PASS').length}/${results.length}`);
  if (failed.length > 0) process.exit(1);
})().catch((error) => {
  console.error('PRODUCTIZATION_P16_BACKUP_RESTORE_QUALIFICATION_FATAL', error && error.stack ? error.stack : error);
  process.exit(1);
});
