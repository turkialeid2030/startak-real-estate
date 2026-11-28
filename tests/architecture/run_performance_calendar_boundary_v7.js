'use strict';
const assert=require('node:assert/strict');
const q=require('../../src/qualification/performance-resilience-qualification');
const invalid=['2026-02-30T00:00:00Z','2026-04-31T00:00:00Z','2026-02-28T24:00:00Z','2026-02-28T00:00:00','2026-02-28T00:00:00+15:00','02/28/2026'];
const valid=['2026-02-28','2026-02-28T00:00:00Z','2026-02-28T03:00:00+03:00','2024-02-29T00:00:00Z'];
const slo={sloId:'synthetic-slo',workloadClass:q.WORKLOAD_CLASS.INTERACTIVE_READ,maxP95LatencyMs:100,maxP99LatencyMs:200,minThroughputPerSecond:1,maxErrorRatePct:1,minimumSampleCount:1,policySourceRef:'synthetic-policy',rationale:'synthetic calendar boundary',effectiveAt:'2026-02-28T00:00:00Z',owner:'synthetic-owner',reviewedBy:'synthetic-reviewer',reviewedAt:'2026-03-03T00:00:00Z'};
const core={environment:'CI_TEST',exactCommitSha:'a'.repeat(40),targetRef:'synthetic-target',sourceArtifactId:'synthetic-artifact',sourceArtifactHashSha256:'b'.repeat(64),preparedBy:'synthetic-preparer',reviewedBy:'synthetic-reviewer',reviewedAt:'2026-03-04T00:00:00Z',evidenceRefs:['synthetic-ref']};
const run={...core,runId:'synthetic-run',workloadClass:slo.workloadClass,concurrentUsers:1,durationSeconds:60,sampleCount:100,p50LatencyMs:10,p95LatencyMs:20,p99LatencyMs:30,throughputPerSecond:1,errorRatePct:0,startedAt:'2026-03-03T01:00:00Z',finishedAt:'2026-03-03T01:01:00Z'};
const resilience={...core,resilienceEvidenceId:'synthetic-resilience',scenario:'BACKUP_RESTORE',maximumRecoveryTimeSeconds:60,observedRecoveryTimeSeconds:10,maximumDataLossSeconds:0,observedDataLossSeconds:0,duplicateSideEffectsObserved:false,unreconciledDataCorruptionObserved:false,objectiveSourceRef:'synthetic-objective',observedAt:'2026-03-03T01:00:00Z'};
let checks=0;
for(const [create,verify,fixture,fields] of [
 [q.createPerformanceSlo,q.verifyPerformanceSlo,slo,['effectiveAt','reviewedAt']],
 [q.createPerformanceRunEvidence,q.verifyPerformanceRunEvidence,run,['startedAt','finishedAt','reviewedAt']],
 [q.createResilienceEvidence,q.verifyResilienceEvidence,resilience,['observedAt','reviewedAt']],
]){
 const good=create(fixture);
 assert.equal(verify(good).valid,true);checks++;
 for(const field of fields)for(const date of invalid){
  assert.throws(()=>create({...fixture,[field]:date}),/valid calendar date or explicit-zone ISO timestamp/);checks++;
  assert.equal(verify({...good,[field]:date}).valid,false);checks++;
 }
}
for(const date of valid){assert.equal(q.verifyPerformanceSlo(q.createPerformanceSlo({...slo,effectiveAt:date})).valid,true);checks++;}
const runEvidence=q.createPerformanceRunEvidence(run),sloEvidence=q.createPerformanceSlo(slo),resilienceEvidence=q.createResilienceEvidence(resilience);
const input={qualificationId:'synthetic-qualification',expectedEnvironment:'CI_TEST',expectedTargetRef:core.targetRef,exactCommitSha:core.exactCommitSha,assessedAt:'2026-03-05T00:00:00Z',maximumEvidenceAgeDays:3,requiredWorkloadClasses:[slo.workloadClass],requiredResilienceScenarios:[resilience.scenario],performanceEvaluations:[q.evaluatePerformanceRun({slo:sloEvidence,runEvidence})],runEvidenceRecords:[runEvidence],resilienceEvidenceRecords:[resilienceEvidence]};
for(const date of invalid){assert.throws(()=>q.buildPerformanceResilienceQualification({...input,assessedAt:date}),/valid calendar date or explicit-zone ISO timestamp/);checks++;}
const result=q.buildPerformanceResilienceQualification(input);
assert.equal(result.status,q.PERFORMANCE_QUALIFICATION_STATUS.READY_FOR_INDEPENDENT_PERFORMANCE_VALIDATION);checks++;
assert.equal(result.deploymentAuthorized,false);checks++;
assert.equal(q.verifyPerformanceResilienceQualification(result).valid,true);checks++;
// Recompute the digest to test schema validity independently of stale-hash rejection.
const crypto=require('node:crypto');
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
const digestFields=['qualificationId','expectedEnvironment','expectedTargetRef','exactCommitSha','assessedAt','maximumEvidenceAgeDays','requiredWorkloadClasses','requiredResilienceScenarios','performanceEvaluationHashesSha256','runEvidenceHashesSha256','resilienceEvidenceHashesSha256','status','issues'];
const rehash=record=>({...record,qualificationHashSha256:crypto.createHash('sha256').update(JSON.stringify(stable(Object.fromEntries(digestFields.map(key=>[key,record[key]]))))).digest('hex')});
assert.equal(q.verifyPerformanceResilienceQualification(rehash(result)).valid,true);checks++;
for(const patch of [
 {qualificationId:''},{assessedAt:'2026-02-30T00:00:00Z'},{assessedAt:'2026-03-05T00:00:00'},
 {maximumEvidenceAgeDays:-1},{maximumEvidenceAgeDays:'3'},{requiredWorkloadClasses:[]},
 {requiredWorkloadClasses:['UNKNOWN']},{requiredWorkloadClasses:['INTERACTIVE_READ','INTERACTIVE_READ']},
 {requiredWorkloadClasses:['INTERACTIVE_READ','INTERACTIVE_WRITE']},{requiredResilienceScenarios:[]},
 {requiredResilienceScenarios:['UNKNOWN']},{requiredResilienceScenarios:['BACKUP_RESTORE','BACKUP_RESTORE']},
 {requiredResilienceScenarios:['BACKUP_RESTORE','PROCESS_RESTART']},
]){
 const invalidResult=rehash({...result,...patch});
 assert.equal(q.verifyPerformanceResilienceQualification(invalidResult).valid,false);checks++;
}
console.log('V7_PERFORMANCE_CALENDAR_BOUNDARY=PASS checks='+checks+' synthetic_evidence=true');
