#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..', '..');

class FakeKV {
  constructor() { this.map = new Map(); }
  async get(key) { return this.map.has(key) ? this.map.get(key) : null; }
  async put(key, value) { this.map.set(key, String(value)); }
  values() { return Array.from(this.map.values()); }
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

function baseEnv(overrides = {}) {
  return {
    RIAI_PUBLIC_AI_ENABLED: 'true',
    RIAI_TURNSTILE_SECRET_KEY: 'TURNSTILE_SECRET_NEVER_LOG',
    RIAI_AUDIT_SUBJECT_SALT: 'AUDIT_SALT_NEVER_LOG',
    RIAI_AI_PROVIDER_URL: 'https://api.example-ai.test/v1/chat/completions',
    RIAI_AI_ALLOWED_HOSTS: 'api.example-ai.test',
    RIAI_AI_PROVIDER_KEY: 'PROVIDER_SECRET_NEVER_LOG',
    RIAI_AI_MODEL: 'test-model',
    RIAI_AI_MAX_OUTPUT_TOKENS: '256',
    RIAI_AI_GLOBAL_TOKEN_BUDGET_PER_DAY: '5000',
    RIAI_AI_RATE_PER_MINUTE: '20',
    RIAI_AI_RATE_PER_DAY: '100',
    RIAI_AI_RATE_GLOBAL_PER_DAY: '1000',
    RIAI_RATE_LIMIT_KV: new FakeKV(),
    RIAI_AUDIT_KV: new FakeKV(),
    ...overrides,
  };
}

function makeRequest({ token = 'TURNSTILE_TOKEN_NEVER_LOG', origin = 'https://example.com', accessToken = null } = {}) {
  const body = { decisionSnapshot: snapshot() };
  if (token !== null) body.turnstileToken = token;
  const headers = {
    'content-type': 'application/json',
    origin,
    'sec-fetch-site': origin === 'https://example.com' ? 'same-origin' : 'cross-site',
    'cf-connecting-ip': '203.0.113.77',
  };
  if (accessToken !== null) headers['cf-access-jwt-assertion'] = accessToken;
  return new Request('https://example.com/api/riai/ai-assist', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } });
}

async function loadRouteModule() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'startak-riai-ai-test-'));
  const sourceDir = path.join(ROOT, 'functions', 'api', 'riai');
  fs.copyFileSync(path.join(sourceDir, '_guardrails.mjs'), path.join(tmp, '_guardrails.mjs'));
  fs.copyFileSync(path.join(sourceDir, '_public-ai-security.mjs'), path.join(tmp, '_public-ai-security.mjs'));
  fs.copyFileSync(path.join(sourceDir, 'ai-assist.js'), path.join(tmp, 'ai-assist.mjs'));
  const mod = await import(`${pathToFileURL(path.join(tmp, 'ai-assist.mjs')).href}?v=${Date.now()}`);
  return { mod, tmp };
}

async function parse(response) {
  return { status: response.status, payload: await response.json() };
}

async function main() {
  const { mod, tmp } = await loadRouteModule();
  const originalFetch = global.fetch;
  try {
    {
      const env = baseEnv();
      const calls = [];
      global.fetch = async (url, options = {}) => {
        calls.push({ url: String(url), options });
        if (String(url).includes('/turnstile/v0/siteverify')) {
          assert(String(options.body).includes('secret=TURNSTILE_SECRET_NEVER_LOG'));
          assert(String(options.body).includes('response=TURNSTILE_TOKEN_NEVER_LOG'));
          assert(!String(options.body).includes('203.0.113.77'), 'raw IP must not be sent to Turnstile');
          return jsonResponse({ success: true, action: 'riai_ai_assist', hostname: 'example.com' });
        }
        assert.strictEqual(String(url), env.RIAI_AI_PROVIDER_URL);
        const providerBody = JSON.parse(options.body);
        assert(!options.body.includes('TURNSTILE_TOKEN_NEVER_LOG'), 'Turnstile token leaked to provider');
        assert(!options.body.includes('203.0.113.77'), 'raw IP leaked to provider');
        assert.strictEqual(providerBody.messages[1].content, JSON.stringify(snapshot()));
        assert.strictEqual(options.headers.authorization, `Bearer ${env.RIAI_AI_PROVIDER_KEY}`);
        return jsonResponse({ choices: [{ message: { content: JSON.stringify(providerResult()) } }] });
      };

      const { status, payload } = await parse(await mod.onRequestPost({ request: makeRequest(), env }));
      assert.strictEqual(status, 200);
      assert.strictEqual(payload.ok, true);
      assert.strictEqual(payload.aiModelUsed, true);
      assert.strictEqual(payload.accessMode, 'CLOUDFLARE_TURNSTILE');
      assert.strictEqual(payload.result.transactionAuthorized, false);
      assert.strictEqual(calls.filter((c) => c.url.includes('/turnstile/v0/siteverify')).length, 1);
      assert.strictEqual(calls.filter((c) => c.url === env.RIAI_AI_PROVIDER_URL).length, 1);

      const audit = env.RIAI_AUDIT_KV.values().join('\n');
      for (const forbidden of ['203.0.113.77', 'TURNSTILE_TOKEN_NEVER_LOG', 'TURNSTILE_SECRET_NEVER_LOG', 'PROVIDER_SECRET_NEVER_LOG', 'AUDIT_SALT_NEVER_LOG']) {
        assert(!audit.includes(forbidden), `audit leaked secret/raw identifier: ${forbidden}`);
      }
      assert(audit.includes('CLOUDFLARE_TURNSTILE'));
      assert(Array.from(env.RIAI_RATE_LIMIT_KV.map.keys()).some((key) => key.startsWith('budget:tokens:global:')));
    }

    {
      const env = baseEnv();
      let fetchCalls = 0;
      global.fetch = async () => { fetchCalls += 1; throw new Error('must not run'); };
      const result = await parse(await mod.onRequestPost({ request: makeRequest({ origin: 'https://evil.example' }), env }));
      assert.strictEqual(result.status, 403);
      assert.strictEqual(result.payload.code, 'AI_CROSS_ORIGIN_REQUEST_BLOCKED');
      assert.strictEqual(fetchCalls, 0);
    }

    {
      let fetchCalls = 0;
      global.fetch = async () => { fetchCalls += 1; throw new Error('must not run'); };
      let result = await parse(await mod.onRequestPost({ request: makeRequest({ token: null }), env: baseEnv() }));
      assert.strictEqual(result.status, 401);
      assert.strictEqual(result.payload.code, 'AI_TURNSTILE_REQUIRED');
      assert.strictEqual(fetchCalls, 0);

      result = await parse(await mod.onRequestPost({
        request: makeRequest(),
        env: baseEnv({ RIAI_TURNSTILE_SECRET_KEY: '' }),
      }));
      assert.strictEqual(result.status, 503);
      assert.strictEqual(result.payload.code, 'AI_TURNSTILE_NOT_CONFIGURED');
      assert.strictEqual(fetchCalls, 0);
    }

    {
      const env = baseEnv();
      let providerCalls = 0;
      global.fetch = async (url) => {
        if (String(url).includes('/turnstile/v0/siteverify')) return jsonResponse({ success: false, action: 'riai_ai_assist', hostname: 'example.com' });
        providerCalls += 1;
        return jsonResponse({});
      };
      const result = await parse(await mod.onRequestPost({ request: makeRequest(), env }));
      assert.strictEqual(result.status, 403);
      assert.strictEqual(result.payload.code, 'AI_TURNSTILE_FAILED');
      assert.strictEqual(providerCalls, 0);
    }

    {
      const env = baseEnv({
        RIAI_AI_ACCESS_ISSUER: 'https://team.cloudflareaccess.com',
        RIAI_AI_ACCESS_AUD: 'audience',
      });
      let fetchCalls = 0;
      global.fetch = async () => { fetchCalls += 1; return jsonResponse({}); };
      const result = await parse(await mod.onRequestPost({ request: makeRequest({ accessToken: 'not-a-jwt' }), env }));
      assert.strictEqual(result.status, 401);
      assert.strictEqual(result.payload.code, 'AI_ACCESS_TOKEN_INVALID');
      assert.strictEqual(fetchCalls, 0);
    }

    {
      const env = baseEnv({ RIAI_AI_GLOBAL_TOKEN_BUDGET_PER_DAY: '1' });
      let providerCalls = 0;
      global.fetch = async (url) => {
        if (String(url).includes('/turnstile/v0/siteverify')) return jsonResponse({ success: true, action: 'riai_ai_assist', hostname: 'example.com' });
        providerCalls += 1;
        return jsonResponse({});
      };
      const result = await parse(await mod.onRequestPost({ request: makeRequest(), env }));
      assert.strictEqual(result.status, 429);
      assert.strictEqual(result.payload.code, 'AI_TOKEN_BUDGET_EXCEEDED');
      assert.strictEqual(providerCalls, 0);
    }

    {
      const env = baseEnv({ RIAI_AI_GLOBAL_TOKEN_BUDGET_PER_DAY: '' });
      let providerCalls = 0;
      global.fetch = async (url) => {
        if (String(url).includes('/turnstile/v0/siteverify')) return jsonResponse({ success: true, action: 'riai_ai_assist', hostname: 'example.com' });
        providerCalls += 1;
        return jsonResponse({});
      };
      const result = await parse(await mod.onRequestPost({ request: makeRequest(), env }));
      assert.strictEqual(result.status, 503);
      assert.strictEqual(result.payload.code, 'AI_TOKEN_BUDGET_NOT_CONFIGURED');
      assert.strictEqual(providerCalls, 0);
    }

    {
      const env = baseEnv({ RIAI_AI_RATE_PER_MINUTE: '1' });
      let providerCalls = 0;
      global.fetch = async (url) => {
        if (String(url).includes('/turnstile/v0/siteverify')) return jsonResponse({ success: true, action: 'riai_ai_assist', hostname: 'example.com' });
        providerCalls += 1;
        return jsonResponse({ choices: [{ message: { content: JSON.stringify(providerResult()) } }] });
      };
      const first = await parse(await mod.onRequestPost({ request: makeRequest({ token: 'TOKEN_ONE' }), env }));
      const second = await parse(await mod.onRequestPost({ request: makeRequest({ token: 'TOKEN_TWO' }), env }));
      assert.strictEqual(first.status, 200);
      assert.strictEqual(second.status, 429);
      assert.strictEqual(second.payload.code, 'AI_RATE_LIMIT_EXCEEDED_PER_MINUTE');
      assert.strictEqual(providerCalls, 1);
    }

    {
      const env = baseEnv();
      global.fetch = async (url) => {
        if (String(url).includes('/turnstile/v0/siteverify')) throw new Error('network down');
        throw new Error('provider must not run');
      };
      const result = await parse(await mod.onRequestPost({ request: makeRequest(), env }));
      assert.strictEqual(result.status, 503);
      assert.strictEqual(result.payload.code, 'AI_TURNSTILE_UNAVAILABLE');
    }

    {
      const configSource = fs.readFileSync(path.join(ROOT, 'functions', 'api', 'riai', 'public-config.js'), 'utf8');
      const configPath = path.join(tmp, 'public-config.mjs');
      fs.writeFileSync(configPath, configSource);
      const configMod = await import(`${pathToFileURL(configPath).href}?v=${Date.now()}`);
      const response = await configMod.onRequestGet({
        request: new Request('https://example.com/api/riai/public-config'),
        env: {
          RIAI_PUBLIC_AI_ENABLED: 'true',
          RIAI_TURNSTILE_SITE_KEY: 'PUBLIC_SITE_KEY',
          RIAI_TURNSTILE_SECRET_KEY: 'SECRET_MUST_NOT_LEAK',
          RIAI_AI_PROVIDER_KEY: 'PROVIDER_KEY_MUST_NOT_LEAK',
          RIAI_AI_PROVIDER_URL: 'https://secret-provider.test',
        },
      });
      const text = await response.text();
      const payload = JSON.parse(text);
      assert.strictEqual(payload.publicAiEnabled, true);
      assert.strictEqual(payload.turnstileSiteKey, 'PUBLIC_SITE_KEY');
      for (const forbidden of ['SECRET_MUST_NOT_LEAK', 'PROVIDER_KEY_MUST_NOT_LEAK', 'secret-provider.test']) assert(!text.includes(forbidden));
    }

    {
      const turnstileClient = require(path.join(ROOT, 'src', 'residential-income-acquisition', 'turnstile-client.js'));
      const prepared = await turnstileClient.prepareTurnstileToken(async () => { throw new Error('not expected'); }, { turnstileToken: 'EXPLICIT_TEST_TOKEN' });
      assert.strictEqual(prepared.ok, true);
      assert.strictEqual(prepared.token, 'EXPLICIT_TEST_TOKEN');
    }

    {
      const headers = fs.readFileSync(path.join(ROOT, 'public', '_headers'), 'utf8');
      assert(headers.includes("script-src 'self' https://challenges.cloudflare.com"));
      assert(headers.includes('frame-src https://challenges.cloudflare.com'));
      assert(headers.includes("connect-src 'self' https://challenges.cloudflare.com"));
    }

    console.log('RIAI_PUBLIC_AI_SECURITY_TESTS=PASS');
    console.log('RIAI_PUBLIC_AI_SECURITY_CASES=12');
  } finally {
    global.fetch = originalFetch;
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
