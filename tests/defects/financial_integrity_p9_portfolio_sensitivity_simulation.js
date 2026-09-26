'use strict';
const assert=require('assert');
const {evaluatePortfolioDecision,PORTFOLIO_STATUS}=require('../../src/valuation-intelligence/portfolio-decision-cockpit');

const baseAssets=[
 {id:'A',valueSar:4000000,noiSar:360000,annualDebtServiceSar:180000,city:'Riyadh',assetType:'OFFICE'},
 {id:'B',valueSar:3000000,noiSar:300000,annualDebtServiceSar:150000,city:'Jeddah',assetType:'LOGISTICS'},
 {id:'C',valueSar:3000000,noiSar:270000,annualDebtServiceSar:135000,city:'Dammam',assetType:'RESIDENTIAL'}
];
const limits={maxSingleAssetWeight:.55,maxCityWeight:.65,maxAssetTypeWeight:.65,minPortfolioDscr:1.5};
let cases=0;
for(const valueShock of [-.25,-.10,0,.10,.25]){
 for(const noiShock of [-.25,-.10,0,.10,.25]){
  for(const debtShock of [0,.10,.25]){
   const assets=baseAssets.map((a,i)=>({
    ...a,
    valueSar:a.valueSar*(i===0?1+valueShock:1),
    noiSar:a.noiSar*(1+noiShock),
    annualDebtServiceSar:a.annualDebtServiceSar*(1+debtShock)
   }));
   const r=evaluatePortfolioDecision({assets,limits});
   assert.ok([PORTFOLIO_STATUS.QUALIFIED,PORTFOLIO_STATUS.REVIEW_REQUIRED].includes(r.status));
   assert.strictEqual(r.transactionAuthorized,false);
   assert.strictEqual(r.humanDecisionRequired,true);
   assert.ok(r.metrics.totalValueSar>0);
   assert.ok(r.metrics.totalNoiSar>=0);
   assert.ok(r.metrics.portfolioDscr>0);
   const assetWeightSum=r.metrics.assetWeights.reduce((s,x)=>s+x.weight,0);
   assert.ok(Math.abs(assetWeightSum-1)<1e-12);
   cases++;
  }
 }
}
assert.strictEqual(cases,75);

// Concentration invariants: making one asset dominate must trigger a breach.
const dominant=evaluatePortfolioDecision({assets:[
 {...baseAssets[0],valueSar:9000000},
 {...baseAssets[1],valueSar:500000},
 {...baseAssets[2],valueSar:500000}
],limits});
assert.strictEqual(dominant.status,PORTFOLIO_STATUS.REVIEW_REQUIRED);
assert.ok(dominant.warnings.includes('SINGLE_ASSET_CONCENTRATION_BREACH'));

// Debt-service stress invariant: higher debt service cannot improve DSCR.
const normal=evaluatePortfolioDecision({assets:baseAssets,limits});
const stressed=evaluatePortfolioDecision({assets:baseAssets.map(a=>({...a,annualDebtServiceSar:a.annualDebtServiceSar*1.5})),limits});
assert.ok(stressed.metrics.portfolioDscr<normal.metrics.portfolioDscr);

console.log(`financial_integrity_p9_portfolio_sensitivity_simulation: PASS (${cases} matrix cases + concentration/DSCR invariants)`);
