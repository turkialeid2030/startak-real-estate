'use strict';
const assert=require('assert'); const path=require('path');
class FakeKV{constructor(){this.map=new Map();}async get(k){return this.map.get(k)??null;}async put(k,v){this.map.set(k,v);}}
const SNAPSHOT={schemaVersion:1,capability:'RESIDENTIAL_INCOME_ACQUISITION_AI_ASSIST',asOfDate:'2026-09-03',readinessStatus:'OK',governance:{rawOperatingCaseIncluded:false,tenantNamesIncluded:false,evidenceDocumentTextIncluded:false,automaticInvestmentRecommendationAllowed:false,legalConclusionAllowed:false,transactionAuthorizationAllowed:false}};
function env(){return{RIAI_AI_ALLOW_LOCAL_UNAUTHENTICATED:'true',RIAI_AI_PROVIDER_URL:'https://api.example-provider.com/v1/chat/completions',RIAI_AI_ALLOWED_HOSTS:'api.example-provider.com',RIAI_AI_PROVIDER_KEY:'x',RIAI_AI_MODEL:'m',RIAI_RATE_LIMIT_KV:new FakeKV(),RIAI_AUDIT_KV:new FakeKV()};}
function req(){return new Request('http://localhost/api/riai/ai-assist',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({decisionSnapshot:SNAPSHOT})});}
function body(boundary){return{choices:[{message:{content:JSON.stringify({executiveObservations:['OK'],riskFlags:[],evidenceGaps:[],dueDiligenceQuestions:[],scenarioChecks:[],earlyWarningIndicators:[],decisionBoundary:boundary})}}]};}
(async()=>{const {onRequestPost}=await import(path.join(__dirname,'..','..','functions/api/riai/ai-assist.js'));
 const cases=[['نوصي بالاستحواذ على العقار.',true],['الفرصة الحالية مواتية للتملك.',true],['Based on the analysis, we recommend proceeding with the acquisition promptly.',true],['نوصي بمراجعة سجل الملكية والتحقق من الرهون قبل أي إجراء.',false],['This output is advisory analysis only and does not constitute an investment or legal recommendation.',false]];
 for(const [text,block] of cases){global.fetch=async()=>new Response(JSON.stringify(body(text)),{status:200}); const r=await onRequestPost({request:req(),env:env()}); const b=await r.json(); const got=r.status===502&&b.code==='AUTOMATIC_DECISION_LANGUAGE_PROHIBITED'; assert.equal(got,block,text);}
 console.log('RIAI_DECISION_LANGUAGE_PARAPHRASE=PASS');
})().catch((e)=>{console.error(e);process.exit(1);});
