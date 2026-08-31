'use strict';

const {
  BASIS_OF_VALUE,
  VALUATION_METHOD,
  EVIDENCE_GRADE,
  INPUT_STATUS,
  createEvidenceRecord,
  createValuationIndication,
} = require('./contracts');

function nonNegative(value, field) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new TypeError(`${field} must be >= 0`);
  return value;
}

function positive(value, field) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) throw new TypeError(`${field} must be > 0`);
  return value;
}

function normalizeCostItems(items = []) {
  if (!Array.isArray(items)) throw new TypeError('indirectCosts must be an array');
  return items.map((item, index) => {
    if (!item || typeof item !== 'object') throw new TypeError(`indirectCosts[${index}] must be an object`);
    const label = String(item.label || '').trim();
    if (!label) throw new TypeError(`indirectCosts[${index}].label is required`);
    nonNegative(item.amount, `indirectCosts[${index}].amount`);
    return Object.freeze({ label, amount: item.amount });
  });
}

function deriveAgeLifeDepreciation({ effectiveAge, totalEconomicLife }) {
  nonNegative(effectiveAge, 'effectiveAge');
  positive(totalEconomicLife, 'totalEconomicLife');
  if (effectiveAge > totalEconomicLife) throw new RangeError('effectiveAge cannot exceed totalEconomicLife');
  return effectiveAge / totalEconomicLife;
}

function evidence(field, descriptor) {
  if (!descriptor || typeof descriptor !== 'object') throw new TypeError(`${field} evidence descriptor is required`);
  if (!Object.values(EVIDENCE_GRADE).includes(descriptor.grade)) throw new TypeError(`${field} evidence grade is invalid`);
  return createEvidenceRecord({
    field,
    grade: descriptor.grade,
    status: descriptor.status || INPUT_STATUS.OBSERVED,
    sourceType: descriptor.sourceType || 'UNSPECIFIED',
    sourceRef: descriptor.sourceRef || null,
    observedAt: descriptor.observedAt || null,
    note: descriptor.note || null,
  });
}

function calculateDepreciatedReplacementCost({
  landValue,
  directReplacementCost,
  indirectCosts = [],
  depreciationRate,
  landEvidence,
  replacementCostEvidence,
  depreciationEvidence,
  basis = BASIS_OF_VALUE.MARKET_VALUE,
  valuationDate = null,
  currency = 'SAR',
}) {
  nonNegative(landValue, 'landValue');
  positive(directReplacementCost, 'directReplacementCost');
  if (typeof depreciationRate !== 'number' || !Number.isFinite(depreciationRate) || depreciationRate < 0 || depreciationRate > 1) {
    throw new TypeError('depreciationRate must be in [0,1]');
  }
  if (![BASIS_OF_VALUE.MARKET_VALUE, BASIS_OF_VALUE.FAIR_VALUE, BASIS_OF_VALUE.INVESTMENT_VALUE].includes(basis)) {
    throw new TypeError('cost approach supports MARKET_VALUE, FAIR_VALUE, or INVESTMENT_VALUE');
  }

  const normalizedIndirectCosts = normalizeCostItems(indirectCosts);
  const indirectCostTotal = normalizedIndirectCosts.reduce((sum, item) => sum + item.amount, 0);
  const replacementCostNew = directReplacementCost + indirectCostTotal;
  const depreciationAmount = replacementCostNew * depreciationRate;
  const depreciatedImprovementValue = replacementCostNew - depreciationAmount;
  const totalValue = landValue + depreciatedImprovementValue;

  return createValuationIndication({
    method: VALUATION_METHOD.COST_DEPRECIATED_REPLACEMENT,
    basis,
    value: totalValue,
    currency,
    valuationDate,
    evidence: [
      evidence('landValue', landEvidence),
      evidence('replacementCost', replacementCostEvidence),
      evidence('depreciationRate', depreciationEvidence),
    ],
    components: {
      landValue,
      directReplacementCost,
      indirectCosts: normalizedIndirectCosts,
      indirectCostTotal,
      replacementCostNew,
      depreciationRate,
      depreciationAmount,
      depreciatedImprovementValue,
    },
  });
}

module.exports = {
  deriveAgeLifeDepreciation,
  calculateDepreciatedReplacementCost,
};
