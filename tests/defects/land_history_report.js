'use strict';
const assert=require('node:assert/strict');
const {reviewVacantLand,VERSION}=require('../../src/reporting/vacant-land-report-review');
const {compareReportedHistory,VERSION:HISTORY}=require('../../src/reporting/property-lifecycle-review');
const {renderExternalReview}=require('../../src/reporting/reporting-studio');
let cases=0,checks=0;
function eq(a,b){assert.equal(a,b);checks++;}
function ok(a){assert.ok(a);checks++;}
function denied(fn){assert.throws(fn);cases++;checks++;}
const comp={id:'C1',date:'2026-01-03',observedDate:'2026-01-04',areaSqm:900,rawRateSar:1000,weight:1,transactionStatus:'ASKING',sourceRef:'SYNTH',page:1,adjustments:[{category:'NEGOTIATION',stage:1,fraction:-.1,evidenceRef:'SYNTH-N'},{category:'FRONTAGES',stage:2,fraction:.2,evidenceRef:'SYNTH-F'}]};
const land={version:VERSION,reportRef:'SYNTH-LAND',valuationDate:'2026-01-05',inspectionDate:'2026-01-04',issueDate:'2026-01-06',worksheetDate:'2026-01-05',limitationsDate:'2026-01-05',landAreaSqm:1000,adoptedLandRateSar:1100,roundingReason:'SYNTH-ROUND',declaredFinalValueSar:1100000,planningEvidence:'CLIENT_ASSUMPTION',planningRef:'SYNTH-CLIENT',assumedFloors:3,uncertaintyFraction:.1,uncertaintyRef:'SYNTH-SENSITIVITY',comparables:[comp],sourcePage:2};
function run(v){cases++;const a=reviewVacantLand(v);eq(a.sourceAuthenticated,false);eq(a.transactionAuthorized,false);eq(a.canonicalModelUpdated,false);eq(a.professionalValuationCertified,false);return a;}
const a=run(land);eq(a.comparables[0].firstRateSar,900);eq(a.comparables[0].adjustedRateSar,1080);eq(a.weightedLandValueSar,1080000);eq(a.landRateImpactSar,20000);eq(a.replayedFinalValueSar,1100000);eq(a.uncertainty.lowSar,990000);eq(a.uncertainty.highSar,1210000);ok(a.issues.some(i=>i.code==='NO_EXECUTED_COMPARABLES'));ok(a.issues.some(i=>i.code==='BUILDING_RIGHTS_UNVERIFIED'));eq(Object.hasOwn(a,'componentCostSar'),false);
for(const [patch,code] of [[{worksheetDate:'2026-01-06'},'VALUATION_DATE_CONFLICT'],[{limitationsDate:'2026-01-06'},'VALUATION_DATE_CONFLICT'],[{inspectionDate:'2026-01-06'},'REPORT_CHRONOLOGY_CONFLICT'],[{roundingReason:''},'ADOPTED_RATE_DIFF_UNEXPLAINED'],[{declaredFinalValueSar:1},'FINAL_VALUE_MISMATCH']])ok(run({...land,...patch}).issues.some(i=>i.code===code));
for(const [patch,code] of [[{date:'2026-01-06'},'FUTURE_COMPARABLE'],[{date:'2024-01-01'},'STALE_COMPARABLE_REVIEW'],[{observedDate:null},'OBSERVATION_DATE_UNKNOWN'],[{observedDate:'2026-01-06'},'POST_VALUATION_OBSERVATION'],[{observedDate:'2026-01-02'},'OBSERVATION_BEFORE_RECORD_DATE'],[{areaSqm:50},'AREA_COMPARABILITY_REVIEW'],[{transactionStatus:'EXECUTED'},'EXECUTED_NEGOTIATION_REVIEW']])ok(run({...land,comparables:[{...comp,...patch}]}).issues.some(i=>i.code===code));
for(const patch of [{landAreaSqm:0},{valuationDate:'2026-02-30'},{uncertaintyFraction:1.1},{uncertaintyRef:''},{components:[]},{comparables:[]},{sourcePage:0}])denied(()=>reviewVacantLand({...land,...patch}));
for(const patch of [{weight:.5},{sourceRef:''},{transactionStatus:'SOLD'},{adjustments:[...comp.adjustments,{...comp.adjustments[0],stage:2}]},{adjustments:[{category:'AREA',stage:1,fraction:.8,evidenceRef:'A'},{category:'USE',stage:1,fraction:.8,evidenceRef:'B'}]}])denied(()=>reviewVacantLand({...land,comparables:[{...comp,...patch}]}));
const b=run({...land,comparables:[{...comp,rawRateSar:1000.01,weight:.333333,adjustments:[]},{...comp,id:'C2',rawRateSar:1000.02,weight:.666667,adjustments:[]}],adoptedLandRateSar:1000.02,declaredFinalValueSar:1000020});eq(b.weightedRateSar,1000.02);eq(b.landRateImpactSar,3.33);
const before={reportRef:'SYNTH-A',propertyRef:'SYNTH-P',valuationDate:'2025-01-01',issueDate:'2025-01-02',landAreaSqm:1000,state:'IMPROVED',basis:'FAIR_VALUE',purpose:'FINANCIAL_REPORTING',propertyRight:'FREEHOLD',method:'COST',reportedValueSar:900000,landValueSar:null,improvementValueSar:null,sourcePage:1};
const after={...before,reportRef:'SYNTH-B',valuationDate:'2026-01-05',issueDate:'2026-01-06',state:'VACANT_LAND',basis:'MARKET_VALUE',purpose:'SALE',method:'MARKET',reportedValueSar:1000000,landValueSar:1000000,improvementValueSar:0};
const h={version:HISTORY,propertyRef:'SYNTH-P',identityEvidenceRef:'SYNTH-ID',identityMatchDeclared:true,transitionEvidenceRef:'SYNTH-TRANSITION',before,after};
function hist(v){cases++;const r=compareReportedHistory(v);eq(r.attributedMarketChangeSar,null);eq(r.marketGrowthEstablished,false);eq(r.identityAuthenticated,false);eq(r.transactionAuthorized,false);return r;}
const c=hist(h);eq(c.reportedDeltaSar,100000);ok(Math.abs(c.reportedDeltaFraction-1/9)<1e-10);eq(c.changedFields.length,4);
for(const patch of [{identityMatchDeclared:false},{after:{...after,landAreaSqm:1001}},{after:{...after,propertyRef:'OTHER'}}]){const v=hist({...h,...patch});eq(v.reportedDeltaSar,null);ok(v.issues.some(i=>i.code==='HISTORY_IDENTITY_UNRESOLVED'));}
eq(hist({...h,before:{...before,reportedValueSar:0}}).reportedDeltaFraction,null);
ok(hist({...h,after:{...after,landValueSar:999}}).issues.some(i=>i.code==='HISTORY_COMPONENT_SUM_MISMATCH'));
for(const patch of [{after:before},{identityEvidenceRef:''},{after:{...after,issueDate:'2025-01-01'}},{after:{...after,state:'INVALID'}},{after:{...after,marketGrowth:1}}])denied(()=>compareReportedHistory({...h,...patch}));
for(const locale of ['ar-SA','en'])for(const input of [{...land,reportRef:'<script>bad</script>'},{...h,propertyRef:'<script>bad</script>'}]){
 cases++;const out=renderExternalReview(input,{locale});ok(!out.html.includes('<script>'));ok(out.html.includes('&lt;script&gt;'));ok(out.html.includes(locale==='en'?'dir="ltr"':'dir="rtl"'));eq(out.report.professionalValuationCertified,false);
}
console.log('LAND_HISTORY_REPORT=PASS cases='+cases+' checks='+checks);
