'use strict';
const assert=require('node:assert/strict');
const {createHash,generateKeyPairSync,sign}=require('node:crypto');
const {GATES,DOMAIN:EVIDENCE_DOMAIN,FIELDS}=require('../../src/security/c73-external-readiness-approval-gate');
const {DOMAIN:ROOT_DOMAIN,verifyRootQuorumRegistry,verifyGovernedP0Packet}
 =require('../../src/security/c73-quorum-root-issuer-registry');
const NOW=()=>new Date('2026-10-08T23:00:00.000Z');
const SHA='a'.repeat(40),environment='saudi-qa-synthetic';
const gateIds=Object.keys(GATES);
const rootKeys=Array.from({length:3},()=>generateKeyPairSync('ed25519'));
const reviewerKeys=gateIds.map(()=>generateKeyPairSync('ed25519'));
const pub=x=>x.publicKey.export({type:'spki',format:'pem'});
const roots=Object.fromEntries(rootKeys.map((key,i)=>['root-'+i,pub(key)]));
const issuer=(g,i)=>({gateId:g,role:GATES[g],issuerId:'reviewer-'+i,publicKey:pub(reviewerKeys[i])});
const createManifest=()=>({
 version:1,epoch:12,environment,targetSha:SHA,
 issuedAt:'2026-10-08T00:00:00.000Z',
 expiresAt:'2026-10-20T00:00:00.000Z',
 issuers:gateIds.map(issuer),revokedIssuerIds:[],
});
const makeSignatures=(manifest,indices=[0,2])=>indices.map(i=>({
 rootId:'root-'+i,
 signature:sign(null,Buffer.from(ROOT_DOMAIN+JSON.stringify(manifest)),rootKeys[i].privateKey).toString('base64url'),
}));
const signClaim=(claim,i)=>sign(null,Buffer.from(EVIDENCE_DOMAIN+
 JSON.stringify(Object.fromEntries(FIELDS.map(k=>[k,claim[k]])))),reviewerKeys[i].privateKey).toString('base64url');
const originals=gateIds.map((gateId,i)=>{
 const evidenceBytes=Buffer.from('SYNTHETIC_P0_EVIDENCE_'+gateId);
 const claim={version:1,gateId,environment,targetSha:SHA,issuerId:'reviewer-'+i,
  role:GATES[gateId],evidenceHash:createHash('sha256').update(evidenceBytes).digest('hex'),
  issuedAt:'2026-10-08T01:00:00.000Z',expiresAt:'2026-10-15T00:00:00.000Z',
  decision:'APPROVE',nonce:Buffer.alloc(16,i+1).toString('base64url')};
 return {claim,signature:signClaim(claim,i),evidenceBytes};
});
const norm={pinnedRootKeys:roots,minimumEpoch:12,environment,targetSha:SHA,now:NOW};
const prove=(manifest,options={})=>verifyRootQuorumRegistry({
 ...norm,manifest,signatures:makeSignatures(manifest),...options,
});
let checks=0;
function ok(v,msg){assert.ok(v,msg);checks++;}
function rejected(code,transform,overrides={}){
 const m=createManifest();transform(m);
 const result=prove(m,overrides);
 ok(result.status==='HOLD_UNTRUSTED_P0_ROOT_REGISTRY',code+': HOLD');
 ok(result.reasonCodes.some(x=>x.startsWith(code)),code+': reason');
 ok(result.approvalForProduction===false&&result.transactionAuthorized===false,
  code+': non-authorizing');
}
function run(){
 const valid=createManifest(),q=prove(valid);
 ok(q.quorumVerified===true&&q.rootQuorumSignatureCount===2,'two distinct roots qualify synthetic registry');
 ok(q.status==='QUORUM_ROOT_POLICY_CRYPTO_VERIFIED_MANUAL_REVIEW_ONLY','quorum itself never GO');
 ok(Object.keys(q.policy).length===8,'all eight required licensed gates mapped');
 ok(q.approvalForProduction===false&&q.transactionAuthorized===false,'no raw trust registry launch authority');
 const packet=verifyGovernedP0Packet({...norm,manifest:valid,signatures:makeSignatures(valid),evidence:originals});
 ok(packet.status==='GOVERNED_P0_PACKET_CRYPTO_VERIFIED_HUMAN_GO_NO_GO_REQUIRED',
  'eight independently signed synthetic evidence items+dual-root manifest are manual only');
 ok(packet.verifiedEvidence.length===8&&packet.verifiedEvidence.every(x=>x.verified),
  'every original content digest revalidated');
 ok(packet.independentHumanGoNoGoRequired===true&&packet.approvalForProduction===false&&
 packet.professionalValuationAuthorized===false&&packet.transactionAuthorized===false,
 'all operational permissions remain false even at positive crypto status');
 const empty=verifyGovernedP0Packet({...norm,manifest:valid,signatures:makeSignatures(valid),evidence:[]});
 ok(empty.status==='HOLD_GOVERNED_P0_EVIDENCE'&&empty.approvalForProduction===false,
 'trusted roots alone cannot authorize empty external proof');
 rejected('REGISTRY_SHAPE_SCOPE_EPOCH_INVALID',m=>{m.epoch=11;});
 rejected('REGISTRY_SHAPE_SCOPE_EPOCH_INVALID',m=>{m.epoch=13;},
  {minimumEpoch:14});
 rejected('REGISTRY_SHAPE_SCOPE_EPOCH_INVALID',m=>{m.targetSha='f'.repeat(40);});
 rejected('REGISTRY_SHAPE_SCOPE_EPOCH_INVALID',m=>{m.environment='other';});
 rejected('REGISTRY_TIME_EXPIRED_OR_FUTURE',m=>{m.expiresAt='2026-10-08T22:00:00.000Z';});
 rejected('REGISTRY_TIME_EXPIRED_OR_FUTURE',m=>{m.issuedAt='2026-10-10T00:00:00.000Z';});
 rejected('REGISTRY_TIME_EXPIRED_OR_FUTURE',m=>{m.expiresAt='2026-12-15T00:00:00.000Z';});
 rejected('REGISTRY_SHAPE_SCOPE_EPOCH_INVALID',m=>{m.issuers.pop();});
 rejected('INVALID_REGISTRY_ISSUER',m=>{m.issuers[0].role='BOARD_RELEASE_AUTHORITY';});
 rejected('INVALID_REGISTRY_ISSUER',m=>{m.issuers[0].gateId='P0-XX';});
 rejected('DUPLICATE_GATE_OR_ISSUER',m=>{m.issuers[1].issuerId=m.issuers[0].issuerId;});
 rejected('DUPLICATE_GATE_OR_ISSUER',m=>{m.issuers[1].gateId=m.issuers[0].gateId;});
 rejected('NONINDEPENDENT_ISSUER_KEY',m=>{m.issuers[1].publicKey=m.issuers[0].publicKey;});
 rejected('REVOKED_ISSUER_PRESENT',m=>{m.revokedIssuerIds.push(m.issuers[0].issuerId);});
 rejected('INVALID_ISSUER_KEY',m=>{m.issuers[2].publicKey='fake-key';});
 rejected('INVALID_REGISTRY_ISSUER',m=>{m.issuers[1].productionAuthorized=true;});
 const old=createManifest();old.epoch=11;
 const oldSig=makeSignatures(old);
 const rollback=verifyRootQuorumRegistry({...norm,manifest:old,signatures:oldSig});
 ok(rollback.status==='HOLD_UNTRUSTED_P0_ROOT_REGISTRY',
  'correctly signed earlier root registry cannot beat outside minimumEpoch');
 const withheld=verifyRootQuorumRegistry({...norm,manifest:valid,signatures:[makeSignatures(valid)[0]]});
 ok(withheld.reasonCodes.includes('INVALID_ROOT_SIGNER_QUORUM_SET')&&
  withheld.quorumVerified===false,'one of three root signatures is insufficient');
 const dup=verifyRootQuorumRegistry({...norm,manifest:valid,
  signatures:makeSignatures(valid,[0,0])});
 ok(dup.reasonCodes.includes('ROOT_SIGNATURE_INVALID_OR_DUPLICATED'),'same root cannot vote twice');
 const forged=verifyRootQuorumRegistry({...norm,manifest:valid,
  signatures:[makeSignatures(valid)[0],{
   rootId:'root-2',signature:makeSignatures(valid)[0].signature
  }]});
 ok(forged.reasonCodes.includes('INVALID_ROOT_SIGNATURE'),'cannot relabel one root signature as another');
 const outsider=verifyRootQuorumRegistry({...norm,manifest:valid,
  signatures:[makeSignatures(valid)[0],{
   rootId:'attacker-root',signature:makeSignatures(valid)[1].signature
  }]});
 ok(outsider.reasonCodes.includes('UNPINNED_ROOT_SIGNER'),'untrusted external key cannot join quorum');
 const replacedRoots={...roots,'root-1':roots['root-0']};
 const cloned=prove(valid,{pinnedRootKeys:replacedRoots});
 ok(cloned.reasonCodes.includes('DUPLICATED_ROOT_KEY'),'root-persona cloning not independent');
 const emptyTrust=prove(valid,{pinnedRootKeys:{}});
 ok(emptyTrust.reasonCodes.includes('PINNED_ROOT_SET_INCOMPLETE'),'no pinning no quorum');
 const unsigned=prove(valid,{signatures:[]});
 ok(unsigned.quorumVerified===false,'unsigned registry no quorum');
 const manipulated=createManifest(),sigBefore=makeSignatures(manipulated);
 manipulated.issuers[0].publicKey=pub(generateKeyPairSync('ed25519'));
 const tampered=prove(manipulated,{signatures:sigBefore});
 ok(tampered.reasonCodes.includes('INVALID_ROOT_SIGNATURE'),
  'swapping registered reviewer key invalidates previously valid root signatures');
 const approvalSpoof={...originals[0],claim:{...originals[0].claim,decision:'APPROVE'}};
 const swapped=originals.slice();swapped[0]={...approvalSpoof,evidenceBytes:Buffer.from('FORGED_DOC')};
 const falseApproval=verifyGovernedP0Packet({...norm,manifest:valid,
  signatures:makeSignatures(valid),evidence:swapped});
 ok(falseApproval.status==='HOLD_GOVERNED_P0_EVIDENCE'&&
 falseApproval.reasonCodes.some(x=>x.includes('EVIDENCE_BYTE_HASH_MISMATCH')),
 'root-qualified issuer cannot change authentic evidence bytes');
 const active=createManifest();
 active.revokedIssuerIds=['reviewer-0'];
 const block=verifyGovernedP0Packet({...norm,manifest:active,
  signatures:makeSignatures(active),evidence:originals});
 ok(block.status==='HOLD_UNTRUSTED_P0_ROOT_REGISTRY',
 'latest root-signed revocation blocks previously valid reviewer signature');
 const wrongSha=verifyGovernedP0Packet({...norm,targetSha:'b'.repeat(40),
  manifest:valid,signatures:makeSignatures(valid),evidence:originals});
 ok(wrongSha.status==='HOLD_UNTRUSTED_P0_ROOT_REGISTRY',
 'signatures cannot be reused for a different release SHA');
 console.log('C73_5_QUORUM_OFFLINE_ROOT_REGISTRY=PASS checks='+checks);
 console.log('C73_5_SYNTHETIC_MANUAL_REVIEW_ONLY=TRUE');
 console.log('C73_5_EXTERNAL_ROOT_CONTROL_PRODUCTION_GO_LIVE=HOLD');
}
try{run();}catch(e){console.error('C73_5_QUORUM_OFFLINE_ROOT_REGISTRY=FAIL',e);process.exitCode=1;}
