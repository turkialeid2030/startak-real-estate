'use strict';
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const {makeCustodyAppendCoordinator}=require('../../src/market/custody-append-coordinator');
const {verifyCustodyChain}=require('../../src/market/signed-evidence-custody');
const {makePrivateAppraisalVault}=require('../../src/market/private-appraisal-evidence-vault');
const {privateKey,publicKey}=crypto.generateKeyPairSync('ed25519'),bytes=Buffer.from('synthetic custody append'),sha256=crypto.createHash('sha256').update(bytes).digest('hex');
const scope={tenantId:'SYNTH-TENANT',caseRef:'SYNTH-CASE',evidenceRef:'SYNTH-EVID',sha256};
let ledger=null,checkpoint=null,now='2026-09-01T00:00:00Z',witnessAvailable=true;
const actor={id:'REVIEWER'},admin={id:'ADMIN'};
const resolveSigner=async({tenantId,signerKeyRef})=>({tenantId,signerKeyRef,publicKey,purpose:'EVIDENCE_CUSTODY_SIGNING',revoked:false,validFrom:'2026-01-01',validUntil:'2026-12-31'});
const cfg={authorizeActor:async({requestActor,tenantId,caseRef})=>tenantId===scope.tenantId&&caseRef===scope.caseRef&&(requestActor===actor||requestActor===admin)?{verifiedByServer:true,actorId:requestActor.id,tenantId,caseRefs:[caseRef],role:requestActor===admin?'DATA_ADMIN':'REVIEWER'}:null,loadLedger:async()=>ledger,loadCheckpoint:async()=>checkpoint,resolveSigner,signEvent:async({bytes})=>crypto.sign(null,bytes,privateKey).toString('base64'),compareAndAppend:async({expectedRevision,expectedHeadHashSha256,candidate})=>{if((ledger?.events.length??0)!==expectedRevision||(checkpoint?.headHashSha256??null)!==expectedHeadHashSha256)return false;ledger=candidate;return true;},advanceWitness:async({expectedRevision,expectedHeadHashSha256,nextCheckpoint})=>{if(!witnessAvailable||(checkpoint?.revision??0)!==expectedRevision||(checkpoint?.headHashSha256??null)!==expectedHeadHashSha256)return false;checkpoint=nextCheckpoint;return true;},clock:()=>new Date(now)};
const app=makeCustodyAppendCoordinator(cfg),call=(kind,patch={})=>app.append({actor,scope,kind,sourceBytes:bytes,signerKeyRef:'SYNTH-SIGNER',...patch});
async function main(){
 assert.equal((await call('SEALED',{sourceBytes:Buffer.from('wrong')})).reason,'CUSTODY_APPEND_BYTES_MISMATCH');
 assert.equal((await call('SEALED',{actor:{id:'REVIEWER'}})).reason,'CUSTODY_APPEND_ACCESS_DENIED');
 assert.equal((await call('SEALED')).revision,1);
 assert.equal((await call('SEALED')).status,'HOLD_CUSTODY_APPEND');
 assert.equal((await call('RECHECKED')).status,'HOLD_CUSTODY_APPEND');
 now='2026-09-02T00:00:00Z';const concurrent=await Promise.all([call('RECHECKED'),call('RECHECKED')]);
 assert.equal(concurrent.filter(x=>x.status==='CUSTODY_APPEND_CONFIRMED_BY_PROVIDERS').length,1);
 assert.equal(checkpoint.revision,2);
 assert.equal((await call('REVOKED')).reason,'CUSTODY_APPEND_ACCESS_DENIED');
 now='2026-09-03T00:00:00Z';witnessAvailable=false;
 assert.equal((await call('RECHECKED')).reason,'CUSTODY_APPEND_WITNESS_PENDING');
 assert.equal(ledger.events.length,3);assert.equal(checkpoint.revision,2);
 assert.equal((await verifyCustodyChain(ledger,{expectedScope:scope,checkpoint,resolveSigner,now,maxAgeSeconds:86400})).integrityVerified,false);
 now='2026-09-04T00:00:00Z';assert.equal((await call('RECHECKED')).reason,'CUSTODY_APPEND_CURRENT_HEAD_NOT_QUALIFIED');
 // Simulated authorized reconciliation of the witness, not automatic rollback.
 const {VERSION,custodyEventHash}=require('../../src/market/signed-evidence-custody'),last=ledger.events.at(-1);
 checkpoint={version:VERSION,scope,revision:3,headHashSha256:custodyEventHash(scope,last.event,last.signature)};witnessAvailable=true;
 assert.equal((await call('REVOKED',{actor:admin})).revoked,true);
 assert.equal((await call('RECHECKED')).status,'HOLD_CUSTODY_APPEND');
 const adapter={get:async()=>null,putIfAbsent:async()=>true};
 assert.throws(()=>makePrivateAppraisalVault({adapter,keyProvider:()=>crypto.randomBytes(32),authorizeActor:cfg.authorizeActor,requireStrictCustody:true}),/STRICT_CUSTODY_TRUST_DEPENDENCIES_REQUIRED/);
 console.log('CUSTODY_APPEND_COORDINATOR=PASS synthetic=true production=false');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
