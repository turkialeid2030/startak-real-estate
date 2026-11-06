'use strict';
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const {makePrivateAppraisalVault}=require('../../src/market/private-appraisal-evidence-vault');
const map=new Map(),key=crypto.randomBytes(32);
const adapter={get:async id=>map.has(id)?map.get(id):null,
 putIfAbsent:async(id,v)=>{if(map.has(id))return false;map.set(id,v);return true;}};
const identities={
 reviewer:{actorId:'SYN-REVIEWER',tenantId:'t1',role:'REVIEWER',caseRefs:['CASE-A'],verifiedByServer:true},
 admin:{actorId:'SYN-ADMIN',tenantId:'t1',role:'DATA_ADMIN',caseRefs:['CASE-A'],verifiedByServer:true},
 auditor:{actorId:'SYN-AUDITOR',tenantId:'t1',role:'AUDITOR',caseRefs:['CASE-A'],verifiedByServer:true},
 viewer:{actorId:'SYN-VIEWER',tenantId:'t1',role:'VIEWER',caseRefs:['CASE-A'],verifiedByServer:true},
 wrongTenant:{actorId:'SYN-OTHER',tenantId:'t2',role:'REVIEWER',caseRefs:['CASE-A'],verifiedByServer:true},
 wrongCase:{actorId:'SYN-WRONG-CASE',tenantId:'t1',role:'REVIEWER',caseRefs:['CASE-B'],verifiedByServer:true},
};
const authorizeActor=async({requestActor})=>identities[requestActor?.sessionRef]||null;
const makeActor=sessionRef=>({sessionRef});
const v=makePrivateAppraisalVault({adapter,keyProvider:()=>key,authorizeActor,
 clock:()=>new Date('2026-05-01T00:00:00Z')});
const original=Buffer.from('synthetic document no client private data');
const sha=crypto.createHash('sha256').update(original).digest('hex');
let n=0;async function t(label,f){await f();n++;console.log('PASS '+label);}
const put=(actor=makeActor('reviewer'),other={})=>v.put({actor,tenantId:'t1',
 caseRef:'CASE-A',evidenceRef:'E-01',sourceBytes:original,expectedSha256:sha,...other});
const read=(actor=makeActor('reviewer'),other={})=>v.read({actor,tenantId:'t1',
 caseRef:'CASE-A',evidenceRef:'E-01',...other});
(async()=>{
 await t('a trusted authorizer is mandatory, not a caller boolean',async()=>{
  assert.throws(()=>makePrivateAppraisalVault({adapter,keyProvider:()=>key}),
    /SERVER_AUTHORIZER_REQUIRED/);
  await assert.rejects(put({sessionRef:'unknown',authenticatedByTrustedBackend:true,
    tenantId:'t1',actorId:'fake',role:'DATA_ADMIN',caseRefs:['CASE-A']}),/ACCESS_DENIED/);
 });
 await t('faked admin actor cannot authorize read/write',async()=>{
  await assert.rejects(put({authenticatedByTrustedBackend:true,tenantId:'t1',role:'DATA_ADMIN',
    actorId:'FRAUD',caseRefs:['CASE-A']}),/ACCESS_DENIED/);
 });
 await t('source SHA mismatch rejects evidence intake',async()=>{
  await assert.rejects(put(makeActor('reviewer'),{expectedSha256:'a'.repeat(64)}),
    /DIGEST_MISMATCH/);
 });
 await t('sealed envelope has no plaintext client content',async()=>{
  const r=await put();assert.equal(r.status,'SEALED_UNVERIFIED');
  assert.ok(![...map.values()][0].includes(original.toString('utf8')));
 });
 await t('authorized reviewer can decrypt and verify SHA',async()=>{
  const r=await read();assert.deepEqual(r.sourceBytes,original);
  assert.equal(r.professionalReviewVerified,false);
 });
 await t('tenant isolation is verified by server-supplied identity',async()=>{
  await assert.rejects(read(makeActor('wrongTenant')),/ACCESS_DENIED/);
 });
 await t('case authorization is independent of same-tenant identity',async()=>{
  await assert.rejects(read(makeActor('wrongCase')),/ACCESS_DENIED/);
 });
 await t('even authorized reviewer cannot reuse case B as a read locator',async()=>{
  const foreignCaseReader=makePrivateAppraisalVault({adapter,keyProvider:()=>key,
   authorizeActor:async()=>({...identities.reviewer,caseRefs:['CASE-B']})});
  await assert.rejects(foreignCaseReader.read({actor:makeActor('reviewer'),tenantId:'t1',
    caseRef:'CASE-B',evidenceRef:'E-01'}),/CASE_SCOPE_MISMATCH/);
 });
 await t('viewer cannot decrypt',async()=>{
  await assert.rejects(read(makeActor('viewer')),/ACCESS_DENIED/);
 });
 await t('record is immutable; admin cannot overwrite existing ref',async()=>{
  await assert.rejects(put(makeActor('admin')),/IMMUTABLE_REF/);
 });
 await t('ciphertext tampering detected',async()=>{
  const entry=[...map.entries()][0],json=JSON.parse(entry[1]);
  json.ciphertext=Buffer.from('attack').toString('base64');map.set(entry[0],JSON.stringify(json));
  await assert.rejects(read(makeActor('auditor')),/INTEGRITY_FAILED/);
 });
 await t('revocation by server-side identity resolver is immediate',async()=>{
  const noPermission=makePrivateAppraisalVault({adapter,keyProvider:()=>key,
   authorizeActor:async()=>null});
  await assert.rejects(noPermission.read({actor:makeActor('reviewer'),tenantId:'t1',
   caseRef:'CASE-A',evidenceRef:'E-01'}),/ACCESS_DENIED/);
 });
 console.log('PRIVATE_VAULT_CONTRACT_TESTS='+n+'/'+n);
})().catch(e=>{console.error(e);process.exitCode=1;});
