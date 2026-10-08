'use strict';
// C73.4: cryptographically verify a *proposed* external release evidence pack.
// Deliberately incapable of granting production, official valuation or
// transaction permission. Evidence remains subject to independently authorized
// real reviewers, legal/privacy and professional sign-off.
const {createHash,createPublicKey,verify,timingSafeEqual}=require('node:crypto');
const DOMAIN='STARTAK:C73.4:EXTERNAL-P0-EVIDENCE:V1\n';
const GATES=Object.freeze({
 'P0-A':'CLOUD_INFRASTRUCTURE',
 'P0-B':'IDENTITY_SECURITY',
 'P0-C':'DOCUMENT_SECURITY',
 'P0-D':'SAUDI_LEGAL_PRIVACY',
 'P0-E':'LICENSED_VALUATION',
 'P0-F':'MODEL_VALIDATION',
 'P0-G':'INDEPENDENT_ASSURANCE',
 'P0-H':'BOARD_RELEASE_AUTHORITY',
});
const FIELDS=Object.freeze([
 'version','gateId','environment','targetSha','issuerId','role',
 'evidenceHash','issuedAt','expiresAt','decision','nonce',
]);
const HASH=/^[a-f0-9]{64}$/;
const SHA=/^[a-f0-9]{40}$/;
const NONCE=/^[A-Za-z0-9_-]{22,88}$/;
const SIGNATURE=/^[A-Za-z0-9_-]{86}$/;
const MAX_BYTES=4*1024*1024;
function failure(code){const e=new Error(code);e.code=code;return e;}
function exact(obj,keys){
 return obj&&typeof obj==='object'&&!Array.isArray(obj)&&
  Object.keys(obj).length===keys.length&&keys.every(k=>Object.hasOwn(obj,k));
}
function nonempty(x){return typeof x==='string'&&x.length>0&&x.length<=180&&
 x.trim()===x&&!/[\u0000-\u001f\u007f]/.test(x);}
function timestamp(x){
 if(typeof x!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(x))return NaN;
 const n=Date.parse(x);
 return Number.isFinite(n)&&new Date(n).toISOString()===x?n:NaN;
}
function eqHex(a,b,regex){
 return typeof a==='string'&&typeof b==='string'&&regex.test(a)&&regex.test(b)&&
 timingSafeEqual(Buffer.from(a,'hex'),Buffer.from(b,'hex'));
}
function encoded(p){return Buffer.from(DOMAIN+JSON.stringify(
 Object.fromEntries(FIELDS.map(k=>[k,p[k]]))),'utf8');}
function hold(reasons,details=[]){
 return Object.freeze({status:'HOLD_EXTERNAL_P0_EVIDENCE',reasonCodes:Object.freeze([...new Set(reasons)]),
  verifiedEvidence:Object.freeze(details),
  approvalForProduction:false,professionalValuationAuthorized:false,
  transactionAuthorized:false,externalApprovalsIndependentlyConfirmedByThisModule:false,
  independentHumanGoNoGoRequired:true});
}
function verifyExternalReadinessEvidence({
 environment,targetSha,evidence=[],trustPolicy={},now
}={}){
 if(!nonempty(environment)||!SHA.test(targetSha||'')||
  !Array.isArray(evidence)||!trustPolicy||typeof trustPolicy!=='object'||
  typeof now!=='function')
  throw failure('C73_4_EVIDENCE_GATE_CONFIG_INVALID');
 const at=now();
 if(!(at instanceof Date)||!Number.isFinite(at.getTime()))
  throw failure('C73_4_TRUSTED_CLOCK_INVALID');
 const nowMs=at.getTime();
 const required=Object.keys(GATES),reasons=[],reports=[];
 const seenGate=new Set(),seenIssuer=new Set(),seenFingerprint=new Set();
 const seenNonce=new Set(),seenEvidenceHash=new Set();
 for(const gate of required)if(!evidence.some(x=>x?.claim?.gateId===gate))
  reasons.push('MISSING_GATE:'+gate);
 if(evidence.length!==required.length)
  reasons.push('EVIDENCE_SET_SIZE_INVALID');
 for(const item of evidence){
  const p=item?.claim,gateId=p?.gateId;
  const report={gateId:typeof gateId==='string'?gateId:'UNKNOWN',
   issuerId:typeof p?.issuerId==='string'?p.issuerId:null,
   verified:false};
  reports.push(Object.freeze(report));
  if(!exact(item,['claim','signature','evidenceBytes'])||
   !exact(p,FIELDS)||!Object.hasOwn(GATES,gateId)){
   reasons.push('INVALID_EVIDENCE_SCHEMA');continue;
  }
  if(seenGate.has(gateId)){reasons.push('DUPLICATE_GATE:'+gateId);continue;}
  seenGate.add(gateId);
  if(p.version!==1||!nonempty(p.environment)||!nonempty(p.issuerId)||
   !nonempty(p.role)||p.role!==GATES[gateId]||p.decision!=='APPROVE'||
   !HASH.test(p.evidenceHash||'')||!NONCE.test(p.nonce||'')||
   !SHA.test(p.targetSha||'')){
   reasons.push('INVALID_CLAIM_FIELDS:'+gateId);continue;
  }
  if(!eqHex(p.targetSha,targetSha,SHA)||p.environment!==environment){
   reasons.push('EVIDENCE_SCOPE_MISMATCH:'+gateId);continue;
  }
  const start=timestamp(p.issuedAt),end=timestamp(p.expiresAt);
  if(!Number.isFinite(start)||!Number.isFinite(end)||
   start>nowMs+5000||end<=nowMs||end<=start||
   end-start>90*24*3600*1000){
   reasons.push('EVIDENCE_EXPIRED_OR_UNTRUSTED_TIME:'+gateId);continue;
  }
  if(!Buffer.isBuffer(item.evidenceBytes)&&!(item.evidenceBytes instanceof Uint8Array)){
   reasons.push('EVIDENCE_BYTES_NOT_FETCHED:'+gateId);continue;
  }
  if(item.evidenceBytes.length===0||item.evidenceBytes.length>MAX_BYTES){
   reasons.push('EVIDENCE_BYTES_LIMIT:'+gateId);continue;
  }
  const digest=createHash('sha256').update(item.evidenceBytes).digest('hex');
  if(!eqHex(digest,p.evidenceHash,HASH)){
   reasons.push('EVIDENCE_BYTE_HASH_MISMATCH:'+gateId);continue;
  }
  const owner=trustPolicy[p.issuerId];
  if(!owner||!exact(owner,['gateId','role','publicKey'])||
    owner.gateId!==gateId||owner.role!==p.role){
   reasons.push('UNTRUSTED_ISSUER_OR_ROLE:'+gateId);continue;
  }
  let pub,fp;
  try{
   pub=owner.publicKey?.type==='public'?owner.publicKey:createPublicKey(owner.publicKey);
   if(pub.asymmetricKeyType!=='ed25519')throw Error('incorrect key type');
   fp=createHash('sha256').update(pub.export({type:'spki',format:'der'})).digest('hex');
  }catch{
   reasons.push('INVALID_ISSUER_KEY:'+gateId);continue;
  }
  if(typeof item.signature!=='string'||!SIGNATURE.test(item.signature)||
    !verify(null,encoded(p),pub,Buffer.from(item.signature,'base64url'))){
   reasons.push('SIGNATURE_INVALID:'+gateId);continue;
  }
  if(seenIssuer.has(p.issuerId)||seenFingerprint.has(fp)){
   reasons.push('NOT_INDEPENDENT_SIGNERS:'+gateId);continue;
  }
  if(seenNonce.has(p.issuerId+':'+p.nonce)||seenEvidenceHash.has(digest)){
   reasons.push('DUPLICATE_NONCE_OR_EVIDENCE:'+gateId);continue;
  }
  seenIssuer.add(p.issuerId);seenFingerprint.add(fp);
  seenNonce.add(p.issuerId+':'+p.nonce);seenEvidenceHash.add(digest);
  report.verified=true;
  report.evidenceHash=digest;
  report.expiresAt=p.expiresAt;
 }
 const valid=reports.filter(x=>x.verified).length;
 if(valid!==required.length)reasons.push('INCOMPLETE_INDEPENDENT_P0_PROOF');
 if(reasons.length)return hold(reasons,reports);
 return Object.freeze({
  status:'CRYPTOGRAPHIC_P0_EVIDENCE_VERIFIED_MANUAL_GO_NO_GO_REQUIRED',
  reasonCodes:Object.freeze([]),verifiedEvidence:Object.freeze(reports),
  targetSha,environment,
  approvalForProduction:false,professionalValuationAuthorized:false,
  transactionAuthorized:false,externalApprovalsIndependentlyConfirmedByThisModule:false,
  independentHumanGoNoGoRequired:true,
  semantics:'Signed metadata and supplied evidence bytes matched configured local keys. This does NOT verify the signers employment, legal authority, issuer independence, evidence truth, residency, appraiser licence, or release approval. Human out-of-band verification and a separate deployment-authority system are required.',
 });
}
module.exports={GATES,DOMAIN,FIELDS,verifyExternalReadinessEvidence};
