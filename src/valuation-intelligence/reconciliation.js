'use strict';

const { INDICATION_STATUS, weakestEvidenceGrade } = require('./contracts');

const RECONCILIATION_STATUS = Object.freeze({
  QUALIFIED: 'QUALIFIED',
  HOLD_POLICY_REQUIRED: 'HOLD_POLICY_REQUIRED',
  HOLD_INPUT_METHOD: 'HOLD_INPUT_METHOD',
  HOLD_BASIS_MISMATCH: 'HOLD_BASIS_MISMATCH',
  HOLD_CURRENCY_MISMATCH: 'HOLD_CURRENCY_MISMATCH',
  HOLD_DATE_MISMATCH: 'HOLD_DATE_MISMATCH',
  HOLD_DISPERSION: 'HOLD_DISPERSION',
});

function baseResult(status, payload = {}) {
  return Object.freeze({
    schemaVersion: 1,
    status,
    ...payload,
    semantics: 'Reconciliation is a controlled valuation judgement layer, not an automatic investment recommendation.',
  });
}

function reconcileValuationIndications({
  indications,
  methodWeights = null,
  dispersionThreshold = null,
}) {
  if (!Array.isArray(indications) || indications.length < 2) throw new TypeError('at least two valuation indications are required');
  if (indications.some((item) => !item || item.status !== INDICATION_STATUS.QUALIFIED)) {
    return baseResult(RECONCILIATION_STATUS.HOLD_INPUT_METHOD, { reconciledValue: null });
  }

  const basisSet = new Set(indications.map((item) => item.basis));
  if (basisSet.size !== 1) return baseResult(RECONCILIATION_STATUS.HOLD_BASIS_MISMATCH, { reconciledValue: null });
  const currencySet = new Set(indications.map((item) => item.currency));
  if (currencySet.size !== 1) return baseResult(RECONCILIATION_STATUS.HOLD_CURRENCY_MISMATCH, { reconciledValue: null });
  const dates = indications.map((item) => item.valuationDate).filter(Boolean);
  if (new Set(dates).size > 1) return baseResult(RECONCILIATION_STATUS.HOLD_DATE_MISMATCH, { reconciledValue: null });

  const values = indications.map((item) => item.value);
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);

  if (!methodWeights || typeof methodWeights !== 'object' || Array.isArray(methodWeights) || dispersionThreshold === null) {
    return baseResult(RECONCILIATION_STATUS.HOLD_POLICY_REQUIRED, {
      reconciledValue: null,
      methodCount: indications.length,
      minimum,
      maximum,
      absoluteRange: maximum - minimum,
      requiredPolicy: ['methodWeights', 'dispersionThreshold'],
    });
  }

  if (typeof dispersionThreshold !== 'number' || !Number.isFinite(dispersionThreshold) || dispersionThreshold < 0) {
    throw new TypeError('dispersionThreshold must be a finite number >= 0');
  }

  const seenMethods = new Set();
  let weightSum = 0;
  let weightedValue = 0;
  for (const indication of indications) {
    if (seenMethods.has(indication.method)) throw new TypeError(`duplicate method in reconciliation: ${indication.method}`);
    seenMethods.add(indication.method);
    const weight = methodWeights[indication.method];
    if (typeof weight !== 'number' || !Number.isFinite(weight) || weight <= 0 || weight > 1) {
      throw new TypeError(`methodWeights.${indication.method} must be in (0,1]`);
    }
    weightSum += weight;
    weightedValue += indication.value * weight;
  }
  if (Math.abs(weightSum - 1) > 1e-9) throw new RangeError(`method weights must sum to 1; got ${weightSum}`);

  const denominator = Math.abs(weightedValue) > 1e-12 ? Math.abs(weightedValue) : 1;
  const dispersion = (maximum - minimum) / denominator;
  const evidence = indications.flatMap((item) => item.evidence || []);
  const methodBreakdown = indications.map((item) => Object.freeze({
    method: item.method,
    value: item.value,
    weight: methodWeights[item.method],
    weightedContribution: item.value * methodWeights[item.method],
    weakestEvidenceGrade: item.weakestEvidenceGrade,
  }));

  if (dispersion > dispersionThreshold) {
    return baseResult(RECONCILIATION_STATUS.HOLD_DISPERSION, {
      reconciledValue: null,
      provisionalWeightedValue: weightedValue,
      minimum,
      maximum,
      absoluteRange: maximum - minimum,
      dispersion,
      dispersionThreshold,
      weakestEvidenceGrade: weakestEvidenceGrade(evidence),
      methodBreakdown,
    });
  }

  return baseResult(RECONCILIATION_STATUS.QUALIFIED, {
    reconciledValue: weightedValue,
    basis: indications[0].basis,
    currency: indications[0].currency,
    valuationDate: dates[0] || null,
    minimum,
    maximum,
    absoluteRange: maximum - minimum,
    dispersion,
    dispersionThreshold,
    weakestEvidenceGrade: weakestEvidenceGrade(evidence),
    methodBreakdown,
  });
}

module.exports = {
  RECONCILIATION_STATUS,
  reconcileValuationIndications,
};
