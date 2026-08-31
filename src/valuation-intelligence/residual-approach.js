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

function calculateResidualLandValue({
  completedAssetValue,
  developmentCosts,
  financeCosts = 0,
  developerProfit = 0,
  contingency = 0,
  sellingCosts = 0,
  developmentYears = 0,
  discountRate = 0,
  completedValueEvidence,
  developmentCostEvidence,
  discountRateEvidence,
  basis = BASIS_OF_VALUE.RESIDUAL_LAND_VALUE,
  valuationDate = null,
  currency = 'SAR',
}) {
  positive(completedAssetValue, 'completedAssetValue');
  nonNegative(developmentCosts, 'developmentCosts');
  nonNegative(financeCosts, 'financeCosts');
  nonNegative(developerProfit, 'developerProfit');
  nonNegative(contingency, 'contingency');
  nonNegative(sellingCosts, 'sellingCosts');
  nonNegative(developmentYears, 'developmentYears');
  if (typeof discountRate !== 'number' || !Number.isFinite(discountRate) || discountRate < 0 || discountRate >= 1) {
    throw new TypeError('discountRate must be in [0,1)');
  }
  if (![BASIS_OF_VALUE.RESIDUAL_LAND_VALUE, BASIS_OF_VALUE.MARKET_VALUE, BASIS_OF_VALUE.INVESTMENT_VALUE].includes(basis)) {
    throw new TypeError('residual approach supports RESIDUAL_LAND_VALUE, MARKET_VALUE, or INVESTMENT_VALUE');
  }

  const totalDeductions = developmentCosts + financeCosts + developerProfit + contingency + sellingCosts;
  const residualAtCompletion = completedAssetValue - totalDeductions;
  const discountFactor = developmentYears === 0 ? 1 : 1 / Math.pow(1 + discountRate, developmentYears);
  const presentResidualValue = residualAtCompletion * discountFactor;
  const warnings = [];
  if (residualAtCompletion < 0) warnings.push('NEGATIVE_RESIDUAL_AT_COMPLETION');
  if (developmentYears > 0 && discountRate === 0) warnings.push('ZERO_DISCOUNT_RATE_WITH_NONZERO_DEVELOPMENT_PERIOD');

  return createValuationIndication({
    method: VALUATION_METHOD.RESIDUAL,
    basis,
    value: presentResidualValue,
    currency,
    valuationDate,
    evidence: [
      evidence('completedAssetValue', completedValueEvidence),
      evidence('developmentCosts', developmentCostEvidence),
      evidence('discountRate', discountRateEvidence),
    ],
    warnings,
    components: {
      completedAssetValue,
      developmentCosts,
      financeCosts,
      developerProfit,
      contingency,
      sellingCosts,
      totalDeductions,
      residualAtCompletion,
      developmentYears,
      discountRate,
      discountFactor,
      presentResidualValue,
    },
  });
}

module.exports = { calculateResidualLandValue };
