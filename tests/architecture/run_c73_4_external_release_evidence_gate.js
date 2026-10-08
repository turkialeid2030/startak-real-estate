'use strict';
const assert=require('node:assert/strict');
const {createHash,generateKeyPairSync,sign}=require('node:crypto');
const {GATES,DOMAIN,FIELDS,verifyExternalReadinessEvidence}
 =require('../../src/security/c73-external-readiness-approval-gate');
const DATE='2026-10-08T18:00:00.000Z';
const NOW=()=>new Date(DATE);
const SHA='a'.repeat(40),env='saudi-qa-synthetic';
const ids=Object.keys(GATES);
const keys=ids.map(()=>generateKeyPairSync('ed25519'));
const config=Object.fromEntries(ids.map((gateId,i)=>[
 'reviewer-'+i,{
 gateId,role:GATES[gateId],
 publicKey:keys[i].publicKey.export({type:'pem',format:'spki'}),
 },
]));
function signature(p,i){
 const content=Buffer.from(DOMAIN+JSON.stringify(Object.fromEntries(FIELDS.map(k=>[k,p[k]]))));
 return sign(null,content,keys[i].privateKey).toString('base64url');
}
function specimen(i){
 const gateId=ids[i],evidenceBytes=Buffer.from('EXCLUSIVELY_SYNTHETIC_UNSIGNED_IN_REAL_WORLD_GATE_'+gateId);
 const claim={
  version:1,gateId,environment:env,targetSha:SHA,
  issuerId:'reviewer-'+i,role:GATES[gateId],
  evidenceHash:createHash('sha256').update(evidenceBytes).digest('hex'),
  issuedAt:'2026-10-07T18:00:00.000Z',
  expiresAt:'2026-11-07T18:00:00.000Z',
  decision:'APPROVE',nonce:Buffer.alloc(16,i+1).toString('base64url'),
 };
 return {claim,signature:signature(claim,i),evidenceBytes};
}
const originals=ids.map((_,i)=>specimen(i));
let checks=0;
function check(v,message){assert.ok(v,message);checks++;}
function assess(items=originals,policy=config,head=SHA){
 return verifyExternalReadinessEvidence({environment:env,targetSha:head,
  evidence:items,trustPolicy:policy,now:NOW});
}
function negative(expected,change,policy=config){
 const docs=originals.map(x=>({...x,claim:{...x.claim},evidenceBytes:Buffer.from(x.evidenceBytes)}));
 change(docs);
 const status=assess(docs,policy);
 check(status.status==='HOLD_EXTERNAL_P0_EVIDENCE',expected+': HOLD');
 check(status.reasonCodes.some(x=>x.startsWith(expected)),expected+': reason');
 check(status.approvalForProduction===false&&status.transactionAuthorized===false,
  expected+': fail-closed');
}
const rebuilt=(items,i)=>{items[i].signature=signature(items[i].claim,i)};
function run(){
 const none=assess([]);
 check(none.status==='HOLD_EXTERNAL_P0_EVIDENCE','empty P0 holds');
 check(none.reasonCodes.filter(x=>x.startsWith('MISSING_GATE:')).length===8,
  'all eight mandatory P0 owners needed');
 const base=assess();
 check(base.status==='CRYPTOGRAPHIC_P0_EVIDENCE_VERIFIED_MANUAL_GO_NO_GO_REQUIRED',
  'valid synthetic signed metadata is human review ONLY');
 check(base.verifiedEvidence.length===8&&base.verifiedEvidence.every(x=>x.verified),
  'all eight independently signed byte hashes verified');
 check(base.approvalForProduction===false&&
  base.professionalValuationAuthorized===false&&
  base.transactionAuthorized===false,'positive cryptographic test never grants operational authority');
 check(base.externalApprovalsIndependentlyConfirmedByThisModule===false&&
  base.independentHumanGoNoGoRequired===true,'no fabricated external attestation');
 negative('EVIDENCE_BYTE_HASH_MISMATCH',a=>{a[0].evidenceBytes[8]^=1;});
 negative('SIGNATURE_INVALID',a=>{a[0].signature=(a[0].signature[0]==='A'?'B':'A')+a[0].signature.slice(1);});
 negative('SIGNATURE_INVALID',a=>{a[0].claim.issuedAt='2026-10-06T18:00:00.000Z';});
 negative('EVIDENCE_SCOPE_MISMATCH',a=>{a[1].claim.environment='other-tenancy';rebuilt(a,1);});
 negative('EVIDENCE_SCOPE_MISMATCH',a=>{a[1].claim.targetSha='b'.repeat(40);rebuilt(a,1);});
 negative('EVIDENCE_EXPIRED_OR_UNTRUSTED_TIME',a=>{
  a[2].claim.expiresAt='2026-10-08T00:00:00.000Z';rebuilt(a,2);
 });
 negative('EVIDENCE_EXPIRED_OR_UNTRUSTED_TIME',a=>{
  a[2].claim.issuedAt='2026-10-09T18:00:00.000Z';rebuilt(a,2);
 });
 negative('EVIDENCE_EXPIRED_OR_UNTRUSTED_TIME',a=>{
  a[2].claim.expiresAt='2027-10-07T18:00:00.000Z';rebuilt(a,2);
 });
 negative('INVALID_CLAIM_FIELDS',a=>{a[0].claim.decision='HOLD';rebuilt(a,0);});
 negative('INVALID_CLAIM_FIELDS',a=>{a[0].claim.role=GATES['P0-B'];rebuilt(a,0);});
 negative('INVALID_EVIDENCE_SCHEMA',a=>{a[0].claim.sourceRightsVerified=true;});
 negative('INVALID_EVIDENCE_SCHEMA',a=>{a[0].productionApproved=true;});
 negative('DUPLICATE_GATE',a=>{a[0]={...a[1],claim:{...a[1].claim}};});
 negative('UNTRUSTED_ISSUER_OR_ROLE',a=>{
  a[1].claim.issuerId='reviewer-0';a[1].signature=signature(a[1].claim,0);
 },{...config,'reviewer-0':{...config['reviewer-0']}}); // unauthorized gate role denies first
 // Actual signer clone attack (same physical Ed25519 key, different configured issuer).
 const policy2={...config,'reviewer-1':{...config['reviewer-1'],
  publicKey:config['reviewer-0'].publicKey}};
 const changed=originals.map(x=>({...x,claim:{...x.claim}}));
 changed[1].signature=signature(changed[1].claim,0);
 const duplicated=assess(changed,policy2);
 check(duplicated.status==='HOLD_EXTERNAL_P0_EVIDENCE','shared signer key cannot count for two independent reviewers');
 check(duplicated.reasonCodes.includes('NOT_INDEPENDENT_SIGNERS:P0-B'),'distinct independent key required');
 negative('UNTRUSTED_ISSUER_OR_ROLE',a=>{a[1].claim.issuerId='pretend-reviewer';rebuilt(a,1);});
 negative('EVIDENCE_BYTES_NOT_FETCHED',a=>{a[1].evidenceBytes=null;});
 negative('EVIDENCE_BYTES_LIMIT',a=>{a[1].evidenceBytes=Buffer.alloc(0);});
 negative('INVALID_CLAIM_FIELDS',a=>{a[1].claim.nonce='replay';rebuilt(a,1);});
 negative('INVALID_EVIDENCE_SCHEMA',a=>{a[3].claim.gateId='P0-Z';rebuilt(a,3);});
 negative('INVALID_ISSUER_KEY',a=>{}, {...config,'reviewer-5':{
  ...config['reviewer-5'],publicKey:'not-a-public-key',
 }});
 negative('SIGNATURE_INVALID',a=>{}, {...config,'reviewer-6':{
  ...config['reviewer-6'],publicKey:keys[0].publicKey.export({type:'pem',format:'spki'}),
 }});
 check(assess(originals,{},SHA).status==='HOLD_EXTERNAL_P0_EVIDENCE',
  'no trusted independently pinned roots -> HOLD');
 check(assess(originals,config,'f'.repeat(40)).status==='HOLD_EXTERNAL_P0_EVIDENCE',
  'a different exact commit cannot inherit approvals');
 // Replayed complete packet is denied even when separately presented twice.
 const duplicate=assess([...originals,originals[0]]);
 check(duplicate.status==='HOLD_EXTERNAL_P0_EVIDENCE'&&
  duplicate.reasonCodes.some(x=>x.includes('DUPLICATE_GATE:')),
  'signed evidence repeated as a second gate is not accepted');
 console.log('C73_4_EXTERNAL_SIGNED_P0_GATE=PASS checks='+checks);
 console.log('C73_4_SYNTHETIC_POSITIVE_STATUS=MANUAL_REVIEW_ONLY');
 console.log('C73_4_PRODUCTION_APPROVED=FALSE');
}
try{run();}catch(e){console.error('C73_4_EXTERNAL_SIGNED_P0_GATE=FAIL',e);process.exitCode=1;}
