'use strict';
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
(async()=>{
  const {observePublicDeliveryWindow}=await import(pathToFileURL(path.resolve(__dirname,'../../tools/verify-public-delivery-window.mjs')).href);
  const sha='a'.repeat(40),url='https://example.test/';
  let calls=0,sleeps=[];
  const pass=()=>({status:'PASS',expectedSourceCommit:sha,assets:[{path:'assets/test.js',status:'PASS',httpStatus:200}],missingAssetStatus:'PASS',missingAssetHttpStatus:404});
  const bad=()=>({status:'FAIL',expectedSourceCommit:sha,assets:[{path:'assets/test.js',status:'FAIL',httpStatus:404,responseMetadata:{cfRay:'edge-failure'}}],missingAssetStatus:'PASS',missingAssetHttpStatus:404});
  const mixed=await observePublicDeliveryWindow({url,expectedSha:sha,samples:3,pauseMs:3,
    verify:async ({url:u,expectedSha:v})=>{assert.equal(u,url);assert.equal(v,sha);calls++;return calls===1?bad():pass()},
    sleep:async ms=>sleeps.push(ms)});
  assert.equal(mixed.status,'FAIL','First failed CDN edge must not be erased by later successful samples');
  assert.equal(mixed.passedSamples,2);assert.equal(mixed.failedSamples,1);
  assert.deepEqual(mixed.checks.map(x=>x.status),['FAIL','PASS','PASS']);
  assert.deepEqual(sleeps,[3,3]);assert.equal(calls,3);assert.equal(mixed.automaticRetries,0);
  assert.equal(mixed.checks[0].assetResults[0].responseMetadata.cfRay,'edge-failure');
  assert.equal(JSON.stringify(mixed).includes('private raw html'),false);
  let n=0;
  const errorCase=await observePublicDeliveryWindow({url,expectedSha:sha,samples:2,pauseMs:0,
    verify:async()=>{n++;if(n===1){const e=Error('ASSET_ENTRY_SOURCE_MISMATCH');e.observation={status:'FAIL',entryHtmlSha256:'b'.repeat(64)};throw e}return pass()},
    sleep:async()=>{}});
  assert.equal(errorCase.status,'FAIL');
  assert.equal(errorCase.checks[0].reasonCode,'ASSET_ENTRY_SOURCE_MISMATCH');
  assert.equal(errorCase.checks[0].observation.entryHtmlSha256,'b'.repeat(64));
  assert.equal(n,2);
  const allPass=await observePublicDeliveryWindow({url,expectedSha:sha,samples:2,pauseMs:0,verify:async()=>pass(),sleep:async()=>{}});
  assert.equal(allPass.status,'PASS');assert.equal(allPass.passedSamples,2);
  for(const opts of [{expectedSha:'bad'},{expectedSha:sha,samples:1},{expectedSha:sha,samples:7},{expectedSha:sha,pauseMs:-1},{expectedSha:sha,pauseMs:30001},{expectedSha:sha,samples:NaN}]){
    await assert.rejects(observePublicDeliveryWindow({url,...opts}),/PUBLIC_WINDOW_/);
  }
  console.log('PUBLIC_DELIVERY_WINDOW_FAIL_CLOSED=PASS; SAMPLES_ISOLATED=PASS; PASS_BY_RETRY=FORBIDDEN');
})().catch(err=>{console.error(err);process.exitCode=1});
