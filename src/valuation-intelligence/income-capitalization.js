'use strict';

const {
  BASIS_OF_VALUE,
  VALUATION_METHOD,
  EVIDENCE_GRADE,
  INPUT_STATUS,
  createEvidenceRecord,
  createValuationIndication,
} = require('./contracts');

const EXPENSE_TREATMENT = Object.freeze({
  ACTUAL_LANDLORD_OPEX: 'ACTUAL_LANDLORD_OPEX',
  MARKET_ESTIMATE: 'MARKET_ESTIMATE',
  TENANT_BORNE_CONFIRMED: 'TENANT_BORNE_CONFIRMED',
  TENANT_BORNE_ASSUMED: 'TENANT_BORNE_ASSUMED',
});

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
  const status = descriptor.status || INPUT_STATUS.OBSERVED;
  return createEvidenceRecord({
    field,
    grade: descriptor.grade,
    status,
    sourceType: descriptor.sourceType || 'UNSPECIFIED',
    sourceRef: descriptor.sourceRef || null,
    observedAt: descriptor.observedAt || null,
    note: descriptor.note || null,
  });
}

function calculateDirectCapitalization({
  effectiveGrossIncome,
  operatingExpenses,
  capitalizationRate,
  expenseTreatment,
  incomeEvidence,
  expenseEvidence,
  capRateEvidence,
  basis = BASIS_OF_VALUE.MARKET_VALUE,
  valuationDate = null,
  currency = 'SAR',
}) {
  positive(effectiveGrossIncome, 'effectiveGrossIncome');
  nonNegative(operatingExpenses, 'operatingExpenses');
  if (operatingExpenses >= effectiveGrossIncome) throw new RangeError('operatingExpenses must be less than effectiveGrossIncome');
  if (typeof capitalizationRate !== 'number' || !Number.isFinite(capitalizationRate) || capitalizationRate <= 0 || capitalizationRate >= 1) {
    throw new TypeError('capitalizationRate must be in (0,1)');
  }
  if (!Object.values(EXPENSE_TREATMENT).includes(expenseTreatment)) throw new TypeError(`invalid expenseTreatment: ${expenseTreatment}`);
  if (![BASIS_OF_VALUE.MARKET_VALUE, BASIS_OF_VALUE.FAIR_VALUE, BASIS_OF_VALUE.INVESTMENT_VALUE].includes(basis)) {
    throw new TypeError('direct capitalization supports MARKET_VALUE, FAIR_VALUE, or INVESTMENT_VALUE');
  }
  if (operatingExpenses === 0 && ![
    EXPENSE_TREATMENT.TENANT_BORNE_CONFIRMED,
    EXPENSE_TREATMENT.TENANT_BORNE_ASSUMED,
  ].includes(expenseTreatment)) {
    throw new RangeError('zero operatingExpenses requires an explicit tenant-borne expense treatment');
  }

  const netOperatingIncome = effectiveGrossIncome - operatingExpenses;
  const value = netOperatingIncome / capitalizationRate;
  const assumptions = [];
  const warnings = [];

  if (expenseTreatment === EXPENSE_TREATMENT.MARKET_ESTIMATE) assumptions.push('OPERATING_EXPENSES_MARKET_ESTIMATE');
  if (expenseTreatment === EXPENSE_TREATMENT.TENANT_BORNE_ASSUMED) assumptions.push('TENANT_BORNE_OPEX_NOT_CONTRACTUALLY_VERIFIED');
  if (incomeEvidence?.status === INPUT_STATUS.ASSUMED || incomeEvidence?.status === INPUT_STATUS.UNVERIFIED) warnings.push('INCOME_NOT_VERIFIED_ACTUAL');
  if (capRateEvidence?.status === INPUT_STATUS.ASSUMED || capRateEvidence?.status === INPUT_STATUS.UNVERIFIED) warnings.push('CAP_RATE_NOT_VERIFIED_MARKET_EVIDENCE');

  return createValuationIndication({
    method: VALUATION_METHOD.INCOME_DIRECT_CAPITALIZATION,
    basis,
    value,
    currency,
    valuationDate,
    evidence: [
      evidence('effectiveGrossIncome', incomeEvidence),
      evidence('operatingExpenses', expenseEvidence),
      evidence('capitalizationRate', capRateEvidence),
    ],
    assumptions,
    warnings,
    components: {
      effectiveGrossIncome,
      operatingExpenses,
      netOperatingIncome,
      capitalizationRate,
      expenseTreatment,
    },
  });
}

module.exports = {
  EXPENSE_TREATMENT,
  calculateDirectCapitalization,
};
