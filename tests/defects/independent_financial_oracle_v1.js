'use strict';

const assert = require('assert');
const { calculateGovernedDcf, GOVERNED_DCF_STATUS } = require('../../src/valuation-intelligence/governed-dcf');
const { xnpv, solveDatedXirr } = require('../../src/valuation-intelligence/dated-returns');
const { monthlyAmortizationSchedule, minimumDscr } = require('../../src/engines/financial/monthly-debt');

const DAY_MS = 86400000;
const DAYS_PER_YEAR = 365.2425;
let cases = 0;
function check(name, fn) {
  fn();
  cases += 1;
  console.log(`PASS ${name}`);
}
function near(actual, expected, tolerance, message) {
  assert(Number.isFinite(actual), `${message || 'value'} must be finite`);
  assert(Math.abs(actual - expected) <= tolerance, `${message || 'value'}: expected ${expected}, got ${actual}`);
}
function utcDateOnly(value) {
  const [y, m, d] = value.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}
function oracleXnpv(rate, cashflows) {
  const sorted = [...cashflows].sort((a, b) => a.date.localeCompare(b.date));
  const base = utcDateOnly(sorted[0].date);
  return sorted.reduce((sum, row) => {
    const years = (utcDateOnly(row.date) - base) / DAY_MS / DAYS_PER_YEAR;
    return sum + row.amount / Math.pow(1 + rate, years);
  }, 0);
}
function oracleXirr(cashflows) {
  let lo = -0.9999;
  let hi = 100;
  let flo = oracleXnpv(lo, cashflows);
  let fhi = oracleXnpv(hi, cashflows);
  assert(Math.sign(flo) !== Math.sign(fhi), 'oracle root must be bracketed');
  for (let i = 0; i < 500; i += 1) {
    const mid = (lo + hi) / 2;
    const fmid = oracleXnpv(mid, cashflows);
    if (Math.abs(fmid) < 1e-7) return mid;
    if (Math.sign(fmid) === Math.sign(flo)) { lo = mid; flo = fmid; }
    else { hi = mid; fhi = fmid; }
  }
  return (lo + hi) / 2;
}
function evidence(sourceRef) {
  return {
    grade: 'E_MARKET_OBSERVATION',
    status: 'VERIFIED',
    sourceType: 'INDEPENDENT_ORACLE_TEST',
    sourceRef,
  };
}
function dcfBase(overrides = {}) {
  return {
    cashflows: [
      { date: '2026-01-01', amount: -1000000 },
      { date: '2026-07-01', amount: 100000 },
      { date: '2027-01-01', amount: 150000 },
    ],
    discountRate: 0.10,
    discountRateEvidence: evidence('discount-10pct'),
    terminalNoiSar: 80000,
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

check('dated XNPV matches independent ACT/365.2425 oracle', () => {
  const cashflows = [
    { date: '2026-01-01', amount: -1000000 },
    { date: '2026-07-01', amount: 100000 },
    { date: '2027-01-01', amount: 1050000 },
  ];
  near(xnpv(0.10, cashflows), oracleXnpv(0.10, cashflows), 1e-7, 'XNPV');
});

check('dated XIRR matches independent bisection oracle', () => {
  const cashflows = [
    { date: '2026-01-01', amount: -1000000 },
    { date: '2026-04-15', amount: 75000 },
    { date: '2026-10-20', amount: 110000 },
    { date: '2027-03-01', amount: 980000 },
  ];
  const result = solveDatedXirr({ cashflows });
  assert.strictEqual(result.status, 'QUALIFIED');
  near(result.xirr, oracleXirr(cashflows), 1e-8, 'XIRR');
  assert(Math.abs(oracleXnpv(result.xirr, cashflows)) <= result.npvToleranceSar + 1e-6);
});

check('governed DCF rejects impossible calendar terminal date', () => {
  const result = calculateGovernedDcf(dcfBase({ terminalDate: '2026-02-30' }));
  assert.strictEqual(result.status, GOVERNED_DCF_STATUS.HOLD);
  assert(result.blockers.includes('TERMINAL_DATE_INVALID'));
});

check('governed DCF rejects terminal date before operating cash-flow horizon', () => {
  const result = calculateGovernedDcf(dcfBase({ terminalDate: '2026-06-30' }));
  assert.strictEqual(result.status, GOVERNED_DCF_STATUS.HOLD);
  assert(result.blockers.includes('TERMINAL_DATE_PRECEDES_CASHFLOW_HORIZON'));
});

check('governed DCF valuation equals independent ACT/365.2425 oracle including net terminal proceeds', () => {
  const input = dcfBase();
  const result = calculateGovernedDcf(input);
  assert.notStrictEqual(result.status, GOVERNED_DCF_STATUS.HOLD);
  const terminalValue = input.terminalNoiSar / input.exitCapRate;
  const netTerminal = terminalValue * (1 - input.terminalSellingCostsRate);
  const combined = input.cashflows.map((row) => ({ ...row }));
  combined.push({ date: input.terminalDate, amount: netTerminal });
  near(result.terminalValueSar, terminalValue, 1e-7, 'terminal value');
  near(result.netTerminalValueSar, netTerminal, 1e-7, 'net terminal value');
  near(result.valuationIndicationSar, oracleXnpv(input.discountRate, combined), 1e-6, 'DCF PV');
  assert.strictEqual(result.dayCount, 'ACT/365.2425');
});

check('governed DCF does not invent a unique IRR when dated cash flows have multiple sign changes', () => {
  const result = calculateGovernedDcf(dcfBase({
    cashflows: [
      { date: '2026-01-01', amount: -1000000 },
      { date: '2026-06-01', amount: 3000000 },
      { date: '2027-01-01', amount: -2600000 },
    ],
    terminalNoiSar: 30000,
    exitCapRate: 0.10,
    exitEvidence: evidence('exit-10pct'),
    maxAbsoluteSpreadBps: 400,
  }));
  assert.notStrictEqual(result.status, GOVERNED_DCF_STATUS.HOLD);
  assert.strictEqual(result.xirr, null);
  assert(result.warnings.includes('XIRR_MULTIPLE_IRR_AMBIGUITY'));
});

check('governed DCF remains a valuation when all operating/terminal cash flows are positive and XIRR is not meaningful', () => {
  const result = calculateGovernedDcf(dcfBase({
    cashflows: [
      { date: '2026-01-01', amount: 100000 },
      { date: '2027-01-01', amount: 120000 },
    ],
  }));
  assert.notStrictEqual(result.status, GOVERNED_DCF_STATUS.HOLD);
  assert(Number.isFinite(result.valuationIndicationSar));
  assert.strictEqual(result.xirr, null);
  assert(result.warnings.includes('XIRR_CASHFLOW_SIGN_CHANGE_REQUIRED'));
});

check('monthly amortization payment matches independent annuity formula', () => {
  const principal = 1000000;
  const annualRate = 0.06;
  const years = 20;
  const months = years * 12;
  const r = annualRate / 12;
  const oraclePayment = principal * r / (1 - Math.pow(1 + r, -months));
  const result = monthlyAmortizationSchedule(principal, annualRate, years);
  near(result.scheduledMonthlyPayment, oraclePayment, 0.02, 'monthly payment');
  near(result.totalPayments - result.totalInterest, principal, 0.02, 'principal conservation');
  assert.strictEqual(result.schedule[result.schedule.length - 1].balance, 0);
});

check('interest-only grace preserves principal and charges monthly interest', () => {
  const result = monthlyAmortizationSchedule(1000000, 0.06, 20, { gracePeriodMonths: 12, graceType: 'INTEREST_ONLY' });
  for (const row of result.schedule.slice(0, 12)) {
    near(row.totalPayment, 5000, 0.01, 'grace payment');
    near(row.interest, 5000, 0.01, 'grace interest');
    near(row.balance, 1000000, 0.01, 'grace balance');
  }
});

check('capitalized grace compounds balance and makes no cash debt-service payment during grace', () => {
  const result = monthlyAmortizationSchedule(1000000, 0.06, 20, { gracePeriodMonths: 12, graceType: 'CAPITALIZED' });
  for (const row of result.schedule.slice(0, 12)) near(row.totalPayment, 0, 0.001, 'capitalized grace payment');
  const oracleBalance = 1000000 * Math.pow(1 + 0.06 / 12, 12);
  near(result.schedule[11].balance, oracleBalance, 0.25, 'capitalized grace balance');
});

check('minimum DSCR equals independent minimum NOI/debt-service ratio', () => {
  const noi = [150000, 160000, 170000];
  const debt = [100000, 120000, 110000];
  const oracle = Math.min(...noi.map((value, i) => value / debt[i]));
  near(minimumDscr(noi, debt), oracle, 1e-12, 'minimum DSCR');
});

console.log(`INDEPENDENT_FINANCIAL_ORACLE_CASES=${cases}`);
console.log('INDEPENDENT_FINANCIAL_ORACLE_RESULT=PASS');
