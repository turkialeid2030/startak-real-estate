'use strict';
// Synthetic/staging integration only: one authenticated flow through PostgreSQL
// signed custody and authenticated encrypted filesystem staging. No claim of
// distributed atomicity, certified malware safety, WORM or production authority.
const {STATE}=require('./c73-signed-document-custody');
function error(code){const e=new Error(code);e.code=code;return e;}
function createVaultBackedCustodyService({custodyService,vault}={}){
 if(!custodyService||!['observe','get','recheck','revoke'].every(k=>typeof custodyService[k]==='function')||
  !vault||!['put','get','erase'].every(k=>typeof vault[k]==='function'))
  throw error('C73_INTEGRATED_TRUSTED_DEPENDENCIES_REQUIRED');
 async function observe({request,scope,bytes}={}){
  // C73 Postgres authenticates first; no storage based only on request claims.
  const observed=await custodyService.observe({request,scope,bytes});
  const s=observed.ledger.scope;
  try{
   const stored=await vault.put({request,tenantId:s.tenantId,
    documentId:s.documentId,revision:1,mediaType:s.mediaType,bytes});
   if(stored.sha256Hex!==s.sha256Hex)throw error('C73_INTEGRATED_STAGED_DIGEST_MISMATCH');
   return {...observed,storage:stored};
  }catch(e){
   // The primary signed record must never remain ACTIVE if staging fails.
   // A compensation failure is surfaced distinctly as an operational BLOCKER.
   try{
    await custodyService.revoke({request,documentId:s.documentId,
     expectedRevision:1,expectedHeadTag:observed.ledger.headTag});
   }catch(_){throw error('C73_INTEGRATED_COMPENSATION_FAILURE_MANUAL_REVIEW');}
   throw error('C73_INTEGRATED_STORAGE_FAILED_REVOKED');
  }
 }
 async function get({request,documentId}={}){
  const record=await custodyService.get({request,documentId});
  if(record.verdict.status!==STATE.INTEGRITY_MATCHED_UNVERIFIED)return record;
  const s=record.ledger.scope;
  let artifact;
  try{
   artifact=await vault.get({request,tenantId:s.tenantId,documentId:s.documentId,
    revision:1,expectedSha256:s.sha256Hex});
   if(!artifact.bytes||artifact.metadata.sha256Hex!==s.sha256Hex)
    throw error('C73_INTEGRATED_STAGED_DIGEST_MISMATCH');
  }catch{
   throw error('C73_INTEGRATED_ENCRYPTED_BYTES_UNAVAILABLE_HOLD');
  }finally{
   if(artifact?.bytes)artifact.bytes.fill(0);
  }
  return {...record,storage:{
   status:'ENCRYPTED_STAGED_INTEGRITY_MATCHED_UNVERIFIED',
   objectRef:artifact.metadata.objectRef||null,
   sourceRightsVerified:false,professionalReportAuthorized:false,productionVaultReady:false}};
 }
 async function recheck({request,documentId,bytes,expectedRevision,expectedHeadTag}={}){
  // A signed record is not usable when independently encrypted bytes vanished.
  await get({request,documentId});
  return custodyService.recheck({request,documentId,bytes,expectedRevision,expectedHeadTag});
 }
 async function revoke({request,documentId,expectedRevision,expectedHeadTag}={}){
  const old=await custodyService.get({request,documentId});
  const result=await custodyService.revoke({request,documentId,expectedRevision,expectedHeadTag});
  const s=old.ledger.scope;
  try{
   const deleted=await vault.erase({request,tenantId:s.tenantId,documentId:s.documentId,revision:1});
   return {...result,storage:deleted};
  }catch{
   // Never re-enable a revoked asset if ciphertext deletion fails.
   return {...result,storage:{
    status:'CIPHERTEXT_DELETION_FAILURE_HOLD',
    productionVaultReady:false,secureErasureProven:false}};
  }
 }
 return Object.freeze({observe,get,recheck,revoke,
  productionVaultReady:false,professionalValuationAuthorized:false,
  sourceRightsAuthenticated:false,distributedAtomicityQualified:false});
}
module.exports={createVaultBackedCustodyService};
