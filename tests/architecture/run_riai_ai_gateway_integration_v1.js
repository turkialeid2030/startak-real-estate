'use strict';
const assert = require('assert');
const path = require('path');
class FakeKV { constructor(){ this.map=new Map(); } async get(k){ return this.map.get(k) ?? null; } async put(k,v){ this.map.set(k,v); } }
const SNAPSHOT={schemaVersion:1,capability:'RESIDENTIAL_INCOME_ACQUISITION_AI_ASSIST',asOfDate:'2026-09-03',readinessStatus:'NEEDS_DUE_DILIGENCE',readiness:{blockers:[{code:'TITLE_EVIDENCE_REQUIRED',field:'propertyInterest.title'}]},acquisitionScore:{status:'CALCULATED_WITH_GAPS',redFlags:[{code:'PRICE_HIGH',severity:'HIGH'}]},governance:{rawOperatingCaseIncluded:false,tenantNamesIncluded:false,evidenceDocumentTextIncluded:false,automaticInvestmentRecommendationAllowed:false,legalConclusionAllowed:false,transactionAuthorizationAllowed:false}};
function env(overrides={}){return{RIAI_AI_ALLOW_LOCAL_UNAUTHENTICATED:'true',RIAI_AI_PROVIDER_URL:'https://api.example-provider.com/v1/chat/completions',RIAI_AI_ALLOWED_HOSTS:'api.example-provider.com',RIAI_AI_PROVIDER_KEY:'test-key',RIAI_AI_MODEL:'test-model',RIAI_RATE_LIMIT_KV:new FakeKV(),RIAI_AUDIT_KV:new FakeKV(),RIAI_AUDIT_SUBJECT_SALT:'salt',...overrides};}
function req(snapshot){return new Request('http://localhost/api/riai/ai-assist',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({decisionSnapshot:snapshot})});}
function provider(boundary='This output is advisory analysis only and does not constitute an investment or legal recommendation.'){return{choices:[{message:{content:JSON.stringify({executiveObservations:['NOI_WITHIN_RANGE'],riskFlags:[{code:'LEASE_RISK',severity:'MEDIUM',rationale:'CONCENTRATION_RISK'}],evidenceGaps:['MARKET_RENT_MISSING'],dueDiligenceQuestions:['CONFIRM_TITLE'],scenarioChecks:['STRESS_TEST'],earlyWarningIndicators:[{indicator:'DSCR_DECLINING',whyItMatters:'COVERAGE_NARROWING'}],decisionBoundary:boundary})}}]};}
(async()=>{
 const {onRequestPost}=await import(path.join(__dirname,'..','..','functions/api/riai/ai-assist.js'));
 let called=false; global.fetch=async()=>{called=true;return new Response(JSON.stringify(provider()),{status:200});};
 let r=await onRequestPost({request:req(SNAPSHOT),env:env({RIAI_RATE_LIMIT_KV:undefined})}); assert.equal(r.status,503); assert.equal(called,false);
 const e=env(); r=await onRequestPost({request:req(SNAPSHOT),env:e}); const b=await r.json(); assert.equal(r.status,200); assert.equal(b.ok,true); assert.equal(e.RIAI_AUDIT_KV.map.size,1);
 const spoof=JSON.parse(JSON.stringify(SNAPSHOT)); spoof.readiness.blockers[0].field='Tenant: Ahmed Al-Otaibi, Unit 14B'; called=false; r=await onRequestPost({request:req(spoof),env:env()}); const sb=await r.json(); assert.equal(r.status,400); assert.equal(sb.code,'SNAPSHOT_FREE_TEXT_NOT_PERMITTED'); assert.equal(called,false);
 console.log('RIAI_GATEWAY_INTEGRATION=PASS');
})().catch((e)=>{console.error(e);process.exit(1);});
