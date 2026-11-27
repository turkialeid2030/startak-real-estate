'use strict';
// Disposable CI database only. No production credentials, data, or endpoint.
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
const {Pool}=require('pg');
const {execFileSync}=require('node:child_process');
const {VERSION:INVENTORY_VERSION,signedInventoryBytes,verifySignedRestoreInventory}=require('../src/market/signed-restore-inventory');
const {makePostgresCustodyStore}=require('../src/market/postgres-custody-store');
const {makePostgresPrivateEnvelopeStore}=require('../src/market/postgres-private-envelope-store');
const {makePrivateAppraisalVault}=require('../src/market/private-appraisal-evidence-vault');
const {makeCustodyAppendCoordinator}=require('../src/market/custody-append-coordinator');
const {makeGovernedEvidenceIntake}=require('../src/market/governed-evidence-intake');
const {VERSION,custodyEventBytes,custodyEventHash,verifyCustodyChain}=require('../src/market/signed-evidence-custody');
const database='startak_custody_ci',runtime='custody_ci_runtime';
if(process.env.STARTAK_CUSTODY_DISPOSABLE_CI!=='true'||process.env.PGHOST!=='127.0.0.1'||process.env.PGDATABASE!==database||process.env.PGUSER!=='postgres'||!/^\d+$/.test(process.env.PGPORT||''))throw Error('DISPOSABLE_CI_DATABASE_REQUIRED');
const config={host:'127.0.0.1',port:Number(process.env.PGPORT),database,connectionTimeoutMillis:5000,statement_timeout:10000};
const admin=new Pool({...config,user:'postgres',max:2});
let pool,checks=0;
const {privateKey,publicKey}=crypto.generateKeyPairSync('ed25519');
const scope={tenantId:'CI-TENANT-A',caseRef:'CI-CASE-A',evidenceRef:'CI-EVID-A',sha256:'a'.repeat(64)};
function next(s,l,observedAt){
 const prev=l?.events.at(-1),event={sequence:(l?.events.length??0)+1,kind:prev?'RECHECKED':'SEALED',actorRef:'CI-ACTOR',observedAt,signerKeyRef:'CI-SIGNER',previousHashSha256:prev?custodyEventHash(s,prev.event,prev.signature):null};
 return {version:VERSION,scope:s,events:[...(l?.events??[]),{event,signature:crypto.sign(null,custodyEventBytes(s,event),privateKey).toString('base64')}]};
}
const head=(s,l)=>custodyEventHash(s,l.events.at(-1).event,l.events.at(-1).signature);
async function check(label,fn){await fn();checks++;console.log('POSTGRES_LIVE_PASS '+label);}
async function main(){
 const identity=await admin.query('SELECT current_database() AS db, current_user AS role_name');
 assert.equal(identity.rows[0].db,database);assert.equal(identity.rows[0].role_name,'postgres');
 assert.equal((await admin.query("SELECT to_regclass('public.startak_evidence_custody') AS existing")).rows[0].existing,null);
 await admin.query(fs.readFileSync(path.join(__dirname,'../docs/recovery/sql/controlled-custody-ledger-v1.sql'),'utf8'));
 await admin.query(fs.readFileSync(path.join(__dirname,'../docs/recovery/sql/controlled-private-envelope-v1.sql'),'utf8'));
 await admin.query('CREATE ROLE custody_ci_runtime LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT');
 await admin.query('GRANT USAGE ON SCHEMA public TO custody_ci_runtime');
 await admin.query('GRANT SELECT, INSERT, UPDATE ON public.startak_evidence_custody TO custody_ci_runtime');
 await admin.query('GRANT SELECT, INSERT ON public.startak_private_evidence_envelopes TO custody_ci_runtime');
 pool=new Pool({...config,user:runtime,max:5});
 const store=()=>makePostgresCustodyStore({pool,expectedRole:runtime,expectedDatabase:database});
 let a=store(),one=next(scope,null,'2026-09-01'),two=next(scope,one,'2026-09-02'),three=next(scope,two,'2026-09-03');
 const append=(candidate,expectedRevision,expectedHeadHashSha256,s=scope)=>a.compareAndAppend({scope:s,expectedRevision,expectedHeadHashSha256,candidate});
 await check('empty lookup and insert race',async()=>{assert.equal(await a.loadLedger(scope),null);const results=await Promise.all([append(one,0,null),append(one,0,null)]);assert.equal(results.filter(Boolean).length,1);});
 await check('concurrent CAS append',async()=>{const results=await Promise.all([append(two,1,head(scope,one)),append(two,1,head(scope,one))]);assert.equal(results.filter(Boolean).length,1);assert.deepEqual(await a.loadLedger(scope),two);});
 await check('exact prefix and monotonic revision',async()=>{const forged=JSON.parse(JSON.stringify(three));forged.events[0].event.actorRef='FORGED';assert.equal(await append(forged,2,head(scope,two)),false);assert.equal(await append(three,2,head(scope,two)),true);assert.equal(await append(two,1,head(scope,one)),false);});
 await check('other case and tenant remain distinct',async()=>{for(const s of [{...scope,caseRef:'CI-CASE-B'},{...scope,tenantId:'CI-TENANT-B'}]){assert.equal(await a.loadLedger(s),null);assert.equal(await append(next(s,null,'2026-09-01'),0,null,s),true);}assert.deepEqual(await a.loadLedger(scope),three);});
 await check('direct SQL without context sees no rows',async()=>{assert.equal((await pool.query('SELECT * FROM public.startak_evidence_custody')).rowCount,0);});
 await check('RLS blocks cross-scope SQL read/update/insert',async()=>{
  const client=await pool.connect();try{
   await client.query('BEGIN');
   await client.query("SELECT set_config('startak.tenant_id',$1,true),set_config('startak.case_ref',$2,true)",[scope.tenantId,scope.caseRef]);
   assert.equal((await client.query('SELECT * FROM public.startak_evidence_custody')).rowCount,1);
   assert.equal((await client.query("UPDATE public.startak_evidence_custody SET revision=7 WHERE tenant_id='CI-TENANT-B'")).rowCount,0);
   await assert.rejects(()=>client.query("INSERT INTO public.startak_evidence_custody SELECT 'CI-TENANT-C',case_ref,evidence_ref,content_sha256,revision,head_sha256,ledger FROM public.startak_evidence_custody"),e=>e.code==='42501');
  }finally{await client.query('ROLLBACK');client.release();}
 });
 await check('no DELETE or TRUNCATE privilege',async()=>{for(const q of ['DELETE FROM public.startak_evidence_custody','TRUNCATE public.startak_evidence_custody'])await assert.rejects(()=>pool.query(q),e=>e.code==='42501');});
 await check('wrong role and database fail closed',async()=>{const bad=makePostgresCustodyStore({pool,expectedRole:'wrong',expectedDatabase:database});await assert.rejects(()=>bad.loadLedger(scope),/TRANSACTION_FAILED/);const wrong=makePostgresCustodyStore({pool,expectedRole:runtime,expectedDatabase:'wrong'});await assert.rejects(()=>wrong.loadLedger(scope),/TRANSACTION_FAILED/);});
 await check('unexpected policy and DELETE grant fail closed',async()=>{
  await admin.query('CREATE POLICY ci_extra ON public.startak_evidence_custody USING (true)');
  try{await assert.rejects(()=>a.loadLedger(scope),/TRANSACTION_FAILED/);}finally{await admin.query('DROP POLICY ci_extra ON public.startak_evidence_custody');}
  await admin.query('GRANT DELETE ON public.startak_evidence_custody TO custody_ci_runtime');
  try{await assert.rejects(()=>a.loadLedger(scope),/TRANSACTION_FAILED/);}finally{await admin.query('REVOKE DELETE ON public.startak_evidence_custody FROM custody_ci_runtime');}
 });
 await check('connection restart and cryptographic replay',async()=>{await pool.end();pool=new Pool({...config,user:runtime,max:2});a=store();const actual=await a.loadLedger(scope);assert.deepEqual(actual,three);const verdict=await verifyCustodyChain(actual,{expectedScope:scope,checkpoint:{version:VERSION,scope,revision:3,headHashSha256:head(scope,three)},resolveSigner:async({tenantId,signerKeyRef})=>({tenantId,signerKeyRef,purpose:'EVIDENCE_CUSTODY_SIGNING',revoked:false,validFrom:'2026-01-01',validUntil:'2026-12-31',publicKey}),now:new Date('2026-09-04'),maxAgeSeconds:172800});assert.equal(verdict.integrityVerified,true);assert.equal((await pool.query('SELECT * FROM public.startak_evidence_custody')).rowCount,0);});
 await check('same-name policy expression drift fails closed',async()=>{
  await admin.query('ALTER POLICY startak_custody_scope ON public.startak_evidence_custody USING (true) WITH CHECK (true)');
  try{await assert.rejects(()=>a.loadLedger(scope),/TRANSACTION_FAILED/);}
  finally{await admin.query("ALTER POLICY startak_custody_scope ON public.startak_evidence_custody USING (tenant_id=nullif(current_setting('startak.tenant_id',true),'') AND case_ref=nullif(current_setting('startak.case_ref',true),'')) WITH CHECK (tenant_id=nullif(current_setting('startak.tenant_id',true),'') AND case_ref=nullif(current_setting('startak.case_ref',true),''))");}
  assert.deepEqual(await a.loadLedger(scope),three);
 });
 // Two actual encrypted documents, separately generated synthetic keys and
 // signed custody checkpoints. The witness and KMS remain fixtures.
 const {VERSION:WITNESS_VERSION,witnessReceiptBytes,makeVerifiedWitnessCheckpointProvider}=require('../src/market/signed-witness-checkpoint');
 const documentActor={id:'CI-DOCUMENT-ADMIN'},documentKeys=new Map([['DOC-KEY-1',crypto.randomBytes(32)],['DOC-KEY-2',crypto.randomBytes(32)]]),checkpoints=new Map();
 const witnessKey=crypto.generateKeyPairSync('ed25519');
 const verifiedWitness=makeVerifiedWitnessCheckpointProvider({loadReceipt:async({scope:s,challenge})=>{const cp=checkpoints.get(s.evidenceRef);const receipt={version:WITNESS_VERSION,scope:s,challenge,revision:cp?.revision??0,headHashSha256:cp?.headHashSha256??null,observedAt:new Date().toISOString(),signerKeyRef:'CI-WITNESS-SIGNER'};return {receipt,signature:crypto.sign(null,witnessReceiptBytes(receipt),witnessKey.privateKey).toString('base64')};},resolveWitnessSigner:async({tenantId,signerKeyRef})=>({tenantId,signerKeyRef,purpose:'EVIDENCE_WITNESS_SIGNING',revoked:false,validFrom:'2026-01-01',validUntil:'2099-12-31',publicKey:witnessKey.publicKey})});
 let activeDocumentKey='DOC-KEY-1',documentInventory=null;
 const documents=['CI-DOC-1','CI-DOC-2'].map((evidenceRef,i)=>{const bytes=Buffer.from('SYNTHETIC PRIVATE DOCUMENT '+i);return {scope:{tenantId:scope.tenantId,caseRef:scope.caseRef,evidenceRef,sha256:crypto.createHash('sha256').update(bytes).digest('hex')},bytes};});
 const docSigner=crypto.generateKeyPairSync('ed25519');
 const docTrust=async({tenantId,signerKeyRef})=>({tenantId,signerKeyRef,purpose:'BACKUP_INVENTORY_SIGNING',revoked:false,validFrom:'2026-01-01',validUntil:'2099-12-31',publicKey:docSigner.publicKey});
 function vaultFor(dbPool,dbName,ledgerStore,orphanRecovery){return makePrivateAppraisalVault({
  ...(orphanRecovery?{orphanRecovery}:{}),
  adapter:makePostgresPrivateEnvelopeStore({pool:dbPool,expectedRole:runtime,expectedDatabase:dbName}),
  authorizeActor:async({requestActor,tenantId,caseRef})=>requestActor===documentActor&&tenantId===scope.tenantId&&caseRef===scope.caseRef?{verifiedByServer:true,tenantId,caseRefs:[caseRef],actorId:documentActor.id,role:'DATA_ADMIN'}:null,
  keyring:{activeKey:async tenantId=>({tenantId,keyRef:activeDocumentKey,keyBytes:documentKeys.get(activeDocumentKey)}),resolveKey:async(tenantId,keyRef)=>({tenantId,keyRef,keyBytes:documentKeys.get(keyRef)})},
  custodyTrust:{loadLedger:ledgerStore.loadLedger,loadCheckpoint:verifiedWitness.loadCheckpoint,resolveSigner:async({tenantId,signerKeyRef})=>({tenantId,signerKeyRef,purpose:'EVIDENCE_CUSTODY_SIGNING',revoked:false,validFrom:'2026-01-01',validUntil:'2099-12-31',publicKey}),maxAgeSeconds:31536000},
  restoreInventoryProvider:async()=>documentInventory,restoreInventoryTrust:{resolveSigner:docTrust,maxAgeSeconds:3600},requireStrictCustody:true
 });}
 const vault=vaultFor(pool,database,a);
 let witnessAvailable=true;
 const coordinator=makeCustodyAppendCoordinator({authorizeActor:async({requestActor,tenantId,caseRef})=>requestActor===documentActor&&tenantId===scope.tenantId&&caseRef===scope.caseRef?{verifiedByServer:true,tenantId,caseRefs:[caseRef],actorId:documentActor.id,role:'DATA_ADMIN'}:null,loadLedger:a.loadLedger,compareAndAppend:a.compareAndAppend,loadCheckpoint:verifiedWitness.loadCheckpoint,resolveSigner:async({tenantId,signerKeyRef})=>({tenantId,signerKeyRef,purpose:'EVIDENCE_CUSTODY_SIGNING',revoked:false,validFrom:'2026-01-01',validUntil:'2099-12-31',publicKey}),signEvent:async({bytes})=>crypto.sign(null,bytes,privateKey).toString('base64'),advanceWitness:async({scope:s,expectedRevision,expectedHeadHashSha256,nextCheckpoint})=>{const current=checkpoints.get(s.evidenceRef);if(!witnessAvailable||(current?.revision??0)!==expectedRevision||(current?.headHashSha256??null)!==expectedHeadHashSha256)return false;checkpoints.set(s.evidenceRef,nextCheckpoint);return true;},authorizeReconciliation:async x=>({...x,approved:true,reviewerId:'CI-INDEPENDENT-REVIEWER',approvedAt:reconciliationTime}),clock:()=>new Date(reconciliationTime??Date.now())});
 let reconciliationTime=null;
 const intake=makeGovernedEvidenceIntake({vault,custodyCoordinator:coordinator,signerKeyRef:'CI-SIGNER'});
 const envelopeStore=makePostgresPrivateEnvelopeStore({pool,expectedRole:runtime,expectedDatabase:database});
 await check('actual encrypted envelope insert rotation and custody binding',async()=>{
  for(const d of documents){
   const input={...d.scope,actor:documentActor,sourceBytes:d.bytes,expectedSha256:d.scope.sha256};
   witnessAvailable=d.scope.evidenceRef==='CI-DOC-1';
   const result=await intake.seal(input);
   if(witnessAvailable)assert.equal(result.status,'INTAKE_WITNESSED_AND_READBACK_MATCHED');
   else{
    assert.equal(result.reason,'SEALED_ENVELOPE_CUSTODY_PENDING');
    assert.equal((await a.loadLedger(d.scope)).events.length,1);
    assert.equal(checkpoints.has(d.scope.evidenceRef),false);
    await assert.rejects(()=>vault.read({...d.scope,actor:documentActor}),/EVIDENCE_CUSTODY_NOT_QUALIFIED/);
    witnessAvailable=true;reconciliationTime=new Date().toISOString();
    const recovered=await coordinator.reconcile({actor:documentActor,scope:d.scope,changeControlRef:'CI-CHG-REPAIR'});
    assert.equal(recovered.status,'CUSTODY_RECONCILIATION_CONFIRMED_BY_PROVIDERS');
    reconciliationTime=null;
   }
   activeDocumentKey='DOC-KEY-2';
  }
  for(const d of documents){const read=await vault.read({...d.scope,actor:documentActor});assert.deepEqual(read.sourceBytes,d.bytes);assert.equal(read.custodyIntegrityVerified,true);read.sourceBytes.fill(0);}
  const rows=(await admin.query('SELECT envelope FROM public.startak_private_evidence_envelopes ORDER BY evidence_ref')).rows;
  assert.equal(rows.length,2);assert.deepEqual(rows.map(x=>JSON.parse(x.envelope).keyRef),['DOC-KEY-1','DOC-KEY-2']);
  assert.ok(rows.every((x,i)=>!x.envelope.includes(documents[i].bytes.toString())));
  await assert.rejects(()=>vault.put({...documents[0].scope,actor:documentActor,sourceBytes:documents[0].bytes,expectedSha256:documents[0].scope.sha256}),/IMMUTABLE_REF/);
 });
 await check('actual envelope access scope and immutable database privileges',async()=>{
  const d=documents[0].scope,key='appraisal-evidence:v1:'+d.tenantId+':'+d.evidenceRef;
  assert.equal(await envelopeStore.get(key,{tenantId:d.tenantId,caseRef:'OTHER-CASE',evidenceRef:d.evidenceRef}),null);
  await assert.rejects(()=>vault.read({...d,caseRef:'OTHER-CASE',actor:documentActor}),/ACCESS_DENIED/);
  assert.equal((await pool.query('SELECT * FROM public.startak_private_evidence_envelopes')).rowCount,0);
  for(const q of ['UPDATE public.startak_private_evidence_envelopes SET envelope=envelope','DELETE FROM public.startak_private_evidence_envelopes','TRUNCATE public.startak_private_evidence_envelopes'])await assert.rejects(()=>pool.query(q),e=>e.code==='42501');
  await admin.query('GRANT UPDATE(envelope) ON public.startak_private_evidence_envelopes TO custody_ci_runtime');
  try{await assert.rejects(()=>vault.read({...d,actor:documentActor}),/ENVELOPE_DB_TRANSACTION_FAILED/);}finally{await admin.query('REVOKE UPDATE(envelope) ON public.startak_private_evidence_envelopes FROM custody_ci_runtime');}
 });
 await check('logical backup artifact and separate database restore',async()=>{
  // Real PostgreSQL logical backup/restore via the exact disposable service.
  // No shell interpolation, external endpoint, or production credential.
  const containerId=process.env.STARTAK_CUSTODY_SERVICE_ID,restoreDb='startak_custody_restore_ci';
  assert.equal(process.env.GITHUB_ACTIONS,'true');assert.match(containerId,/^[a-f0-9]{12,64}$/);
  const docker=(args,input)=>execFileSync('docker',['exec','-i',containerId,...args],{input,timeout:90000,maxBuffer:16*1024*1024,stdio:['pipe','pipe','pipe']});
  const sourceRows=(await admin.query('SELECT tenant_id,case_ref,evidence_ref,content_sha256,revision,head_sha256,ledger FROM public.startak_evidence_custody ORDER BY tenant_id,case_ref,evidence_ref')).rows;
  assert.equal(sourceRows.length,5);
  const sourceEnvelopes=(await admin.query('SELECT * FROM public.startak_private_evidence_envelopes ORDER BY tenant_id,case_ref,evidence_ref')).rows;assert.equal(sourceEnvelopes.length,2);
  const started=Date.now();
  const backup=docker(['pg_dump','-U','postgres','-d',database,'--format=custom','--no-owner','--no-acl']);
  assert.ok(backup.length>100);assert.equal(backup.subarray(0,5).toString(),'PGDMP');
  const artifactHash=crypto.createHash('sha256').update(backup).digest('hex');
  assert.equal((await admin.query('SELECT datname FROM pg_database WHERE datname=$1',[restoreDb])).rowCount,0);
  await admin.query('CREATE DATABASE startak_custody_restore_ci');
  docker(['pg_restore','-U','postgres','-d',restoreDb,'--exit-on-error','--no-owner','--no-acl'],backup);
  const restoredAdmin=new Pool({...config,database:restoreDb,user:'postgres',max:2});let restoredPool;
  try{
   const restoredRows=(await restoredAdmin.query('SELECT tenant_id,case_ref,evidence_ref,content_sha256,revision,head_sha256,ledger FROM public.startak_evidence_custody ORDER BY tenant_id,case_ref,evidence_ref')).rows;
   assert.deepEqual(restoredRows,sourceRows);
   assert.deepEqual((await restoredAdmin.query('SELECT * FROM public.startak_private_evidence_envelopes ORDER BY tenant_id,case_ref,evidence_ref')).rows,sourceEnvelopes);
   // Grants are intentionally rebuilt, not imported from the backup.
   await restoredAdmin.query('GRANT USAGE ON SCHEMA public TO custody_ci_runtime');
   await restoredAdmin.query('GRANT SELECT, INSERT, UPDATE ON public.startak_evidence_custody TO custody_ci_runtime');
   await restoredAdmin.query('GRANT SELECT, INSERT ON public.startak_private_evidence_envelopes TO custody_ci_runtime');
   restoredPool=new Pool({...config,database:restoreDb,user:runtime,max:3});
   const recovered=makePostgresCustodyStore({pool:restoredPool,expectedRole:runtime,expectedDatabase:restoreDb});
   for(const row of sourceRows){
    const x={tenantId:row.tenant_id,caseRef:row.case_ref,evidenceRef:row.evidence_ref,sha256:row.content_sha256};
    const l=await recovered.loadLedger(x);assert.deepEqual(l,row.ledger);
    const verdict=await verifyCustodyChain(l,{expectedScope:x,checkpoint:{version:VERSION,scope:x,revision:row.revision,headHashSha256:row.head_sha256},resolveSigner:async({tenantId,signerKeyRef})=>({tenantId,signerKeyRef,purpose:'EVIDENCE_CUSTODY_SIGNING',revoked:false,validFrom:'2026-01-01',validUntil:'2026-12-31',publicKey}),now:x.evidenceRef.startsWith('CI-DOC-')?new Date():new Date('2026-09-04'),maxAgeSeconds:604800});
    assert.equal(verdict.integrityVerified,true);
   }
   assert.equal((await restoredPool.query('SELECT * FROM public.startak_evidence_custody')).rowCount,0);
   await assert.rejects(()=>restoredPool.query('DELETE FROM public.startak_evidence_custody'),e=>e.code==='42501');
   // Signed inventory binds each expected document hash and backup artifact
   // identifier. This inventory is synthetic; no external witness is claimed.
   const kp=crypto.generateKeyPairSync('ed25519'),at=new Date().toISOString();
   const inventory={version:INVENTORY_VERSION,tenantId:scope.tenantId,caseRef:scope.caseRef,inventoryRef:'CI-INVENTORY',backupRef:artifactHash,snapshotAt:at,signedAt:at,signerKeyRef:'CI-INVENTORY-SIGNER',entries:sourceRows.filter(x=>x.tenant_id===scope.tenantId&&x.case_ref===scope.caseRef).map(x=>({evidenceRef:x.evidence_ref,sha256:x.content_sha256}))};
   const signature=crypto.sign(null,signedInventoryBytes(inventory),kp.privateKey).toString('base64');
   const opts={tenantId:scope.tenantId,caseRef:scope.caseRef,inventoryRef:inventory.inventoryRef,now:new Date(),maxAgeSeconds:3600,resolveSigner:async()=>({tenantId:scope.tenantId,signerKeyRef:inventory.signerKeyRef,purpose:'BACKUP_INVENTORY_SIGNING',revoked:false,validFrom:'2026-01-01',validUntil:'2099-12-31',publicKey:kp.publicKey})};
   assert.equal((await verifySignedRestoreInventory({inventory,signature},opts)).signatureVerified,true);
   assert.equal((await verifySignedRestoreInventory({inventory:{...inventory,backupRef:'0'.repeat(64)},signature},opts)).signatureVerified,false);
   const docManifest={version:INVENTORY_VERSION,tenantId:scope.tenantId,caseRef:scope.caseRef,inventoryRef:'CI-DOC-INVENTORY',backupRef:artifactHash,snapshotAt:at,signedAt:at,signerKeyRef:'CI-DOC-INVENTORY-SIGNER',entries:documents.map(d=>({evidenceRef:d.scope.evidenceRef,sha256:d.scope.sha256}))};
   documentInventory={inventory:docManifest,signature:crypto.sign(null,signedInventoryBytes(docManifest),docSigner.privateKey).toString('base64')};
   const restoredVault=vaultFor(restoredPool,restoreDb,recovered);
   for(const d of documents){const read=await restoredVault.read({...d.scope,actor:documentActor});assert.deepEqual(read.sourceBytes,d.bytes);assert.equal(read.custodyIntegrityVerified,true);read.sourceBytes.fill(0);}
   const verification=await restoredVault.verifyRestoredInventory({actor:documentActor,tenantId:scope.tenantId,caseRef:scope.caseRef,inventoryRef:docManifest.inventoryRef});
   assert.equal(verification.status,'RESTORED_SIGNED_EXPECTED_INVENTORY_MATCHED');assert.equal(verification.verifiedCount,2);assert.equal(verification.productionRecoveryVerified,false);
   const savedKey=documentKeys.get('DOC-KEY-1');documentKeys.delete('DOC-KEY-1');
   try{assert.equal((await restoredVault.verifyRestoredInventory({actor:documentActor,tenantId:scope.tenantId,caseRef:scope.caseRef,inventoryRef:docManifest.inventoryRef})).status,'HOLD_RESTORE_VERIFICATION');}finally{documentKeys.set('DOC-KEY-1',savedKey);}
   console.log('POSTGRES_ENCRYPTED_DOCUMENT_RESTORE_RESULT=PASS documents=2 ledger_rows='+restoredRows.length+' production=false');
   const tampered=Buffer.from(backup);tampered[tampered.length-1]^=1;
   assert.notEqual(crypto.createHash('sha256').update(tampered).digest('hex'),artifactHash);
   console.log('POSTGRES_BACKUP_RESTORE_RESULT=PASS rows='+restoredRows.length+' artifact_sha256='+artifactHash+' bytes='+backup.length+' elapsed_ms='+(Date.now()-started)+' production=false');
  }finally{if(restoredPool)await restoredPool.end();await restoredAdmin.end();backup.fill(0);}
 });
 await check('orphan envelope recovery on actual database',async()=>{
  let approve=false;
  const recoveryVault=vaultFor(pool,database,a,{coordinator,signerKeyRef:'CI-SIGNER',authorizeRecovery:async x=>({...x,approved:approve,reviewerId:'CI-INDEPENDENT-REVIEWER',approvedAt:new Date().toISOString()})});
  const bytes=Buffer.from('CI ORPHAN ENVELOPE'),d={tenantId:scope.tenantId,caseRef:scope.caseRef,evidenceRef:'CI-ORPHAN',sha256:crypto.createHash('sha256').update(bytes).digest('hex')};
  const request={...d,actor:documentActor,expectedSha256:d.sha256,changeControlRef:'CI-ORPHAN-CHG'};
  await recoveryVault.put({...request,sourceBytes:bytes});
  assert.equal(await a.loadLedger(d),null);
  await assert.rejects(()=>recoveryVault.read(request),/EVIDENCE_CUSTODY_NOT_QUALIFIED/);
  assert.equal((await recoveryVault.recoverOrphan(request)).reason,'ORPHAN_RECOVERY_APPROVAL_INVALID');
  approve=true;
  const result=await recoveryVault.recoverOrphan(request);
  assert.equal(result.status,'ORPHAN_RECOVERY_CONFIRMED_BY_PROVIDERS');assert.equal(Object.hasOwn(result,'sourceBytes'),false);
  assert.equal((await recoveryVault.recoverOrphan(request)).reason,'ORPHAN_RECOVERY_EXISTING_CUSTODY');
  const read=await recoveryVault.read(request);assert.deepEqual(read.sourceBytes,bytes);read.sourceBytes.fill(0);
  assert.equal((await a.loadLedger(d)).events.length,1);
 });
 console.log('POSTGRES_LIVE_CUSTODY_RESULT=PASS checks='+checks+' real_database=true synthetic_data=true production=false');
}
main().catch(e=>{console.error('POSTGRES_LIVE_CUSTODY_RESULT=FAIL',e.message);process.exitCode=1;}).finally(async()=>{if(pool)await pool.end().catch(()=>{});await admin.end();});
