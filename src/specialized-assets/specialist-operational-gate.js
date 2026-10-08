'use strict';
const crypto = require('node:crypto');
const {
  HOSPITALITY_OPERATING_METRICS_STATUS,
  verifyHospitalityOperatingMetricsPacketIntegrity,
} = require('./hospitality-operating-metrics');
const {
  SPECIALIZED_VALUATION_PREMISE,
  SPECIALIZED_VALUE_COMPONENT,
  COMPONENT_TREATMENT,
  SPECIALIZED_INTEREST_SEPARATION_STATUS,
  verifySpecializedInterestSeparationPacketIntegrity,
} = require('./specialized-interest-separation');
const {
  INDUSTRIAL_SUBTYPE,
  INTERNAL_INSPECTION_STATUS,
  BUILDING_PERMIT_STATUS,
  LEASE_STRUCTURE,
  profileIndustrialLogisticsAsset,
} = require('../valuation-intelligence/adapters/industrial-logistics');

const VERSION = 'C61_SPECIALIZED_INTEREST_AND_ASSET_CONTROL_V1';
const STATUS = Object.freeze({
  HOLD: 'HOLD_SPECIALIZED_ASSET_EVIDENCE',
  READY_FOR_EXTERNAL_SPECIALIST_REVIEW: 'READY_FOR_EXTERNAL_SPECIALIST_REVIEW',
});
const SHA = /^[a-f0-9]{64}$/i;
const HOTEL_TYPES = new Set(['HOTEL_FULL_SERVICE','HOTEL_LIMITED_SERVICE','SERVICED_APARTMENTS','RESORT']);
const CHECKS = Object.freeze(['zoning','titleInterest','inspection','utilityService','fireLifeSafety',
  'environmentalContamination','deferredCapex','leaseRights','professionalSpecialistReview']);
function filled(s){return typeof s==='string'&&s.trim().length>0;}
function isDate(s){return filled(s)&&/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(s)
  && Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s.slice(0,10);}
function stable(x){return Array.isArray(x)?x.map(stable):x&&typeof x==='object'?
  Object.fromEntries(Object.keys(x).sort().map(k=>[k,stable(x[k])])):x;}
function hash(x){return crypto.createHash('sha256').update(JSON.stringify(stable(x))).digest('hex');}
function freeze(x){if(x&&typeof x==='object'&&!Object.isFrozen(x)){Object.values(x).forEach(freeze);Object.freeze(x);}return x;}
function hold(reasons){return freeze({version:VERSION,status:STATUS.HOLD,blockers:[...new Set(reasons)],
    actualSpecialistEvidenceIndependentlyAuthenticated:false,professionalValuationApproved:false,
    transactionAuthorized:false,publicExportAuthorized:false});}
function evaluateSpecializedAssetEvidence({
  assetType,caseId,propertyRef,valuationDate,asOf,
  hotelMetricsPacket,interestSeparationPacket,industrialSpec,
  specialistChecks,hotelIncomeBridge,
}={}){
  const blockers=[];
  if(!filled(caseId)||!filled(propertyRef)||!isDate(valuationDate)||!isDate(asOf)||
    (isDate(valuationDate)&&isDate(asOf)&&Date.parse(asOf)<Date.parse(valuationDate)))
    blockers.push('CASE_PROPERTY_AND_CHRONOLOGY_REQUIRED');
  if(!Array.isArray(specialistChecks))return hold([...blockers,'SPECIALIST_CHECKS_REQUIRED']);
  const byType=new Map();
  for(const check of specialistChecks){
    if(!check||!filled(check.type)||byType.has(check.type)||!CHECKS.includes(check.type))
      blockers.push('INVALID_OR_DUPLICATE_SPECIALIST_CHECK');
    else byType.set(check.type,check);
  }
  for(const name of CHECKS){
    const item=byType.get(name);
    if(!item||!['CONFIRMED','REVIEWED_NOT_APPLICABLE'].includes(item.status)||
      !filled(item.evidenceRef)||!SHA.test(item.artifactSha256||'')||
      !filled(item.reviewedByRef)||!isDate(item.reviewedAt)||
      (isDate(asOf)&&isDate(item?.reviewedAt)&&Date.parse(item.reviewedAt)>Date.parse(asOf))||
      (item.status==='REVIEWED_NOT_APPLICABLE'&&!filled(item.notApplicableRationale)))
      blockers.push('SPECIALIST_CONTROL_UNRESOLVED:'+name);
    if(item?.status==='REVIEWED_NOT_APPLICABLE' &&
      ['zoning','titleInterest','inspection','fireLifeSafety','professionalSpecialistReview'].includes(name))
      blockers.push('MANDATORY_SPECIALIST_CONTROL_CANNOT_BE_SKIPPED:'+name);
  }
  const referenced=[];
  if(HOTEL_TYPES.has(assetType)){
    if(!hotelMetricsPacket||hotelMetricsPacket.caseId!==caseId||hotelMetricsPacket.propertyRef!==propertyRef||
      hotelMetricsPacket.status!==HOSPITALITY_OPERATING_METRICS_STATUS.READY||
      !verifyHospitalityOperatingMetricsPacketIntegrity(hotelMetricsPacket))
      blockers.push('HOTEL_HISTORICAL_OPERATING_METRICS_NOT_READY');
    if(!interestSeparationPacket||interestSeparationPacket.caseId!==caseId||
       interestSeparationPacket.propertyRef!==propertyRef||
       interestSeparationPacket.status!==SPECIALIZED_INTEREST_SEPARATION_STATUS.READY_FOR_SPECIALIZED_VALUATION_PREMISE_REVIEW||
       !verifySpecializedInterestSeparationPacketIntegrity(interestSeparationPacket))
      blockers.push('HOTEL_INTEREST_SEPARATION_NOT_READY');
    if(interestSeparationPacket){
      if(interestSeparationPacket.valuationPremise===SPECIALIZED_VALUATION_PREMISE.ENTERPRISE_CONTEXT_REQUIRES_SEPARATE_ALLOCATION_REVIEW)
        blockers.push('ENTERPRISE_PREMISE_NOT_REAL_PROPERTY_INDICATION');
      if(![SPECIALIZED_VALUATION_PREMISE.REAL_PROPERTY_ONLY,
        SPECIALIZED_VALUATION_PREMISE.REAL_PROPERTY_PLUS_FF_E].includes(interestSeparationPacket.valuationPremise))
        blockers.push('HOTEL_INTEREST_PREMISE_UNSUPPORTED');
      if((interestSeparationPacket.componentTreatments||[]).some(t=>
        [SPECIALIZED_VALUE_COMPONENT.OPERATING_BUSINESS,
        SPECIALIZED_VALUE_COMPONENT.INTANGIBLE_BRAND_OR_FRANCHISE,
        SPECIALIZED_VALUE_COMPONENT.MANAGEMENT_OR_OPERATOR_CONTRACT].includes(t.component)&&
        t.treatment===COMPONENT_TREATMENT.INCLUDED_IN_PREMISE))
        blockers.push('HOTEL_NON_REAL_PROPERTY_CONFLATION');
    }
    if(!hotelMetricsPacket?.aggregateMetrics||!Number.isFinite(hotelMetricsPacket.aggregateMetrics.operatingSurplusAfterFfeReserveSar))
      blockers.push('HOTEL_OPERATING_SURPLUS_NOT_RECONCILED');
    const bridge=hotelIncomeBridge;
    if(!bridge||!Number.isFinite(bridge.reportedRealPropertyNoiSar)||bridge.reportedRealPropertyNoiSar<=0||
      !Number.isFinite(bridge.professionalOperatingBusinessAndIntangibleExclusionSar)||
      !Number.isFinite(bridge.propertySpecificNormalizedAdjustmentsSar)||
      !filled(bridge.ownerOperatorIncomeTreatmentRef)||!filled(bridge.auditedStatementsRef)||
      !SHA.test(bridge.sourceArtifactSha256||'')||!filled(bridge.reviewerRef)||
      !filled(bridge.provenanceRef))
      blockers.push('HOTEL_REAL_PROPERTY_NOI_BRIDGE_INCOMPLETE');
    else if(Number.isFinite(hotelMetricsPacket?.aggregateMetrics?.operatingSurplusAfterFfeReserveSar) &&
      Math.abs(hotelMetricsPacket.aggregateMetrics.operatingSurplusAfterFfeReserveSar
        -bridge.professionalOperatingBusinessAndIntangibleExclusionSar
        +bridge.propertySpecificNormalizedAdjustmentsSar
        -bridge.reportedRealPropertyNoiSar)>0.01)
      blockers.push('HOTEL_REAL_PROPERTY_NOI_BRIDGE_ARITHMETIC_INCONSISTENT');
    if(hotelMetricsPacket?.hospitalityOperatingMetricsHashSha256)
      referenced.push(hotelMetricsPacket.hospitalityOperatingMetricsHashSha256);
    if(interestSeparationPacket?.specializedInterestSeparationHashSha256)
      referenced.push(interestSeparationPacket.specializedInterestSeparationHashSha256);
  }else if(Object.values(INDUSTRIAL_SUBTYPE).includes(assetType)){
    if(!industrialSpec||industrialSpec.subtype!==assetType||!filled(industrialSpec.assetId)||
      industrialSpec.internalInspectionStatus!==INTERNAL_INSPECTION_STATUS.FULL_INTERNAL||
      industrialSpec.buildingPermitStatus!==BUILDING_PERMIT_STATUS.VERIFIED||
      industrialSpec.fireLifeSafetyStatus!=='VERIFIED_COMPLIANT'||
      !Number.isFinite(industrialSpec.builtAreaSqm)||industrialSpec.builtAreaSqm<=0||
      !Number.isFinite(industrialSpec.netLeasableAreaSqm)||industrialSpec.netLeasableAreaSqm<=0||
      !Number.isFinite(industrialSpec.clearHeightMeters)||industrialSpec.clearHeightMeters<=0||
      !Number.isFinite(industrialSpec.powerCapacityKva)||industrialSpec.powerCapacityKva<=0||
      !Number.isFinite(industrialSpec.metadata?.designFloorLoadKnPerSqm)||
      industrialSpec.metadata.designFloorLoadKnPerSqm<=0||
      !filled(industrialSpec.metadata?.actualPermittedUseRef))
      blockers.push('INDUSTRIAL_FULL_INSPECTION_PERMITS_AND_ENGINEERING_SPECS_REQUIRED');
    if(industrialSpec&&[
      LEASE_STRUCTURE.UNKNOWN].includes(industrialSpec.leaseStructure))
      blockers.push('INDUSTRIAL_LEASE_BURDEN_UNDEFINED');
    if(industrialSpec){
      try {profileIndustrialLogisticsAsset(industrialSpec);}
      catch {blockers.push('INDUSTRIAL_SPEC_INVALID');}
    }
    if(specialistChecks.some(c=>c?.type==='environmentalContamination'&&
      c.status==='REVIEWED_NOT_APPLICABLE'))blockers.push('INDUSTRIAL_ENVIRONMENTAL_REVIEW_REQUIRED');
    if(industrialSpec)referenced.push(hash(industrialSpec));
  }else blockers.push('UNSUPPORTED_SPECIALIZED_ASSET_TYPE');
  if(blockers.length)return hold(blockers);
  const result={version:VERSION,status:STATUS.READY_FOR_EXTERNAL_SPECIALIST_REVIEW,
    caseId,propertyRef,assetType,valuationDate,asOf,
    specialistEvidenceHashSha256:hash(specialistChecks),
    referencedSourceHashes:referenced,
    actualSpecialistEvidenceIndependentlyAuthenticated:false,
    professionalValuationApproved:false,transactionAuthorized:false,publicExportAuthorized:false,
    independentSpecialistReviewRequired:true,
    semantics:'A cross-module internal evidence gate only. Historical hotel profit, NOI and property rights are not interchangeable; industrial inspection and permissions remain self-declared until verified by an independently authorized professional. No investment or export authority.',
  };
  return freeze({...result,resultHashSha256:hash(result)});
}
module.exports={VERSION,STATUS,CHECKS,evaluateSpecializedAssetEvidence};
