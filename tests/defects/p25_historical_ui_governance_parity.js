'use strict';
const assert=require('node:assert/strict');
const {UI_MODE,createUiWorkspace,hydrateUiDeal,calculateUiInvestmentState,buildUiDisclosureViewModel}=require('../../src/assumptions/ui-integration-controller');
const {V2_CANONICAL_ASSUMPTIONS}=require('../../src/assumptions/assumption-model');
const gold=require(require('../config/paths').getGoldBaselinePath());
const g=gold['RE-GOLD-002_existing_building'].inputs;
const inputs={...g,leaseYears:g.holdPeriod+1,exitCapRate:0.07,exitTransferFeeRate:0.05,leverageEnabled:false};
const row={id:'maintenanceRate',value:0.06,critical:true,override:true,overrideReason:'Synthetic UI P25',
 sourceType:'INTERNAL_APPROVED_EVIDENCE',sourceReference:'SYNTH-SOURCE',sourceDate:'2026-10-20',
 approver:'synthetic-reviewer',approvalReference:'SYNTH-APPROVAL',approvedAt:'2026-10-21',approvalStatus:'APPROVED'};
const fresh=createUiWorkspace({mode:UI_MODE.BUILDING,defaultInputs:inputs});
assert.equal(fresh.assumptionModelVersion,'V2');
assert.equal(fresh.transactionAuthorized,false);
assert.equal(fresh.inputs.maintenanceRate,V2_CANONICAL_ASSUMPTIONS.maintenanceRate);
assert.equal(Object.hasOwn(fresh.inputs,'exitCapRate'),false);
assert.equal(Object.hasOwn(fresh.inputs,'exitTransferFeeRate'),false);
const incomplete={...row};delete incomplete.sourceReference;delete incomplete.approver;
for(const record of [row,incomplete]){
 const workspace=hydrateUiDeal({record:{id:'p25-ui-parity',name:'Synthetic UI',mode:'building',inputs,assumptionModelVersion:'V2',assumptionRegistry:[record]},defaultInputs:g});
 assert.deepEqual(workspace.assumptionRegistry,[record]);
 const result=calculateUiInvestmentState({...workspace,includePurchaseAlternative:true});
 assert.equal(result.assumptionOverrideHold,true);
 assert.equal(result.transactionAuthorized,false);
 assert.equal(result.sensitivityReady,false);
 assert.equal(result.results.decisionStatus,'INCOMPLETE_INPUTS');
 assert.equal(result.results.purchasePriceQualification,null);
 assert.equal(result.results.purchaseAlternative,null);
 assert.equal(result.results.purchaseCeilingCertificate,null);
 assert.equal(result.governance.sensitivityReady,false);
 assert.equal(result.governance.sensitivity.ready,false);
 assert.ok(result.governance.sensitivity.reasonCodes.includes('ASSUMPTION_OVERRIDE_NOT_QUALIFIED'));
 for(const locale of ['ar-SA','en']){
  const view=buildUiDisclosureViewModel({governance:result.governance,locale});
  assert.equal(view.sensitivityReady,false);
  assert.equal(view.criticalOverrideHold,true);
  assert.equal(view.criticalOverrideIndependentlyApproved,false);
  assert.equal(view.userApprovedAssumptions,false);
  assert.equal(view.canonicalDefaultsAreApprovalEvidence,false);
  assert.deepEqual(view.independentlyApprovedAssumptionKeys,[]);
  assert.ok(view.criticalOverrideNotice);
  assert.equal(view.transactionAuthorized,false);
 }
}
console.log('P25_HISTORICAL_UI_GOVERNANCE_PARITY=PASS');
