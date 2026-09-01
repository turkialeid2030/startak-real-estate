'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '../..');
const mainPath = path.join(repoRoot, 'src/main.jsx');
const main = fs.readFileSync(mainPath, 'utf8');

const prohibitedAmbientGlobals = [
  '__STARTAK_DECISION_INTELLIGENCE_WORKSPACE__',
  '__STARTAK_INVESTMENT_COMMITTEE_DOSSIER__',
  '__STARTAK_DECISION_ACTION_REVIEW_REGISTER__',
  '__STARTAK_OUTCOME_FEEDBACK__',
  '__STARTAK_DECISION_LEARNING_REVIEW__',
  '__STARTAK_HUMAN_COMMITTEE_DECISION_RECORD__',
];

let checks = 0;
function check(name, fn) {
  fn();
  checks += 1;
  console.log(`PASS ${name}`);
}

check('main entrypoint does not consume governance-grade payloads from ambient window globals', () => {
  for (const token of prohibitedAmbientGlobals) {
    assert.strictEqual(main.includes(token), false, `ambient governance global still present: ${token}`);
  }
  assert.strictEqual(main.includes('window.__STARTAK_'), false);
});

check('main entrypoint no longer conditionally mounts advanced governance panels from ambient payloads', () => {
  assert.strictEqual(main.includes('runtimeDecisionWorkspace'), false);
  assert.strictEqual(main.includes('runtimeCommitteeDossier'), false);
  assert.strictEqual(main.includes('runtimeOutcomeFeedback'), false);
  assert.strictEqual(main.includes('DecisionIntelligenceWorkspacePanel'), false);
  assert.strictEqual(main.includes('InvestmentCommitteeDossierPanel'), false);
  assert.strictEqual(main.includes('OutcomeMonitoringPanel'), false);
});

check('runtime build metadata installation remains intact and separate from governance payloads', () => {
  assert.ok(main.includes("require('./runtime/build-metadata.js')"));
  assert.ok(main.includes('installRuntimeBuildMetadata()'));
});

check('core application and locale provider remain mounted', () => {
  assert.ok(main.includes('<LocaleProvider defaultLocale="ar-SA">'));
  assert.ok(main.includes('<App />'));
});

console.log(`NO_AMBIENT_GOVERNANCE_WINDOW_INJECTION_V1=PASS checks=${checks}`);
