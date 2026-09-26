'use strict';

const GOLDEN_VALIDATION_VERSION='GOLDEN_VALIDATION_V1';
const GOLDEN_STATUS=Object.freeze({PASS:'PASS',REVIEW_REQUIRED:'REVIEW_REQUIRED',HOLD:'HOLD'});
function freeze(v){if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.freeze(v);Object.values(v).forEach(freeze);}return v;}
function finite(v){return typeof v==='number'&&Number.isFinite(v);}

function validateGoldenCorpus({cases,tolerancePct}={}){
  if(!Array.isArray(cases)||!cases.length) return freeze({version:GOLDEN_VALIDATION_VERSION,status:GOLDEN_STATUS.HOLD,blockers:['GOLDEN_CASES_REQUIRED'],results:[]});
  if(!finite(tolerancePct)||tolerancePct<0) return freeze({version:GOLDEN_VALIDATION_VERSION,status:GOLDEN_STATUS.HOLD,blockers:['TOLERANCE_REQUIRED'],results:[]});
  const results=[];let review=false;
  for(const c of cases){
    if(!c||!c.id||!finite(c.independentValueSar)||c.independentValueSar<=0||!finite(c.modelValueSar)||c.modelValueSar<=0||!c.sourceRef){
      return freeze({version:GOLDEN_VALIDATION_VERSION,status:GOLDEN_STATUS.HOLD,blockers:[`INVALID_GOLDEN_CASE:${c&&c.id?c.id:'UNKNOWN'}`],results});
    }
    const varianceSar=c.modelValueSar-c.independentValueSar;
    const variancePct=varianceSar/c.independentValueSar;
    const withinTolerance=Math.abs(variancePct)<=tolerancePct;
    if(!withinTolerance) review=true;
    results.push({id:c.id,assetType:c.assetType||null,sourceRef:c.sourceRef,independentValueSar:c.independentValueSar,modelValueSar:c.modelValueSar,varianceSar,variancePct,withinTolerance});
  }
  return freeze({version:GOLDEN_VALIDATION_VERSION,status:review?GOLDEN_STATUS.REVIEW_REQUIRED:GOLDEN_STATUS.PASS,blockers:[],tolerancePct,results,semantics:'Golden validation measures model variance against independent cases; it does not assert that either value is certified or universally correct.'});
}
module.exports={GOLDEN_VALIDATION_VERSION,GOLDEN_STATUS,validateGoldenCorpus};
