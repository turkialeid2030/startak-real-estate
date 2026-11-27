'use strict';
const assert=require('node:assert/strict');
const obs=require('../../src/qualification/controlled-observability-incident-qualification');
const uat=require('../../src/qualification/independent-security-uat-evidence-gate');
const release=require('../../src/qualification/productization-release-candidate-evidence-bundle');
const bad=['2026-02-30T00:00:00Z','2026-04-31T00:00:00Z','2026-02-28T24:00:00Z','2026-02-28T00:00:00','2026-02-28T00:00:00+15:00','02/28/2026'];
const good=['2026-02-28','2026-02-28T00:00:00Z','2026-02-28T03:00:00+03:00'];
const scope={environment:'staging',serviceRef:'synthetic-calendar',exactCommitSha:'a'.repeat(40)};
const plan={...scope,preparedAt:'2026-01-01T00:00:00Z',validUntil:'2026-05-01T00:00:00Z',scenarios:[{scenarioId:'S1',userRole:'VIEWER',expectedOutcomeHashSha256:'b'.repeat(64)}]};
const manifest={...scope,candidateId:'synthetic',assembledAt:'2026-01-01T00:00:00Z',reviewedAt:'2026-05-01T00:00:00Z',assembledBy:'synthetic-owner',reviewedBy:'synthetic-reviewer',openExternalBlockers:release.REQUIRED_OPEN_EXTERNAL_BLOCKERS};
const objectives={requiredSignals:['availability'],maximumMetricFreshnessSeconds:30,maximumAlertDeliverySeconds:10,maximumIncidentAcknowledgeSeconds:60,objectiveSourceRef:'synthetic-policy'};
let checks=0,calls=0;
(async()=>{
 for(const [create,fixture,fields] of [[uat.createUatScenarioPlan,plan,['preparedAt','validUntil']],[release.buildProductizationReleaseCandidateEvidenceBundle,manifest,['assembledAt','reviewedAt']]]){
  for(const field of fields)for(const date of bad){assert.throws(()=>create({...fixture,[field]:date}),/ISO-compatible timestamp/);checks++;}
  for(const date of good){const result=create({...fixture,[fields[0]]:date});assert.ok(result);checks++;}
 }
 const qualify=obs.createControlledObservabilityIncidentQualification({metricsExecutor:()=>{calls++;throw Error('UNEXPECTED_CALL');},alertExecutor:()=>{calls++;throw Error('UNEXPECTED_CALL');},incidentExecutor:()=>{calls++;throw Error('UNEXPECTED_CALL');}});
 for(const date of bad){await assert.rejects(()=>qualify({...scope,monitoringObjectives:objectives,assessedAt:date,execute:true}),/ISO-compatible timestamp/);checks++;}
 for(const date of good){const out=await qualify({...scope,monitoringObjectives:objectives,assessedAt:date,execute:false});assert.equal(out.status,obs.OBSERVABILITY_STATUS.HOLD_DR_FAILOVER_QUALIFICATION);checks++;}
 assert.equal(calls,0);checks++;
 const candidate=release.buildProductizationReleaseCandidateEvidenceBundle(manifest);
 assert.equal(candidate.productionQualified,false);checks++;
 assert.equal(candidate.authority.releaseAuthorized,false);checks++;
 console.log('V7_RELEASE_CALENDAR_BOUNDARIES=PASS checks='+checks+' synthetic_evidence=true');
})().catch(error=>{console.error(error);process.exitCode=1;});
