'use strict';

const assert = require('assert');
const {
  BACKUP_RESTORE_STATUS,
} = require('../../src/qualification/controlled-backup-restore-qualification');
const {
  PERFORMANCE_STATUS,
  RESILIENCE_SCENARIO,
} = require('../../src/qualification/performance-resilience-qualification');
const {
  DR_FAILOVER_STATUS,
  createControlledDrFailoverQualification,
} = require('../../src/qualification/controlled-dr-failover-qualification');

const results = [];
const COMMIT_SHA = '1'.repeat(40);
const FINGERPRINT = 'a'.repeat(64);

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

const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const digest=v=>require('node:crypto').createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex');
function backupRestoreQualification(overrides = {}) {
 const {createResilienceEvidence,QUALIFICATION_ENVIRONMENT}=require('../../src/qualification/performance-resilience-qualification');
 const planCore={schemaVersion:1,environment:'staging',sourceDatabaseRef:'primary-ref',sourceDatabaseName:'startak_primary',restoreTargetDatabaseRef:'restore-ref',restoreTargetDatabaseName:'startak_restore',exactCommitSha:COMMIT_SHA,assessedAt:'2026-09-09T15:54:00Z',assessmentMode:'RETROSPECTIVE_CUTOFF',evidenceId:'SYNTH-BACKUP',recoveryObjectives:{maximumRecoveryTimeSeconds:600,maximumDataLossSeconds:60,objectiveSourceRef:'SYNTH-POLICY'},apiSecurityQualificationRef:'sha256:'+'a'.repeat(64),apiSecurityTestedAt:'2026-09-09T15:40:00Z',executionOrder:['backup','isolatedRestore','dataVerification','resilienceEvidence']};
 const plan={...planCore,planHashSha256:digest(planCore)},authorization={accepted:true,approvedBy:'SYNTH-OPERATOR',reviewedBy:'SYNTH-REVIEWER',approvedAt:'2026-09-09T15:41:00Z',changeControlRef:'SYNTH-CHANGE'};
 const backup={sourceDatabaseRef:plan.sourceDatabaseRef,sourceDatabaseName:plan.sourceDatabaseName,artifactId:'SYNTH-ARTIFACT',artifactHashSha256:'c'.repeat(64),artifactSizeBytes:1024,startedAt:'2026-09-09T15:42:00Z',finishedAt:'2026-09-09T15:43:00Z',sourceSnapshotAt:'2026-09-09T15:42:30Z'};
 const restore={restoreTargetDatabaseRef:plan.restoreTargetDatabaseRef,restoreTargetDatabaseName:plan.restoreTargetDatabaseName,restoredArtifactHashSha256:backup.artifactHashSha256,artifactHashMatchesBackup:true,startedAt:'2026-09-09T15:44:00Z',finishedAt:'2026-09-09T15:45:00Z'};
 const verification={sourceDatabaseRef:plan.sourceDatabaseRef,restoreTargetDatabaseRef:plan.restoreTargetDatabaseRef,observedAt:'2026-09-09T15:46:00Z',sourceRecordCount:100,restoredRecordCount:100,recordCountsMatch:true,sourceFingerprintSha256:FINGERPRINT,restoredFingerprintSha256:FINGERPRINT,fingerprintsMatch:true,latestSourceDataAt:backup.sourceSnapshotAt,latestRestoredDataAt:backup.sourceSnapshotAt,duplicateSideEffectsObserved:false,unreconciledDataCorruptionObserved:false};
 const resilienceEvidence=createResilienceEvidence({resilienceEvidenceId:plan.evidenceId,scenario:RESILIENCE_SCENARIO.BACKUP_RESTORE,environment:QUALIFICATION_ENVIRONMENT.STAGING,exactCommitSha:COMMIT_SHA,targetRef:'primary-ref->restore-ref',maximumRecoveryTimeSeconds:600,observedRecoveryTimeSeconds:120,maximumDataLossSeconds:60,observedDataLossSeconds:0,duplicateSideEffectsObserved:false,unreconciledDataCorruptionObserved:false,objectiveSourceRef:'SYNTH-POLICY',sourceArtifactId:backup.artifactId,sourceArtifactHashSha256:backup.artifactHashSha256,observedAt:verification.observedAt,preparedBy:authorization.approvedBy,reviewedBy:authorization.reviewedBy,reviewedAt:plan.assessedAt,evidenceRefs:['sha256:'+plan.planHashSha256,plan.apiSecurityQualificationRef,'sha256:'+backup.artifactHashSha256]});
 const core={schemaVersion:1,status:BACKUP_RESTORE_STATUS.BACKUP_RESTORE_EVIDENCE_COMPLETE_NOT_PRODUCTION_CERTIFIED,planHashSha256:plan.planHashSha256,apiSecurityQualificationRef:plan.apiSecurityQualificationRef,authorizationAccepted:true,backupArtifactRef:'sha256:'+backup.artifactHashSha256,resilienceEvidenceRef:'sha256:'+resilienceEvidence.resilienceEvidenceHashSha256,stageEvidenceHashSha256:digest({authorization,backup,restore,verification})};
 return {...core,plan,authorization,backup,restore,verification,resilienceEvidence,bundleHashSha256:digest(core),productionQualified:false,authority:{releaseAuthorized:false,mergeAuthorized:false,deploymentAuthorized:false,goLiveAuthorized:false,transactionAuthorized:false,productionPersistenceValidated:false,productionSecurityValidated:false,productionResilienceValidated:false},semantics:'This controlled staging runner orchestrates host-injected backup, isolated restore, and verification adapters and can produce a BACKUP_RESTORE resilience evidence record. It does not contain database credentials, implement pg_dump/restore itself, certify production resilience, establish an SLA, or authorize release, merge, deployment, go-live, or transactions.',...overrides};
}

function authorization(overrides = {}) {
  return {
    approved: true,
    allowFailover: true,
    allowFailback: true,
    approvedBy: 'dr-operator',
    reviewedBy: 'independent-reviewer',
    approvedAt: '2026-09-09T15:55:00.000Z',
    changeControlRef: 'chg-dr-17',
    environment: 'staging',
    primaryDatabaseRef: 'primary-ref',
    primaryDatabaseName: 'startak_primary',
    standbyDatabaseRef: 'standby-ref',
    standbyDatabaseName: 'startak_standby',
    ...overrides,
  };
}

function baseInput(overrides = {}) {
  return {
    backupRestoreQualification: backupRestoreQualification(),
    environment: 'staging',
    primaryDatabaseRef: 'primary-ref',
    primaryDatabaseName: 'startak_primary',
    standbyDatabaseRef: 'standby-ref',
    standbyDatabaseName: 'startak_standby',
    exactCommitSha: COMMIT_SHA,
    recoveryObjectives: {
      maximumRecoveryTimeSeconds: 60,
      maximumDataLossSeconds: 5,
      objectiveSourceRef: 'policy://dr/staging-v1',
    },
    authorization: authorization(),
    drillId: 'dr-drill-17',
    assessedAt: '2026-09-09T16:02:00.000Z',
    ...overrides,
  };
}

function preflightResult(overrides = {}) {
  return {
    primaryDatabaseRef:'primary-ref',
    standbyDatabaseRef:'standby-ref',
    observedAt:'2026-09-09T15:59:56.000Z',
    primaryHealthy: true,
    standbyReachable: true,
    replicationHealthy: true,
    replicationLagSeconds: 1,
    latestPrimaryDataAt: '2026-09-09T15:59:55.000Z',
    latestStandbyDataAt: '2026-09-09T15:59:54.000Z',
    secret: 'must-not-leak',
    ...overrides,
  };
}

function transitionResult(phase, overrides = {}) {
  if (phase === 'failover') {
    return {
      startedAt: '2026-09-09T16:00:00.000Z',
      finishedAt: '2026-09-09T16:00:20.000Z',
      activeDatabaseRef: 'standby-ref',
      activeDatabaseName: 'startak_standby',
      secret: 'must-not-leak',
      ...overrides,
    };
  }
  return {
    startedAt: '2026-09-09T16:01:00.000Z',
    finishedAt: '2026-09-09T16:01:10.000Z',
    activeDatabaseRef: 'primary-ref',
    activeDatabaseName: 'startak_primary',
    secret: 'must-not-leak',
    ...overrides,
  };
}

function verificationResult(phase, overrides = {}) {
  if (phase === 'failover') {
    return {
      observedAt: '2026-09-09T16:00:30.000Z',
      latestPrimaryDataAt: '2026-09-09T16:00:25.000Z',
      latestActiveDataAt: '2026-09-09T16:00:23.000Z',
      activeDatabaseRef: 'standby-ref',
      activeDatabaseName: 'startak_standby',
      readPathHealthy: true,
      writePathHealthy: true,
      sourceRecordCount: 100,
      activeRecordCount: 100,
      sourceFingerprintSha256: FINGERPRINT,
      activeFingerprintSha256: FINGERPRINT,
      duplicateSideEffectsObserved: false,
      unreconciledDataCorruptionObserved: false,
      connectionString: 'postgres://secret',
      ...overrides,
    };
  }
  return {
    observedAt: '2026-09-09T16:01:20.000Z',
    latestPrimaryDataAt: '2026-09-09T16:01:18.000Z',
    latestStandbyDataAt:'2026-09-09T16:01:18.000Z',
    latestActiveDataAt: '2026-09-09T16:01:18.000Z',
    activeDatabaseRef: 'primary-ref',
    activeDatabaseName: 'startak_primary',
    readPathHealthy: true,
    writePathHealthy: true,
    sourceRecordCount: 100,
    activeRecordCount: 100,
    sourceFingerprintSha256: FINGERPRINT,
    activeFingerprintSha256: FINGERPRINT,
    duplicateSideEffectsObserved: false,
    unreconciledDataCorruptionObserved: false,
    password: 'must-not-leak',
    ...overrides,
  };
}

function harness(overrides = {}) {
  const calls = { preflight: 0, failover: 0, verify: [], failback: 0 };
  const qualify = createControlledDrFailoverQualification({
    preflightExecutor: overrides.preflightExecutor || (async () => { calls.preflight += 1; return preflightResult(overrides.preflightOverrides); }),
    failoverExecutor: overrides.failoverExecutor || (async () => { calls.failover += 1; return transitionResult('failover', overrides.failoverOverrides); }),
    verificationExecutor: overrides.verificationExecutor || (async ({ phase }) => {
      calls.verify.push(phase);
      return verificationResult(phase, phase === 'failover' ? overrides.failoverVerificationOverrides : overrides.failbackVerificationOverrides);
    }),
    failbackExecutor: overrides.failbackExecutor || (async () => { calls.failback += 1; return transitionResult('failback', overrides.failbackOverrides); }),
  });
  return { qualify, calls };
}

function assertAuthorityClosed(result) {
  assert.strictEqual(result.productionQualified, false);
  for (const value of Object.values(result.authority)) assert.strictEqual(value, false);
}

(async () => {
  await test('PRODUCTIZATION-P17-01', async () => {
    const { qualify, calls } = harness();
    const result = await qualify(baseInput({ execute: false }));
    assert.strictEqual(result.status, DR_FAILOVER_STATUS.DRY_RUN_READY);
    assert.strictEqual(calls.preflight, 0);
    assert.strictEqual(calls.failover, 0);
    assert.strictEqual(calls.failback, 0);
    assert.strictEqual(result.plan.planHashSha256.length, 64);
    assertAuthorityClosed(result);
  });

  await test('PRODUCTIZATION-P17-02', async () => {
    const { qualify, calls } = harness();
    const result = await qualify(baseInput({
      execute: true,
      backupRestoreQualification: backupRestoreQualification({ status: BACKUP_RESTORE_STATUS.HOLD_VERIFICATION }),
    }));
    assert.strictEqual(result.status, DR_FAILOVER_STATUS.HOLD_BACKUP_RESTORE_QUALIFICATION);
    assert.strictEqual(calls.preflight, 0);
  });

  await test('PRODUCTIZATION-P17-03', async () => {
    const { qualify, calls } = harness();
    const result = await qualify(baseInput({
      execute: true,
      authorization: authorization({ standbyDatabaseRef: 'other-ref' }),
    }));
    assert.strictEqual(result.status, DR_FAILOVER_STATUS.HOLD_AUTHORIZATION);
    assert.strictEqual(result.authorization.accepted, false);
    assert.strictEqual(calls.preflight, 0);
  });

  await test('PRODUCTIZATION-P17-04', async () => {
    const { qualify, calls } = harness();
    const result = await qualify(baseInput({ execute: true }));
    assert.strictEqual(result.status, DR_FAILOVER_STATUS.DR_FAILOVER_EVIDENCE_COMPLETE_NOT_PRODUCTION_CERTIFIED);
    assert.strictEqual(calls.preflight, 1);
    assert.strictEqual(calls.failover, 1);
    assert.deepStrictEqual(calls.verify, ['failover', 'failback']);
    assert.strictEqual(calls.failback, 1);
    assert.strictEqual(result.resilienceEvidence.status, PERFORMANCE_STATUS.PASS);
    assert.strictEqual(result.resilienceEvidence.scenario, RESILIENCE_SCENARIO.DATABASE_UNAVAILABLE);
    assert.strictEqual(result.resilienceEvidence.observedRecoveryTimeSeconds, 30);
    assert.strictEqual(result.resilienceEvidence.observedDataLossSeconds, 2);
    assert.ok(result.evidenceRef.startsWith('sha256:'));
    const serialized = JSON.stringify(result);
    assert.ok(!serialized.includes('must-not-leak'));
    assert.ok(!serialized.includes('postgres://secret'));
    assertAuthorityClosed(result);
  });

  await test('PRODUCTIZATION-P17-05', async () => {
    const { qualify, calls } = harness({ preflightOverrides: { replicationHealthy: false } });
    const result = await qualify(baseInput({ execute: true }));
    assert.strictEqual(result.status, DR_FAILOVER_STATUS.HOLD_PREFLIGHT);
    assert.strictEqual(calls.failover, 0);
  });

  await test('PRODUCTIZATION-P17-06', async () => {
    const { qualify } = harness({ preflightExecutor: async () => { throw new Error('db password=secret'); } });
    const result = await qualify(baseInput({ execute: true }));
    assert.strictEqual(result.status, DR_FAILOVER_STATUS.HOLD_PREFLIGHT);
    assert.ok(!JSON.stringify(result).includes('db password=secret'));
  });

  await test('PRODUCTIZATION-P17-07', async () => {
    const { qualify } = harness({ failoverOverrides: { activeDatabaseRef: 'primary-ref', activeDatabaseName: 'startak_primary' } });
    const result = await qualify(baseInput({ execute: true }));
    assert.strictEqual(result.status, DR_FAILOVER_STATUS.HOLD_FAILOVER);
    assert.strictEqual(result.failover.expectedTargetActivated, false);
  });

  await test('PRODUCTIZATION-P17-08', async () => {
    const { qualify, calls } = harness({ failoverVerificationOverrides: { activeRecordCount: 99 } });
    const result = await qualify(baseInput({ execute: true }));
    assert.strictEqual(result.status, DR_FAILOVER_STATUS.HOLD_FAILOVER_VERIFICATION);
    assert.strictEqual(result.failoverVerification.recordCountsMatch, false);
    assert.strictEqual(calls.failback, 0);
  });

  await test('PRODUCTIZATION-P17-09', async () => {
    const { qualify } = harness({ failbackExecutor: async () => { throw new Error('provider token secret'); } });
    const result = await qualify(baseInput({ execute: true }));
    assert.strictEqual(result.status, DR_FAILOVER_STATUS.HOLD_FAILBACK);
    assert.ok(!JSON.stringify(result).includes('provider token secret'));
  });

  await test('PRODUCTIZATION-P17-10', async () => {
    const { qualify } = harness({ failbackVerificationOverrides: { writePathHealthy: false } });
    const result = await qualify(baseInput({ execute: true }));
    assert.strictEqual(result.status, DR_FAILOVER_STATUS.HOLD_FAILBACK_VERIFICATION);
    assert.strictEqual(result.failbackVerification.writePathHealthy, false);
  });

  await test('PRODUCTIZATION-P17-11', async () => {
    const { qualify } = harness();
    const result = await qualify(baseInput({
      execute: true,
      recoveryObjectives: {
        maximumRecoveryTimeSeconds: 10,
        maximumDataLossSeconds: 5,
        objectiveSourceRef: 'policy://dr/strict-rto',
      },
    }));
    assert.strictEqual(result.status, DR_FAILOVER_STATUS.HOLD_RECOVERY_OBJECTIVE);
    assert.ok(result.resilienceEvidence.failureCodes.includes('RECOVERY_TIME_OBJECTIVE_EXCEEDED'));
  });

  await test('PRODUCTIZATION-P17-12', async () => {
    const { qualify } = harness();
    const result = await qualify(baseInput({
      execute: true,
      recoveryObjectives: {
        maximumRecoveryTimeSeconds: 60,
        maximumDataLossSeconds: 1,
        objectiveSourceRef: 'policy://dr/strict-rpo',
      },
    }));
    assert.strictEqual(result.status, DR_FAILOVER_STATUS.HOLD_RECOVERY_OBJECTIVE);
    assert.ok(result.resilienceEvidence.failureCodes.includes('DATA_LOSS_OBJECTIVE_EXCEEDED'));
  });

  await test('PRODUCTIZATION-P17-13', async () => {
    const { qualify } = harness();
    await assert.rejects(
      () => qualify(baseInput({ environment: 'production', execute: false })),
      /environment must be staging/,
    );
    await assert.rejects(
      () => qualify(baseInput({ standbyDatabaseRef: 'primary-ref', execute: false })),
      /standby database must be distinct/,
    );
  });

  await test('PRODUCTIZATION-P17-14', async () => {
    const { qualify } = harness();
    const input = baseInput({ execute: false });
    const first = await qualify(input);
    const second = await qualify(input);
    assert.strictEqual(first.plan.planHashSha256, second.plan.planHashSha256);
    assert.strictEqual(first.executionHashSha256, second.executionHashSha256);
    assert.strictEqual(first.plan.backupRestoreQualificationRef, `sha256:${backupRestoreQualification().bundleHashSha256}`);
  });

  for(const [name,patch,status] of [
    ['BACKUP-HASH',{backupRestoreQualification:backupRestoreQualification({bundleHashSha256:['b'.repeat(64)]})},DR_FAILOVER_STATUS.HOLD_BACKUP_RESTORE_QUALIFICATION],
    ['FUTURE-AUTH',{authorization:authorization({approvedAt:'2026-09-10T00:00:00Z'})},DR_FAILOVER_STATUS.HOLD_AUTHORIZATION]
  ])await test('P17-'+name,async()=>{
    const {qualify,calls}=harness();
    const out=await qualify(baseInput({...patch,execute:true}));
    assert.strictEqual(out.status,status);assert.strictEqual(calls.preflight,0);assertAuthorityClosed(out);
  });
  for(const [name,patch,status,next] of [
    ['FUTURE-PREFLIGHT',{preflightOverrides:{latestPrimaryDataAt:'2026-09-10T00:00:00Z'}},DR_FAILOVER_STATUS.HOLD_PREFLIGHT,'failover'],
    ['PREAUTH-FAILOVER',{failoverOverrides:{startedAt:'2026-09-09T15:54:00Z'}},DR_FAILOVER_STATUS.HOLD_FAILOVER,'failback'],
    ['PREMATURE-VERIFICATION',{failoverVerificationOverrides:{observedAt:'2026-09-09T16:00:19Z',latestPrimaryDataAt:'2026-09-09T16:00:18Z',latestActiveDataAt:'2026-09-09T16:00:17Z'}},DR_FAILOVER_STATUS.HOLD_FAILOVER_VERIFICATION,'failback'],
    ['FUTURE-DATA',{failoverVerificationOverrides:{latestPrimaryDataAt:'2026-09-10T00:00:00Z'}},DR_FAILOVER_STATUS.HOLD_FAILOVER_VERIFICATION,'failback'],
    ['EARLY-FAILBACK',{failbackOverrides:{startedAt:'2026-09-09T16:00:29Z'}},DR_FAILOVER_STATUS.HOLD_FAILBACK,null],
    ['EARLY-FAILBACK-VERIFICATION',{failbackVerificationOverrides:{observedAt:'2026-09-09T16:01:09Z',latestPrimaryDataAt:'2026-09-09T16:01:08Z',latestActiveDataAt:'2026-09-09T16:01:08Z'}},DR_FAILOVER_STATUS.HOLD_FAILBACK_VERIFICATION,null]
  ])await test('P17-'+name,async()=>{
    const {qualify,calls}=harness(patch);
    const out=await qualify(baseInput({execute:true}));
    assert.strictEqual(out.status,status);if(next)assert.strictEqual(calls[next],0);assertAuthorityClosed(out);
  });
  await test('P17-PLAN-BOUND-TIME-AND-DRILL',async()=>{
    const {qualify}=harness();
    const first=await qualify(baseInput());
    const changed=await qualify(baseInput({drillId:'OTHER-DRILL'}));
    const later=await qualify(baseInput({assessedAt:'2026-09-09T16:03:00Z'}));
    assert.notStrictEqual(first.plan.planHashSha256,changed.plan.planHashSha256);
    assert.notStrictEqual(first.plan.planHashSha256,later.plan.planHashSha256);
  });
  for (const [name, patch, status, flag] of [
    ['PREFLIGHT-FLAG', {preflightOverrides:{latestPrimaryDataAt:'2026-09-10T00:00:00Z'}}, DR_FAILOVER_STATUS.HOLD_PREFLIGHT, 'preflightReady'],
    ['FAILOVER-FLAG', {failoverOverrides:{startedAt:'2026-09-09T15:54:00Z'}}, DR_FAILOVER_STATUS.HOLD_FAILOVER, 'failoverTargetActivated'],
    ['VERIFY-FLAG', {failoverVerificationOverrides:{observedAt:'2026-09-09T16:00:19Z',latestPrimaryDataAt:'2026-09-09T16:00:18Z',latestActiveDataAt:'2026-09-09T16:00:17Z'}}, DR_FAILOVER_STATUS.HOLD_FAILOVER_VERIFICATION, 'failoverVerified'],
    ['FAILBACK-FLAG', {failbackOverrides:{startedAt:'2026-09-09T16:00:29Z'}}, DR_FAILOVER_STATUS.HOLD_FAILBACK, 'failbackTargetActivated'],
    ['FAILBACK-VERIFY-FLAG', {failbackVerificationOverrides:{observedAt:'2026-09-09T16:01:09Z',latestPrimaryDataAt:'2026-09-09T16:01:08Z',latestActiveDataAt:'2026-09-09T16:01:08Z'}}, DR_FAILOVER_STATUS.HOLD_FAILBACK_VERIFICATION, 'failbackVerified'],
    ['MISSING-DUPLICATE-FLAG', {failoverVerificationOverrides:{duplicateSideEffectsObserved:undefined}}, DR_FAILOVER_STATUS.HOLD_FAILOVER_VERIFICATION, 'failoverVerified'],
    ['INVALID-CORRUPTION-FLAG', {failbackVerificationOverrides:{unreconciledDataCorruptionObserved:'false'}}, DR_FAILOVER_STATUS.HOLD_FAILBACK_VERIFICATION, 'failbackVerified']
  ]) await test('P17-'+name, async()=>{
    const {qualify}=harness(patch);
    const out=await qualify(baseInput({execute:true}));
    assert.strictEqual(out.status,status);
    assert.strictEqual(out[flag],false);
    assertAuthorityClosed(out);
  });
  await test('P17-HOLD-EVIDENCE-BINDING',async()=>{
    const a=await harness({preflightOverrides:{replicationHealthy:false,replicationLagSeconds:5}}).qualify(baseInput({execute:true}));
    const b=await harness({preflightOverrides:{replicationHealthy:false,replicationLagSeconds:6}}).qualify(baseInput({execute:true}));
    assert.strictEqual(a.status,b.status);
    assert.strictEqual(a.plan.planHashSha256,b.plan.planHashSha256);
    assert.notStrictEqual(a.stageEvidenceHashSha256,b.stageEvidenceHashSha256);
    assert.notStrictEqual(a.executionHashSha256,b.executionHashSha256);
    assertAuthorityClosed(a);assertAuthorityClosed(b);
  });
  await test('P17-INVALID-BACKUP-REFERENCE',async()=>{
    const out=await harness().qualify(baseInput({backupRestoreQualification:backupRestoreQualification({bundleHashSha256:['b'.repeat(64)]}),execute:true}));
    assert.strictEqual(out.status,DR_FAILOVER_STATUS.HOLD_BACKUP_RESTORE_QUALIFICATION);
    assert.strictEqual(out.backupRestoreQualificationRef,null);
    assertAuthorityClosed(out);
  });
  for(const [id,patch] of [
    ['SOURCE-NAME',{plan:{...backupRestoreQualification().plan,sourceDatabaseName:'other'}}],
    ['PRODUCTION-CLAIM',{productionQualified:true}],
    ['RELEASE-CLAIM',{authority:{releaseAuthorized:true}}]
  ])await test('P17-'+id,async()=>{
    const {qualify,calls}=harness();
    const out=await qualify(baseInput({execute:true,backupRestoreQualification:backupRestoreQualification(patch)}));
    assert.strictEqual(out.status,DR_FAILOVER_STATUS.HOLD_BACKUP_RESTORE_QUALIFICATION);
    assert.strictEqual(calls.preflight,0);assertAuthorityClosed(out);
  });
  await test('P17-FAILOVER-BEFORE-PREFLIGHT-DATA',async()=>{
    const {qualify,calls}=harness({preflightOverrides:{latestPrimaryDataAt:'2026-09-09T16:00:01Z',latestStandbyDataAt:'2026-09-09T16:00:00Z',observedAt:'2026-09-09T16:00:02Z'}});
    const out=await qualify(baseInput({execute:true}));
    assert.strictEqual(out.status,DR_FAILOVER_STATUS.HOLD_FAILOVER);
    assert.strictEqual(calls.failback,0);
  });
  await test('P17-SLOW-FAILBACK-RTO',async()=>{
    const {qualify}=harness({failbackVerificationOverrides:{observedAt:'2026-09-09T16:01:50Z'}});
    const out=await qualify(baseInput({execute:true,recoveryObjectives:{maximumRecoveryTimeSeconds:40,maximumDataLossSeconds:5,objectiveSourceRef:'policy://dr'}}));
    assert.strictEqual(out.status,DR_FAILOVER_STATUS.HOLD_RECOVERY_OBJECTIVE);
    assert.strictEqual(out.resilienceEvidence.observedRecoveryTimeSeconds,50);
  });
  for(const [id,patch] of [
    ['WRONG-TARGET',{standbyDatabaseRef:'other'}],
    ['MISSING-OBSERVATION',{observedAt:undefined}],
    ['REPORTED-LAG',{replicationLagSeconds:6}],
    ['WATERMARK-LAG',{latestStandbyDataAt:'2026-09-09T15:59:49Z'}]
  ])await test('P17-PREFLIGHT-'+id,async()=>{
    const {qualify,calls}=harness({preflightOverrides:patch});
    const out=await qualify(baseInput({execute:true}));
    assert.strictEqual(out.status,DR_FAILOVER_STATUS.HOLD_PREFLIGHT);
    assert.strictEqual(calls.failover,0);assert.strictEqual(out.preflightReady,false);
  });
  await test('P17-FAILBACK-RPO',async()=>{
    const {qualify}=harness({failbackVerificationOverrides:{latestStandbyDataAt:'2026-09-09T16:01:18Z',latestActiveDataAt:'2026-09-09T16:01:10Z'}});
    const out=await qualify(baseInput({execute:true}));
    assert.strictEqual(out.status,DR_FAILOVER_STATUS.HOLD_RECOVERY_OBJECTIVE);
    assert.strictEqual(out.resilienceEvidence.observedDataLossSeconds,8);
  });
  await test('P17-FAILBACK-MISSING-SOURCE-WATERMARK',async()=>{
    const {qualify}=harness({failbackVerificationOverrides:{latestStandbyDataAt:undefined}});
    assert.strictEqual((await qualify(baseInput({execute:true}))).status,DR_FAILOVER_STATUS.HOLD_FAILBACK_VERIFICATION);
  });
  await test('P17-LIVE-STALE-PREFLIGHT',async()=>{
    const {qualify,calls}=harness();
    const out=await qualify(baseInput({execute:true,assessedAt:undefined}));
    assert.strictEqual(out.status,DR_FAILOVER_STATUS.HOLD_PREFLIGHT);assert.strictEqual(calls.failover,0);
  });
  for(const patch of [{backup:null},{restore:null},{verification:null},{resilienceEvidence:null},{authority:{...backupRestoreQualification().authority,mergeAuthorized:true}}])await test('P17-V628-UPSTREAM-'+Object.keys(patch)[0],async()=>{
    const {qualify,calls}=harness();const out=await qualify(baseInput({execute:true,backupRestoreQualification:backupRestoreQualification(patch)}));
    assert.strictEqual(out.status,DR_FAILOVER_STATUS.HOLD_BACKUP_RESTORE_QUALIFICATION);assert.strictEqual(calls.preflight,0);assertAuthorityClosed(out);
  });
  const failed = results.filter((entry) => entry[1] !== 'PASS');
  console.log(`PRODUCTIZATION_P17_CONTROLLED_DR_FAILOVER_RESULT=${failed.length === 0 ? 'PASS' : 'FAIL'} ${results.filter((entry) => entry[1] === 'PASS').length}/${results.length}`);
  if (failed.length > 0) process.exit(1);
})().catch((error) => {
  console.error('PRODUCTIZATION_P17_CONTROLLED_DR_FAILOVER_FATAL', error && error.stack ? error.stack : error);
  process.exit(1);
});
