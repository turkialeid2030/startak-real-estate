'use strict';
const assert=require('node:assert/strict');
const {calculateInvestmentCase,evaluateP25FinancialWhatIf,P25_WHAT_IF_STATUS,STUDY_TYPE}=require('../../src/engines');
const u=require('../characterization/fixtures/RE-GOLD-002-U.json');
const l=require('../characterization/fixtures/RE-GOLD-002-L.json');
const AS_OF='2026-11-13T08:00:00.000Z';
const record=(value=.08)=>({
 id:'managementFeeRate',critical:true,override:true,value,
 sourceType:'SYNTHETIC_INTERNAL_POLICY',sourceReference:'SYNTHETIC-NOT-AUTHENTICATED',
 sourceDate:'2026-11-10T10:00:00Z',
 overrideReason:'Synthetic what-if sensitivity only',
 approver:'SYNTHETIC_REVIEWER_NOT_VERIFIED',
 approvalReference:'SYNTHETIC_APPROVAL_NOT_VERIFIED',
 approvedAt:'2026-11-11T10:00:00Z',
 approvalStatus:'APPROVED',expiresAt:'2026-11-30T00:00:00Z',
});
const terms=fixture=>({
 studyType:STUDY_TYPE.EXISTING_BUILDING,
 inputs:{...fixture.input_set,leaseYears:6,exitCapRate:.07,exitTransferFeeRate:.05},
 assumptionModelVersion:'V2',
});
for(const fixture of [u,l]){
 const args=terms(fixture),original=JSON.stringify(args);
 const before=calculateInvestmentCase(args);
 const v=evaluateP25FinancialWhatIf({...args,assumptionRegistry:[record()],asOf:AS_OF});
 assert.equal(v.status,P25_WHAT_IF_STATUS.ANALYTICAL_HOLD);
 assert.equal(v.structuralReview,'READY');
 assert.deepEqual(v.comparedAssumptionKeys,['managementFeeRate']);
 assert(v.whatIf.NOI<v.baseline.NOI,'Higher management fee must reduce NOI');
 assert(v.whatIf.npv<v.baseline.npv,'Higher recurring management fee must reduce NPV');
 assert(v.whatIf.irr<v.baseline.irr,'Higher recurring management fee must reduce IRR');
 assert(v.deltas.NOI<0);
 assert(v.whatIf.cashflows.some((x,i)=>Math.abs(x-v.baseline.cashflows[i])>0.01));
 assert.equal(v.baseline.NOI,before.NOI);
 assert.equal(v.baseline.npv,before.npv);
 assert.equal(v.baseline.irr,before.irr);
 assert.equal(v.baseline.loanAmount,before.loanAmount);
 assert.equal(v.independentApprovalVerified,false);
 assert.equal(v.financialDecisionAuthorized,false);
 assert.equal(v.transactionAuthorized,false);
 assert.equal(v.productionOverrideActivated,false);
 assert.equal(Object.hasOwn(v,'verdict'),false);
 assert.equal(Object.hasOwn(v.whatIf,'verdict'),false);
 assert.equal(Object.hasOwn(v.whatIf,'decisionStatus'),false);
 assert.equal(Object.hasOwn(v.whatIf,'criticalAssumptionOverrideGovernance'),false);
 assert(Object.isFrozen(v));
 assert(Object.isFrozen(v.whatIf));
 assert.equal(JSON.stringify(args),original,'No mutation of real engine inputs');
 const after=calculateInvestmentCase(args);
 assert.deepEqual(after.cashflows,before.cashflows,'Canonical cashflows unchanged by research scenario');
 // Normal public finance requests with raw submitted overrides still HOLD
 // and must not apply those requested economic changes.
 const raw=calculateInvestmentCase({...args,assumptionRegistry:[record()]});
 assert.equal(raw.criticalAssumptionOverrideGovernance.status,'HOLD_UNSUPPORTED_OVERRIDE_PATH');
 assert.equal(raw.decisionStatus,'INCOMPLETE_INPUTS');
 assert.deepEqual(raw.cashflows,before.cashflows);
 const fakeInProcess=calculateInvestmentCase(args,{
  marker:Symbol.for('p25-private-analytical-sensitivity'),
  overrides:{managementFeeRate:.75}
 });
 assert.deepEqual(fakeInProcess.cashflows,before.cashflows);
}
const a=terms(u);
function denied(entries,expected){
 const r=evaluateP25FinancialWhatIf({...a,assumptionRegistry:entries,asOf:AS_OF});
 assert.equal(r.status,P25_WHAT_IF_STATUS.INVALID);
 assert(r.reasonCodes.includes(expected),JSON.stringify(r.reasonCodes));
 assert.equal(r.whatIf,null);
 assert.equal(r.productionOverrideActivated,false);
}
denied(undefined,'P25_CRITICAL_OVERRIDE_REGISTRY_REQUIRED');
denied([],'P25_CRITICAL_OVERRIDE_REGISTRY_REQUIRED');
denied([{...record(),id:'unknownOpex'}],'P25_UNKNOWN_OR_MALFORMED_OVERRIDE_FORBIDDEN');
denied([{...record(),override:'true'}],'P25_UNKNOWN_OR_MALFORMED_OVERRIDE_FORBIDDEN');
denied([record(),record(.12)],'DUPLICATE_CRITICAL_OVERRIDE:managementFeeRate');
denied([{...record(),approvalStatus:'PENDING'}],'CRITICAL_OVERRIDE_APPROVAL_STATUS_REQUIRED:managementFeeRate');
denied([{...record(),sourceReference:''}],'CRITICAL_OVERRIDE_SOURCE_EVIDENCE_REQUIRED:managementFeeRate');
denied([{...record(),expiresAt:'2026-11-10T00:00:00Z'}],'CRITICAL_OVERRIDE_EXPIRED:managementFeeRate');
denied([{...record(),approvedAt:'2026-11-20T00:00:00Z'}],'CRITICAL_OVERRIDE_APPROVAL_DATE_IN_FUTURE:managementFeeRate');
denied([record(2)],'P25_FINANCIAL_SCENARIO_INPUTS_INVALID');
const invalidV=evaluateP25FinancialWhatIf({...a,studyType:STUDY_TYPE.LAND_DEVELOPMENT,assumptionRegistry:[record()],asOf:AS_OF});
assert.equal(invalidV.status,P25_WHAT_IF_STATUS.INVALID);
assert.deepEqual(invalidV.reasonCodes,['P25_WHAT_IF_V2_BUILDING_INPUTS_REQUIRED']);
const original=require('../../src/assumptions/assumption-model');
const rawClient={...a.inputs,maintenanceRate:.89,managementFeeRate:.95,fixedOpexPerSqm:8000};
const applied=original.applyAssumptionModel(rawClient,'V2');
assert.equal(applied.maintenanceRate,.05);
assert.equal(applied.managementFeeRate,.035);
assert.equal(applied.fixedOpexPerSqm,40);
console.log('STARTAK_RE_P25_REAL_ECONOMIC_WHATIF=PASS');
