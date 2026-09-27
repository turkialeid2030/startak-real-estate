'use strict';

const assert = require('assert');
const {
  runDeterministicStressTest,
  STRESS_STATUS,
  STRESS_TEST_VERSION,
} = require('../../src/valuation-intelligence');

const base = Object.freeze({
  noiSar: 800_000,
  valueSar: 10_000_000,
  effectiveRevenueSar: 1_120_000,
  opexSar: 320_000,
  annualDebtServiceSar: 500_000,
  capRate: 0.08,
  occupancyRate: 0.90,
});
const thresholds = Object.freeze({ maxValueDecline: 0.25, minDscr: 1.25 });
const neutralScenario = Object.freeze({
  id: 'BASE',
  rentShock: 0,
  occupancyShock: 0,
  opexShock: 0,
  capRateShock: 0,
  debtServiceShock: 0,
});

function run({ baseOverride = {}, scenarioOverride = {}, thresholdsOverride = {} } = {}) {
  return runDeterministicStressTest({
    base: { ...base, ...baseOverride },
    scenarios: [{ ...neutralScenario, ...scenarioOverride }],
    thresholds: { ...thresholds, ...thresholdsOverride },
  });
}

function expectHold(expectedBlocker, overrides) {
  const result = run(overrides);
  assert.strictEqual(result.status, STRESS_STATUS.HOLD, `${expectedBlocker}: expected HOLD`);
  assert.ok(result.blockers.includes(expectedBlocker), `${expectedBlocker}: blocker missing; got ${result.blockers.join(',')}`);
  return result;
}

// Valid governed baseline remains executable and economically bounded.
const valid = run();
assert.strictEqual(STRESS_TEST_VERSION, 'STRESS_TEST_V2');
assert.notStrictEqual(valid.status, STRESS_STATUS.HOLD);
assert.strictEqual(valid.results.length, 1);
assert.ok(valid.results[0].stressedRevenueSar >= 0);
assert.ok(valid.results[0].stressedOpexSar >= 0);
assert.ok(valid.results[0].stressedDebtServiceSar >= 0);
assert.ok(valid.results[0].stressedOccupancyRate >= 0 && valid.results[0].stressedOccupancyRate <= 1);
assert.ok(valid.results[0].stressedCapRate > 0);

// Base-case economic domains fail closed rather than being silently repaired.
expectHold('BASE_EFFECTIVE_REVENUE_INVALID', { baseOverride: { effectiveRevenueSar: -1 } });
expectHold('BASE_OPEX_INVALID', { baseOverride: { opexSar: -1 } });
expectHold('BASE_DEBT_SERVICE_INVALID', { baseOverride: { annualDebtServiceSar: -1 } });
expectHold('BASE_CAP_RATE_INVALID', { baseOverride: { capRate: 0 } });
expectHold('BASE_CAP_RATE_INVALID', { baseOverride: { capRate: -0.01 } });
expectHold('BASE_OCCUPANCY_RATE_INVALID', { baseOverride: { occupancyRate: -0.001 } });
expectHold('BASE_OCCUPANCY_RATE_INVALID', { baseOverride: { occupancyRate: 1.001 } });

// Explicit revenue / OPEX / NOI must reconcile; inconsistent bases cannot be stressed.
expectHold('BASE_CASE_ARITHMETIC_INCONSISTENT', {
  baseOverride: { effectiveRevenueSar: 1_000_000, opexSar: 100_000, noiSar: 800_000 },
});

// Governed thresholds stay within interpretable domains.
expectHold('GOVERNED_THRESHOLDS_REQUIRED', { thresholdsOverride: { maxValueDecline: -0.01 } });
expectHold('GOVERNED_THRESHOLDS_REQUIRED', { thresholdsOverride: { maxValueDecline: 1.01 } });
expectHold('GOVERNED_THRESHOLDS_REQUIRED', { thresholdsOverride: { minDscr: -0.01 } });

// Multiplicative shocks at or below -100% are prohibited.
const multiplicativeCases = [
  ['rentShock', 'SCENARIO_RENT_SHOCK_INVALID'],
  ['occupancyShock', 'SCENARIO_OCCUPANCY_SHOCK_INVALID'],
  ['opexShock', 'SCENARIO_OPEX_SHOCK_INVALID'],
  ['debtServiceShock', 'SCENARIO_DEBT_SERVICE_SHOCK_INVALID'],
];
for (const [field, blocker] of multiplicativeCases) {
  expectHold(blocker, { scenarioOverride: { [field]: -1 } });
  expectHold(blocker, { scenarioOverride: { [field]: -1.01 } });
}

// Invalid provided shocks must not silently default to zero.
expectHold('SCENARIO_RENT_SHOCK_INVALID', { scenarioOverride: { rentShock: Number.NaN } });
expectHold('SCENARIO_OCCUPANCY_SHOCK_INVALID', { scenarioOverride: { occupancyShock: Number.POSITIVE_INFINITY } });
expectHold('SCENARIO_OPEX_SHOCK_INVALID', { scenarioOverride: { opexShock: Number.NEGATIVE_INFINITY } });
expectHold('SCENARIO_CAP_RATE_SHOCK_INVALID', { scenarioOverride: { capRateShock: Number.NaN } });
expectHold('SCENARIO_DEBT_SERVICE_SHOCK_INVALID', { scenarioOverride: { debtServiceShock: Number.POSITIVE_INFINITY } });

// Occupancy and capitalization rate are checked after shock application.
expectHold('STRESSED_OCCUPANCY_RATE_INVALID', {
  baseOverride: { occupancyRate: 0.95 },
  scenarioOverride: { occupancyShock: 0.10 },
});
expectHold('STRESSED_CAP_RATE_INVALID', { scenarioOverride: { capRateShock: -0.08 } });

// A severe but still legal stress remains a diagnostic result, never creates negative
// revenue/OPEX/debt-service, and surfaces non-positive NOI as a review breach.
const severe = run({
  scenarioOverride: {
    id: 'SEVERE_LEGAL',
    rentShock: -0.99,
    occupancyShock: -0.99,
    opexShock: 2,
    capRateShock: 0.04,
    debtServiceShock: 0.50,
  },
  thresholdsOverride: { maxValueDecline: 1, minDscr: 0 },
});
assert.strictEqual(severe.status, STRESS_STATUS.REVIEW_REQUIRED);
assert.ok(severe.results[0].stressedRevenueSar >= 0);
assert.ok(severe.results[0].stressedOpexSar >= 0);
assert.ok(severe.results[0].stressedDebtServiceSar >= 0);
assert.ok(severe.results[0].breached.includes('NON_POSITIVE_NOI'));

// Missing optional shocks retain backward-compatible neutral semantics.
const omittedOptionalShocks = runDeterministicStressTest({
  base: { ...base },
  scenarios: [{ id: 'OMITTED_OPTIONALS' }],
  thresholds: { ...thresholds },
});
assert.notStrictEqual(omittedOptionalShocks.status, STRESS_STATUS.HOLD);
assert.strictEqual(omittedOptionalShocks.results[0].stressedRevenueSar, base.effectiveRevenueSar);
assert.strictEqual(omittedOptionalShocks.results[0].stressedOpexSar, base.opexSar);
assert.strictEqual(omittedOptionalShocks.results[0].stressedDebtServiceSar, base.annualDebtServiceSar);
assert.strictEqual(omittedOptionalShocks.results[0].stressedOccupancyRate, base.occupancyRate);
assert.strictEqual(omittedOptionalShocks.results[0].stressedCapRate, base.capRate);

assert.ok(Object.isFrozen(valid));
assert.ok(Object.isFrozen(valid.results));
assert.ok(Object.isFrozen(valid.results[0]));

console.log('stress_bounds_v2: PASS');
