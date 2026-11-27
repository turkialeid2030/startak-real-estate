'use strict';
const assert=require('node:assert/strict');
const {reviewExternalReport}=require('../../src/reporting/external-report-review');
const {renderStudio,renderExternalReview}=require('../../src/reporting/reporting-studio');
const base={reportRef:'SYNTHETIC-ONLY',valuationDate:'2026-01-01',landAreaSqm:1000,comparables:[{id:'C1',date:'2025-12-01',areaSqm:900,rawRateSar:1000,firstAdjustment:-.1,secondAdjustment:-.2,weight:.5,transactionStatus:'EXECUTED',page:1},{id:'C2',date:'2025-12-01',areaSqm:1000,rawRateSar:1200,firstAdjustment:0,secondAdjustment:0,weight:.5,transactionStatus:'EXECUTED',page:1}],adoptedLandRateSar:960,roundingReason:'',components:[{id:'B1',kind:'FLOOR',quantity:500,unit:'SQM',unitCostSar:1000,page:2},{id:'B2',kind:'WALL',quantity:100,unit:'LINEAR_M',unitCostSar:100,page:2}],declaredBuildingCostSar:510000,effectiveAge:10,economicLife:50,declaredPhysicalRate:.2,declaredDepreciationSar:102000,declaredFinalValueSar:1368000,sourcePage:3,identityConflict:false,incomeEvidenceAvailable:true};
let checks=0,cases=0;
function eq(a,b){assert.equal(a,b);checks++;}
function ok(v){assert.ok(v);checks++;}
function denied(v){assert.throws(()=>reviewExternalReport(v));checks++;cases++;}
function run(v){const out=reviewExternalReport(v);cases++;eq(out.professionalValuationCertified,false);eq(out.sourceAuthenticated,false);eq(out.canonicalModelUpdated,false);eq(out.transactionAuthorized,false);return out;}
const a=run(base);eq(a.comparables[0].firstRateSar,900);eq(a.comparables[0].adjustedRateSar,720);eq(a.weightedRateSar,960);eq(a.componentCostSar,510000);eq(a.buildingFloorAreaSqm,500);eq(a.fullPrecisionPhysicalDepSar,102000);eq(a.replayedFinalValueSar,1368000);eq(a.issues.length,0);
const fraction=run({...base,comparables:[{...base.comparables[0],rawRateSar:1000.01,firstAdjustment:0,secondAdjustment:0,weight:.333333},{...base.comparables[1],rawRateSar:1000.02,weight:.666667}],adoptedLandRateSar:1000.02,declaredFinalValueSar:1408020});
eq(fraction.weightedRateSar,1000.02);ok(Math.abs(fraction.weightedBeforeFinalRoundingSar-1000.01666667)<1e-8);eq(fraction.landRateImpactSar,3.33);
const flags=[
 [{identityConflict:true},'IDENTITY_CONFLICT_DECLARED'],[{incomeEvidenceAvailable:false},'INCOME_EVIDENCE_MISSING'],[{adoptedLandRateSar:961},'ADOPTED_RATE_DIFF_UNEXPLAINED'],[{adoptedLandRateSar:961,roundingReason:'declared round'},'ADOPTED_RATE_DIFF_DOCUMENTED_UNVERIFIED'],[{declaredBuildingCostSar:500000},'BUILDING_COST_MISMATCH'],[{declaredDepreciationSar:100000},'DECLARED_DEPRECIATION_MISMATCH'],[{effectiveAge:11},'AGE_LIFE_PRECISION_DIFFERENCE'],[{declaredFinalValueSar:1},'FINAL_VALUE_MISMATCH'],[{declaredDepreciationSar:600000},'DEPRECIATION_EXCEEDS_COST']
];
for(const [patch,code] of flags)ok(run({...base,...patch}).issues.some(x=>x.code===code));
for(const [patch,code] of [[{date:'2026-01-02'},'FUTURE_COMPARABLE'],[{date:'2024-01-01'},'STALE_COMPARABLE_REVIEW'],[{areaSqm:100},'AREA_COMPARABILITY_REVIEW'],[{transactionStatus:'ASKING'},'NOT_EXECUTED']])ok(run({...base,comparables:[{...base.comparables[0],...patch},base.comparables[1]]}).issues.some(x=>x.code===code));
for(const patch of [{valuationDate:'2026-02-30'},{landAreaSqm:0},{declaredFinalValueSar:NaN},{effectiveAge:51},{declaredPhysicalRate:-.1},{sourcePage:0},{identityConflict:'false'},{unknown:true},{comparables:[]},{components:[]}])denied({...base,...patch});
for(const patch of [{weight:.6},{id:'C2'},{rawRateSar:.001},{firstAdjustment:-1.1},{page:0},{date:'invalid'}])denied({...base,comparables:[{...base.comparables[0],...patch},base.comparables[1]]});
for(const patch of [{quantity:0},{id:'B2'},{unit:'LINEAR_M'},{unitCostSar:-1},{page:0}])denied({...base,components:[{...base.components[0],...patch},base.components[1]]});
for(const locale of ['ar-SA','en'])for(const mode of ['OWNER','TECHNICAL']){
 const out=renderStudio({mode,locale,generatedAt:new Date('2026-01-01T00:00:00Z')});cases++;
 eq(out.report.preliminaryValue,null);eq(out.report.professionalAppraisalClaim,false);eq(out.report.transactionAuthorityClaim,false);ok(out.html.includes('STARTAK REAL ESTATE'));ok(out.html.includes('default-src'));ok(out.html.includes(locale==='en'?'dir="ltr"':'dir="rtl"'));
 const review=renderExternalReview({...base,reportRef:'<script>alert(1)</script>'},{locale});ok(!review.html.includes('<script>'));ok(review.html.includes('&lt;script&gt;'));eq(review.report.professionalValuationCertified,false);
}
for(const id of [' C2','C2 ','C2\u200b','C2\u202e','e\u0301']){
 denied({...base,comparables:[{...base.comparables[0],id},base.comparables[1]]});
 denied({...base,components:[{...base.components[0],id},base.components[1]]});
}
let getterReads=0;
const getter=Object.defineProperty({...base},'reportRef',{enumerable:true,get(){getterReads++;return 'SYNTHETIC';}});
denied(getter);
const versionGetter=Object.defineProperty({...base},'version',{enumerable:true,get(){getterReads++;return 'UNKNOWN';}});
assert.throws(()=>renderExternalReview(versionGetter),/REVIEW_INPUT_INVALID/);eq(getterReads,0);
denied({...base,comparables:[{...base.comparables[0],rawRateSar:1e12,firstAdjustment:1},base.comparables[1]]});
assert.throws(()=>renderExternalReview({...base,comparables:Object.assign([...base.comparables],{hiddenExtra:true})}),/REVIEW_INPUT_INVALID/);checks++;
console.log('REPORTING_STUDIO=PASS cases='+cases+' checks='+checks+' scope=LOCAL_RESEARCH_ONLY');
