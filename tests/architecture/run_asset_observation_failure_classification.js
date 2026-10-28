'use strict';
const assert=require('node:assert/strict');
(async()=>{
 const {classifyDeliveryObservationFailure}=await import('../../tools/verify-deployed-assets.mjs');
 let n=0;
 const check=(error,expected)=>{assert.equal(classifyDeliveryObservationFailure(error),expected);n++;};
 check({cause:{code:'ENOTFOUND'}},'ASSET_OBSERVATION_DNS_UNAVAILABLE');
 check({cause:{code:'EAI_AGAIN'}},'ASSET_OBSERVATION_DNS_UNAVAILABLE');
 check({cause:{code:'UND_ERR_CONNECT_TIMEOUT'}},'ASSET_OBSERVATION_CONNECT_TIMEOUT');
 check({name:'TimeoutError'},'ASSET_OBSERVATION_REQUEST_TIMEOUT');
 check({name:'AbortError'},'ASSET_OBSERVATION_REQUEST_TIMEOUT');
 check(new TypeError('fetch failed'),'ASSET_OBSERVATION_NETWORK_FETCH_FAILED');
 check(new Error('ASSET_MANIFEST_RESPONSE_INVALID'),'ASSET_MANIFEST_RESPONSE_INVALID');
 check(new Error('private token is secret'),'ASSET_OBSERVATION_FAILED');
 check(null,'ASSET_OBSERVATION_FAILED');
 console.log('ASSET_OBSERVATION_REASON_CLASSIFICATION=PASS checks='+n+' leakFree=true');
})().catch(e=>{console.error(e);process.exitCode=1});
