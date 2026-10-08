'use strict';
// Real isolated PostgreSQL integration test. All data, keys and identity tokens
// are synthetic. Requires temporary "pg" dependency in CI, never user files.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {randomBytes,createHash}=require('node:crypto');
const {Pool}=require('pg');
const {createPostgresCustodyService}=require('../../src/security/c73-postgres-custody-service');
const {STATE}=require('../../src/security/c73-signed-document-custody');
const PDF=Buffer.from('%PDF-1.4\nC73_2_SYNTHETIC_PRIVATE_BYTES\n');
const admin=new Pool({host:'127.0.0.1',port:5432,user:'postgres',
 password:process.env.C73_TEST_POSTGRES_PASSWORD||'local-ci-only',database:'postgres',max:3});
let app,checks=0;
function check(b,msg){assert.ok(b,msg);checks++;}
async function denied(fn,pattern){
 await assert.rejects(fn,pattern);checks++;
}
const identities={
 A:{status:'VERIFIED_CONTEXT',authorizationReady:true,
  identity:{actorId:'editor-a',subject:'editor-a',tenantId:'tenant-a',roles:['CUSTODY_EDITOR']}},
 B:{status:'VERIFIED_CONTEXT',authorizationReady:true,
  identity:{actorId:'editor-b',subject:'editor-b',tenantId:'tenant-b',roles:['CUSTODY_EDITOR']}},
 VIEW:{status:'VERIFIED_CONTEXT',authorizationReady:true,
  identity:{actorId:'viewer-a',subject:'viewer-a',tenantId:'tenant-a',roles:['CUSTODY_READER']}},
};
const tokens={a:'A',b:'B',view:'VIEW'};
function scope(tenantId,documentId='DOC-100'){
 return {tenantId,caseId:'CASE-'+tenantId,projectId:'PROJECT-'+tenantId,
  propertyRef:'PROPERTY-'+tenantId,valuationDate:'2026-10-08',
  documentId,evidenceType:'inspection',referenceId:'EVIDENCE-'+tenantId,
  artifactVersion:1,mediaType:'application/pdf'};
}
function observed(db){
 return {request:{sessionToken:'a'},scope:scope('tenant-a',db),bytes:PDF};
}
async function run(){
 // The CI admin creates a dedicated unprivileged test runtime role.
 await admin.query("DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='c73_app') THEN CREATE ROLE c73_app LOGIN PASSWORD 'ci-test-only' NOSUPERUSER NOBYPASSRLS; END IF; END $$");
 await admin.query(fs.readFileSync(path.join(__dirname,'../../sql/c73_transactional_custody.sql'),'utf8'));
 app=new Pool({host:'127.0.0.1',port:5432,user:'c73_app',
  password:'ci-test-only',database:'postgres',max:8});
 const role=await app.query('SELECT current_user AS username,rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user');
 check(role.rows[0].username==='c73_app'&&role.rows[0].rolsuper===false&&role.rows[0].rolbypassrls===false,'role not privileged');
 const tables=await app.query("SELECT relname,relrowsecurity,relforcerowsecurity FROM pg_class WHERE relname IN ('custody_heads','custody_events')");
 check(tables.rows.length===2&&tables.rows.every(x=>x.relrowsecurity&&x.relforcerowsecurity),'FORCE RLS on both');
 let milliseconds=Date.parse('2026-10-08T12:00:00.000Z');
 const service=createPostgresCustodyService({
  pool:app,key:randomBytes(32),keyRef:'c73-ci-signing-key',
  clock:()=>new Date(milliseconds+=1000),
  verifyRequest:async request=>identities[tokens[request?.sessionToken]]||null,
 });
 check(service.productionVaultReady===false&&service.professionalValuationAuthorized===false,
  'does not create production authority');
 const one=await service.observe(observed('DOC-100'));
 const b=await service.observe({request:{sessionToken:'b'},scope:scope('tenant-b'),bytes:PDF});
 check(one.ledger.scope.sha256Hex===createHash('sha256').update(PDF).digest('hex'),'byte digest');
 check(b.ledger.scope.tenantId==='tenant-b'&&one.ledger.scope.tenantId==='tenant-a',
  'same document name isolated by tenant');
 check(one.verdict.status===STATE.INTEGRITY_MATCHED_UNVERIFIED,'signed observation');
 check(!JSON.stringify(one.ledger).includes('C73_2_SYNTHETIC_PRIVATE_BYTES'),
  'no document bytes persisted to signed ledger');
 const readA=await service.get({request:{sessionToken:'a'},documentId:'DOC-100'});
 const readB=await service.get({request:{sessionToken:'b'},documentId:'DOC-100'});
 // Even a privileged accidental SQL modification cannot silently break the
 // append-only audit event store while the HMAC head still appears valid.
 const auditA=await admin.query(
  "SELECT event_tag,event_json FROM c73.custody_events WHERE tenant_id='tenant-a' AND document_id='DOC-100' AND revision=1");
 await admin.query("UPDATE c73.custody_events SET event_tag=$1 WHERE tenant_id='tenant-a' AND document_id='DOC-100' AND revision=1",
  ['0'.repeat(64)]);
 try{
  await denied(()=>service.get({request:{sessionToken:'a'},documentId:'DOC-100'}),
   /C73_AUDIT_CONTINUITY_BROKEN/);
 }finally{
  await admin.query("UPDATE c73.custody_events SET event_tag=$1 WHERE tenant_id='tenant-a' AND document_id='DOC-100' AND revision=1",
   [auditA.rows[0].event_tag]);
 }
 // Swap a correctly signed, *fully consistent* A ledger/head/event into B's
 // database row. It must still be rejected before returning cross-tenant data.
 const backupB=await admin.query(
  "SELECT revision,head_tag,ledger FROM c73.custody_heads WHERE tenant_id='tenant-b' AND document_id='DOC-100'");
 const backupBEvent=await admin.query(
  "SELECT event_tag,event_json FROM c73.custody_events WHERE tenant_id='tenant-b' AND document_id='DOC-100' AND revision=1");
 await admin.query("UPDATE c73.custody_heads SET revision=$1,head_tag=$2,ledger=$3::jsonb WHERE tenant_id='tenant-b' AND document_id='DOC-100'",
  [1,one.ledger.headTag,JSON.stringify(one.ledger)]);
 await admin.query("UPDATE c73.custody_events SET event_tag=$1,event_json=$2::jsonb WHERE tenant_id='tenant-b' AND document_id='DOC-100' AND revision=1",
  [one.ledger.headTag,JSON.stringify(one.ledger.events[0])]);
 try{
  await denied(()=>service.get({request:{sessionToken:'b'},documentId:'DOC-100'}),
   /C73_DB_ROW_SCOPE_MISMATCH/);
 }finally{
  await admin.query("UPDATE c73.custody_heads SET revision=$1,head_tag=$2,ledger=$3::jsonb WHERE tenant_id='tenant-b' AND document_id='DOC-100'",
   [backupB.rows[0].revision,backupB.rows[0].head_tag,JSON.stringify(backupB.rows[0].ledger)]);
  await admin.query("UPDATE c73.custody_events SET event_tag=$1,event_json=$2::jsonb WHERE tenant_id='tenant-b' AND document_id='DOC-100' AND revision=1",
   [backupBEvent.rows[0].event_tag,JSON.stringify(backupBEvent.rows[0].event_json)]);
 }

 check(readA.ledger.scope.tenantId==='tenant-a'&&readB.ledger.scope.tenantId==='tenant-b',
  'tenant scopes segregated in the real database');
 await denied(()=>service.get({request:{sessionToken:'view',tenantId:'tenant-b'},documentId:'DOC-B'}),
  /C73_DOCUMENT_NOT_FOUND/);
 await denied(()=>service.observe({...observed('DOC-BAD'),request:{sessionToken:'view'}}),
  /C73_TRUSTED_IDENTITY_OR_ROLE_REQUIRED/);
 await denied(()=>service.observe({...observed('DOC-BAD'),request:{sessionToken:'a',tenantId:'tenant-b'},
  scope:scope('tenant-b','DOC-BAD')}),/C73_TENANT_SCOPE_DENIED/);
 await denied(()=>service.get({request:{sessionToken:'none'},documentId:'DOC-100'}),
  /C73_TRUSTED_IDENTITY_OR_ROLE_REQUIRED/);
 await denied(()=>service.observe(observed('DOC-100')),/C73_DOCUMENT_ALREADY_EXISTS/);
 // RLS cannot be bypassed by client requests lacking transaction-scoped context.
 const noCtx=await app.query('SELECT * FROM c73.custody_heads');
 check(noCtx.rowCount===0,'no ambient app.tenant_id leaks from pooled connections');
 const before=await app.connect();
 try{
  await before.query('BEGIN');
  await before.query("SELECT set_config('app.tenant_id',$1,true)",['tenant-a']);
  const wrong=await before.query("SELECT * FROM c73.custody_heads WHERE tenant_id='tenant-b'");
  check(wrong.rowCount===0,'cross-tenant SELECT blocked by RLS');
  await before.query('ROLLBACK');
 }finally{before.release();}
 await denied(()=>app.query("UPDATE c73.custody_events SET event_tag='x' WHERE document_id='DOC-100'"),
  /permission denied/);
 await denied(()=>app.query("DELETE FROM c73.custody_heads WHERE document_id='DOC-100'"),
  /permission denied/);
 // Test the real DB head is authoritative; any proposed client head is only CAS.
 await denied(()=>service.recheck({request:{sessionToken:'a'},documentId:'DOC-100',
  expectedRevision:2,expectedHeadTag:one.ledger.headTag,bytes:PDF}),/C73_STALE_CUSTODY_REVISION/);
 const two=await service.recheck({request:{sessionToken:'a'},documentId:'DOC-100',
  expectedRevision:1,expectedHeadTag:one.ledger.headTag,bytes:PDF});
 check(two.ledger.events.length===2&&two.ledger.events[1].previousTag===one.ledger.headTag,
  'signed event history matches database CAS');
 const changed=Buffer.from(PDF);changed[12]^=1;
 await denied(()=>service.recheck({request:{sessionToken:'a'},documentId:'DOC-100',
  expectedRevision:2,expectedHeadTag:two.ledger.headTag,bytes:changed}),/C73_BYTE_RECHECK_MISMATCH/);
 await denied(()=>service.recheck({request:{sessionToken:'a'},documentId:'DOC-100',
  expectedRevision:1,expectedHeadTag:one.ledger.headTag,bytes:PDF}),/C73_STALE_CUSTODY_REVISION/);
 // Two legitimate writes race the same DB row. Exactly one may commit.
 const r=await Promise.allSettled([0,1].map(()=>service.recheck({
  request:{sessionToken:'a'},documentId:'DOC-100',
  expectedRevision:2,expectedHeadTag:two.ledger.headTag,bytes:PDF,
 })));
 check(r.filter(v=>v.status==='fulfilled').length===1&&
  r.filter(v=>v.status==='rejected').length===1,'concurrent CAS has one winner');
 const three=(await service.get({request:{sessionToken:'a'},documentId:'DOC-100'})).ledger;
 check(three.events.length===3,'no duplicate revision from concurrent update');
 const ev=await admin.query("SELECT revision FROM c73.custody_events WHERE tenant_id='tenant-a' AND document_id='DOC-100' ORDER BY revision");
 check(ev.rows.map(x=>x.revision).join(',')==='1,2,3','event audit is append-only and gapless');
 // Simulate write-time failure in event insert; verify transaction rolls back the head insert.
 await admin.query('REVOKE INSERT ON c73.custody_events FROM c73_app');
 try{
  await denied(()=>service.observe(observed('ROLLBACK-PROOF')),/permission denied/);
  await denied(()=>service.get({request:{sessionToken:'a'},documentId:'ROLLBACK-PROOF'}),
   /C73_DOCUMENT_NOT_FOUND/);
 }finally{await admin.query('GRANT INSERT ON c73.custody_events TO c73_app');}
 const revoked=await service.revoke({request:{sessionToken:'a'},documentId:'DOC-100',
  expectedRevision:3,expectedHeadTag:three.headTag});
 check(revoked.verdict.status===STATE.HOLD_REVOKED,'revoked state persisted');
 await denied(()=>service.recheck({request:{sessionToken:'a'},documentId:'DOC-100',
  expectedRevision:4,expectedHeadTag:revoked.ledger.headTag,bytes:PDF}),/C73_CUSTODY_NOT_ACTIVE/);
 const final=(await service.get({request:{sessionToken:'a'},documentId:'DOC-100'}));
 check(final.verdict.status===STATE.HOLD_REVOKED&&
  final.verdict.professionalReportAuthorized===false,'no authorization after revocation');
 // A privileged DBA could still compromise both local head and event tables,
 // so independent WORM anchoring, KMS and provider validation remain unproven.
 console.log('C73_2_REAL_POSTGRES_TRANSACTIONAL_CUSTODY=PASS checks='+checks);
 console.log('C73_2_OBJECT_VAULT_KMS_SOURCE_RIGHTS=HOLD');
 console.log('C73_2_PRODUCTION_APPROVAL=FALSE');
}
run().catch(e=>{console.error('C73_2_REAL_POSTGRES_TRANSACTIONAL_CUSTODY=FAIL',e);process.exitCode=1;})
 .finally(async()=>{if(app)await app.end();await admin.end();});
