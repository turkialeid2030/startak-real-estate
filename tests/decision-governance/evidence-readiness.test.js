'use strict';
const assert = require('assert');
const { evaluateEvidenceReadiness } = require('../../src/decision-governance/evidence-readiness');

const good = { sourceName: 'Official', sourceDate: '2026-09-01', required: true, evidenceGrade: 'A', maxAgeDays: 90 };
const icReady = {
  items: [good], asOf: '2026-09-15', comparableCount: 3, minimumComparableCount: 3,
  locationComparability: true, assetTypeComparability: true, transactionTypeComparability: true,
  adjustmentsRequired: true, adjustmentsCompleted: true,
};

function run() {
  let r = evaluateEvidenceReadiness({ items: [] });
  assert.strictEqual(r.status, 'NOT_STARTED');

  r = evaluateEvidenceReadiness(icReady);
  assert.strictEqual(r.status, 'SUFFICIENT_FOR_IC');

  r = evaluateEvidenceReadiness({ ...icReady, transactionTypeComparability: false });
  assert.strictEqual(r.status, 'SUFFICIENT_FOR_ANALYSIS');
  assert.ok(r.reasonCodes.includes('TRANSACTION_TYPE_NOT_COMPARABLE'));

  r = evaluateEvidenceReadiness({ ...icReady, adjustmentsCompleted: false });
  assert.strictEqual(r.status, 'SUFFICIENT_FOR_ANALYSIS');
  assert.ok(r.reasonCodes.includes('REQUIRED_ADJUSTMENTS_INCOMPLETE'));

  r = evaluateEvidenceReadiness({ ...icReady, comparableCount: 2 });
  assert.strictEqual(r.status, 'SUFFICIENT_FOR_ANALYSIS');
  assert.ok(r.reasonCodes.includes('INSUFFICIENT_COMPARABLE_COUNT'));

  r = evaluateEvidenceReadiness({ items: [{ ...good, sourceDate: '2025-01-01' }], asOf: '2026-09-15' });
  assert.strictEqual(r.status, 'STALE');

  r = evaluateEvidenceReadiness({ items: [{ ...good, conflicted: true }], asOf: '2026-09-15' });
  assert.strictEqual(r.status, 'CONFLICTED');

  r = evaluateEvidenceReadiness({ items: [{ ...good, sourceDate: null }] });
  assert.strictEqual(r.status, 'INSUFFICIENT');

  console.log('EVIDENCE_READINESS_TESTS=PASS');
}
run();
