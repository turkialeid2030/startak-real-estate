'use strict';

const crypto = require('crypto');
const {
  DCF_TIMING_CONVENTION,
  DISPOSITION_COST_METHOD,
  DCF_CASH_FLOW_DIRECTION,
  PROFESSIONAL_DCF_INPUT_STATUS,
  verifyProfessionalDcfInputIntegrity,
} = require('../../valuation/professional-dcf-input');

const PROFESSIONAL_DCF_MODEL_VERSION = 'PROFESSIONAL_DCF_1.0';
const PROFESSIONAL_DCF_RESULT_STATUS = Object.freeze({
  DCF_VALUE_INDICATION_READY: 'DCF_VALUE_INDICATION_READY',
  REVIEW_REQUIRED: 'REVIEW_REQUIRED',
  INVALID_INPUT_PACKET: 'INVALID_INPUT_PACKET',
  INVALID_ECONOMIC_CASE: 'INVALID_ECONOMIC_CASE',
});

function stableClone(value) {
  if (Array.isArray(value)) return value.map(stableClone);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((out, key) => { out[key] = stableClone(value[key]); return out; }, {});
}
function sha256(value) { return crypto.createHash('sha256').update(JSON.stringify(stableClone(value))).digest('hex'); }
function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
function fail(status, blockers, packet = null) {
  return deepFreeze({
    schemaVersion: 1,
    modelVersion: PROFESSIONAL_DCF_MODEL_VERSION,
    status,
    blockers,
    caseId: packet?.caseId || null,
    propertyRef: packet?.propertyRef || null,
    valuationDate: packet?.valuationDate || null,
    inputPacketHashSha256: packet?.professionalDcfInputHashSha256 || null,
    operatingPresentValueSar: null,
    grossTerminalValueSar: null,
    dispositionCostSar: null,
    netTerminalValueSar: null,
    terminalPresentValueSar: null,
    valueIndicationSar: null,
    financingIncluded: false,
    debtServiceIncluded: false,
    incomeTaxCalculated: false,
    zakatCalculated: false,
    equityReturnAnalysisPerformed: false,
    automaticRateDerivation: false,
    automaticTerminalNoiDerivation: false,
    reconciliationPerformed: false,
    finalValuationConclusionEstablished: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
  });
}

function calculateProfessionalDcfIndication(packet) {
  if (!packet || typeof packet !== 'object'
      || packet.status !== PROFESSIONAL_DCF_INPUT_STATUS.READY_FOR_CANONICAL_DCF
      || packet.readyForCanonicalDcf !== true
      || !verifyProfessionalDcfInputIntegrity(packet)) {
    return fail(PROFESSIONAL_DCF_RESULT_STATUS.INVALID_INPUT_PACKET, ['PROFESSIONAL_DCF_INPUT_NOT_READY_OR_INTEGRITY_FAILED'], packet);
  }
  const rate = packet.discountRate;
  const exitCap = packet.exitCapRate;
  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0 || rate > 1) return fail(PROFESSIONAL_DCF_RESULT_STATUS.INVALID_ECONOMIC_CASE, ['DISCOUNT_RATE_INVALID'], packet);
  if (typeof exitCap !== 'number' || !Number.isFinite(exitCap) || exitCap <= 0 || exitCap > 1) return fail(PROFESSIONAL_DCF_RESULT_STATUS.INVALID_ECONOMIC_CASE, ['EXIT_CAP_RATE_INVALID'], packet);
  if (!Array.isArray(packet.operatingNoiPeriods) || packet.operatingNoiPeriods.length === 0) return fail(PROFESSIONAL_DCF_RESULT_STATUS.INVALID_ECONOMIC_CASE, ['OPERATING_NOI_PERIODS_REQUIRED'], packet);
  if (!Array.isArray(packet.periodAdjustments)) return fail(PROFESSIONAL_DCF_RESULT_STATUS.INVALID_ECONOMIC_CASE, ['PERIOD_ADJUSTMENTS_EXPLICIT_ARRAY_REQUIRED'], packet);

  const adjustmentsByPeriod = new Map();
  for (const adjustment of packet.periodAdjustments) {
    if (!adjustment || !Number.isInteger(adjustment.periodIndex) || adjustment.periodIndex < 1
        || typeof adjustment.amountSar !== 'number' || !Number.isFinite(adjustment.amountSar) || adjustment.amountSar < 0
        || !Object.values(DCF_CASH_FLOW_DIRECTION).includes(adjustment.direction)) {
      return fail(PROFESSIONAL_DCF_RESULT_STATUS.INVALID_ECONOMIC_CASE, [`DCF_PERIOD_ADJUSTMENT_INVALID:${adjustment?.adjustmentId || 'UNKNOWN'}`], packet);
    }
    if (!adjustmentsByPeriod.has(adjustment.periodIndex)) adjustmentsByPeriod.set(adjustment.periodIndex, []);
    adjustmentsByPeriod.get(adjustment.periodIndex).push(adjustment);
  }

  let operatingPresentValueSar = 0;
  const operatingPresentValueTrace = [];
  const reviewFlags = [];
  const seenPeriodIndexes = new Set();
  for (const period of packet.operatingNoiPeriods) {
    if (!Number.isInteger(period.periodIndex) || period.periodIndex < 1 || seenPeriodIndexes.has(period.periodIndex)
        || typeof period.selectedNoiSar !== 'number' || !Number.isFinite(period.selectedNoiSar)) {
      return fail(PROFESSIONAL_DCF_RESULT_STATUS.INVALID_ECONOMIC_CASE, [`OPERATING_NOI_PERIOD_INVALID:${period.periodId || 'UNKNOWN'}`], packet);
    }
    seenPeriodIndexes.add(period.periodIndex);
    const adjustments = adjustmentsByPeriod.get(period.periodIndex) || [];
    let adjustmentInflowsSar = 0;
    let adjustmentOutflowsSar = 0;
    const adjustmentTrace = [];
    for (const adjustment of adjustments) {
      if (adjustment.direction === DCF_CASH_FLOW_DIRECTION.INFLOW) adjustmentInflowsSar += adjustment.amountSar;
      else adjustmentOutflowsSar += adjustment.amountSar;
      adjustmentTrace.push({
        adjustmentId: adjustment.adjustmentId,
        type: adjustment.type,
        direction: adjustment.direction,
        amountSar: adjustment.amountSar,
        source: adjustment.source,
        evidenceRefs: adjustment.evidenceRefs,
        dcfPeriodAdjustmentHashSha256: adjustment.dcfPeriodAdjustmentHashSha256,
      });
    }
    const unleveredPropertyCashFlowSar = period.selectedNoiSar + adjustmentInflowsSar - adjustmentOutflowsSar;
    const exponent = packet.timingConvention === DCF_TIMING_CONVENTION.MID_YEAR ? period.periodIndex - 0.5 : period.periodIndex;
    const discountFactor = 1 / ((1 + rate) ** exponent);
    const presentValueSar = unleveredPropertyCashFlowSar * discountFactor;
    if (![adjustmentInflowsSar, adjustmentOutflowsSar, unleveredPropertyCashFlowSar, discountFactor, presentValueSar].every(Number.isFinite)) {
      return fail(PROFESSIONAL_DCF_RESULT_STATUS.INVALID_ECONOMIC_CASE, [`OPERATING_PRESENT_VALUE_NON_FINITE:${period.periodId}`], packet);
    }
    if (unleveredPropertyCashFlowSar < 0) reviewFlags.push(`NEGATIVE_UNLEVERED_PROPERTY_CASH_FLOW_REVIEW_REQUIRED:${period.periodId}`);
    operatingPresentValueSar += presentValueSar;
    operatingPresentValueTrace.push({
      periodId: period.periodId,
      periodIndex: period.periodIndex,
      selectedNoiSar: period.selectedNoiSar,
      adjustmentInflowsSar,
      adjustmentOutflowsSar,
      unleveredPropertyCashFlowSar,
      adjustmentTrace,
      timingExponent: exponent,
      discountFactor,
      presentValueSar,
    });
  }

  const terminalNoiSar = packet.terminalNoiInput.amountSar;
  if (typeof terminalNoiSar !== 'number' || !Number.isFinite(terminalNoiSar) || terminalNoiSar <= 0) return fail(PROFESSIONAL_DCF_RESULT_STATUS.INVALID_ECONOMIC_CASE, ['TERMINAL_NOI_INVALID'], packet);
  const grossTerminalValueSar = terminalNoiSar / exitCap;
  let dispositionCostSar;
  if (packet.dispositionCostInput.method === DISPOSITION_COST_METHOD.AMOUNT_SAR) {
    dispositionCostSar = packet.dispositionCostInput.value;
  } else if (packet.dispositionCostInput.method === DISPOSITION_COST_METHOD.PERCENT_OF_GROSS_TERMINAL_VALUE) {
    dispositionCostSar = grossTerminalValueSar * packet.dispositionCostInput.value;
  } else {
    return fail(PROFESSIONAL_DCF_RESULT_STATUS.INVALID_ECONOMIC_CASE, ['DISPOSITION_COST_METHOD_INVALID'], packet);
  }
  if (![grossTerminalValueSar, dispositionCostSar].every(Number.isFinite) || dispositionCostSar < 0) return fail(PROFESSIONAL_DCF_RESULT_STATUS.INVALID_ECONOMIC_CASE, ['TERMINAL_VALUE_OR_DISPOSITION_COST_NON_FINITE'], packet);
  const netTerminalValueSar = grossTerminalValueSar - dispositionCostSar;
  const terminalPeriodIndex = Math.max(...packet.operatingNoiPeriods.map((period) => period.periodIndex));
  const terminalDiscountFactor = 1 / ((1 + rate) ** terminalPeriodIndex);
  const terminalPresentValueSar = netTerminalValueSar * terminalDiscountFactor;
  const valueIndicationSar = operatingPresentValueSar + terminalPresentValueSar;
  if (![operatingPresentValueSar, netTerminalValueSar, terminalDiscountFactor, terminalPresentValueSar, valueIndicationSar].every(Number.isFinite)) {
    return fail(PROFESSIONAL_DCF_RESULT_STATUS.INVALID_ECONOMIC_CASE, ['DCF_VALUE_NON_FINITE'], packet);
  }

  if (netTerminalValueSar <= 0) reviewFlags.push('NON_POSITIVE_NET_TERMINAL_VALUE_REVIEW_REQUIRED');
  if (valueIndicationSar <= 0) reviewFlags.push('NON_POSITIVE_DCF_VALUE_INDICATION_REVIEW_REQUIRED');
  if (dispositionCostSar > grossTerminalValueSar) reviewFlags.push('DISPOSITION_COST_EXCEEDS_GROSS_TERMINAL_VALUE_REVIEW_REQUIRED');

  const core = {
    schemaVersion: 1,
    modelVersion: PROFESSIONAL_DCF_MODEL_VERSION,
    caseId: packet.caseId,
    propertyRef: packet.propertyRef,
    valuationDate: packet.valuationDate,
    inputPacketHashSha256: packet.professionalDcfInputHashSha256,
    timingConvention: packet.timingConvention,
    terminalTimingConvention: packet.terminalTimingConvention,
    professionalNoiCalculationHashSha256: packet.professionalNoiCalculationHashSha256,
    noiConvention: packet.noiConvention,
    discountRate: rate,
    discountRateProvenance: packet.discountRateProvenance,
    exitCapRate: exitCap,
    exitCapRateProvenance: packet.exitCapRateProvenance,
    operatingPresentValueTrace,
    operatingPresentValueSar,
    terminalNoiInput: packet.terminalNoiInput,
    grossTerminalValueSar,
    dispositionCostInput: packet.dispositionCostInput,
    dispositionCostSar,
    netTerminalValueSar,
    terminalPeriodIndex,
    terminalDiscountFactor,
    terminalPresentValueSar,
    valueIndicationSar,
  };
  return deepFreeze({
    ...core,
    calculationHashSha256: sha256(core),
    status: reviewFlags.length ? PROFESSIONAL_DCF_RESULT_STATUS.REVIEW_REQUIRED : PROFESSIONAL_DCF_RESULT_STATUS.DCF_VALUE_INDICATION_READY,
    blockers: [],
    reviewFlags,
    indicationType: 'PROFESSIONAL_DCF_VALUE_INDICATION',
    canonicalCalculationEngine: true,
    unleveredPropertyCashFlowBasis: true,
    financingIncluded: false,
    debtServiceIncluded: false,
    incomeTaxCalculated: false,
    zakatCalculated: false,
    equityReturnAnalysisPerformed: false,
    automaticRateDerivation: false,
    automaticTerminalNoiDerivation: false,
    reconciliationPerformed: false,
    finalValuationConclusionEstablished: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
    semantics: 'The canonical professional DCF engine discounts explicit unlevered property cash flows comprising professional NOI plus separately reviewed non-NOI property cash-flow adjustments, and discounts an explicit net terminal value using explicit professionally reviewed discount and exit-cap inputs. Operating cash-flow timing follows the selected convention; terminal value is discounted at the end of the final period. No leverage/debt service/income-tax/Zakat/equity-return analysis, rate derivation, terminal-NOI derivation, method reconciliation, final valuation, certification or transaction authorization is performed.',
  });
}

module.exports = {
  PROFESSIONAL_DCF_MODEL_VERSION,
  PROFESSIONAL_DCF_RESULT_STATUS,
  calculateProfessionalDcfIndication,
};
