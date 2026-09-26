'use strict';
const assert=require('assert');
const {evaluateHighestAndBestUse,HBU_STATUS}=require('../../src/valuation-intelligence/hbu-land-bid');

const template={
 landAreaSqm:10000,
 acquisitionCostsRate:.05,
 evidenceComplete:true,
 alternatives:[{
  id:'BASE',legallyPermissible:true,physicallyPossible:true,
  grossDevelopmentValueSar:100000000,
  hardCostsSar:45000000,softCostsSar:8000000,financeCostsSar:5000000,contingencySar:3000000,sellingCostsSar:4000000
 }]
};

const gdvShocks=[-.25,-.15,0,.10,.20];
const costShocks=[0,.05,.10,.20,.35];
const margins=[.15,.20,.25];
let cases=0;
for(const gdvShock of gdvShocks){
 for(const costShock of costShocks){
  for(const margin of margins){
   const a=template.alternatives[0];
   const shocked={...a,
    grossDevelopmentValueSar:a.grossDevelopmentValueSar*(1+gdvShock),
    hardCostsSar:a.hardCostsSar*(1+costShock),
    softCostsSar:a.softCostsSar*(1+costShock),
    financeCostsSar:a.financeCostsSar*(1+costShock),
    contingencySar:a.contingencySar*(1+costShock),
    sellingCostsSar:a.sellingCostsSar*(1+costShock)
   };
   const r=evaluateHighestAndBestUse({...template,requiredDeveloperMarginRate:margin,alternatives:[shocked]});
   assert.ok([HBU_STATUS.QUALIFIED,HBU_STATUS.REVIEW_REQUIRED].includes(r.status));
   assert.strictEqual(r.transactionAuthorized,false);
   if(r.selected){
    assert.ok(Number.isFinite(r.selected.maximumLandBidSar));
    assert.ok(Number.isFinite(r.selected.bidPerSqmSar));
    assert.ok(r.selected.maximumLandBidSar>0);
   }
   cases++;
  }
 }
}
assert.strictEqual(cases,75);

// Monotonicity: higher acquisition load, higher developer margin, or higher costs must not increase land bid.
function bid(opts){
 const r=evaluateHighestAndBestUse({...template,requiredDeveloperMarginRate:opts.margin,acquisitionCostsRate:opts.acq,alternatives:[{...template.alternatives[0],hardCostsSar:45000000*(1+opts.costShock)}]});
 return r.selected?r.selected.maximumLandBidSar:null;
}
const b0=bid({margin:.15,acq:0,costShock:0});
const bAcq=bid({margin:.15,acq:.10,costShock:0});
const bMargin=bid({margin:.25,acq:0,costShock:0});
const bCost=bid({margin:.15,acq:0,costShock:.20});
assert.ok(bAcq<b0);
assert.ok(bMargin<b0);
assert.ok(bCost<b0);

// Downside should fail closed into review when residual turns non-positive.
const downside=evaluateHighestAndBestUse({...template,requiredDeveloperMarginRate:.25,alternatives:[{...template.alternatives[0],grossDevelopmentValueSar:65000000,hardCostsSar:50000000,softCostsSar:10000000,financeCostsSar:5000000,contingencySar:5000000,sellingCostsSar:5000000}]});
assert.strictEqual(downside.status,HBU_STATUS.REVIEW_REQUIRED);
assert.strictEqual(downside.selected,null);

console.log(`financial_integrity_p8_hbu_sensitivity_simulation: PASS (${cases} matrix cases + monotonic/downside checks)`);
