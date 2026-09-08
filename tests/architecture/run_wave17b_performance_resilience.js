'use strict';
const assert = require('assert');
const crypto = require('crypto');
const {
  PERFORMANCE_QUALIFICATION_STATUS, PERFORMANCE_EVIDENCE_CLASS,
  createPerformanceEvidence, verifyPerformanceEvidence,
  buildPerformanceResilienceQualification, verifyPerformanceResilienceQualification,
} = require('../../src/qualification/performance-resilience.js');
let checks=0; const check=(fn)=>{fn();checks+=1;}; const sha=(v)=>crypto.createHash('sha256').update(String(v)).digest('hex');
const commit='c'.repeat(40); const env='CI-W17B';
const defs=[
 ['LAT',PERFORMANCE_EVIDENCE_CLASS.LATENCY,180,250,'MAX','ms'],
 ['TPS',PERFORMANCE_EVIDENCE_CLASS.THROUGHPUT,120,100,'MIN','req/s'],
 ['ERR',PERFORMANCE_EVIDENCE_CLASS.ERROR_RATE,0.2,1,'MAX','percent'],
 ['CPU',PERFORMANCE_EVIDENCE_CLASS.RESOURCE_UTILIZATION,62,80,'MAX','percent'],
 ['REC',PERFORMANCE_EVIDENCE_CLASS.RECOVERY,35,60,'MAX','seconds'],
 ['CON',PERFORMANCE_EVIDENCE_CLASS.CONCURRENCY,80,50,'MIN','users'],
];
function ev([id,cls,obs,thr,dir,unit],o={}){return createPerformanceEvidence({evidenceId:`E-${id}`,evidenceClass:cls,environmentRef:env,exactCommitSha:commit,metricName:id,unit,observedValue:obs,thresholdValue:thr,thresholdDirection:dir,thresholdSourceRef:'PERF-POLICY-W17B',artifactId:`ART-${id}`,artifactHashSha256:sha(id),observedAt:'2026-09-08T08:00:00Z',reviewedAt:'2026-09-08T08:10:00Z',reviewerRef:'PERF-REVIEWER',...o});}
const evidence=defs.map(ev); const required=defs.map((d)=>d[1]);
check(()=>assert.strictEqual(evidence.length,6)); for(const e of evidence){check(()=>assert.strictEqual(verifyPerformanceEvidence(e).valid,true));check(()=>assert.strictEqual(e.pass,true));}
function q(o={}){return buildPerformanceResilienceQualification({qualificationId:'W17B-Q1',environmentRef:env,exactCommitSha:commit,requiredEvidenceClasses:required,evidence,maximumEvidenceAgeSeconds:86400,assessedAt:'2026-09-08T09:00:00Z',preparedBy:'PERF-ENGINEER',reviewedBy:'PERF-REVIEWER',...o});}
const ready=q();
check(()=>assert.strictEqual(ready.status,PERFORMANCE_QUALIFICATION_STATUS.READY_FOR_INDEPENDENT_RELEASE_QUALIFICATION));
check(()=>assert.strictEqual(verifyPerformanceResilienceQualification(ready).valid,true));
check(()=>assert.strictEqual(ready.productionCapacityEstablished,false));
check(()=>assert.strictEqual(ready.productionSlaEstablished,false));
check(()=>assert.strictEqual(ready.disasterRecoveryCertified,false));
check(()=>assert.strictEqual(ready.externalLoadTestEstablished,false));
check(()=>assert.strictEqual(ready.independentReleaseQualificationRequired,true));
check(()=>assert.strictEqual(ready.mergeAuthorized,false));
check(()=>assert.strictEqual(ready.deploymentAuthorized,false));
const bad={...evidence[0],observedValue:999}; check(()=>assert.strictEqual(verifyPerformanceEvidence(bad).valid,false));
check(()=>assert.strictEqual(q({evidence:[bad,...evidence.slice(1)]}).status,PERFORMANCE_QUALIFICATION_STATUS.HOLD_INTEGRITY));
const breached=evidence.map((e,i)=>i===0?ev(defs[0],{observedValue:300}):e); check(()=>assert.strictEqual(q({evidence:breached}).status,PERFORMANCE_QUALIFICATION_STATUS.HOLD_THRESHOLD_BREACH));
check(()=>assert.strictEqual(q({evidence:evidence.slice(1)}).status,PERFORMANCE_QUALIFICATION_STATUS.HOLD_MISSING_EVIDENCE));
check(()=>assert.strictEqual(q({environmentRef:'OTHER'}).status,PERFORMANCE_QUALIFICATION_STATUS.HOLD_SCOPE_MISMATCH));
check(()=>assert.strictEqual(q({maximumEvidenceAgeSeconds:60}).status,PERFORMANCE_QUALIFICATION_STATUS.HOLD_STALE_EVIDENCE));
check(()=>assert.strictEqual(q({evidence:[...evidence,evidence[0]]}).status,PERFORMANCE_QUALIFICATION_STATUS.HOLD_MISSING_EVIDENCE));
check(()=>assert.strictEqual(verifyPerformanceResilienceQualification({...ready,reviewedBy:'tampered'}).valid,false));
console.log(`WAVE_17B_PERFORMANCE_RESILIENCE=PASS checks=${checks}`);
