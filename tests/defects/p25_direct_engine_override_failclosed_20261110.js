'use strict';
// The current branch has not ported P25's economics. A declared override must
// never be silently treated as applied to baseline NPV/IRR.
const assert=require('node:assert/strict');
const {calculateInvestmentCase,STUDY_TYPE}=require('../../src/engines');
const {ASSUMPTION_MODEL_VERSION}=require('../../src/assumptions/assumption-model');
const gold=require(require('../config/paths').getGoldBaselinePath());
const inputs={
 ...gold['RE-GOLD-002_existing_building'].inputs,
 leaseYears:gold['RE-GOLD-002_existing_building'].inputs.holdPeriod+1,
 exitCapRate:0.07,
 exitTransferFeeRate:0.05,
 leverageEnabled:false,
};
const args={
 studyType:STUDY_TYPE.EXISTING_BUILDING,
 inputs,
 leverageEnabled:false,
 assumptionModelVersion:ASSUMPTION_MODEL_VERSION.V2,
};
let checks=0;
function eq(a,b,message){assert.deepStrictEqual(a,b,message);checks++}
function yes(a,message){assert.ok(a,message);checks++}
const baseline=calculateInvestmentCase(args);
const empty=calculateInvestmentCase({...args,assumptionRegistry:[]});
eq(empty.npv,baseline.npv,'empty extra registry leaves baseline NPV');
eq(empty.irr,baseline.irr,'empty extra registry leaves baseline IRR');
eq(empty.decisionStatus,baseline.decisionStatus,'empty extra registry no artificial hold');
const claimedApproved=[
 {id:'maintenanceRate',value:.06,unit:'ratio',critical:true,override:true,
  sourceType:'INTERNAL_APPROVED_EVIDENCE',sourceReference:'TEST-P25-OVERRIDE',
  sourceDate:'2026-09-01T00:00:00.000Z',owner:'investment',
  overrideReason:'Synthetic test exception',
  approver:'reviewer',approvalReference:'TEST-P25-CLAIM',
  approvedAt:'2026-09-02T00:00:00.000Z',approvalStatus:'APPROVED'}
];
const blocked=calculateInvestmentCase({...args,assumptionRegistry:claimedApproved});
eq(blocked.npv,baseline.npv,'no unimplemented override changes baseline NPV');
eq(blocked.irr,baseline.irr,'no unimplemented override changes baseline IRR');
eq(blocked.NOI,baseline.NOI,'no unimplemented override changes baseline NOI');
eq(blocked.cashflows,baseline.cashflows,'baseline cashflow time series unchanged');
eq(blocked.decisionStatus,'INCOMPLETE_INPUTS','critical override cannot obtain investment decision');
eq(blocked.verdict,'INCOMPLETE_INPUTS','critical override cannot obtain false positive verdict');
eq(blocked.analyticalResultsOnly,true,'baseline research explicitly unapproved');
eq(blocked.appliedCriticalAssumptionOverrides,false,'no claim of applying unsupported override');
eq(blocked.criticalAssumptionOverrideGovernance.decisionReady,false,'unported P25 path not ready');
eq(blocked.criticalAssumptionOverrideGovernance.approvalVerified,false,'claimed approval not verified');
yes(blocked.decisionBlockers.includes('CRITICAL_OVERRIDE_NOT_APPLIED_IN_CANONICAL_ENGINE'),'explicit P25 blocker');
eq(blocked.metCount,null,'previous positive criteria blocked');
eq(blocked.totalCriteria,null,'previous total criteria suppressed');
eq(blocked.criteriaDetail,null,'old criteria cannot convey false recommendation');
const missingApproval=structuredClone(claimedApproved);
delete missingApproval[0].approver;
const miss=calculateInvestmentCase({...args,assumptionRegistry:missingApproval});
eq(miss.decisionStatus,'INCOMPLETE_INPUTS','missing approval also blocked');
eq(miss.irr,baseline.irr,'baseline IRR still preserved for audit');
const noncritical=calculateInvestmentCase({...args,assumptionRegistry:[
 {id:'custom-operating-ratio',value:.3,override:true,critical:false},
]});
yes(noncritical.decisionBlockers.includes('ASSUMPTION_OVERRIDE_NOT_APPLIED_IN_CANONICAL_ENGINE'),
 'unported noncritical override is never silently accepted');
const malformed=calculateInvestmentCase({...args,assumptionRegistry:{}});
yes(malformed.decisionBlockers.includes('ASSUMPTION_REGISTRY_ARRAY_REQUIRED'),
 'malformed registry withholds decision');
const untouched=calculateInvestmentCase(args);
eq(untouched.npv,baseline.npv,'no hidden engine mutation after attempted override');
eq(untouched.decisionStatus,baseline.decisionStatus,'default cases remain untouched');
console.log('P25_DIRECT_OVERRIDE_FAIL_CLOSED=PASS checks='+checks+' baseline_economics_preserved=true'+
 ' override_economics_not_implemented=true professional_approval=false');
