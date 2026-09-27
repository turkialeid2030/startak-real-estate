'use strict';

const assert = require('assert/strict');
const financial = require('../../src/engines/financial');

// P11C independent debt-service / DSCR numerical validation.
//
// Test-only tranche. Expected values below were calculated independently from
// standard monthly annuity mathematics, not copied from engine outputs.
// Production uses fixed-point halala rounding, therefore tolerances are kept
// narrow but non-zero where a closed-form decimal calculation and cent-by-cent
// schedule can differ by a few halalas.

let cases = 0;

function check(name, fn) {
  fn();
  cases += 1;
  console.log(`PASS ${name}`);
}

function close(actual, expected, tolerance, label) {
  assert.ok(Number.isFinite(actual), `${label}: expected finite result, got ${actual}`);
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${label}: expected ${actual} ~= ${expected} within ${tolerance}`,
  );
}

check('10m SAR / 6% / 10y monthly amortization matches independent annuity reference', () => {
  const plan = financial.buildMonthlyDebtPlan(10_000_000, 0.06, 10);

  close(plan.scheduledMonthlyPayment, 111_020.5019416512, 0.02, 'monthly payment');
  assert.equal(plan.tenorMonths, 120);
  assert.equal(plan.annualSchedule.length, 10);

  const y1 = plan.annualSchedule[0];
  close(y1.payment, 1_332_246.0232998142, 0.25, 'year-1 debt service');
  close(y1.interest, 579_523.8155729157, 0.25, 'year-1 interest');
  close(y1.principal, 752_722.2077268986, 0.25, 'year-1 principal');
  close(y1.balance, 9_247_277.792273102, 0.25, 'year-1 ending balance');

  const maturity = plan.annualSchedule[9];
  close(maturity.balance, 0, 0.01, 'maturity balance');
});

check('zero-rate debt amortizes principal exactly without manufactured interest', () => {
  const plan = financial.buildMonthlyDebtPlan(1_200_000, 0, 1);

  close(plan.scheduledMonthlyPayment, 100_000, 0.01, 'zero-rate monthly payment');
  close(plan.annualDebtService[0], 1_200_000, 0.01, 'zero-rate annual debt service');
  close(plan.totalInterest, 0, 0.01, 'zero-rate total interest');
  close(plan.annualSchedule[0].principal, 1_200_000, 0.01, 'zero-rate annual principal');
  close(plan.annualSchedule[0].balance, 0, 0.01, 'zero-rate ending balance');
});

check('12-month interest-only grace recognizes cash interest and preserves principal', () => {
  const plan = financial.buildMonthlyDebtPlan(10_000_000, 0.06, 10, {
    gracePeriodMonths: 12,
    graceType: 'INTEREST_ONLY',
  });

  close(plan.annualDebtService[0], 600_000, 0.01, 'interest-only year-1 debt service');
  close(plan.annualSchedule[0].interest, 600_000, 0.01, 'interest-only year-1 interest');
  close(plan.annualSchedule[0].principal, 0, 0.01, 'interest-only year-1 principal');
  close(plan.annualSchedule[0].balance, 10_000_000, 0.01, 'interest-only year-1 balance');
  close(plan.scheduledMonthlyPayment, 120_057.49630925785, 0.02, 'post-grace monthly payment');
});

check('12-month capitalized grace accrues interest into balance with zero cash debt service', () => {
  const plan = financial.buildMonthlyDebtPlan(10_000_000, 0.06, 10, {
    gracePeriodMonths: 12,
    graceType: 'CAPITALIZED',
  });

  close(plan.annualDebtService[0], 0, 0.01, 'capitalized-grace year-1 cash debt service');
  close(plan.annualSchedule[0].principal, 0, 0.01, 'capitalized-grace year-1 principal');
  close(plan.annualSchedule[0].balance, 10_616_778.118644983, 0.25, 'capitalized-grace year-1 balance');
  close(plan.scheduledMonthlyPayment, 127_462.37997954295, 0.05, 'capitalized-grace post-grace payment');
});

check('minimum DSCR uses actual annual debt service and matches independent ratio', () => {
  const plan = financial.buildMonthlyDebtPlan(10_000_000, 0.06, 10);
  const annualNoi = Array(10).fill(1_800_000);
  const dscr = financial.minimumDscr(annualNoi, plan.annualDebtService);

  close(dscr, 1.351101799907509, 0.00001, 'minimum DSCR');
});

check('DSCR-constrained sizing binds below 75% LTV for 20m cost / 1.8m NOI', () => {
  const sizing = financial.sizeDebtByLtvAndDscr({
    costBase: 20_000_000,
    ltv: 0.75,
    annualNoi: Array(10).fill(1_800_000),
    minDscrThreshold: 1.25,
    annualRate: 0.06,
    tenorYears: 10,
  });

  assert.equal(sizing.bindingConstraint, 'DSCR');
  close(sizing.ltvLimit, 15_000_000, 0.01, '75% LTV limit');
  close(sizing.loanAmount, 10_808_814.39926007, 100, 'independent DSCR debt capacity');
  assert.ok(sizing.loanAmount < sizing.ltvLimit, 'DSCR limit must bind below LTV limit');
  assert.ok(sizing.dscrAtLoanAmount >= 1.25, `sized DSCR must meet threshold, got ${sizing.dscrAtLoanAmount}`);
  assert.ok(sizing.dscrAtLoanAmount < 1.25001, `binary sizing should sit near the threshold, got ${sizing.dscrAtLoanAmount}`);
});

check('financing classifier explicitly discloses that rate proxies are not executed contract models', () => {
  const generic = financial.classifyFinancingModel('تمويل عقاري');
  const murabaha = financial.classifyFinancingModel('مرابحة');
  const ijara = financial.classifyFinancingModel('إجارة');

  assert.equal(generic.exactContractModel, false);
  assert.equal(murabaha.exactContractModel, false);
  assert.equal(ijara.exactContractModel, false);
  assert.match(generic.boundary, /lender-specific/i);
  assert.match(murabaha.boundary, /term sheet/i);
  assert.match(ijara.boundary, /term sheet/i);
});

console.log(`FINANCIAL_DEBT_SERVICE_DSCR_REFERENCE_P11C_CASES=${cases}`);
console.log('financial_debt_service_dscr_reference_p11c: PASS');
