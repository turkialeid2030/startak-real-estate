'use strict';
const assert = require('assert');
const { TRANSACTION_AUTHORITY } = require('../../src/decision-governance/overall-decision-gate');
const {
  DEFAULT_TRANSACTION_AUTHORITY,
  authorityView,
  createUiWorkspace,
} = require('../../src/assumptions/ui-integration-controller');

assert.strictEqual(DEFAULT_TRANSACTION_AUTHORITY, TRANSACTION_AUTHORITY.ANALYSIS_ONLY);

const analysis = authorityView();
assert.strictEqual(analysis.transactionAuthority, 'ANALYSIS_ONLY');
assert.strictEqual(analysis.transactionAuthorized, false);

for (const authority of ['NONE', 'ANALYSIS_ONLY', 'INTERNAL_REVIEW', 'IC_AUTHORIZED']) {
  const view = authorityView(authority);
  assert.strictEqual(view.transactionAuthorized, false, `${authority} must not authorize execution`);
}

const execution = authorityView('EXECUTION_AUTHORIZED');
assert.strictEqual(execution.transactionAuthorized, true);
assert.strictEqual(execution.transactionAuthority, 'EXECUTION_AUTHORIZED');

assert.throws(() => authorityView('FINANCIAL_PASS'), /Unsupported transaction authority/);
assert.throws(() => authorityView('APPROVED'), /Unsupported transaction authority/);

const workspace = createUiWorkspace({ mode: 'building', defaultInputs: { exitCapRate: 0.07 } });
assert.strictEqual(workspace.transactionAuthority, 'ANALYSIS_ONLY');
assert.strictEqual(workspace.transactionAuthorized, false);
assert.strictEqual(Object.prototype.hasOwnProperty.call(workspace.inputs, 'exitCapRate'), false);

console.log('TRANSACTION_AUTHORITY_UI_TESTS=PASS');
