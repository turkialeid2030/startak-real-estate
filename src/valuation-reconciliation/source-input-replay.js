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
const cost=require('../cost/cost-approach-inputs');
const {buildCostApproachInputPacket}=cost;
const {buildPropertyEvidencePacket}=require('../property/property-evidence-bridge');
const cmp=require('../market/comparable-evidence');
const adj=require('../market/comparable-adjustments');
const {buildLandSalesComparisonInputPacket}=require('../land/land-valuation-inputs');
const {buildWholePropertySalesComparisonInputPacket}=require('../valuation/whole-property-sales-comparison-input');
const {evaluateCanonicalMethodReplay}=require('./canonical-method-replay');
function safe(v){try{assertPlainJson(v,{maxNodes:500000});return !!v&&typeof v==='object'&&!Array.isArray(v);}catch{return false;}}
function equal(a,b){const h=hashValue(a);return !!h&&h===hashValue(b);}
const filled=v=>typeof v==='string'&&!!v.trim();
function required(v,label){if(!v)throw Error(label);}
function canonicalRecord(ctor,v,label){required(safe(v),label);const rebuilt=ctor(v);required(equal(rebuilt,v),label);return rebuilt;}
// Rebuild each nested forecast record, not just the outer period hash.
function rebuildCanonicalForecastPeriod(p){
 required(safe(p)&&Array.isArray(p.incomeLines)&&p.incomeLines.length>0&&p.incomeLines.length<=1000&&Array.isArray(p.operatingExpenseLines)&&p.operatingExpenseLines.length>0&&p.operatingExpenseLines.length<=1000,'FORECAST_LINE_COLLECTION_INVALID');
 const incomeLines=p.incomeLines.map(x=>canonicalRecord(forecast.createIncomeForecastLine,x,'FORECAST_INCOME_LINE_CANONICAL_MISMATCH'));
 const vacancyCollectionLoss=canonicalRecord(forecast.createVacancyCollectionLossAssumption,p.vacancyCollectionLoss,'FORECAST_VACANCY_CANONICAL_MISMATCH');
 const operatingExpenseLines=p.operatingExpenseLines.map(x=>canonicalRecord(forecast.createOperatingExpenseForecastLine,x,'FORECAST_EXPENSE_LINE_CANONICAL_MISMATCH'));
 const rebuilt=forecast.createIncomeForecastPeriod({...p,incomeLines,vacancyCollectionLoss,operatingExpenseLines});
 required(equal(rebuilt,p),'FORECAST_PERIOD_CANONICAL_MISMATCH');
 return rebuilt;
}
function sameScope(x,ctx){return !!x&&x.caseId===ctx.caseId&&x.propertyRef===ctx.propertyRef;}
function before(v,cutoff){const d=strictCalendarDateMs(v);return Number.isFinite(d)&&d<=cutoff;}
function scopedDraft(d,ctx){required(safe(d)&&sameScope(d,ctx)&&strictCalendarDateMs(d.valuationDate)===ctx.date,'SOURCE_DRAFT_SCOPE_INVALID');return d;}
function rebuildProperty(record,ctx,expected,limit){
 const draft=record.propertyEvidenceDraft;
 required(safe(draft)&&sameScope(draft,ctx)&&strictCalendarDateMs(draft.assignment?.valuation_date)===ctx.date,'PROPERTY_SOURCE_DRAFT_REQUIRED');
 required(before(draft.assignment?.report_date,ctx.cutoff)&&before(draft.inspection?.completedAt,limit),'PROPERTY_SOURCE_WINDOW_INVALID');
 required(Array.isArray(draft.evidenceRecords)&&draft.evidenceRecords.length>0&&draft.evidenceRecords.length<=1000&&Array.isArray(draft.measurementRecords)&&draft.measurementRecords.length>0&&draft.measurementRecords.length<=1000,'PROPERTY_SOURCE_COLLECTIONS_REQUIRED');
 for(const e of draft.evidenceRecords)required(e.caseId===ctx.caseId&&[e.createdAt,e.fact?.capturedAt,e.fact?.verification?.verifiedAt,...(e.professionalReview?[e.professionalReview.reviewedAt]:[])].every(x=>before(x,limit)),'PROPERTY_EVIDENCE_WINDOW_INVALID');
 for(const m of draft.measurementRecords)required(m.caseId===ctx.caseId&&before(m.measuredAt,limit),'PROPERTY_MEASUREMENT_WINDOW_INVALID');
 const rebuilt=buildPropertyEvidencePacket(draft);
 required(rebuilt.professionalValuationWorkflowReady===true&&equal(rebuilt,expected),'PROPERTY_REBUILT_PACKET_MISMATCH');
 return rebuilt;
}
function rebuildLandAdjustment(record,ctx,d,limit){
 const source=record.landMarketSource;
 required(safe(source)&&Array.isArray(d.comparableRecords)&&d.comparableRecords.length>0&&d.comparableRecords.length<=500,'LAND_MARKET_SOURCE_REQUIRED');
 const records=d.comparableRecords.map(v=>{
   required(v.caseId===ctx.caseId&&v.assetType==='LAND'&&v.transactionType==='SALE'&&['OFFICIAL_REGISTERED_TRANSACTION','VERIFIED_TRANSACTION'].includes(v.evidenceLevel)&&v.verification?.status==='VERIFIED'&&v.abnormalTransaction===false,'LAND_COMPARABLE_SCOPE_OR_VERIFICATION_INVALID');
   required([v.sourceDate,v.transactionDate,v.capturedAt,v.verification.verifiedAt].every(x=>before(x,ctx.date)),'LAND_COMPARABLE_AFTER_VALUATION');
   const location={...v.location};if(location.lat===null)delete location.lat;if(location.long===null)delete location.long;
   const rebuilt=cmp.createComparableEvidenceRecord({...v,location});
   required(equal(rebuilt,v),'LAND_COMPARABLE_CANONICAL_MISMATCH');return rebuilt;
 });
 const q=source.qualityDraft,p=source.selectionDraft,a=source.adjustmentDraft;
 required(safe(q)&&safe(p)&&safe(a)&&[q,p,a].every(x=>x.caseId===ctx.caseId),'LAND_REPLAY_DRAFTS_REQUIRED');
 required(strictCalendarDateMs(q.asOfDate)===ctx.date&&q.targetAssetType==='LAND'&&q.targetTransactionType==='SALE'&&filled(q.targetCity)&&['OFFICIAL_REGISTERED_TRANSACTION','VERIFIED_TRANSACTION'].includes(q.minimumEvidenceLevel),'LAND_QUALITY_POLICY_REQUIRED');
 required(!Object.hasOwn(q,'records')&&!Object.hasOwn(p,'records')&&!Object.hasOwn(p,'qualityGate')&&!Object.hasOwn(a,'records')&&!Object.hasOwn(a,'selection'),'LAND_DERIVED_DRAFT_FORBIDDEN');
 required(before(p.selectedAt,limit)&&strictCalendarDateMs(p.selectedAt)>=ctx.date&&Array.isArray(a.adjustmentRecords)&&a.adjustmentRecords.length<=2000,'LAND_SELECTION_WINDOW_INVALID');
 const qualityGate=cmp.evaluateComparableSetQuality({...q,records});
 required(qualityGate.status===cmp.COMPARABLE_QUALITY_STATUS.QUALIFIED_FOR_PROFESSIONAL_SELECTION,'LAND_QUALITY_NOT_READY');
 const selection=adj.recordProfessionalComparableSelection({...p,records,qualityGate});
 required(selection.professionalSelectionRecorded===true,'LAND_SELECTION_NOT_READY');
 const adjustmentRecords=a.adjustmentRecords.map(x=>{
   required(x.caseId===ctx.caseId&&before(x.preparedAt,limit)&&before(x.reviewedAt,limit)&&strictCalendarDateMs(x.reviewedAt)>=strictCalendarDateMs(p.selectedAt),'LAND_ADJUSTMENT_WINDOW_INVALID');
   return canonicalRecord(adj.createComparableAdjustmentRecord,x,'LAND_ADJUSTMENT_CANONICAL_MISMATCH');
 });
 required(selection.selectedComparableIds.every(id=>adjustmentRecords.some(x=>x.comparableId===id)),'LAND_EXPLICIT_ADJUSTMENT_DISPOSITION_REQUIRED');
 const analysis=adj.buildComparableAdjustmentAnalysis({...a,records,selection,adjustmentRecords});
 required(analysis.reconciliationReady===true&&equal(analysis,d.adjustmentAnalysis),'LAND_REBUILT_ADJUSTMENT_MISMATCH');
 return {records,analysis};
}
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
     const expected=toHalalas(evidence.annualContractRentSar),actual=sumHalalas(lines.map(x=>toHalalas(x.amountSar)));
     required(lines.length>0&&expected!==null&&actual!==null&&actual===expected,'FIRST_PERIOD_CONTRACTUAL_RENT_MISMATCH');
   }
   return rebuildCanonicalForecastPeriod(p);
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
     }else if(v==='COST_APPROACH_1.0'){
       const limit=strictCalendarDateMs(d.preparedAt);
       required(Number.isFinite(limit)&&limit>=date&&limit<=cutoff,'COST_PREPARATION_WINDOW_INVALID');
       const propertyEvidencePacket=rebuildProperty(record,ctx,d.propertyEvidencePacket,limit);
       required(Array.isArray(d.costComponents)&&d.costComponents.length>0&&d.costComponents.length<=1000&&Array.isArray(d.depreciationRecords)&&d.depreciationRecords.length<=100,'COST_SOURCE_COLLECTIONS_REQUIRED');
       const costComponents=d.costComponents.map(x=>{
         required(sameScope(x,ctx)&&x.verification?.status==='VERIFIED'&&['OFFICIAL_COST_INDEX','VERIFIED_QUANTITY_SURVEY','VERIFIED_CONTRACTOR_QUOTE','VERIFIED_HISTORICAL_COST'].includes(x.sourceClass)&&before(x.sourceDate,date)&&before(x.capturedAt,limit)&&before(x.verification.verifiedAt,limit),'COST_SOURCE_SCOPE_OR_WINDOW_INVALID');
         return canonicalRecord(cost.createCostComponentRecord,x,'COST_COMPONENT_CANONICAL_MISMATCH');
       });
       const landValueInput=canonicalRecord(cost.createProfessionalLandValueInput,d.landValueInput,'COST_LAND_VALUE_CANONICAL_MISMATCH');
       required(sameScope(landValueInput,ctx)&&before(landValueInput.preparedAt,limit)&&before(landValueInput.reviewedAt,limit),'COST_LAND_VALUE_WINDOW_INVALID');
       const depreciationRecords=d.depreciationRecords.map(x=>{required(sameScope(x,ctx)&&before(x.preparedAt,limit)&&before(x.reviewedAt,limit),'COST_DEPRECIATION_WINDOW_INVALID');return canonicalRecord(cost.createDepreciationRecord,x,'COST_DEPRECIATION_CANONICAL_MISMATCH');});
       rebuilt=buildCostApproachInputPacket({...d,propertyEvidencePacket,costComponents,landValueInput,depreciationRecords});
     }else if(v==='LAND_SALES_COMPARISON_1.0'){
       const limit=strictCalendarDateMs(d.reconciledAt);
       required(Number.isFinite(limit)&&limit>=date&&limit<=cutoff,'LAND_RECONCILIATION_WINDOW_INVALID');
       const propertyEvidencePacket=rebuildProperty(record,ctx,d.propertyEvidencePacket,limit);
       required(propertyEvidencePacket.assetType==='LAND'&&record.propertyEvidenceDraft.materialMeasurementTypes.includes('LAND_AREA'),'LAND_SUBJECT_MEASUREMENT_NOT_GOVERNED');
       const market=rebuildLandAdjustment(record,ctx,d,limit);
       rebuilt=buildLandSalesComparisonInputPacket({...d,propertyEvidencePacket,comparableRecords:market.records,adjustmentAnalysis:market.analysis});
     }else if(v==='WHOLE_PROPERTY_SALES_COMPARISON_1.0'){
       required(strictCalendarDateMs(d.asOf)===cutoff,'MARKET_DRAFT_AS_OF_MISMATCH');
       const limit=strictCalendarDateMs(d.reconciledAt);
       required(Number.isFinite(limit)&&limit>=date&&limit<=cutoff,'MARKET_RECONCILIATION_WINDOW_INVALID');
       const subjectPropertyEvidencePacket=rebuildProperty(record,ctx,d.subjectPropertyEvidencePacket,limit);
       const measurement=subjectPropertyEvidencePacket.measurements.find(x=>x.measurementId===d.subjectMeasurementId);
       required(measurement&&record.propertyEvidenceDraft.materialMeasurementTypes.includes(measurement.type),'MARKET_SUBJECT_MEASUREMENT_NOT_GOVERNED');
       required(before(d.marketContextBinding?.boundAt,strictCalendarDateMs(d.selectedAt))&&before(d.selectedAt,limit),'MARKET_SELECTION_WINDOW_INVALID');
       required(Array.isArray(d.comparableMeasurements)&&d.comparableMeasurements.length>0&&d.comparableMeasurements.length<=500&&Array.isArray(d.adjustmentRecords)&&d.adjustmentRecords.length<=2000&&Array.isArray(d.marketEvidence?.evidenceRecords)&&d.marketEvidence.evidenceRecords.length<=1000,'MARKET_SOURCE_COLLECTIONS_REQUIRED');
       required(d.marketEvidence.evidenceRecords.every(x=>before(x.effectiveAt,date)&&before(x.observedAt,strictCalendarDateMs(d.selectedAt))&&Number.isFinite(strictCalendarDateMs(x.validUntil))),'MARKET_SOURCE_WINDOW_INVALID');
       required(d.comparableMeasurements.every(x=>before(x.effectiveAt,date)&&before(x.verifiedAt,strictCalendarDateMs(d.selectedAt))&&Number.isFinite(strictCalendarDateMs(x.validUntil))),'MARKET_COMPARABLE_MEASUREMENT_WINDOW_INVALID');
       required(d.adjustmentRecords.every(x=>before(x.reviewedAt,limit)&&strictCalendarDateMs(x.reviewedAt)>=strictCalendarDateMs(d.selectedAt)),'MARKET_ADJUSTMENT_WINDOW_INVALID');
       rebuilt=buildWholePropertySalesComparisonInputPacket({...d,subjectPropertyEvidencePacket});
     }else throw Error('UNSUPPORTED_MODEL');
     required(equal(rebuilt,packets[id]),'SOURCE_REBUILT_PACKET_MISMATCH');
     traces.push(Object.freeze({indicationId:id,modelVersion:v,packetHashSha256:hashValue(rebuilt),noiResultHashSha256:income?hashValue(income.result):null,leaseEvidenceHashSha256:income?income.evidence.incomeEvidencePacketHashSha256:null,forecastInputHashSha256:income?income.forecastPacket.professionalIncomeForecastInputHashSha256:null,suppliedSourceDraftReplayed:true,sourceAuthenticityIndependentlyVerified:false}));
   }catch(error){blockers.push('SOURCE_REPLAY:'+id+':'+(error instanceof Error&&/^[A-Z0-9_]+$/.test(error.message)?error.message:'BUILDER_REJECTED'));}
 }
 if(Object.keys(drafts).some(k=>!ids.has(k)))blockers.push('SOURCE_REPLAY_ORPHANED_DRAFT');
 return out();
}
module.exports={evaluateSourceInputReplay,rebuildCanonicalForecastPeriod};
