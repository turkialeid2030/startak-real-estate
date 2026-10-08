'use strict';

/**
 * C73 stage 1: SERVER-SIDE cryptographic custody integrity contract, NOT a
 * document issuer/rights/valuer authenticity decision or production vault.
 * The HMAC secret and trusted monotonic head MUST come from independent,
 * access-controlled server services. Never bundle this module into the browser.
 */
const { createHmac, randomBytes, createHash, timingSafeEqual } = require('node:crypto');
const { MAX_BYTES, matchesSignature, TYPES } = require('../app/specialist-document-intake');

const SCHEMA_VERSION = 1;
const DOMAIN = 'STARTAK:C73:CUSTODY:V1\n';
const SHA = /^[0-9a-f]{64}$/;
const TAG = /^[0-9a-f]{64}$/;
const SCOPE_FIELDS = Object.freeze([
  'tenantId','caseId','projectId','propertyRef','valuationDate','documentId',
  'evidenceType','referenceId','artifactVersion','mediaType','sizeBytes','sha256Hex','nonce',
]);
const REQUEST_FIELDS = Object.freeze([
  'tenantId','caseId','projectId','propertyRef','valuationDate','documentId',
  'evidenceType','referenceId','artifactVersion','mediaType',
]);
const LEDGER_FIELDS = Object.freeze(['schemaVersion','keyRef','scope','events','headTag']);
const EVENT_FIELDS = Object.freeze(['sequence','kind','actorRef','observedAt','previousTag','tag']);
const STATE = Object.freeze({
  INTEGRITY_MATCHED_UNVERIFIED:'INTEGRITY_MATCHED_UNVERIFIED',
  HOLD_TRUSTED_HEAD_REQUIRED:'HOLD_TRUSTED_HEAD_REQUIRED',
  HOLD_SCOPE_MISMATCH:'HOLD_SCOPE_MISMATCH',
  HOLD_INTEGRITY:'HOLD_INTEGRITY',
  HOLD_REVOKED:'HOLD_REVOKED',
  HOLD_STALE:'HOLD_STALE',
  HOLD_FUTURE_EVENT:'HOLD_FUTURE_EVENT',
});
const EVENT = Object.freeze({
  OBSERVED:'BYTES_OBSERVED',
  RECHECKED:'BYTES_RECHECKED',
  REVOKED:'REVOKED',
});
function exactKeys(value, keys, code){
  if(!value || typeof value!=='object' || Array.isArray(value) ||
    Object.getPrototypeOf(value)!==Object.prototype ||
    Object.keys(value).length!==keys.length ||
    keys.some(k=>!Object.prototype.hasOwnProperty.call(value,k)))
    throw new TypeError(code);
}
function string(value,code){
  if(typeof value!=='string'||value.length<1||value.length>180||
    value.trim()!==value||/[\u0000-\u001f\u007f]/.test(value))
    throw new TypeError(code);
  return value;
}
function dateOnly(value){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||
    Number.isNaN(Date.parse(value+'T00:00:00.000Z'))||
    new Date(value+'T00:00:00.000Z').toISOString().slice(0,10)!==value)
    throw new TypeError('C73_VALUATION_DATE_INVALID');
  return value;
}
function time(value){
  if(typeof value!=='string'|| !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value)||
   Number.isNaN(Date.parse(value))||new Date(value).toISOString()!==value)
    throw new TypeError('C73_UTC_TIMESTAMP_INVALID');
  return Date.parse(value);
}
function secretKey(key){
  if(!(Buffer.isBuffer(key)||key instanceof Uint8Array)||key.byteLength<32)
    throw new TypeError('C73_256_BIT_SERVER_HMAC_KEY_REQUIRED');
  return key;
}
function byteBuffer(bytes){
  if(!(Buffer.isBuffer(bytes)||bytes instanceof Uint8Array)||
     bytes.byteLength<8||bytes.byteLength>MAX_BYTES)
    throw new TypeError('C73_BYTES_SIZE_INVALID');
  return Buffer.from(bytes);
}
function digest(bytes){return createHash('sha256').update(bytes).digest('hex');}
function freeze(x){
  if(x && typeof x==='object' && !Object.isFrozen(x)){
    Object.freeze(x); Object.values(x).forEach(freeze);
  }
  return x;
}
function scopePayload(raw){
  exactKeys(raw,SCOPE_FIELDS,'C73_SCOPE_FIELDS_INVALID');
  const result={};
  for(const k of SCOPE_FIELDS){
    if(['artifactVersion','sizeBytes'].includes(k)){
      if(!Number.isSafeInteger(raw[k])||raw[k]<1)throw new TypeError('C73_SCOPE_NUMBER_INVALID');
    }else if(k==='sha256Hex'){
      if(typeof raw[k]!=='string'||!SHA.test(raw[k]))throw new TypeError('C73_SCOPE_SHA_INVALID');
    }else if(k==='valuationDate'){ dateOnly(raw[k]); }
    else if(k==='nonce'){
      if(typeof raw[k]!=='string'||!/^[0-9a-f]{32}$/.test(raw[k]))
        throw new TypeError('C73_SCOPE_NONCE_INVALID');
    }else{string(raw[k],'C73_SCOPE_STRING_INVALID');}
    result[k]=raw[k];
  }
  if(raw.sizeBytes<8||raw.sizeBytes>MAX_BYTES||!Object.hasOwn(TYPES,raw.mediaType))
    throw new TypeError('C73_SCOPE_FILE_INVALID');
  return result;
}
function signedBody(keyRef,scope,event){
  // The signature covers all contextual identifiers and every event field,
  // including its predecessor. Version and keyRef are domain-separated.
  return DOMAIN + JSON.stringify({
    schemaVersion:SCHEMA_VERSION,keyRef,scope,
    event:{sequence:event.sequence,kind:event.kind,actorRef:event.actorRef,
      observedAt:event.observedAt,previousTag:event.previousTag},
  });
}
function sign(key,keyRef,scope,event){
  return createHmac('sha256',secretKey(key))
    .update(signedBody(keyRef,scope,event),'utf8').digest('hex');
}
function safeTagEquals(a,b){
  if(typeof a!=='string'||typeof b!=='string'||!TAG.test(a)||!TAG.test(b))return false;
  return timingSafeEqual(Buffer.from(a,'hex'),Buffer.from(b,'hex'));
}
function decision(status,revision=0){
  return freeze({
    status,revision,integrityVerified:status===STATE.INTEGRITY_MATCHED_UNVERIFIED,
    bytesPersistedByThisModule:false,malwareScannedByThisModule:false,
    sourceIndependentlyVerified:false,sourceRightsVerified:false,
    reviewerLicenseVerified:false,professionalReportAuthorized:false,
    transactionAuthorized:false,productionVaultReady:false,
  });
}
function verifyCustodyLedger(ledger,{key,keyRef,expectedScope,expectedHeadTag,
  expectedRevision,assessedAt,maxAgeSeconds}={}){
  secretKey(key);string(keyRef,'C73_KEY_REF_REQUIRED');
  // An untrusted ledger cannot attest its own trusted monotonic head.
  if(!TAG.test(expectedHeadTag||'')||!Number.isSafeInteger(expectedRevision)||expectedRevision<1)
    return decision(STATE.HOLD_TRUSTED_HEAD_REQUIRED);
  let scope;
  try{
    exactKeys(ledger,LEDGER_FIELDS,'C73_LEDGER_INVALID');
    if(ledger.schemaVersion!==SCHEMA_VERSION||ledger.keyRef!==keyRef||
       !Array.isArray(ledger.events)||ledger.events.length<1||ledger.events.length>1000)
      throw Error('C73_LEDGER_VERSION_OR_EVENTS_INVALID');
    scope=scopePayload(ledger.scope);
    if(expectedScope){
      if(!expectedScope||typeof expectedScope!=='object'||Array.isArray(expectedScope))
        return decision(STATE.HOLD_SCOPE_MISMATCH);
      // Required trusted identifiers cannot be omitted or inferred from the ledger.
      for(const field of ['tenantId','caseId','projectId','propertyRef',
        'valuationDate','documentId','evidenceType','referenceId','artifactVersion']){
        if(!Object.hasOwn(expectedScope,field)||expectedScope[field]!==scope[field])
          return decision(STATE.HOLD_SCOPE_MISMATCH);
      }
    }else return decision(STATE.HOLD_SCOPE_MISMATCH);
    if(expectedRevision!==ledger.events.length||
       !safeTagEquals(expectedHeadTag,ledger.headTag))
      return decision(STATE.HOLD_TRUSTED_HEAD_REQUIRED);
    let previous=null,prevMillis=-Infinity;
    for(let i=0;i<ledger.events.length;i++){
      const e=ledger.events[i];
      exactKeys(e,EVENT_FIELDS,'C73_EVENT_INVALID');
      if(e.sequence!==i+1||!Object.values(EVENT).includes(e.kind)||
        (i===0&&e.kind!==EVENT.OBSERVED)||
        (i>0&&e.kind===EVENT.OBSERVED)||
        e.previousTag!==previous)
        throw Error('C73_CHAIN_SEQUENCE_INVALID');
      string(e.actorRef,'C73_ACTOR_INVALID');
      const observed=time(e.observedAt);
      if(observed<=prevMillis)throw Error('C73_EVENT_TIME_ORDER_INVALID');
      prevMillis=observed;
      const expected=sign(key,keyRef,scope,e);
      if(!safeTagEquals(expected,e.tag))throw Error('C73_EVENT_MAC_INVALID');
      previous=e.tag;
      if(e.kind===EVENT.REVOKED && i!==ledger.events.length-1)
        throw Error('C73_REVOKED_CHAIN_APPEND_INVALID');
    }
    if(!safeTagEquals(previous,ledger.headTag))throw Error('C73_LAST_HEAD_INVALID');
    const now=time(assessedAt);
    if(prevMillis>now)return decision(STATE.HOLD_FUTURE_EVENT,ledger.events.length);
    if(!Number.isSafeInteger(maxAgeSeconds)||maxAgeSeconds<0||
      now-prevMillis>maxAgeSeconds*1000)
      return decision(STATE.HOLD_STALE,ledger.events.length);
    return decision(ledger.events.at(-1).kind===EVENT.REVOKED?
      STATE.HOLD_REVOKED:STATE.INTEGRITY_MATCHED_UNVERIFIED,ledger.events.length);
  }catch(_){return decision(STATE.HOLD_INTEGRITY);}
}
function createCustodyLedger({key,keyRef,scope,bytes,actorRef,observedAt}={}){
  secretKey(key);string(keyRef,'C73_KEY_REF_REQUIRED');
  const raw=byteBuffer(bytes);
  exactKeys(scope,REQUEST_FIELDS,'C73_INPUT_SCOPE_UNEXPECTED_OR_MISSING_FIELD');
  const mediaType=scope.mediaType;
  if(!Object.hasOwn(TYPES,mediaType)||!matchesSignature(raw,mediaType))
    throw new TypeError('C73_FILE_HEADER_OR_MIME_REJECTED');
  const complete=scopePayload({
    tenantId:scope.tenantId,caseId:scope.caseId,projectId:scope.projectId,
    propertyRef:scope.propertyRef,valuationDate:scope.valuationDate,
    documentId:scope.documentId,evidenceType:scope.evidenceType,
    referenceId:scope.referenceId,artifactVersion:scope.artifactVersion,
    mediaType,sizeBytes:raw.length,sha256Hex:digest(raw),
    nonce:randomBytes(16).toString('hex'),
  });
  string(actorRef,'C73_ACTOR_INVALID');
  time(observedAt);
  const event={sequence:1,kind:EVENT.OBSERVED,actorRef,observedAt,previousTag:null};
  const tag=sign(key,keyRef,complete,event);
  return freeze({schemaVersion:SCHEMA_VERSION,keyRef,scope:complete,
    events:[{...event,tag}],headTag:tag});
}
function appendCustodyEvent(ledger,{key,keyRef,expectedScope,expectedHeadTag,
  expectedRevision,bytes,actorRef,observedAt,kind}={}){
  if(![EVENT.RECHECKED,EVENT.REVOKED].includes(kind))
    throw new TypeError('C73_EVENT_KIND_NOT_ALLOWED');
  const verdict=verifyCustodyLedger(ledger,{key,keyRef,expectedScope,
    expectedHeadTag,expectedRevision,assessedAt:observedAt,maxAgeSeconds:315360000});
  if(verdict.status!==STATE.INTEGRITY_MATCHED_UNVERIFIED)
    throw new Error('C73_CURRENT_SIGNED_CUSTODY_REQUIRED:'+verdict.status);
  if(kind===EVENT.RECHECKED){
    const raw=byteBuffer(bytes);
    if(raw.length!==ledger.scope.sizeBytes||
      !matchesSignature(raw,ledger.scope.mediaType)||
      digest(raw)!==ledger.scope.sha256Hex)
      throw new TypeError('C73_BYTE_RECHECK_MISMATCH');
  }
  string(actorRef,'C73_ACTOR_INVALID');
  const e={sequence:ledger.events.length+1,kind,actorRef,observedAt,
    previousTag:ledger.headTag};
  time(observedAt);
  if(time(observedAt)<=time(ledger.events.at(-1).observedAt))
    throw new TypeError('C73_NONMONOTONIC_EVENT_TIME');
  const tag=sign(key,keyRef,ledger.scope,e);
  return freeze({schemaVersion:SCHEMA_VERSION,keyRef,scope:{...ledger.scope},
    events:[...ledger.events.map(x=>({...x})),{...e,tag}],headTag:tag});
}
module.exports={SCHEMA_VERSION,STATE,EVENT,createCustodyLedger,
  verifyCustodyLedger,appendCustodyEvent};
