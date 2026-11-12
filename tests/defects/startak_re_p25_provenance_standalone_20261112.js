'use strict';
const assert=require('node:assert/strict');
const {
 V2_CRITICAL_ASSUMPTION_KEYS,
 buildCriticalAssumptionOverrideGovernance: govern,
 applyCriticalAssumptionOverrideDecisionGovernance: applyDecision
}=require('../../src/assumptions/critical-assumption-override-governance');
const {V2_APPROVED_ASSUMPTIONS}=require('../../src/assumptions/assumption-model');
const asOf='2026-11-12T09:00:00.000Z';
assert.deepEqual([...V2_CRITICAL_ASSUMPTION_KEYS],Object.keys(V2_APPROVED_ASSUMPTIONS));
const base=govern({assumptionModelVersion:'V2',asOf});
assert.equal(base.status,'NO_OVERRIDES');
assert.equal(base.hasCriticalOverrides,false);
assert(Object.isFrozen(base));
const legacy=govern({assumptionModelVersion:'LEGACY',assumptionRegistry:[{id:'maintenanceRate',override:true,value:0.2}],asOf});
assert.equal(legacy.status,'NOT_APPLICABLE');
const malformed=govern({assumptionModelVersion:'V2',assumptionRegistry:'not-an-array',asOf});
assert.equal(malformed.decisionReady,false);
assert(malformed.blockers.includes('ASSUMPTION_REGISTRY_ARRAY_REQUIRED'));
const good={
 id:'maintenanceRate',override:true,value:0.085,
 sourceType:'OWNER_REVIEWED_REPORT',sourceReference:'SYNTHETIC-SOURCE-REF',
 sourceDate:'2026-11-07T09:00:00Z',overrideReason:'SYNTHETIC-SENSITIVITY',
 approver:'SYNTHETIC-REVIEWER',approvalReference:'SYNTHETIC-APPROVAL',
 approvedAt:'2026-11-08T09:00:00Z',approvalStatus:'APPROVED',
 expiresAt:'2026-11-20T09:00:00Z'
};
const original=JSON.stringify(good);
const authorized=govern({assumptionModelVersion:'V2',assumptionRegistry:[good],asOf});
assert.equal(authorized.status,'READY');
assert.equal(authorized.decisionReady,true); // *structural* readiness, not independently authenticated approval
assert.equal(authorized.resolvedOverrides.maintenanceRate,0.085);
assert.equal(JSON.stringify(good),original);
assert(Object.isFrozen(authorized.overrides));
const testFail=(record,expectedCode)=>{
 const x=govern({assumptionModelVersion:'V2',assumptionRegistry:[record],asOf});
 assert.equal(x.decisionReady,false,expectedCode);
 assert(x.blockers.includes(expectedCode),JSON.stringify(x.blockers));
 if(typeof record.value==='number'&&Number.isFinite(record.value)) assert.equal(x.resolvedOverrides.maintenanceRate,0.085);
 else assert.equal(x.resolvedOverrides.maintenanceRate,undefined);
 return x;
};
testFail({...good,sourceDate:'2026-11-25T00:00:00Z'},'CRITICAL_OVERRIDE_SOURCE_DATE_IN_FUTURE:maintenanceRate');
testFail({...good,approvedAt:'2026-11-23T00:00:00Z'},'CRITICAL_OVERRIDE_APPROVAL_DATE_IN_FUTURE:maintenanceRate');
testFail({...good,expiresAt:'2026-11-10T00:00:00Z'},'CRITICAL_OVERRIDE_EXPIRED:maintenanceRate');
testFail({...good,expiresAt:'not-a-date'},'CRITICAL_OVERRIDE_EXPIRY_DATE_INVALID:maintenanceRate');
testFail({...good,approvalStatus:'PENDING'},'CRITICAL_OVERRIDE_APPROVAL_STATUS_REQUIRED:maintenanceRate');
testFail({...good,sourceReference:''},'CRITICAL_OVERRIDE_SOURCE_EVIDENCE_REQUIRED:maintenanceRate');
testFail({...good,value:'0.085'},'CRITICAL_OVERRIDE_NUMERIC_VALUE_REQUIRED:maintenanceRate');
const duplicate=govern({assumptionModelVersion:'V2',assumptionRegistry:[good,{...good,approvalReference:'ANOTHER'}],asOf});
assert.equal(duplicate.decisionReady,false);
assert(duplicate.blockers.includes('DUPLICATE_CRITICAL_OVERRIDE:maintenanceRate'));
const raw={cashflows:[-1000,1200],verdict:'INVEST',decisionStatus:'READY',incompleteInputs:[],metCount:3,totalCriteria:3};
const hold=testFail({...good,approvalStatus:'PENDING'},'CRITICAL_OVERRIDE_APPROVAL_STATUS_REQUIRED:maintenanceRate');
const result=applyDecision({engineResult:raw,governance:hold});
assert.equal(result.verdict,'INCOMPLETE_INPUTS');
assert.equal(result.analyticalResultsOnly,true);
assert.equal(result.metCount,null);
assert.deepEqual(result.cashflows,raw.cashflows);
assert.equal(raw.verdict,'INVEST'); // original engine object is never changed in-place
assert.equal(result.criticalAssumptionOverrideGovernance.decisionReady,false);
console.log('STARTAK_RE_P25_PROVENANCE_STANDALONE=PASS');
