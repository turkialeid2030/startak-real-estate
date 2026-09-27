'use strict';

const assert = require('assert/strict');
const { calculateGovernedDcf, GOVERNED_DCF_STATUS } = require('../../src/valuation-intelligence/governed-dcf');
const { xnpv } = require('../../src/valuation-intelligence/dated-returns');
const {
  monthlyAmortizationSchedule,
  minimumDscr,
  sizeDebtByLtvAndDscr,
} = require('../../src/engines/financial/monthly-debt');

const DAY_MS = 86_400_000;
const DAYS_PER_YEAR = 365.2425;
let cases = 0;

function check(name, fn) {
  fn();
  cases += 1;
  console.log(`PASS ${name}`);
}

function close(actual, expected, tolerance, label) {
  assert.ok(Number.isFinite(actual), `${label}: expected finite result, got ${actual}`);
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: expected ${actual} ~= ${expected} within ${tolerance}`);
}

function epoch(date) {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function oracleXnpv(rate, flows) {
  const rows = [...flows].sort((a, b) => a.date.localeCompare(b.date));
  const base = epoch(rows[0].date);
  return rows.reduce((sum, row) => {
    const years = (epoch(row.date) - base) / DAY_MS / DAYS_PER_YEAR;
    return sum + row.amount / Math.pow(1 + rate, years);
  }, 0);
}

function evidence(ref) {
  return {
    grade: 'E_MARKET_OBSERVATION',
    status: 'VERIFIED',
    sourceType: 'INDEPENDENT_REFERENCE_VECTOR',
    sourceRef: ref,
  };
}

function dcfInput(overrides = {}) {
  return {
    cashflows: [
      { date: '2026-01-01', amount: -1_000_000 },
      { date: '2026-07-01', amount: 100_000 },
      { date: '2027-01-01', amount: 150_000 },
    ],
    discountRate: 0.10,
    discountRateEvidence: evidence('discount-10pct'),
    terminalNoiSar: 80_000,
    entryCapRate: 0.07,
    entryEvidence: evidence('entry-7pct'),
    exitCapRate: 0.075,
    exitEvidence: evidence('exit-7.5pct'),
    terminalDate: '2027-01-01',
    terminalSellingCostsRate: 0.02,
    maxAbsoluteSpreadBps: 200,
    ...overrides,
  };
}

check('valuation DCF equals independent ACT/365.2425 PV including net terminal proceeds', () => {
  const input = dcfInput();
  const result = calculateGovernedDcf(input);
  assert.notEqual(result.status, GOVERNED_DCF_STATUS.HOLD);
  const terminalValue = input.terminalNoiSar / input.exitCapRate;
  const netTerminal = terminalValue * (1 - input.terminalSellingCostsRate);
  const combined = [...input.cashflows, { date: input.terminalDate, amount: netTerminal }];
  close(result.terminalValueSar, terminalValue, 1e-7, 'terminal value');
  close(result.netTerminalValueSar, netTerminal, 1e-7, 'net terminal value');
  close(result.valuationIndicationSar, oracleXnpv(input.discountRate, combined), 1e-6, 'DCF indication');
  close(result.valuationIndicationSar, xnpv(input.discountRate, combined), 1e-7, 'DCF vs governed XNPV');
});

check('valuation DCF fails closed on impossible terminal calendar date', () => {
  const result = calculateGovernedDcf(dcfInput({ terminalDate: '2026-02-30' }));
  assert.equal(result.status, GOVERNED_DCF_STATUS.HOLD);
  assert.ok(result.blockers.includes('TERMINAL_DATE_INVALID'));
});

check('valuation DCF fails closed when terminal date precedes operating horizon', () => {
  const result = calculateGovernedDcf(dcfInput({ terminalDate: '2026-06-30' }));
  assert.equal(result.status, GOVERNED_DCF_STATUS.HOLD);
  assert.ok(result.blockers.includes('TERMINAL_DATE_PRECEDES_OPERATING_CASHFLOW'));
});

check('interest-only grace preserves principal and charges exact monthly interest', () => {
  const plan = monthlyAmortizationSchedule(1_000_000, 0.06, 20, {
    gracePeriodMonths: 12,
    graceType: 'INTEREST_ONLY',
  });
  assert.equal(plan.schedule.length, 240);
  for (const row of plan.schedule.slice(0, 12)) {
    close(row.totalPayment, 5_000, 0.01, 'IO grace payment');
    close(row.interest, 5_000, 0.01, 'IO grace interest');
    close(row.balance, 1_000_000, 0.01, 'IO grace balance');
    close(row.principal, 0, 0.001, 'IO grace principal');
  }
});

check('capitalized grace compounds principal with no cash debt service during grace', () => {
  const plan = monthlyAmortizationSchedule(1_000_000, 0.06, 20, {
    gracePeriodMonths: 12,
    graceType: 'CAPITALIZED',
  });
  for (const row of plan.schedule.slice(0, 12)) close(row.totalPayment, 0, 0.001, 'capitalized grace cash payment');
  const oracleBalance = 1_000_000 * Math.pow(1 + 0.06 / 12, 12);
  close(plan.schedule[11].balance, oracleBalance, 0.25, 'capitalized grace balance');
  close(plan.schedule[plan.schedule.length - 1].balance, 0, 0.01, 'capitalized final balance');
});

check('minimum DSCR equals independent minimum annual NOI/debt-service ratio', () => {
  const noi = [150_000, 160_000, 170_000];
  const debt = [100_000, 120_000, 110_000];
  const oracle = Math.min(...noi.map((value, index) => value / debt[index]));
  close(minimumDscr(noi, debt), oracle, 1e-10, 'minimum DSCR');
});

check('DSCR-constrained debt sizing does not exceed LTV and meets threshold to halala precision', () => {
  const result = sizeDebtByLtvAndDscr({
    costBase: 10_000_000,
    ltv: 0.70,
    annualNoi: [500_000, 520_000, 540_000, 560_000, 580_000],
    minDscrThreshold: 1.25,
    annualRate: 0.06,
    tenorYears: 20,
  });
  assert.ok(result.loanAmount <= 7_000_000);
  assert.equal(result.bindingConstraint, 'DSCR');
  assert.ok(result.dscrAtLoanAmount >= 1.25);
  const oneHalalaHigher = sizeDebtByLtvAndDscr({
    costBase: result.loanAmount + 0.01,
    ltv: 1,
    annualNoi: [500_000, 520_000, 540_000, 560_000, 580_000],
    minDscrThreshold: 1.25,
    annualRate: 0.06,
    tenorYears: 20,
  });
  assert.ok(oneHalalaHigher.loanAmount <= result.loanAmount + 0.01);
});

console.log(`FINANCIAL_INDEPENDENT_REFERENCE_VECTORS_V3_CASES=${cases}`);
console.log('financial_independent_reference_vectors_v3: PASS');
