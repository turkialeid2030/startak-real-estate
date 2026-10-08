'use strict';

const {ASSET_CLASS}=require('../project-model/project-profile');
const {STATUS: C62_STATUS}=require('./institutional-valuation-decision-boundary');
const {evaluateSpecialistReferenceIntake}=require('./specialist-reference-intake');
const {assessLocalDocumentManifest}=require('./specialist-document-intake');

const VERSION='C69_SPECIALIST_OPERATIONAL_HOLD_ONLY_V1';
const SPECIALIST_ASSETS=Object.freeze([
  ASSET_CLASS.HOSPITALITY,
  ASSET_CLASS.INDUSTRIAL_LOGISTICS,
]);
const COMMON=Object.freeze([
  'C69_SPECIALIZED_VALUATION_ADAPTER_NOT_IMPLEMENTED',
  'C69_INDEPENDENT_PROPERTY_INTEREST_AND_SOURCE_RIGHTS_NOT_VERIFIED',
  'C69_LICENSED_SPECIALIST_REPORT_NOT_APPROVED',
]);
const HOTEL=Object.freeze([
  'C69_HOTEL_METRICS_AND_FFE_RESERVE_UNVERIFIED',
  'C69_HOTEL_BUSINESS_GOODWILL_INTANGIBLES_NOT_SEPARATED',
  'C69_HOTEL_REAL_PROPERTY_NOI_BRIDGE_NOT_REVIEWED',
]);
const INDUSTRIAL=Object.freeze([
  'C69_INDUSTRIAL_INSPECTION_BUILDING_PERMIT_FIRE_CODE_MISSING',
  'C69_INDUSTRIAL_ENVIRONMENT_POWER_FLOOR_LOADING_NOT_VERIFIED',
  'C69_INDUSTRIAL_TITLE_LEASE_PERMITTED_USE_UNVERIFIED',
]);
function specializeUnsupportedValuationCase(valuationCase,{caseId}={}) {
  const assetClass=valuationCase?.classification?.assetClass;
  if(!SPECIALIST_ASSETS.includes(assetClass))return null;
  const blockers=Object.freeze([...COMMON,...(assetClass===ASSET_CLASS.HOSPITALITY?HOTEL:INDUSTRIAL)]);
  let referenceIntake=null,referenceIntakeInvalid=false;
  try{
    referenceIntake=evaluateSpecialistReferenceIntake({valuationCase,caseId});
  }catch{
    // A tampered, overlong or cross-asset saved intake must not crash into
    // an apparently eligible value. The six permanent C69 blocks remain.
    referenceIntakeInvalid=true;
  }
  const specialistRoute=Object.freeze({
    version:VERSION,assetClass,status:'HOLD_SPECIALIST_METHOD_NOT_WIRED',
    referenceIntake,referenceIntakeInvalid,
    documentFingerprintIntake:assessLocalDocumentManifest(valuationCase),
    adapterIntegrated:false,realProfessionalSourceAuthentication:false,
    externalSpecialistAuditCompleted:false,sourceRightsVerified:false,
    blockers,financialResultsAreGenericStudyOnly:true,
    valuationIndicationSar:null,transactionAuthorized:false,officialReportAuthorized:false,
  });
  const institutionalDecision=Object.freeze({
    version:VERSION,status:C62_STATUS.HOLD,blockers,
    methodChecks:Object.freeze([]),specialistStatus:'NOT_OPERATIONALLY_WIRED',
    readyForInstitutionalDecision:false,finalValueSar:null,
    arithmeticPreliminaryValueSar:null,
    professionalValuationApproved:false,
    independentAuthenticationEstablished:false,
    publicValuationReportExportAuthorized:false,transactionAuthorized:false,
    evidenceSource:'NO_SPECIALIST_METHOD_ADAPTER__NOT_AN_AUTHENTICATED_REVIEW',
  });
  return Object.freeze({specialistRoute,institutionalDecision});
}
module.exports={VERSION,SPECIALIST_ASSETS,specializeUnsupportedValuationCase};
