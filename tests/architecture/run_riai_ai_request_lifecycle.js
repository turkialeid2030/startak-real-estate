'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { JSDOM } = require('jsdom');
const React = require('react');
const { createRoot } = require('react-dom/client');
const { requestResidentialIncomeAiAssist } = require('../../src/residential-income-acquisition/ai-assist-client');
const { readBoundedJson } = require('../../src/residential-income-acquisition/bounded-json-client');
const vm = { apiStatus: 'CASE_LOADED', caseId: 'same-case', asOfDate: '2026-09-03',
  summary: { unitCount: 2, leaseCount: 1, tenantCount: 1, evidenceLineageCount: 4 },
  blockers: [], evidenceGaps: [], dueDiligence: [],
  acquisitionAnalyticalScore: { status: 'CALCULATED', score: 75, scoreCoverage: 1, evidenceConfidence: 0.8, redFlags: [], components: [] } };
const never = () => new Promise(() => {});

(async () => {
  // Each stage must settle even when the transport ignores AbortSignal.
  for (const fetchImpl of [never, async () => ({ ok: true, json: never })]) {
    const result = await requestResidentialIncomeAiAssist(vm, { fetchImpl, turnstileToken: 'test', timeoutMs: 1000 });
    assert.equal(result.reasonCode, 'AI_ASSIST_TIMEOUT');
  }
  let posts = 0;
  const configTimeout = await requestResidentialIncomeAiAssist(vm, { timeoutMs: 1000, fetchImpl: (url) => {
    if (url.endsWith('ai-assist')) posts++;
    return never();
  } });
  assert.equal(configTimeout.reasonCode, 'AI_ASSIST_TIMEOUT');
  assert.equal(posts, 0);
  const controller = new AbortController();
  const cancelled = requestResidentialIncomeAiAssist(vm, { fetchImpl: never, signal: controller.signal });
  controller.abort();
  assert.equal((await cancelled).reasonCode, 'AI_ASSIST_CANCELLED');
  let bodyCancelled = false;
  const stream = new ReadableStream({ pull(c) { c.enqueue(new Uint8Array(40000)); }, cancel() { bodyCancelled = true; } });
  await assert.rejects(readBoundedJson(new Response(stream)), /RESPONSE_TOO_LARGE/);
  assert.equal(bodyCancelled, true);
  await assert.rejects(readBoundedJson(new Response('{bad')), SyntaxError);
  assert.deepEqual(await readBoundedJson(new Response('{"label":"عربي"}')), { label: 'عربي' });

  // Mount the actual JSX component, with only the network client replaced.
  const dom = new JSDOM('<div id="root"></div>');
  global.window = dom.window; global.document = dom.window.document;
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const { prepareTurnstileToken } = require('../../src/residential-income-acquisition/turnstile-client');
  const config = async () => new Response(JSON.stringify({ schemaVersion: 1, publicAiEnabled: true, turnstileSiteKey: 'test-key' }));
  const scriptController = new AbortController();
  const challenge = prepareTurnstileToken(config, { signal: scriptController.signal });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert(document.getElementById('startak-riai-turnstile-script'));
  scriptController.abort();
  assert.equal((await challenge).ok, false);
  assert.equal(document.getElementById('startak-riai-turnstile-script'), null, 'cancelled script is removed for retry');
  let removed = false;
  window.turnstile = { render: () => 'widget', execute: () => {}, remove: () => { removed = true; } };
  const widgetController = new AbortController();
  const widget = prepareTurnstileToken(config, { signal: widgetController.signal });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert(document.querySelector('[data-startak-turnstile]'));
  widgetController.abort();
  assert.equal((await widget).reasonCode, 'AI_ASSIST_CANCELLED');
  assert.equal(removed, true);
  assert.equal(document.querySelector('[data-startak-turnstile]'), null);
  const calls = [];
  const client = { AI_ASSIST_CLIENT_STATUS: { SUCCESS: 'SUCCESS' }, requestResidentialIncomeAiAssist: (_, options) => new Promise((resolve, reject) => calls.push({ resolve, reject, options })) };
  const file = path.resolve(__dirname, '../../src/components/ResidentialIncomeAiAssistPanel.jsx');
  const source = fs.readFileSync(file, 'utf8')
    .replace("import React from 'react';", "const React = require('react');")
    .replace("import aiAssistContract from '../residential-income-acquisition/ai-assist-contract';", "const aiAssistContract = require('../residential-income-acquisition/ai-assist-contract');")
    .replace("import aiAssistClient from '../residential-income-acquisition/ai-assist-client';", 'const aiAssistClient = client;')
    .replace('export default function ResidentialIncomeAiAssistPanel', 'function ResidentialIncomeAiAssistPanel');
  const { transformWithOxc } = await import('vite');
  const { code } = await transformWithOxc(source, file, { jsx: { runtime: 'classic' } });
  const Panel = new Function('require', 'client', code + '\nreturn ResidentialIncomeAiAssistPanel;')(createRequire(file), client);
  const root = createRoot(document.getElementById('root'));
  const render = (model) => React.act(async () => root.render(React.createElement(Panel, { viewModel: model })));
  const click = () => document.querySelector('button').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await render(vm);
  assert.equal(calls.length, 0, 'mount never makes a request');
  await React.act(async () => { click(); click(); });
  assert.equal(calls.length, 1, 'rapid clicks produce only one request');
  const changed = { ...vm, acquisitionAnalyticalScore: { ...vm.acquisitionAnalyticalScore, score: 60 } };
  await render(changed);
  assert.equal(calls[0].options.signal.aborted, true, 'same identity but changed score cancels old request');
  await React.act(async () => calls[0].resolve({ status: 'SUCCESS', result: { executiveObservations: ['STALE RESULT'] } }));
  assert(!document.body.textContent.includes('STALE RESULT'));
  await React.act(async () => click());
  await React.act(async () => calls[1].reject(new Error('network')));
  // Unexpected rejection is ambiguous: a provider charge may already exist.
  const button = () => document.querySelector('[data-testid="riai-ai-assist-run"]');
  const acknowledge = () => document.querySelector('[data-testid="riai-ai-retry-acknowledge"]');
  assert.equal(button().disabled, true, 'ambiguous failure blocks unacknowledged retry');
  assert(acknowledge(), 'explicit acknowledgement is visible');
  assert.equal(acknowledge().checked, false);
  await React.act(async () => click());
  assert.equal(calls.length, 2, 'unacknowledged retry never dispatches');
  await React.act(async () => acknowledge().click());
  assert.equal(acknowledge().checked, true);
  assert.equal(button().disabled, false);
  await React.act(async () => click());
  assert.equal(calls.length, 3, 'acknowledged retry dispatches exactly once');
  await React.act(async () => calls[2].resolve({status:'UNAVAILABLE',reasonCode:'AI_PROVIDER_TIMEOUT',potentialProviderCharge:true}));
  assert.equal(button().disabled, true, 'acknowledgement is consumed by each attempt');
  assert.equal(acknowledge().checked, false);
  await React.act(async () => acknowledge().click());
  await React.act(async () => click());
  assert.equal(calls.length, 4);
  await React.act(async () => calls[3].resolve({status:'UNAVAILABLE',reasonCode:'AI_PROVIDER_NOT_CONFIGURED',potentialProviderCharge:false}));
  assert.equal(acknowledge(), null, 'confirmed non-billable failure requires no acknowledgement');
  assert.equal(button().disabled, false);
  await React.act(async () => click());
  assert.equal(calls.length, 5);
  await React.act(async () => root.unmount());
  assert.equal(calls[4].options.signal.aborted, true);
  console.log('RIAI_RETRY_ACKNOWLEDGEMENT_DOM=PASS synthetic_only=true');
  dom.window.close();
  console.log('RIAI_AI_REQUEST_LIFECYCLE=PASS');
})().catch(error => { console.error(error); process.exitCode = 1; });
