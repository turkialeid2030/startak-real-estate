'use strict';
const {assertPlainJson}=require('../validation/plain-json-boundary');
const {strictCalendarDateMs}=require('../validation/strict-calendar-instant');
const {hashValue}=require('../source-intelligence/source-provenance-governance');
const lease=require('../market/lease-income-evidence');
const forecast=require('../income/professional-income-forecast');
const {calculateProfessionalNoi}=require('../engines/valuation/professional-income-noi');
const rates=require('../valuation/professional-method-input-provenance');
const dc=require('../valuation/direct-capitalization-input');
const dcf=require('../valuation/professional-dcf-input');
const {buildCostApproachInputPacket}=require('../cost/cost-approach-inputs');
const {buildLandSalesComparisonInputPacket}=require('../land/land-valuation-inputs');
const {buildWholePropertySalesComparisonInputPacket}=require('../valuation/whole-property-sales-comparison-input');
const {evaluateCanonicalMethodReplay}=require('./canonical-method-replay');
function safe(v){try{assertPlainJson(v,{maxNodes:500000});return !!v&&typeof v==='object'&&!Array.isArray(v);}catch{return false;}}
function equal(a,b){const h=hashValue(a);return !!h&&h===hashValue(b);}
const filled=v=>typeof v==='string'&&!!v.trim();
function required(v,label){if(!v)throw Error(label);}
function canonicalRecord(ctor,v,label){required(safe(v),label);const rebuilt=ctor(v);required(equal(rebuilt,v),label);return rebuilt;}
function sameScope(x,ctx){return !!x&&x.caseId===ctx.caseId&&x.propertyRef===ctx.propertyRef;}
function before(v,cutoff){const d=strictCalendarDateMs(v);return Number.isFinite(d)&&d<=cutoff;}
function scopedDraft(d,ctx){required(safe(d)&&sameScope(d,ctx)&&strictCalendarDateMs(d.valuationDate)===ctx.date,'SOURCE_DRAFT_SCOPE_INVALID');return d;}
function rebuildIncome(source,ctx){
 required(safe(source)&&Array.isArray(source.leaseRecords)&&source.leaseRecords.length>0&&source.leaseRecords.length<=1000,'INCOME_LEASE_RECORDS_REQUIRED');
 const fd=scopedDraft(source.forecastDraft,ctx),prepared=strictCalendarDateMs(fd.preparedAt);
 required(Number.isFinite(prepared)&&prepared>=ctx.date&&prepared<=ctx.cutoff,'INCOME_FORECAST_PREPARATION_INVALID');
 const records=source.leaseRecords.map(v=>{
   required(sameScope(v,ctx)&&[lease.LEASE_EVIDENCE_SOURCE.OFFICIAL_REGISTERED_LEASE,lease.LEASE_EVIDENCE_SOURCE.VERIFIED_EXECUTED_LEASE].includes(v.sourceClass)&&v.verification?.status===lease.LEASE_VERIFICATION_STATUS.VERIFIED,'LEASE_SCOPE_OR_VERIFICATION_INVALID');
   required(before(v.capturedAt,Math.min(ctx.date,prepared))&&before(v.verification.verifiedAt,Math.min(ctx.date,prepared)),'LEASE_REVIEW_AFTER_VALUATION');
   return canonicalRecord(lease.createLeaseEvidenceRecord,v,'LEASE_CANONICAL_RECORD_MISMATCH');
 });
 const rr=source.rentRollSnapshot;
 required(sameScope(rr,ctx)&&strictCalendarDateMs(rr.asOfDate)===ctx.date&&before(rr.capturedAt,ctx.date)&&before(rr.verification?.verifiedAt,ctx.date),'RENT_ROLL_SCOPE_OR_WINDOW_INVALID');
 const snapshot=canonicalRecord(lease.createVerifiedRentRollSnapshot,rr,'RENT_ROLL_CANONICAL_MISMATCH');
 const evidence=lease.reconcileLeaseIncomeEvidence({caseId:ctx.caseId,propertyRef:ctx.propertyRef,leaseRecords:records,rentRollSnapshot:snapshot,asOfDate:ctx.valuationDate,annualRentToleranceSar:0,occupiedAreaToleranceSqm:0,requireVerifiedActiveLeases:true});
 required(evidence.readyForIncomeAnalysisHandoff===true,'LEASE_RECONCILIATION_NOT_READY');
 required(Array.isArray(fd.forecastPeriods)&&fd.forecastPeriods.length>0&&fd.forecastPeriods.length<=100,'FORECAST_PERIODS_REQUIRED');
 const forecastPeriods=fd.forecastPeriods.map(p=>{
   required(sameScope(p,ctx)&&before(p.preparedAt,prepared)&&before(p.reviewedAt,prepared),'FORECAST_PERIOD_SCOPE_OR_WINDOW_INVALID');
   for(const v of [...(p.incomeLines||[]),p.vacancyCollectionLoss,...(p.operatingExpenseLines||[])])required(sameScope(v,ctx)&&before(v.asOfDate,ctx.date)&&before(v.preparedAt,prepared)&&before(v.reviewedAt,prepared),'FORECAST_LINE_SCOPE_OR_WINDOW_INVALID');
   // The first annualized contractual rent is required to reconcile exactly
   // to the active snapshot; later forecasts remain explicit professional assumptions.
   if(p.periodIndex===1){
     const lines=p.incomeLines.filter(x=>x.type===forecast.INCOME_FORECAST_LINE_TYPE.CONTRACTUAL_RENT);
     const {toHalalas,sumHalalas}=require('../validation/governed-sar-halala');
     required(lines.length>0&&sumHalalas(lines.map(x=>toHalalas(x.amountSar)))===toHalalas(evidence.annualContractRentSar),'FIRST_PERIOD_CONTRACTUAL_RENT_MISMATCH');
   }
   return canonicalRecord(forecast.createIncomeForecastPeriod,p,'FORECAST_PERIOD_CANONICAL_MISMATCH');
 });
 required(!Object.hasOwn(fd,'incomeEvidencePacket'),'FORECAST_DRAFT_MUST_NOT_SUPPLY_DERIVED_EVIDENCE');
 const forecastPacket=forecast.buildProfessionalIncomeForecastInput({...fd,forecastPeriods,incomeEvidencePacket:evidence});
 required(forecastPacket.readyForCanonicalNoi===true,'FORECAST_PACKET_NOT_READY');
 const result=calculateProfessionalNoi(forecastPacket);
 required(result.status==='PROFESSIONAL_NOI_READY'&&result.transactionAuthorized===false,'NOI_REPLAY_NOT_READY');
 return {result,evidence,forecastPacket,prepared};
}
function evaluateSourceInputReplay(input={}){
 const blockers=[],traces=[];
 const out=()=>Object.freeze({status:blockers.length?'HOLD_SOURCE_INPUT_REPLAY':'READY_FOR_SOURCE_INPUT_REPLAY_REVIEW',blockers:Object.freeze([...new Set(blockers)]),traces:Object.freeze(blockers.length?[]:traces),suppliedSourceInputsRebuilt:!blockers.length,originalSourceInputsIndependentlyRebuilt:false,sourceAuthenticityIndependentlyVerified:false,sourceRightsIndependentlyAuthenticated:false,decisionReady:false,transactionAuthorized:false,certifiedValuationEstablished:false});
 if(!safe(input)){blockers.push('SOURCE_REPLAY_INPUT_JSON_INVALID');return out();}
 const {caseId,propertyRef,valuationDate,asOf,methodIndications,methodInputPacketsByIndicationId:packets,sourceRebuildsByIndicationId:drafts}=input;
 const date=strictCalendarDateMs(valuationDate),cutoff=strictCalendarDateMs(asOf),ctx={caseId,propertyRef,valuationDate,date,cutoff};
 if(!filled(caseId)||!filled(propertyRef)||!Number.isFinite(date)||!Number.isFinite(cutoff)||date>cutoff||cutoff>Date.now()){blockers.push('SOURCE_REPLAY_SCOPE_OR_DATE_INVALID');return out();}
 if(!Array.isArray(methodIndications)||!methodIndications.length||methodIndications.length>100||!safe(packets)||!safe(drafts)){blockers.push('SOURCE_REPLAY_COMPLETE_DRAFTS_REQUIRED');return out();}
 const arithmetic=evaluateCanonicalMethodReplay({caseId,propertyRef,valuationDate,asOf,methodIndications,methodInputPacketsByIndicationId:packets});
 if(arithmetic.status!=='READY_FOR_ARITHMETIC_REPLAY_REVIEW'){blockers.push(...arithmetic.blockers);return out();}
 const ids=new Set();
 for(const method of methodIndications){
   const id=method.id,v=method.sourceResult.modelVersion;
   ids.add(id);
   try{
     const record=Object.hasOwn(drafts,id)?drafts[id]:null;
     required(safe(record),'SOURCE_REBUILD_REQUIRED');
     const d=scopedDraft(record.methodInputDraft,ctx);
     let rebuilt,income=null;
     if(v==='DIRECT_CAPITALIZATION_1.0'||v==='PROFESSIONAL_DCF_1.0'){
       required(!Object.hasOwn(d,'professionalNoiResult'),'SOURCE_DRAFT_MUST_NOT_SUPPLY_DERIVED_NOI');
       income=rebuildIncome(record.incomeSource,ctx);
       required(before(d.preparedAt,cutoff)&&strictCalendarDateMs(d.preparedAt)>=income.prepared,'METHOD_PREPARED_BEFORE_NOI');
       if(v==='DIRECT_CAPITALIZATION_1.0'){
         const rate=canonicalRecord(rates.createProfessionalRateInput,d.marketCapRateInput,'CAP_RATE_CANONICAL_MISMATCH');
         rebuilt=dc.buildDirectCapitalizationInputPacket({...d,professionalNoiResult:income.result,marketCapRateInput:rate});
       }else{
         const discountRateInput=canonicalRecord(rates.createProfessionalRateInput,d.discountRateInput,'DISCOUNT_RATE_CANONICAL_MISMATCH');
         const exitCapRateInput=canonicalRecord(rates.createProfessionalRateInput,d.exitCapRateInput,'EXIT_RATE_CANONICAL_MISMATCH');
         const terminalNoiInput=canonicalRecord(dcf.createTerminalNoiInput,d.terminalNoiInput,'TERMINAL_NOI_CANONICAL_MISMATCH');
         const dispositionCostInput=canonicalRecord(dcf.createDispositionCostInput,d.dispositionCostInput,'DISPOSITION_COST_CANONICAL_MISMATCH');
         required(Array.isArray(d.periodAdjustments),'DCF_ADJUSTMENTS_REQUIRED');
         const periodAdjustments=d.periodAdjustments.map(x=>canonicalRecord(dcf.createDcfPeriodAdjustment,x,'DCF_ADJUSTMENT_CANONICAL_MISMATCH'));
         rebuilt=dcf.buildProfessionalDcfInputPacket({...d,professionalNoiResult:income.result,discountRateInput,exitCapRateInput,terminalNoiInput,dispositionCostInput,periodAdjustments});
       }
     }else if(v==='COST_APPROACH_1.0')rebuilt=buildCostApproachInputPacket(d);
     else if(v==='LAND_SALES_COMPARISON_1.0')rebuilt=buildLandSalesComparisonInputPacket(d);
     else if(v==='WHOLE_PROPERTY_SALES_COMPARISON_1.0'){
       required(strictCalendarDateMs(d.asOf)===cutoff,'MARKET_DRAFT_AS_OF_MISMATCH');
       rebuilt=buildWholePropertySalesComparisonInputPacket(d);
     }else throw Error('UNSUPPORTED_MODEL');
     required(equal(rebuilt,packets[id]),'SOURCE_REBUILT_PACKET_MISMATCH');
     traces.push(Object.freeze({indicationId:id,modelVersion:v,packetHashSha256:hashValue(rebuilt),noiResultHashSha256:income?hashValue(income.result):null,leaseEvidenceHashSha256:income?income.evidence.incomeEvidencePacketHashSha256:null,forecastInputHashSha256:income?income.forecastPacket.professionalIncomeForecastInputHashSha256:null,suppliedSourceDraftReplayed:true,sourceAuthenticityIndependentlyVerified:false}));
   }catch(error){blockers.push('SOURCE_REPLAY:'+id+':'+(error instanceof Error&&/^[A-Z0-9_]+$/.test(error.message)?error.message:'BUILDER_REJECTED'));}
 }
 if(Object.keys(drafts).some(k=>!ids.has(k)))blockers.push('SOURCE_REPLAY_ORPHANED_DRAFT');
 return out();
}
module.exports={evaluateSourceInputReplay};
