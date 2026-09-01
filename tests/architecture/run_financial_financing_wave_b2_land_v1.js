'use strict';

const assert = require('assert');
const {
  normalizeConstructionMonths,
  simulateConstructionFacility,
  sizeConstructionFacilityByLtcAndDscr,
} = require('../../src/engines/financial');
const { calculateInvestmentCase, STUDY_TYPE } = require('../../src/engines');
const gold = require('../reference/RE-GOLD-baseline.json');

let checks = 0;
function check(name, fn) {
  fn();
  checks += 1;
  console.log(`PASS ${name}`);
}

check('fractional construction period resolves to exact month count', () => {
  assert.strictEqual(normalizeConstructionMonths(2.5), 30);
  assert.strictEqual(normalizeConstructionMonths(1.25), 15);
});

check('construction facility capitalizes monthly interest over actual draw schedule', () => {
  const facility = simulateConstructionFacility({
    landCost: 20_000_000,
    constructionCost: 40_000_000,
    debtFraction: 0.60,
    annualRate: 0.06,
    constructionYears: 2,
  });
  assert.strictEqual(facility.constructionMonths, 24);
  assert.strictEqual(facility.schedule.length, 24);
  assert.ok(Math.abs(facility.principalDebtDraws - 36_000_000) < 1e-6);
  assert.ok(facility.capitalizedInterest > 0);
  assert.ok(facility.completionBalance > facility.principalDebtDraws);
  assert.ok(facility.schedule[23].balance > facility.schedule[0].balance);
});

check('lower construction debt fraction lowers completion balance monotonically', () => {
  const a = simulateConstructionFacility({ landCost: 20_000_000, constructionCost: 40_000_000, debtFraction: 0.30, annualRate: 0.06, constructionYears: 2 });
  const b = simulateConstructionFacility({ landCost: 20_000_000, constructionCost: 40_000_000, debtFraction: 0.60, annualRate: 0.06, constructionYears: 2 });
  assert.ok(a.completionBalance < b.completionBalance);
  assert.ok(a.capitalizedInterest < b.capitalizedInterest);
});

check('DSCR can bind construction facility below maximum LTC fraction', () => {
  const sized = sizeConstructionFacilityByLtcAndDscr({
    landCost: 30_000_000,
    constructionCost: 70_000_000,
    maxDebtFraction: 0.70,
    annualRate: 0.07,
    constructionYears: 2,
    termTenorYears: 10,
    annualNoi: Array(10).fill(6_000_000),
    minDscrThreshold: 1.25,
  });
  assert.strictEqual(sized.bindingConstraint, 'DSCR');
  assert.ok(sized.debtFraction < 0.70);
  assert.ok(sized.debtFraction > 0);
  assert.ok(sized.dscrAtDebtFraction >= 1.25 - 1e-8);
});

check('LTC binds when stabilized NOI comfortably supports the term debt', () => {
  const sized = sizeConstructionFacilityByLtcAndDscr({
    landCost: 30_000_000,
    constructionCost: 70_000_000,
    maxDebtFraction: 0.55,
    annualRate: 0.05,
    constructionYears: 2,
    termTenorYears: 10,
    annualNoi: Array(10).fill(30_000_000),
    minDscrThreshold: 1.25,
  });
  assert.strictEqual(sized.bindingConstraint, 'LTC');
  assert.ok(Math.abs(sized.debtFraction - 0.55) < 1e-12);
  assert.ok(sized.dscrAtDebtFraction >= 1.25);
});

check('non-positive operating NOI produces zero debt capacity rather than false leverage', () => {
  const sized = sizeConstructionFacilityByLtcAndDscr({
    landCost: 30_000_000,
    constructionCost: 70_000_000,
    maxDebtFraction: 0.60,
    annualRate: 0.06,
    constructionYears: 2,
    termTenorYears: 10,
    annualNoi: Array(10).fill(0),
    minDscrThreshold: 1.25,
  });
  assert.strictEqual(sized.bindingConstraint, 'DSCR');
  assert.strictEqual(sized.debtFraction, 0);
  assert.strictEqual(sized.facility.principalDebtDraws, 0);
  assert.strictEqual(sized.facility.completionBalance, 0);
});

check('canonical land leverage path uses monthly construction facility and term sizing', () => {
  const inputs = {
    ...gold['RE-GOLD-001_land_development'].inputs,
    leverageEnabled: true,
    constructionPeriod: 2.5,
    loanTenor: 7.5,
  };
  const result = calculateInvestmentCase({ studyType: STUDY_TYPE.LAND_DEVELOPMENT, inputs, leverageEnabled: true });
  assert.strictEqual(result.financingEngineVersion, 'CONSTRUCTION_MONTHLY_DSCR_WAVE_B_2.0');
  assert.strictEqual(result.constructionDebtSchedule.length, 30);
  assert.strictEqual(result.tenorMonths, 90);
  assert.ok(['LTC', 'DSCR'].includes(result.loanSizingConstraint));
  assert.ok(result.constructionDebtFraction <= inputs.ltv + 1e-9);
  assert.ok(result.loanAmount <= result.ltcPrincipalLimit + 1e-6);
  assert.ok(result.constructionLoanBalance >= result.loanAmount);
  if (result.loanAmount > 0 && inputs.loanRate > 0) assert.ok(result.capitalizedConstructionInterest > 0);
  assert.strictEqual(result.exactContractModel, false);
  assert.match(result.financingModelType, /PROXY|AMORTIZING/);
  assert.strictEqual(result.leveredCashflows.length, 1 + Math.round(inputs.constructionPeriod) + Math.round(inputs.operatingPeriod));
  if (result.loanAmount > 0) assert.ok(result.dscrMin >= inputs.minDscrThreshold - 1e-7);
  const dscrCriterion = result.criteriaDetail.find((item) => item.code === 'DSCR_MINIMUM');
  const leveredNpvCriterion = result.criteriaDetail.find((item) => item.code === 'LEVERED_NPV_NON_NEGATIVE');
  assert.ok(dscrCriterion && leveredNpvCriterion);
  assert.strictEqual(dscrCriterion.met, result.c5);
  assert.strictEqual(leveredNpvCriterion.met, result.c6);
});

console.log(`FINANCIAL_FINANCING_WAVE_B2_LAND_V1=PASS checks=${checks}`);
