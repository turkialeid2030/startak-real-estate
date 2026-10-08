'use strict';

const crypto=require('node:crypto');
const {
  DEPRECIATION_TYPE, DEPRECIATION_METHOD, verifyCostApproachInputPacketIntegrity,
} = require('./cost-approach-inputs');
const {
  calculateCostApproachIndication,COST_APPROACH_RESULT_STATUS,
} = require('../engines/valuation/cost-approach');

const VERSION='C59_COMPONENTIZED_DEPRECIATION_ATTRIBUTION_V1';
const STATUS=Object.freeze({
  HOLD:'HOLD_DEPRECIATION_CAUSES_OR_EVIDENCE',
  READY_FOR_INDEPENDENT_PROFESSIONAL_REVIEW:'READY_FOR_INDEPENDENT_PROFESSIONAL_REVIEW',
});
function filled(v){return typeof v==='string'&&v.trim().length>0;}
function validDate(v){return filled(v)&&Number.isFinite(Date.parse(v));}
function freeze(v){if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.values(v).forEach(freeze);Object.freeze(v);}return v;}
function stable(x){return Array.isArray(x)?x.map(stable):x&&typeof x==='object'?
  Object.fromEntries(Object.keys(x).sort().map(k=>[k,stable(x[k])])):x;}
function sha(x){return crypto.createHash('sha256').update(JSON.stringify(stable(x))).digest('hex');}
function hold(blockers,details={}){
 return freeze({version:VERSION,status:STATUS.HOLD,blockers:[...new Set(blockers)],
  finalValuationConclusionEstablished:false,certifiedValuationEstablished:false,
  transactionAuthorized:false,productionDecisionAuthorized:false,...details});
}
function amountFor(record,costNew){
 return record.method===DEPRECIATION_METHOD.AMOUNT_SAR?record.magnitude:
  record.method===DEPRECIATION_METHOD.PERCENT_OF_IMPROVEMENT_COST_NEW?record.magnitude*costNew:NaN;
}
const cent=.0100001;

/**
 * Checks allocations of every reviewed aggregate Wave11A depreciation record
 * into real cost components and independently reviewable loss causes.
 * Does not silently estimate loss or alter the certified legacy arithmetic.
 */
function assessCostDepreciationAttribution({
 packet,allocations,omissionReviews,asOf,ageLifeChecks=[],
}={}){
 const blockers=[];
 if (!packet||!verifyCostApproachInputPacketIntegrity(packet))return hold(['INVALID_CANONICAL_COST_INPUT_PACKET']);
 const old=calculateCostApproachIndication(packet);
 if(old.status!==COST_APPROACH_RESULT_STATUS.VALUE_INDICATION_READY_FOR_RECONCILIATION)
   return hold(['UPSTREAM_CANONICAL_COST_RESULT_INVALID'],{upstreamStatus:old.status});
 if(!Array.isArray(allocations)||!Array.isArray(omissionReviews)||!Array.isArray(ageLifeChecks))
   return hold(['ATTRIBUTIONS_OMISSIONS_AND_AGE_CHECKS_ARRAYS_REQUIRED']);
 if(!validDate(asOf)||Date.parse(asOf)<Date.parse(packet.valuationDate))
   return hold(['ASOF_NOT_VALID_OR_BEFORE_VALUATION']);
 const components=new Map(old.componentTrace.map(c=>[c.componentId,c]));
 const depreciation=new Map(packet.depreciationRecords.map(d=>[d.depreciationId,d]));
 const activeTypes=new Set(packet.depreciationRecords.map(d=>d.type));
 const totalByDep=new Map(packet.depreciationRecords.map(d=>[d.depreciationId,0]));
 const totalByComponent=new Map(old.componentTrace.map(c=>[c.componentId,0]));
 const causeToType=new Map(),pairs=new Set();
 const trace=[];
 for(const row of allocations){
   const id=row?.depreciationId||'UNKNOWN';
   const rec=depreciation.get(id);
   if(!rec)blockers.push('UNMATCHED_DEPRECIATION_ID:'+id);
   const comp=components.get(row?.componentId);
   if(!comp)blockers.push('UNMATCHED_COST_COMPONENT:'+String(row?.componentId));
   if(!filled(row?.causeId)||!filled(row?.evidenceRef)||!filled(row?.reviewedByRef)
     ||!filled(row?.reviewEvidenceRef)||!validDate(row?.reviewedAt)
     ||Date.parse(row?.reviewedAt)>Date.parse(asOf))blockers.push('MISSING_CAUSAL_PROFESSIONAL_EVIDENCE:'+id);
   if(typeof row?.amountSar!=='number'||!Number.isFinite(row.amountSar)||row.amountSar<=0)
     blockers.push('INVALID_ALLOCATION_AMOUNT:'+id);
   if(rec&&row?.depreciationType!==rec.type)blockers.push('DEPRECIATION_TYPE_MISMATCH:'+id);
   if(rec&&[DEPRECIATION_TYPE.PHYSICAL_CURABLE,DEPRECIATION_TYPE.PHYSICAL_INCURABLE,
     DEPRECIATION_TYPE.FUNCTIONAL_CURABLE,DEPRECIATION_TYPE.FUNCTIONAL_INCURABLE].includes(rec.type)
     &&!filled(row?.curabilityBasisRef))blockers.push('PHYSICAL_FUNCTIONAL_CURABILITY_EVIDENCE_REQUIRED:'+id);
   if(rec&&rec.type===DEPRECIATION_TYPE.EXTERNAL_OBSOLESCENCE&&!filled(row?.externalMarketImpactRef))
     blockers.push('EXTERNAL_MARKET_IMPACT_EVIDENCE_REQUIRED:'+id);
   const key=row?.componentId+'|'+row?.causeId;
   if(pairs.has(key))blockers.push('DUPLICATED_CAUSE_ON_SAME_COMPONENT:'+key);
   pairs.add(key);
   if(filled(row?.causeId)){
     if(causeToType.has(row.causeId)&&causeToType.get(row.causeId)!==row.depreciationType)
       blockers.push('DOUBLE_COUNT_CAUSE_BETWEEN_DEPRECIATION_TYPES:'+row.causeId);
     else causeToType.set(row.causeId,row.depreciationType);
   }
   if(rec&&comp&&Number.isFinite(row?.amountSar)&&row.amountSar>0){
     totalByDep.set(id,(totalByDep.get(id)||0)+row.amountSar);
     totalByComponent.set(comp.componentId,(totalByComponent.get(comp.componentId)||0)+row.amountSar);
     trace.push({
       depreciationId:id,componentId:comp.componentId,depreciationType:rec.type,
       causeId:row.causeId,allocatedLossSar:row.amountSar,evidenceRef:row.evidenceRef,
       reviewedByRef:row.reviewedByRef,reviewEvidenceRef:row.reviewEvidenceRef,
     });
   }
 }
 for(const dep of packet.depreciationRecords){
   const canonicalAmount=amountFor(dep,old.improvementCostNewSar);
   if(!Number.isFinite(canonicalAmount)||Math.abs((totalByDep.get(dep.depreciationId)||0)-canonicalAmount)>cent)
     blockers.push('ALLOCATION_NOT_RECONCILED_TO_CANONICAL_DEPRECIATION:'+dep.depreciationId);
 }
 for(const comp of old.componentTrace){
   const allocated=totalByComponent.get(comp.componentId)||0;
   if(allocated>comp.extendedCostSar+cent)
     blockers.push('COST_COMPONENT_DEPRECIATION_EXCEEDS_COST:'+comp.componentId);
 }
 const seenTypes=new Set();
 for(const review of omissionReviews){
   if(!Object.values(DEPRECIATION_TYPE).includes(review?.type)||seenTypes.has(review?.type)||
      activeTypes.has(review?.type))blockers.push('INVALID_OR_DUPLICATED_OMISSION_REVIEW');
   else seenTypes.add(review.type);
   if(!filled(review?.rationale)||!filled(review?.evidenceRef)||!filled(review?.reviewedByRef)||
      !filled(review?.reviewEvidenceRef)||!validDate(review?.reviewedAt)||
      Date.parse(review?.reviewedAt)>Date.parse(asOf))blockers.push('MISSING_OMITTED_LOSS_CLASS_JUSTIFICATION');
 }
 for(const t of Object.values(DEPRECIATION_TYPE)){
   if(!activeTypes.has(t)&&!seenTypes.has(t))blockers.push('LOSS_CLASS_UNREVIEWED:'+t);
 }
 const ages=[];
 const seenAges=new Set();
 for(const a of ageLifeChecks){
   if(!components.has(a?.componentId)||seenAges.has(a?.componentId))blockers.push('INVALID_OR_DUPLICATE_AGE_LIFE_COMPONENT');
   seenAges.add(a?.componentId);
   if(!Number.isFinite(a?.effectiveAgeYears)||a.effectiveAgeYears<0||
      !Number.isFinite(a?.totalEconomicLifeYears)||a.totalEconomicLifeYears<=0||
      a.effectiveAgeYears>a.totalEconomicLifeYears||
      !filled(a?.inspectorEvidenceRef)||!filled(a?.reviewerRef))
        blockers.push('AGE_LIFE_EVIDENCE_OR_RANGE_INVALID');
   else ages.push({
     componentId:a.componentId,ageLifeRatio:a.effectiveAgeYears/a.totalEconomicLifeYears,
     estimatedPhysicalLossForDiagnosisOnlySar:
      components.get(a.componentId)?.extendedCostSar*a.effectiveAgeYears/a.totalEconomicLifeYears,
     diagnosticOnly:true,
   });
 }
 if(blockers.length)return hold(blockers,{
   inspectedCostComponents:old.componentTrace.length,submittedAllocations:allocations.length,
 });
 const detailed=old.componentTrace.map(c=>({
   componentId:c.componentId,
   componentClass:c.componentClass,
   costNewSar:c.extendedCostSar,
   physicalLossSar:trace.filter(t=>t.componentId===c.componentId&&t.depreciationType.startsWith('PHYSICAL_')).reduce((s,t)=>s+t.allocatedLossSar,0),
   functionalLossSar:trace.filter(t=>t.componentId===c.componentId&&t.depreciationType.startsWith('FUNCTIONAL_')).reduce((s,t)=>s+t.allocatedLossSar,0),
   externalLossSar:trace.filter(t=>t.componentId===c.componentId&&t.depreciationType===DEPRECIATION_TYPE.EXTERNAL_OBSOLESCENCE).reduce((s,t)=>s+t.allocatedLossSar,0),
   residualImprovementValueSar:c.extendedCostSar-(totalByComponent.get(c.componentId)||0),
 }));
 const result={
   version:VERSION,status:STATUS.READY_FOR_INDEPENDENT_PROFESSIONAL_REVIEW,
   blockers:[],caseId:old.caseId,propertyRef:old.propertyRef,
   valuationDate:old.valuationDate,
   canonicalCostResultHashSha256:old.calculationHashSha256,
   landValueSar:old.landValueSar,
   improvementCostNewSar:old.improvementCostNewSar,
   accruedDepreciationSar:old.accruedDepreciationSar,
   costApproachValueIndicationSar:old.costApproachValueIndicationSar,
   componentDepreciationTrace:detailed,
   lossAttributionTrace:trace,
   ageLifeDiagnosticOnly:ages,
   omittedClassReviewCount:omissionReviews.length,
   professionalDepreciationCauseAuthenticityEstablished:false,
   independentSpecialistValuationRequired:true,
   automaticDepreciationEstimated:false,
   finalValuationConclusionEstablished:false,certifiedValuationEstablished:false,
   transactionAuthorized:false,productionDecisionAuthorized:false,
   semantics:'C59 reconciles documented cause-level physical, functional and external depreciation to the unchanged canonical Wave11A cost method. No loss is estimated and no land depreciation is implied; component evidence, age-life and market circumstances still require independent professional authentication.',
 };
 return freeze({...result,resultHashSha256:sha(result)});
}
module.exports={VERSION,STATUS,assessCostDepreciationAttribution};
