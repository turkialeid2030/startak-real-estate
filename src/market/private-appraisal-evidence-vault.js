'use strict';
// Server-side storage contract, NOT a deployed service. The external authenticated backend,
// tenant boundary, KMS, PDPL retention policy and audit persistence must be supplied.
const crypto=require('node:crypto');
const VERSION='STARTAK_PRIVATE_APPRAISAL_VAULT_CONTRACT_V1';
const SHA=/^[a-f0-9]{64}$/i, REF=/^[a-zA-Z0-9_.:-]{2,128}$/;
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
function privateRef(s,label){if(typeof s!=='string'||!REF.test(s))throw Error(label+'_INVALID');return s;}
function role(actor,tenant,permitted){
 if(!actor||typeof actor!=='object'||actor.authenticatedByTrustedBackend!==true||
   actor.tenantId!==tenant||!permitted.includes(actor.role)||
   !privateRef(actor.actorId,'ACTOR'))throw Error('EVIDENCE_ACCESS_DENIED');
}
function keyFrom(keyProvider,tenant){
 const k=keyProvider(tenant);
 if(!Buffer.isBuffer(k)||k.length!==32)throw Error('EXTERNAL_KMS_KEY_REQUIRED');
 return k;
}
function makePrivateAppraisalVault({adapter,keyProvider,clock=()=>new Date()}={}){
 if(!adapter||typeof adapter.get!=='function'||typeof adapter.put!=='function'||
  typeof keyProvider!=='function')throw Error('TRUSTED_ADAPTER_AND_KMS_REQUIRED');
 const idOf=(tenant,ref)=>'appraisal-evidence:v1:'+privateRef(tenant,'TENANT')+':'+privateRef(ref,'EVIDENCE_REF');
 async function put({actor,tenantId,evidenceRef,caseRef,sourceBytes,expectedSha256}={}){
  privateRef(tenantId,'TENANT');privateRef(caseRef,'CASE');privateRef(evidenceRef,'EVIDENCE_REF');
  role(actor,tenantId,['REVIEWER','DATA_ADMIN']);
  if(!Buffer.isBuffer(sourceBytes)||!sourceBytes.length||sourceBytes.length>20*1024*1024)
   throw Error('EVIDENCE_BYTES_INVALID');
  const sha=digest(sourceBytes);
  if(typeof expectedSha256!=='string'||!SHA.test(expectedSha256)||expectedSha256.toLowerCase()!==sha)
   throw Error('EVIDENCE_SOURCE_DIGEST_MISMATCH');
  const identity=idOf(tenantId,evidenceRef);
  if(await adapter.get(identity)!==null)throw Error('EVIDENCE_IMMUTABLE_REF_ALREADY_EXISTS');
  const iv=crypto.randomBytes(12),aad=Buffer.from([VERSION,tenantId,evidenceRef,caseRef].join('|'));
  const cipher=crypto.createCipheriv('aes-256-gcm',keyFrom(keyProvider,tenantId),iv);
  cipher.setAAD(aad);
  const enc=Buffer.concat([cipher.update(sourceBytes),cipher.final()]);
  const core={version:VERSION,tenantId,evidenceRef,caseRef,sha256:sha,iv:iv.toString('base64'),
   tag:cipher.getAuthTag().toString('base64'),ciphertext:enc.toString('base64'),
   uploadedByActorRef:actor.actorId,uploadedAt:clock().toISOString(),
   legalReuseRightsVerified:false,independentlyProfessionallyReviewed:false,
   releaseAuthorized:false,storageAdapterSecurityVerified:false};
  await adapter.put(identity,JSON.stringify(core));
  return {tenantId,evidenceRef,caseRef,sha256:sha,status:'SEALED_UNVERIFIED',
    professionalValueReleaseAuthorized:false};
 }
 async function read({actor,tenantId,evidenceRef}={}){
  privateRef(tenantId,'TENANT');privateRef(evidenceRef,'EVIDENCE_REF');
  role(actor,tenantId,['REVIEWER','DATA_ADMIN','AUDITOR']);
  const raw=await adapter.get(idOf(tenantId,evidenceRef));
  if(raw===null)return {found:false};
  if(typeof raw!=='string'||raw.length>35*1024*1024)throw Error('EVIDENCE_ENVELOPE_INVALID');
  let v;try{v=JSON.parse(raw);}catch{throw Error('EVIDENCE_ENVELOPE_INVALID');}
  if(v?.version!==VERSION||v.tenantId!==tenantId||v.evidenceRef!==evidenceRef||
   !REF.test(v.caseRef||'')||!SHA.test(v.sha256||''))throw Error('EVIDENCE_CONTEXT_TAMPERED');
  try{
   const dec=crypto.createDecipheriv('aes-256-gcm',keyFrom(keyProvider,tenantId),Buffer.from(v.iv,'base64'));
   dec.setAAD(Buffer.from([VERSION,tenantId,evidenceRef,v.caseRef].join('|')));
   dec.setAuthTag(Buffer.from(v.tag,'base64'));
   const bytes=Buffer.concat([dec.update(Buffer.from(v.ciphertext,'base64')),dec.final()]);
   if(digest(bytes)!==v.sha256)throw Error('EVIDENCE_BYTES_DIGEST_TAMPERED');
   return {found:true,sourceBytes:bytes,sha256:v.sha256,caseRef:v.caseRef,
    releaseAuthorized:false,professionalReviewVerified:false};
  }catch(e){if(e.message==='EVIDENCE_BYTES_DIGEST_TAMPERED')throw e;
   throw Error('EVIDENCE_DECRYPTION_OR_INTEGRITY_FAILED');}
 }
 return Object.freeze({put,read,version:VERSION,institutionalDeploymentVerified:false});
}
module.exports={VERSION,makePrivateAppraisalVault};
