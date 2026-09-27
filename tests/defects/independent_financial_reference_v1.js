'use strict';

const assert = require('assert');
const {
  normalizedNoiWaterfall,
  directCapitalizationValue,
  dscr,
} = require('../../src/engines/financial/financial-integrity');
const {
  buildMonthlyDebtPlan,
  minimumDscr,
  sizeDebtByLtvAndDscr,
} = require('../../src/engines/financial/monthly-debt');
const {
  evaluateHighestAndBestUse,
  HBU_STATUS,
} = require('../../src/valuation-intelligence/hbu-land-bid');
const {
  solveDatedXirr,
  DATED_RETURNS_STATUS,
} = require('../../src/valuation-intelligence/dated-returns');
const {
  calculateGovernedDcf,
  GOVERNED_DCF_STATUS,
} = require('../../src/valuation-intelligence/governed-dcf');
const {
  EVIDENCE_GRADE,
  INPUT_STATUS,
} = require('../../src/valuation-intelligence/contracts');

function approx(actual, expected, tolerance, label) {
  assert.ok(Number.isFinite(actual), `${label}: expected finite value, got ${actual}`);
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} vs ${expected} (tol=${tolerance})`);
}

function independentMonthlyPayment(principal, annualRate, months) {
  if (annualRate === 0) return principal / months;
  const r = annualRate / 12;
  return principal * r / (1 - Math.pow(1 + r, -months));
}

const observed = (sourceRef) => ({
  grade: EVIDENCE_GRADE.E_MARKET_OBSERVATION,
  status: INPUT_STATUS.OBSERVED,
  sourceType: 'INDEPENDENT_REFERENCE',
  sourceRef,
  observedAt: '2026-09-27',
});

// A. NOI waterfall: independent arithmetic reference.
const noi = normalizedNoiWaterfall({
  potentialBaseRentSar: 12_000_000,
  otherPotentialIncomeSar: 600_000,
  vacancyLossSar: 900_000,
  collectionLossSar: 200_000,
  concessionsSar: 100_000,
  otherOperatingIncomeSar: 300_000,
  serviceChargeRecoveriesSar: 1_200_000,
  recoverableOperatingExpensesSar: 1_000_000,
  nonRecoverableOperatingExpensesSar: 2_200_000,
  otherOperatingExpensesSar: 300_000,
});
assert.strictEqual(noi.gpiSar, 12_600_000);
assert.strictEqual(noi.totalEconomicLossSar, 1_200_000);
assert.strictEqual(noi.egiSar, 12_900_000);
assert.strictEqual(noi.operatingExpensesSar, 3_500_000);
assert.strictEqual(noi.noiSar, 9_400_000);
approx(directCapitalizationValue(noi.noiSar, 0.075), 125_333_333.33333333, 0.01, 'direct capitalization value');

// B. Debt schedule: independently derived ordinary-annuity reference.
const principalSar = 60_000_000;
const annualRate = 0.06;
const tenorYears = 15;
const expectedMonthlyPayment = independentMonthlyPayment(principalSar, annualRate, tenorYears * 12);
const debtPlan = buildMonthlyDebtPlan(principalSar, annualRate, tenorYears);
approx(debtPlan.scheduledMonthlyPayment, expectedMonthlyPayment, 1.00, 'monthly debt payment');
const expectedYear1DebtService = expectedMonthlyPayment * 12;
approx(debtPlan.annualDebtService[0], expectedYear1DebtService, 12.00, 'year-1 debt service');
const expectedDscr = 8_000_000 / expectedYear1DebtService;
approx(dscr(8_000_000, debtPlan.annualDebtService[0]), expectedDscr, 0.00001, 'DSCR');
approx(minimumDscr(Array(15).fill(8_000_000), debtPlan.annualDebtService), expectedDscr, 0.00001, 'minimum DSCR');

// C. LTV/DSCR debt sizing: DSCR must bind below a 70% LTV ceiling in this reference case.
const sizedDebt = sizeDebtByLtvAndDscr({
  costBase: 100_000_000,
  ltv: 0.70,
  annualNoi: Array(15).fill(8_000_000),
  minDscrThreshold: 1.25,
  annualRate,
  tenorYears,
});
assert.strictEqual(sizedDebt.bindingConstraint, 'DSCR');
approx(sizedDebt.ltvLimit, 70_000_000, 0.01, 'LTV limit');
approx(sizedDebt.loanAmount, 63_201_874.49, 5.00, 'DSCR-sized loan');
assert.ok(sizedDebt.dscrAtLoanAmount >= 1.25, 'sized loan must satisfy the DSCR threshold');
assert.ok(sizedDebt.loanAmount < sizedDebt.ltvLimit, 'DSCR-sized loan must be below the LTV ceiling');

// D. HBU / residual maximum land bid: independent closed-form reference.
const hbu = evaluateHighestAndBestUse({
  landAreaSqm: 20_000,
  requiredDeveloperMarginRate: 0.20,
  acquisitionCostsRate: 0.05,
  evidenceComplete: true,
  alternatives: [{
    id: 'REFERENCE_BASE',
    legallyPermissible: true,
    physicallyPossible: true,
    grossDevelopmentValueSar: 200_000_000,
    hardCostsSar: 80_000_000,
    softCostsSar: 15_000_000,
    financeCostsSar: 8_000_000,
    contingencySar: 4_000_000,
    sellingCostsSar: 3_000_000,
  }],
});
assert.strictEqual(hbu.status, HBU_STATUS.QUALIFIED);
approx(hbu.selected.requiredProfitSar, 40_000_000, 0.01, 'required developer profit');
approx(hbu.selected.residualBeforeAcquisitionSar, 50_000_000, 0.01, 'residual before acquisition');
approx(hbu.selected.maximumLandBidSar, 47_619_047.61904762, 0.01, 'maximum land bid');
approx(hbu.selected.bidPerSqmSar, 2_380.952380952381, 0.0001, 'maximum bid per sqm');
assert.strictEqual(hbu.transactionAuthorized, false);

const hbuHigherMargin = evaluateHighestAndBestUse({
  landAreaSqm: 20_000,
  requiredDeveloperMarginRate: 0.25,
  acquisitionCostsRate: 0.05,
  evidenceComplete: true,
  alternatives: [{
    id: 'REFERENCE_HIGHER_MARGIN',
    legallyPermissible: true,
    physicallyPossible: true,
    grossDevelopmentValueSar: 200_000_000,
    hardCostsSar: 80_000_000,
    softCostsSar: 15_000_000,
    financeCostsSar: 8_000_000,
    contingencySar: 4_000_000,
    sellingCostsSar: 3_000_000,
  }],
});
assert.ok(hbuHigherMargin.selected.maximumLandBidSar < hbu.selected.maximumLandBidSar, 'higher required margin must reduce maximum land bid');

// E. Exact dated-return reference under ACT/365.2425.
const annualDated = [
  { date: '2026-01-01', amount: -1_000 },
  { date: '2027-01-01', amount: 1_100 },
];
const annualXirr = solveDatedXirr({ cashflows: annualDated, tolerance: 1e-12, npvToleranceSar: 1e-8, maxIterations: 300 });
assert.strictEqual(annualXirr.status, DATED_RETURNS_STATUS.QUALIFIED);
approx(annualXirr.xirr, 0.1000696569738, 1e-10, 'ACT/365.2425 annual XIRR');

// F. Governed DCF: independent ACT/365.2425 numeric reference.
const dcfBase = {
  cashflows: [
    { date: '2026-01-01', amount: -1_000_000 },
    { date: '2027-01-01', amount: 150_000 },
    { date: '2028-01-01', amount: 160_000 },
    { date: '2029-01-01', amount: 170_000 },
  ],
  discountRate: 0.10,
  discountRateEvidence: observed('discount-reference'),
  terminalNoiSar: 180_000,
  entryCapRate: 0.075,
  entryEvidence: observed('entry-cap-reference'),
  exitCapRate: 0.08,
  exitEvidence: observed('exit-cap-reference'),
  terminalDate: '2029-01-01',
  terminalSellingCostsRate: 0.02,
};
const dcf = calculateGovernedDcf(dcfBase);
assert.strictEqual(dcf.status, GOVERNED_DCF_STATUS.QUALIFIED);
approx(dcf.terminalValueSar, 2_250_000, 0.01, 'terminal value');
approx(dcf.netTerminalValueSar, 2_205_000, 0.01, 'net terminal value');
approx(dcf.valuationIndicationSar, 1_052_866.178863672, 0.02, 'ACT/365.2425 DCF value');
approx(dcf.xirr, 0.4274486042442538, 1e-6, 'DCF XIRR');
assert.strictEqual(dcf.xirrDiagnostics.status, DATED_RETURNS_STATUS.QUALIFIED);

// G. Discount sensitivity: higher discount rate must reduce the DCF indication.
const dcfAt8 = calculateGovernedDcf({ ...dcfBase, discountRate: 0.08, discountRateEvidence: observed('discount-8') });
const dcfAt12 = calculateGovernedDcf({ ...dcfBase, discountRate: 0.12, discountRateEvidence: observed('discount-12') });
assert.ok(dcfAt8.valuationIndicationSar > dcf.valuationIndicationSar);
assert.ok(dcf.valuationIndicationSar > dcfAt12.valuationIndicationSar);

// H. Impossible operating dates and terminal dates must fail closed.
const invalidOperatingDate = calculateGovernedDcf({
  ...dcfBase,
  cashflows: [
    { date: '2026-02-30', amount: -1_000_000 },
    { date: '2027-01-01', amount: 150_000 },
  ],
});
assert.strictEqual(invalidOperatingDate.status, GOVERNED_DCF_STATUS.HOLD);
assert.ok(invalidOperatingDate.blockers.includes('DATED_CASHFLOWS_INVALID'));

const invalidTerminalDate = calculateGovernedDcf({ ...dcfBase, terminalDate: '2029-02-30' });
assert.strictEqual(invalidTerminalDate.status, GOVERNED_DCF_STATUS.HOLD);
assert.ok(invalidTerminalDate.blockers.includes('TERMINAL_DATE_INVALID'));

const earlyTerminalDate = calculateGovernedDcf({ ...dcfBase, terminalDate: '2028-06-30' });
assert.strictEqual(earlyTerminalDate.status, GOVERNED_DCF_STATUS.HOLD);
assert.ok(earlyTerminalDate.blockers.includes('TERMINAL_DATE_PRECEDES_OPERATING_CASHFLOW'));

// I. DCF remains mathematically computable when IRR is unavailable; IRR ambiguity is disclosed, not hidden.
const positiveOnlyDcf = calculateGovernedDcf({
  ...dcfBase,
  cashflows: [
    { date: '2026-01-01', amount: 100_000 },
    { date: '2027-01-01', amount: 120_000 },
  ],
  terminalDate: '2027-01-01',
});
assert.strictEqual(positiveOnlyDcf.status, GOVERNED_DCF_STATUS.REVIEW_REQUIRED);
assert.ok(Number.isFinite(positiveOnlyDcf.valuationIndicationSar));
assert.strictEqual(positiveOnlyDcf.xirr, null);
assert.ok(positiveOnlyDcf.warnings.includes('XIRR_CASHFLOW_SIGN_CHANGE_REQUIRED'));

const multipleIrrDcf = calculateGovernedDcf({
  ...dcfBase,
  cashflows: [
    { date: '2026-01-01', amount: -1_000 },
    { date: '2027-01-01', amount: 3_000 },
    { date: '2028-01-01', amount: -2_200 },
  ],
  terminalNoiSar: 100,
  terminalDate: '2029-01-01',
});
assert.strictEqual(multipleIrrDcf.status, GOVERNED_DCF_STATUS.REVIEW_REQUIRED);
assert.ok(Number.isFinite(multipleIrrDcf.valuationIndicationSar));
assert.strictEqual(multipleIrrDcf.xirr, null);
assert.ok(multipleIrrDcf.warnings.includes('XIRR_MULTIPLE_IRR_AMBIGUITY'));

console.log('independent_financial_reference_v1: PASS');
