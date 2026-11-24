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
console.log('P25_HISTORICAL_TEMPORAL_GOVERNANCE_PARITY=PASS');
