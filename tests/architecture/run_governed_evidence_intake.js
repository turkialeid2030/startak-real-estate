'use strict';
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const {makeGovernedEvidenceIntake}=require('../../src/market/governed-evidence-intake');
const bytes=Buffer.from('synthetic intake'),sha256=crypto.createHash('sha256').update(bytes).digest('hex');
const scope={tenantId:'TENANT-A',caseRef:'CASE-A',evidenceRef:'EVID-A',sha256},actor={id:'ACTOR-A'},head='a'.repeat(64);
let puts=0,appends=0,reads=0,mode='ok',stored=null,returned=null;
const vault={put:async x=>{puts++;if(mode==='put-fail')throw Error('private error');stored=Buffer.from(x.sourceBytes);return {...scope,status:'SEALED_UNVERIFIED',professionalValueReleaseAuthorized:false};},read:async()=>{reads++;returned=Buffer.from(stored);return {found:true,custodyIntegrityVerified:mode!=='no-proof',custodyRevision:1,custodyHeadHashSha256:head,sha256,caseRef:scope.caseRef,sourceBytes:returned,releaseAuthorized:false};}};
const coordinator={append:async x=>{appends++;assert.deepEqual(x.sourceBytes,bytes);return mode==='witness-fail'?{status:'HOLD_CUSTODY_APPEND'}:{status:'CUSTODY_APPEND_CONFIRMED_BY_PROVIDERS',revision:1,headHashSha256:head,revoked:false};}};
const intake=makeGovernedEvidenceIntake({vault,custodyCoordinator:coordinator,signerKeyRef:'SIGNER-A'});
const run=(patch={})=>intake.seal({...scope,actor,sourceBytes:bytes,expectedSha256:sha256,...patch});
async function main(){
 assert.equal((await run({expectedSha256:'0'.repeat(64)})).reason,'SOURCE_DIGEST_MISMATCH');assert.equal(puts,0);
 mode='put-fail';assert.equal((await run()).reason,'ENVELOPE_NOT_CONFIRMED_OR_ALREADY_EXISTS');assert.equal(appends,0);
 mode='witness-fail';assert.equal((await run()).reason,'SEALED_ENVELOPE_CUSTODY_PENDING');assert.equal(reads,0);
 mode='no-proof';assert.equal((await run()).reason,'READBACK_NOT_CONFIRMED');assert.ok(returned.every(x=>x===0));
 mode='ok';const mutable=Buffer.from(bytes),pending=run({sourceBytes:mutable});mutable.fill(0);
 const success=await pending;assert.equal(success.status,'INTAKE_WITNESSED_AND_READBACK_MATCHED');assert.equal(success.productionReady,false);assert.equal(success.releaseAuthorized,false);assert.ok(returned.every(x=>x===0));
 console.log('GOVERNED_EVIDENCE_INTAKE=PASS synthetic=true production=false');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
