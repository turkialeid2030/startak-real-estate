'use strict';
// Server-side verification only. Signing keys and trust registry are external.
const crypto=require('node:crypto');
const {isPlainJson}=require('../validation/plain-json-boundary');
const {strictCalendarDateMs}=require('../validation/strict-calendar-instant');
const REF=/^[a-zA-Z0-9_.:-]{2,128}$/,SHA=/^[a-f0-9]{64}$/;
const VERSION='STARTAK_SIGNED_RESTORE_INVENTORY_V1';
const validRef=x=>typeof x==='string'&&REF.test(x);
const exact=(x,keys)=>!!x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
function normalizeInventory(x){
 if(!isPlainJson(x)||!exact(x,['version','tenantId','caseRef','inventoryRef','backupRef','snapshotAt','signedAt','signerKeyRef','entries'])||x.version!==VERSION||![x.tenantId,x.caseRef,x.inventoryRef,x.backupRef,x.signerKeyRef].every(validRef))throw Error('SIGNED_INVENTORY_SCHEMA_INVALID');
 const snapshot=strictCalendarDateMs(x.snapshotAt),signed=strictCalendarDateMs(x.signedAt);
 if(!Number.isFinite(snapshot)||!Number.isFinite(signed)||signed<snapshot)throw Error('SIGNED_INVENTORY_CHRONOLOGY_INVALID');
 if(!Array.isArray(x.entries)||!x.entries.length||x.entries.length>500)throw Error('SIGNED_INVENTORY_ENTRIES_INVALID');
 const seen=new Set(),entries=x.entries.map(e=>{if(!exact(e,['evidenceRef','sha256'])||!validRef(e.evidenceRef)||typeof e.sha256!=='string'||!SHA.test(e.sha256)||seen.has(e.evidenceRef))throw Error('SIGNED_INVENTORY_ENTRY_INVALID');seen.add(e.evidenceRef);return {evidenceRef:e.evidenceRef,sha256:e.sha256};}).sort((a,b)=>a.evidenceRef<b.evidenceRef?-1:a.evidenceRef>b.evidenceRef?1:0);
 return {version:VERSION,tenantId:x.tenantId,caseRef:x.caseRef,inventoryRef:x.inventoryRef,backupRef:x.backupRef,snapshotAt:new Date(snapshot).toISOString(),signedAt:new Date(signed).toISOString(),signerKeyRef:x.signerKeyRef,entries};
}
function signedInventoryBytes(x){return Buffer.from('STARTAK:RESTORE-INVENTORY:ED25519:V1\n'+JSON.stringify(normalizeInventory(x)),'utf8');}
async function verifySignedRestoreInventory(envelope,{tenantId,caseRef,inventoryRef,resolveSigner,maxAgeSeconds,now=new Date()}={}){
 const hold=reason=>Object.freeze({status:'HOLD_SIGNED_INVENTORY',reason,signatureVerified:false,inventory:null,productionRecoveryVerified:false});
 try{
  if(!isPlainJson(envelope)||!exact(envelope,['inventory','signature'])||typeof envelope.signature!=='string'||typeof resolveSigner!=='function'||!Number.isSafeInteger(maxAgeSeconds)||maxAgeSeconds<1||maxAgeSeconds>31536000)return hold('SIGNED_INVENTORY_TRUST_OR_SCHEMA_REQUIRED');
  const x=normalizeInventory(envelope.inventory);
  if(x.tenantId!==tenantId||x.caseRef!==caseRef||x.inventoryRef!==inventoryRef)return hold('SIGNED_INVENTORY_SCOPE_MISMATCH');
  const current=now instanceof Date?Date.prototype.getTime.call(now):strictCalendarDateMs(now),snapshot=strictCalendarDateMs(x.snapshotAt),signed=strictCalendarDateMs(x.signedAt);
  if(!Number.isFinite(current)||current>Date.now()||signed>current||current-snapshot>maxAgeSeconds*1000)return hold('SIGNED_INVENTORY_WINDOW_INVALID');
  const signature=Buffer.from(envelope.signature,'base64');
  if(signature.length!==64||signature.toString('base64')!==envelope.signature)return hold('SIGNED_INVENTORY_SIGNATURE_INVALID');
  // Trusted registry must return the exact tenant-bound, non-revoked Ed25519 key.
  const record=await resolveSigner({tenantId,signerKeyRef:x.signerKeyRef});
  if(!record||record.tenantId!==tenantId||record.signerKeyRef!==x.signerKeyRef||record.revoked!==false||record.purpose!=='BACKUP_INVENTORY_SIGNING'||!(record.publicKey instanceof crypto.KeyObject)||record.publicKey.type!=='public'||record.publicKey.asymmetricKeyType!=='ed25519')return hold('SIGNED_INVENTORY_SIGNER_NOT_TRUSTED');
  const from=strictCalendarDateMs(record.validFrom),until=strictCalendarDateMs(record.validUntil);
  if(!Number.isFinite(from)||!Number.isFinite(until)||from>signed||signed>until||current>until)return hold('SIGNED_INVENTORY_SIGNER_WINDOW_INVALID');
  const bytes=signedInventoryBytes(x);
  if(!crypto.verify(null,bytes,record.publicKey,signature))return hold('SIGNED_INVENTORY_SIGNATURE_INVALID');
  return Object.freeze({status:'SIGNED_INVENTORY_VERIFIED',reason:null,signatureVerified:true,inventory:Object.freeze({...x,entries:Object.freeze(x.entries.map(Object.freeze))}),inventoryHashSha256:crypto.createHash('sha256').update(bytes).digest('hex'),productionRecoveryVerified:false});
 }catch{return hold('SIGNED_INVENTORY_VERIFICATION_FAILED');}
}
module.exports={VERSION,signedInventoryBytes,verifySignedRestoreInventory};
