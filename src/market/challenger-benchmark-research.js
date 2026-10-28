'use strict';
// Mathematically fair same-cohort model-challenger sandbox.
// Reuses STARTAK independent holdout calculator but DOES NOT independently
// authenticate any externally supplied sale price or claim a calibrated model.
const {calculateResearchErrorMetrics}=require('./appraisal-market-validation');
const {rowsFromCsv,MAX_CSV_BYTES}=require('./public-dataset-import');
const VERSION='STARTAK_CHALLENGER_SANDBOX_V1';
const MODEL_IDS=Object.freeze(['STARTAK','BAYUT_TRUVALUE','GREM_AI','EARTH_VALUE','TATHMIN']);
const MIN=30,MAX=5000;
const num=v=>{
 let s=String(v??'').trim().replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
  .replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
  .replace(/٫/g,'.').replace(/[\u00a0\u202f]/g,'');
 if(!s)return null;
 if(!/^\d+(?:\.\d+)?$/.test(s)&&!/^\d{1,3}(?:[,٬]\d{3})+(?:\.\d+)?$/.test(s))return NaN;
 const n=Number(s.replace(/[,٬]/g,''));
 return Number.isFinite(n)?n:NaN;
};
const date=v=>{
 const s=String(v??'').trim();
 if(!/^\d{4}-\d\d-\d\d$/.test(s)||!Number.isFinite(Date.parse(s+'T00:00:00Z'))||
  new Date(s+'T00:00:00Z').toISOString().slice(0,10)!==s)return null;
 return s;
};
const norm=v=>String(v??'').trim().replace(/[أإآٱ]/g,'ا').replace(/ة/g,'ه')
 .replace(/ى/g,'ي').replace(/\s+/g,' ').toLowerCase();
const HEADER=['modelId','propertyRef','assetType','city','district','predictedAsOf',
 'predictedValueSar','executedPriceSar','executionDate','runCostSar','rangeLowSar','rangeHighSar'];
function parseChallengerCsv(csv){
 if(typeof csv!=='string'||new TextEncoder().encode(csv).length>MAX_CSV_BYTES)
  throw Error('CHALLENGER_SIZE_LIMIT');
 const {columns,records}=rowsFromCsv(csv);
 if(records.length>MAX)throw Error('CHALLENGER_ROW_LIMIT');
 if(columns.length>30||new Set(columns).size!==columns.length||HEADER.slice(0,9).some(k=>!columns.includes(k)))
  throw Error('CHALLENGER_COLUMNS_REQUIRED');
 const rows=[],rejected=[];
 for(const r of records){
  const x=Object.fromEntries(HEADER.map(k=>[k,String(r.columns[k]??'').trim()]));
  const prediction=num(x.predictedValueSar),executed=num(x.executedPriceSar);
  const runCost=num(x.runCostSar),rangeLow=num(x.rangeLowSar),rangeHigh=num(x.rangeHighSar);
  const predictedAsOf=date(x.predictedAsOf),executionDate=date(x.executionDate);
  const bad= !MODEL_IDS.includes(x.modelId)||!x.propertyRef||x.propertyRef.length>120||
   !x.assetType||x.assetType.length>90||!x.city||x.city.length>120||
   !x.district||x.district.length>120||!predictedAsOf||!executionDate||
   predictedAsOf>executionDate||!(prediction>0)||!(executed>0)||
   prediction>1e15||executed>1e15||Number.isNaN(runCost)||
   (runCost!==null&&(runCost<0||runCost>1e7))||
   Number.isNaN(rangeLow)||Number.isNaN(rangeHigh)||
   (rangeLow===null)!==(rangeHigh===null)||
   (rangeLow!==null&&(!(rangeLow>0)||!(rangeHigh>0)||
      rangeLow>prediction||rangeHigh<prediction||rangeLow>rangeHigh));
  if(bad){rejected.push({row:r.line,code:'CHALLENGER_RECORD_INVALID'});continue;}
  rows.push({modelId:x.modelId,propertyRef:x.propertyRef,assetType:x.assetType,
   city:x.city,district:x.district,predictedAsOf,executionDate,
   predictedValueSar:prediction,executedPriceSar:executed,runCostSar:runCost,
   rangeLowSar:rangeLow,rangeHighSar:rangeHigh});
 }
 return {records:rows,rejected,verifiedExecutedLabels:0};
}
function evaluateChallengers({observations=[],minimum=MIN,trainingPropertyRefs=[]}={}){
 const hold={version:VERSION,status:'HOLD_INCOMPLETE_OR_UNBALANCED_COHORT',
  cohortSize:0,models:[],metricsByModel:{},reasons:[],
  verifiedExecutionSources:0,independentMarketEvidenceVerified:false,
  publishableAccuracyClaim:false,certifiedMarketValuation:false,
  investableRecommendation:false,rankingAuthorized:false};
 if(!Array.isArray(observations)||observations.length>MAX||
  !Number.isInteger(minimum)||minimum<MIN||minimum>MAX||
  !Array.isArray(trainingPropertyRefs)){
  hold.reasons.push('BENCHMARK_CONTRACT_INVALID');return hold;}
 if(!observations.length){hold.reasons.push('NO_BENCHMARK_ROWS');return hold;}
 const models=[...new Set(observations.map(x=>x.modelId))].sort();
 if(models.length<2||models.some(m=>!MODEL_IDS.includes(m))){
  hold.reasons.push('AT_LEAST_TWO_SUPPORTED_MODELS_REQUIRED');return hold;}
 hold.models=models;
 const cases=new Map(),training=new Set(trainingPropertyRefs.map(norm)),errors=[];
 const subjectIdentity=new Map(),subjectCaseCount=new Map();
 for(let i=0;i<observations.length;i++){
  const r=observations[i];
  if(!r||!models.includes(r.modelId)||!(r.predictedValueSar>0)||
     !(r.executedPriceSar>0)||!date(r.predictedAsOf)||!date(r.executionDate)||
     r.predictedAsOf>r.executionDate||!r.propertyRef||training.has(norm(r.propertyRef))||
     !r.assetType||!r.city||!r.district||
     (r.rangeLowSar!==null&&r.rangeLowSar!==undefined&&
       (!(r.rangeLowSar>0)||!(r.rangeHighSar>0)||
         r.rangeLowSar>r.predictedValueSar||r.rangeHighSar<r.predictedValueSar))||
     ((r.rangeLowSar===null||r.rangeLowSar===undefined)!==
       (r.rangeHighSar===null||r.rangeHighSar===undefined))){
   errors.push({row:i,code:'INVALID_OBSERVATION_OR_TIME_LEAKAGE'});continue;
  }
  const property=norm(r.propertyRef),identity=[norm(r.assetType),norm(r.city),norm(r.district)].join('|');
  if(subjectIdentity.has(property)&&subjectIdentity.get(property)!==identity)
   errors.push({row:i,code:'PROPERTY_IDENTITY_DRIFT'});
  subjectIdentity.set(property,identity);
  const key=[property,identity,r.predictedAsOf,r.executionDate].join('|');
  const datedCase=property+'|'+r.predictedAsOf+'|'+r.executionDate;
  if(!cases.has(key))subjectCaseCount.set(property,(subjectCaseCount.get(property)||0)+1);
  const label={price:r.executedPriceSar,assetType:r.assetType,city:r.city,district:r.district};
  if(!cases.has(key))cases.set(key,{key,label,observations:new Map()});
  const item=cases.get(key);
  if(item.label.price!==r.executedPriceSar)errors.push({row:i,code:'INCONSISTENT_EXECUTED_LABEL'});
  if(item.observations.has(r.modelId))errors.push({row:i,code:'DUPLICATE_MODEL_CASE'});
  item.observations.set(r.modelId,r);
 }
 hold.cohortSize=cases.size;
 if(subjectCaseCount.size<minimum)errors.push({code:'MINIMUM_DISTINCT_PROPERTY_COUNT_NOT_MET'});
 if([...subjectCaseCount.values()].some(x=>x>1))
  errors.push({code:'REPEATED_PROPERTY_WITH_DIFFERENT_CASE_DATE'});
 if(cases.size<minimum)errors.push({code:'MINIMUM_N_30_NOT_MET'});
 if([...cases.values()].some(x=>x.observations.size!==models.length))
  errors.push({code:'MODELS_USE_DIFFERENT_COHORTS'});
 if(errors.length){hold.reasons=errors;return hold;}
 for(const modelId of models){
  const rows=[...cases.values()].map(({observations})=>observations.get(modelId));
  // Reuse the pure arithmetic; unverified input never impersonates a validated sale.
  const math=calculateResearchErrorMetrics(rows);
  if(!math||math.count!==cases.size){
   hold.reasons.push('SANDBOX_METRICS_REJECTED_'+modelId);return hold;
  }
  const success=rows.filter(r=>Math.abs(r.predictedValueSar-r.executedPriceSar)/
    r.executedPriceSar<=0.10).length;
  const hasCosts=rows.every(r=>typeof r.runCostSar==='number'&&Number.isFinite(r.runCostSar));
  const withBounds=rows.filter(r=>Number.isFinite(r.rangeLowSar)&&Number.isFinite(r.rangeHighSar));
  const intervalCoveragePct=withBounds.length===rows.length?
   rows.filter(r=>r.executedPriceSar>=r.rangeLowSar&&
     r.executedPriceSar<=r.rangeHighSar).length/rows.length*100:null;
  hold.metricsByModel[modelId]={
   sampleSize:rows.length,maeSar:math.maeSar,
   mapePct:math.mapePct,medianApePct:math.medianApePct,
   within10Pct:success/rows.length*100,
   indicativeIntervalCoveragePct:intervalCoveragePct,
   intervalReportedCases:withBounds.length,
   costPerCorrectCompletedTaskSar:hasCosts&&success?
    rows.reduce((t,r)=>t+r.runCostSar,0)/success:null,
   independentlyCalibrated:false,
  };
 }
 return {...hold,status:'RESEARCH_MATH_ONLY_EXTERNAL_VERIFICATION_REQUIRED',
  reasons:['NUMERIC_METRICS_NOT_INDEPENDENTLY_VALIDATED',
   'EQUAL_COHORT_DOES_NOT_CERTIFY_SOURCE_TRANSACTIONS'],
  publishableAccuracyClaim:false,rankingAuthorized:false};
}
module.exports={VERSION,MODEL_IDS,parseChallengerCsv,evaluateChallengers};
