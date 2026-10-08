'use strict';

/**
 * C70: reference-only evidence intake. Records do not contain documents,
 * actual SHA-256 artifact digests, verified reviewer identity or authority.
 * C61 is executed on the exact current in-app case context; its self-declared
 * sources can never become an independently authenticated professional value.
 */
const {ASSET_CLASS}=require('../project-model/project-profile');
const {INDUSTRIAL_SUBTYPE}=require('../valuation-intelligence/adapters/industrial-logistics');
const {CHECKS,evaluateSpecializedAssetEvidence}=require('../specialized-assets/specialist-operational-gate');

const VERSION='C70_SPECIALIST_REFERENCE_INTAKE_V1';
const HOTEL_TYPES=Object.freeze(['HOTEL_FULL_SERVICE','HOTEL_LIMITED_SERVICE','SERVICED_APARTMENTS','RESORT']);
const INDUSTRIAL_TYPES=Object.freeze(Object.values(INDUSTRIAL_SUBTYPE));
const EVIDENCE_TYPES=Object.freeze([...CHECKS]);
const ALLOWED=new Set(['schemaVersion','assetClass','assetSubtype','propertyRef','asOf','evidenceRefs']);
const SAFE_REF=/^[\p{L}\p{N}][\p{L}\p{N} ._-]{0,79}$/u;

function assetTypes(assetClass){
 if(assetClass===ASSET_CLASS.HOSPITALITY)return HOTEL_TYPES;
 if(assetClass===ASSET_CLASS.INDUSTRIAL_LOGISTICS)return INDUSTRIAL_TYPES;
 throw new TypeError('C70_UNSUPPORTED_SPECIALIST_CLASS');
}
function emptySpecialistReferenceIntake(assetClass){
 assetTypes(assetClass);
 return {schemaVersion:1,assetClass,assetSubtype:'',propertyRef:'',asOf:'',
 evidenceRefs:Object.fromEntries(EVIDENCE_TYPES.map(type=>[type,'']))};
}
function isDate(v){
 if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;
 const d=new Date(v);
 return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===v;
}
function isSafeRef(value){return value===''||(typeof value==='string'&&SAFE_REF.test(value)&&value.trim()===value);}
function normalizeSpecialistReferenceIntake(raw,expectedAssetClass){
 assetTypes(expectedAssetClass);
 if(raw===null||raw===undefined)return emptySpecialistReferenceIntake(expectedAssetClass);
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new TypeError('C70_INTAKE_OBJECT_REQUIRED');
 for(const key of Object.keys(raw))if(!ALLOWED.has(key))throw new TypeError('C70_UNKNOWN_INTAKE_FIELD:'+key);
 if(raw.schemaVersion!==1||raw.assetClass!==expectedAssetClass)throw new TypeError('C70_INTAKE_ASSET_OR_VERSION_MISMATCH');
 const values=assetTypes(expectedAssetClass);
 if(typeof raw.assetSubtype!=='string'||(raw.assetSubtype!==''&&!values.includes(raw.assetSubtype)))
  throw new TypeError('C70_INVALID_SPECIALIST_SUBTYPE');
 if(!isSafeRef(raw.propertyRef)||typeof raw.propertyRef!=='string')throw new TypeError('C70_UNSAFE_PROPERTY_REFERENCE');
 if(raw.asOf!==''&&!isDate(raw.asOf))throw new TypeError('C70_INVALID_AS_OF_DATE');
 if(!raw.evidenceRefs||typeof raw.evidenceRefs!=='object'||Array.isArray(raw.evidenceRefs))
  throw new TypeError('C70_EVIDENCE_REFERENCE_MAP_REQUIRED');
 for(const type of Object.keys(raw.evidenceRefs))if(!EVIDENCE_TYPES.includes(type))
  throw new TypeError('C70_UNKNOWN_EVIDENCE_TYPE:'+type);
 const evidenceRefs={};
 for(const type of EVIDENCE_TYPES){
  const value=raw.evidenceRefs[type]||'';
  if(typeof value!=='string'||!isSafeRef(value))throw new TypeError('C70_UNSAFE_EVIDENCE_REFERENCE:'+type);
  evidenceRefs[type]=value;
 }
 return {schemaVersion:1,assetClass:raw.assetClass,assetSubtype:raw.assetSubtype,
  propertyRef:raw.propertyRef,asOf:raw.asOf,evidenceRefs};
}
function evaluateSpecialistReferenceIntake({valuationCase,caseId}={}){
 const assetClass=valuationCase?.classification?.assetClass;
 const raw=valuationCase?.institutionalEvidence?.specialistIntake;
 const intake=normalizeSpecialistReferenceIntake(raw,assetClass);
 const hasCompleteMetadata=Boolean(intake.assetSubtype&&intake.propertyRef&&intake.asOf);
 // Deliberate statuses: user input is NEVER C61 CONFIRMED. No artifact hashes
 // and no verified reviewer identity are fabricated from a text reference.
 const specialistChecks=EVIDENCE_TYPES.map(type=>({
  type,
  status:intake.evidenceRefs[type]?'RECEIVED_UNVERIFIED':'MISSING',
  evidenceRef:intake.evidenceRefs[type]||null,
  artifactSha256:null,reviewedByRef:null,reviewedAt:null,
 }));
 const result=evaluateSpecializedAssetEvidence({
  assetType:intake.assetSubtype||'UNCLASSIFIED_SPECIALIST',
  caseId:caseId||'',
  propertyRef:intake.propertyRef,
  valuationDate:valuationCase.incomePolicy?.valuationDate||'',
  asOf:intake.asOf,
  specialistChecks,
  // No hotel historical packet, independent interest allocation or
  // industrial physical engineering inspection is invented.
 });
 const count=EVIDENCE_TYPES.filter(x=>Boolean(intake.evidenceRefs[x])).length;
 if(result.actualSpecialistEvidenceIndependentlyAuthenticated===true
  ||result.professionalValuationApproved===true
  ||result.transactionAuthorized===true||result.publicExportAuthorized===true)
  throw new Error('C70_C61_AUTHORITY_CONTRACT_VIOLATION');
 return Object.freeze({
  version:VERSION,status:'HOLD_UNVERIFIED_REFERENCE_INTAKE',
  assetClass,assetSubtype:intake.assetSubtype||null,
  submittedReferenceCount:count,requiredControlCount:EVIDENCE_TYPES.length,
  metadataComplete:hasCompleteMetadata,
  c61Status:result.status,c61Blockers:Object.freeze([...(result.blockers||[])]),
  referenceOnly:true,documentsUploaded:false,
  sourceRightsIndependentlyVerified:false,
  professionalValuationApproved:false,transactionAuthorized:false,
  authorizedProfessionalReport:false,
  eligibilityExplanation:'This is local reference metadata only. C61 evaluates unverified user-described references as unresolved; no actual documents, licensed reviewer, source authentication, property value or public report are created.',
 });
}
module.exports={VERSION,HOTEL_TYPES,INDUSTRIAL_TYPES,EVIDENCE_TYPES,
 emptySpecialistReferenceIntake,normalizeSpecialistReferenceIntake,
 evaluateSpecialistReferenceIntake};
