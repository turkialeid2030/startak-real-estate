'use strict';

const SCENARIO_KIND = Object.freeze({
  BASE: 'BASE',
  UPSIDE: 'UPSIDE',
  DOWNSIDE: 'DOWNSIDE',
  SEVERE_DOWNSIDE: 'SEVERE_DOWNSIDE',
  BREAK_EVEN: 'BREAK_EVEN',
  CUSTOM: 'CUSTOM',
});

const RISK_SEVERITY = Object.freeze({
  LOW: 'LOW',
  MODERATE: 'MODERATE',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
});

const SIMULATION_STATUS = Object.freeze({
  QUALIFIED: 'QUALIFIED',
  HOLD_DISTRIBUTIONS: 'HOLD_DISTRIBUTIONS',
  HOLD_EVALUATOR: 'HOLD_EVALUATOR',
});

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) freeze(child);
  return value;
}

function finite(value, field) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`${field} must be a finite number`);
  return value;
}

function requireObject(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${field} must be an object`);
  return value;
}

function createScenario({ scenarioId, kind, label, adjustments = {}, assumption = null }) {
  if (typeof scenarioId !== 'string' || !scenarioId.trim()) throw new TypeError('scenarioId is required');
  if (!Object.values(SCENARIO_KIND).includes(kind)) throw new TypeError(`invalid scenario kind: ${kind}`);
  if (typeof label !== 'string' || !label.trim()) throw new TypeError('label is required');
  requireObject(adjustments, 'adjustments');
  for (const [key, value] of Object.entries(adjustments)) finite(value, `adjustments.${key}`);
  if (assumption !== null && typeof assumption !== 'string') throw new TypeError('assumption must be string or null');
  return freeze({ schemaVersion: 1, scenarioId: scenarioId.trim(), kind, label: label.trim(), adjustments: { ...adjustments }, assumption });
}

function applyScenario(baseInputs, scenario) {
  requireObject(baseInputs, 'baseInputs');
  requireObject(scenario, 'scenario');
  const next = { ...baseInputs };
  for (const [key, delta] of Object.entries(scenario.adjustments || {})) {
    if (!Object.prototype.hasOwnProperty.call(baseInputs, key)) throw new Error(`SCENARIO_UNKNOWN_INPUT: ${key}`);
    finite(baseInputs[key], `baseInputs.${key}`);
    finite(delta, `scenario.adjustments.${key}`);
    next[key] = baseInputs[key] * (1 + delta);
  }
  return freeze(next);
}

function runScenarioSet({ baseInputs, scenarios, evaluator, metricSelector }) {
  requireObject(baseInputs, 'baseInputs');
  if (!Array.isArray(scenarios) || scenarios.length === 0) throw new TypeError('scenarios must be a non-empty array');
  if (typeof evaluator !== 'function') throw new TypeError('evaluator must be a function');
  if (typeof metricSelector !== 'function') throw new TypeError('metricSelector must be a function');
  const results = scenarios.map((scenario) => {
    const inputs = applyScenario(baseInputs, scenario);
    const raw = evaluator(inputs);
    const metrics = metricSelector(raw);
    requireObject(metrics, 'metricSelector result');
    for (const [key, value] of Object.entries(metrics)) finite(value, `metrics.${key}`);
    return freeze({ scenarioId: scenario.scenarioId, kind: scenario.kind, label: scenario.label, assumption: scenario.assumption, adjustments: { ...scenario.adjustments }, metrics: { ...metrics } });
  });
  return freeze(results);
}

function rankSensitivity({ baseInputs, variables, shock = 0.10, evaluator, metricSelector }) {
  requireObject(baseInputs, 'baseInputs');
  if (!Array.isArray(variables) || variables.length === 0) throw new TypeError('variables must be a non-empty array');
  finite(shock, 'shock');
  if (shock <= 0 || shock >= 1) throw new RangeError('shock must be between 0 and 1');
  if (typeof evaluator !== 'function' || typeof metricSelector !== 'function') throw new TypeError('evaluator and metricSelector must be functions');
  const baseMetric = finite(metricSelector(evaluator(baseInputs)), 'baseMetric');
  const rows = variables.map((key) => {
    if (!Object.prototype.hasOwnProperty.call(baseInputs, key)) throw new Error(`SENSITIVITY_UNKNOWN_INPUT: ${key}`);
    finite(baseInputs[key], `baseInputs.${key}`);
    const lowInputs = { ...baseInputs, [key]: baseInputs[key] * (1 - shock) };
    const highInputs = { ...baseInputs, [key]: baseInputs[key] * (1 + shock) };
    const low = finite(metricSelector(evaluator(lowInputs)), `sensitivity.${key}.low`);
    const high = finite(metricSelector(evaluator(highInputs)), `sensitivity.${key}.high`);
    return { variable: key, shock, base: baseMetric, low, high, downsideImpact: low - baseMetric, upsideImpact: high - baseMetric, absoluteRange: Math.abs(high - low) };
  });
  rows.sort((a, b) => b.absoluteRange - a.absoluteRange);
  return freeze(rows);
}

function solveBreakEven({ low, high, evaluator, target = 0, tolerance = 1e-7, maxIterations = 100 }) {
  finite(low, 'low'); finite(high, 'high'); finite(target, 'target'); finite(tolerance, 'tolerance');
  if (!(low < high)) throw new RangeError('low must be < high');
  if (typeof evaluator !== 'function') throw new TypeError('evaluator must be a function');
  let lo = low, hi = high;
  let flo = finite(evaluator(lo), 'evaluator(low)') - target;
  let fhi = finite(evaluator(hi), 'evaluator(high)') - target;
  if (flo === 0) return freeze({ value: lo, iterations: 0, residual: 0 });
  if (fhi === 0) return freeze({ value: hi, iterations: 0, residual: 0 });
  if (flo * fhi > 0) throw new Error('BREAK_EVEN_NOT_BRACKETED');
  let mid = lo, fm = flo;
  for (let i = 1; i <= maxIterations; i++) {
    mid = (lo + hi) / 2;
    fm = finite(evaluator(mid), 'evaluator(mid)') - target;
    if (Math.abs(fm) <= tolerance || Math.abs(hi - lo) <= tolerance) return freeze({ value: mid, iterations: i, residual: fm });
    if (flo * fm <= 0) { hi = mid; fhi = fm; } else { lo = mid; flo = fm; }
  }
  return freeze({ value: mid, iterations: maxIterations, residual: fm, warning: 'MAX_ITERATIONS_REACHED' });
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function sampleTriangular(min, mode, max, rand) {
  finite(min, 'min'); finite(mode, 'mode'); finite(max, 'max');
  if (!(min <= mode && mode <= max) || min === max) throw new RangeError('triangular distribution requires min <= mode <= max and min < max');
  const u = rand();
  const c = (mode - min) / (max - min);
  return u < c ? min + Math.sqrt(u * (max - min) * (mode - min)) : max - Math.sqrt((1 - u) * (max - min) * (max - mode));
}

function runMonteCarlo({ baseInputs, distributions, iterations = 5000, seed = 20260831, evaluator, metricSelector }) {
  requireObject(baseInputs, 'baseInputs');
  if (!Array.isArray(distributions) || distributions.length === 0) return freeze({ status: SIMULATION_STATUS.HOLD_DISTRIBUTIONS, reason: 'QUALIFIED_DISTRIBUTIONS_REQUIRED' });
  if (typeof evaluator !== 'function' || typeof metricSelector !== 'function') return freeze({ status: SIMULATION_STATUS.HOLD_EVALUATOR, reason: 'QUALIFIED_EVALUATOR_REQUIRED' });
  if (!Number.isInteger(iterations) || iterations < 100 || iterations > 100000) throw new RangeError('iterations must be integer between 100 and 100000');
  const rand = mulberry32(seed);
  const values = [];
  for (let i = 0; i < iterations; i++) {
    const inputs = { ...baseInputs };
    for (const d of distributions) {
      if (!d || d.type !== 'TRIANGULAR') throw new Error('ONLY_TRIANGULAR_DISTRIBUTIONS_SUPPORTED_V1');
      if (!Object.prototype.hasOwnProperty.call(baseInputs, d.key)) throw new Error(`MONTE_CARLO_UNKNOWN_INPUT: ${d.key}`);
      inputs[d.key] = sampleTriangular(d.min, d.mode, d.max, rand);
    }
    values.push(finite(metricSelector(evaluator(inputs)), 'simulation metric'));
  }
  values.sort((a, b) => a - b);
  const percentile = (p) => values[Math.min(values.length - 1, Math.max(0, Math.floor((values.length - 1) * p)))];
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const probabilityBelowZero = values.filter((v) => v < 0).length / values.length;
  return freeze({ status: SIMULATION_STATUS.QUALIFIED, iterations, seed, mean, p05: percentile(0.05), p50: percentile(0.50), p95: percentile(0.95), min: values[0], max: values[values.length - 1], probabilityBelowZero, semantics: 'Monte Carlo output is conditional on the supplied distributions and deterministic evaluator. It is not a prediction or guarantee.' });
}

function createRiskFlag({ code, severity, driver, rationale, evidenceRefs = [], mitigation = null }) {
  if (typeof code !== 'string' || !code.trim()) throw new TypeError('code is required');
  if (!Object.values(RISK_SEVERITY).includes(severity)) throw new TypeError(`invalid severity: ${severity}`);
  if (typeof driver !== 'string' || !driver.trim()) throw new TypeError('driver is required');
  if (typeof rationale !== 'string' || !rationale.trim()) throw new TypeError('rationale is required');
  if (!Array.isArray(evidenceRefs)) throw new TypeError('evidenceRefs must be an array');
  if (mitigation !== null && typeof mitigation !== 'string') throw new TypeError('mitigation must be string or null');
  return freeze({ code: code.trim(), severity, driver: driver.trim(), rationale: rationale.trim(), evidenceRefs: evidenceRefs.map(String), mitigation });
}

module.exports = {
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
};
