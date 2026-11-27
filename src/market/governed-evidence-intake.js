'use strict';
// Server orchestration only; no distributed atomicity claim. A sealed
// envelope without a witnessed custody event remains unreadable in strict mode.
const crypto=require('node:crypto');
const REF=/^[A-Za-z0-9_.:-]{2,128}$/,SHA=/^[a-f0-9]{64}$/;
function makeGovernedEvidenceIntake({vault,custodyCoordinator,signerKeyRef}={}){
 if(!vault||typeof vault.put!=='function'||typeof vault.read!=='function'||!custodyCoordinator||typeof custodyCoordinator.append!=='function'||typeof signerKeyRef!=='string'||!REF.test(signerKeyRef))throw Error('EVIDENCE_INTAKE_DEPENDENCIES_REQUIRED');
 const result=(status,reason)=>Object.freeze({status,reason,productionReady:false,releaseAuthorized:false});
 async function seal({actor,tenantId,caseRef,evidenceRef,sourceBytes,expectedSha256}={}){
  if(![tenantId,caseRef,evidenceRef].every(x=>typeof x==='string'&&REF.test(x))||typeof expectedSha256!=='string'||!SHA.test(expectedSha256)||!Buffer.isBuffer(sourceBytes)||!sourceBytes.length||sourceBytes.length>20*1024*1024)return result('HOLD_INTAKE','INVALID_INPUT');
  const snapshot=Buffer.from(sourceBytes),sha256=crypto.createHash('sha256').update(snapshot).digest('hex');
  const scope=Object.freeze({tenantId,caseRef,evidenceRef,sha256});
  try{
   if(sha256!==expectedSha256)return result('HOLD_INTAKE','SOURCE_DIGEST_MISMATCH');
   let sealed;
   try{sealed=await vault.put({actor,...scope,sourceBytes:snapshot,expectedSha256:sha256});}
   catch{return result('HOLD_INTAKE','ENVELOPE_NOT_CONFIRMED_OR_ALREADY_EXISTS');}
   if(!sealed||sealed.status!=='SEALED_UNVERIFIED'||!Object.keys(scope).every(k=>sealed[k]===scope[k])||sealed.professionalValueReleaseAuthorized!==false)return result('HOLD_INTAKE','ENVELOPE_RESULT_NOT_CONFIRMED');
   // Separate commits are intentional. Never remove an immutable envelope
   // or auto-resign when the custody/witness outcome is ambiguous.
   let appended;
   try{appended=await custodyCoordinator.append({actor,scope,kind:'SEALED',signerKeyRef,sourceBytes:snapshot});}
   catch{return result('HOLD_INTAKE','SEALED_ENVELOPE_CUSTODY_PENDING');}
   if(!appended||appended.status!=='CUSTODY_APPEND_CONFIRMED_BY_PROVIDERS'||appended.revision!==1||typeof appended.headHashSha256!=='string'||!SHA.test(appended.headHashSha256)||appended.revoked!==false)return result('HOLD_INTAKE','SEALED_ENVELOPE_CUSTODY_PENDING');
   let read;
   try{
    read=await vault.read({actor,tenantId,caseRef,evidenceRef});
    if(!read||read.found!==true||read.custodyIntegrityVerified!==true||read.custodyRevision!==1||read.custodyHeadHashSha256!==appended.headHashSha256||read.sha256!==sha256||read.caseRef!==caseRef||!Buffer.isBuffer(read.sourceBytes)||!read.sourceBytes.equals(snapshot)||read.releaseAuthorized!==false)return result('HOLD_INTAKE','READBACK_NOT_CONFIRMED');
    return Object.freeze({...result('INTAKE_WITNESSED_AND_READBACK_MATCHED',null),...scope,revision:1,headHashSha256:appended.headHashSha256});
   }catch{return result('HOLD_INTAKE','READBACK_NOT_CONFIRMED');}
   finally{if(Buffer.isBuffer(read?.sourceBytes))read.sourceBytes.fill(0);}
  }finally{snapshot.fill(0);}
 }
 return Object.freeze({seal});
}
module.exports={makeGovernedEvidenceIntake};
