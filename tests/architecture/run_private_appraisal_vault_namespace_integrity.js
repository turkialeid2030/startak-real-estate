'use strict';
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const {makePrivateAppraisalVault}=require('../../src/market/private-appraisal-evidence-vault');
const map=new Map(),key=crypto.randomBytes(32),originalKey=Buffer.from(key);
const adapter={get:async k=>map.get(k)??null,putIfAbsent:async(k,v)=>{if(map.has(k))return false;map.set(k,v);return true;}};
const actor={id:'SYNTH-ACTOR'},base={actor,tenantId:'tenant-aa',evidenceRef:'evidence-1',caseRef:'case-1'};
const authorizer=async({requestActor,tenantId,caseRef})=>requestActor===actor?{verifiedByServer:true,actorId:'SYNTH-ACTOR',tenantId,caseRefs:[caseRef],role:'REVIEWER'}:null;
const vault=makePrivateAppraisalVault({adapter,keyProvider:()=>key,authorizeActor:authorizer,clock:()=>new Date('2026-09-01')});
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
const payload=Buffer.from('synthetic private appraisal');
async function put(scope,b=payload){return vault.put({...scope,sourceBytes:b,expectedSha256:digest(b)});}
async function main(){
 await put(base);assert.deepEqual((await vault.read(base)).sourceBytes,payload);
 assert.deepEqual(key,originalKey);assert.equal(vault.institutionalDeploymentVerified,false);
 await assert.rejects(()=>put(base),/IMMUTABLE_REF_ALREADY_EXISTS/);
 await assert.rejects(()=>vault.read({...base,actor:{...actor}}),/ACCESS_DENIED/);
 await assert.rejects(()=>vault.read({...base,caseRef:'other-case'}),/CASE_SCOPE_MISMATCH/);
 const a={...base,tenantId:'tenant:aa',evidenceRef:'bb'},b={...base,tenantId:'tenant',evidenceRef:'aa:bb'};
 await put(a);await put(b);assert.equal(map.size,3);
 assert.deepEqual((await vault.read(a)).sourceBytes,payload);assert.deepEqual((await vault.read(b)).sourceBytes,payload);
 const race={...base,evidenceRef:'race'};
 const mutable=Buffer.from(payload);const pending=vault.put({...race,sourceBytes:mutable,expectedSha256:digest(mutable)});mutable.fill(0);await pending;
 assert.deepEqual((await vault.read(race)).sourceBytes,payload);
 const parallel={...base,evidenceRef:'parallel'};const outcomes=await Promise.allSettled([put(parallel),put(parallel)]);assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);
 const storage='appraisal-evidence:v1:tenant-aa:evidence-1',raw=map.get(storage);
 for(const patch of [{iv:'AAAA'},{tag:'AAAA'},{ciphertext:'===='},{ciphertext:JSON.parse(raw).ciphertext+' '},{uploadedAt:'2099-01-01'},{releaseAuthorized:true},{uploadedByActorRef:'different-actor'}]){
  map.set(storage,JSON.stringify({...JSON.parse(raw),...patch}));await assert.rejects(()=>vault.read(base),/EVIDENCE_/);
 }
 map.set(storage,raw);assert.deepEqual((await vault.read(base)).sourceBytes,payload);
 // Restart against the same backing adapter and key; no in-memory vault state required.
 const restarted=makePrivateAppraisalVault({adapter,keyProvider:()=>key,authorizeActor:authorizer});
 assert.deepEqual((await restarted.read(base)).sourceBytes,payload);
 assert.equal((await restarted.read(base)).releaseAuthorized,false);
 await assert.rejects(()=>vault.read({...a,evidenceRef:'unknown'}),/LEGACY_NAMESPACE_MIGRATION_REQUIRED_OR_NOT_FOUND/);
 console.log('PRIVATE_APPRAISAL_VAULT_NAMESPACE_AND_INTEGRITY=PASS synthetic=true deployed=false');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
