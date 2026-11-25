'use strict';
const assert=require('node:assert/strict');
const {createVerifiedIdentityContext}=require('../../src/security/verified-identity-context');
const {createCanonicalWorkspacePersistence}=require('../../src/runtime/canonical-workspace-persistence');
const identity=(actor,tenant,roles)=>createVerifiedIdentityContext({claims:{sub:actor,tenant_id:tenant,roles,iss:'test',aud:'test',exp:9999999999},tokenVerificationEvidence:{verified:true}});
const authority=Object.fromEntries(['professionalReportExternalIssuanceAuthorized','releaseAuthorized','mergeAuthorized','deploymentAuthorized','transactionAuthorized'].map(k=>[k,false]));
const ws=(actor)=>({workspaceId:'W',projectId:'P',caseId:'C',schemaVersion:1,executableCase:{},authority,attribution:{actorId:actor}});
async function main(){
 const vals=new Map(),storageProvider={get:k=>vals.get(k),compareAndSet:(k,a,b)=>{if((vals.get(k)??null)!==a)return false;vals.set(k,b);return true;}};
 const p=createCanonicalWorkspacePersistence({storageProvider});let checks=0,denied=0;
 for(const tenant of ['A','B','C']){await p.save({identityContext:identity('owner',tenant,['ANALYST']),workspace:ws('owner'),expectedVersion:0,operationId:'seed'});checks++;}
 for(const tenant of ['A','B','C']){
  const owner=identity('owner',tenant,['ANALYST']);assert.equal((await p.load({identityContext:owner,workspaceId:'W'})).tenantId,tenant);checks++;
  for(const role of ['ADMIN','ANALYST','VIEWER','IC_MEMBER']){
   const peer=identity('peer',tenant,[role]);
   for(const action of [()=>p.load({identityContext:peer,workspaceId:'W'}),()=>p.save({identityContext:peer,workspace:ws('peer'),expectedVersion:1,operationId:'deny'})]){
    await assert.rejects(action,e=>['WORKSPACE_RECORD_ACCESS_DENIED','ROLE_NOT_AUTHORIZED'].includes(e.code));checks++;denied++;
   }
  }
  assert.equal((await p.load({identityContext:owner,workspaceId:'W'})).version,1);checks++;
 }
 console.log('MASTER_V5_PRIVATE_WORKSPACE=PASS checks='+checks+' denied='+denied+' tenants=3 synthetic_identity_memory_storage');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
