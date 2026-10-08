'use strict';

/**
 * C72: local-only BYTE HASH inventory. NEVER a source signature, provenance
 * verification, virus scan, official copy, uploaded document or licensed
 * professional authentication. All persisted fields are untrusted metadata.
 */
const {
  EVIDENCE_TYPES,normalizeSpecialistReferenceIntake,
}=require('./specialist-reference-intake');

const VERSION='C72_LOCAL_BROWSER_DOCUMENT_HASH_V2';
const MAX_BYTES=5*1024*1024;
const SHA256=/^[0-9a-f]{64}$/;
const TYPES=Object.freeze({
  'application/pdf': 'PDF',
  'image/png':'PNG',
  'image/jpeg':'JPEG',
});
const ENTRY_KEYS=Object.freeze([
  'evidenceType','referenceId','sha256Hex','sizeBytes','mediaType',
  'status','bytesStored','sourceIndependentlyVerified','licensedReviewerApproved',
]);
const MANIFEST_KEYS=Object.freeze([
  'schemaVersion','assetClass','assetSubtype','propertyRef',
  'asOf','projectId','valuationDate','entries',
]);
function isObject(value){
 return value!==null&&typeof value==='object'&&!Array.isArray(value)
  &&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null);
}
function strictKeys(value,keys,code){
 if(!isObject(value))throw new TypeError(code+'_OBJECT_REQUIRED');
 const allowed=new Set(keys);
 if(Object.keys(value).some(key=>!allowed.has(key)))throw new TypeError(code+'_UNKNOWN_FIELD');
}
function matchesSignature(bytes,mediaType){
 if(mediaType==='application/pdf')return bytes.length>=8&&
  [0x25,0x50,0x44,0x46,0x2d].every((v,i)=>bytes[i]===v);
 if(mediaType==='image/png')return bytes.length>=8&&
  [137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v);
 if(mediaType==='image/jpeg')return bytes.length>=4&&
  bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff;
 return false;
}
function caseBinding(valuationCase){
 const id=valuationCase?.projectId;
 const date=valuationCase?.incomePolicy?.valuationDate;
 if(typeof id!=='string'||!id.trim()||id.length>160||
    typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date))
  throw new TypeError('C72_PROJECT_AND_VALUATION_DATE_REQUIRED');
 return {projectId:id,valuationDate:date};
}
function emptyManifest(intake,valuationCase){
 const s=normalizeSpecialistReferenceIntake(intake,intake?.assetClass);
 return {schemaVersion:2,assetClass:s.assetClass,
  assetSubtype:s.assetSubtype,propertyRef:s.propertyRef,
  asOf:s.asOf,...caseBinding(valuationCase),entries:[]};
}
function normalizeManifest(manifest,intake,valuationCase){
 const scoped=normalizeSpecialistReferenceIntake(intake,intake?.assetClass);
 const binding=caseBinding(valuationCase);
 if(manifest==null)return emptyManifest(scoped,valuationCase);
 strictKeys(manifest,MANIFEST_KEYS,'C72_MANIFEST');
 if(manifest.schemaVersion!==2||manifest.assetClass!==scoped.assetClass||
    manifest.assetSubtype!==scoped.assetSubtype||
    manifest.propertyRef!==scoped.propertyRef||manifest.asOf!==scoped.asOf||
    manifest.projectId!==binding.projectId||manifest.valuationDate!==binding.valuationDate)
  throw new TypeError('C72_MANIFEST_CASE_CONTEXT_MISMATCH');
 if(!Array.isArray(manifest.entries)||manifest.entries.length>EVIDENCE_TYPES.length)
  throw new TypeError('C72_ENTRIES_INVALID');
 const seen=new Set();
 const entries=manifest.entries.map(entry=>{
  strictKeys(entry,ENTRY_KEYS,'C72_ENTRY');
  const type=entry.evidenceType;
  if(!EVIDENCE_TYPES.includes(type)||seen.has(type))throw new TypeError('C72_ENTRY_CONTROL_INVALID');
  seen.add(type);
  if(typeof entry.referenceId!=='string'||!entry.referenceId||
    entry.referenceId!==scoped.evidenceRefs[type])
    throw new TypeError('C72_ENTRY_REFERENCE_MISMATCH');
  if(!SHA256.test(entry.sha256Hex||'')||
    !Number.isInteger(entry.sizeBytes)||entry.sizeBytes<8||entry.sizeBytes>MAX_BYTES||
    !Object.hasOwn(TYPES,entry.mediaType))
    throw new TypeError('C72_ENTRY_METADATA_INVALID');
  if(entry.status!=='LOCAL_HASH_ONLY_UNVERIFIED'||entry.bytesStored!==false||
     entry.sourceIndependentlyVerified!==false||entry.licensedReviewerApproved!==false)
    throw new TypeError('C72_FORGED_DOCUMENT_AUTHORITY');
  return {
    evidenceType:type,referenceId:entry.referenceId,sha256Hex:entry.sha256Hex,
    sizeBytes:entry.sizeBytes,mediaType:entry.mediaType,
    status:'LOCAL_HASH_ONLY_UNVERIFIED',bytesStored:false,
    sourceIndependentlyVerified:false,licensedReviewerApproved:false,
  };
 });
 return {schemaVersion:2,assetClass:scoped.assetClass,
  assetSubtype:scoped.assetSubtype,propertyRef:scoped.propertyRef,asOf:scoped.asOf,
  ...binding,entries};
}
async function fingerprintLocalFile(file,intake,evidenceType){
 const s=normalizeSpecialistReferenceIntake(intake,intake?.assetClass);
 if(!EVIDENCE_TYPES.includes(evidenceType)||!s.evidenceRefs[evidenceType])
  throw new TypeError('C72_REFERENCE_REQUIRED_FIRST');
 if(!file||typeof file.arrayBuffer!=='function'||
    !Number.isInteger(file.size)||file.size<8||file.size>MAX_BYTES)
  throw new TypeError('C72_FILE_SIZE_OR_TYPE_REJECTED');
 if(!Object.hasOwn(TYPES,file.type))throw new TypeError('C72_FILE_MEDIA_REJECTED');
 // Size is checked BEFORE reading bytes into browser memory.
 const raw=await file.arrayBuffer();
 const bytes=new Uint8Array(raw);
 if(bytes.length!==file.size||!matchesSignature(bytes,file.type))
  throw new TypeError('C72_FILE_SIGNATURE_MISMATCH');
 if(typeof globalThis.crypto?.subtle?.digest!=='function')
  throw new TypeError('C72_SECURE_CONTEXT_CRYPTO_REQUIRED');
 const digest=await globalThis.crypto.subtle.digest('SHA-256',bytes);
 const sha256Hex=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
 if(!SHA256.test(sha256Hex))throw new TypeError('C72_DIGEST_INVALID');
 return {
  evidenceType,referenceId:s.evidenceRefs[evidenceType],sha256Hex,
  sizeBytes:file.size,mediaType:file.type,
  status:'LOCAL_HASH_ONLY_UNVERIFIED',
  bytesStored:false,sourceIndependentlyVerified:false,
  licensedReviewerApproved:false,
 };
}
function addDocumentHash(manifest,intake,entry,valuationCase){
 const prev=normalizeManifest(manifest,intake,valuationCase);
 const candidate={...prev,entries:[
   ...prev.entries.filter(e=>e.evidenceType!==entry.evidenceType),entry,
 ]};
 return normalizeManifest(candidate,intake,valuationCase);
}
function assessLocalDocumentManifest(valuationCase){
 const intake=valuationCase?.institutionalEvidence?.specialistIntake;
 const raw=valuationCase?.institutionalEvidence?.specialistDocumentManifest;
 if(!intake||!intake.assetClass)return Object.freeze({
  status:'HOLD_NO_SPECIALIST_INTAKE',hashedControlCount:0,invalid:raw!=null,
  sourceIndependentlyVerified:false,documentsStored:false,officialReportAuthorized:false,
 });
 try{
  const manifest=normalizeManifest(raw,intake,valuationCase);
  return Object.freeze({
   status:'HOLD_LOCAL_HASH_NOT_PROVENANCE',hashedControlCount:manifest.entries.length,
   invalid:false,sourceIndependentlyVerified:false,
   documentsStored:false,officialReportAuthorized:false,
  });
 }catch{
  return Object.freeze({
   status:'HOLD_INVALID_LOCAL_DOCUMENT_MANIFEST',hashedControlCount:0,
   invalid:true,sourceIndependentlyVerified:false,
   documentsStored:false,officialReportAuthorized:false,
  });
 }
}
module.exports={
 VERSION,MAX_BYTES,TYPES,
 matchesSignature,caseBinding,emptyManifest,normalizeManifest,
 fingerprintLocalFile,addDocumentHash,assessLocalDocumentManifest,
};
