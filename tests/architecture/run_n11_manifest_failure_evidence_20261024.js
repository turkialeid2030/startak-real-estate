'use strict';
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
(async()=>{
 const {verifyDeployedAssets}=await import('../../tools/verify-deployed-assets.mjs');
 const expected='a'.repeat(40),prior='b'.repeat(40),url='https://example.test/';
 const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
 const good={schemaVersion:1,sourceCommit:expected,assets:[{path:'assets/index.js',sizeBytes:1,sha256:hash('x')}]};
 let checks=0;
 async function fail({body,contentType='application/json',status=200,code,commit=null,index=null}){
   let calls=0;
   const raw=typeof body==='string'?body:JSON.stringify(body);
   const fetchImpl=async()=>{calls++;return new Response(raw,{status,headers:{
    'content-type':contentType,'cf-ray':'SYNTHETIC-EDGE-CA','cf-cache-status':'HIT','cache-control':'no-store','age':'0'
   }})};
   await assert.rejects(verifyDeployedAssets({url,expectedSha:expected,fetchImpl}),e=>{
     assert.equal(e.message,code);
     assert.equal(e.observation.status,'FAIL');
     assert.equal(e.observation.reasonCode,code);
     assert.equal(e.observation.expectedSourceCommit,expected);
     assert.equal(e.observation.observedAssetManifestSourceCommit,commit);
     assert.equal(e.observation.manifestEntryIndex,index);
     assert.equal(e.observation.manifestResponseMetadata.httpStatus,status);
     assert.equal(e.observation.manifestResponseMetadata.cfRay,'SYNTHETIC-EDGE-CA');
     assert.equal(e.observation.manifestResponseMetadata.cfCacheStatus,'HIT');
     assert.equal(e.observation.manifestResponseMetadata.cacheControl,'no-store');
     assert.equal(e.observation.manifestContentType,contentType.slice(0,120));
     assert.equal(e.observation.manifestSha256,hash(raw));
     assert.equal(e.observation.manifestSizeBytes,Buffer.byteLength(raw));
     assert.equal(e.observation.automaticRetries,0);
     if(raw.length>=25)assert.equal(JSON.stringify(e.observation).includes(raw),false,'Response bytes cannot enter evidence');
     assert.equal(JSON.stringify(e.observation).includes('PRIVATE-TEXT'),false);
     checks+=16;
     return true;
   });
   assert.equal(calls,1,'No retry and no HTML fetch once manifest fails');
   checks++;
 }
 await fail({body:'<html>PRIVATE-TEXT synthetic fallback</html>',contentType:'text/html',status:404,code:'ASSET_MANIFEST_RESPONSE_INVALID'});
 await fail({body:'<html>PRIVATE-TEXT synthetic fallback</html>',contentType:'text/html',code:'ASSET_MANIFEST_RESPONSE_INVALID'});
 await fail({body:'{"PRIVATE-TEXT":',code:'ASSET_MANIFEST_JSON_INVALID'});
 await fail({body:null,code:'ASSET_MANIFEST_SOURCE_INVALID'});
 await fail({body:{schemaVersion:1,sourceCommit:prior,assets:good.assets},code:'ASSET_MANIFEST_SOURCE_INVALID',commit:prior});
 await fail({body:{...good,assets:[null]},code:'ASSET_MANIFEST_ENTRY_INVALID',commit:expected,index:0});
 await fail({body:{...good,assets:[{...good.assets[0],path:'assets/../secret.txt'}]},code:'ASSET_MANIFEST_ENTRY_INVALID',commit:expected,index:0});
 await fail({body:{...good,assets:[good.assets[0],good.assets[0]]},code:'ASSET_MANIFEST_ENTRY_INVALID',commit:expected,index:1});
 await fail({body:{...good,assets:[{...good.assets[0],sizeBytes:70*1024*1024}]},code:'ASSET_MANIFEST_LIMIT_EXCEEDED',commit:expected,index:0});
 await fail({body:'x'.repeat(1024*1024+1),code:'ASSET_MANIFEST_SIZE_LIMIT_EXCEEDED'});
 // Stream bounds: reject oversized payloads before allocating the complete body.
 const oversized=new Uint8Array(1024*1024+2);oversized.fill(88);
 let oversizedCalls=0;
 await assert.rejects(verifyDeployedAssets({url,expectedSha:expected,fetchImpl:async()=>{
   oversizedCalls++;
   return new Response(new ReadableStream({start(controller){
     controller.enqueue(oversized);controller.close();
   }}),{status:200,headers:{'content-type':'application/json'}});
 }}),e=>{
   assert.equal(e.message,'ASSET_RESPONSE_SIZE_LIMIT_EXCEEDED');
   assert.equal(e.observation?.status,'FAIL');
   assert.equal(e.observation?.resourcePath,'/asset-manifest.json');
   assert.equal(e.observation?.limitBytes,1024*1024+1);
   assert.equal(JSON.stringify(e.observation).includes('PRIVATE-TEXT'),false);
   checks+=5;return true;
 });
 assert.equal(oversizedCalls,1);checks++;
 // A forged Content-Length must also fail before any body read.
 await assert.rejects(verifyDeployedAssets({url,expectedSha:expected,
   fetchImpl:async()=>new Response('PRIVATE-TEXT',{status:200,headers:{
     'content-type':'application/json','content-length':String(2*1024*1024)
   }})}),e=>{
    assert.equal(e.message,'ASSET_RESPONSE_SIZE_LIMIT_EXCEEDED');
    assert.equal(e.observation?.limitBytes,1024*1024+1);
    assert.equal(e.observation?.responseMetadata.httpStatus,200);
    checks+=3;return true;
 });
 console.log('N11_FIRST_MANIFEST_FAILURE_DIAGNOSTICS=PASS checks='+checks+' NO_BODY=PASS NO_RETRY=PASS');
})().catch(e=>{console.error(e);process.exitCode=1});
