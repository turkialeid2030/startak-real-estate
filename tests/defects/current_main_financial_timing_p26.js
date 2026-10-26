'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {calculateInvestmentCase,STUDY_TYPE}=require('../../src/engines');
const {buildFinancialTimingBasisReportDisclosure}=require('../../src/reporting');
const {FINANCIAL_TIMING_BASIS_VERSION}=require('../../src/contracts/financial-timing-basis');
const {buildPersonalFinancialStudy,verifyPersonalFinancialStudy,htmlFinancialStudy}=
 require('../../src/app/personal-financial-study');
const dir=path.join(__dirname,'../characterization/fixtures');
const source=name=>JSON.parse(fs.readFileSync(path.join(dir,name+'.json'),'utf8')).input_set;
const at=new Date('2026-10-26T08:30:00Z');
let checks=0;
function eq(a,b,label){assert.deepStrictEqual(a,b,label);checks++;}
function ok(v,label){assert.ok(v,label);checks++;}
for(const [mode,file] of [['building','RE-GOLD-002-U'],['land','RE-GOLD-001-U']]){
 const inputs=source(file),studyType=mode==='building'?STUDY_TYPE.EXISTING_BUILDING:STUDY_TYPE.LAND_DEVELOPMENT;
 const result=calculateInvestmentCase({studyType,inputs,leverageEnabled:false,assumptionModelVersion:'LEGACY'});
 const report=buildPersonalFinancialStudy({mode,inputs,assumptionModelVersion:'LEGACY',generatedAt:at});
 eq(verifyPersonalFinancialStudy(report),true,mode+' current report SHA integrity');
 eq(report.financial.timingBasis,result.timingBasis,mode+' exact canonical timing matches report');
 eq(report.financial.results.timingBasis,result.timingBasis,mode+' snapshot preserves timing');
 eq(result.timingBasis.version,FINANCIAL_TIMING_BASIS_VERSION,mode+' timing version');
 eq(result.timingBasis.initialInvestmentTiming,'TIME_ZERO',mode+' initial time');
 eq(result.timingBasis.unleveredCashflowTiming,'ANNUAL_END_OF_PERIOD',mode+' return period');
 eq(result.timingBasis.npvConvention,'PERIODIC_ANNUAL_NPV',mode+' NPV convention');
 eq(result.timingBasis.irrConvention,'PERIODIC_ANNUAL_IRR',mode+' IRR convention');
 eq(result.timingBasis.xirrUsed,false,mode+' never XIRR');
 eq(result.timingBasis.xnpvUsed,false,mode+' never XNPV');
 eq(result.timingBasis.datedCashflowMethod,false,mode+' date-specific rates not invented');
 eq(result.timingBasis.transactionAuthorized,false,mode+' no investment authority');
 const page=htmlFinancialStudy(report,{locale:'ar-SA'});
 ok(page.includes('منهجية توقيت التدفقات والعوائد'),mode+' Arabic disclosure visible in full report');
 ok(page.includes('PERIODIC_ANNUAL_NPV'),mode+' actual timing label not missing in HTML');
 const en=htmlFinancialStudy(report,{locale:'en'});
 ok(en.includes('Cash-flow timing methodology'),mode+' English report');
 ok(en.includes('PERIODIC_ANNUAL_IRR'),mode+' IRR method shown');
 const disclosure=buildFinancialTimingBasisReportDisclosure(result,{locale:'ar-SA'});
 eq(disclosure.transactionAuthorized,false,mode+' adapter cannot authorize');
 eq(disclosure.timingBasisVersion,FINANCIAL_TIMING_BASIS_VERSION,mode+' report adapter version');
 if(mode==='land'){
  eq(result.timingBasis.constructionCashflowTiming,'ANNUAL_END_OF_PERIOD','land annual construction return');
  eq(result.timingBasis.constructionDebtDrawTiming,'MONTHLY_BEGINNING_OF_PERIOD','land financing method distinct');
  eq(result.timingBasis.constructionInterestCapitalizationTiming,'MONTHLY_END_OF_PERIOD','land finance interest later');
  eq(result.timingBasis.annualConstructionDebtDrawsAreAggregationOnly,true,'financing annual rows aggregate');
  ok(page.includes('جدول شهري مستقل'),'land methodological reconciliation disclosed');
 }else{
  eq(result.timingBasis.constructionCashflowTiming,'NOT_APPLICABLE','building no construction');
  eq(result.timingBasis.terminalValueTiming,'END_OF_FINAL_HOLD_YEAR','building terminal year');
 }
 // A stale or invalid report must never carry a previous valid timing basis.
 const invalid=buildPersonalFinancialStudy({mode,inputs:{...inputs,
  [mode==='building'?'buildingPrice':'landPricePerSqm']:NaN},
  assumptionModelVersion:'LEGACY',generatedAt:at});
 eq(verifyPersonalFinancialStudy(invalid),true,mode+' invalid report still signed');
 eq(invalid.financial.status,'INPUTS_INVALID',mode+' invalid economics hold');
 eq(invalid.financial.timingBasis,null,mode+' do not preserve stale methodology');
 eq(invalid.financial.results,null,mode+' no numeric results');
 ok(htmlFinancialStudy(invalid,{locale:'ar-SA'}).includes('غير متاحة لعدم تحقق النموذج المالي الحالي'),
  mode+' explicit timing held in invalid HTML');
}
assert.throws(()=>buildFinancialTimingBasisReportDisclosure({}),/result\.timingBasis is required/);
checks++;
assert.throws(()=>buildFinancialTimingBasisReportDisclosure({timingBasis:{version:'FUTURE'}}),/Unsupported timing basis/);
checks++;
console.log('CURRENT_MAIN_P26_FINANCIAL_TIMING_INTEGRATED=PASS checks='+checks+
 ' calculationMethodChanged=false commercialAuthorization=false');
