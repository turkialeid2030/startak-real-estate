'use strict';
const assert=require('node:assert/strict');
(async()=>{
 const {REQUIRED,summarize,observeEndpoint,markdown,runInitialPreviewStages}=await import('../../tools/verify-all-stages.mjs');
 const checks=REQUIRED.map(id=>({id,status:'PASS'})),sha='a'.repeat(40);
 const p=summarize({sha,checks,observations:[{id:'preview',status:'PASS',reason:'EXACT_SOURCE_AND_ASSET_HASHES_VERIFIED'}],requestCount:36});
 assert.equal(p.stages.find(x=>x.id==='D04').registeredMatrixStatus,'PASS');assert.equal(p.stages.find(x=>x.id==='D04').status,'PARTIAL');
 assert.equal(p.engineeringStatus,'PASS');assert.equal(p.exitCode,2);assert.equal(p.productionAuthorized,false);
 assert(p.stages.filter(x=>['MARKET_DATA','LIVE_AI','TENANT_ISOLATION','PROFESSIONAL_REVIEW'].includes(x.id)).every(x=>x.status==='BLOCKED'));
 assert.equal(p.independentlyApprovedCount,0);assert.equal(p.requestsSent,0);assert(markdown(p).includes('HOLD / NOT_AUTHORIZED'));
 for(const missing of REQUIRED){const r=summarize({sha,checks:checks.filter(c=>c.id!==missing),observations:[],requestCount:36});assert.equal(r.engineeringStatus,'FAIL');assert.equal(r.exitCode,1);if(missing==='locale-browser')assert.equal(r.stages.find(x=>x.id==='D04').registeredMatrixStatus,'NOT_TESTED');}
 assert.throws(()=>summarize({sha,checks:[...checks,checks[0]],observations:[],requestCount:36}));
 assert.throws(()=>summarize({sha:'main',checks,observations:[],requestCount:36}));
 assert.throws(()=>summarize({sha,checks,observations:[],requestCount:35}));
 let cancelled=0;
 for(const status of [200,302,401,403]){
  const r=await observeEndpoint('ai-config','https://synthetic.invalid/',async(_,options)=>{assert.equal(options.redirect,'manual');return {status,body:{cancel:async()=>cancelled++}};});
  assert.equal(r.status,'BLOCKED');assert.equal(r.httpStatus,status);assert(!('body' in r));
 }
 assert.equal(cancelled,4);
 assert.equal((await observeEndpoint('x','https://synthetic.invalid/',async()=>{throw Error('private error');})).reason,'ENDPOINT_NOT_OBSERVABLE');
 const initialIds=['sectors-browser','owner-browser','export-browser'];
 for(const concurrency of [1,2]){
  let active=0,peak=0;const seen=[],ended=[];
  let releaseSectors;
  const ownerStarted=new Promise(resolve=>{releaseSectors=resolve;});
  const rows=await runInitialPreviewStages(async(id,file)=>{
   active++;peak=Math.max(peak,active);seen.push(id);
   assert.ok(file.endsWith('.js'));
   if(concurrency===2&&id==='sectors-browser')await ownerStarted;
   if(id==='owner-browser')releaseSectors();
   await Promise.resolve();ended.push(id);active--;
   if(id==='owner-browser')throw Error('synthetic stage failure');
   return {id,status:'PASS'};
  },concurrency);
  assert.deepEqual(rows.map(r=>r.id),initialIds);
  assert.deepEqual(rows.map(r=>r.status),['PASS','FAIL','PASS']);
  assert.equal(seen.length,3);assert.equal(new Set(seen).size,3);
  assert.equal(peak,concurrency);assert.equal(active,0);
  assert.ok(ended.indexOf('owner-browser')<ended.indexOf('export-browser'));
 }
 const malformed=await runInitialPreviewStages(async id=>({id:'wrong-'+id,status:'PASS'}),2);
 assert.deepEqual(malformed.map(r=>r.status),['FAIL','FAIL','FAIL']);
 await assert.rejects(()=>runInitialPreviewStages(()=>{},3),/INITIAL_LANES_INVALID/);
 console.log('INITIAL_PREVIEW_LANES=PASS bounded_concurrency=1,2 no_skipped_stages=true');
 const {LANES,validateBrowserMatrix,aggregateSplit}=await import('../../tools/verify-split-qualification.mjs');
 const expected={sourceCommit:sha,runId:'42',runAttempt:'1'};
 const meta={schemaVersion:1,...expected,durationMs:1,engineeringStatus:'NOT_EVALUATED',productionAuthorized:false};
 const pass=id=>({id,status:'PASS',exitCode:0,outputLimitExceeded:false,timedOut:false,logFile:id+'.log',durationMs:1});
 const contexts=['chromium','firefox','webkit'].flatMap(engine=>[390,1366].map(width=>({engine,width,checks:1,checksCompleted:1,physicalDevice:false})));
 const browserEvidence={sourceCommit:sha,checks:6,browsers:contexts,contexts,independentExtractionAccuracyQualified:false,sourceAuthenticationQualified:false,financialAdoptionAuthorized:false};
 const lanes=Object.keys(LANES).map(kind=>({...meta,kind,check:pass(kind),matrix:validateBrowserMatrix(kind,browserEvidence,sha)}));
 const core={...meta,kind:'core',checks:REQUIRED.filter(id=>!Object.hasOwn(LANES,id)).map(pass),observations:['preview','ai-config','ai-assist-method-guard'].map(id=>({id,status:'BLOCKED'})),requestCount:36};
 const combined=aggregateSplit(core,lanes,expected);
 assert.equal(combined.engineeringStatus,'PASS');assert.equal(combined.exitCode,2);assert.equal(combined.productionAuthorized,false);
 assert.deepEqual(combined.checks.map(c=>c.id),REQUIRED);
 for(const mutate of [
  (c,l)=>l.pop(),(c,l)=>l.push(l[0]),(c,l)=>l[0].runId='43',(c,l)=>l[0].runAttempt='2',
  (c,l)=>l[0].sourceCommit='b'.repeat(40),(c,l)=>l[0].check.status='FAIL',
  (c,l)=>l[0].check.exitCode=1,(c,l)=>l[0].matrix.contexts.pop(),
  (c,l)=>l[0].matrix.contexts[0].physicalDevice=true,(c,l)=>c.checks.pop(),
  (c,l)=>c.checks.push(c.checks[0]),(c,l)=>c.requestCount=35,
  (c,l)=>c.productionAuthorized=true,(c,l)=>c.observations[1].status='PASS',
  (c,l)=>c.checks[0].timedOut=true
 ]){
  const c=structuredClone(core),l=structuredClone(lanes);mutate(c,l);
  assert.throws(()=>aggregateSplit(c,l,expected),/SPLIT_/);
 }
 assert.throws(()=>validateBrowserMatrix('ocr-browser',{...browserEvidence,sourceCommit:'b'.repeat(40)},sha),/SOURCE_INVALID/);
 assert.throws(()=>validateBrowserMatrix('document-tables-browser',{...browserEvidence,financialAdoptionAuthorized:true},sha),/AUTHORITY_INVALID/);
 assert.throws(()=>validateBrowserMatrix('cross-browser',{...browserEvidence,browsers:contexts.slice(1)},sha),/MATRIX_INVALID/);
 console.log('SPLIT_QUALIFICATION_CONTRACT=PASS negative_cases=18 original_gate_preserved=true');
 // These two workflows must trigger on the same pull-request events, without
 // path or branch exclusions. Fail closed on a changed or ambiguous on block.
 const fs=require('node:fs'),path=require('node:path');
 const trigger=name=>{
  const text=fs.readFileSync(path.resolve(__dirname,'../../.github/workflows',name),'utf8').replace(/\r\n/g,'\n');
  const blocks=[...text.matchAll(/^on:\s*\n((?:[ \t]+[^\n]*\n)+)/gm)];
  assert.equal(blocks.length,1,'one explicit workflow trigger required');
  return blocks[0][1].trim();
 };
 assert.equal(trigger('one-batch-qualification.yml'),'pull_request:');
 assert.equal(trigger('split-qualification-candidate.yml'),trigger('one-batch-qualification.yml'));
 console.log('SPLIT_TRIGGER_PARITY=PASS unfiltered_pull_request=true');
 console.log('ONE_BATCH_ALL_STAGES_QUALIFICATION=PASS required_checks='+REQUIRED.length);
})().catch(e=>{console.error(e);process.exitCode=1;});
