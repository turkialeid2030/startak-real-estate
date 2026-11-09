'use strict';
const assert=require('node:assert/strict');
const {evaluateAssumptionRegistry,ASSUMPTION_GATE_STATUS}=
 require('../../src/assumptions/assumption-registry');
const {withAssumptionRegistry,evaluateSavedDealAssumptionRegistry}=
 require('../../src/assumptions/saved-deal-assumption-registry');
const AS_OF='2026-11-09T00:00:00.000Z';
let assertions=0;
function eq(actual,expected,label){assert.equal(actual,expected,label);assertions++;}
function yes(condition,label){assert.ok(condition,label);assertions++;}
const valid=()=>({
 id:'maintenanceRate',value:.06,unit:'ratio',critical:true,override:true,
 overrideReason:'Documented investment committee exception',
 sourceType:'INTERNAL_APPROVED_EVIDENCE',sourceReference:'TEST-ASSUMPTION-OVERRIDE-001',
 sourceDate:'2026-09-01T00:00:00.000Z',owner:'investment-team',reviewer:'model-risk',
 confidence:'HIGH',evidenceCount:1,
 approver:'investment-committee',approvalReference:'TEST-APPROVAL-001',
 approvedAt:'2026-09-02T00:00:00.000Z',approvalStatus:'APPROVED',
 expiresAt:'2027-06-01T00:00:00.000Z',
});
function evaluate(item,asOf=AS_OF){return evaluateAssumptionRegistry([item],{asOf});}
function hold(change,expectedCode,asOf=AS_OF) {
 const item=valid();change(item);
 const r=evaluate(item,asOf);
 eq(r.status,ASSUMPTION_GATE_STATUS.HOLD,expectedCode+': fail closed');
 const details=[...r.blockers,...r.assumptions.flatMap(a=>a.blockers||[])];
 yes(details.some(code=>code.includes(expectedCode)),expectedCode+': surfaced in canonical registry or assumption details');
 yes(r.blockers.some(code=>code.startsWith('CRITICAL_ASSUMPTION_')),expectedCode+': registry-level decision HOLD');
 eq(r.assumptions[0].critical,true,expectedCode+': critical flag retained');
}
const good=evaluate(valid());
eq(good.status,ASSUMPTION_GATE_STATUS.REVIEW,'self-declared approval never means PASS');
eq(good.assumptions[0].status,'SUPPORTED','complete critical override structurally supported');
eq(good.assumptions[0].approver,'investment-committee','approver recorded');
eq(good.assumptions[0].approvalReference,'TEST-APPROVAL-001','approval reference recorded');
eq(good.assumptions[0].approvalStatus,'APPROVED','claimed status recorded without independent authentication');
yes(good.warnings.includes('ASSUMPTION_OVERRIDE_ACTIVE:maintenanceRate'),'override still goes to human review');
hold(x=>delete x.approver,'CRITICAL_OVERRIDE_APPROVER_REQUIRED');
hold(x=>delete x.approvalReference,'CRITICAL_OVERRIDE_APPROVAL_REFERENCE_REQUIRED');
hold(x=>delete x.approvedAt,'CRITICAL_OVERRIDE_APPROVAL_DATE_REQUIRED');
hold(x=>x.approvedAt='not-a-date','CRITICAL_OVERRIDE_APPROVAL_DATE_REQUIRED');
hold(x=>x.approvedAt='2099-01-01T00:00:00.000Z','CRITICAL_OVERRIDE_APPROVAL_DATE_IN_FUTURE');
hold(x=>x.approvalStatus='PENDING','CRITICAL_OVERRIDE_APPROVAL_STATUS_REQUIRED');
hold(x=>x.approvalStatus='REJECTED','CRITICAL_OVERRIDE_APPROVAL_STATUS_REQUIRED');
hold(x=>x.sourceDate='2099-01-01T00:00:00.000Z','CRITICAL_OVERRIDE_SOURCE_DATE_IN_FUTURE');
hold(x=>x.expiresAt='not-a-date','CRITICAL_OVERRIDE_EXPIRY_DATE_INVALID');
hold(x=>x.expiresAt='2020-01-01T00:00:00.000Z','CRITICAL_ASSUMPTION_STALE:maintenanceRate');
hold(x=>x.value='0.06','CRITICAL_OVERRIDE_NUMERIC_VALUE_REQUIRED');
hold(x=>{},'CRITICAL_OVERRIDE_AS_OF_DATE_INVALID','invalid-as-of');
hold(x=>delete x.overrideReason,'OVERRIDE_REASON_REQUIRED');
const duplicate=evaluateAssumptionRegistry([valid(),valid()],{asOf:AS_OF});
eq(duplicate.status,ASSUMPTION_GATE_STATUS.HOLD,'duplicate critical override blocked');
yes(duplicate.blockers.some(x=>x==='DUPLICATE_ASSUMPTION_ID:maintenanceRate'),'duplicate ID disclosed');
const noOverride=valid();delete noOverride.override;delete noOverride.overrideReason;
delete noOverride.approver;delete noOverride.approvalReference;
delete noOverride.approvedAt;delete noOverride.approvalStatus;
const nonoverride=evaluate(noOverride);
eq(nonoverride.status,ASSUMPTION_GATE_STATUS.PASS,'non-overridden critical documented assumption maintains compatibility');
const noncritical=valid();noncritical.critical=false;delete noncritical.approver;
delete noncritical.approvalReference;delete noncritical.approvedAt;delete noncritical.approvalStatus;
eq(evaluate(noncritical).status,ASSUMPTION_GATE_STATUS.REVIEW,'noncritical override retains warning-only treatment');
const saved=withAssumptionRegistry({name:'P25-STRUCTURAL-FIXTURE'},[valid()]);
const stored=evaluateSavedDealAssumptionRegistry(saved,{asOf:AS_OF});
eq(stored.status,ASSUMPTION_GATE_STATUS.REVIEW,'persisted complete critical override stays REVIEW');
eq(stored.assumptions[0].approvalReference,'TEST-APPROVAL-001','saved approval reference preserved');
const unsupported=valid();delete unsupported.approver;
const savedHold=evaluateSavedDealAssumptionRegistry(
 withAssumptionRegistry({name:'P25-HOLD-FIXTURE'},[unsupported]),{asOf:AS_OF});
eq(savedHold.status,ASSUMPTION_GATE_STATUS.HOLD,'saved incomplete approval fails closed');
for (const [key,bad] of [['approver',123],['approvalReference',{}],['approvedAt',123],['approvalStatus',true]]) {
 const x=valid();x[key]=bad;
 assert.throws(()=>withAssumptionRegistry({name:'P25-TYPE-FIXTURE'},[x]),/INVALID_STRING_FIELD/);
 assertions++;
}
console.log('CRITICAL_OVERRIDE_PROVENANCE_GATE_20261109=PASS assertions='+assertions+' independently_approved=false calculator_unmodified=true');
