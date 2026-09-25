'use strict';

const assert = require('assert');
const { calculateGovernedDcf, GOVERNED_DCF_STATUS } = require('../../src/valuation-intelligence/governed-dcf');
const { EVIDENCE_GRADE, INPUT_STATUS } = require('../../src/valuation-intelligence/contracts');

const observed = (sourceRef) => ({ grade: EVIDENCE_GRADE.B, status: INPUT_STATUS.OBSERVED, sourceType: 'MARKET_RESEARCH', sourceRef, observedAt: '2026-09-25' });
const cashflows = [
  { date: '2026-09-25', amount: -10000000 },
  { date: '2027-09-25', amount: 900000 },
  { date: '2028-09-25', amount: 950000 },
  { date: '2029-09-25', amount: 1000000 },
];

const base = {
  cashflows,
  discountRate: 0.1,
  discountRateEvidence: observed('discount-rate-study'),
  terminalNoiSar: 1050000,
  entryCapRate: 0.075,
  entryEvidence: observed('entry-cap-comps'),
  exitCapRate: 0.08,
  exitEvidence: observed('exit-cap-forward-study'),
  terminalDate: '2029-09-25',
  terminalSellingCostsRate: 0.02,
};

const qualified = calculateGovernedDcf(base);
assert.strictEqual(qualified.status, GOVERNED_DCF_STATUS.QUALIFIED);
assert.ok(Number.isFinite(qualified.valuationIndicationSar));
assert.strictEqual(qualified.terminalValueSar, 13125000);
assert.strictEqual(qualified.netTerminalValueSar, 12862500);

const missingExitEvidence = calculateGovernedDcf({ ...base, exitEvidence: null });
assert.strictEqual(missingExitEvidence.status, GOVERNED_DCF_STATUS.HOLD);
assert.strictEqual(missingExitEvidence.valuationIndicationSar, null);

const missingDiscountEvidence = calculateGovernedDcf({ ...base, discountRateEvidence: null });
assert.strictEqual(missingDiscountEvidence.status, GOVERNED_DCF_STATUS.HOLD);

const conflictDiscount = calculateGovernedDcf({ ...base, discountRateEvidence: { ...observed('discount-conflict'), status: INPUT_STATUS.CONFLICT } });
assert.strictEqual(conflictDiscount.status, GOVERNED_DCF_STATUS.HOLD);

const sameRateNoRationale = calculateGovernedDcf({ ...base, exitCapRate: 0.075, exitEvidence: observed('entry-cap-comps') });
assert.strictEqual(sameRateNoRationale.status, GOVERNED_DCF_STATUS.REVIEW_REQUIRED);

const sameRateRationaled = calculateGovernedDcf({ ...base, exitCapRate: 0.075, exitEvidence: observed('entry-cap-comps'), sameRateRationale: 'Forward evidence supports a flat capitalization-rate assumption.' });
assert.strictEqual(sameRateRationaled.status, GOVERNED_DCF_STATUS.QUALIFIED);

const compressionNoRationale = calculateGovernedDcf({ ...base, exitCapRate: 0.07 });
assert.strictEqual(compressionNoRationale.status, GOVERNED_DCF_STATUS.REVIEW_REQUIRED);

const compressionRationaled = calculateGovernedDcf({ ...base, exitCapRate: 0.07, capCompressionRationale: 'Forward market evidence explicitly supports compression.' });
assert.strictEqual(compressionRationaled.status, GOVERNED_DCF_STATUS.QUALIFIED);

const assumedDiscount = calculateGovernedDcf({ ...base, discountRateEvidence: { ...observed('discount-assumption'), status: INPUT_STATUS.ASSUMED } });
assert.strictEqual(assumedDiscount.status, GOVERNED_DCF_STATUS.REVIEW_REQUIRED);

const invalidSellingCost = calculateGovernedDcf({ ...base, terminalSellingCostsRate: 1 });
assert.strictEqual(invalidSellingCost.status, GOVERNED_DCF_STATUS.HOLD);

console.log('financial_integrity_p4_governed_dcf: PASS');
