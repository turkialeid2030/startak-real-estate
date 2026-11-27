'use strict';
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const {VERSION,witnessReceiptBytes,makeVerifiedWitnessCheckpointProvider}=require('../../src/market/signed-witness-checkpoint');
const {VERSION:CUSTODY_VERSION}=require('../../src/market/signed-evidence-custody');
const kp=crypto.generateKeyPairSync('ed25519'),wrong=crypto.generateKeyPairSync('ed25519');
const s={tenantId:'TENANT-A',caseRef:'CASE-A',evidenceRef:'EVID-A',sha256:'a'.repeat(64)},head='b'.repeat(64);
let revision=0,mode='ok',last=null,now='2026-09-01T00:00:00Z';
const provider=makeVerifiedWitnessCheckpointProvider({clock:()=>new Date(now),loadReceipt:async({scope,challenge})=>{
 if(mode==='network')throw Error('unavailable');if(mode==='null')return null;if(mode==='replay')return last;
 let receipt={version:VERSION,scope,challenge,revision,headHashSha256:revision?head:null,observedAt:now,signerKeyRef:'WITNESS-A'};
 if(mode==='scope')receipt.scope={...scope,caseRef:'CASE-B'};
 if(mode==='stale')receipt.observedAt='2026-08-31T23:59:59Z';
 if(mode==='future')receipt.observedAt='2026-09-01T00:00:01Z';
 const signed={receipt,signature:crypto.sign(null,witnessReceiptBytes(receipt),mode==='wrong-key'?wrong.privateKey:kp.privateKey).toString('base64')};
 if(mode==='tamper')signed.receipt={...receipt,headHashSha256:'c'.repeat(64)};
 last=signed;return signed;
},resolveWitnessSigner:async({tenantId,signerKeyRef})=>({tenantId,signerKeyRef,purpose:mode==='wrong-purpose'?'EVIDENCE_CUSTODY_SIGNING':'EVIDENCE_WITNESS_SIGNING',revoked:mode==='revoked',publicKey:kp.publicKey,validFrom:'2026-01-01',validUntil:'2026-12-31'})});
async function main(){
 assert.equal(await provider.loadCheckpoint(s),null);revision=1;
 assert.deepEqual(await provider.loadCheckpoint(s),{version:CUSTODY_VERSION,scope:s,revision:1,headHashSha256:head});
 for(const m of ['replay','network','null','scope','stale','future','wrong-key','tamper','wrong-purpose','revoked']){mode=m;await assert.rejects(()=>provider.loadCheckpoint(s));}
 mode='ok';revision=0;assert.equal(await provider.loadCheckpoint(s),null);assert.equal(provider.productionWitnessVerified,false);
 console.log('SIGNED_WITNESS_CHECKPOINT=PASS synthetic=true production=false');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
