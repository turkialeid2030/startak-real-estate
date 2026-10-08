'use strict';
// C73.3B server-only encrypted staging vault: NOT a certified/cloud KMS vault.
// No production data residency, malware-engine accreditation or source-rights proof.
const fs=require('node:fs/promises');
const path=require('node:path');
const {constants}=require('node:fs');
const {createCipheriv,createDecipheriv,createHash,randomBytes,timingSafeEqual}=require('node:crypto');
const {MAX_BYTES,TYPES,matchesSignature}=require('../app/specialist-document-intake');
const VERSION=1;
const MAX_ENVELOPE=8*1024*1024;
function fail(code){const e=new Error(code);e.code=code;return e;}
function identifier(v,name){
 if(typeof v!=='string'||v.length<1||v.length>128||!/^[a-zA-Z0-9][a-zA-Z0-9:_-]*$/.test(v))
  throw fail('C73_VAULT_BAD_'+name);
 return v;
}
function revision(v){
 if(!Number.isSafeInteger(v)||v<1||v>1000)throw fail('C73_VAULT_BAD_REVISION');
 return v;
}
function bytesOf(b){
 if(!(Buffer.isBuffer(b)||b instanceof Uint8Array)||b.length<8||b.length>MAX_BYTES)
  throw fail('C73_VAULT_SIZE_DENIED');
 return Buffer.from(b);
}
function sha(bytes){return createHash('sha256').update(bytes).digest('hex');}
function safeEq(a,b){
 if(typeof a!=='string'||typeof b!=='string'||!/^[a-f0-9]{64}$/.test(a)||!/^[a-f0-9]{64}$/.test(b))return false;
 return timingSafeEqual(Buffer.from(a,'hex'),Buffer.from(b,'hex'));
}
function scope(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw fail('C73_VAULT_SCOPE_INVALID');
 return {tenantId:identifier(input.tenantId,'TENANT'),documentId:identifier(input.documentId,'DOCUMENT'),
  revision:revision(input.revision)};
}
function makeRef(s){
 return createHash('sha256').update('startak:vault:1\0'+s.tenantId+'\0'+s.documentId+'\0'+s.revision).digest('hex');
}
function aad(s,mime,hash,keyRef){
 return Buffer.from(JSON.stringify({domain:'STARTAK:C73.3B:VAULT:AES256GCM:V1',
  tenantId:s.tenantId,documentId:s.documentId,revision:s.revision,
  mediaType:mime,sha256Hex:hash,keyRef}),'utf8');
}
async function directory(root){
 const st=await fs.lstat(root).catch(e=>{if(e.code==='ENOENT')return null;throw e;});
 if(!st){await fs.mkdir(root,{recursive:true,mode:0o700});}
 const current=await fs.lstat(root);
 if(!current.isDirectory()||current.isSymbolicLink())throw fail('C73_VAULT_ROOT_NOT_PRIVATE_DIRECTORY');
 if((current.mode&0o077)!==0)throw fail('C73_VAULT_ROOT_PERMISSIONS_UNSAFE');
}
function allowedClaim(ctx,s,action){
 const identity=ctx?.identity;
 if(ctx?.status!=='VERIFIED_CONTEXT'||ctx.authorizationReady!==true||
  !identity||identity.actorId!==identity.subject||
  identity.tenantId!==s.tenantId||!Array.isArray(identity.roles)||
  !(action==='READ'?
    identity.roles.some(r=>['CUSTODY_EDITOR','CUSTODY_READER'].includes(r)):
    identity.roles.includes('CUSTODY_EDITOR')))
  throw fail('C73_VAULT_TRUSTED_AUTHORIZATION_REQUIRED');
}
function verdict(r){
 return Object.freeze({...r,sourceRightsVerified:false,sourceIndependentlyVerified:false,
  professionalReportAuthorized:false,transactionAuthorized:false,productionVaultReady:false,
  malwareEngineCertified:false,independentImmutableWitness:false});
}
/**
 * Scanner is a mandatory external dependency; its CI implementation is synthetic
 * and cannot be used as proof of actual malware safety. It must throw or return
 * an explicit CLEAN verdict, otherwise bytes NEVER enter vault storage.
 */
function createEncryptedStagingVault({rootPath,key,keyRef,verifyRequest,scanner,scanTimeoutMs=15000}={}){
 if(typeof rootPath!=='string'||!path.isAbsolute(rootPath)||typeof keyRef!=='string'||
  !/^[a-zA-Z0-9_-]{2,128}$/.test(keyRef)||
  !(Buffer.isBuffer(key)||key instanceof Uint8Array)||key.length!==32||
  typeof verifyRequest!=='function'||typeof scanner!=='function'||
  !Number.isInteger(scanTimeoutMs)||scanTimeoutMs<10||scanTimeoutMs>60000)
  throw fail('C73_VAULT_DEPENDENCIES_REQUIRED');
 const root=path.resolve(rootPath);
 async function auth(request,s,action){
  const ctx=await verifyRequest(request);
  allowedClaim(ctx,s,action);
 }
 function filename(s){return path.join(root,makeRef(s)+'.cipher.json');}
 async function put({request,tenantId,documentId,revision:rev,mediaType,bytes}={}){
  const s=scope({tenantId,documentId,revision:rev});
  await auth(request,s,'WRITE');
  if(typeof mediaType!=='string'||!Object.hasOwn(TYPES,mediaType))
   throw fail('C73_VAULT_MEDIA_UNSUPPORTED');
  let plain=bytesOf(bytes);
  try{
   if(!matchesSignature(plain,mediaType))throw fail('C73_VAULT_SIGNATURE_MISMATCH');
   // No system test scanner result is a substitute for a certified security scanner.
   let assessment,timer;
   // Scanners that hang, fail or reject MUST not admit document bytes. The
   // upstream scan interface also requires bounded provider-side work.
   try{
    assessment=await Promise.race([
     Promise.resolve().then(()=>scanner({bytes:Buffer.from(plain),mediaType})),
     new Promise((_,reject)=>{
      timer=setTimeout(()=>reject(fail('C73_VAULT_SCANNER_TIMEOUT')),scanTimeoutMs);
     }),
    ]);
   }catch{throw fail('C73_VAULT_SCANNER_HOLD');}
   finally{if(timer)clearTimeout(timer);}
   if(!assessment||assessment.status!=='CLEAN'||typeof assessment.engineRef!=='string'||
    assessment.engineRef.length<3||typeof assessment.signatureRef!=='string'||
    assessment.signatureRef.length<3)
    throw fail('C73_VAULT_SCANNER_HOLD');
   await directory(root);
   const hash=sha(plain),iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);
   cipher.setAAD(aad(s,mediaType,hash,keyRef));
   const ciphertext=Buffer.concat([cipher.update(plain),cipher.final()]);
   const envelope={schemaVersion:VERSION,keyRef,mediaType,sha256Hex:hash,
    sizeBytes:plain.length,iv:iv.toString('hex'),tag:cipher.getAuthTag().toString('hex'),
    ciphertext:ciphertext.toString('base64')};
   const file=filename(s);
   let handle;
   try{
    handle=await fs.open(file,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|
     (constants.O_NOFOLLOW||0),0o600);
    await handle.writeFile(JSON.stringify(envelope));
    await handle.sync();
   }catch(e){
    if(handle){await handle.close();handle=null;await fs.unlink(file).catch(()=>{});}
    if(e.code==='EEXIST')throw fail('C73_VAULT_ALREADY_EXISTS');
    throw e;
   }finally{if(handle)await handle.close();}
   return verdict({status:'STAGED_ENCRYPTED_UNVERIFIED',objectRef:makeRef(s),
    tenantId:s.tenantId,documentId:s.documentId,revision:s.revision,
    mediaType,sha256Hex:hash,sizeBytes:plain.length,
    scannerEngineRef:assessment.engineRef,scannerSignatureRef:assessment.signatureRef});
  }finally{plain.fill(0);}
 }
 async function get({request,tenantId,documentId,revision:rev,expectedSha256}={}){
  const s=scope({tenantId,documentId,revision:rev});await auth(request,s,'READ');
  if(typeof expectedSha256!=='string'||!/^[a-f0-9]{64}$/.test(expectedSha256))
   throw fail('C73_VAULT_EXPECTED_DIGEST_REQUIRED');
  await directory(root);
  const file=filename(s);
  let handle;let text;
  try{
   handle=await fs.open(file,constants.O_RDONLY|(constants.O_NOFOLLOW||0));
   const st=await handle.stat();
   if(!st.isFile()||st.size>MAX_ENVELOPE||st.size<100)
    throw fail('C73_VAULT_STORED_OBJECT_INVALID');
   text=await handle.readFile({encoding:'utf8'});
  }catch(e){
   if(e.code==='ENOENT')throw fail('C73_VAULT_OBJECT_NOT_FOUND');
   throw e;
  }finally{if(handle)await handle.close();}
  let record;
  try{record=JSON.parse(text);}catch{throw fail('C73_VAULT_ENVELOPE_TAMPERED');}
  if(!record||record.schemaVersion!==VERSION||record.keyRef!==keyRef||
   !Object.hasOwn(TYPES,record.mediaType)||!safeEq(record.sha256Hex,expectedSha256)||
   !Number.isSafeInteger(record.sizeBytes)||record.sizeBytes<8||record.sizeBytes>MAX_BYTES||
   typeof record.iv!=='string'||!/^[a-f0-9]{24}$/.test(record.iv)||
   typeof record.tag!=='string'||!/^[a-f0-9]{32}$/.test(record.tag)||
   typeof record.ciphertext!=='string')
   throw fail('C73_VAULT_ENVELOPE_TAMPERED');
  let clear;
  try{
   const decipher=createDecipheriv('aes-256-gcm',key,Buffer.from(record.iv,'hex'));
   decipher.setAAD(aad(s,record.mediaType,record.sha256Hex,keyRef));
   decipher.setAuthTag(Buffer.from(record.tag,'hex'));
   clear=Buffer.concat([decipher.update(Buffer.from(record.ciphertext,'base64')),decipher.final()]);
  }catch{throw fail('C73_VAULT_AUTHENTICATED_DECRYPTION_FAILED');}
  if(clear.length!==record.sizeBytes||!safeEq(sha(clear),expectedSha256)||
   !matchesSignature(clear,record.mediaType)){
   clear.fill(0);throw fail('C73_VAULT_CONTENT_INTEGRITY_FAILED');
  }
  return {status:'ENCRYPTED_STAGED_BYTES_RECOVERED_UNVERIFIED',bytes:clear,
   metadata:verdict({tenantId:s.tenantId,documentId:s.documentId,
    revision:s.revision,sha256Hex:record.sha256Hex,mediaType:record.mediaType})};
 }
 async function erase({request,tenantId,documentId,revision:rev}={}){
  const s=scope({tenantId,documentId,revision:rev});await auth(request,s,'WRITE');
  await directory(root);
  try{await fs.unlink(filename(s));}catch(e){
   if(e.code==='ENOENT')throw fail('C73_VAULT_OBJECT_NOT_FOUND');
   throw e;
  }
  // Unlink is NOT secure erasure in snapshots, backups or file systems.
  return verdict({status:'STAGING_CIPHERTEXT_UNLINKED_NOT_SECURE_ERASURE',objectRef:makeRef(s)});
 }
 return Object.freeze({put,get,erase,productionVaultReady:false,
  encryptionAlgorithm:'AES-256-GCM',productionKmsValidated:false});
}
module.exports={createEncryptedStagingVault};
