'use strict';
const {sha256Hex}=require('../crypto/sha256');
const VERSION='INPUT_PROVENANCE_V1';
const fail=()=>{throw Object.assign(new Error('INVALID_INPUT_PROVENANCE'),{code:'INVALID_INPUT_PROVENANCE'});};
const nonempty=(s,max)=>typeof s==='string'&&s.trim().length>0&&s.length<=max;
function valueFingerprint(value){if(!['string','number','boolean'].includes(typeof value)||(typeof value==='number'&&!Number.isFinite(value)))fail();return sha256Hex(JSON.stringify(value));}
function validateInputProvenance(record){
 if(record===null||record===undefined)return null;
 if(record.version!==VERSION||!['building','land'].includes(record.mode)||!record.entries||typeof record.entries!=='object'||Array.isArray(record.entries)||Object.keys(record.entries).length>200)fail();
 for(const[field,e]of Object.entries(record.entries)){
  if(!nonempty(field,160)||['__proto__','constructor','prototype'].includes(field)||!e||e.field!==field||!['USER_ESTIMATE','DOCUMENT_REFERENCE'].includes(e.sourceKind)||e.verificationStatus!=='USER_SUPPLIED_UNVERIFIED'||e.authorityVerified!==false||!/^[a-f0-9]{64}$/.test(e.valueFingerprintSha256||'')||!nonempty(e.unit,80)||!nonempty(e.sourceReference,2000)||!nonempty(e.location,500)||!nonempty(e.reviewerRef,160)||!/^\d{4}-\d{2}-\d{2}$/.test(e.sourceDate||'')||!Number.isFinite(Date.parse(e.sourceDate))||new Date(e.sourceDate).toISOString().slice(0,10)!==e.sourceDate||!Number.isFinite(Date.parse(e.recordedAt)))fail();
  if(e.sourceKind==='DOCUMENT_REFERENCE'&&!/^[a-f0-9]{64}$/.test(e.documentDigestSha256||''))fail();
 }
 return record;
}
function recordInputProvenance({mode,inputs,current=null,field,unit,sourceKind,sourceReference,sourceDate,location,reviewerRef,documentDigestSha256='',recordedAt=new Date().toISOString()}){
 validateInputProvenance(current);if(!['building','land'].includes(mode)||!Object.prototype.hasOwnProperty.call(inputs,field)||current&&current.mode!==mode)fail();
 const e={field,unit,sourceKind,sourceReference,sourceDate,location,reviewerRef,documentDigestSha256,
  valueFingerprintSha256:valueFingerprint(inputs[field]),recordedAt,verificationStatus:'USER_SUPPLIED_UNVERIFIED',authorityVerified:false};
 const next={version:VERSION,mode,entries:{...(current?.entries||{}),[field]:e}};validateInputProvenance(next);return next;
}
function provenanceForInputs(mode,inputs,record=null){validateInputProvenance(record);if(record&&record.mode!==mode)fail();return Object.fromEntries(Object.keys(inputs).map(field=>{
 const entry=record?.entries[field]||null;let matched=false;try{matched=entry&&valueFingerprint(inputs[field])===entry.valueFingerprintSha256;}catch{}
 return [field,{...(entry||{}),field,status:!entry?'SOURCE_NOT_RECORDED':matched?'USER_SUPPLIED_UNVERIFIED':'VALUE_CHANGED_RECHECK_SOURCE',valueMatchesRecordedSource:Boolean(matched),authorityVerified:false}];
}));}
module.exports={VERSION,validateInputProvenance,recordInputProvenance,provenanceForInputs};
