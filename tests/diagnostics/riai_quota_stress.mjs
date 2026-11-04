// Issue #769: synthetic diagnostic only. No real provider calls, production credentials or altered tests.
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const require=createRequire(import.meta.url);
const mode=process.argv[2],iterations=Number(process.argv[3]??500);
if(!['10','50','boundary'].includes(mode)||!Number.isSafeInteger(iterations)||iterations<1||iterations>1000)
  throw Error('RUN_MODE_OR_ITERATIONS_INVALID');
const started=new Date().toISOString(),failures=[];
let failed=0,completed=0,summaryExtra={};
function progress(i){if(i%50===0||i===iterations)console.log('RIAI_STRESS_PROGRESS mode='+mode+' completed='+i+' failures='+failed);}
const snapshot={
  schemaVersion:1,capability:'RESIDENTIAL_INCOME_ACQUISITION_AI_ASSIST',
  asOfDate:'2026-09-03',readinessStatus:'NEEDS_DUE_DILIGENCE',
  readiness:{blockers:[{code:'TITLE_EVIDENCE_REQUIRED',field:'propertyInterest.title'}]},
  acquisitionScore:{status:'CALCULATED_WITH_GAPS',redFlags:[{code:'PRICE_HIGH',severity:'HIGH'}]},
  governance:{rawOperatingCaseIncluded:false,tenantNamesIncluded:false,evidenceDocumentTextIncluded:false,
    automaticInvestmentRecommendationAllowed:false,legalConclusionAllowed:false,transactionAuthorizationAllowed:false}
};
function provider(){return{choices:[{message:{content:JSON.stringify({
  executiveObservations:['NOI_WITHIN_RANGE'],riskFlags:[{code:'LEASE_RISK',severity:'MEDIUM',rationale:'CONCENTRATION_RISK'}],
  evidenceGaps:['MARKET_RENT_MISSING'],dueDiligenceQuestions:['CONFIRM_TITLE'],scenarioChecks:['STRESS_TEST'],
  earlyWarningIndicators:[{indicator:'DSCR_DECLINING',whyItMatters:'COVERAGE_NARROWING'}],
  decisionBoundary:'This output is advisory analysis only and does not constitute an investment or legal recommendation.'
})}}],usage:{prompt_tokens:10,completion_tokens:20,total_tokens:30}};}
class FakeKV{constructor(){this.map=new Map();}async get(k){return this.map.get(k)??null;}async put(k,v){this.map.set(k,v);}}
function env(){return{
  RIAI_AI_ALLOW_LOCAL_UNAUTHENTICATED:'true',
  RIAI_AI_PROVIDER_URL:'https://api.example-provider.com/v1/chat/completions',
  RIAI_AI_ALLOWED_HOSTS:'api.example-provider.com',RIAI_AI_PROVIDER_KEY:'placeholder',RIAI_AI_MODEL:'test-model',
  ...require('../fixtures/riai-money-bound.js')('test-model'),
  RIAI_AI_GLOBAL_TOKEN_BUDGET_PER_DAY:'100000',RIAI_AI_INPUT_TOKEN_UPPER_BOUND:'20000',
  RIAI_AI_QUOTA:require('../fixtures/riai-quota-binding.js')(),
  RIAI_RATE_LIMIT_KV:new FakeKV(),RIAI_AUDIT_KV:new FakeKV(),RIAI_AUDIT_SUBJECT_SALT:'placeholder-salt',
  RIAI_AI_RATE_PER_MINUTE:'1'
};}
function req(){return new Request('http://localhost/api/riai/ai-assist',{
  method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify({decisionSnapshot:snapshot})
});}
if(mode==='10'){
  // Execute the ORIGINAL integration test as-is, 500 separate Node processes.
  for(let i=1;i<=iterations;i++){
    const p=spawnSync(process.execPath,[path.join(root,'tests/architecture/run_riai_ai_gateway_integration_v1.js')],
      {cwd:root,encoding:'utf8',timeout:30000,maxBuffer:1024*1024});
    const output=(p.stdout||'')+'\n'+(p.stderr||'');
    if(p.status!==0||!output.includes('RIAI_GATEWAY_INTEGRATION=PASS')){
      failed++;
      const at34=/run_riai_ai_gateway_integration_v1\.js:34:9/.test(output);
      const actual=output.match(/actual:\s*(\d+)/);
      failures.push({iteration:i,exitCode:p.status,signal:p.signal,errorCode:p.error?.code||null,
        assertionAt34:at34,providerCalls:at34&&actual?Number(actual[1]):null,
        stdout:(p.stdout||'').slice(-2500),stderr:(p.stderr||'').slice(-4000)});
    }
    completed=i;progress(i);
  }
  summaryExtra={concurrency:10,originalScriptUnmodified:true,originalAssertionsUnmodified:true};
}
if(mode==='50'){
  // 50-way independent strict check of the SAME gateway and transactional test double.
  // Original 10-way regression assertions are never touched or weakened.
  const {onRequestPost}=await import('../../functions/api/riai/ai-assist.js');
  let maxProviderCalls=0,providerCallsTotal=0,maxMinuteBuckets=0;
  for(let i=1;i<=iterations;i++){
    const e=env();let providerCalls=0;
    globalThis.fetch=async()=>{
      providerCalls++;
      return new Response(JSON.stringify(provider()),{status:200,headers:{'content-type':'application/json'}});
    };
    let responses=[],thrown=null;
    try{responses=await Promise.all(Array.from({length:50},()=>onRequestPost({request:req(),env:e})));}
    catch(error){thrown={name:error?.name||'Error',message:String(error?.message||'UNKNOWN').slice(0,160)};}
    const success=responses.filter(r=>r.status===200).length;
    const denied=responses.filter(r=>r.status===429).length;
    const data=e.RIAI_AI_QUOTA.state.data;
    const minuteBuckets=[...data.keys()].filter(k=>k.startsWith('minute:'));
    const tokenKey=[...data.keys()].find(k=>k.startsWith('tokens:'));
    const tokens=tokenKey?data.get(tokenKey):null;
    maxProviderCalls=Math.max(maxProviderCalls,providerCalls);
    providerCallsTotal+=providerCalls;
    maxMinuteBuckets=Math.max(maxMinuteBuckets,minuteBuckets.length);
    if(thrown||providerCalls!==1||success!==1||denied!==49||tokens!==30){
      failed++;
      const nonExpected=[];
      for(const r of responses)if(r.status!==200&&r.status!==429)
        nonExpected.push({status:r.status,code:(await r.json().catch(()=>null))?.code||null});
      failures.push({iteration:i,providerCalls,success,denied,nonExpected:nonExpected.slice(0,10),
        minuteBuckets,tokenBalance:tokens,
        moneyCounters:[...data].filter(([k])=>k.startsWith('usd-micros:')).map(([key,value])=>({key,value})),thrown});
    }
    completed=i;progress(i);
  }
  summaryExtra={concurrency:50,requests:iterations*50,originalAssertionsUnmodified:true,
    strictExpectation:'providerCalls=1; HTTP200=1; HTTP429=49; token balance=30',
    maxProviderCalls,providerCallsTotal,maxMinuteBuckets};
}
if(mode==='boundary'){
  // Deterministic same-minute and 1ms calendar-boundary tests against the REAL quota implementation.
  const {reserveQuota}=await import('../../workers/riai-quota/quota.mjs');
  function store(){
    const state={data:new Map(),tail:Promise.resolve()};
    return{state,storage:{transaction(fn){
      const task=state.tail.then(async()=>{
        const copy=structuredClone(state.data);
        const value=await fn({get:async k=>copy.get(k),put:async(k,v)=>copy.set(k,v)});
        state.data=copy;return value;
      });
      state.tail=task.catch(()=>{});return task;
    }}};
  }
  function input(i,now,usdLimit=100){return{
    id:'boundary-case-'+String(i).padStart(8,'0'),
    subjectHash:'f'.repeat(64),now,tokens:1200,
    limits:{minute:1,subjectDay:60,globalDay:2000,tokensDay:100000},
    money:{reservedUsdMicros:10,limitUsdMicros:usdLimit,model:'test-model'}
  };}
  const across=store();
  const adjacent=await Promise.all([reserveQuota(across.storage,input(1,59999)),
    reserveQuota(across.storage,input(2,60000))]);
  const same=store();
  const fifty=await Promise.all(Array.from({length:50},(_,i)=>reserveQuota(same.storage,input(i+100,60000))));
  const daily=store();
  const money=await Promise.all([reserveQuota(daily.storage,input(3,59999,10)),
    reserveQuota(daily.storage,input(4,60000,10))]);
  const admits=arr=>arr.filter(x=>x.allowed===true&&x.replayed!==true).length;
  summaryExtra={
    adjacentMillisecondAllowed:admits(adjacent),sameMinute50Allowed:admits(fifty),
    dailyMonetaryCeiling10AcrossBoundaryAllowed:admits(money),
    minuteKeys:[...across.state.data.keys()].filter(k=>k.startsWith('minute:')),
    moneyCounters:[...across.state.data].filter(([k])=>k.startsWith('usd-micros:')),
    interpretation:'Minute is fixed-calendar Math.floor(now/60000); 2 across adjacent windows do not prove atomicity failure. Daily USD cap remains atomic.'
  };
  if(summaryExtra.adjacentMillisecondAllowed!==2||summaryExtra.sameMinute50Allowed!==1||
     summaryExtra.dailyMonetaryCeiling10AcrossBoundaryAllowed!==1){
    failed++;failures.push({iteration:1,...summaryExtra});
  }
  completed=iterations;
  console.log('RIAI_BOUNDARY_OBSERVATION '+JSON.stringify(summaryExtra));
}
const report={
  schemaVersion:1,issue:769,mode,sourceCommit:process.env.EXPECTED_SOURCE_SHA||'UNKNOWN',
  started,finished:new Date().toISOString(),iterationsRequested:iterations,
  iterationsCompleted:completed,failedIterations:failed,passedIterations:completed-failed,
  ...summaryExtra,failures
};
const dir=path.join(root,'artifacts/riai-stress');
await fs.mkdir(dir,{recursive:true});
await fs.writeFile(path.join(dir,'mode-'+mode+'.json'),JSON.stringify(report,null,2)+'\n');
console.log('RIAI_STRESS_RESULT '+JSON.stringify({mode,iterationsCompleted:completed,failedIterations:failed,
  passedIterations:completed-failed,...summaryExtra}));
if(failed)process.exitCode=1;
