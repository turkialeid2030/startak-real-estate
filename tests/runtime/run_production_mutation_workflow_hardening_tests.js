'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const aiPath = path.join(root, '.github/workflows/cloudflare-ai-production-activation.yml');
const accessPath = path.join(root, '.github/workflows/cloudflare-access-runtime-sync.yml');
const publicConfigPath = path.join(root, 'functions/api/riai/public-config.js');

const ai = fs.readFileSync(aiPath, 'utf8');
const access = fs.readFileSync(accessPath, 'utf8');
const publicConfig = fs.readFileSync(publicConfigPath, 'utf8');

const results = [];

function test(id, fn) {
  try {
    fn();
    results.push([id, 'PASS']);
    console.log(`${id} PASS`);
  } catch (error) {
    results.push([id, `FAIL: ${error.message}`]);
    console.log(`${id} FAIL: ${error.message}`);
  }
}

function assertManualMutationContract(workflow, label) {
  assert.match(workflow, /\n\s*workflow_dispatch:\s*\n/);
  assert.doesNotMatch(workflow, /\n\s*push:\s*\n/, `${label} must not mutate production from push`);
  assert.match(workflow, /expected_commit_sha:/);
  assert.match(workflow, /confirm_production_mutation:/);
  assert.match(workflow, /I_AUTHORIZE_STARTAK_PRODUCTION_MUTATION/);
  assert.match(workflow, /refs\/heads\/main/);
  assert.match(workflow, /EXPECTED_COMMIT_SHA/);
  assert.match(workflow, /GITHUB_SHA/);
}

test('PRODUCTION-MUTATION-HARDENING-01', () => {
  assertManualMutationContract(ai, 'AI activation workflow');
});

test('PRODUCTION-MUTATION-HARDENING-02', () => {
  assertManualMutationContract(access, 'Access runtime sync workflow');
  assert.match(access, /if: github\.event_name == 'workflow_dispatch'/);
  assert.match(access, /Pull-request runs are read-only/);
});

test('PRODUCTION-MUTATION-HARDENING-03', () => {
  assert.match(ai, /Retry exact authorized production deployment/);
  assert.match(ai, /--arg sha "\$authorized"/);
  assert.match(ai, /commit_hash/);
  assert.match(ai, /deployed.*authorized/s);
  assert.doesNotMatch(ai, /Retry latest production deployment/);
});

test('PRODUCTION-MUTATION-HARDENING-04', () => {
  assert.match(ai, /Verify public AI post-activation smoke boundary/);
  assert.match(ai, /\/api\/riai\/public-config/);
  assert.match(ai, /\/api\/riai\/ai-assist/);
  assert.match(ai, /challenges\\\.cloudflare\\\.com/);
});

test('PRODUCTION-MUTATION-HARDENING-05', () => {
  assert.match(ai, /if: failure\(\)/);
  assert.match(ai, /Fail-closed disable public AI after activation failure/);
  assert.ok(ai.includes('RIAI_PUBLIC_AI_ENABLED'));
  assert.ok(ai.includes('"value":"false"'), 'failure path must set RIAI_PUBLIC_AI_ENABLED=false');
});

test('PRODUCTION-MUTATION-HARDENING-06', () => {
  for (const key of ['RIAI_PUBLIC_AI_ENABLED', 'RIAI_TURNSTILE_SITE_KEY']) {
    assert.ok(publicConfig.includes(key), `runtime public config must consume ${key}`);
    assert.ok(ai.includes(key), `activation workflow must configure ${key}`);
  }
  assert.ok(access.includes('public Turnstile when RIAI_PUBLIC_AI_ENABLED=true'));
  assert.ok(!access.includes('still enforces its own server-side Access JWT boundary'));
});

const failed = results.filter((entry) => entry[1] !== 'PASS');
console.log(`PRODUCTION_MUTATION_WORKFLOW_HARDENING_RESULT=${failed.length === 0 ? 'PASS' : 'FAIL'} ${results.length - failed.length}/${results.length}`);
if (failed.length > 0) process.exit(1);
