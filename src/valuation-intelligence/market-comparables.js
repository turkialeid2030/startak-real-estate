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


const MARKET_COMPARABLE_DECISION_STATUS = Object.freeze({
  READY: 'READY_FOR_DECISION_CONTROL',
  HOLD: 'HOLD_MARKET_COMPARABLE_EVIDENCE',
});

function validObservedDate(value) {
  return typeof value === 'string'
    && /^\\d{4}-\\d{2}-\\d{2}(?:T.*)?$/.test(value)
    && Number.isFinite(Date.parse(value));
}

/**
 * Decision qualification is stricter than a numerical market indication.
 * Offers and untraceable comparables may still produce a preliminary number,
 * but must never advance as qualified evidence to decision control.
 */
function assessMarketComparableDecisionReadiness({ comparables, basis, valuationDate }) {
  const blockers = [];
  const requiredStatus = basis === BASIS_OF_VALUE.MARKET_RENT
    ? TRANSACTION_STATUS.EXECUTED_LEASE
    : TRANSACTION_STATUS.EXECUTED_SALE;
  const highQualityGrades = requiredStatus === TRANSACTION_STATUS.EXECUTED_LEASE
    ? [EVIDENCE_GRADE.A_VERIFIED_OFFICIAL, EVIDENCE_GRADE.B_VERIFIED_TRANSACTION, EVIDENCE_GRADE.C_CONTRACTUAL]
    : [EVIDENCE_GRADE.A_VERIFIED_OFFICIAL, EVIDENCE_GRADE.B_VERIFIED_TRANSACTION];
  const validValuationDate = validObservedDate(valuationDate);
  if (!validValuationDate) blockers.push('MARKET_COMPARABLE_VALUATION_DATE_REQUIRED');
  const ids = new Set();
  let qualifyingExecutedCount = 0;

  comparables.forEach((item, index) => {
    const id = String(item.comparableId || index);
    if (ids.has(id)) blockers.push(`MARKET_COMPARABLE_DUPLICATE_ID:${id}`);
    ids.add(id);

    if (item.transactionStatus !== requiredStatus) {
      blockers.push(`MARKET_COMPARABLE_TRANSACTION_BASIS_MISMATCH:${id}`);
    }
    const sourceValid = typeof item.sourceRef === 'string' && item.sourceRef.trim().length > 0;
    const dateValid = validObservedDate(item.transactionDate);
    const dateNotFuture = dateValid && validValuationDate
      && Date.parse(item.transactionDate) <= Date.parse(valuationDate);
    const gradeValid = highQualityGrades.includes(item.evidenceGrade);
    if (!sourceValid) blockers.push(`MARKET_COMPARABLE_SOURCE_REQUIRED:${id}`);
    if (!dateValid) blockers.push(`MARKET_COMPARABLE_TRANSACTION_DATE_REQUIRED:${id}`);
    else if (validValuationDate && !dateNotFuture) blockers.push(`MARKET_COMPARABLE_DATE_AFTER_VALUATION:${id}`);
    if (item.transactionStatus === requiredStatus && !gradeValid) {
      blockers.push(`MARKET_COMPARABLE_EXECUTED_EVIDENCE_GRADE_INSUFFICIENT:${id}`);
    }
    if (item.transactionStatus === requiredStatus && sourceValid && dateNotFuture && gradeValid) {
      qualifyingExecutedCount += 1;
    }
  });

  if (qualifyingExecutedCount < 2) {
    blockers.push(`MARKET_COMPARABLE_MIN_EXECUTED_TRANSACTIONS:${qualifyingExecutedCount}/2`);
  }
  return Object.freeze({
    status: blockers.length ? MARKET_COMPARABLE_DECISION_STATUS.HOLD : MARKET_COMPARABLE_DECISION_STATUS.READY,
    blockers: Object.freeze(blockers),
    requiredTransactionStatus: requiredStatus,
    qualifyingExecutedCount,
    sourceAndDateVerifiedBySystem: false,
    professionalSelectionRequired: true,
    independentMarketBacktestEstablished: false,
    semantics: 'This structural decision gate checks sale/rent basis, offer status, source identifiers, valuation-date chronology and evidence grade. It does not verify source authenticity or certify valuation accuracy.',
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

  const decisionReadiness = assessMarketComparableDecisionReadiness({ comparables, basis, valuationDate });
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


  if (decisionReadiness.status !== MARKET_COMPARABLE_DECISION_STATUS.READY) {
    evidence.push(createEvidenceRecord({
      field: 'marketComparableDecisionReadiness',
      grade: EVIDENCE_GRADE.G_EXPERT_ASSUMPTION,
      status: INPUT_STATUS.CONFLICT,
      sourceType: 'DECISION_READINESS_GATE',
      note: decisionReadiness.blockers.join('; '),
    }));
    warnings.push('MARKET_COMPARABLE_PRELIMINARY_ONLY_NOT_DECISION_READY');
  }

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
      decisionReadiness,
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
  MARKET_COMPARABLE_DECISION_STATUS,
  assessMarketComparableDecisionReadiness,
  createComparable,
  calculateMarketComparableIndication,
};
