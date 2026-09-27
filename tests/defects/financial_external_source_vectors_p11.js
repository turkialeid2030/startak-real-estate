'use strict';

const assert = require('assert/strict');
const financial = require('../../src/engines/financial');

// P11 external numerical validation.
//
// This tranche is intentionally test-only. It does not change production
// formulas, authority boundaries, or commercial-release controls.
//
// External source vector: Al-Mursalat usufruct investment memorandum.
// The memorandum publishes annual rental income, a 5% occupancy-loss line,
// land-rent expense and annual distributions for 2025-2038, together with an
// investment cost of SAR 13,769,626 and summary return claims. The source also
// says distributions are semiannual, while the published cash-flow table is
// annual. Therefore exact source XIRR is NOT asserted. Dated-return checks below
// use an explicit year-end annualization assumption and are labelled as such.

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

const investmentCostSar = 13_769_626;
const sourceSummaryDistributionsSar = 30_416_626;

const sourceRows = [
  { year: 2025, grossRentSar: 4_408_730, landRentSar: 2_000_000, publishedDistributionSar: 2_188_294 },
  { year: 2026, grossRentSar: 4_408_730, landRentSar: 3_000_000, publishedDistributionSar: 1_188_294 },
  { year: 2027, grossRentSar: 4_408_730, landRentSar: 2_250_000, publishedDistributionSar: 1_938_294 },
  { year: 2028, grossRentSar: 4_408_730, landRentSar: 2_250_000, publishedDistributionSar: 1_938_294 },
  { year: 2029, grossRentSar: 4_431_005, landRentSar: 2_250_000, publishedDistributionSar: 1_959_455 },
  { year: 2030, grossRentSar: 4_845_355, landRentSar: 2_250_000, publishedDistributionSar: 2_353_087 },
  { year: 2031, grossRentSar: 4_845_355, landRentSar: 2_375_000, publishedDistributionSar: 2_228_087 },
  { year: 2032, grossRentSar: 4_845_355, landRentSar: 2_500_000, publishedDistributionSar: 2_103_087 },
  { year: 2033, grossRentSar: 4_845_355, landRentSar: 2_500_000, publishedDistributionSar: 2_103_087 },
  { year: 2034, grossRentSar: 4_914_259, landRentSar: 2_500_000, publishedDistributionSar: 2_168_546 },
  { year: 2035, grossRentSar: 5_329_891, landRentSar: 2_500_000, publishedDistributionSar: 2_563_396 },
  { year: 2036, grossRentSar: 5_329_891, landRentSar: 2_500_000, publishedDistributionSar: 2_563_396 },
  { year: 2037, grossRentSar: 5_329_891, landRentSar: 2_500_000, publishedDistributionSar: 2_563_396 },
  { year: 2038, grossRentSar: 5_324_120, landRentSar: 2_500_000, publishedDistributionSar: 2_557_914 },
];

check('Mursalat annual distributions reconcile to engine NOI waterfall within source rounding', () => {
  for (const row of sourceRows) {
    const exactVacancyLossSar = row.grossRentSar * 0.05;
    const result = financial.normalizedNoiWaterfall({
      potentialBaseRentSar: row.grossRentSar,
      vacancyLossSar: exactVacancyLossSar,
      otherOperatingExpensesSar: row.landRentSar,
    });

    // The published memorandum rounds annual distributions to whole riyals.
    close(result.noiSar, row.publishedDistributionSar, 0.51, `Mursalat ${row.year} distribution`);
  }
});

check('Mursalat source summary exposes a one-riyal internal aggregation discrepancy', () => {
  const publishedRowTotal = sourceRows.reduce((sum, row) => sum + row.publishedDistributionSar, 0);
  assert.equal(publishedRowTotal, 30_416_627);
  assert.equal(publishedRowTotal - sourceSummaryDistributionsSar, 1);

  const recomputedExactTotal = sourceRows.reduce(
    (sum, row) => sum + row.grossRentSar * 0.95 - row.landRentSar,
    0,
  );
  close(recomputedExactTotal, 30_416_627.15, 1e-6, 'exact unrounded total');
  close(recomputedExactTotal, publishedRowTotal, 0.16, 'exact total vs rounded row total');
});

check('Mursalat 120.90% ROI and 220.90% gross cash-on-cost are distinct but arithmetically consistent', () => {
  const netProfitRoiPct = ((sourceSummaryDistributionsSar - investmentCostSar) / investmentCostSar) * 100;
  const grossCashOnCostPct = (sourceSummaryDistributionsSar / investmentCostSar) * 100;

  close(netProfitRoiPct, 120.89652979681512, 1e-10, 'net-profit ROI percent');
  close(grossCashOnCostPct, 220.89652979681512, 1e-10, 'gross cash-on-cost percent');
  assert.equal(Math.round(netProfitRoiPct * 100) / 100, 120.90);
  assert.equal(Math.round(grossCashOnCostPct * 100) / 100, 220.90);
  close(grossCashOnCostPct - netProfitRoiPct, 100, 1e-10, 'metric-definition difference');
});

check('Mursalat published annual distributions imply approximately seven-year payback', () => {
  let cumulative = 0;
  let elapsedYears = null;

  for (let index = 0; index < sourceRows.length; index += 1) {
    const row = sourceRows[index];
    if (cumulative + row.publishedDistributionSar >= investmentCostSar) {
      const remaining = investmentCostSar - cumulative;
      const yearFraction = remaining / row.publishedDistributionSar;
      elapsedYears = index + yearFraction;
      break;
    }
    cumulative += row.publishedDistributionSar;
  }

  close(elapsedYears, 6.989148089818755, 1e-12, 'fractional annual payback');
  assert.equal(Math.round(elapsedYears), 7);
});

function annualizedDatedFlows() {
  return [
    { date: '2025-01-01', amount: -investmentCostSar },
    ...sourceRows.map((row) => ({ date: `${row.year}-12-31`, amount: row.publishedDistributionSar })),
  ];
}

check('Mursalat annualized timing vector matches independent XNPV references', () => {
  const flows = annualizedDatedFlows();
  close(financial.xnpv(0.08, flows), 3_483_564.995732052, 0.01, 'annualized XNPV at 8%');
  close(financial.xnpv(0.10, flows), 1_515_944.805746199, 0.01, 'annualized XNPV at 10%');
  close(financial.xnpv(0.12, flows), -127_787.54794509168, 0.01, 'annualized XNPV at 12%');
  close(financial.xnpv(0.14, flows), -1_511_036.9831033822, 0.01, 'annualized XNPV at 14%');
});

check('Mursalat annualized timing vector matches independent XIRR reference without claiming exact source timing', () => {
  const annualizedXirr = financial.xirr(annualizedDatedFlows());
  close(annualizedXirr, 0.11831326845824297, 1e-8, 'annualized XIRR');
});

console.log(`FINANCIAL_EXTERNAL_SOURCE_VECTORS_P11_CASES=${cases}`);
console.log('financial_external_source_vectors_p11: PASS');
