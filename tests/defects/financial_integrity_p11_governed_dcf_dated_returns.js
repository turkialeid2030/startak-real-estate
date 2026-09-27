'use strict';

const assert = require('assert');
const {
  GOVERNED_DCF_VERSION,
  GOVERNED_DCF_STATUS,
  calculateGovernedDcf,
} = require('../../src/valuation-intelligence/governed-dcf');
const { DATED_RETURNS_STATUS } = require('../../src/valuation-intelligence/dated-returns');

const DAY_MS = 86400000;
const DAYS_PER_YEAR = 365.2425;

const verifiedMarketEvidence = (sourceRef) => ({
  grade: 'E_MARKET_OBSERVATION',
  status: 'VERIFIED',
  sourceType: 'INDEPENDENT_AUDIT_MARKET_INPUT',
  sourceRef,
});

function utcDate(dateOnly) {
  const [y, m, d] = dateOnly.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function independentXnpv(rate, cashflows) {
  const ordered = [...cashflows].sort((a, b) => utcDate(a.date) - utcDate(b.date));
  const d0 = utcDate(ordered[0].date);
  return ordered.reduce((sum, row) => {
    const years = (utcDate(row.date) - d0) / (DAYS_PER_YEAR * DAY_MS);
    return sum + row.amount / Math.pow(1 + rate, years);
  }, 0);
}

function baseInput(overrides = {}) {
  return {
    cashflows: [
      { date: '2026-01-01', amount: -10000000 },
      { date: '2027-01-01', amount: 1000000 },
      { date: '2028-01-01', amount: 1050000 },
    ],
    discountRate: 0.09,
    discountRateEvidence: verifiedMarketEvidence('DISCOUNT-2026-09-27'),
    terminalNoiSar: 1100000,
    entryCapRate: 0.07,
    entryEvidence: verifiedMarketEvidence('ENTRY-CAP-2026-09-27'),
    exitCapRate: 0.075,
    exitEvidence: verifiedMarketEvidence('EXIT-CAP-2026-09-27'),
    terminalDate: '2028-12-31',
    terminalSellingCostsRate: 0.02,
    ...overrides,
  };
}

let assertions = 0;
function check(condition, message) {
  assert.ok(condition, message);
  assertions += 1;
}
function equal(actual, expected, message) {
  assert.strictEqual(actual, expected, message);
  assertions += 1;
}

// 1) Independent arithmetic parity: DCF must use ACT/365.2425 strict dated discounting.
{
  const input = baseInput();
  const result = calculateGovernedDcf(input);
  const terminalValue = input.terminalNoiSar / input.exitCapRate;
  const netTerminal = terminalValue * (1 - input.terminalSellingCostsRate);
  const expected = independentXnpv(input.discountRate, [
    ...input.cashflows,
    { date: input.terminalDate, amount: netTerminal },
  ]);

  equal(result.version, 'GOVERNED_DCF_V2', 'governed DCF must expose V2 strict dated-return contract');
  equal(GOVERNED_DCF_VERSION, 'GOVERNED_DCF_V2', 'exported governed DCF version must be V2');
  equal(result.status, GOVERNED_DCF_STATUS.QUALIFIED, 'clean independently evidenced DCF should qualify');
  check(Math.abs(result.valuationIndicationSar - expected) < 0.01, 'DCF XNPV must match independent ACT/365.2425 arithmetic to less than SAR 0.01');
  check(Math.abs(result.terminalValueSar - terminalValue) < 0.01, 'terminal value must equal terminal NOI divided by exit cap rate');
  check(Math.abs(result.netTerminalValueSar - netTerminal) < 0.01, 'net terminal value must deduct selling costs exactly once');
  equal(result.xirrStatus, DATED_RETURNS_STATUS.QUALIFIED, 'single-sign-change dated cash flow must produce qualified XIRR');
  check(Number.isFinite(result.xirr), 'qualified XIRR must be finite');
  equal(result.dayCount, 'ACT/365.2425', 'DCF must disclose ACT/365.2425 day count');
  equal(result.transactionAuthorized, false, 'DCF must not grant transaction authority');
  equal(result.humanDecisionRequired, true, 'DCF must require human decision');
}

// 2) Impossible calendar dates must fail closed instead of JavaScript date normalization.
{
  const result = calculateGovernedDcf(baseInput({
    cashflows: [
      { date: '2026-01-01', amount: -10000000 },
      { date: '2026-02-30', amount: 1000000 },
    ],
  }));
  equal(result.status, GOVERNED_DCF_STATUS.HOLD, 'impossible operating cash-flow date must HOLD');
  check(result.blockers.includes('DATED_CASHFLOW_INVALID'), 'impossible operating date must emit DATED_CASHFLOW_INVALID');
}

// 3) Timestamp-form dates are rejected: governed DCF accepts canonical YYYY-MM-DD only.
{
  const result = calculateGovernedDcf(baseInput({
    cashflows: [
      { date: '2026-01-01', amount: -10000000 },
      { date: '2027-01-01T00:00:00Z', amount: 1000000 },
    ],
  }));
  equal(result.status, GOVERNED_DCF_STATUS.HOLD, 'non-canonical timestamp date must HOLD');
  check(result.blockers.includes('DATED_CASHFLOW_INVALID'), 'timestamp date must emit DATED_CASHFLOW_INVALID');
}

// 4) Impossible terminal dates must fail closed.
{
  const result = calculateGovernedDcf(baseInput({ terminalDate: '2028-02-30' }));
  equal(result.status, GOVERNED_DCF_STATUS.HOLD, 'impossible terminal date must HOLD');
  check(result.blockers.includes('TERMINAL_DATE_INVALID'), 'impossible terminal date must emit TERMINAL_DATE_INVALID');
}

// 5) Terminal date cannot precede the final modeled operating cash flow.
{
  const result = calculateGovernedDcf(baseInput({ terminalDate: '2027-06-30' }));
  equal(result.status, GOVERNED_DCF_STATUS.HOLD, 'terminal date before final operating cash flow must HOLD');
  check(result.blockers.includes('TERMINAL_DATE_PRECEDES_LAST_CASHFLOW'), 'terminal chronology violation must be explicit');
}

// 6) Multiple IRR ambiguity must not be hidden behind an arbitrary root.
{
  const result = calculateGovernedDcf(baseInput({
    cashflows: [
      { date: '2026-01-01', amount: -100 },
      { date: '2027-01-01', amount: 230 },
      { date: '2028-01-01', amount: -132 },
    ],
    terminalNoiSar: 1,
    exitCapRate: 0.10,
    exitEvidence: verifiedMarketEvidence('EXIT-CAP-MULTI-IRR'),
    terminalDate: '2029-01-01',
    terminalSellingCostsRate: 0,
  }));
  equal(result.status, GOVERNED_DCF_STATUS.REVIEW_REQUIRED, 'multiple-IRR case should preserve NPV but require review');
  equal(result.xirr, null, 'multiple-IRR case must not assert an arbitrary XIRR');
  equal(result.xirrStatus, DATED_RETURNS_STATUS.HOLD, 'multiple-IRR solver status must be HOLD');
  check(result.xirrBlockers.includes('MULTIPLE_IRR_AMBIGUITY'), 'multiple-IRR ambiguity must be explicit');
  check(result.warnings.includes('XIRR_UNAVAILABLE:MULTIPLE_IRR_AMBIGUITY'), 'DCF review warning must expose multiple-IRR ambiguity');
  check(Number.isFinite(result.valuationIndicationSar), 'NPV remains mathematically usable when XIRR is ambiguous');
}

console.log(`financial_integrity_p11_governed_dcf_dated_returns: PASS (${assertions} assertions)`);
