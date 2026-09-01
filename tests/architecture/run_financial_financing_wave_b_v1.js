'use strict';

const assert = require('assert');
const {
  normalizeTenorMonths,
  monthlyAmortizationSchedule,
  buildMonthlyDebtPlan,
  sizeDebtByLtvAndDscr,
  classifyFinancingModel,
} = require('../../src/engines/financial');
const { calculateInvestmentCase, STUDY_TYPE } = require('../../src/engines');
const gold = require('../reference/RE-GOLD-baseline.json');

let checks = 0;
function check(name, fn) {
  fn();
  checks += 1;
  console.log(`PASS ${name}`);
}

check('fractional tenor is converted to exact month count instead of rounded years', () => {
  assert.strictEqual(normalizeTenorMonths(4.5), 54);
  const plan = monthlyAmortizationSchedule(1_000_000, 0.06, 4.5);
  assert.strictEqual(plan.tenorMonths, 54);
  assert.strictEqual(plan.schedule.length, 54);
  assert.strictEqual(plan.schedule.at(-1).month, 54);
  assert.ok(Math.abs(plan.schedule.at(-1).balance) < 1e-9);
});

check('monthly schedule annualizes actual monthly payments', () => {
  const plan = buildMonthlyDebtPlan(1_000_000, 0.06, 4.5);
  assert.strictEqual(plan.annualSchedule.length, 5);
  assert.strictEqual(plan.annualSchedule[4].year, 5);
  assert.ok(plan.annualSchedule[4].payment < plan.annualSchedule[0].payment, 'final half-year debt service must be lower than a full year');
  const monthlyTotal = plan.schedule.reduce((sum, row) => sum + row.totalPayment, 0);
  const annualTotal = plan.annualSchedule.reduce((sum, row) => sum + row.payment, 0);
  assert.ok(Math.abs(monthlyTotal - annualTotal) < 1e-6);
});

check('interest-only grace preserves principal and does not fake amortization', () => {
  const plan = monthlyAmortizationSchedule(2_000_000, 0.06, 10, { gracePeriodMonths: 6, graceType: 'INTEREST_ONLY' });
  assert.strictEqual(plan.schedule.length, 120);
  for (let i = 0; i < 6; i += 1) {
    assert.strictEqual(plan.schedule[i].principal, 0);
    assert.ok(Math.abs(plan.schedule[i].balance - 2_000_000) < 1e-6);
    assert.ok(plan.schedule[i].totalPayment > 0);
  }
  assert.ok(plan.schedule[6].principal > 0);
});

check('capitalized grace increases balance before amortization', () => {
  const plan = monthlyAmortizationSchedule(2_000_000, 0.06, 10, { gracePeriodMonths: 6, graceType: 'CAPITALIZED' });
  assert.strictEqual(plan.schedule[0].totalPayment, 0);
  assert.ok(plan.schedule[5].balance > 2_000_000);
  assert.ok(plan.schedule[6].principal > 0);
});

check('balloon is explicit and settled at maturity', () => {
  const plan = monthlyAmortizationSchedule(1_000_000, 0.05, 5, { balloonPct: 0.25 });
  const last = plan.schedule.at(-1);
  assert.ok(plan.balloonAmount > 249_999 && plan.balloonAmount < 250_001);
  assert.ok(last.balloon > 249_000);
  assert.strictEqual(last.balance, 0);
  assert.ok(last.totalPayment > last.scheduledPayment);
});

check('DSCR sizing binds below LTV when debt service would be excessive', () => {
  const sized = sizeDebtByLtvAndDscr({
    costBase: 100_000_000,
    ltv: 0.70,
    annualNoi: Array(10).fill(5_000_000),
    minDscrThreshold: 1.25,
    annualRate: 0.07,
    tenorYears: 10,
  });
  assert.strictEqual(sized.bindingConstraint, 'DSCR');
  assert.ok(sized.loanAmount < sized.ltvLimit);
  assert.ok(sized.dscrAtLoanAmount >= 1.25 - 1e-8);
  assert.ok(sized.dscrAtLoanAmount <= 1.250001);
});

check('LTV remains binding when NOI comfortably supports debt', () => {
  const sized = sizeDebtByLtvAndDscr({
    costBase: 100_000_000,
    ltv: 0.50,
    annualNoi: Array(10).fill(25_000_000),
    minDscrThreshold: 1.25,
    annualRate: 0.05,
    tenorYears: 10,
  });
  assert.strictEqual(sized.bindingConstraint, 'LTV');
  assert.ok(Math.abs(sized.loanAmount - 50_000_000) < 1e-6);
  assert.ok(sized.dscrAtLoanAmount >= 1.25);
});

check('Murabaha and Ijarah labels are not represented as exact contractual models', () => {
  const murabaha = classifyFinancingModel('مرابحة');
  const ijara = classifyFinancingModel('إجارة منتهية بالتمليك');
  assert.strictEqual(murabaha.modelType, 'MURABAHA_RATE_PROXY_MONTHLY');
  assert.strictEqual(ijara.modelType, 'IJARA_RATE_PROXY_MONTHLY');
  assert.strictEqual(murabaha.exactContractModel, false);
  assert.strictEqual(ijara.exactContractModel, false);
  assert.match(murabaha.boundary, /term sheet/i);
});

check('canonical existing-building leverage path uses monthly DSCR-constrained financing', () => {
  const inputs = { ...gold['RE-GOLD-002_existing_building'].inputs, leverageEnabled: true, loanTenor: 4.5 };
  const result = calculateInvestmentCase({ studyType: STUDY_TYPE.EXISTING_BUILDING, inputs, leverageEnabled: true });
  assert.strictEqual(result.financingEngineVersion, 'MONTHLY_DSCR_WAVE_B_1.0');
  assert.strictEqual(result.tenorMonths, 54);
  assert.ok(result.loanAmount <= result.ltvLoanLimit + 1e-6);
  assert.ok(['LTV', 'DSCR'].includes(result.loanSizingConstraint));
  assert.ok(Array.isArray(result.annualDebtService) && result.annualDebtService.length === 5);
  assert.strictEqual(result.exactContractModel, false);
  assert.ok(result.financingModelBoundary.length > 20);
  if (result.loanAmount > 0) {
    assert.ok(result.dscrMin >= inputs.minDscrThreshold - 1e-7);
  }
  const dscrCriterion = result.criteriaDetail.find((item) => item.code === 'DSCR_MINIMUM');
  assert.ok(dscrCriterion);
  assert.strictEqual(dscrCriterion.met, result.c5);
});

console.log(`FINANCIAL_FINANCING_WAVE_B_V1=PASS checks=${checks}`);
