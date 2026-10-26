'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {assessPersonalPhasedDevelopment,STATUS}=require('../../src/valuation-intelligence/personal-phased-development-dcf');
const {calculateResidualLandValue}=require('../../src/valuation-intelligence/residual-approach');
const {EVIDENCE_GRADE,INPUT_STATUS}=require('../../src/valuation-intelligence/contracts');
let checks=0;
function eq(actual,expected,label){assert.deepEqual(actual,expected,label);checks++}
function near(actual,expected,label){assert.ok(Number.isFinite(actual)&&Math.abs(actual-expected)<1e-8,label+': '+actual+' vs '+expected);checks++}
function yes(value,label){assert.ok(value,label);checks++}
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
const test=assessPersonalPhasedDevelopment(base());
eq(test.status,STATUS.RESEARCH,'user research output');
const contrast=test.methodContrast;
yes(contrast,'actual contrast attached to engine');
eq(contrast.status,'UNRECONCILED_RESEARCH_CONTRAST','not certified reconciliation');
eq(contrast.basis,'SAME_USER_DECLARED_UNLEVERED_PHASE_SCHEDULE','same source ledger');
eq(contrast.terminalMonth,24,'final phase');
near(contrast.monthlyDatedPvSar,-200+700/1.1+400/1.21,'independent hand monthly');
near(contrast.nominalUndiscountedSar,900,'hand nominal');
near(contrast.terminalAggregateShadowSar,900/1.21,'hand terminal');
near(contrast.differenceTerminalMinusMonthlySar,900/1.21-test.landResidualPvSar,'absolute timing effect');
near(contrast.differenceNominalMinusMonthlySar,900-test.landResidualPvSar,'nominal timing effect');
eq(contrast.automaticMethodSelection,false,'no silent selection');
eq(contrast.automaticBlendedValuation,false,'no blended decision');
eq(contrast.transactionAuthorized,false,'no approved transaction');
eq(contrast.commercialOrProfessionalReviewPassed,false,'no false professional review');
eq(contrast.independentlyVerifiedSourceEvidence,false,'not evidence');
eq(contrast.actualLegacyEngineExecuted,false,'shadow not claimed as live engine run');
yes(Object.isFrozen(contrast),'method contrast immutable');
yes(Object.isFrozen(contrast.modelIdentification),'method list immutable');
eq(test.transactionAuthorized,false,'parent never authorized');
const syntheticEvidence={grade:EVIDENCE_GRADE.G_EXPERT_ASSUMPTION,
 status:INPUT_STATUS.ASSUMED,sourceType:'SYNTHETIC_TEST_NOT_VERIFIED'};
const legacy=calculateResidualLandValue({
 completedAssetValue:1500,developmentCosts:600,
 financeCosts:0,developerProfit:0,contingency:0,sellingCosts:0,
 developmentYears:2,discountRate:0.1,
 completedValueEvidence:syntheticEvidence,
 developmentCostEvidence:syntheticEvidence,
 discountRateEvidence:syntheticEvidence,
 valuationDate:'2026-10-25',currency:'SAR',
});
near(legacy.value,contrast.terminalAggregateShadowSar,
 'legacy engine terminal calculation matches terminal-only shadow for same synthetic economics');
yes(Math.abs(legacy.value-test.landResidualPvSar)>1,
 'terminal-only formula is NOT dated project DCF when flows vary');
eq(legacy.weakestEvidenceGrade,EVIDENCE_GRADE.G_EXPERT_ASSUMPTION,
 'legacy input not verified by this check');
const delayed=assessPersonalPhasedDevelopment({...base(),
 periods:base().periods.map(p=>p.month===12?{...p,month:18}:p)});
eq(delayed.status,STATUS.RESEARCH,'valid delayed schedule');
near(delayed.methodContrast.terminalAggregateShadowSar,contrast.terminalAggregateShadowSar,
 'terminal shadow unchanged for same undiscounted net and project horizon');
yes(delayed.methodContrast.monthlyDatedPvSar<contrast.monthlyDatedPvSar,
 'dated DCF responds to deferred net receipt');
const rephased=assessPersonalPhasedDevelopment({...base(),
 periods:base().periods.map(p=>p.month===0?{...p,constructionCostsSar:0,gdvReceiptsSar:10}:p.month===24?
 {...p,constructionCostsSar:p.constructionCostsSar+200,gdvReceiptsSar:p.gdvReceiptsSar-10}:p)});
eq(rephased.status,STATUS.RESEARCH,'valid rephased schedule');
near(rephased.methodContrast.nominalUndiscountedSar,contrast.nominalUndiscountedSar,
 'same nominal net when moving costs and sales');
near(rephased.methodContrast.terminalAggregateShadowSar,contrast.terminalAggregateShadowSar,
 'same terminal shadow despite different period economics');
yes(Math.abs(rephased.methodContrast.monthlyDatedPvSar-contrast.monthlyDatedPvSar)>1,
 'phased DCF distinguishes cash timing');
const hold=(change,code)=>{
 const x=assessPersonalPhasedDevelopment({...base(),...change});
 eq(x.status,STATUS.HOLD,code+' guarded');
 yes(x.reasonCodes.includes(code),code+' explicit');
 eq(x.methodContrast,undefined,'no value diagnostics on HOLD');
 eq(x.landResidualPvSar,null,'no land residual on HOLD');
};
hold({noSeparateDeveloperProfitOrRiskSpread:false},'DEVELOPER_RETURN_DOUBLE_COUNT_RISK');
hold({noFinancingCostsOrDebtServiceIncluded:false},'FINANCING_AND_DISCOUNT_DOUBLE_COUNT_RISK');
hold({propertyRight:'WAQF_RESTRICTED'},'LEGAL_PROPERTY_RIGHT_REQUIRES_SEPARATE_MODEL');
hold({documentedTimingReviewed:false},'DATED_PHASES_NOT_REVIEWED');
hold({annualDiscountRate:0},'ZERO_RATE_WITH_FUTURE_DEVELOPMENT_HOLD');
hold({periods:[...base().periods.slice(0,2),{month:24,gdvReceiptsSar:0,constructionCostsSar:3000,otherDevelopmentCostsSar:0}]},'NON_POSITIVE_RESIDUAL_LAND_VALUE');
const ui=fs.readFileSync('src/components/PersonalPhasedDevelopmentDcfPanel.jsx','utf8');
yes(ui.includes('data-testid="phased-development-method-contrast"'),'real UI shows engine results');
yes(ui.includes('result.methodContrast.terminalAggregateShadowSar'),'real terminal shadow displayed');
yes(ui.includes('result.methodContrast.differenceTerminalMinusMonthlySar'),'timing difference displayed');
yes(ui.includes("result.status===STATUS.RESEARCH"),'output only for research result');
yes(ui.includes('setResult(null)'),'new inputs clear stale result');
yes(!ui.includes('reconciledFinalPurchasePrice'),'no auto-selected purchase conclusion');
console.log('C55_MONTHLY_LEGACY_TERMINAL_INTEGRATION=PASS checks='+checks+
 ' professionallyReconciled=false independentSaudiMarketEvidence=false');
