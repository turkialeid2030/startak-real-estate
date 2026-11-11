'use strict';

const CORRELATED_SIMULATION_STATUS = Object.freeze({
  QUALIFIED: 'QUALIFIED',
  HOLD_DISTRIBUTIONS: 'HOLD_DISTRIBUTIONS',
  HOLD_EVALUATOR: 'HOLD_EVALUATOR',
  HOLD_CORRELATION_MODEL: 'HOLD_CORRELATION_MODEL',
});

const CORRELATED_SAMPLING_MODEL = 'GAUSSIAN_COPULA_TRIANGULAR_V1';
const MATRIX_TOLERANCE = 1e-10;

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

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function triangularFromUniform(min, mode, max, u) {
  finite(min, 'min'); finite(mode, 'mode'); finite(max, 'max'); finite(u, 'u');
  if (!(min <= mode && mode <= max) || min === max) throw new RangeError('triangular distribution requires min <= mode <= max and min < max');
  if (u < 0 || u > 1) throw new RangeError('u must be between 0 and 1');
  const split = (mode - min) / (max - min);
  return u < split
    ? min + Math.sqrt(u * (max - min) * (mode - min))
    : max - Math.sqrt((1 - u) * (max - min) * (max - mode));
}

function erf(value) {
  const sign = value < 0 ? -1 : 1;
  const x = Math.abs(value);
  const t = 1 / (1 + 0.3275911 * x);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return sign * y;
}

function standardNormalCdf(z) {
  finite(z, 'z');
  const value = 0.5 * (1 + erf(z / Math.SQRT2));
  return Math.min(1 - Number.EPSILON, Math.max(Number.EPSILON, value));
}

function standardNormal(rand) {
  let u1 = rand();
  const u2 = rand();
  if (u1 <= 0) u1 = Number.MIN_VALUE;
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function normalizeDistributions(baseInputs, distributions) {
  requireObject(baseInputs, 'baseInputs');
  if (!Array.isArray(distributions) || distributions.length === 0) return null;
  const keys = new Set();
  return distributions.map((distribution, index) => {
    requireObject(distribution, `distributions[${index}]`);
    if (distribution.type !== 'TRIANGULAR') throw new Error('ONLY_TRIANGULAR_DISTRIBUTIONS_SUPPORTED_C7');
    const key = typeof distribution.key === 'string' ? distribution.key.trim() : '';
    if (!key) throw new TypeError(`distributions[${index}].key is required`);
    if (keys.has(key)) throw new Error(`DUPLICATE_CORRELATED_DISTRIBUTION_VARIABLE:${key}`);
    keys.add(key);
    if (!Object.prototype.hasOwnProperty.call(baseInputs, key)) throw new Error(`CORRELATED_MONTE_CARLO_UNKNOWN_INPUT:${key}`);
    finite(baseInputs[key], `baseInputs.${key}`);
    const min = finite(distribution.min, `distributions[${index}].min`);
    const mode = finite(distribution.mode, `distributions[${index}].mode`);
    const max = finite(distribution.max, `distributions[${index}].max`);
    if (!(min <= mode && mode <= max) || min === max) throw new RangeError(`invalid triangular distribution:${key}`);
    return freeze({ key, type: 'TRIANGULAR', min, mode, max });
  });
}

function validateCorrelationModel(correlationModel, expectedVariableKeys) {
  if (!correlationModel || typeof correlationModel !== 'object' || Array.isArray(correlationModel)) {
    return freeze({ valid: false, blocker: 'CORRELATION_MODEL_REQUIRED' });
  }
  const variableKeys = Array.isArray(correlationModel.variableKeys) ? correlationModel.variableKeys.map((key) => String(key).trim()) : [];
  if (variableKeys.length === 0 || variableKeys.some((key) => !key)) return freeze({ valid: false, blocker: 'CORRELATION_VARIABLE_KEYS_REQUIRED' });
  if (new Set(variableKeys).size !== variableKeys.length) return freeze({ valid: false, blocker: 'DUPLICATE_CORRELATION_VARIABLE_KEY' });
  if (variableKeys.length !== expectedVariableKeys.length) return freeze({ valid: false, blocker: 'CORRELATION_VARIABLE_COUNT_MISMATCH' });
  for (let i = 0; i < variableKeys.length; i++) {
    if (variableKeys[i] !== expectedVariableKeys[i]) return freeze({ valid: false, blocker: `CORRELATION_VARIABLE_ORDER_MISMATCH:${i}` });
  }

  const matrix = correlationModel.matrix;
  if (!Array.isArray(matrix) || matrix.length !== variableKeys.length) return freeze({ valid: false, blocker: 'CORRELATION_MATRIX_DIMENSION_MISMATCH' });
  const normalized = [];
  for (let i = 0; i < matrix.length; i++) {
    if (!Array.isArray(matrix[i]) || matrix[i].length !== variableKeys.length) return freeze({ valid: false, blocker: 'CORRELATION_MATRIX_DIMENSION_MISMATCH' });
    const row = [];
    for (let j = 0; j < matrix[i].length; j++) {
      const value = matrix[i][j];
      if (typeof value !== 'number' || !Number.isFinite(value)) return freeze({ valid: false, blocker: `CORRELATION_MATRIX_NON_FINITE:${i}:${j}` });
      if (value < -1 || value > 1) return freeze({ valid: false, blocker: `CORRELATION_COEFFICIENT_OUT_OF_RANGE:${i}:${j}` });
      if (i === j && Math.abs(value - 1) > MATRIX_TOLERANCE) return freeze({ valid: false, blocker: `CORRELATION_DIAGONAL_NOT_ONE:${i}` });
      row.push(value);
    }
    normalized.push(row);
  }
  for (let i = 0; i < normalized.length; i++) {
    for (let j = i + 1; j < normalized.length; j++) {
      if (Math.abs(normalized[i][j] - normalized[j][i]) > MATRIX_TOLERANCE) return freeze({ valid: false, blocker: `CORRELATION_MATRIX_ASYMMETRIC:${i}:${j}` });
    }
  }

  try {
    const factor = choleskySemidefinite(normalized);
    return freeze({ valid: true, variableKeys, matrix: normalized, factor });
  } catch (error) {
    return freeze({ valid: false, blocker: error.message === 'CORRELATION_MATRIX_NOT_POSITIVE_SEMIDEFINITE' ? error.message : 'CORRELATION_MATRIX_FACTORIZATION_FAILURE' });
  }
}

function choleskySemidefinite(matrix) {
  const n = matrix.length;
  const lower = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let residual = matrix[i][j];
      for (let k = 0; k < j; k++) residual -= lower[i][k] * lower[j][k];
      if (i === j) {
        if (residual < -MATRIX_TOLERANCE) throw new Error('CORRELATION_MATRIX_NOT_POSITIVE_SEMIDEFINITE');
        lower[i][j] = Math.sqrt(Math.max(0, residual));
      } else if (Math.abs(lower[j][j]) <= MATRIX_TOLERANCE) {
        if (Math.abs(residual) > MATRIX_TOLERANCE) throw new Error('CORRELATION_MATRIX_NOT_POSITIVE_SEMIDEFINITE');
        lower[i][j] = 0;
      } else {
        lower[i][j] = residual / lower[j][j];
      }
    }
  }
  return lower;
}

function normalizeThresholds(thresholds) {
  if (thresholds === undefined || thresholds === null) return [];
  if (!Array.isArray(thresholds)) throw new TypeError('thresholds must be an array');
  const ids = new Set();
  return thresholds.map((threshold, index) => {
    requireObject(threshold, `thresholds[${index}]`);
    const thresholdId = typeof threshold.thresholdId === 'string' ? threshold.thresholdId.trim() : '';
    if (!thresholdId) throw new TypeError(`thresholds[${index}].thresholdId is required`);
    if (ids.has(thresholdId)) throw new Error(`DUPLICATE_SIMULATION_THRESHOLD_ID:${thresholdId}`);
    ids.add(thresholdId);
    const operator = threshold.operator;
    if (!['BELOW', 'AT_OR_BELOW', 'ABOVE', 'AT_OR_ABOVE'].includes(operator)) throw new TypeError(`thresholds[${index}].operator is invalid`);
    return freeze({ thresholdId, operator, threshold: finite(threshold.threshold, `thresholds[${index}].threshold`) });
  });
}

function thresholdCondition(value, threshold) {
  if (threshold.operator === 'BELOW') return value < threshold.threshold;
  if (threshold.operator === 'AT_OR_BELOW') return value <= threshold.threshold;
  if (threshold.operator === 'ABOVE') return value > threshold.threshold;
  if (threshold.operator === 'AT_OR_ABOVE') return value >= threshold.threshold;
  return false;
}

function runCorrelatedMonteCarlo({ baseInputs, distributions, correlationModel, iterations = 5000, seed = 20260930, evaluator, metricSelector, thresholds = [] }) {
  requireObject(baseInputs, 'baseInputs');
  const normalizedDistributions = normalizeDistributions(baseInputs, distributions);
  if (!normalizedDistributions) return freeze({ status: CORRELATED_SIMULATION_STATUS.HOLD_DISTRIBUTIONS, reason: 'QUALIFIED_DISTRIBUTIONS_REQUIRED' });
  if (typeof evaluator !== 'function' || typeof metricSelector !== 'function') return freeze({ status: CORRELATED_SIMULATION_STATUS.HOLD_EVALUATOR, reason: 'QUALIFIED_EVALUATOR_REQUIRED' });
  if (!Number.isInteger(iterations) || iterations < 100 || iterations > 100000) throw new RangeError('iterations must be integer between 100 and 100000');
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new RangeError('seed must be an unsigned 32-bit integer');

  const correlation = validateCorrelationModel(correlationModel, normalizedDistributions.map((item) => item.key));
  if (!correlation.valid) return freeze({ status: CORRELATED_SIMULATION_STATUS.HOLD_CORRELATION_MODEL, reason: correlation.blocker });
  const normalizedThresholds = normalizeThresholds(thresholds);
  const rand = mulberry32(seed);
  const values = [];

  for (let iteration = 0; iteration < iterations; iteration++) {
    const independentNormals = normalizedDistributions.map(() => standardNormal(rand));
    const correlatedNormals = correlation.factor.map((row, i) => {
      let total = 0;
      for (let j = 0; j <= i; j++) total += row[j] * independentNormals[j];
      return total;
    });
    const inputs = { ...baseInputs };
    for (let i = 0; i < normalizedDistributions.length; i++) {
      const distribution = normalizedDistributions[i];
      inputs[distribution.key] = triangularFromUniform(distribution.min, distribution.mode, distribution.max, standardNormalCdf(correlatedNormals[i]));
    }
    values.push(finite(metricSelector(evaluator(inputs)), 'simulation metric'));
  }

  values.sort((a, b) => a - b);
  const percentile = (p) => values[Math.min(values.length - 1, Math.max(0, Math.floor((values.length - 1) * p)))];
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / values.length;
  const thresholdProbabilities = normalizedThresholds.map((threshold) => freeze({
    ...threshold,
    probabilityConditionMet: values.filter((value) => thresholdCondition(value, threshold)).length / values.length,
  }));
  const output = {
    status: CORRELATED_SIMULATION_STATUS.QUALIFIED,
    samplingModel: CORRELATED_SAMPLING_MODEL,
    correlationModelApplied: true,
    variableKeys: [...correlation.variableKeys],
    iterations,
    seed,
    mean,
    standardDeviation: Math.sqrt(variance),
    p05: percentile(0.05),
    p50: percentile(0.50),
    p95: percentile(0.95),
    min: values[0],
    max: values[values.length - 1],
    probabilityBelowZero: values.filter((value) => value < 0).length / values.length,
    semantics: 'Correlated Monte Carlo output is conditional on the supplied triangular marginals, correlation matrix and deterministic evaluator. It is analytical decision support, not a prediction, guarantee, approval, transaction authorization or professional valuation conclusion.',
  };
  if (thresholdProbabilities.length > 0) output.thresholdProbabilities = thresholdProbabilities;
  return freeze(output);
}

module.exports = {
  CORRELATED_SIMULATION_STATUS,
  CORRELATED_SAMPLING_MODEL,
  MATRIX_TOLERANCE,
  triangularFromUniform,
  standardNormalCdf,
  choleskySemidefinite,
  validateCorrelationModel,
  runCorrelatedMonteCarlo,
};
