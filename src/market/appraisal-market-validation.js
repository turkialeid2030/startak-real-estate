'use strict';
// Strict historical holdout evaluation. No synthetic valuation report is a market sale label.
// Needs licensed transactions and independent verification OUTSIDE this library.
const VERSION='STARTAK_INDEPENDENT_MARKET_HOLDOUT_V1';
const positive=n=>typeof n==='number'&&Number.isFinite(n)&&n>0&&n<=1e13;
const date=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&
 Number.isFinite(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
const code=s=>typeof s==='string'&&s.trim().length>=2&&s.length<=120;
// Pure error arithmetic. The caller must distinguish synthetic mathematical labels
// from real transactions; this helper does NOT confer source authenticity.
function calculateResearchErrorMetrics(rows){
 if(!Array.isArray(rows)||rows.length===0)return null;
 if(rows.some(r=>!positive(r?.predictedValueSar)||!positive(r?.executedPriceSar)))
  throw Error('HOLDOUT_METRIC_VALUES_INVALID');
 const err=rows.map(r=>Math.abs(r.predictedValueSar-r.executedPriceSar));
 const ape=rows.map(r=>100*Math.abs(r.predictedValueSar-r.executedPriceSar)/r.executedPriceSar);
 return {count:rows.length,maeSar:err.reduce((a,b)=>a+b,0)/rows.length,
  mapePct:ape.reduce((a,b)=>a+b,0)/rows.length,
  medianApePct:[...ape].sort((a,b)=>a-b)[Math.floor((ape.length-1)/2)]};
}
function validateIndependentHoldout({observations=[],trainingPropertyRefs=[],minimum=30}={}){
 const errors=[],valid=[],seen=new Set();
 if(!Array.isArray(observations)||observations.length>10000||!Array.isArray(trainingPropertyRefs)||
  !Number.isInteger(minimum)||minimum<30||minimum>10000)
   return {version:VERSION,status:'HOLD_INPUT_CONTRACT',errors:['INVALID_SAMPLE_OR_MINIMUM'],
    publishableAccuracyClaim:false,independentSourceVerificationPerformed:false,metrics:null};
 const training=new Set(trainingPropertyRefs);
 for(let i=0;i<observations.length;i++){
  const r=observations[i],reasons=[];
  if(!r||typeof r!=='object'||Array.isArray(r)){errors.push({row:i,reason:'MALFORMED'});continue;}
  if(!code(r.propertyRef)||!code(r.assetType)||!code(r.city)||!code(r.district))reasons.push('PROPERTY_AND_SEGMENT_REQUIRED');
  if(!positive(r.predictedValueSar)||!positive(r.executedPriceSar))reasons.push('VALUES_INVALID');
  if(!date(r.predictedAsOf)||!date(r.executionDate)||r.predictedAsOf>r.executionDate)reasons.push('TIME_LEAKAGE_OR_INVALID_DATES');
  if(training.has(r.propertyRef))reasons.push('PROPERTY_LEAKAGE_TRAIN_TO_HOLDOUT');
  if(r.executedTransactionConfirmed!==true||r.independentlyVerified!==true||
     r.reuseRightsVerified!==true||r.observationSourceType!=='EXECUTED_REAL_ESTATE_TRANSACTION')
    reasons.push('TRANSACTION_OR_SOURCE_RIGHTS_UNVERIFIED');
  const key=[r.propertyRef,r.executionDate].join('::');
  if(seen.has(key))reasons.push('DUPLICATE_PROPERTY_TRANSACTION');
  seen.add(key);
  if(reasons.length){errors.push({row:i,reason:reasons.join('|')});continue;}
  valid.push(r);
 }
 const metric=calculateResearchErrorMetrics;
 const groups={};
 for(const r of valid){
  const k=[r.assetType,r.city].join('|');
  (groups[k]??=[]).push(r);
 }
 const bySectorAndCity=Object.fromEntries(Object.entries(groups).map(([k,v])=>[k,{
  ...metric(v),sufficientCoverage:v.length>=minimum}]));
 const qualified=valid.length>=minimum&&errors.length===0;
 return {version:VERSION,status:qualified?'RESEARCH_HOLDOUT_CALCULATED_NOT_CERTIFIED':
   'HOLD_INSUFFICIENT_OR_UNVERIFIED_MARKET_EVIDENCE',
  validObservations:valid.length,rejectedObservations:errors.length,errors,
  overall:metric(valid),bySectorAndCity,minimumPerSegment:minimum,
  publishableAccuracyClaim:false,independentSourceVerificationPerformed:false,
  certifiedAppraisalAccuracy:false,trainedFromClientReports:false,
  externalReviewAndLegalDataRightsRequired:true};
}
module.exports={VERSION,calculateResearchErrorMetrics,validateIndependentHoldout};
