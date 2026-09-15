'use strict';

const assert = require('assert');
const { evaluateFinancialHardGates } = require('../../src/decision-governance/financial-hard-gates');

const base = {
  npv: 100, irr: 0.12, irrReliability: 'RELIABLE', mirr: 0.11, requiredReturn: 0.1,
  noi: 1000, exitCapRate: 0.07, terminalValue: 10000, acquisitionBasis: 5000,
  holdingPeriod: 5, rentableArea: 1000, leasedArea: 900, leverageEnabled: false,
  percentages: { occupancy: 0.9, capRate: 0.07 },
};

assert.strictEqual(evaluateFinancialHardGates(base).status, 'PASS');
assert.ok(evaluateFinancialHardGates({ ...base, npv: -1 }).failures.includes('NPV_NEGATIVE'));
assert.ok(evaluateFinancialHardGates({ ...base, irr: 0.08 }).failures.includes('IRR_BELOW_REQUIRED_RETURN'));
assert.ok(evaluateFinancialHardGates({ ...base, irrReliability: 'MULTIPLE_ROOT_RISK' }).failures.includes('IRR_UNRELIABLE'));
assert.ok(evaluateFinancialHardGates({ ...base, noi: 0 }).failures.includes('NOI_NON_POSITIVE'));
assert.strictEqual(evaluateFinancialHardGates({ ...base, exitCapRate: null }).status, 'INCOMPLETE');
assert.ok(evaluateFinancialHardGates({ ...base, terminalValue: -1 }).failures.includes('TERMINAL_VALUE_NEGATIVE'));
assert.ok(evaluateFinancialHardGates({ ...base, acquisitionBasis: 0 }).failures.includes('ACQUISITION_BASIS_INVALID'));
assert.ok(evaluateFinancialHardGates({ ...base, holdingPeriod: 0 }).failures.includes('HOLDING_PERIOD_INVALID'));
assert.ok(evaluateFinancialHardGates({ ...base, leasedArea: 1100 }).failures.includes('LEASED_AREA_EXCEEDS_RENTABLE_AREA'));
assert.ok(evaluateFinancialHardGates({ ...base, rentableArea: -1 }).failures.includes('RENTABLE_AREA_INVALID'));
assert.ok(evaluateFinancialHardGates({ ...base, npv: Infinity }).failures.includes('NPV_NON_FINITE'));
assert.ok(evaluateFinancialHardGates({ ...base, percentages: { occupancy: 1.1 } }).failures.includes('PERCENTAGE_INVALID:occupancy'));

let r = evaluateFinancialHardGates({ ...base, leverageEnabled: true, leveredNPV: -5, dscr: 1.1, minDscrThreshold: 1.25, loanAmount: 1000 });
assert.ok(r.failures.includes('LEVERED_NPV_NEGATIVE'));
assert.ok(r.failures.includes('DSCR_BELOW_THRESHOLD'));
r = evaluateFinancialHardGates({ ...base, leverageEnabled: true, leveredNPV: 5, dscr: 1.3, minDscrThreshold: 1.25, loanAmount: 0 });
assert.ok(r.failures.includes('LOAN_AMOUNT_INVALID'));

console.log('FINANCIAL_HARD_GATES_TESTS=PASS');
