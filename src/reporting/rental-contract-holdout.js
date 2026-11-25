'use strict';
// Evaluation only: supplied holdout observations are not authenticated by this module.
const {KINDS}=require('./saudi-rental-intelligence');
const day=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x))&&new Date(x).toISOString().slice(0,10)===x;
const ref=x=>typeof x==='string'&&x.trim()&&x.length<=200&&!/[\x00-\x1f]/.test(x);
const amount=x=>typeof x==='number'&&Number.isFinite(x)&&x>0&&x<=1e12;
const round=x=>Math.round(x*100)/100;
function evaluateContractHoldout(x){
 if(!x||!ref(x.modelRef)||!day(x.trainingCutoff)||!day(x.asOf)||x.trainingCutoff>=x.asOf||!Array.isArray(x.trainingPropertyRefs)||!x.trainingPropertyRefs.length||x.trainingPropertyRefs.length>100000||x.trainingPropertyRefs.some(r=>!ref(r))||!Array.isArray(x.rows)||!x.rows.length||x.rows.length>10000)throw Error('HOLDOUT_SCOPE');
 const train=new Set(x.trainingPropertyRefs),contracts=new Set(),properties=new Set(),groups=new Map();
 for(const r of x.rows){
  if(!r||!ref(r.contractRef)||!ref(r.propertyRef)||!ref(r.sourceRef)||!ref(r.predictionRef)||!KINDS.includes(r.kind)||!day(r.predictedAt)||!day(r.executedAt)||r.predictedAt<x.trainingCutoff||r.predictedAt>=r.executedAt||r.executedAt>x.asOf||r.status!=='EXECUTED'||r.measure!=='ANNUAL_PROPERTY_RENT_EX_VAT_SAR'||!amount(r.actual)||!amount(r.predicted))throw Error('HOLDOUT_ROW');
  if(train.has(r.propertyRef))throw Error('HOLDOUT_TRAINING_LEAKAGE');
  if(contracts.has(r.contractRef)||properties.has(r.propertyRef))throw Error('HOLDOUT_DUPLICATE');
  contracts.add(r.contractRef);properties.add(r.propertyRef);
  if(!groups.has(r.kind))groups.set(r.kind,[]);groups.get(r.kind).push(r);
 }
 const metrics=rows=>({n:rows.length,maeSar:round(rows.reduce((a,r)=>a+Math.abs(r.predicted-r.actual),0)/rows.length),mapePct:round(rows.reduce((a,r)=>a+Math.abs(r.predicted-r.actual)/r.actual,0)/rows.length*100),biasSar:round(rows.reduce((a,r)=>a+r.predicted-r.actual,0)/rows.length),within20Pct:round(rows.filter(r=>Math.abs(r.predicted-r.actual)/r.actual<=.2).length/rows.length*100)});
 return {version:1,modelRef:x.modelRef,trainingCutoff:x.trainingCutoff,asOf:x.asOf,status:'DECLARED_HOLDOUT_DIAGNOSTIC_ONLY',overall:metrics(x.rows),byKind:[...groups].map(([kind,rows])=>({kind,...metrics(rows)})),sourceAuthenticated:false,predictionTimestampIndependentlyVerified:false,independentReview:false,propertyAvmQualified:false,financialInputEligible:false};
}
module.exports={evaluateContractHoldout};
