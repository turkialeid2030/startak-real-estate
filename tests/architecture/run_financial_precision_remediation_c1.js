'use strict';

const assert = require('assert');
const {
  decimalToScaled,
  toMoney,
  fromMoney,
  moneyAdd,
  preciseNPV,
  preciseIRR,
} = require('../../src/engines/financial/precision');
const {
  monthlyAmortizationSchedule,
  annualizeMonthlySchedule,
} = require('../../src/engines/financial/monthly-debt');
const {
  simulateConstructionFacility,
  buildAnnualConstructionDebtDraws,
} = require('../../src/engines/financial/construction-debt');

let checks = 0;
function check(name, fn) {
  fn();
  checks += 1;
  console.log(`PASS ${name}`);
}

function sumMoney(values) {
  return fromMoney(values.reduce((sum, value) => sum + toMoney(value), 0n));
}

check('decimal parser avoids binary 0.1 + 0.2 drift', () => {
  assert.strictEqual(decimalToScaled(0.1, 12), 100000000000n);
  assert.strictEqual(decimalToScaled(0.2, 12), 200000000000n);
  assert.strictEqual(moneyAdd(0.1, 0.2), 0.3);
});

check('NPV uses cent-fixed arithmetic on an exact 10 percent identity', () => {
  const npv = preciseNPV(0.10, [-100, 55, 60.5]);
  assert.strictEqual(npv, 0);
});

check('NPV preserves exact zero-rate cent allocation identity', () => {
  assert.strictEqual(preciseNPV(0, [-100, 33.33, 33.33, 33.34]), 0);
});

check('IRR is deterministic and resolves a known 10 percent root', () => {
  const a = preciseIRR([-100, 0, 121]);
  const b = preciseIRR([-100, 0, 121]);
  assert.strictEqual(a, b);
  assert.ok(Math.abs(a - 0.10) < 1e-8, `irr=${a}`);
});

check('fractional tenor monthly debt remains exact at 54 months', () => {
  const plan = monthlyAmortizationSchedule(1000000, 0.06, 4.5);
  assert.strictEqual(plan.tenorMonths, 54);
  assert.strictEqual(plan.schedule.length, 54);
  assert.strictEqual(plan.precisionMode, 'FIXED_POINT_HALALA_RATE_1E12');
  const repaidPrincipal = sumMoney(plan.schedule.map((row) => row.principal + row.balloon));
  assert.strictEqual(repaidPrincipal, 1000000);
  assert.strictEqual(plan.schedule.at(-1).balance, 0);
});

check('one-cent remainder is conserved rather than lost across installments', () => {
  const plan = monthlyAmortizationSchedule(100, 0, 0.25);
  assert.strictEqual(plan.tenorMonths, 3);
  assert.strictEqual(sumMoney(plan.schedule.map((row) => row.principal + row.balloon)), 100);
  assert.strictEqual(sumMoney(plan.schedule.map((row) => row.totalPayment)), 100);
});

check('annualization equals the monthly payment total exactly to halala', () => {
  const plan = monthlyAmortizationSchedule(1234567.89, 0.07125, 7.5, { balloonPct: 0.15 });
  const annual = annualizeMonthlySchedule(plan.schedule);
  assert.strictEqual(sumMoney(annual.map((row) => row.payment)), plan.totalPayments);
  assert.strictEqual(sumMoney(annual.map((row) => row.interest)), plan.totalInterest);
});

check('construction draw allocation conserves principal exactly', () => {
  const facility = simulateConstructionFacility({
    landCost: 0,
    constructionCost: 100,
    debtFraction: 1,
    annualRate: 0,
    constructionYears: 0.25,
  });
  assert.strictEqual(facility.constructionMonths, 3);
  assert.strictEqual(facility.precisionMode, 'FIXED_POINT_HALALA_RATE_1E12');
  assert.strictEqual(sumMoney(facility.schedule.map((row) => row.constructionDebtDraw)), 100);
  assert.strictEqual(facility.principalDebtDraws, 100);
  assert.strictEqual(facility.completionBalance, 100);
});

check('construction annual aggregation equals monthly draw and interest totals', () => {
  const facility = simulateConstructionFacility({
    landCost: 35000000.37,
    constructionCost: 82500000.63,
    debtFraction: 0.6,
    annualRate: 0.065,
    constructionYears: 2.5,
  });
  const annual = buildAnnualConstructionDebtDraws(facility);
  assert.strictEqual(
    sumMoney(annual.map((row) => row.debtDraw)),
    facility.constructionDebtPrincipal,
  );
  assert.strictEqual(
    sumMoney(annual.map((row) => row.capitalizedInterest)),
    facility.capitalizedInterest,
  );
});

check('large monetary values remain finite and cent-conserved', () => {
  const principal = 999999999999.99;
  const plan = monthlyAmortizationSchedule(principal, 0.05, 20, { balloonPct: 0.2 });
  assert.ok(Number.isFinite(plan.totalInterest));
  assert.ok(Number.isFinite(plan.totalPayments));
  assert.strictEqual(sumMoney(plan.schedule.map((row) => row.principal + row.balloon)), principal);
});

check('precision schedules are byte-for-byte deterministic across repeated runs', () => {
  const args = [7654321.09, 0.06375, 8.25, { gracePeriodMonths: 5, graceType: 'CAPITALIZED', balloonPct: 0.1 }];
  const one = monthlyAmortizationSchedule(...args);
  const two = monthlyAmortizationSchedule(...args);
  assert.strictEqual(JSON.stringify(one), JSON.stringify(two));
});

console.log(`FINANCIAL_PRECISION_REMEDIATION_C1=PASS checks=${checks}`);
