'use strict';
const assert=require('node:assert/strict');
const {randomBytes}=require('node:crypto');
const {createPostgresCustodyService}=require('../../src/security/c73-postgres-custody-service');
const KEY=randomBytes(32);
const pool={connect(){throw Error('UNAUTHORIZED_REQUEST_REACHED_DATABASE')}};
const identity={status:'VERIFIED_CONTEXT',authorizationReady:true,
 identity:{tenantId:'tenant-a',actorId:'actor-a',subject:'actor-a',roles:['CUSTODY_READER']}};
let checks=0;
function check(x){x();checks++;}
check(()=>assert.throws(()=>createPostgresCustodyService({}),/TRUSTED_SERVER_DEPENDENCIES/));
check(()=>assert.throws(()=>createPostgresCustodyService({
 pool,verifyRequest:()=>identity,key:Buffer.alloc(8),keyRef:'test',clock:()=>new Date(),
}),/TRUSTED_SERVER_DEPENDENCIES/));
const service=createPostgresCustodyService({
 pool,verifyRequest:async request=>request?.sessionToken==='trusted'?identity:null,
 key:KEY,keyRef:'server-ci-only',clock:()=>new Date(),
});
async function deny(p,regex){
 await assert.rejects(p,regex);checks++;
}
async function run(){
 check(()=>assert.equal(service.productionVaultReady,false));
 check(()=>assert.equal(service.sourceRightsAuthenticated,false));
 check(()=>assert.equal(service.professionalValuationAuthorized,false));
 await deny(service.get({request:{sessionToken:'attacker',tenantId:'tenant-a'},documentId:'DOC'}),
  /TRUSTED_IDENTITY_OR_ROLE_REQUIRED/);
 await deny(service.observe({request:{sessionToken:'trusted'},scope:{},bytes:Buffer.alloc(16)}),
  /TRUSTED_IDENTITY_OR_ROLE_REQUIRED/);
 await deny(service.recheck({request:{sessionToken:'attacker'},documentId:'DOC',
  expectedRevision:1,expectedHeadTag:'a'.repeat(64)}),/TRUSTED_IDENTITY_OR_ROLE_REQUIRED/);
 await deny(service.revoke({request:{sessionToken:'attacker'},documentId:'DOC',
  expectedRevision:1,expectedHeadTag:'a'.repeat(64)}),/TRUSTED_IDENTITY_OR_ROLE_REQUIRED/);
 await deny(service.get({request:{sessionToken:'trusted'},documentId:''}),
  /DOCUMENT_ID_REQUIRED/);
 console.log('C73_2_SERVER_AUTHORIZATION_FAIL_CLOSED=PASS checks='+checks);
}
run().catch(e=>{console.error(e);process.exitCode=1;});
