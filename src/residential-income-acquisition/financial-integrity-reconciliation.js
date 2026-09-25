'use strict';

const {
  FINANCIAL_INTEGRITY_VERSION,
  normalizedNoiWaterfall,
  directCapitalizationValue,
} = require('../engines/financial/financial-integrity');

const NOI_RECONCILIATION_VERSION = 'NOI_RECONCILIATION_V1';
const DEFAULT_TOLERANCE_SAR = 0.01;

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function finiteNumber(value, field) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${field} must be a finite number`);
  }
  return value;
}

function nonNegative(value, field) {
  finiteNumber(value, field);
  if (value < 0) throw new RangeError(`${field} must be >= 0`);
  return value;
}

function extractStabilizedIncome(incomeAnalysis) {
  if (!incomeAnalysis || typeof incomeAnalysis !== 'object' || Array.isArray(incomeAnalysis)) {
    throw new TypeError('incomeAnalysis must be an object');
  }
  const source = incomeAnalysis.stabilizedIncome;
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    throw new TypeError('incomeAnalysis.stabilizedIncome must be an object');
  }

  return {
    potentialGrossIncomeSar: nonNegative(source.potentialGrossIncomeSar, 'potentialGrossIncomeSar'),
    vacancyLossSar: nonNegative(source.vacancyLossSar, 'vacancyLossSar'),
    creditLossSar: nonNegative(source.creditLossSar, 'creditLossSar'),
    annualConcessionsSar: nonNegative(source.annualConcessionsSar, 'annualConcessionsSar'),
    annualOtherOperatingIncomeSar: nonNegative(source.annualOtherOperatingIncomeSar, 'annualOtherOperatingIncomeSar'),
    effectiveGrossIncomeSar: finiteNumber(source.effectiveGrossIncomeSar, 'effectiveGrossIncomeSar'),
    normalizedAnnualOpexSar: nonNegative(source.normalizedAnnualOpexSar, 'normalizedAnnualOpexSar'),
    stabilizedNoiSar: finiteNumber(source.stabilizedNoiSar, 'stabilizedNoiSar'),
  };
}

function normalizeOpexAllocation(totalOpexSar, allocation, toleranceSar) {
  if (allocation === undefined || allocation === null) {
    return {
      recoverableOperatingExpensesSar: 0,
      nonRecoverableOperatingExpensesSar: 0,
      otherOperatingExpensesSar: totalOpexSar,
      warnings: ['OPEX_CLASSIFICATION_UNALLOCATED'],
      blockers: [],
    };
  }
  if (typeof allocation !== 'object' || Array.isArray(allocation)) {
    return {
      recoverableOperatingExpensesSar: 0,
      nonRecoverableOperatingExpensesSar: 0,
      otherOperatingExpensesSar: 0,
      warnings: [],
      blockers: ['OPEX_ALLOCATION_OBJECT_REQUIRED'],
    };
  }

  let recoverable;
  let nonRecoverable;
  let other;
  try {
    recoverable = nonNegative(allocation.recoverableOperatingExpensesSar ?? 0, 'recoverableOperatingExpensesSar');
    nonRecoverable = nonNegative(allocation.nonRecoverableOperatingExpensesSar ?? 0, 'nonRecoverableOperatingExpensesSar');
    other = nonNegative(allocation.otherOperatingExpensesSar ?? 0, 'otherOperatingExpensesSar');
  } catch (error) {
    return {
      recoverableOperatingExpensesSar: 0,
      nonRecoverableOperatingExpensesSar: 0,
      otherOperatingExpensesSar: 0,
      warnings: [],
      blockers: [`OPEX_ALLOCATION_INVALID:${error.message}`],
    };
  }

  const allocated = recoverable + nonRecoverable + other;
  const varianceSar = allocated - totalOpexSar;
  const blockers = Math.abs(varianceSar) > toleranceSar
    ? [`OPEX_ALLOCATION_DOES_NOT_RECONCILE:${varianceSar}`]
    : [];

  return {
    recoverableOperatingExpensesSar: recoverable,
    nonRecoverableOperatingExpensesSar: nonRecoverable,
    otherOperatingExpensesSar: other,
    warnings: [],
    blockers,
  };
}

function holdResult(reasonCodes, source = null, warnings = []) {
  return deepFreeze({
    version: NOI_RECONCILIATION_VERSION,
    financialIntegrityVersion: FINANCIAL_INTEGRITY_VERSION,
    status: 'HOLD',
    blockers: [...reasonCodes],
    warnings: [...warnings],
    source,
    canonicalNoi: null,
    reconciliation: null,
    semantics: 'NOI reconciliation is fail-closed. A HOLD result cannot be used to advance valuation or investment decision authority.',
  });
}

function reconcileIncomeAnalysisToCanonicalNoi(incomeAnalysis, options = {}) {
  const toleranceSar = options.toleranceSar === undefined
    ? DEFAULT_TOLERANCE_SAR
    : nonNegative(options.toleranceSar, 'toleranceSar');

  let source;
  try {
    source = extractStabilizedIncome(incomeAnalysis);
  } catch (error) {
    return holdResult([`SOURCE_STABILIZED_INCOME_INVALID:${error.message}`]);
  }

  const opex = normalizeOpexAllocation(source.normalizedAnnualOpexSar, options.opexAllocation, toleranceSar);
  if (opex.blockers.length) return holdResult(opex.blockers, source, opex.warnings);

  const serviceChargeRecoveriesSar = options.serviceChargeRecoveriesSar === undefined
    ? 0
    : nonNegative(options.serviceChargeRecoveriesSar, 'serviceChargeRecoveriesSar');

  let canonical;
  try {
    canonical = normalizedNoiWaterfall({
      potentialBaseRentSar: source.potentialGrossIncomeSar,
      otherPotentialIncomeSar: 0,
      vacancyLossSar: source.vacancyLossSar,
      collectionLossSar: source.creditLossSar,
      concessionsSar: source.annualConcessionsSar,
      otherOperatingIncomeSar: source.annualOtherOperatingIncomeSar,
      serviceChargeRecoveriesSar,
      recoverableOperatingExpensesSar: opex.recoverableOperatingExpensesSar,
      nonRecoverableOperatingExpensesSar: opex.nonRecoverableOperatingExpensesSar,
      otherOperatingExpensesSar: opex.otherOperatingExpensesSar,
    });
  } catch (error) {
    return holdResult([`CANONICAL_NOI_INPUT_INVALID:${error.message}`], source, opex.warnings);
  }

  const egiVarianceSar = canonical.egiSar - source.effectiveGrossIncomeSar;
  const noiVarianceSar = canonical.noiSar - source.stabilizedNoiSar;
  const blockers = [];
  if (Math.abs(egiVarianceSar) > toleranceSar) blockers.push(`EGI_RECONCILIATION_FAILED:${egiVarianceSar}`);
  if (Math.abs(noiVarianceSar) > toleranceSar) blockers.push(`NOI_RECONCILIATION_FAILED:${noiVarianceSar}`);
  if (blockers.length) return holdResult(blockers, source, [...opex.warnings, ...canonical.warnings]);

  const warnings = [...new Set([...opex.warnings, ...canonical.warnings])];
  const status = warnings.length ? 'PASS_WITH_WARNINGS' : 'PASS';

  return deepFreeze({
    version: NOI_RECONCILIATION_VERSION,
    financialIntegrityVersion: FINANCIAL_INTEGRITY_VERSION,
    status,
    blockers: [],
    warnings,
    source,
    canonicalNoi: canonical,
    reconciliation: {
      toleranceSar,
      egiVarianceSar,
      noiVarianceSar,
      sourceOpexSar: source.normalizedAnnualOpexSar,
      canonicalOpexSar: canonical.operatingExpensesSar,
      serviceChargeRecoveriesSar,
      valuationGrossIncomeSar: canonical.gpiSar + canonical.otherOperatingIncomeSar + canonical.serviceChargeRecoveriesSar,
      valuationEconomicLossSar: canonical.totalEconomicLossSar,
    },
    semantics: 'The result proves arithmetic reconciliation between the residential-income stabilized operating case and the canonical Financial Integrity NOI waterfall. It is not a professional valuation conclusion.',
  });
}

function directCapFromReconciledNoi(incomeAnalysis, marketCapRate, options = {}) {
  const reconciliation = reconcileIncomeAnalysisToCanonicalNoi(incomeAnalysis, options);
  if (reconciliation.status === 'HOLD') {
    return deepFreeze({
      status: 'NOT_EVALUATED',
      valueSar: null,
      marketCapRate: null,
      reconciliation,
      blockers: ['NOI_RECONCILIATION_REQUIRED', ...reconciliation.blockers],
      semantics: 'Direct capitalization is not evaluated until NOI reconciliation passes.',
    });
  }

  let valueSar;
  try {
    valueSar = directCapitalizationValue(reconciliation.canonicalNoi.noiSar, marketCapRate);
  } catch (error) {
    return deepFreeze({
      status: 'NOT_EVALUATED',
      valueSar: null,
      marketCapRate,
      reconciliation,
      blockers: [`DIRECT_CAP_INPUT_INVALID:${error.message}`],
      semantics: 'Direct capitalization input validation failed; no valuation indication is produced.',
    });
  }

  return deepFreeze({
    status: 'QUALIFIED_CALCULATION',
    valueSar,
    marketCapRate,
    stabilizedNoiSar: reconciliation.canonicalNoi.noiSar,
    reconciliation,
    blockers: [],
    semantics: 'This is a deterministic direct-capitalization calculation from reconciled stabilized NOI. It is not a certified or final professional valuation conclusion.',
  });
}

module.exports = {
  NOI_RECONCILIATION_VERSION,
  DEFAULT_TOLERANCE_SAR,
  reconcileIncomeAnalysisToCanonicalNoi,
  directCapFromReconciledNoi,
};
