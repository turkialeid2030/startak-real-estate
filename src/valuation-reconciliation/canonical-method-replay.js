'use strict';
const {assertPlainJson}=require('../validation/plain-json-boundary');
const {strictCalendarDateMs}=require('../validation/strict-calendar-instant');
const {hashValue}=require('../source-intelligence/source-provenance-governance');
const {RECOGNIZED_METHOD_MODELS_BY_VERSION:models}=require('../contracts/valuation-reconciliation');
const engines=Object.freeze(Object.assign(Object.create(null),{
 'LAND_SALES_COMPARISON_1.0':require('../engines/valuation/land-sales-comparison').calculateLandSalesComparisonIndication,
 'WHOLE_PROPERTY_SALES_COMPARISON_1.0':require('../engines/valuation/whole-property-sales-comparison').calculateWholePropertySalesComparisonIndication,
 'DIRECT_CAPITALIZATION_1.0':require('../engines/valuation/direct-capitalization').calculateDirectCapitalizationIndication,
 'PROFESSIONAL_DCF_1.0':require('../engines/valuation/professional-dcf').calculateProfessionalDcfIndication,
 'COST_APPROACH_1.0':require('../engines/valuation/cost-approach').calculateCostApproachIndication,
}));
function safe(v){try{assertPlainJson(v,{maxNodes:500000});return !!v&&typeof v==='object'&&!Array.isArray(v);}catch{return false;}}
function evaluateCanonicalMethodReplay(input={}){
 const blockers=[],traces=[];
 const out=()=>Object.freeze({status:blockers.length?'HOLD_METHOD_REPLAY':'READY_FOR_ARITHMETIC_REPLAY_REVIEW',blockers:Object.freeze([...new Set(blockers)]),traces:Object.freeze(blockers.length?[]:traces),originalSourceInputsIndependentlyRebuilt:false,sourceAuthenticityIndependentlyVerified:false,decisionReady:false,transactionAuthorized:false,certifiedValuationEstablished:false});
 if(!safe(input)){blockers.push('C3_REPLAY_INPUT_JSON_INVALID');return out();}
 const {caseId,propertyRef,valuationDate,asOf,methodIndications,methodInputPacketsByIndicationId:packets}=input;
 const date=strictCalendarDateMs(valuationDate),cutoff=strictCalendarDateMs(asOf);
 if(typeof caseId!=='string'||!caseId.trim()||typeof propertyRef!=='string'||!propertyRef.trim()||!Number.isFinite(date)||!Number.isFinite(cutoff)||date>cutoff||cutoff>Date.now()){blockers.push('C3_REPLAY_SCOPE_OR_DATE_INVALID');return out();}
 if(!Array.isArray(methodIndications)||!methodIndications.length||methodIndications.length>100||!safe(packets)){blockers.push('C3_REPLAY_COMPLETE_INPUTS_REQUIRED');return out();}
 const ids=new Set();
 for(const method of methodIndications){
   const id=method?.id,expected=method?.sourceResult;
   if(typeof id!=='string'||!id.trim()||ids.has(id)){blockers.push('C3_REPLAY_DUPLICATE_OR_INVALID_ID');continue;}
   ids.add(id);
   const v=expected?.modelVersion,model=models[v],engine=engines[v],packet=Object.hasOwn(packets,id)?packets[id]:null;
   if(!model||typeof engine!=='function'||!safe(packet)){blockers.push('C3_REPLAY_PACKET_OR_MODEL_REQUIRED:'+id);continue;}
   if(packet.caseId!==caseId||expected.caseId!==caseId||packet.propertyRef!==propertyRef||expected.propertyRef!==propertyRef||strictCalendarDateMs(packet.valuationDate)!==date||strictCalendarDateMs(expected.valuationDate)!==date){blockers.push('C3_REPLAY_SCOPE_MISMATCH:'+id);continue;}
   const preparationDates=['preparedAt','reconciledAt','asOf'].filter(k=>Object.hasOwn(packet,k)).map(k=>strictCalendarDateMs(packet[k]));
   if(!preparationDates.length||preparationDates.some(d=>!Number.isFinite(d)||d<date||d>cutoff)){blockers.push('C3_REPLAY_PREPARATION_WINDOW_INVALID:'+id);continue;}
   try{
     const result=engine(packet);
     if(!result||!model.acceptedStatuses.includes(result.status)||result[model.indicationTypeField]!==model.expectedIndicationType||result.finalValuationConclusionEstablished!==false||result.certifiedValuationEstablished!==false||result.transactionAuthorized!==false||result.caseId!==caseId||result.propertyRef!==propertyRef||strictCalendarDateMs(result.valuationDate)!==date||!Number.isFinite(result[model.valueField])||result[model.valueField]<=0){blockers.push('C3_REPLAY_CANONICAL_RESULT_NOT_READY:'+id);continue;}
     const digest=hashValue(result);
     if(!digest||hashValue(expected)!==digest){blockers.push('C3_REPLAY_EXACT_RESULT_MISMATCH:'+id);continue;}
     traces.push(Object.freeze({indicationId:id,modelVersion:v,sourceResultHashSha256:digest,calculationHashSha256:result.calculationHashSha256,valueSar:result[model.valueField],arithmeticReplayedFromSuppliedCanonicalPacket:true}));
   }catch{blockers.push('C3_REPLAY_CALCULATION_FAILED:'+id);}
 }
 if(Object.keys(packets).some(k=>!ids.has(k)))blockers.push('C3_REPLAY_ORPHANED_PACKET');
 return out();
}
module.exports={evaluateCanonicalMethodReplay};
