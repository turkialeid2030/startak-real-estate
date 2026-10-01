'use strict';

const crypto = require('crypto');
const {
  RIGHTS_MODE,
  NON_API_ACQUISITION_STATUS,
  getAcquisitionProfile,
  verifyNonApiAcquisitionRecordIntegrity,
  evaluateGovernedNonApiAcquisition,
} = require('./governed-non-api-acquisition');

const CAPABILITY = 'C25_SOURCE_OPERATIONAL_READINESS_V1';
const POLICY_VERSION = 'C25_SOURCE_OPERATIONAL_READINESS_POLICY_V1';

const STATUS = Object.freeze({
  READY_FOR_PREPRODUCTION_SOURCE_USE: 'READY_FOR_PREPRODUCTION_SOURCE_USE',
  HOLD_INTEGRITY: 'HOLD_INTEGRITY',
  HOLD_RIGHTS: 'HOLD_RIGHTS',
  HOLD_SCHEMA: 'HOLD_SCHEMA',
  HOLD_PARSER: 'HOLD_PARSER',
  HOLD_TEMPORAL: 'HOLD_TEMPORAL',
  HOLD_OUTAGE: 'HOLD_OUTAGE',
  HOLD_CONFLICT: 'HOLD_CONFLICT',
  HOLD_POLICY: 'HOLD_POLICY',
});
const RIGHTS_DISPOSITION = Object.freeze({
  OPEN_DATA_LICENSE_VERIFIED: 'OPEN_DATA_LICENSE_VERIFIED',
  VERIFIED_RIGHTS: 'VERIFIED_RIGHTS',
  WRITTEN_PERMISSION_VERIFIED: 'WRITTEN_PERMISSION_VERIFIED',
  UNVERIFIED: 'UNVERIFIED',
});
const AVAILABILITY = Object.freeze({ AVAILABLE:'AVAILABLE', DEGRADED:'DEGRADED', OUTAGE:'OUTAGE' });
const HASH_RE=/^[a-f0-9]{64}$/i;
const nonEmpty=(v)=>typeof v==='string'&&v.trim().length>0;
const clean=(v)=>nonEmpty(v)?v.trim():'';
function stable(v){if(Array.isArray(v))return v.map(stable);if(!v||typeof v!=='object')return v;return Object.keys(v).sort().reduce((o,k)=>{o[k]=stable(v[k]);return o;},{});}
function sha256(v){return crypto.createHash('sha256').update(JSON.stringify(stable(v))).digest('hex');}
function without(v,fs){const o={...v};fs.forEach((f)=>delete o[f]);return o;}
function freeze(v){if(!v||typeof v!=='object'||Object.isFrozen(v))return v;Object.values(v).forEach(freeze);return Object.freeze(v);}
function iso(v,f){if(!nonEmpty(v)||!Number.isFinite(Date.parse(v)))throw new TypeError(`${f} must be valid date/time`);return new Date(v).toISOString();}
function hash(v,f){const x=clean(v).toLowerCase();if(!HASH_RE.test(x))throw new TypeError(`${f} must be SHA-256`);return x;}
function integrity(r){return !!r&&HASH_RE.test(clean(r.operationalRecordHashSha256))&&sha256(without(r,['operationalRecordHashSha256']))===clean(r.operationalRecordHashSha256).toLowerCase();}

function createSourceOperationalRecord(x={}){
  ['operationalRecordId','profileId','sourceProvider','acquisitionRecordHashSha256','artifactHashSha256','parserVersion','dataContractVersion','reviewedByRef','reviewEvidenceRef'].forEach((f)=>{if(!nonEmpty(x[f]))throw new TypeError(`${f} must be non-empty`);});
  if(!Object.values(RIGHTS_DISPOSITION).includes(x.rightsDisposition))throw new TypeError('C25_RIGHTS_DISPOSITION_INVALID');
  if(!Object.values(AVAILABILITY).includes(x.availability))throw new TypeError('C25_AVAILABILITY_INVALID');
  const reviewedAt=iso(x.reviewedAt,'reviewedAt'), validUntil=iso(x.validUntil,'validUntil'), acquiredAt=iso(x.acquiredAt,'acquiredAt');
  if(Date.parse(validUntil)<Date.parse(reviewedAt)||Date.parse(validUntil)<Date.parse(acquiredAt))throw new TypeError('C25_VALIDITY_INVALID');
  const core={
    schemaVersion:1,
    operationalRecordId:x.operationalRecordId.trim(), profileId:x.profileId.trim(), sourceProvider:x.sourceProvider.trim(),
    acquisitionRecordHashSha256:hash(x.acquisitionRecordHashSha256,'acquisitionRecordHashSha256'), artifactHashSha256:hash(x.artifactHashSha256,'artifactHashSha256'),
    rightsDisposition:x.rightsDisposition, rightsEvidenceHashSha256:hash(x.rightsEvidenceHashSha256,'rightsEvidenceHashSha256'),
    parserVersion:x.parserVersion.trim(), parserValidated:x.parserValidated===true,
    schemaFingerprintSha256:hash(x.schemaFingerprintSha256,'schemaFingerprintSha256'), expectedSchemaFingerprintSha256:hash(x.expectedSchemaFingerprintSha256,'expectedSchemaFingerprintSha256'),
    dataContractVersion:x.dataContractVersion.trim(), requiredFieldsValidated:x.requiredFieldsValidated===true, silentCoercionUsed:x.silentCoercionUsed===true,
    acquiredAt, sourcePublishedAt:x.sourcePublishedAt?iso(x.sourcePublishedAt,'sourcePublishedAt'):null,
    freshnessValidUntil:iso(x.freshnessValidUntil,'freshnessValidUntil'), availability:x.availability,
    degradedFallbackRef:nonEmpty(x.degradedFallbackRef)?x.degradedFallbackRef.trim():null,
    conflictDetected:x.conflictDetected===true, conflictEvidenceRef:nonEmpty(x.conflictEvidenceRef)?x.conflictEvidenceRef.trim():null,
    reviewedByRef:x.reviewedByRef.trim(), reviewEvidenceRef:x.reviewEvidenceRef.trim(), reviewedAt, validUntil,
    hiddenEndpointDiscoveryUsed:false, credentialBypassUsed:false, captchaBypassUsed:false, accessControlEvasionUsed:false, rateLimitEvasionUsed:false,
    productionUseAuthorized:false, transactionAuthorized:false, approvalAuthorized:false, publicAiAuthorized:false, commercialGoLiveAuthorized:false,
  };
  if(x.hiddenEndpointDiscoveryUsed===true||x.credentialBypassUsed===true||x.captchaBypassUsed===true||x.accessControlEvasionUsed===true||x.rateLimitEvasionUsed===true)throw new TypeError('C25_FORBIDDEN_ACQUISITION_BEHAVIOR');
  return freeze({...core,operationalRecordHashSha256:sha256(core)});
}
function verifySourceOperationalRecord(r){return integrity(r);}

function rightsBlockers(profile,op){
  const b=[];
  if(!profile)return ['C25_POLICY_PROFILE_NOT_GOVERNED'];
  if(profile.rightsMode===RIGHTS_MODE.TERMS_UNVERIFIED)b.push('C25_RIGHTS_TERMS_UNVERIFIED_NOT_PRODUCTION_READY');
  if(profile.rightsMode===RIGHTS_MODE.PUBLISHED_OPEN_DATA_REUSE&&op.rightsDisposition!==RIGHTS_DISPOSITION.OPEN_DATA_LICENSE_VERIFIED)b.push('C25_RIGHTS_OPEN_DATA_LICENSE_NOT_VERIFIED');
  if(profile.rightsMode===RIGHTS_MODE.VERIFIED_RIGHTS_REQUIRED&&op.rightsDisposition!==RIGHTS_DISPOSITION.VERIFIED_RIGHTS)b.push('C25_RIGHTS_VERIFICATION_REQUIRED');
  if(profile.rightsMode===RIGHTS_MODE.WRITTEN_PERMISSION_REQUIRED&&op.rightsDisposition!==RIGHTS_DISPOSITION.WRITTEN_PERMISSION_VERIFIED)b.push('C25_RIGHTS_WRITTEN_PERMISSION_REQUIRED');
  return b;
}
function classify(b){
  if(b.some((x)=>x.startsWith('C25_INTEGRITY_')))return STATUS.HOLD_INTEGRITY;
  if(b.some((x)=>x.startsWith('C25_RIGHTS_')))return STATUS.HOLD_RIGHTS;
  if(b.some((x)=>x.startsWith('C25_SCHEMA_')))return STATUS.HOLD_SCHEMA;
  if(b.some((x)=>x.startsWith('C25_PARSER_')))return STATUS.HOLD_PARSER;
  if(b.some((x)=>x.startsWith('C25_TEMPORAL_')))return STATUS.HOLD_TEMPORAL;
  if(b.some((x)=>x.startsWith('C25_OUTAGE_')))return STATUS.HOLD_OUTAGE;
  if(b.some((x)=>x.startsWith('C25_CONFLICT_')))return STATUS.HOLD_CONFLICT;
  return STATUS.HOLD_POLICY;
}
function evaluateSourceOperationalReadiness(input={}){
  const asOf=iso(input.asOf,'asOf'); const record=input.acquisitionRecord, op=input.operationalRecord; const blockers=[];
  if(!record||!verifyNonApiAcquisitionRecordIntegrity(record))blockers.push('C25_INTEGRITY_ACQUISITION_RECORD');
  if(!op||!verifySourceOperationalRecord(op))blockers.push('C25_INTEGRITY_OPERATIONAL_RECORD');
  const profile=record?getAcquisitionProfile(record.profileId):null;
  if(record&&profile){
    const c2n=evaluateGovernedNonApiAcquisition(record,{asOf,trustedRightsVerifierIds:input.trustedRightsVerifierIds||[]});
    if(c2n.status!==NON_API_ACQUISITION_STATUS.READY_FOR_C2S_PROVENANCE_EVALUATION)blockers.push(`C25_POLICY_C2N_NOT_READY:${c2n.status}`);
  }
  if(record&&op&&verifySourceOperationalRecord(op)){
    if(op.acquisitionRecordHashSha256!==record.acquisitionRecordHashSha256)blockers.push('C25_INTEGRITY_ACQUISITION_BINDING');
    if(op.artifactHashSha256!==record.artifactHashSha256)blockers.push('C25_INTEGRITY_ARTIFACT_BINDING');
    if(op.profileId!==record.profileId||op.sourceProvider!==record.sourceProvider)blockers.push('C25_POLICY_PROVIDER_PROFILE_MISMATCH');
    blockers.push(...rightsBlockers(profile,op));
    if(op.schemaFingerprintSha256!==op.expectedSchemaFingerprintSha256)blockers.push('C25_SCHEMA_DRIFT_DETECTED');
    if(!op.parserValidated)blockers.push('C25_PARSER_NOT_VALIDATED');
    if(!op.requiredFieldsValidated)blockers.push('C25_SCHEMA_REQUIRED_FIELDS_NOT_VALIDATED');
    if(op.silentCoercionUsed)blockers.push('C25_SCHEMA_SILENT_COERCION_FORBIDDEN');
    if(Date.parse(op.acquiredAt)>Date.parse(asOf)||Date.parse(op.reviewedAt)>Date.parse(asOf)||(op.sourcePublishedAt&&Date.parse(op.sourcePublishedAt)>Date.parse(asOf)))blockers.push('C25_TEMPORAL_FUTURE_RECORD');
    if(Date.parse(op.freshnessValidUntil)<Date.parse(asOf)||Date.parse(op.validUntil)<Date.parse(asOf))blockers.push('C25_TEMPORAL_SOURCE_STALE');
    if(op.availability!==AVAILABILITY.AVAILABLE)blockers.push(`C25_OUTAGE_SOURCE_${op.availability}`);
    if(op.conflictDetected)blockers.push('C25_CONFLICT_UNRESOLVED_SOURCE_VALUES');
    if(op.productionUseAuthorized!==false||op.transactionAuthorized!==false||op.approvalAuthorized!==false||op.publicAiAuthorized!==false||op.commercialGoLiveAuthorized!==false)blockers.push('C25_INTEGRITY_AUTHORITY_INJECTION');
  }
  const unique=[...new Set(blockers)].sort(); const ready=unique.length===0;
  return freeze({capability:CAPABILITY,policyVersion:POLICY_VERSION,status:ready?STATUS.READY_FOR_PREPRODUCTION_SOURCE_USE:classify(unique),blockers:unique,
    profileId:record?.profileId||null,sourceProvider:record?.sourceProvider||null,artifactHashSha256:record?.artifactHashSha256||null,
    preproductionSourceReady:ready,conflictAutoReconciled:false,staleDataTreatedAsCurrent:false,productionUseAuthorized:false,transactionAuthorized:false,approvalAuthorized:false,publicAiAuthorized:false,commercialGoLive:'HOLD'});
}

module.exports=Object.freeze({CAPABILITY,POLICY_VERSION,STATUS,RIGHTS_DISPOSITION,AVAILABILITY,createSourceOperationalRecord,verifySourceOperationalRecord,evaluateSourceOperationalReadiness});
