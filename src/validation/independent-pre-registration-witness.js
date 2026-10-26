'use strict';
// C56: a sealed, offline reviewer signature is a necessary but insufficient
// condition for an independently auditable time-forward Saudi sales replay.
// This file is Node/server-only. Never accept the trust key from the evidence
// packet or from any browser-entered field; a key must be independently pinned.
const crypto=require('node:crypto');
const VERSION='C56_EXTERNAL_PREREGISTRATION_WITNESS_V1';
const SHA_RE=/^[a-f0-9]{64}$/;
const ISO_RE=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const REVIEWER_RE=/^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/;
function canonical(value){
 if(Array.isArray(value))return value.map(canonical);
 if(value&&typeof value==='object'){
  if(Object.getPrototypeOf(value)!==Object.prototype&&Object.getPrototypeOf(value)!==null)
   throw Error('NON_PLAIN_PROTOCOL_OBJECT');
  return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));
 }
 if(value===undefined||typeof value==='function'||typeof value==='symbol'||
    typeof value==='bigint'||(typeof value==='number'&&!Number.isFinite(value)))
  throw Error('INVALID_PROTOCOL_JSON_VALUE');
 return value;
}
function protocolHash(protocol){
 if(!protocol||typeof protocol!=='object'||Array.isArray(protocol))throw Error('PROTOCOL_REQUIRED');
 return crypto.createHash('sha256').update(JSON.stringify(canonical(protocol))).digest('hex');
}
function message({protocolSha256,reviewerId,signedAt}){
 return Buffer.from(VERSION+'\n'+protocolSha256+'\n'+reviewerId+'\n'+signedAt+'\n','utf8');
}
function witnessHold(reasons,protocolSha256=null){
 return Object.freeze({status:'HOLD_INDEPENDENT_PROTOCOL_SEAL',
  reasonCodes:Object.freeze(reasons),protocolSha256,
  signatureCryptographicallyVerified:false,independentReviewerIdentityAuthenticated:false,
  independentMarketEvidenceVerified:false,sourceRightsVerified:false,
  professionalApprovalEstablished:false,transactionAuthorized:false});
}
function verifyIndependentPreRegistration({protocol,witness,operatorTrust}={}){
 let hash=null;
 try{hash=protocolHash(protocol);}catch(_){return witnessHold(['CANONICAL_PROTOCOL_INVALID']);}
 if(!operatorTrust||typeof operatorTrust!=='object'||Array.isArray(operatorTrust)||
    !REVIEWER_RE.test(operatorTrust.reviewerId||'')||
    typeof operatorTrust.pinnedPublicKeyPem!=='string')
  return witnessHold(['INDEPENDENT_PINNED_REVIEWER_KEY_MISSING'],hash);
 if(!witness||typeof witness!=='object'||Array.isArray(witness))
  return witnessHold(['SIGNED_PREREGISTRATION_WITNESS_MISSING'],hash);
 if(witness.version!==VERSION||witness.reviewerId!==operatorTrust.reviewerId||
   !SHA_RE.test(witness.protocolSha256||'')||witness.protocolSha256!==hash)
  return witnessHold(['WITNESS_PROTOCOL_OR_REVIEWER_MISMATCH'],hash);
 if(typeof witness.signedAt!=='string'||!ISO_RE.test(witness.signedAt)||
    !Number.isFinite(Date.parse(witness.signedAt))||
    new Date(witness.signedAt).toISOString().replace('.000Z','Z')!==witness.signedAt)
  return witnessHold(['WITNESS_SIGNED_AT_INVALID'],hash);
 if(typeof protocol.registeredAt!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(protocol.registeredAt)||
    typeof protocol.holdoutStartDate!=='string'||
    !/^\d{4}-\d{2}-\d{2}$/.test(protocol.holdoutStartDate)||
    witness.signedAt.slice(0,10)>protocol.registeredAt||
    !(witness.signedAt.slice(0,10)<protocol.holdoutStartDate))
  return witnessHold(['PRE_REGISTRATION_DATE_ORDER_INVALID'],hash);
 if(typeof witness.signatureBase64!=='string'||
    witness.signatureBase64.length!==88||
    !/^[A-Za-z0-9+/]{86}==$/.test(witness.signatureBase64))
  return witnessHold(['DETACHED_SIGNATURE_MALFORMED'],hash);
 try{
  const pub=crypto.createPublicKey(operatorTrust.pinnedPublicKeyPem);
  if(pub.asymmetricKeyType!=='ed25519')return witnessHold(['REVIEWER_KEY_NOT_ED25519'],hash);
  const sig=Buffer.from(witness.signatureBase64,'base64');
  if(sig.length!==64||!crypto.verify(null,message(witness),pub,sig))
   return witnessHold(['WITNESS_SIGNATURE_INVALID'],hash);
 }catch(_){return witnessHold(['WITNESS_SIGNATURE_INVALID'],hash);}
 return Object.freeze({status:'CRYPTOGRAPHIC_SEAL_VALID_REVIEW_REQUIRED',
  protocolSha256:hash,signatureCryptographicallyVerified:true,
  independentReviewerIdentityAuthenticated:false,
  independentMarketEvidenceVerified:false,sourceRightsVerified:false,
  professionalApprovalEstablished:false,transactionAuthorized:false,
  explanation:'Pinned Ed25519 proof binds a protocol and date only. Key custody, source provenance, data rights, real completed sales, licensed human review and commercial authorization remain unverified.'});
}
module.exports={VERSION,protocolHash,message,verifyIndependentPreRegistration};
