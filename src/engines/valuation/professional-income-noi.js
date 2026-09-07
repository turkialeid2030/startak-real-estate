'use strict';

const crypto = require('crypto');
const {
  NOI_CALCULATION_METHOD,
  NOI_EXPENSE_CATEGORY,
  NOI_CONVENTION,
  PROFESSIONAL_INCOME_FORECAST_STATUS,
  verifyProfessionalIncomeForecastInputIntegrity,
} = require('../../income/professional-income-forecast');

const PROFESSIONAL_NOI_MODEL_VERSION = 'PROFESSIONAL_NOI_1.0';

const PROFESSIONAL_NOI_RESULT_STATUS = Object.freeze({
  PROFESSIONAL_NOI_READY: 'PROFESSIONAL_NOI_READY',
  INVALID_INPUT_PACKET: 'INVALID_INPUT_PACKET',
  INVALID_ECONOMIC_CASE: 'INVALID_ECONOMIC_CASE',
});

function stableClone(value) {
  if (Array.isArray(value)) return value.map(stableClone);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((out, key) => {
    out[key] = stableClone(value[key]);
    return out;
  }, {});
}
function sha256(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stableClone(value))).digest('hex');
}
function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
function fail(status, blockers, packet = null) {
  return deepFreeze({
    schemaVersion: 1,
    modelVersion: PROFESSIONAL_NOI_MODEL_VERSION,
    status,
    blockers,
    caseId: packet?.caseId || null,
    propertyRef: packet?.propertyRef || null,
    valuationDate: packet?.valuationDate || null,
    inputPacketHashSha256: packet?.professionalIncomeForecastInputHashSha256 || null,
    periodResults: [],
    firstForecastPeriodNoiSar: null,
    stabilizedNoiSar: null,
    capitalizationPerformed: false,
    dcfPerformed: false,
    financingIncluded: false,
    debtServiceIncluded: false,
    depreciationIncluded: false,
    capitalExpenditureIncluded: false,
    incomeTaxCalculated: false,
    finalValuationConclusionEstablished: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
  });
}
function finiteNonNegative(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function calculateProfessionalNoi(packet) {
  if (!packet || typeof packet !== 'object'
      || packet.status !== PROFESSIONAL_INCOME_FORECAST_STATUS.READY_FOR_CANONICAL_NOI
      || packet.readyForCanonicalNoi !== true
      || !verifyProfessionalIncomeForecastInputIntegrity(packet)) {
    return fail(PROFESSIONAL_NOI_RESULT_STATUS.INVALID_INPUT_PACKET, ['PROFESSIONAL_INCOME_FORECAST_INPUT_NOT_READY_OR_INTEGRITY_FAILED'], packet);
  }

  const periodResults = [];
  const resultBlockers = [];
  for (const period of packet.forecastPeriods) {
    let potentialGrossIncomeSar = 0;
    const incomeTrace = [];
    for (const line of period.incomeLines) {
      if (!finiteNonNegative(line.amountSar)) {
        resultBlockers.push(`INCOME_LINE_AMOUNT_INVALID:${line.lineId}`);
        continue;
      }
      potentialGrossIncomeSar += line.amountSar;
      incomeTrace.push({
        lineId: line.lineId,
        type: line.type,
        amountSar: line.amountSar,
        source: line.source,
        evidenceRefs: line.evidenceRefs,
        incomeForecastLineHashSha256: line.incomeForecastLineHashSha256,
      });
    }
    if (!Number.isFinite(potentialGrossIncomeSar) || potentialGrossIncomeSar < 0) {
      resultBlockers.push(`POTENTIAL_GROSS_INCOME_INVALID:${period.periodId}`);
      continue;
    }

    const loss = period.vacancyCollectionLoss;
    let vacancyCollectionLossSar;
    if (loss.method === NOI_CALCULATION_METHOD.AMOUNT_SAR) {
      vacancyCollectionLossSar = loss.value;
    } else if (loss.method === NOI_CALCULATION_METHOD.PERCENT_OF_PGI) {
      vacancyCollectionLossSar = potentialGrossIncomeSar * loss.value;
    } else {
      resultBlockers.push(`VACANCY_COLLECTION_METHOD_INVALID:${period.periodId}`);
      continue;
    }
    if (!finiteNonNegative(vacancyCollectionLossSar) || vacancyCollectionLossSar > potentialGrossIncomeSar) {
      resultBlockers.push(`VACANCY_COLLECTION_LOSS_INVALID:${period.periodId}`);
      continue;
    }

    const effectiveGrossIncomeSar = potentialGrossIncomeSar - vacancyCollectionLossSar;
    let operatingExpensesBeforeReserveSar = 0;
    let replacementReserveSar = 0;
    const operatingExpenseTrace = [];
    for (const expense of period.operatingExpenseLines) {
      let amountSar;
      if (expense.method === NOI_CALCULATION_METHOD.AMOUNT_SAR) {
        amountSar = expense.value;
      } else if (expense.method === NOI_CALCULATION_METHOD.PERCENT_OF_EGI) {
        amountSar = effectiveGrossIncomeSar * expense.value;
      } else {
        resultBlockers.push(`OPERATING_EXPENSE_METHOD_INVALID:${expense.expenseId}`);
        continue;
      }
      if (!finiteNonNegative(amountSar)) {
        resultBlockers.push(`OPERATING_EXPENSE_AMOUNT_INVALID:${expense.expenseId}`);
        continue;
      }
      if (expense.category === NOI_EXPENSE_CATEGORY.REPLACEMENT_RESERVE) replacementReserveSar += amountSar;
      else operatingExpensesBeforeReserveSar += amountSar;
      operatingExpenseTrace.push({
        expenseId: expense.expenseId,
        category: expense.category,
        method: expense.method,
        inputValue: expense.value,
        calculatedAmountSar: amountSar,
        source: expense.source,
        evidenceRefs: expense.evidenceRefs,
        operatingExpenseLineHashSha256: expense.operatingExpenseLineHashSha256,
      });
    }

    const noiBeforeReplacementReserveSar = effectiveGrossIncomeSar - operatingExpensesBeforeReserveSar;
    const noiAfterReplacementReserveSar = noiBeforeReplacementReserveSar - replacementReserveSar;
    const selectedNoiSar = packet.noiConvention === NOI_CONVENTION.BEFORE_REPLACEMENT_RESERVE
      ? noiBeforeReplacementReserveSar
      : noiAfterReplacementReserveSar;
    if (![effectiveGrossIncomeSar, operatingExpensesBeforeReserveSar, replacementReserveSar, noiBeforeReplacementReserveSar, noiAfterReplacementReserveSar, selectedNoiSar].every(Number.isFinite)) {
      resultBlockers.push(`NON_FINITE_NOI_RESULT:${period.periodId}`);
      continue;
    }

    const reviewFlags = [];
    if (potentialGrossIncomeSar === 0) reviewFlags.push('ZERO_POTENTIAL_GROSS_INCOME_REVIEW_REQUIRED');
    if (selectedNoiSar <= 0) reviewFlags.push('NON_POSITIVE_NOI_REVIEW_REQUIRED');
    if (operatingExpensesBeforeReserveSar > effectiveGrossIncomeSar) reviewFlags.push('OPERATING_EXPENSES_EXCEED_EGI_REVIEW_REQUIRED');

    periodResults.push({
      periodId: period.periodId,
      periodIndex: period.periodIndex,
      label: period.label,
      startDate: period.startDate,
      endDate: period.endDate,
      isStabilized: period.isStabilized,
      potentialGrossIncomeSar,
      vacancyCollectionLossSar,
      effectiveGrossIncomeSar,
      operatingExpensesBeforeReserveSar,
      replacementReserveSar,
      noiBeforeReplacementReserveSar,
      noiAfterReplacementReserveSar,
      selectedNoiConvention: packet.noiConvention,
      selectedNoiSar,
      incomeTrace,
      vacancyCollectionLossTrace: {
        assumptionId: loss.assumptionId,
        method: loss.method,
        inputValue: loss.value,
        calculatedAmountSar: vacancyCollectionLossSar,
        source: loss.source,
        evidenceRefs: loss.evidenceRefs,
        vacancyCollectionLossHashSha256: loss.vacancyCollectionLossHashSha256,
      },
      operatingExpenseTrace,
      reviewFlags,
      annualizedAmounts: true,
      automaticLeaseOptionExercise: false,
      automaticMarketRentApplied: false,
    });
  }

  if (resultBlockers.length) return fail(PROFESSIONAL_NOI_RESULT_STATUS.INVALID_ECONOMIC_CASE, resultBlockers, packet);
  if (periodResults.length !== packet.forecastPeriods.length) {
    return fail(PROFESSIONAL_NOI_RESULT_STATUS.INVALID_ECONOMIC_CASE, ['PERIOD_RESULT_COUNT_MISMATCH'], packet);
  }

  const stabilized = periodResults.find((period) => period.periodIndex === packet.stabilizedPeriodIndex && period.isStabilized === true);
  if (!stabilized) return fail(PROFESSIONAL_NOI_RESULT_STATUS.INVALID_ECONOMIC_CASE, ['STABILIZED_PERIOD_RESULT_NOT_FOUND'], packet);

  const core = {
    schemaVersion: 1,
    modelVersion: PROFESSIONAL_NOI_MODEL_VERSION,
    caseId: packet.caseId,
    propertyRef: packet.propertyRef,
    valuationDate: packet.valuationDate,
    inputPacketHashSha256: packet.professionalIncomeForecastInputHashSha256,
    incomeEvidencePacketHashSha256: packet.incomeEvidencePacketHashSha256,
    noiConvention: packet.noiConvention,
    baselineAnnualContractRentSar: packet.baselineAnnualContractRentSar,
    baselineOccupiedAreaSqm: packet.baselineOccupiedAreaSqm,
    baselineActiveLeaseCount: packet.baselineActiveLeaseCount,
    periodResults,
    firstForecastPeriodNoiSar: periodResults[0].selectedNoiSar,
    stabilizedPeriodIndex: packet.stabilizedPeriodIndex,
    stabilizedNoiSar: stabilized.selectedNoiSar,
  };

  return deepFreeze({
    ...core,
    calculationHashSha256: sha256(core),
    status: PROFESSIONAL_NOI_RESULT_STATUS.PROFESSIONAL_NOI_READY,
    blockers: [],
    professionalIncomeForecastCalculated: true,
    canonicalCalculationEngine: true,
    capitalizationPerformed: false,
    dcfPerformed: false,
    financingIncluded: false,
    debtServiceIncluded: false,
    depreciationIncluded: false,
    capitalExpenditureIncluded: false,
    incomeTaxCalculated: false,
    finalValuationConclusionEstablished: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
    semantics: 'The canonical professional NOI engine performs deterministic arithmetic over explicit professionally reviewed income, vacancy/collection loss, operating expense and replacement-reserve inputs. It does not exercise lease options, infer market rent, capitalize NOI, perform DCF, include financing, calculate tax, establish a final valuation, certify an appraisal, or authorize a transaction.',
  });
}

module.exports = {
  PROFESSIONAL_NOI_MODEL_VERSION,
  PROFESSIONAL_NOI_RESULT_STATUS,
  calculateProfessionalNoi,
};
