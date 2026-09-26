'use strict';

const assert = require('assert');
const { BASIS_OF_VALUE, EVIDENCE_GRADE, INPUT_STATUS } = require('../../src/valuation-intelligence/contracts');
const {
  WORKFLOW_RECONCILIATION_STATUS,
  normalizeTransactionCosts,
  reconcileGovernedAcquisitionValuation,
} = require('../../src/valuation-intelligence/workflow-reconciliation');

const observed = (sourceRef) => ({ grade: EVIDENCE_GRADE.E_MARKET_OBSERVATION, status: INPUT_STATUS.OBSERVED, sourceType: 'MARKET_RESEARCH', sourceRef, observedAt: '2026-09-25' });
const actual = (sourceRef) => ({ grade: EVIDENCE_GRADE.D_OPERATING_ACTUAL, status: INPUT_STATUS.VERIFIED, sourceType: 'OPERATING_LEDGER', sourceRef, observedAt: '2026-09-25' });

const directCapInput = {
  incomeAnalysis: { stabilizedIncome: { potentialGrossIncomeSar: 1200000, vacancyLossSar: 60000, creditLossSar: 22800, annualConcessionsSar: 12000, annualOtherOperatingIncomeSar: 24000, effectiveGrossIncomeSar: 1129200, normalizedAnnualOpexSar: 329200, stabilizedNoiSar: 800000 } },
  marketCapRate: 0.08,
  incomeEvidence: actual('rent-roll'),
  expenseEvidence: actual('opex-ledger'),
  capRateEvidence: observed('entry-cap'),
  basis: BASIS_OF_VALUE.MARKET_VALUE,
  valuationDate: '2026-09-25',
  opexAllocation: { recoverableOperatingExpensesSar: 0, nonRecoverableOperatingExpensesSar: 300000, otherOperatingExpensesSar: 29200 },
};

const dcfInput = {
  cashflows: [
    { date: '2026-09-25', amount: -10000000 },
    { date: '2027-09-25', amount: 900000 },
    { date: '2028-09-25', amount: 950000 },
    { date: '2029-09-25', amount: 1000000 },
  ],
  discountRate: 0.1,
  discountRateEvidence: observed('discount-rate'),
  terminalNoiSar: 1050000,
  entryCapRate: 0.08,
  entryEvidence: observed('entry-cap'),
  exitCapRate: 0.08,
  exitEvidence: observed('exit-cap'),
  terminalDate: '2029-09-25',
  terminalSellingCostsRate: 0.02,
};

const costs = normalizeTransactionCosts({ rettSar: 500000, vatSar: 10000, brokerageSar: 100000, legalSar: 25000, dueDiligenceSar: 15000, financingSar: 50000, disposalSar: 120000 });
assert.strictEqual(costs.acquisitionTotalSar, 700000);
assert.strictEqual(costs.totalSar, 820000);

const qualified = reconcileGovernedAcquisitionValuation({ directCapInput, dcfInput, transactionCosts: costs, materialVarianceThreshold: 0.5 });
assert.ok([WORKFLOW_RECONCILIATION_STATUS.QUALIFIED, WORKFLOW_RECONCILIATION_STATUS.REVIEW_REQUIRED].includes(qualified.status));
assert.strictEqual(qualified.directCap.valuationIndication.components.netOperatingIncome, 800000);
assert.strictEqual(qualified.transactionCosts.rettSar, 500000);
assert.strictEqual(qualified.reconciliation.reconciledValueSar, null);
assert.strictEqual(qualified.reconciliation.weightingApplied, false);
assert.strictEqual(qualified.humanDecisionRequired, true);
assert.strictEqual(qualified.transactionAuthorized, false);

const missingExit = reconcileGovernedAcquisitionValuation({ directCapInput, dcfInput: { ...dcfInput, exitEvidence: null }, materialVarianceThreshold: 0.5 });
assert.strictEqual(missingExit.status, WORKFLOW_RECONCILIATION_STATUS.HOLD);
assert.strictEqual(missingExit.reconciliation, null);
assert.ok(missingExit.blockers.includes('DCF_NOT_QUALIFIED'));

const conflictingIncome = reconcileGovernedAcquisitionValuation({ directCapInput: { ...directCapInput, incomeEvidence: { ...actual('rent-roll-conflict'), status: INPUT_STATUS.CONFLICT } }, dcfInput, materialVarianceThreshold: 0.5 });
assert.strictEqual(conflictingIncome.status, WORKFLOW_RECONCILIATION_STATUS.HOLD);
assert.ok(conflictingIncome.blockers.includes('DIRECT_CAP_NOT_QUALIFIED'));

const materialVariance = reconcileGovernedAcquisitionValuation({ directCapInput, dcfInput, materialVarianceThreshold: 0 });
assert.strictEqual(materialVariance.status, WORKFLOW_RECONCILIATION_STATUS.REVIEW_REQUIRED);
assert.ok(materialVariance.warnings.includes('MATERIAL_METHOD_VARIANCE_REVIEW_REQUIRED'));
assert.strictEqual(materialVariance.readyForDecisionControl, false);

const noThreshold = reconcileGovernedAcquisitionValuation({ directCapInput, dcfInput });
assert.strictEqual(noThreshold.status, WORKFLOW_RECONCILIATION_STATUS.HOLD);
assert.ok(noThreshold.blockers.includes('MATERIAL_VARIANCE_THRESHOLD_REQUIRED'));

const invalidCost = reconcileGovernedAcquisitionValuation({ directCapInput, dcfInput, transactionCosts: { rettSar: -1 }, materialVarianceThreshold: 0.5 });
assert.strictEqual(invalidCost.status, WORKFLOW_RECONCILIATION_STATUS.HOLD);
assert.ok(invalidCost.blockers.some((item) => item.startsWith('TRANSACTION_COSTS_INVALID:')));

console.log('financial_integrity_p5_workflow_reconciliation: PASS');
