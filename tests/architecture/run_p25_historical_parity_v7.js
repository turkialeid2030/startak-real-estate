'use strict';
// P25 historical scenarios adapted to V7's explicitly non-authorizing contract.
// Install under tests/architecture/; automatically discovered by release:verify.
const assert = require('node:assert/strict');
const { calculateInvestmentCase, evaluateP25FinancialWhatIf, P25_WHAT_IF_STATUS, STUDY_TYPE } = require('../../src/engines');
const { buildCriticalAssumptionOverrideGovernance } = require('../../src/assumptions/critical-assumption-override-governance');
const { V2_CANONICAL_ASSUMPTIONS } = require('../../src/assumptions/assumption-model');
const { withAssumptionRegistry } = require('../../src/assumptions/saved-deal-assumption-registry');
const { UI_MODE, createUiWorkspace, hydrateUiDeal, calculateUiInvestmentState, buildUiDisclosureViewModel } = require('../../src/assumptions/ui-integration-controller');
const gold = require(require('../config/paths').getGoldBaselinePath());
const fixture = gold['RE-GOLD-002_existing_building'].inputs;
const inputs = {...fixture, leaseYears:fixture.holdPeriod+1, exitCapRate:0.07, exitTransferFeeRate:0.05, leverageEnabled:false};
const terms = {studyType:STUDY_TYPE.EXISTING_BUILDING,inputs,leverageEnabled:false,assumptionModelVersion:'V2'};
const asOf = '2026-11-27T00:00:00.000Z';
const record = {id:'maintenanceRate',value:0.06,unit:'ratio',critical:true,override:true,overrideReason:'Synthetic P25 parity',sourceType:'SYNTHETIC',sourceReference:'SYNTHETIC-P25-SOURCE',sourceDate:'2026-01-01T00:00:00.000Z',evidenceCount:1,confidence:'HIGH',owner:'synthetic-owner',reviewer:'synthetic-reviewer',approver:'synthetic-approver',approvalReference:'SYNTHETIC-P25-APPROVAL',approvedAt:'2026-01-02T00:00:00.000Z',approvalStatus:'APPROVED',expiresAt:'2027-01-01T00:00:00.000Z'};
let cases=0;
const check=(label,fn)=>{fn();cases++;console.log('P25_PARITY_CASE_PASS='+label);};
const govern=(registry,at=asOf)=>buildCriticalAssumptionOverrideGovernance({assumptionRegistry:registry,assumptionModelVersion:'V2',asOf:at});
const run=(registry,extra={})=>calculateInvestmentCase({...terms,assumptionRegistry:registry,...extra});
const scenario=(registry,extra={})=>evaluateP25FinancialWhatIf({...terms,assumptionRegistry:registry,asOf,...extra});
const flags=['independentApprovalVerified','professionalValuationAuthorized','financialDecisionAuthorized','transactionAuthorized','productionOverrideActivated'];
const baseline=run(undefined);
check('canonical-baseline',()=>{assert.equal(baseline.criticalAssumptionOverrideGovernance.status,'NO_OVERRIDES');assert.equal(baseline.criticalAssumptionOverrideGovernance.transactionAuthorized,false);assert.ok(Number.isFinite(baseline.NOI));assert.ok(Number.isFinite(baseline.npv));assert.ok(Number.isFinite(baseline.irr));});
check('documented-structural-review',()=>{const g=govern([record]);assert.equal(g.status,'READY');assert.equal(g.resolvedOverrides.maintenanceRate,0.06);assert.equal(g.overrides[0].baselineValue,V2_CANONICAL_ASSUMPTIONS.maintenanceRate);assert.ok(Math.abs(g.overrides[0].absoluteDelta-0.01)<1e-12);assert.ok(Math.abs(g.overrides[0].percentDelta-0.2)<1e-12);});
function assertCanonicalHold(result,expected='CRITICAL_OVERRIDE_NOT_APPLIED_IN_CANONICAL_ENGINE',base=baseline){
  assert.equal(result.decisionStatus,'INCOMPLETE_INPUTS');assert.equal(result.verdict,'INCOMPLETE_INPUTS');assert.equal(result.analyticalResultsOnly,true);assert.equal(result.appliedCriticalAssumptionOverrides,false);assert.equal(result.criticalAssumptionOverrideGovernance.baselineOnly,true);assert.equal(result.criticalAssumptionOverrideGovernance.approvalVerified,false);assert.ok(result.decisionBlockers.includes(expected));
  for(const key of ['NOI','npv','irr'])assert.equal(result[key],base[key],key+' must remain baseline-only');
}
check('documented-override-canonical-hold',()=>assertCanonicalHold(run([record])));
const variants=[
 ['missing-source',{sourceReference:null},'CRITICAL_OVERRIDE_SOURCE_EVIDENCE_REQUIRED'],
 ['missing-approver',{approver:null},'CRITICAL_OVERRIDE_APPROVER_REQUIRED'],
 ['missing-approval-reference',{approvalReference:null},'CRITICAL_OVERRIDE_APPROVAL_REFERENCE_REQUIRED'],
 ['missing-approval-date',{approvedAt:null},'CRITICAL_OVERRIDE_APPROVAL_DATE_REQUIRED'],
 ['pending',{approvalStatus:'PENDING'},'CRITICAL_OVERRIDE_APPROVAL_STATUS_REQUIRED'],
 ['numeric-string',{value:'0.06'},'CRITICAL_OVERRIDE_NUMERIC_VALUE_REQUIRED'],
 ['expired',{expiresAt:'2026-11-26T00:00:00.000Z'},'CRITICAL_OVERRIDE_EXPIRED'],
 ['invalid-expiry',{expiresAt:'2026-02-30'},'CRITICAL_OVERRIDE_EXPIRY_DATE_INVALID'],
 ['future-approval',{approvedAt:'2026-12-01T00:00:00.000Z'},'CRITICAL_OVERRIDE_APPROVAL_DATE_IN_FUTURE'],
 ['future-source',{sourceDate:'2026-12-01T00:00:00.000Z'},'CRITICAL_OVERRIDE_SOURCE_DATE_IN_FUTURE'],
 ['approval-before-source',{approvedAt:'2025-12-31T00:00:00.000Z'},'CRITICAL_OVERRIDE_APPROVAL_PRECEDES_SOURCE'],
 ['expiry-before-approval',{expiresAt:'2026-01-01T00:00:00.000Z'},'CRITICAL_OVERRIDE_EXPIRY_PRECEDES_APPROVAL']
];
for(const [label,patch,code] of variants){check(label,()=>{const registry=[{...record,...patch}];const g=govern(registry);assert.equal(g.decisionReady,false);assert.ok(g.blockers.includes(code+':maintenanceRate'));assertCanonicalHold(run(registry));const s=scenario(registry);assert.equal(s.status,P25_WHAT_IF_STATUS.INVALID);assert.equal(s.whatIf,null);assert.ok(s.reasonCodes.includes(code+':maintenanceRate'));for(const f of flags)assert.equal(s[f],false);});}
check('duplicate',()=>{const registry=[record,{...record,value:.07}];const g=govern(registry);assert.equal(g.decisionReady,false);assert.equal(g.resolvedOverrides.maintenanceRate,undefined);assert.ok(g.blockers.includes('DUPLICATE_CRITICAL_OVERRIDE:maintenanceRate'));assertCanonicalHold(run(registry));assert.equal(scenario(registry).status,P25_WHAT_IF_STATUS.INVALID);});
check('invalid-as-of',()=>{assert.throws(()=>govern([record],'invalid-as-of'),/asOf must be a valid date/);assert.equal(scenario([record],{asOf:'2026-02-30'}).status,P25_WHAT_IF_STATUS.INVALID);});
check('raw-input-not-an-approved-override',()=>{const r=run(undefined,{inputs:{...inputs,maintenanceRate:0.5}});assert.equal(r.NOI,baseline.NOI);});
check('isolated-real-engine-what-if',()=>{const s=scenario([record]);assert.equal(s.status,P25_WHAT_IF_STATUS.ANALYTICAL_HOLD,JSON.stringify(s.reasonCodes));assert.equal(s.baseline.NOI,baseline.NOI);assert.ok(Number.isFinite(s.whatIf.NOI));assert.ok(s.whatIf.NOI<s.baseline.NOI);assert.equal(s.deltas.NOI,s.whatIf.NOI-s.baseline.NOI);for(const key of ['npv','irr']){assert.ok(Number.isFinite(s.whatIf[key]));assert.equal(s.deltas[key],s.whatIf[key]-s.baseline[key]);}for(const f of flags)assert.equal(s[f],false);});
check('legacy-baseline-only',()=>{const base=run(undefined,{assumptionModelVersion:'LEGACY'});assertCanonicalHold(run([record],{assumptionModelVersion:'LEGACY'}),'CRITICAL_OVERRIDE_NOT_APPLIED_IN_CANONICAL_ENGINE',base);});
check('fresh-ui',()=>{const fresh=createUiWorkspace({mode:UI_MODE.BUILDING,defaultInputs:inputs});assert.equal(fresh.assumptionModelVersion,'V2');assert.equal(fresh.transactionAuthorized,false);assert.equal(fresh.inputs.maintenanceRate,V2_CANONICAL_ASSUMPTIONS.maintenanceRate);assert.equal(Object.hasOwn(fresh.inputs,'exitCapRate'),false);assert.equal(Object.hasOwn(fresh.inputs,'exitTransferFeeRate'),false);});
for(const complete of [true,false])check(complete?'complete-ui-hold':'incomplete-ui-hold',()=>{
 const item={...record};if(!complete){delete item.approver;delete item.approvalReference;delete item.approvedAt;delete item.sourceReference;item.approvalStatus='PENDING';}
 const saved=withAssumptionRegistry({id:'synthetic-p25',name:'Synthetic P25',mode:UI_MODE.BUILDING,inputs,assumptionModelVersion:'V2'},[item]);
 const restored=hydrateUiDeal({record:JSON.parse(JSON.stringify(saved)),defaultInputs:fixture});assert.deepEqual(restored.assumptionRegistry,[item]);assert.equal(restored.transactionAuthorized,false);
 const state=calculateUiInvestmentState({...restored,includePurchaseAlternative:true});assertCanonicalHold(state.results);assert.equal(state.assumptionOverrideHold,true);assert.equal(state.sensitivityReady,false);assert.equal(state.transactionAuthorized,false);for(const key of ['purchasePriceQualification','purchaseAlternative','purchaseCeilingCertificate'])assert.equal(state.results[key],null);
 for(const locale of ['ar-SA','en']){const v=buildUiDisclosureViewModel({governance:state.governance,locale});assert.equal(v.criticalOverrideHold,true);assert.equal(v.criticalOverrideIndependentlyApproved,false);assert.equal(v.userApprovedAssumptions,false);assert.equal(v.canonicalDefaultsAreApprovalEvidence,false);assert.equal(v.transactionAuthorized,false);assert.equal(v.sensitivityReady,false);assert.ok(v.criticalOverrideNotice.includes(locale==='en'?'not qualified':'غير مؤهل'));}
});
check('saved-record-duplicate-rejected',()=>assert.throws(()=>withAssumptionRegistry({id:'synthetic'},[record,record]),e=>e.reasonCode==='DUPLICATE_ASSUMPTION_ID'));
console.log('V7_P25_HISTORICAL_PARITY=PASS cases='+cases+' fixture=synthetic_reference no_independent_approval=true');
