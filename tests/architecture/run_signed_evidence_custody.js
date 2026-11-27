'use strict';
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const {VERSION,custodyEventBytes,custodyEventHash,verifyCustodyChain}=require('../../src/market/signed-evidence-custody');
const {makePrivateAppraisalVault}=require('../../src/market/private-appraisal-evidence-vault');
const first=crypto.generateKeyPairSync('ed25519'),second=crypto.generateKeyPairSync('ed25519'),bytes=Buffer.from('synthetic evidence custody'),sha256=crypto.createHash('sha256').update(bytes).digest('hex');
const scope={tenantId:'SYNTH-TENANT',caseRef:'SYNTH-CASE',evidenceRef:'SYNTH-EVID',sha256},now=new Date('2026-09-04T00:00:00Z');
const keys=new Map([['SIGNER-1',{...first,validFrom:'2026-01-01',validUntil:'2026-09-02'}],['SIGNER-2',{...second,validFrom:'2026-09-02',validUntil:'2026-12-31'}]]);
let revokedKey=null;
const resolveSigner=async({tenantId,signerKeyRef})=>{const k=keys.get(signerKeyRef);return k?{tenantId,signerKeyRef,purpose:'EVIDENCE_CUSTODY_SIGNING',revoked:signerKeyRef===revokedKey,publicKey:k.publicKey,validFrom:k.validFrom,validUntil:k.validUntil}:null;};
function append(ledger,kind,time,keyRef='SIGNER-2'){
 const events=ledger?.events??[],prev=events.at(-1),event={sequence:events.length+1,kind,actorRef:'SYNTH-ACTOR',observedAt:time,signerKeyRef:keyRef,previousHashSha256:prev?custodyEventHash(scope,prev.event,prev.signature):null};
 const signature=crypto.sign(null,custodyEventBytes(scope,event),keys.get(keyRef).privateKey).toString('base64');
 return {version:VERSION,scope,events:[...events,{event,signature}]};
}
const one=append(null,'SEALED','2026-09-01','SIGNER-1'),two=append(one,'RECHECKED','2026-09-03'),revoked=append(two,'REVOKED','2026-09-03T12:00:00Z');
function checkpoint(ledger){const last=ledger.events.at(-1);return {version:VERSION,scope,revision:ledger.events.length,headHashSha256:custodyEventHash(scope,last.event,last.signature)};}
let ledger=two,head=checkpoint(two);
const opts=()=>({expectedScope:scope,checkpoint:head,resolveSigner,now,maxAgeSeconds:172800});
const verify=(l=ledger,o=opts())=>verifyCustodyChain(l,o);
const map=new Map(),adapter={get:async k=>map.get(k)??null,putIfAbsent:async(k,v)=>{if(map.has(k))return false;map.set(k,v);return true;}};
const key=crypto.randomBytes(32),actor={id:'SYNTH-ACTOR'},authorizeActor=async({requestActor,tenantId,caseRef})=>requestActor===actor&&tenantId===scope.tenantId&&caseRef===scope.caseRef?{tenantId,caseRefs:[caseRef],actorId:actor.id,role:'REVIEWER',verifiedByServer:true}:null;
const vault=makePrivateAppraisalVault({adapter,keyProvider:()=>key,authorizeActor,custodyTrust:{loadLedger:async()=>ledger,loadCheckpoint:async()=>head,resolveSigner,maxAgeSeconds:172800},clock:()=>now});
async function main(){
 const ok=await verify();assert.equal(ok.status,'CUSTODY_INTEGRITY_MATCHED');assert.equal(ok.revision,2);assert.equal(ok.releaseAuthorized,false);assert.equal(ok.productionVaultReady,false);
 assert.equal((await verify(one)).integrityVerified,false);
 assert.equal((await verify(two,{...opts(),checkpoint:null})).integrityVerified,false);
 assert.equal((await verify(two,{...opts(),checkpoint:{...head,headHashSha256:'0'.repeat(64)}})).integrityVerified,false);
 assert.equal((await verify({...two,scope:{...scope,tenantId:'OTHER'}})).integrityVerified,false);
 assert.equal((await verify({...two,events:[two.events[0],{...two.events[1],event:{...two.events[1].event,actorRef:'OTHER'}}]})).integrityVerified,false);
 assert.equal((await verify(two,{...opts(),maxAgeSeconds:1})).reason,'CUSTODY_STALE');
 revokedKey='SIGNER-1';assert.equal((await verify()).integrityVerified,false);revokedKey=null;
 head=checkpoint(revoked);assert.equal((await verify(revoked)).reason,'CUSTODY_REVOKED');
 const after=append(revoked,'RECHECKED','2026-09-03T13:00:00Z');head=checkpoint(after);assert.equal((await verify(after)).integrityVerified,false);
 const future=append(two,'RECHECKED','2026-09-05');head=checkpoint(future);assert.equal((await verify(future)).integrityVerified,false);
 head=checkpoint(two);
 let reads=0;const getter=Object.defineProperty({...two},'events',{enumerable:true,get(){reads++;return two.events;}});assert.equal((await verify(getter)).integrityVerified,false);assert.equal(reads,0);
 await vault.put({...scope,actor,sourceBytes:bytes,expectedSha256:sha256});
 const result=await vault.read({...scope,actor});assert.deepEqual(result.sourceBytes,bytes);assert.equal(result.custodyIntegrityVerified,true);assert.equal(result.custodyRevision,2);assert.equal(result.releaseAuthorized,false);
 ledger=one;await assert.rejects(()=>vault.read({...scope,actor}),/EVIDENCE_CUSTODY_NOT_QUALIFIED/);
 ledger=revoked;head=checkpoint(revoked);await assert.rejects(()=>vault.read({...scope,actor}),/EVIDENCE_CUSTODY_NOT_QUALIFIED/);
 ledger=two;head=null;await assert.rejects(()=>vault.read({...scope,actor}),/EVIDENCE_CUSTODY_NOT_QUALIFIED/);
 head=checkpoint(two);assert.equal((await vault.read({...scope,actor})).custodyIntegrityVerified,true);
 console.log('SIGNED_EVIDENCE_CUSTODY_CHAIN_AND_VAULT=PASS synthetic=true production=false');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
