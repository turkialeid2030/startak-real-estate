'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {randomBytes,createHash}=require('node:crypto');
const {createEncryptedStagingVault}=require('../../src/security/c73-encrypted-staging-vault');
const PDF=Buffer.from('%PDF-1.4\nC73_3B_EXPLICITLY_SYNTHETIC_SENSITIVE_TEST_DOCUMENT\n%%EOF\n');
const KEY=randomBytes(32);
const input={tenantId:'tenantA',documentId:'DOC-1',revision:1,mediaType:'application/pdf'};
const contexts={
 editorA:{status:'VERIFIED_CONTEXT',authorizationReady:true,
  identity:{tenantId:'tenantA',actorId:'e1',subject:'e1',roles:['CUSTODY_EDITOR']}},
 readerA:{status:'VERIFIED_CONTEXT',authorizationReady:true,
  identity:{tenantId:'tenantA',actorId:'r1',subject:'r1',roles:['CUSTODY_READER']}},
 editorB:{status:'VERIFIED_CONTEXT',authorizationReady:true,
  identity:{tenantId:'tenantB',actorId:'e2',subject:'e2',roles:['CUSTODY_EDITOR']}},
};
const scanner=async()=>({status:'CLEAN',engineRef:'synthetic-test-engine-not-certified',
  signatureRef:'synthetic-signature-test-only'});
let checks=0;
function ok(cond,msg){assert.ok(cond,msg);checks++;}
async function no(p,regex){await assert.rejects(p,regex);checks++;}
(async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'startak-c73-vault-'));
 await fs.chmod(root,0o700);
 const request=x=>({sessionToken:x});
 const cfg={rootPath:root,key:KEY,keyRef:'test-key-1',
  scanner,verifyRequest:async req=>contexts[req?.sessionToken]||null};
 const vault=createEncryptedStagingVault(cfg);
 try{
  await no(vault.put({...input,request:request('unknown'),bytes:PDF}),/TRUSTED_AUTHORIZATION_REQUIRED/);
  await no(vault.put({...input,request:request('readerA'),bytes:PDF}),/TRUSTED_AUTHORIZATION_REQUIRED/);
  await no(vault.put({...input,tenantId:'tenantB',request:request('editorA'),bytes:PDF}),/TRUSTED_AUTHORIZATION_REQUIRED/);
  await no(vault.put({...input,documentId:'../DOC-1',request:request('editorA'),bytes:PDF}),/BAD_DOCUMENT/);
  await no(vault.put({...input,request:request('editorA'),mediaType:'image/png',bytes:PDF}),/SIGNATURE_MISMATCH/);
  await no(vault.put({...input,request:request('editorA'),bytes:Buffer.alloc(1)}),/SIZE_DENIED/);
  await no(vault.put({...input,request:request('editorA'),bytes:Buffer.alloc(5*1024*1024+1)}),/SIZE_DENIED/);
  const denied=createEncryptedStagingVault({...cfg,scanner:async()=>({status:'ERROR',engineRef:'engine',signatureRef:'sig'})});
  await no(denied.put({...input,request:request('editorA'),bytes:PDF}),/SCANNER_HOLD/);
  const offline=createEncryptedStagingVault({...cfg,scanner:async()=>{throw Error('scanner offline')}});
  await no(offline.put({...input,request:request('editorA'),bytes:PDF}),/SCANNER_HOLD/);
  const stalled=createEncryptedStagingVault({...cfg,scanTimeoutMs:25,
   scanner:async()=>new Promise(()=>{})});
  await no(stalled.put({...input,request:request('editorA'),bytes:PDF}),/SCANNER_HOLD/);
  ok((await fs.readdir(root)).length===0,'deny before encrypted file write');
  const receipt=await vault.put({...input,request:request('editorA'),bytes:PDF});
  ok(receipt.status==='STAGED_ENCRYPTED_UNVERIFIED','encrypted receipt status');
  ok(receipt.sha256Hex===createHash('sha256').update(PDF).digest('hex'),'true SHA');
  for(const f of ['sourceRightsVerified','sourceIndependentlyVerified','professionalReportAuthorized',
    'transactionAuthorized','productionVaultReady','malwareEngineCertified','independentImmutableWitness'])
   ok(receipt[f]===false,'no authority claim: '+f);
  const files=await fs.readdir(root);
  ok(files.length===1&&files[0]===receipt.objectRef+'.cipher.json','opaque hashed filename');
  const f=path.join(root,files[0]);
  let body=await fs.readFile(f,'utf8');
  ok(!body.includes('C73_3B_EXPLICITLY_SYNTHETIC')&&!body.includes(PDF.toString('base64')),
    'no raw or encoded plaintext on disk');
  const stats=await fs.stat(f);
  ok((stats.mode&0o077)===0,'cipher file private');
  await no(vault.put({...input,request:request('editorA'),bytes:PDF}),/ALREADY_EXISTS/);
  await no(vault.get({...input,request:request('editorB'),expectedSha256:receipt.sha256Hex}),/TRUSTED_AUTHORIZATION_REQUIRED/);
  await no(vault.get({...input,tenantId:'tenantB',request:request('editorB'),expectedSha256:receipt.sha256Hex}),/OBJECT_NOT_FOUND/);
  await no(vault.get({...input,request:request('readerA'),expectedSha256:'f'.repeat(64)}),/ENVELOPE_TAMPERED/);
  const read=await vault.get({...input,request:request('readerA'),expectedSha256:receipt.sha256Hex});
  ok(read.bytes.equals(PDF),'authorized authenticated decrypt equals original');
  ok(read.metadata.professionalReportAuthorized===false,'read never grants report authority');
  const reopened=createEncryptedStagingVault(cfg);
  const back=await reopened.get({...input,request:request('editorA'),expectedSha256:receipt.sha256Hex});
  ok(back.bytes.equals(PDF),'cipher persisted across re-instantiation');
  const wrongKey=createEncryptedStagingVault({...cfg,key:randomBytes(32)});
  await no(wrongKey.get({...input,request:request('editorA'),expectedSha256:receipt.sha256Hex}),/AUTHENTICATED_DECRYPTION_FAILED/);
  const original=JSON.parse(body);
  const tampered={...original,tag:'0'.repeat(32)};
  await fs.writeFile(f,JSON.stringify(tampered),{mode:0o600});
  await no(vault.get({...input,request:request('readerA'),expectedSha256:receipt.sha256Hex}),/AUTHENTICATED_DECRYPTION_FAILED/);
  await fs.writeFile(f,body,{mode:0o600});
  const swapped={...original,sha256Hex:'a'.repeat(64)};
  await fs.writeFile(f,JSON.stringify(swapped),{mode:0o600});
  await no(vault.get({...input,request:request('readerA'),expectedSha256:receipt.sha256Hex}),/ENVELOPE_TAMPERED/);
  await fs.writeFile(f,body,{mode:0o600});
  const another=await vault.put({...input,tenantId:'tenantB',documentId:'DOC-1',
    request:request('editorB'),bytes:PDF});
  ok(another.objectRef!==receipt.objectRef,'tenant-specific opaque object ref');
  await no(vault.erase({...input,request:request('readerA')}),/TRUSTED_AUTHORIZATION_REQUIRED/);
  const deleted=await vault.erase({...input,request:request('editorA')});
  ok(deleted.status==='STAGING_CIPHERTEXT_UNLINKED_NOT_SECURE_ERASURE','deletion not secure erasure');
  await no(vault.get({...input,request:request('editorA'),expectedSha256:receipt.sha256Hex}),/OBJECT_NOT_FOUND/);
  const symlink=path.join(root,receipt.objectRef+'.cipher.json');
  await fs.symlink(path.join(root,another.objectRef+'.cipher.json'),symlink);
  await no(vault.get({...input,request:request('editorA'),expectedSha256:receipt.sha256Hex}),
   /ELOOP|ENVELOPE_TAMPERED|STORED_OBJECT_INVALID/);
  await fs.unlink(symlink);
  await fs.chmod(root,0o755);
  await no(vault.put({...input,documentId:'DOC-NEW',request:request('editorA'),bytes:PDF}),/ROOT_PERMISSIONS_UNSAFE/);
  console.log('C73_3B_AES256GCM_ENCRYPTED_STAGING_VAULT=PASS checks='+checks);
  console.log('C73_3B_CERTIFIED_MALWARE_SCANNER_KMS_OBJECT_VAULT=FALSE');
 }finally{await fs.rm(root,{force:true,recursive:true});}
})().catch(e=>{console.error('C73_3B_AES256GCM_ENCRYPTED_STAGING_VAULT=FAIL',e);process.exitCode=1;});
