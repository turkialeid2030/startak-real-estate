'use strict';
const assert = require('node:assert/strict');
const http = require('node:http');
const {requestResidentialIncomeAiAssist} = require('../../src/residential-income-acquisition/ai-assist-client');
const vm = {apiStatus:'CASE_LOADED',summary:{unitCount:2},readinessStatus:'READY_WITH_ASSUMPTIONS'};
const listen = server => new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',()=>resolve('http://127.0.0.1:'+server.address().port));});
const close = server => new Promise(resolve=>{server.close(resolve);server.closeAllConnections?.();});
async function main(){
 let sinkCalls=0,sourceCalls=0;
 const sink=http.createServer((req,res)=>{sinkCalls++;req.resume();res.end('unexpected');});
 let sinkUrl;
 const source=http.createServer((req,res)=>{sourceCalls++;req.resume();res.writeHead(307,{location:sinkUrl+'/unexpected'});res.end();});
 try{
  sinkUrl=await listen(sink);const sourceUrl=await listen(source);
  const result=await requestResidentialIncomeAiAssist(vm,{turnstileToken:'SYNTHETIC_ONLY',timeoutMs:5000,
   fetchImpl:(url,options)=>{
    assert.equal(url,'/api/riai/ai-assist');assert.equal(options.mode,'same-origin');
    assert.equal(options.redirect,'error');assert.equal(options.credentials,'same-origin');
    return fetch(new URL(url,sourceUrl),options);
   }});
  assert.equal(result.status,'UNAVAILABLE');
  assert.equal(result.aiModelUsed,false);
  assert.equal(result.result,null);
  assert.equal(sourceCalls,1);
  assert.equal(sinkCalls,0);
  let normalCalls=0;
  const valid=await requestResidentialIncomeAiAssist(vm,{turnstileToken:'SYNTHETIC_ONLY',fetchImpl:async(url,options)=>{
   normalCalls++;assert.equal(options.redirect,'error');assert.equal(options.mode,'same-origin');
   return new Response(JSON.stringify({ok:true,aiModelUsed:true,advisoryOnly:true,deterministicScoreRemainsAuthoritative:true,model:'synthetic',result:{executiveObservations:['Review evidence'],riskFlags:[],evidenceGaps:[],dueDiligenceQuestions:[],scenarioChecks:[],earlyWarningIndicators:[],decisionBoundary:'ADVISORY_ONLY'}}),{status:200,headers:{'content-type':'application/json'}});
  }});
  assert.equal(valid.status,'SUCCESS');assert.equal(valid.aiModelUsed,true);assert.equal(valid.result.transactionAuthorized,false);assert.equal(normalCalls,1);
  console.log('RIAI_CLIENT_REDIRECT_BOUNDARY=PASS loopback_redirect_denied normal_synthetic_response_accepted');
 }finally{await Promise.all([close(source),close(sink)]);}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
