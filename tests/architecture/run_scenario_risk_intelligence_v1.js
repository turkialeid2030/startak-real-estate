'use strict';

const assert = require('assert');
const {
  SCENARIO_KIND,
  RISK_SEVERITY,
  SIMULATION_STATUS,
  createScenario,
  applyScenario,
  runScenarioSet,
  rankSensitivity,
  solveBreakEven,
  runMonteCarlo,
  createRiskFlag,
} = require('../../src/scenario-risk');

const base = { rent: 100, occupancy: 0.90, cost: 1000 };
const evaluator = (inputs) => ({ value: inputs.rent * inputs.occupancy - inputs.cost * 0.05 });

const downside = createScenario({
  scenarioId: 'SYN-DOWN-01',
  kind: SCENARIO_KIND.DOWNSIDE,
  label: 'Synthetic downside',
  adjustments: { rent: -0.10, occupancy: -0.10, cost: 0.10 },
  assumption: 'Synthetic fixture only',
});
const adjusted = applyScenario(base, downside);
assert.strictEqual(adjusted.rent, 90);
assert.strictEqual(Number(adjusted.occupancy.toFixed(6)), 0.81);
assert.strictEqual(adjusted.cost, 1100);

const scenarios = runScenarioSet({
  baseInputs: base,
  scenarios: [
    createScenario({ scenarioId: 'BASE', kind: SCENARIO_KIND.BASE, label: 'Base', adjustments: {} }),
    downside,
  ],
  evaluator,
  metricSelector: (result) => ({ value: result.value }),
});
assert.strictEqual(scenarios.length, 2);
assert.ok(scenarios[1].metrics.value < scenarios[0].metrics.value);

const sensitivity = rankSensitivity({
  baseInputs: base,
  variables: ['rent', 'occupancy', 'cost'],
  shock: 0.10,
  evaluator,
  metricSelector: (result) => result.value,
});
assert.strictEqual(sensitivity.length, 3);
assert.ok(sensitivity[0].absoluteRange >= sensitivity[1].absoluteRange);
assert.ok(sensitivity[1].absoluteRange >= sensitivity[2].absoluteRange);

const breakEven = solveBreakEven({
  low: 0,
  high: 200,
  target: 0,
  evaluator: (rent) => rent * 0.90 - 50,
});
assert.ok(Math.abs(breakEven.value - (50 / 0.9)) < 1e-4);

const missingDist = runMonteCarlo({ baseInputs: base, distributions: [], evaluator, metricSelector: (r) => r.value });
assert.strictEqual(missingDist.status, SIMULATION_STATUS.HOLD_DISTRIBUTIONS);

const simulationA = runMonteCarlo({
  baseInputs: base,
  distributions: [
    { key: 'rent', type: 'TRIANGULAR', min: 80, mode: 100, max: 120 },
    { key: 'occupancy', type: 'TRIANGULAR', min: 0.70, mode: 0.90, max: 0.98 },
  ],
  iterations: 1000,
  seed: 42,
  evaluator,
  metricSelector: (r) => r.value,
});
const simulationB = runMonteCarlo({
  baseInputs: base,
  distributions: [
    { key: 'rent', type: 'TRIANGULAR', min: 80, mode: 100, max: 120 },
    { key: 'occupancy', type: 'TRIANGULAR', min: 0.70, mode: 0.90, max: 0.98 },
  ],
  iterations: 1000,
  seed: 42,
  evaluator,
  metricSelector: (r) => r.value,
});
assert.strictEqual(simulationA.status, SIMULATION_STATUS.QUALIFIED);
assert.strictEqual(simulationA.mean, simulationB.mean);
assert.strictEqual(simulationA.p05, simulationB.p05);
assert.ok(simulationA.p05 <= simulationA.p50);
assert.ok(simulationA.p50 <= simulationA.p95);

const risk = createRiskFlag({
  code: 'SYN-RISK-01',
  severity: RISK_SEVERITY.HIGH,
  driver: 'Synthetic vacancy risk',
  rationale: 'Used only to verify contract behavior.',
  evidenceRefs: ['SYN-E-1'],
  mitigation: 'Verify lease evidence',
});
assert.strictEqual(risk.severity, 'HIGH');
assert.deepStrictEqual(risk.evidenceRefs, ['SYN-E-1']);

assert.throws(() => applyScenario(base, createScenario({ scenarioId: 'BAD', kind: SCENARIO_KIND.CUSTOM, label: 'Bad', adjustments: { unknown: 0.1 } })), /SCENARIO_UNKNOWN_INPUT/);
assert.throws(() => solveBreakEven({ low: 0, high: 10, evaluator: (x) => x + 1 }), /BREAK_EVEN_NOT_BRACKETED/);

console.log('SCENARIO_RISK_INTELLIGENCE_V1=PASS');
console.log('DOWNSIDE_SCENARIOS_DETERMINISTIC=PASS');
console.log('SENSITIVITY_RANKING=PASS');
console.log('BREAK_EVEN_SOLVER=PASS');
console.log('MONTE_CARLO_REQUIRES_QUALIFIED_DISTRIBUTIONS=PASS');
console.log('MONTE_CARLO_REPRODUCIBLE_WITH_SEED=PASS');
console.log('RISK_FLAGS_EVIDENCE_LINKED=PASS');
