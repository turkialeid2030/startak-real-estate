'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {assessPersonalPhasedDevelopment:assess,STATUS,MODEL_VERSION}=require('../../src/valuation-intelligence/personal-phased-development-dcf');
let count=0;
function eq(actual,expected,message){assert.deepEqual(actual,expected,message);count++;}
function ok(value,message){assert.ok(value,message);count++;}
const base=()=>({
 assetClass:'LAND',propertyRight:'FREEHOLD',valuationDate:'2026-10-25',
 landAreaSqm:200,annualDiscountRate:0.1,
 periods:[
  {month:0,gdvReceiptsSar:0,constructionCostsSar:200,otherDevelopmentCostsSar:0},
  {month:12,gdvReceiptsSar:1000,constructionCostsSar:300,otherDevelopmentCostsSar:0},
  {month:24,gdvReceiptsSar:500,constructionCostsSar:100,otherDevelopmentCostsSar:0},
 ],
 riskAndDeveloperReturnIncludedInDiscountRate:true,
 noSeparateDeveloperProfitOrRiskSpread:true,
 noFinancingCostsOrDebtServiceIncluded:true,
 nonRealtyBusinessAndEquipmentExcluded:true,
 documentedTimingReviewed:true,
});
function held(change,code){
 const result=assess({...base(),...change});
 eq(result.status,STATUS.HOLD,'rejected case is HOLD: '+code);
 ok(result.reasonCodes.includes(code),'held with actual reason: '+code);
 eq(result.landResidualPvSar,null,'no certified or usable price on HOLD: '+code);
 eq(result.transactionAuthorized,false,'never authority: '+code);
}
const first=assess(base());
eq(first.modelVersion,MODEL_VERSION,'versioned research contract');
eq(first.status,STATUS.RESEARCH,'hand-worked input ready for research');
const hand=-200+700/1.1+400/(1.1*1.1);
ok(Math.abs(first.landResidualPvSar-hand)<1e-7,'every month discounts independently');
ok(Math.abs(first.landResidualPvPerSqmSar-hand/200)<1e-8,'area conversion');
eq(first.nominalNetBeforeLandSar,900,'nominal is distinct and not terminal-discounted');
eq(first.periods[0].discountFactor,1,'month zero factor one');
ok(Math.abs(first.periods[1].discountFactor-1.1)<1e-12,'month 12 one year');
ok(Math.abs(first.periods[2].discountFactor-1.21)<1e-12,'month 24 two years');
eq(first.transactionAuthorized,false,'no transaction');
eq(first.officialValuationCertified,false,'no certified appraisal');
eq(first.independentMarketEvidenceVerified,false,'no pretend market sources');
ok(Object.isFrozen(first.periods[0]),'result immutable');
const later=assess({...base(),periods:base().periods.map(p=>p.month===12?{...p,month:18}:p)});
ok(later.landResidualPvSar<first.landResidualPvSar,'delay in net income lowers discounted residual');
const overrun=assess({...base(),periods:base().periods.map(p=>p.month===12?{...p,constructionCostsSar:500}:p)});
ok(overrun.landResidualPvSar<first.landResidualPvSar,'construction cost stress reduces land residual');
held({riskAndDeveloperReturnIncludedInDiscountRate:false},'RISK_AND_DEVELOPER_RETURN_TREATMENT_REQUIRED');
held({noSeparateDeveloperProfitOrRiskSpread:false},'DEVELOPER_RETURN_DOUBLE_COUNT_RISK');
held({noFinancingCostsOrDebtServiceIncluded:false},'FINANCING_AND_DISCOUNT_DOUBLE_COUNT_RISK');
held({assetClass:'HOSPITALITY'},'LAND_DEVELOPMENT_ONLY');
held({propertyRight:'WAQF_RESTRICTED'},'LEGAL_PROPERTY_RIGHT_REQUIRES_SEPARATE_MODEL');
held({valuationDate:'2026-02-30'},'VALUATION_DATE_INVALID');
held({landAreaSqm:0},'LAND_AREA_REQUIRED');
held({annualDiscountRate:-0.1},'DISCOUNT_RATE_INVALID');
held({annualDiscountRate:0},'ZERO_RATE_WITH_FUTURE_DEVELOPMENT_HOLD');
held({annualDiscountRate:1},'DISCOUNT_RATE_INVALID');
held({documentedTimingReviewed:false},'DATED_PHASES_NOT_REVIEWED');
held({nonRealtyBusinessAndEquipmentExcluded:false},'NON_REALTY_GDV_NOT_EXCLUDED');
const withoutAssertions=base();delete withoutAssertions.riskAndDeveloperReturnIncludedInDiscountRate;
eq(assess(withoutAssertions).status,STATUS.HOLD,'omitted risk declaration is HOLD');
held({periods:base().periods.map(p=>({...p,month:12}))},'DUPLICATE_MONTH');
held({periods:base().periods.map(p=>({...p,month:12.5}))},'PHASE_MONTH_INVALID');
held({periods:base().periods.map(p=>({...p,month:121}))},'PHASE_MONTH_INVALID');
held({periods:base().periods.slice(0,1)},'PHASES_2_TO_24_REQUIRED');
held({periods:base().periods.map(p=>({...p,gdvReceiptsSar:0}))},'DATED_GDV_REQUIRED');
held({periods:base().periods.map(p=>({...p,constructionCostsSar:0}))},'DATED_CONSTRUCTION_COST_REQUIRED');
held({periods:base().periods.map(p=>({...p,otherDevelopmentCostsSar:-1}))},'PHASE_AMOUNT_INVALID');
held({periods:base().periods.map(p=>p.month===12?{...p,constructionCostsSar:3000}:p)},'NON_POSITIVE_RESIDUAL_LAND_VALUE');
held({periods:Array.from({length:25},(_,i)=>({...base().periods[0],month:i}))},'PHASES_2_TO_24_REQUIRED');
const missing=assess();
eq(missing.status,STATUS.HOLD,'missing case fail closed');
const ui=fs.readFileSync('src/components/PersonalPhasedDevelopmentDcfPanel.jsx','utf8');
const route=fs.readFileSync('src/components/PersonalAssetUniversePanel.jsx','utf8');
ok(ui.includes('data-testid="phased-development-calculate"'),'real UI calculate');
ok(ui.includes('data-testid="phased-development-pv"'),'real UI labels residual');
ok(ui.includes('setResult(null)'),'clear stale calculation on input edits');
ok(route.includes("assetClass==='LAND'&&<PersonalPhasedDevelopmentDcfPanel"),'real land sector mounted');
ok(!route.includes("assetClass==='RESIDENTIAL'&&<PersonalPhasedDevelopmentDcfPanel"),'not generic residential');
console.log('C55_PERSONAL_PHASED_DEVELOPMENT_DCF=PASS checks='+count);
