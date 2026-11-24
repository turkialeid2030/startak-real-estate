'use strict';
const assert=require('node:assert/strict');
const {buildCriticalAssumptionOverrideGovernance}=require('../../src/assumptions/critical-assumption-override-governance');
const asOf='2026-10-28T00:00:00.000Z';
const row={id:'maintenanceRate',value:0.06,override:true,critical:true,
 overrideReason:'Synthetic date test',sourceType:'INTERNAL_APPROVED_EVIDENCE',
 sourceReference:'SYNTH-SOURCE',sourceDate:'2026-10-20T00:00:00.000Z',
 approver:'synthetic-reviewer',approvalReference:'SYNTH-APPROVAL',
 approvedAt:'2026-10-21T00:00:00.000Z',approvalStatus:'APPROVED',expiresAt:'2099-12-31T00:00:00.000Z'};
const run=patch=>buildCriticalAssumptionOverrideGovernance({assumptionModelVersion:'V2',assumptionRegistry:[{...row,...patch}],asOf});
assert.equal(run({}).status,'READY');
assert.equal(run({sourceDate:'2026-10-20',approvedAt:'2026-10-21'}).status,'READY');
for(const [patch,code] of [
 [{expiresAt:'2026-10-27T00:00:00.000Z'},'CRITICAL_OVERRIDE_EXPIRED'],
 [{expiresAt:'not-a-date'},'CRITICAL_OVERRIDE_EXPIRY_DATE_INVALID'],
 [{expiresAt:0},'CRITICAL_OVERRIDE_EXPIRY_DATE_INVALID'],
 [{expiresAt:1700000000000},'CRITICAL_OVERRIDE_EXPIRY_DATE_INVALID'],
 [{expiresAt:false},'CRITICAL_OVERRIDE_EXPIRY_DATE_INVALID'],
 [{expiresAt:[]},'CRITICAL_OVERRIDE_EXPIRY_DATE_INVALID'],
 [{expiresAt:{date:'2099-12-31'}},'CRITICAL_OVERRIDE_EXPIRY_DATE_INVALID'],
 [{approvedAt:'2099-01-01T00:00:00.000Z'},'CRITICAL_OVERRIDE_APPROVAL_DATE_IN_FUTURE'],
 [{sourceDate:'2099-01-01T00:00:00.000Z'},'CRITICAL_OVERRIDE_SOURCE_DATE_IN_FUTURE'],
 [{sourceDate:'2026-02-30'},'CRITICAL_OVERRIDE_SOURCE_EVIDENCE_REQUIRED'],
 [{approvedAt:'2026-02-30T00:00:00.000Z'},'CRITICAL_OVERRIDE_APPROVAL_DATE_REQUIRED'],
 [{sourceDate:'10/20/2026'},'CRITICAL_OVERRIDE_SOURCE_EVIDENCE_REQUIRED'],
 [{approvedAt:'2026-10-21T01:00:00'},'CRITICAL_OVERRIDE_APPROVAL_DATE_REQUIRED'],
 [{approvedAt:'2026-10-19'},'CRITICAL_OVERRIDE_APPROVAL_PRECEDES_SOURCE'],
 [{expiresAt:'2026-10-20'},'CRITICAL_OVERRIDE_EXPIRY_PRECEDES_APPROVAL'],
]){
 const result=run(patch);
 assert.equal(result.decisionReady,false,code);
 assert.ok(result.blockers.includes(code+':maintenanceRate'),code);
 assert.equal(result.resolvedOverrides.maintenanceRate,0.06,'structural numeric delta must remain available for audit');
}
for(const bad of ['2026-02-30','10/28/2026','2026-10-28T00:00:00',0]){
 assert.throws(()=>buildCriticalAssumptionOverrideGovernance({assumptionModelVersion:'V2',assumptionRegistry:[row],asOf:bad}),/asOf must be a valid date/);
}
assert.equal(run({}).overrides[0].provenance.expiresAt,row.expiresAt);
// Saved-deal registry and research governance must both reject malformed
// critical evidence rather than normalizing it into a plausible date.
const {evaluateAssumptionRegistry}=require('../../src/assumptions/assumption-registry');
const {withAssumptionRegistry,evaluateSavedDealAssumptionRegistry}=require('../../src/assumptions/saved-deal-assumption-registry');
const registryRow={...row,owner:'synthetic-owner',confidence:'HIGH'};
const evaluate=(patch={},reference=asOf)=>evaluateAssumptionRegistry([{...registryRow,...patch}],{asOf:reference});
assert.equal(evaluate().status,'REVIEW');
assert.equal(evaluate({sourceDate:'2026-10-20',approvedAt:'2026-10-21'}).status,'REVIEW');
assert.equal(evaluate({expiresAt:null}).status,'REVIEW');
assert.equal(evaluate({expiresAt:'2026-10-27'}).status,'HOLD');
for(const [patch,code] of [
 [{sourceDate:'2026-02-30'},'SOURCE_EVIDENCE_REQUIRED'],
 [{sourceDate:'10/20/2026'},'SOURCE_EVIDENCE_REQUIRED'],
 [{sourceDate:1790000000000},'SOURCE_EVIDENCE_REQUIRED'],
 [{approvedAt:'2026-02-30'},'CRITICAL_OVERRIDE_APPROVAL_DATE_REQUIRED'],
 [{approvedAt:'2026-10-21T01:00:00'},'CRITICAL_OVERRIDE_APPROVAL_DATE_REQUIRED'],
 [{approvedAt:'2026-10-19'},'CRITICAL_OVERRIDE_APPROVAL_PRECEDES_SOURCE'],
 [{expiresAt:'2026-10-20'},'CRITICAL_OVERRIDE_EXPIRY_PRECEDES_APPROVAL'],
 [{expiresAt:'2026-02-30'},'CRITICAL_OVERRIDE_EXPIRY_DATE_INVALID'],
 [{expiresAt:0},'CRITICAL_OVERRIDE_EXPIRY_DATE_INVALID'],
 [{expiresAt:false},'CRITICAL_OVERRIDE_EXPIRY_DATE_INVALID'],
 [{expiresAt:[]},'CRITICAL_OVERRIDE_EXPIRY_DATE_INVALID'],
 [{expiresAt:{}},'CRITICAL_OVERRIDE_EXPIRY_DATE_INVALID'],
]){
 const result=evaluate(patch);
 assert.equal(result.status,'HOLD',code);
 assert.ok(result.assumptions[0].blockers.includes(code),code);
}
for(const bad of [0,false,'','2026-02-30','10/28/2026','2026-10-28T00:00:00']){
 const result=evaluate({},bad);
 assert.equal(result.status,'HOLD');
 assert.ok(result.assumptions[0].blockers.includes('CRITICAL_OVERRIDE_AS_OF_DATE_INVALID'));
}
const persisted=withAssumptionRegistry({},[{...registryRow,sourceDate:'2026-02-30'}]);
assert.equal(evaluateSavedDealAssumptionRegistry(persisted,{asOf}).status,'HOLD');
assert.equal(persisted.assumptionRegistry[0].sourceDate,'2026-02-30','retain original invalid evidence for remediation');
console.log('P25_HISTORICAL_TEMPORAL_GOVERNANCE_PARITY=PASS');
