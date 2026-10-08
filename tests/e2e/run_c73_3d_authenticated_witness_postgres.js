'use strict';
// Real isolated PostgreSQL16 + encrypted local disk + separate Ed25519-signing
// child process. All identities/files/keys are synthetic; remote witness is
// volatile and loopback: NOT durable WORM, cloud security or production approval.
const assert=require('node:assert/strict');
const fs=require('node:fs'),fsp=require('node:fs/promises');
const path=require('node:path'),os=require('node:os');
const {fork}=require('node:child_process');
const {randomBytes,generateKeyPairSync}=require('node:crypto');
const {createWitnessRequestSigner,createWitnessHttpTransport}
 =require('../../src/security/c73-witness-service-auth');
const {Pool}=require('pg');
const {createPostgresCustodyService}=require('../../src/security/c73-postgres-custody-service');
const {createEncryptedStagingVault}=require('../../src/security/c73-encrypted-staging-vault');
const {createVaultBackedCustodyService}=require('../../src/security/c73-integrated-staging-custody');
const {createWitnessedCustodyGate}=require('../../src/security/c73-external-witness-gate');
const {STATE}=require('../../src/security/c73-signed-document-custody');
const PDF=Buffer.from('%PDF-1.4\nC73_3C_SYNTHETIC_WITNESS_CONTENT\n%%EOF\n');
const admin=new Pool({host:'127.0.0.1',port:5432,user:'postgres',
 password:process.env.C73_TEST_POSTGRES_PASSWORD||'local-ci-only',database:'postgres'});
let app,child,root,witnessRoot,checks=0;
const applicationClient=generateKeyPairSync('ed25519');
const clientId='startak-synthetic-client-01';
const signer=createWitnessRequestSigner({privateKey:applicationClient.privateKey,
 clientId,clock:()=>new Date()});
function ok(test,message){assert.ok(test,message);checks++;}
async function denies(fn,regex){await assert.rejects(fn,regex);checks++;}
const contexts={
 a:{status:'VERIFIED_CONTEXT',authorizationReady:true,
  identity:{tenantId:'tenant-a',actorId:'editor-a',subject:'editor-a',roles:['CUSTODY_EDITOR']}},
 b:{status:'VERIFIED_CONTEXT',authorizationReady:true,
  identity:{tenantId:'tenant-b',actorId:'editor-b',subject:'editor-b',roles:['CUSTODY_EDITOR']}},
};
const request=id=>({token:id});
function scope(tenantId,documentId){
 return {tenantId,documentId,caseId:'CASE-'+tenantId,projectId:'PROJECT-'+tenantId,
  propertyRef:'PROPERTY-'+tenantId,valuationDate:'2026-10-08',
  evidenceType:'inspection',referenceId:'REFERENCE-'+tenantId,artifactVersion:1,
  mediaType:'application/pdf'};
}
async function witnessChild(){
 const fixture=path.resolve(__dirname,'../fixtures/c73_3d_restartable_witness.js');
 child=fork(fixture,[],{stdio:['ignore','pipe','pipe','ipc']});
 return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(Error('WITNESS_START_TIMEOUT')),15000);
  child.once('message',data=>{
   clearTimeout(timer);
   if(data?.type!=='ready')return reject(Error('WITNESS_START_INVALID:'+data?.error));
   resolve(data);
  });
  child.once('error',e=>{clearTimeout(timer);reject(e);});
  child.send({type:'start',rootPath:witnessRoot,clientId,
   clientPublicKey:applicationClient.publicKey.export({format:'pem',type:'spki'})});
 });
}
async function stopChild(){
 if(!child)return;
 const current=child;
 await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{current.kill('SIGKILL');reject(Error('STOP_TIMEOUT'));},2500);
  current.once('exit',()=>{clearTimeout(timer);resolve();});
  current.send({type:'stop'});
 });
 if(child===current)child=null;
}
async function run(){
 await admin.query("DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='c73_app') THEN CREATE ROLE c73_app LOGIN PASSWORD 'ci-test-only' NOSUPERUSER NOBYPASSRLS; END IF; END $$");
 await admin.query(fs.readFileSync(path.resolve(__dirname,'../../sql/c73_transactional_custody.sql'),'utf8'));
 app=new Pool({host:'127.0.0.1',port:5432,user:'c73_app',password:'ci-test-only',database:'postgres',max:4});
 root=await fsp.mkdtemp(path.join(os.tmpdir(),'startak-c73-witness-'));
 await fsp.chmod(root,0o700);
 witnessRoot=await fsp.mkdtemp(path.join(os.tmpdir(),'startak-durable-witness-'));
 await fsp.chmod(witnessRoot,0o700);
 const w=await witnessChild(),base='http://127.0.0.1:'+w.port;
 const witness=createWitnessHttpTransport({baseUrl:base,signRequest:signer});
 let elapsed=Date.now();
 const verifyRequest=async r=>contexts[r?.token]||null;
 const custody=createPostgresCustodyService({pool:app,key:randomBytes(32),
  keyRef:'c73-3c-hmac-test',clock:()=>new Date(elapsed+=1000),verifyRequest});
 const vault=createEncryptedStagingVault({rootPath:root,key:randomBytes(32),
  keyRef:'c73-3c-synthetic-aes',verifyRequest,scanTimeoutMs:1000,
  scanner:async()=>({status:'CLEAN',engineRef:'fake-ci-engine',signatureRef:'not-certification'})});
 const integrated=createVaultBackedCustodyService({custodyService:custody,vault});
 const options={custodyService:integrated,witness,publicKey:w.publicKey,
  clock:()=>new Date(),maxReceiptAgeSeconds:120};
 const gate=createWitnessedCustodyGate(options);
 const a={request:request('a'),scope:scope('tenant-a','DOC-C73-3C-A'),bytes:PDF};
 const first=await gate.observe(a);
 ok(first.ledger.events.length===1,'signed creation observed');
 ok(first.witness.status==='EXTERNAL_RECEIPT_MATCHED_UNVERIFIED','witness signer acknowledged');
 ok(first.verdict.professionalReportAuthorized===false,'witness does not license appraisal');
 const read=await gate.get({request:request('a'),documentId:a.scope.documentId});
 ok(read.ledger.headTag===first.ledger.headTag,'verified remote first head and encrypted bytes');
 await denies(()=>gate.get({request:request('b'),documentId:a.scope.documentId}),
  /C73_DOCUMENT_NOT_FOUND/);
 const b={request:request('b'),scope:scope('tenant-b','DOC-C73-3C-A'),bytes:PDF};
 await gate.observe(b);
 ok((await gate.get({request:request('b'),documentId:b.scope.documentId})).ledger.scope.tenantId==='tenant-b',
  'same object id is independently scoped by tenant');
 const second=await gate.recheck({request:request('a'),documentId:a.scope.documentId,bytes:PDF,
  expectedRevision:1,expectedHeadTag:first.ledger.headTag});
 ok(second.ledger.events.length===2,'remote checkpoint advanced on signed recheck');
 await denies(()=>gate.recheck({request:request('a'),documentId:a.scope.documentId,
  bytes:PDF,expectedRevision:1,expectedHeadTag:first.ledger.headTag}),
  /C73_STALE_CUSTODY_REVISION/);
 // A privileged DBA rewinds both internally consistent HMAC-authenticated DB
 // tables to the earlier valid document+event. Remote process still retains v2.
 const t=a.scope.tenantId,d=a.scope.documentId;
 await admin.query('DELETE FROM c73.custody_events WHERE tenant_id=$1 AND document_id=$2 AND revision=2',[t,d]);
 await admin.query('UPDATE c73.custody_heads SET revision=1,head_tag=$3,ledger=$4::jsonb WHERE tenant_id=$1 AND document_id=$2',
  [t,d,first.ledger.headTag,JSON.stringify(first.ledger)]);
 try{
  ok((await integrated.get({request:request('a'),documentId:d})).ledger.events.length===1,
   'old locally signed history is self-consistent before witness');
  await denies(()=>gate.get({request:request('a'),documentId:d}),
   /C73_WITNESS_DB_DIVERGENCE_HOLD/);
 }finally{
  await admin.query('UPDATE c73.custody_heads SET revision=2,head_tag=$3,ledger=$4::jsonb WHERE tenant_id=$1 AND document_id=$2',
   [t,d,second.ledger.headTag,JSON.stringify(second.ledger)]);
  await admin.query('INSERT INTO c73.custody_events(tenant_id,document_id,revision,event_tag,event_json) VALUES($1,$2,2,$3,$4::jsonb)',
   [t,d,second.ledger.events[1].tag,JSON.stringify(second.ledger.events[1])]);
 }
 ok((await gate.get({request:request('a'),documentId:d})).ledger.events.length===2,
  'remote + database continuity restored for synthetic test');
 const poisonSignature={...witness,
  readCheckpoint:async id=>{
   const actual=await witness.readCheckpoint(id);
   return {...actual,signature:(actual.signature[0]==='A'?'B':'A')+actual.signature.slice(1)};
  }};
 const poisoned=createWitnessedCustodyGate({...options,witness:poisonSignature});
 await denies(()=>poisoned.get({request:request('a'),documentId:d}),/C73_WITNESS_SIGNATURE_HOLD/);
 const wrongKey=generateKeyPairSync('ed25519').publicKey.export({format:'pem',type:'spki'});
 const counterfeit=createWitnessedCustodyGate({...options,publicKey:wrongKey});
 await denies(()=>counterfeit.get({request:request('a'),documentId:d}),/C73_WITNESS_SIGNATURE_HOLD/);
 const aged=createWitnessedCustodyGate({...options,clock:()=>new Date(Date.now()+600000)});
 await denies(()=>aged.get({request:request('a'),documentId:d}),
  /C73_WITNESS_STALE_OR_FUTURE_HOLD/);
 const unavailable=createWitnessedCustodyGate({...options,
  witness:{...witness,readCheckpoint:async()=>{throw Error('witness offline');}}});
 await denies(()=>unavailable.get({request:request('a'),documentId:d}),
  /C73_WITNESS_READ_UNAVAILABLE_HOLD/);
 const notCommitted=createWitnessedCustodyGate({...options,
  witness:{...witness,advanceCheckpoint:async()=>{throw Error('witness offline');}}});
 const c={request:request('a'),scope:scope('tenant-a','DOC-C73-3C-UNANCHORED'),bytes:PDF};
 await denies(()=>notCommitted.observe(c),/C73_WITNESS_COMMIT_UNAVAILABLE_HOLD/);
 // DB may have committed already, but any API path WITH the witness gate
 // must refuse until explicitly reconciled by an authorized operator.
 await denies(()=>gate.get({request:request('a'),documentId:c.scope.documentId}),
  /C73_WITNESS_CHECKPOINT_MISSING_HOLD/);
 const revoked=await gate.revoke({request:request('a'),documentId:d,
  expectedRevision:2,expectedHeadTag:second.ledger.headTag});
 ok(revoked.verdict.status===STATE.HOLD_REVOKED,'revocation committed');
 ok((await gate.get({request:request('a'),documentId:d})).verdict.status===STATE.HOLD_REVOKED,
  'signed revocation externally witnessed');
 await denies(()=>gate.recheck({request:request('a'),documentId:d,bytes:PDF,
  expectedRevision:3,expectedHeadTag:revoked.ledger.headTag}),/C73_CUSTODY_NOT_ACTIVE/);
 // The witness signer must never mint receipts based on unauthenticated HTTP.
 const direct=await fetch(base+'/advance',{method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({tenantId:t,documentId:d,revision:99,headTag:'f'.repeat(64),
   expectedRevision:3,expectedHeadTag:revoked.ledger.headTag})});
 ok(direct.status===401,'unauthenticated witness advance denied before CAS');
 const qs='/checkpoint?'+new URLSearchParams({tenantId:t,documentId:d}).toString();
 const fixedHeaders=signer({method:'GET',route:qs,body:Buffer.alloc(0)});
 const fresh=await fetch(base+qs,{headers:fixedHeaders});
 ok(fresh.status===200,'authenticated witness read');
 const replay=await fetch(base+qs,{headers:fixedHeaders});
 ok(replay.status===409,'identical signed request nonce replay denied');
 const tamperedPath='/checkpoint?'+new URLSearchParams({tenantId:'tenant-b',documentId:d}).toString();
 const bodyChanged=await fetch(base+tamperedPath,{headers:signer({
  method:'GET',route:qs,body:Buffer.alloc(0)})});
 ok(bodyChanged.status===401,'a signed request cannot be transferred to a different URL');
 const wrongSigner=createWitnessRequestSigner({privateKey:generateKeyPairSync('ed25519').privateKey,
  clientId,clock:()=>new Date()});
 const wrongAuth=await fetch(base+qs,{headers:wrongSigner({method:'GET',route:qs})});
 ok(wrongAuth.status===401,'unsigned caller cannot mint witness advance or read');
 const staleSigner=createWitnessRequestSigner({privateKey:applicationClient.privateKey,
  clientId,clock:()=>new Date(Date.now()-600000)});
 const staleAuth=await fetch(base+qs,{headers:staleSigner({method:'GET',route:qs})});
 ok(staleAuth.status===401,'stale signed witness request denied');

 // Restart destroys the process memory; signed checkpoint and identity pin
 // must survive because the private key/journal are stored in a separate dir.
 await stopChild();
 const resumed=await witnessChild();
 ok(resumed.publicKey===w.publicKey,'public signing key persists after restart');
 const nextBase='http://127.0.0.1:'+resumed.port;
 const witness2=createWitnessHttpTransport({baseUrl:nextBase,signRequest:signer});
 const gate2=createWitnessedCustodyGate({...options,witness:witness2});
 ok((await gate2.get({request:request('a'),documentId:d})).verdict.status===STATE.HOLD_REVOKED,
  'latest revoked witness checkpoint survives a real process restart');
 ok((await gate2.get({request:request('b'),documentId:b.scope.documentId})).ledger.scope.tenantId==='tenant-b',
  'tenant B signed witness persists across restart');
 const persistedReplay=await fetch(nextBase+qs,{headers:fixedHeaders});
 ok(persistedReplay.status===409,'nonce journal rejects replay across process restart');

 // A previously valid but lower revision cannot be resurrected by the client.
 const resurrect=await fetch(nextBase+'/advance',{method:'POST',headers:{
  'Content-Type':'application/json',...signer({method:'POST',route:'/advance',
   body:Buffer.from(JSON.stringify({tenantId:t,documentId:d,revision:2,headTag:second.ledger.headTag,
    expectedRevision:1,expectedHeadTag:first.ledger.headTag}))})},
  body:JSON.stringify({tenantId:t,documentId:d,revision:2,headTag:second.ledger.headTag,
   expectedRevision:1,expectedHeadTag:first.ledger.headTag})});
 ok(resurrect.status===409,'authenticated old CAS cannot rewrite a persisted newer witness');
 ok(gate.productionTrustedWitnessReady===false&&gate.independentWitnessInfrastructureProvisioned===false,
  'local durable journal still is not independent WORM or cloud certification');
 console.log('C73_3D_AUTHENTICATED_RESTART_PERSISTENT_WITNESS=PASS checks='+checks);
 console.log('C73_3D_TRUE_WORM_HSM_MTLS_PDPL_VALUER=HOLD');
}
run().catch(e=>{console.error('C73_3D_AUTHENTICATED_RESTART_PERSISTENT_WITNESS=FAIL',e);process.exitCode=1;})
 .finally(async()=>{
  if(child){child.send({type:'stop'});const wait=setTimeout(()=>child.kill('SIGKILL'),1000);child.once('exit',()=>clearTimeout(wait));}
  if(app)await app.end();
  await admin.end();
  if(root)await fsp.rm(root,{recursive:true,force:true});
  if(witnessRoot)await fsp.rm(witnessRoot,{recursive:true,force:true});
 });
