'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {ASSET_CLASS}=require('../../src/project-model/project-profile');
const {VALUATION_METHOD}=require('../../src/valuation-intelligence/contracts');
const {EXPENSE_TREATMENT}=require('../../src/valuation-intelligence/income-capitalization');
const {STATUS,evaluatePersonalSectorScenarios:run}=require('../../src/valuation-intelligence/personal-sector-scenario-workbench');
let count=0;
function eq(a,b,msg){assert.deepEqual(a,b,msg);count++;}
function near(a,b,tol=0.02){assert.ok(typeof a==='number'&&Math.abs(a-b)<=tol,`${a} does not equal ${b}`);count++;}
const core={city:'الرياض',propertySubtype:'مكاتب',valuationDate:'2026-10-01',
 subjectAreaSqm:1000,propertyRight:'FREEHOLD',assetClass:ASSET_CLASS.OFFICE};
const income={annualEffectivePropertyIncome:1000000,annualPropertyOperatingExpenses:200000,
 capRate:0.08,expenseTreatment:EXPENSE_TREATMENT.ACTUAL_LANDLORD_OPEX};
const cost={landValue:4000000,replacementBuildingCost:8000000,depreciationRate:0.25};
const market={comparables:[1,2,3].map(i=>({
 comparableId:'SALE'+i,city:'الرياض',assetClass:ASSET_CLASS.OFFICE,
 propertySubtype:'مكاتب',propertyRight:'FREEHOLD',transactionDate:'2026-09-0'+i,
 transactionStatus:'EXECUTED_SALE',unitValue:10000,sourceRef:'DOC-'+i,
}))};
const reconciliationPolicy={maxDispersion:0.2,methodWeights:{
 [VALUATION_METHOD.INCOME_DIRECT_CAPITALIZATION]:0.4,
 [VALUATION_METHOD.COST_DEPRECIATED_REPLACEMENT]:0.3,
 [VALUATION_METHOD.MARKET_COMPARABLE]:0.3,
}};
const good=run({...core,income,cost,market,reconciliationPolicy});
eq(good.status,STATUS.RECONCILED);
eq(good.methods.length,3);
near(good.provisionalReconciledAmountSar,10000000);
eq(good.marketSalesIndependentlyVerified,false);
eq(good.professionalValuationCertified,false);
eq(good.transactionAuthorized,false);
eq(good.automaticPurchasePriceRecommendation,false);
eq(good.bankFinancingDecisionAuthorized,false);
eq(Object.isFrozen(good),true);

const classes=Object.values(ASSET_CLASS);
eq(classes.length,13);
for(const cls of classes){
 const sample=cls==='LAND'
  ?run({...core,assetClass:cls,propertySubtype:'أرض',income:{...income,groundLeaseEvidenceConfirmed:true}})
  :run({...core,assetClass:cls,propertySubtype:'عقار متخصص',cost:{
    ...cost,businessEquipmentExcluded:true,
  }});
 eq(sample.status,STATUS.PARTIAL,`sector ${cls} should support controlled method scenario`);
 eq(sample.methods.length,1);
 eq(sample.professionalValuationCertified,false);
 eq(sample.marketSalesIndependentlyVerified,false);
}
function holds(payload,reason){
 const r=run(payload);eq(r.status,STATUS.HOLD);
 assert.ok(r.reasonCodes.includes(reason),JSON.stringify(r.reasonCodes));count++;
 eq(r.provisionalReconciledAmountSar,null);
}
holds({...core,propertySubtype:''},'PROPERTY_SUBTYPE_REQUIRED');
holds({...core,valuationDate:'2026-99-99',income},'VALUATION_DATE_INVALID');
holds({...core,valuationDate:'2026-02-30',income},'VALUATION_DATE_INVALID');
holds({...core,propertyRight:'WAQF_RESTRICTED',income},'RESTRICTED_PROPERTY_INTEREST_REQUIRES_SPECIFIC_CASHFLOW_MODEL');
holds({...core,propertyRight:'LEASEHOLD',income},'RESTRICTED_PROPERTY_INTEREST_REQUIRES_SPECIFIC_CASHFLOW_MODEL');
holds({...core,assetClass:'FAKE',income},'UNKNOWN_ASSET_CLASS');
holds({...core,market:{comparables:market.comparables.slice(0,2)}},'AT_LEAST_THREE_EXECUTED_COMPARABLES_REQUIRED');
holds({...core,market:{comparables:[...market.comparables.slice(0,2),{...market.comparables[2],transactionStatus:'ASKING_SALE'}]}},
 'MARKET_COMPARABLE_IDENTITY_DATE_OR_STATUS_INVALID');
holds({...core,market:{comparables:[...market.comparables.slice(0,2),{...market.comparables[2],city:'جدة'}]}},
 'MARKET_COMPARABLE_IDENTITY_DATE_OR_STATUS_INVALID');
holds({...core,market:{comparables:[...market.comparables.slice(0,2),{...market.comparables[2],propertySubtype:'عيادة'}]}},
 'MARKET_COMPARABLE_IDENTITY_DATE_OR_STATUS_INVALID');
holds({...core,market:{comparables:[...market.comparables.slice(0,2),{...market.comparables[2],propertyRight:'LEASEHOLD'}]}},
 'MARKET_COMPARABLE_IDENTITY_DATE_OR_STATUS_INVALID');
holds({...core,market:{comparables:[...market.comparables.slice(0,2),{...market.comparables[2],transactionDate:'2026-12-01'}]}},
 'MARKET_COMPARABLE_IDENTITY_DATE_OR_STATUS_INVALID');
holds({...core,market:{comparables:[...market.comparables.slice(0,2),{...market.comparables[2],comparableId:'SALE1'}]}},
 'MARKET_COMPARABLE_IDENTITY_DATE_OR_STATUS_INVALID');
holds({...core,income:{...income,capRate:0}},'CAP_RATE_MISSING_OR_OUT_OF_BOUNDS');
holds({...core,income:{...income,annualPropertyOperatingExpenses:1000000}},'PROPERTY_NOI_INPUTS_INVALID');
holds({...core,assetClass:'HOSPITALITY',income},'OPERATING_BUSINESS_NOI_NOT_SEPARATED');
holds({...core,assetClass:'MIXED_USE',income:{...income,realEstateOnlyConfirmed:true}},
 'MIXED_USE_SHARED_COSTS_UNALLOCATED');
holds({...core,assetClass:'LAND',income},'GROUND_RENT_INSTEAD_OF_BUILDING_NOI_REQUIRED');
holds({...core,assetClass:'LAND',cost},'LAND_ONLY_REQUIRES_LAND_METHOD_NOT_BUILDING_REPLACEMENT');
holds({...core,assetClass:'DATA_CENTER',cost},'NON_REAL_ESTATE_COMPONENTS_NOT_EXCLUDED_FROM_COST');
holds({...core,income:{...income,annualPropertyOperatingExpenses:0}},'ZERO_OPEX_NO_TENANT_POLICY');
const costWrong=run({...core,income,cost:{...cost,landValue:-1}});
eq(costWrong.status,STATUS.HOLD);
eq(costWrong.methods.length,0);
const unmatched=run({...core,income,cost:{...cost,replacementBuildingCost:23000000},
 reconciliationPolicy:{maxDispersion:0.1,methodWeights:{
 [VALUATION_METHOD.INCOME_DIRECT_CAPITALIZATION]:0.5,
 [VALUATION_METHOD.COST_DEPRECIATED_REPLACEMENT]:0.5}}});
eq(unmatched.status,STATUS.PARTIAL);
eq(unmatched.provisionalReconciledAmountSar,null);
assert.ok(unmatched.reasonCodes.includes('HOLD_DISPERSION'));count++;
const wrongWeight=run({...core,income,cost,reconciliationPolicy:{maxDispersion:0.2,
 methodWeights:{[VALUATION_METHOD.INCOME_DIRECT_CAPITALIZATION]:0.8,
 [VALUATION_METHOD.COST_DEPRECIATED_REPLACEMENT]:0.8}}});
eq(wrongWeight.status,STATUS.PARTIAL);
eq(wrongWeight.provisionalReconciledAmountSar,null);
assert.ok(wrongWeight.reasonCodes.includes('RECONCILIATION_POLICY_INVALID'));count++;
const pathRoot=path.resolve(__dirname,'../..');
const panel=fs.readFileSync(path.join(pathRoot,'src/components/PersonalSectorValuationWorkbench.jsx'),'utf8');
const universe=fs.readFileSync(path.join(pathRoot,'src/components/PersonalAssetUniversePanel.jsx'),'utf8');
assert.match(universe,/<PersonalSectorValuationWorkbench key=\{assetClass\} assetClass=\{assetClass\} locale=\{locale\}/);count++;
assert.match(panel,/data-testid="personal-sector-calculate"/);count++;
assert.match(panel,/data-testid="personal-sector-scenario-output"/);count++;
assert.match(panel,/لا توجد أرقام افتراضية مخفية/);count++;
assert.match(panel,/sourceRef:c.source/);count++;
console.log('PERSONAL_13_ASSET_CLASS_MULTI_METHOD_SCENARIO_GATE=PASS checks='+count);
