'use strict';

const {
  BASIS_OF_VALUE,
  VALUATION_METHOD,
  EVIDENCE_GRADE,
  INPUT_STATUS,
  createEvidenceRecord,
  createValuationIndication,
} = require('./contracts');

const TRANSACTION_STATUS = Object.freeze({
  EXECUTED_SALE: 'EXECUTED_SALE',
  ASKING_SALE: 'ASKING_SALE',
  EXECUTED_LEASE: 'EXECUTED_LEASE',
  ASKING_LEASE: 'ASKING_LEASE',
});

const WEIGHTING_POLICY = Object.freeze({
  EXPLICIT: 'EXPLICIT',
  EQUAL: 'EQUAL',
});

function requirePositive(value, field) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) throw new TypeError(`${field} must be > 0`);
  return value;
}

function normalizeAdjustment(adjustment, index) {
  if (!adjustment || typeof adjustment !== 'object') throw new TypeError(`adjustment[${index}] must be an object`);
  const factor = String(adjustment.factor || '').trim();
  const percent = adjustment.percent;
  if (!factor) throw new TypeError(`adjustment[${index}].factor is required`);
  if (typeof percent !== 'number' || !Number.isFinite(percent) || percent <= -1 || percent >= 1) {
    throw new TypeError(`adjustment[${index}].percent must be between -1 and 1`);
  }
  return Object.freeze({ factor, percent });
}

function createComparable({
  comparableId,
  unitValue,
  transactionStatus,
  evidenceGrade,
  adjustments = [],
  weight = null,
  transactionDate = null,
  sourceRef = null,
  metadata = {},
}) {
  const id = String(comparableId || '').trim();
  if (!id) throw new TypeError('comparableId is required');
  requirePositive(unitValue, 'unitValue');
  if (!Object.values(TRANSACTION_STATUS).includes(transactionStatus)) throw new TypeError(`invalid transactionStatus: ${transactionStatus}`);
  if (!Object.values(EVIDENCE_GRADE).includes(evidenceGrade)) throw new TypeError(`invalid evidenceGrade: ${evidenceGrade}`);
  if (!Array.isArray(adjustments)) throw new TypeError('adjustments must be an array');
  if (weight !== null && (typeof weight !== 'number' || !Number.isFinite(weight) || weight <= 0 || weight > 1)) {
    throw new TypeError('weight must be in (0,1] or null');
  }
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) throw new TypeError('metadata must be an object');

  const normalizedAdjustments = adjustments.map(normalizeAdjustment);
  const netAdjustment = normalizedAdjustments.reduce((sum, item) => sum + item.percent, 0);
  if (netAdjustment <= -1) throw new RangeError('net comparable adjustment would reduce value to zero or below');
  const adjustedUnitValue = unitValue * (1 + netAdjustment);

  return Object.freeze({
    comparableId: id,
    unitValue,
    transactionStatus,
    evidenceGrade,
    adjustments: normalizedAdjustments,
    netAdjustment,
    adjustedUnitValue,
    weight,
    transactionDate: transactionDate ? String(transactionDate).trim() : null,
    sourceRef: sourceRef ? String(sourceRef).trim() : null,
    metadata: { ...metadata },
  });
}

function calculateMarketComparableIndication({
  comparables,
  subjectArea,
  basis = BASIS_OF_VALUE.MARKET_VALUE,
  weightingPolicy = WEIGHTING_POLICY.EXPLICIT,
  valuationDate = null,
  currency = 'SAR',
}) {
  if (!Array.isArray(comparables) || comparables.length < 2) throw new TypeError('at least two comparables are required');
  requirePositive(subjectArea, 'subjectArea');
  if (![BASIS_OF_VALUE.MARKET_VALUE, BASIS_OF_VALUE.FAIR_VALUE, BASIS_OF_VALUE.MARKET_RENT].includes(basis)) {
    throw new TypeError('market comparable approach supports MARKET_VALUE, FAIR_VALUE, or MARKET_RENT');
  }
  if (!Object.values(WEIGHTING_POLICY).includes(weightingPolicy)) throw new TypeError(`invalid weightingPolicy: ${weightingPolicy}`);

  let weights;
  if (weightingPolicy === WEIGHTING_POLICY.EQUAL) {
    weights = comparables.map(() => 1 / comparables.length);
  } else {
    if (comparables.some((item) => item.weight === null)) throw new TypeError('EXPLICIT weighting requires a weight for every comparable');
    const total = comparables.reduce((sum, item) => sum + item.weight, 0);
    if (Math.abs(total - 1) > 1e-9) throw new RangeError(`comparable weights must sum to 1; got ${total}`);
    weights = comparables.map((item) => item.weight);
  }

  const weightedUnitValue = comparables.reduce((sum, item, index) => sum + item.adjustedUnitValue * weights[index], 0);
  const totalValue = weightedUnitValue * subjectArea;
  const askingCount = comparables.filter((item) => [TRANSACTION_STATUS.ASKING_SALE, TRANSACTION_STATUS.ASKING_LEASE].includes(item.transactionStatus)).length;
  const executedCount = comparables.length - askingCount;
  const warnings = [];
  if (askingCount === comparables.length) warnings.push('ALL_COMPARABLES_ARE_ASKING_EVIDENCE');
  else if (askingCount > 0) warnings.push('MIXED_EXECUTED_AND_ASKING_EVIDENCE');

  const evidence = comparables.map((item) => createEvidenceRecord({
    field: `comparable:${item.comparableId}`,
    grade: item.evidenceGrade,
    status: [EVIDENCE_GRADE.G_EXPERT_ASSUMPTION, EVIDENCE_GRADE.H_CLIENT_SUPPLIED_UNVERIFIED].includes(item.evidenceGrade)
      ? INPUT_STATUS.UNVERIFIED
      : INPUT_STATUS.OBSERVED,
    sourceType: item.transactionStatus,
    sourceRef: item.sourceRef,
    observedAt: item.transactionDate,
  }));

  return createValuationIndication({
    method: VALUATION_METHOD.MARKET_COMPARABLE,
    basis,
    value: totalValue,
    currency,
    valuationDate,
    evidence,
    assumptions: weightingPolicy === WEIGHTING_POLICY.EQUAL ? ['EQUAL_COMPARABLE_WEIGHTING_EXPLICITLY_SELECTED'] : [],
    warnings,
    components: {
      subjectArea,
      weightedUnitValue,
      comparableCount: comparables.length,
      askingCount,
      executedCount,
      weightingPolicy,
      comparables: comparables.map((item, index) => ({ ...item, appliedWeight: weights[index] })),
      policyNote: 'Transaction status is recorded but no hidden asking-to-executed discount is applied.',
    },
  });
}

module.exports = {
  TRANSACTION_STATUS,
  WEIGHTING_POLICY,
  createComparable,
  calculateMarketComparableIndication,
};
