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
    RIAI_AI_GLOBAL_TOKEN_BUDGET_PER_DAY: '5000',
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
