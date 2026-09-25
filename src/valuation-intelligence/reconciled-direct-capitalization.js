'use strict';

const {
  INDICATION_STATUS,
} = require('./contracts');
const {
  EXPENSE_TREATMENT,
  calculateDirectCapitalization,
} = require('./income-capitalization');
const {
  directCapitalizationValue,
} = require('../engines/financial/financial-integrity');
const {
  reconcileIncomeAnalysisToCanonicalNoi,
} = require('../residential-income-acquisition/financial-integrity-reconciliation');
const {
  CAP_RATE_GOVERNANCE_STATUS,
  evaluateEntryExitCapRateGovernance,
} = require('./cap-rate-governance');

const RECONCILED_DIRECT_CAP_VERSION = 'RECONCILED_DIRECT_CAP_V1';
const RECONCILED_DIRECT_CAP_STATUS = Object.freeze({
  QUALIFIED: 'QUALIFIED',
  REVIEW_REQUIRED: 'REVIEW_REQUIRED',
  HOLD_INPUTS: 'HOLD_INPUTS',
  HOLD_EVIDENCE_CONFLICT: 'HOLD_EVIDENCE_CONFLICT',
});

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function hold(status, blockers, reconciliation = null, capRateGovernance = null, warnings = []) {
  return deepFreeze({
    version: RECONCILED_DIRECT_CAP_VERSION,
    status,
    valuationIndication: null,
    reconciliation,
    capRateGovernance,
    crossCheck: null,
    blockers: [...blockers],
    warnings: [...warnings],
    semantics: 'No evidence-backed direct-capitalization indication is produced while deterministic NOI reconciliation or evidence governance is on hold.',
  });
}

function calculateReconciledEvidenceBackedDirectCapitalization({
  incomeAnalysis,
  marketCapRate,
  incomeEvidence,
  expenseEvidence,
  capRateEvidence,
  expenseTreatment = EXPENSE_TREATMENT.ACTUAL_LANDLORD_OPEX,
  opexAllocation = null,
  serviceChargeRecoveriesSar = 0,
  basis,
  valuationDate = null,
  currency = 'SAR',
  toleranceSar,
} = {}) {
  const reconciliationOptions = { opexAllocation, serviceChargeRecoveriesSar };
  if (toleranceSar !== undefined) reconciliationOptions.toleranceSar = toleranceSar;
  const reconciliation = reconcileIncomeAnalysisToCanonicalNoi(incomeAnalysis, reconciliationOptions);
  if (reconciliation.status === 'HOLD') {
    return hold(
      RECONCILED_DIRECT_CAP_STATUS.HOLD_INPUTS,
      ['NOI_RECONCILIATION_REQUIRED', ...reconciliation.blockers],
      reconciliation,
      null,
      reconciliation.warnings,
    );
  }

  const capRateGovernance = evaluateEntryExitCapRateGovernance({
    entryCapRate: marketCapRate,
    entryEvidence: capRateEvidence,
  });
  if (capRateGovernance.status === CAP_RATE_GOVERNANCE_STATUS.HOLD) {
    return hold(
      RECONCILED_DIRECT_CAP_STATUS.HOLD_INPUTS,
      ['CAP_RATE_GOVERNANCE_REQUIRED', ...capRateGovernance.blockers],
      reconciliation,
      capRateGovernance,
      [...reconciliation.warnings, ...capRateGovernance.warnings],
    );
  }

  let valuationIndication;
  try {
    valuationIndication = calculateDirectCapitalization({
      effectiveGrossIncome: reconciliation.canonicalNoi.egiSar,
      operatingExpenses: reconciliation.canonicalNoi.operatingExpensesSar,
      capitalizationRate: marketCapRate,
      expenseTreatment,
      incomeEvidence,
      expenseEvidence,
      capRateEvidence,
      basis,
      valuationDate,
      currency,
    });
  } catch (error) {
    return hold(
      RECONCILED_DIRECT_CAP_STATUS.HOLD_INPUTS,
      [`EVIDENCE_BACKED_DIRECT_CAP_INPUT_INVALID:${error.message}`],
      reconciliation,
      capRateGovernance,
      [...reconciliation.warnings, ...capRateGovernance.warnings],
    );
  }

  const canonicalValueSar = directCapitalizationValue(reconciliation.canonicalNoi.noiSar, marketCapRate);
  const valuationValueSar = valuationIndication.value;
  const varianceSar = valuationValueSar - canonicalValueSar;
  const effectiveToleranceSar = toleranceSar === undefined ? 0.01 : toleranceSar;
  if (Math.abs(varianceSar) > effectiveToleranceSar) {
    return hold(
      RECONCILED_DIRECT_CAP_STATUS.HOLD_INPUTS,
      [`DIRECT_CAP_CROSS_CHECK_FAILED:${varianceSar}`],
      reconciliation,
      capRateGovernance,
      [...reconciliation.warnings, ...capRateGovernance.warnings],
    );
  }

  const warnings = [
    ...new Set([
      ...reconciliation.warnings,
      ...capRateGovernance.warnings,
      ...valuationIndication.warnings,
    ]),
  ];

  let status = RECONCILED_DIRECT_CAP_STATUS.QUALIFIED;
  if (valuationIndication.status === INDICATION_STATUS.HOLD_EVIDENCE_CONFLICT) {
    status = RECONCILED_DIRECT_CAP_STATUS.HOLD_EVIDENCE_CONFLICT;
  } else if (capRateGovernance.status === CAP_RATE_GOVERNANCE_STATUS.REVIEW_REQUIRED || warnings.length) {
    status = RECONCILED_DIRECT_CAP_STATUS.REVIEW_REQUIRED;
  }

  return deepFreeze({
    version: RECONCILED_DIRECT_CAP_VERSION,
    status,
    valuationIndication,
    reconciliation,
    capRateGovernance,
    crossCheck: {
      canonicalValueSar,
      valuationValueSar,
      varianceSar,
      toleranceSar: effectiveToleranceSar,
      passed: Math.abs(varianceSar) <= effectiveToleranceSar,
    },
    blockers: status === RECONCILED_DIRECT_CAP_STATUS.HOLD_EVIDENCE_CONFLICT
      ? ['VALUATION_EVIDENCE_CONFLICT']
      : [],
    warnings,
    semantics: 'This output is an evidence-backed valuation indication built on reconciled stabilized NOI. It is not a certified valuation, transaction authorization, lender decision, or investment approval.',
  });
}

module.exports = {
  RECONCILED_DIRECT_CAP_VERSION,
  RECONCILED_DIRECT_CAP_STATUS,
  calculateReconciledEvidenceBackedDirectCapitalization,
};
