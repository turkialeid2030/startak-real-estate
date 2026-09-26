'use strict';
const assert=require('assert');
const {evaluateHighestAndBestUse,HBU_STATUS}=require('../../src/valuation-intelligence/hbu-land-bid');

const base={landAreaSqm:10000,requiredDeveloperMarginRate:.2,acquisitionCostsRate:.05,evidenceComplete:true,alternatives:[
 {id:'RESIDENTIAL',legallyPermissible:true,physicallyPossible:true,grossDevelopmentValueSar:100000000,hardCostsSar:45000000,softCostsSar:8000000,financeCostsSar:5000000,contingencySar:3000000,sellingCostsSar:4000000},
 {id:'MIXED_USE',legallyPermissible:true,physicallyPossible:true,grossDevelopmentValueSar:120000000,hardCostsSar:58000000,softCostsSar:9000000,financeCostsSar:6000000,contingencySar:4000000,sellingCostsSar:5000000}
]};
const result=evaluateHighestAndBestUse(base);
assert.ok([HBU_STATUS.QUALIFIED,HBU_STATUS.REVIEW_REQUIRED].includes(result.status));
assert.strictEqual(result.selected.id,'MIXED_USE');
assert.ok(result.selected.maximumLandBidSar>0);
assert.ok(result.selected.bidPerSqmSar>0);
assert.ok(Number.isFinite(result.selected.residualBeforeAcquisitionSar));
assert.strictEqual(result.transactionAuthorized,false);
assert.strictEqual(result.humanDecisionRequired,true);

assert.strictEqual(evaluateHighestAndBestUse({...base,evidenceComplete:false}).status,HBU_STATUS.HOLD);
const illegal=evaluateHighestAndBestUse({...base,alternatives:[{...base.alternatives[0],legallyPermissible:false}]});
assert.strictEqual(illegal.status,HBU_STATUS.REVIEW_REQUIRED);assert.strictEqual(illegal.selected,null);
const badCost=evaluateHighestAndBestUse({...base,alternatives:[{...base.alternatives[0],hardCostsSar:-1}]});
assert.strictEqual(badCost.status,HBU_STATUS.HOLD);
const zeroGdv=evaluateHighestAndBestUse({...base,alternatives:[{...base.alternatives[0],grossDevelopmentValueSar:0}]});
assert.strictEqual(zeroGdv.status,HBU_STATUS.HOLD);
const duplicate=evaluateHighestAndBestUse({...base,alternatives:[base.alternatives[0],{...base.alternatives[1],id:'RESIDENTIAL'}]});
assert.strictEqual(duplicate.status,HBU_STATUS.HOLD);
const missingGate=evaluateHighestAndBestUse({...base,alternatives:[{...base.alternatives[0],legallyPermissible:undefined}]});
assert.strictEqual(missingGate.status,HBU_STATUS.HOLD);
const infeasible=evaluateHighestAndBestUse({...base,alternatives:[{...base.alternatives[0],hardCostsSar:90000000,softCostsSar:10000000,financeCostsSar:5000000,contingencySar:5000000,sellingCostsSar:5000000}]});
assert.strictEqual(infeasible.status,HBU_STATUS.REVIEW_REQUIRED);assert.strictEqual(infeasible.selected,null);
console.log('financial_integrity_p8_hbu_land_bid: PASS');
