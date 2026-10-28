'use strict';
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const {makePrivateAppraisalVault}=require('../../src/market/private-appraisal-evidence-vault');
const map=new Map(),key=crypto.randomBytes(32);
const adapter={get:async id=>map.has(id)?map.get(id):null,put:async(id,v)=>map.set(id,v)};
const makeActor=(tenantId,role,authenticatedByTrustedBackend=true)=>({
 tenantId,role,authenticatedByTrustedBackend,actorId:'SYN-REVIEWER'});
const v=makePrivateAppraisalVault({adapter,keyProvider:()=>key,clock:()=>new Date('2026-05-01T00:00:00Z')});
const original=Buffer.from('synthetic document no client private data');
const sha=crypto.createHash('sha256').update(original).digest('hex');
let n=0;async function t(label,f){await f();n++;console.log('PASS '+label);}
(async()=>{
 await t('unauthenticated writes rejected',async()=>{
  await assert.rejects(v.put({actor:makeActor('t1','REVIEWER',false),tenantId:'t1',caseRef:'CASE-A',
   evidenceRef:'E-01',sourceBytes:original,expectedSha256:sha}),/ACCESS_DENIED/);
 });
 await t('source SHA mismatch rejects evidence intake',async()=>{
  await assert.rejects(v.put({actor:makeActor('t1','REVIEWER'),tenantId:'t1',caseRef:'CASE-A',
   evidenceRef:'E-01',sourceBytes:original,expectedSha256:'a'.repeat(64)}),/DIGEST_MISMATCH/);
 });
 await t('sealed envelope has no plaintext client content',async()=>{
  const r=await v.put({actor:makeActor('t1','REVIEWER'),tenantId:'t1',caseRef:'CASE-A',
   evidenceRef:'E-01',sourceBytes:original,expectedSha256:sha});
  assert.equal(r.status,'SEALED_UNVERIFIED');
  assert.ok(![...map.values()][0].includes(original.toString('utf8')));
 });
 await t('authorized reviewer can decrypt and verify source digest',async()=>{
  const r=await v.read({actor:makeActor('t1','REVIEWER'),tenantId:'t1',evidenceRef:'E-01'});
  assert.deepEqual(r.sourceBytes,original);assert.equal(r.professionalReviewVerified,false);
 });
 await t('tenant isolation denies access to a different tenant',async()=>{
  await assert.rejects(v.read({actor:makeActor('t2','REVIEWER'),tenantId:'t1',evidenceRef:'E-01'}),/ACCESS_DENIED/);
 });
 await t('viewer cannot decrypt',async()=>{
  await assert.rejects(v.read({actor:makeActor('t1','VIEWER'),tenantId:'t1',evidenceRef:'E-01'}),/ACCESS_DENIED/);
 });
 await t('record is immutable and cannot be overwritten',async()=>{
  await assert.rejects(v.put({actor:makeActor('t1','DATA_ADMIN'),tenantId:'t1',caseRef:'CASE-A',
   evidenceRef:'E-01',sourceBytes:original,expectedSha256:sha}),/IMMUTABLE_REF/);
 });
 await t('ciphertext tampering detected',async()=>{
  const entry=[...map.entries()][0],json=JSON.parse(entry[1]);
  json.ciphertext=Buffer.from('attack').toString('base64');map.set(entry[0],JSON.stringify(json));
  await assert.rejects(v.read({actor:makeActor('t1','AUDITOR'),tenantId:'t1',evidenceRef:'E-01'}),/INTEGRITY_FAILED/);
 });
 console.log('PRIVATE_VAULT_CONTRACT_TESTS='+n+'/'+n);
})().catch(e=>{console.error(e);process.exitCode=1;});
