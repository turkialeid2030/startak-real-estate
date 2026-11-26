#!/usr/bin/env node
'use strict';

const assert = require('assert');
const path = require('path');

class FakeKV {
  constructor() { this.map = new Map(); }
  async get(key) { return this.map.has(key) ? this.map.get(key) : null; }
  async put(key, value) { this.map.set(key, String(value)); }
}

function snapshot() {
  return {
    schemaVersion: 1,
    capability: 'RESIDENTIAL_INCOME_ACQUISITION_AI_ASSIST',
    governance: {
      rawOperatingCaseIncluded: false,
      tenantNamesIncluded: false,
      evidenceDocumentTextIncluded: false,
      automaticInvestmentRecommendationAllowed: false,
      legalConclusionAllowed: false,
      transactionAuthorizationAllowed: false,
    },
    signals: { readinessStatus: 'READY_WITH_ASSUMPTIONS', evidenceCount: 3 },
  };
}

function providerResult() {
  return {
    executiveObservations: ['EVIDENCE_REVIEW_REQUIRED'],
    riskFlags: [{ code: 'EVIDENCE_GAP', severity: 'MEDIUM', rationale: 'VERIFY_SOURCE_EVIDENCE' }],
    evidenceGaps: ['LEASE_EVIDENCE_GAP'],
    dueDiligenceQuestions: ['VERIFY_LEASE_EVIDENCE'],
    scenarioChecks: ['CHECK_RENT_SCENARIO'],
    earlyWarningIndicators: [{ indicator: 'EVIDENCE_AGE', whyItMatters: 'STALE_EVIDENCE_RISK' }],
    decisionBoundary: 'ADVISORY_ONLY_NO_TRANSACTION_AUTHORITY',
  };
}

function env(overrides = {}) {
  return {
    RIAI_AI_ALLOW_LOCAL_UNAUTHENTICATED: 'true',
    RIAI_AI_PROVIDER_PROTOCOL: 'OPENAI_RESPONSES',
    RIAI_AI_PROVIDER_URL: 'https://api.openai.com/v1/responses',
    RIAI_AI_ALLOWED_HOSTS: 'api.openai.com',
    RIAI_AI_PROVIDER_KEY: 'placeholder-provider-key',
    RIAI_AI_MODEL: 'gpt-5.6-terra',
    RIAI_AI_MAX_OUTPUT_TOKENS: '256',
    ...require('../fixtures/riai-money-bound')('gpt-5.6-terra'),RIAI_AI_GLOBAL_TOKEN_BUDGET_PER_DAY:'100000',RIAI_AI_INPUT_TOKEN_UPPER_BOUND:'20000',RIAI_AI_QUOTA:require('../fixtures/riai-quota-binding')(),
    RIAI_AI_RATE_PER_MINUTE: '20',
    RIAI_AI_RATE_PER_DAY: '100',
    RIAI_AI_RATE_GLOBAL_PER_DAY: '1000',
    RIAI_RATE_LIMIT_KV: new FakeKV(),
    RIAI_AUDIT_KV: new FakeKV(),
    RIAI_AUDIT_SUBJECT_SALT: 'placeholder-salt',
    ...overrides,
  };
}

function request() {
  return new Request('http://localhost/api/riai/ai-assist', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ decisionSnapshot: snapshot() }),
  });
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } });
}

async function main() {
  const modulePath = path.join(__dirname, '..', '..', 'functions', 'api', 'riai', 'ai-assist.js');
  const { onRequestPost } = await import(modulePath);
  const originalFetch = global.fetch;
  try {
    let providerCalls = 0;
    global.fetch = async (url, options = {}) => {
      providerCalls += 1;
      assert.strictEqual(String(url), 'https://api.openai.com/v1/responses');
      const body = JSON.parse(options.body);
      assert.strictEqual(body.model, 'gpt-5.6-terra');
      assert.strictEqual(body.store, false);
      assert.strictEqual(body.max_output_tokens, 256);
      assert.strictEqual(typeof body.instructions, 'string');
      assert(body.instructions.includes('evidence-disciplined real-estate acquisition analysis assistant'));
      assert.strictEqual(body.messages, undefined);
      assert.strictEqual(body.response_format, undefined);
      assert(Array.isArray(body.input));
      assert.strictEqual(body.input[0].role, 'user');
      assert.strictEqual(body.input[0].content[0].type, 'input_text');
      assert.strictEqual(body.input[0].content[0].text, JSON.stringify(snapshot()));
      assert.strictEqual(body.text.format.type, 'json_schema');
      assert.strictEqual(body.text.format.name, 'riai_ai_review');
      assert.strictEqual(body.text.format.strict, true);
      assert.strictEqual(body.text.format.schema.additionalProperties, false);
      assert.strictEqual(options.headers.authorization, 'Bearer placeholder-provider-key');
      return jsonResponse({
        id: 'resp_test',
        object: 'response',
        status: 'completed',
        model: 'gpt-5.6-terra',
        output: [{
          id: 'msg_test',
          type: 'message',
          role: 'assistant',
          content: [{ type: 'output_text', text: JSON.stringify(providerResult()), annotations: [] }],
        }],
      });
    };

    const response = await onRequestPost({ request: request(), env: env() });
    const payload = await response.json();
    assert.strictEqual(response.status, 200);
    assert.strictEqual(payload.ok, true);
    assert.strictEqual(payload.providerProtocol, 'OPENAI_RESPONSES');
    assert.strictEqual(payload.model, 'gpt-5.6-terra');
    assert.strictEqual(payload.result.transactionAuthorized, false);
    assert.strictEqual(providerCalls, 1);

    let invalidProviderCalls = 0;
    global.fetch = async () => { invalidProviderCalls += 1; return jsonResponse({}); };
    const invalidProtocolResponse = await onRequestPost({
      request: request(),
      env: env({ RIAI_AI_PROVIDER_PROTOCOL: 'UNSUPPORTED_PROTOCOL' }),
    });
    const invalidPayload = await invalidProtocolResponse.json();
    assert.strictEqual(invalidProtocolResponse.status, 503);
    assert.strictEqual(invalidPayload.code, 'AI_PROVIDER_PROTOCOL_INVALID');
    assert.strictEqual(invalidProviderCalls, 0);

    global.fetch = async () => jsonResponse({
      id: 'resp_incomplete',
      object: 'response',
      status: 'incomplete',
      incomplete_details: { reason: 'max_output_tokens' },
      output: [],
    });
    const incompleteResponse = await onRequestPost({ request: request(), env: env() });
    const incompletePayload = await incompleteResponse.json();
    assert.strictEqual(incompleteResponse.status, 502);
    assert.strictEqual(incompletePayload.code, 'AI_PROVIDER_RESPONSE_INCOMPLETE');


    const profiles={'gpt-6.2-sol':10,'gpt-6.2-astra':40,'gpt-6.1-terra':5,'gpt-6-luna':1};
    const modern=(model,patch={})=>env({RIAI_AI_MODEL:model,...require('../fixtures/riai-money-bound')(model),RIAI_AI_MODEL_POLICY_VERSION:'GPT6_20261124',RIAI_AI_MAX_USD_MICROS_PER_TOKEN:String(profiles[model]),RIAI_AI_REASONING_EFFORT:'low',...patch});
    let modernCalls=0;
    global.fetch=async(url,options)=>{
      modernCalls++;
      const body=JSON.parse(options.body);
      assert(Object.hasOwn(profiles,body.model));
      assert.strictEqual(body.store,false);
      assert.strictEqual(body.reasoning.effort,'low');
      assert.strictEqual(body.instructions,undefined);
      assert.strictEqual(body.input[0].role,'developer');
      assert(body.input[0].content[0].text.includes('evidence-disciplined'));
      assert.strictEqual(body.input[1].role,'user');
      assert.strictEqual(body.input[1].content[0].text,JSON.stringify(snapshot()));
      assert.strictEqual(body.text.format.strict,true);
      assert.strictEqual(body.temperature,undefined);
      assert.strictEqual(options.redirect,'error');
      return jsonResponse({status:'completed',model:body.model,usage:{input_tokens:100,output_tokens:80,total_tokens:180},output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(providerResult())}]}]});
    };
    for(const model of Object.keys(profiles)){
      const res=await onRequestPost({request:request(),env:modern(model)});
      const data=await res.json();
      assert.strictEqual(res.status,200,JSON.stringify(data));
      assert.strictEqual(data.providerReportedModel,model);
      assert.strictEqual(data.modelPolicyVersion,'GPT6_20261124');
      assert.strictEqual(data.result.transactionAuthorized,false);
    }
    for(const [model,patch,code] of [
      ['gpt-6.2-sol',{RIAI_AI_MODEL_POLICY_VERSION:''},'AI_MODEL_POLICY_NOT_CONFIGURED'],
      ['gpt-6.2-sol',{RIAI_AI_MAX_USD_MICROS_PER_TOKEN:'1'},'AI_MODEL_PRICE_BOUND_BELOW_CATALOG'],
      ['gpt-6.2-sol',{RIAI_AI_REASONING_EFFORT:'max'},'AI_MODEL_REASONING_EFFORT_INVALID'],
      ['gpt-6.2-sol',{RIAI_AI_PROVIDER_PROTOCOL:'CHAT_COMPLETIONS'},'AI_MODEL_REQUIRES_NATIVE_RESPONSES'],
      ['gpt-6.2-sol',{RIAI_AI_PROVIDER_URL:'https://api.openai.com/v1/chat/completions'},'AI_MODEL_REQUIRES_NATIVE_RESPONSES'],
      ['gpt-6-unreviewed',{},'AI_MODEL_NOT_QUALIFIED'],
      ['gpt-6.2-sol',{RIAI_AI_PRICE_BOUND_MODEL:'gpt-5.6-terra'},'AI_MONETARY_BOUND_NOT_CONFIGURED'],
    ]){
      const res=await onRequestPost({request:request(),env:modern(model,patch)});
      assert.strictEqual(res.status,503);
      assert.strictEqual((await res.json()).code,code);
    }
    assert.strictEqual(modernCalls,4);
    for(const [payload,code] of [
      [{status:'completed',model:'gpt-6-luna'},'AI_PROVIDER_MODEL_MISMATCH'],
      [{status:'completed',model:'gpt-6.2-sol'},'AI_PROVIDER_USAGE_UNVERIFIED'],
    ]){
      global.fetch=async()=>jsonResponse(payload);
      const res=await onRequestPost({request:request(),env:modern('gpt-6.2-sol')});
      assert.strictEqual(res.status,502);
      assert.strictEqual((await res.json()).code,code);
    }
    const goodText=JSON.stringify(providerResult());
    const msg=(content,extra={})=>({type:'message',role:'assistant',content,...extra});
    const outputText=text=>({type:'output_text',text});
    const modernBase={status:'completed',model:'gpt-6.2-sol',usage:{input_tokens:100,output_tokens:80,total_tokens:180}};
    const badOutputs=[
      [{output:[msg([outputText(goodText),{type:'refusal',refusal:'DECLINED'}])]},'AI_PROVIDER_REFUSAL'],
      [{output_text:goodText,output:[msg([{type:'refusal',refusal:'DECLINED'}])]},'AI_PROVIDER_REFUSAL'],
      [{output_text:goodText,output:[msg([outputText('{}')])]},'AI_PROVIDER_RESPONSE_UNSUPPORTED'],
      [{output:[msg([outputText(goodText),outputText(goodText)])]},'AI_PROVIDER_RESPONSE_UNSUPPORTED'],
      [{output:[msg([outputText(goodText)]),msg([outputText(goodText)])]},'AI_PROVIDER_RESPONSE_UNSUPPORTED'],
      [{output:[msg([outputText(goodText)],{role:'user'})]},'AI_PROVIDER_RESPONSE_UNSUPPORTED'],
      [{output:[msg([outputText(goodText)],{status:'incomplete'})]},'AI_PROVIDER_RESPONSE_UNSUPPORTED'],
      [{output:[{type:'function_call'},msg([outputText(goodText)])]},'AI_PROVIDER_RESPONSE_UNSUPPORTED'],
      [{status:undefined,output:[msg([outputText(goodText)])]},'AI_PROVIDER_RESPONSE_UNSUPPORTED']
    ];
    for(const [patch,code] of badOutputs){
      global.fetch=async()=>jsonResponse({...modernBase,...patch});
      const res=await onRequestPost({request:request(),env:modern('gpt-6.2-sol')});
      const data=await res.json();
      assert.strictEqual(res.status,502,JSON.stringify(data));assert.strictEqual(data.code,code);assert.strictEqual(data.aiModelUsed,false);assert.strictEqual(data.result,undefined);
    }
    let malformedUrlCalls=0;
    global.fetch=async()=>{malformedUrlCalls++;return jsonResponse({});};
    for(const url of ['https://user:pass@api.openai.com/v1/responses','https://api.openai.com:8443/v1/responses','https://api.openai.com/v1/responses#fragment']){
      const res=await onRequestPost({request:request(),env:env({RIAI_AI_PROVIDER_URL:url})});
      assert.strictEqual(res.status,503);assert.strictEqual((await res.json()).code,'AI_PROVIDER_URL_INVALID');
    }
    assert.strictEqual(malformedUrlCalls,0);
    console.log('RIAI_V614_PROVIDER_RESPONSE_BOUNDARY=PASS cases=9 url_cases=3 mocked_provider_only=true');
    const strictCases=[
      [{unexpected:'unknown'},'AI_RESPONSE_SCHEMA_INVALID'],
      [{riskFlags:[{code:'Buy',severity:'HIGH',rationale:'Review evidence'}]},'AUTOMATIC_DECISION_LANGUAGE_PROHIBITED'],
      [{riskFlags:[{code:'X'.repeat(121),severity:'HIGH',rationale:'Review evidence'}]},'riskFlags_INVALID'],
      [{riskFlags:[{code:'RISK',severity:'HIGH',rationale:'Review evidence',extra:'unknown'}]},'riskFlags_INVALID'],
      [{earlyWarningIndicators:[{indicator:'X'.repeat(221),whyItMatters:'Review evidence'}]},'earlyWarningIndicators_INVALID'],
      [{decisionBoundary:'X'.repeat(501)},'decisionBoundary_INVALID']
    ];
    for(const [patch,code] of strictCases){
      global.fetch=async()=>jsonResponse({...modernBase,output:[msg([outputText(JSON.stringify({...providerResult(),...patch}))])]});
      const res=await onRequestPost({request:request(),env:modern('gpt-6.2-sol')});const data=await res.json();
      assert.strictEqual(res.status,502,JSON.stringify(data));assert.strictEqual(data.code,code);assert.strictEqual(data.result,undefined);
    }
    console.log('RIAI_V615_SERVER_OUTPUT_BOUNDARY=PASS cases=6 mocked_provider_only=true');
    let schemaCalls=0;
    global.fetch=async()=>{schemaCalls++;return jsonResponse({});};
    for(const patch of [{tenantId:'SYNTHETIC_ID'},{signals:{evidenceCount:-1}},{summary:{unitCount:'4'}},{pricing:{purchasePrice:{amount:12}}}]){
      const req=new Request('http://localhost/api/riai/ai-assist',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({decisionSnapshot:{...snapshot(),...patch}})});
      const res=await onRequestPost({request:req,env:modern('gpt-6.2-sol')});const data=await res.json();
      assert.strictEqual(res.status,400,JSON.stringify(data));assert.strictEqual(data.code,'SNAPSHOT_SCHEMA_FIELD_OR_TYPE_INVALID');
    }
    assert.strictEqual(schemaCalls,0);
    console.log('RIAI_V616_PREPROVIDER_SCHEMA=PASS cases=4 provider_calls=0');
    console.log('RIAI_GPT6_MODEL_REFRESH=PASS mocked_provider_only=true');
    console.log('RIAI_OPENAI_RESPONSES_ADAPTER=PASS');
    console.log('OPENAI_RESPONSES_STRUCTURED_OUTPUT=PASS');
    console.log('OPENAI_RESPONSES_STORE_FALSE=PASS');
    console.log('PROVIDER_PROTOCOL_FAIL_CLOSED=PASS');
  } finally {
    global.fetch = originalFetch;
  }
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
