'use strict';

const assert = require('assert/strict');
const financial = require('../../src/engines/financial');

// P11B independent evidence-sufficiency validation.
//
// External project summary exposes only aggregate economics:
//   total revenue/inflows = SAR 520m
//   total cost/investment = SAR 356m
//   net profit = SAR 164m
//   claimed IRR = 18.5%
//
// Aggregate totals can reconcile arithmetically, but IRR is a timing-dependent
// metric. Without dated cash flows, the 18.5% claim cannot be independently
// reproduced. These two independent timing vectors deliberately preserve the
// same aggregate inflows/outflows/net profit while producing materially
// different XIRRs. This is a test-only evidence-governance vector and does not
// change production formulas or release authorities.

function close(actual, expected, tolerance, label) {
  assert.ok(Number.isFinite(actual), `${label}: expected finite result, got ${actual}`);
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: expected ${actual} ~= ${expected} within ${tolerance}`);
}

const aggregateCostSar = 356_000_000;
const aggregateRevenueSar = 520_000_000;
const aggregateNetProfitSar = 164_000_000;
const claimedIrr = 0.185;

assert.equal(aggregateRevenueSar - aggregateCostSar, aggregateNetProfitSar);

const frontLoaded = [
  { date: '2025-01-01', amount: -aggregateCostSar },
  { date: '2026-01-01', amount: 260_000_000 },
  { date: '2027-01-01', amount: 260_000_000 },
];

const backLoaded = [
  { date: '2025-01-01', amount: -aggregateCostSar },
  { date: '2033-01-01', amount: 260_000_000 },
  { date: '2034-01-01', amount: 260_000_000 },
];

function aggregate(flows) {
  const outflows = flows.filter((f) => f.amount < 0).reduce((sum, f) => sum - f.amount, 0);
  const inflows = flows.filter((f) => f.amount > 0).reduce((sum, f) => sum + f.amount, 0);
  return { outflows, inflows, netProfit: inflows - outflows };
}

for (const flows of [frontLoaded, backLoaded]) {
  assert.deepEqual(aggregate(flows), {
    outflows: aggregateCostSar,
    inflows: aggregateRevenueSar,
    netProfit: aggregateNetProfitSar,
  });
}

const frontLoadedXirr = financial.xirr(frontLoaded);
const backLoadedXirr = financial.xirr(backLoaded);

// Independent ACT/365.2425 references.
close(frontLoadedXirr, 0.2947371899704072, 1e-8, 'front-loaded XIRR');
close(backLoadedXirr, 0.045616166060782545, 1e-8, 'back-loaded XIRR');

assert.ok(frontLoadedXirr > claimedIrr, 'front-loaded case should exceed claimed 18.5% IRR');
assert.ok(backLoadedXirr < claimedIrr, 'back-loaded case should be below claimed 18.5% IRR');
assert.ok(frontLoadedXirr - backLoadedXirr > 0.24, 'timing ambiguity should be economically material');

// At the claimed 18.5% discount rate the two same-total profiles sit on
// opposite sides of zero NPV, independently demonstrating that aggregate
// totals cannot establish the claimed IRR.
close(financial.xnpv(claimedIrr, frontLoaded), 48_631_262.76961547, 0.01, 'front-loaded XNPV at claimed IRR');
close(financial.xnpv(claimedIrr, backLoaded), -232_698_055.05324906, 0.01, 'back-loaded XNPV at claimed IRR');

console.log('FINANCIAL_IRR_EVIDENCE_SUFFICIENCY_P11B_CASES=1');
console.log('financial_irr_evidence_sufficiency_p11b: PASS');
