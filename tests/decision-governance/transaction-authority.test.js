'use strict';

const assert = require('assert');
const {
  DEFAULT_TRANSACTION_AUTHORITY,
  authorityView,
  createUiWorkspace,
  hydrateUiDeal,
} = require('../../src/assumptions/ui-integration-controller');
const { TRANSACTION_AUTHORITY } = require('../../src/decision-governance/overall-decision-gate');

const defaults = { buildingPrice: 1, leverageEnabled: false };

assert.strictEqual(DEFAULT_TRANSACTION_AUTHORITY, TRANSACTION_AUTHORITY.ANALYSIS_ONLY);
assert.deepStrictEqual(authorityView(), {
  transactionAuthority: TRANSACTION_AUTHORITY.ANALYSIS_ONLY,
  transactionAuthorized: false,
});

const fresh = createUiWorkspace({ mode: 'building', defaultInputs: defaults });
assert.strictEqual(fresh.transactionAuthority, TRANSACTION_AUTHORITY.ANALYSIS_ONLY);
assert.strictEqual(fresh.transactionAuthorized, false);

const hydrated = hydrateUiDeal({
  record: {
    id: 'legacy-authority-attempt',
    name: 'Legacy authority attempt',
    mode: 'building',
    inputs: { buildingPrice: 1, leverageEnabled: false },
    savedAt: '2026-09-15T00:00:00.000Z',
    transactionAuthority: TRANSACTION_AUTHORITY.EXECUTION_AUTHORIZED,
    transactionAuthorized: true,
  },
  defaultInputs: defaults,
});
assert.strictEqual(hydrated.transactionAuthority, TRANSACTION_AUTHORITY.ANALYSIS_ONLY, 'saved deal data must not self-grant execution authority');
assert.strictEqual(hydrated.transactionAuthorized, false);

assert.deepStrictEqual(authorityView(TRANSACTION_AUTHORITY.INTERNAL_REVIEW), {
  transactionAuthority: TRANSACTION_AUTHORITY.INTERNAL_REVIEW,
  transactionAuthorized: false,
});
assert.deepStrictEqual(authorityView(TRANSACTION_AUTHORITY.IC_AUTHORIZED), {
  transactionAuthority: TRANSACTION_AUTHORITY.IC_AUTHORIZED,
  transactionAuthorized: false,
});
assert.deepStrictEqual(authorityView(TRANSACTION_AUTHORITY.EXECUTION_AUTHORIZED), {
  transactionAuthority: TRANSACTION_AUTHORITY.EXECUTION_AUTHORIZED,
  transactionAuthorized: true,
});
assert.throws(() => authorityView('FINANCIAL_PASS'), /Unsupported transaction authority/);

console.log('TRANSACTION_AUTHORITY_TESTS=PASS');
