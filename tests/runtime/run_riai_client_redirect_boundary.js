'use strict';
const assert = require('node:assert/strict');
const http = require('node:http');
const {createHash}=require('node:crypto');
const {requestResidentialIncomeAiAssist} = require('../../src/residential-income-acquisition/ai-assist-client');
const vm = {apiStatus:'CASE_LOADED',summary:{unitCount:2},readinessStatus:'READY_WITH_ASSUMPTIONS'};
const listen = server => new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',()=>resolve('http://127.0.0.1:'+server.address().port));});
const close = server => new Promise(resolve=>{server.close(resolve);server.closeAllConnections?.();});
async function main(){
 let sinkCalls=0,sourceCalls=0,normalCalls=0;
 const sink=http.createServer((req,res)=>{sinkCalls++;req.resume();res.end('unexpected');});
 let sinkUrl;
 const source=http.createServer((req,res)=>{sourceCalls++;req.resume();res.writeHead(307,{location:sinkUrl+'/unexpected'});res.end();});
 const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
 const narrative={executiveObservations:['Review evidence'],riskFlags:[],evidenceGaps:[],dueDiligenceQuestions:[],scenarioChecks:[],earlyWarningIndicators:[],decisionBoundary:'ADVISORY_ONLY'};
 const normal=http.createServer(async(req,res)=>{
  normalCalls++;
  try{
   const chunks=[];for await(const chunk of req)chunks.push(chunk);
   const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
   const payload={ok:true,aiModelUsed:true,advisoryOnly:true,deterministicScoreRemainsAuthoritative:true,model:'synthetic',result:narrative,
    requestBinding:{version:1,clientRequestId:body.clientRequestId,snapshotHashSha256:hash(body.decisionSnapshot),resultHashSha256:hash(narrative)}};
   if(req.url==='/missing-binding')delete payload.requestBinding;
   if(req.url==='/wrong-snapshot')payload.requestBinding.snapshotHashSha256='a'.repeat(64);
   if(req.url==='/changed-result')payload.result={...narrative,executiveObservations:['Changed result']};
   res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(payload));
  }catch{res.writeHead(400);res.end();}
 });
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
  const normalUrl=await listen(normal);
  const run=route=>requestResidentialIncomeAiAssist(vm,{turnstileToken:'SYNTHETIC_ONLY',fetchImpl:(url,options)=>{
   assert.equal(url,'/api/riai/ai-assist');assert.equal(options.redirect,'error');assert.equal(options.mode,'same-origin');assert.equal(options.credentials,'same-origin');
   return fetch(new URL(route,normalUrl),options);
  }});
  const valid=await run('/valid');
  assert.equal(valid.status,'SUCCESS');assert.equal(valid.aiModelUsed,true);assert.equal(valid.result.transactionAuthorized,false);
  assert.match(valid.requestBinding.resultHashSha256,/^[a-f0-9]{64}$/);
  for(const route of ['/missing-binding','/wrong-snapshot','/changed-result']){
   const invalid=await run(route);assert.equal(invalid.status,'INVALID_RESPONSE');assert.equal(invalid.reasonCode,'AI_ASSIST_REQUEST_BINDING_INVALID');assert.equal(invalid.result,null);assert.equal(invalid.aiModelUsed,false);
  }
  assert.equal(normalCalls,4);assert.equal(sinkCalls,0);
  console.log('RIAI_V618_LOOPBACK_BINDING=PASS positive_cases=1 negative_cases=3 redirects_blocked=1 external_calls=0');
  console.log('RIAI_CLIENT_REDIRECT_BOUNDARY=PASS loopback_redirect_denied normal_synthetic_response_accepted');
 }finally{await Promise.all([close(source),close(sink),close(normal)]);}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
