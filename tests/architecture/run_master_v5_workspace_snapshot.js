'use strict';
const assert = require('node:assert/strict');
const {createVerifiedIdentityContext} = require('../../src/security/verified-identity-context');
const {createCanonicalWorkspacePersistence} = require('../../src/runtime/canonical-workspace-persistence');
const identity = createVerifiedIdentityContext({claims:{sub:'owner',tenant_id:'A',roles:['ANALYST'],iss:'test',aud:'test',exp:9999999999},tokenVerificationEvidence:{verified:true}});
const authority = () => Object.fromEntries(['professionalReportExternalIssuanceAuthorized','releaseAuthorized','mergeAuthorized','deploymentAuthorized','transactionAuthorized'].map(k=>[k,false]));
const make = () => ({workspaceId:'W',tenantId:'A',projectId:'P',caseId:'C',schemaVersion:1,executableCase:{projectId:'P',caseId:'C',details:{value:100}},authority:authority(),attribution:{actorId:'owner'}});
async function main(){
 const records=new Map();
 let unblock, waiting;
 const provider={
  get(key){if(waiting){waiting=false;return new Promise(resolve=>{unblock=()=>resolve(records.get(key));});}return records.get(key);},
  compareAndSet(key,before,after){if((records.get(key)??null)!==before)return false;records.set(key,after);return true;}
 };
 const p=createCanonicalWorkspacePersistence({storageProvider:provider});
 let checks=0;
 for(const version of [0,1]){
  const ws=make();
  waiting=true;
  const pending=p.save({identityContext:identity,workspace:ws,expectedVersion:version,operationId:'save-'+version});
  assert.equal(typeof unblock,'function');
  ws.workspaceId='OTHER';ws.tenantId='B';ws.projectId='OTHER';ws.caseId='OTHER';ws.attribution.actorId='peer';
  ws.executableCase.projectId='OTHER';ws.executableCase.details.value=999;ws.authority.releaseAuthorized=true;
  unblock();
  const saved=await pending;
  for(const [actual,expected] of [[saved.workspaceId,'W'],[saved.workspace.tenantId,'A'],[saved.workspace.projectId,'P'],[saved.workspace.caseId,'C'],[saved.workspace.attribution.actorId,'owner'],[saved.workspace.executableCase.projectId,'P'],[saved.workspace.executableCase.details.value,100],[saved.workspace.authority.releaseAuthorized,false],[saved.version,version+1]]){assert.equal(actual,expected);checks++;}
  assert.deepEqual((await p.load({identityContext:identity,workspaceId:'W'})).workspace,make());checks++;
  assert.equal(await p.load({identityContext:identity,workspaceId:'OTHER'}),null);checks++;
 }
 for(const field of ['workspaceId','projectId','caseId']){
  for(const form of ['leading','trailing']){
   const noncanonical=make();
   noncanonical[field]=form==='leading'?' '+noncanonical[field]:noncanonical[field]+' ';
   await assert.rejects(p.save({identityContext:identity,workspace:noncanonical,expectedVersion:2,operationId:'noncanonical-'+field+'-'+form}),e=>e.code==='WORKSPACE_RESOURCE_IDENTITY_MISMATCH');checks++;
   assert.deepEqual((await p.load({identityContext:identity,workspaceId:'W'})).workspace,make());checks++;
  }
 }
 const invalid=make();invalid.toJSON=()=>({...make(),authority:{...authority(),releaseAuthorized:true}});
 await assert.rejects(p.save({identityContext:identity,workspace:invalid,expectedVersion:2,operationId:'invalid'}),e=>e.code==='WORKSPACE_AUTHORITY_INVARIANT_VIOLATION');checks++;
 const cyclic=make();cyclic.self=cyclic;
 await assert.rejects(p.save({identityContext:identity,workspace:cyclic,expectedVersion:2,operationId:'cyclic'}),e=>e.code==='INVALID_CANONICAL_WORKSPACE');checks++;
 assert.equal((await p.load({identityContext:identity,workspaceId:'W'})).version,2);checks++;
 console.log('MASTER_V5_WORKSPACE_SNAPSHOT=PASS checks='+checks);
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
