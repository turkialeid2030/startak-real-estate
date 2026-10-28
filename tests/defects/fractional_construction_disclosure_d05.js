'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {buildPersonalFinancialStudy,verifyPersonalFinancialStudy,htmlFinancialStudy}=
 require('../../src/app/personal-financial-study');
const {STUDY_TYPE}=require('../../src/contracts/study-type');
const {buildFinancialTimingBasis}=require('../../src/contracts/financial-timing-basis');
const {buildFinancialTimingBasisReportDisclosure}=require('../../src/reporting/financial-timing-basis-report');
let checks=0;const ok=(v,label)=>{assert.ok(v,label);checks++};
const timing=buildFinancialTimingBasis(STUDY_TYPE.LAND_DEVELOPMENT);
const snapshot=Object.freeze({timingBasis:timing,constructionPeriodYears:2.5,annualConstructionYears:3,
 decisionStatus:'HOLD',analyticalResultsOnly:true});
const ar=buildFinancialTimingBasisReportDisclosure(snapshot,{locale:'ar-SA'});
const en=buildFinancialTimingBasisReportDisclosure(snapshot,{locale:'en'});
ok(ar.fractionalConstructionReview.status==='REQUIRES_DATED_CASHFLOW_RECONCILIATION','annual/month discrepancy held');
ok(ar.fractionalConstructionReview.inputConstructionYears===2.5,'original period preserved');
ok(ar.fractionalConstructionReview.annualConstructionBuckets===3,'actual engine construction years disclosed');
ok(ar.fractionalConstructionReview.nominalConstructionFinanceMonths===30,'nominal finance periods are not described as real draws');
ok(ar.fractionalConstructionReview.xirrCalculatedByThisReport===false&&
   ar.fractionalConstructionReview.xnpvCalculatedByThisReport===false,
   'no fake XIRR or XNPV');
ok(ar.fractionalConstructionReview.professionalValuationAuthorized===false,'no transaction go');
ok(ar.rows.some(x=>x.code==='FRACTIONAL_CONSTRUCTION_RETURN_TIMING_HOLD'),'visible report warning row');
ok(ar.rows.find(x=>x.code==='FRACTIONAL_CONSTRUCTION_RETURN_TIMING_HOLD').value.includes('مؤرخة'),'Arabic evidence note');
ok(en.rows.find(x=>x.code==='FRACTIONAL_CONSTRUCTION_RETURN_TIMING_HOLD').value.includes('dated'),'English evidence note');
ok(en.methodology.xirrUsed===false&&en.methodology.xnpvUsed===false,'canonical engine truth preserved');
const regular=buildFinancialTimingBasisReportDisclosure({...snapshot,constructionPeriodYears:2,annualConstructionYears:2});
ok(!regular.fractionalConstructionReview,'integer duration does not trigger false fractional warning');
const building=buildFinancialTimingBasis(STUDY_TYPE.EXISTING_BUILDING);
const irrelevant=buildFinancialTimingBasisReportDisclosure({...snapshot,timingBasis:building});
ok(!irrelevant.fractionalConstructionReview,'building does not inherit land timing caveat');
const weird=buildFinancialTimingBasisReportDisclosure({...snapshot,constructionPeriodYears:2.125});
ok(weird.fractionalConstructionReview.nominalConstructionFinanceMonths===null,'fractional months are never silently rounded');
ok(!weird.fractionalConstructionReview.datedCashflowEvidenceSupplied,'no independent dated proof');
// Render the actual owned financial export for a valid 2.5-year land scenario.
// This tests that the caution reaches the owner-facing HTML rather than just
// existing in an unused report adapter.
const input=JSON.parse(fs.readFileSync(path.join(__dirname,
 '../characterization/fixtures/RE-GOLD-001-U.json'),'utf8')).input_set;
const actual=buildPersonalFinancialStudy({
 mode:'land',inputs:{...input,constructionPeriod:2.5},
 assumptionModelVersion:'LEGACY',generatedAt:new Date('2026-10-28T08:30:00Z'),
});
ok(verifyPersonalFinancialStudy(actual),'real fractional land JSON remains internally hash-valid');
ok(actual.financial.timingBasis?.datedCashflowMethod===false,
 'actual financial engine has not secretly switched to date-specific XIRR');
const htmlAr=htmlFinancialStudy(actual,{locale:'ar-SA'});
const htmlEn=htmlFinancialStudy(actual,{locale:'en'});
ok(htmlAr.includes('مدة الإنشاء الكسرية — إثبات العائد المؤرخ'),
 'real Arabic owner report contains dated-return hold');
ok(htmlEn.includes('Fractional construction timing — dated return proof'),
 'real English owner report contains dated-return hold');
ok(htmlAr.includes('يلزم جدول سحوبات')&&htmlEn.includes('Obtain independently dated'),
 'actual bilingual report tells owner what supporting schedule is required');
console.log('D05_FRACTIONAL_CONSTRUCTION_TIMING_GATE=PASS checks='+checks);
