'use strict';

const crypto = require('crypto');
const {
  PROFESSIONAL_DCF_MODEL_VERSION,
  PROFESSIONAL_DCF_RESULT_STATUS,
} = require('../engines/valuation/professional-dcf');

function stableClone(value) {
  if (Array.isArray(value)) return value.map(stableClone);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((out, key) => { out[key] = stableClone(value[key]); return out; }, {});
}
function sha256(value) { return crypto.createHash('sha256').update(JSON.stringify(stableClone(value))).digest('hex'); }
function validSha(value) { return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value); }

function professionalDcfResultCore(result) {
  return {
    schemaVersion: result.schemaVersion,
    modelVersion: result.modelVersion,
    caseId: result.caseId,
    propertyRef: result.propertyRef,
    valuationDate: result.valuationDate,
    inputPacketHashSha256: result.inputPacketHashSha256,
    timingConvention: result.timingConvention,
    terminalTimingConvention: result.terminalTimingConvention,
    professionalNoiCalculationHashSha256: result.professionalNoiCalculationHashSha256,
    noiConvention: result.noiConvention,
    discountRate: result.discountRate,
    discountRateProvenance: result.discountRateProvenance,
    exitCapRate: result.exitCapRate,
    exitCapRateProvenance: result.exitCapRateProvenance,
    operatingPresentValueTrace: result.operatingPresentValueTrace,
    operatingPresentValueSar: result.operatingPresentValueSar,
    terminalNoiInput: result.terminalNoiInput,
    grossTerminalValueSar: result.grossTerminalValueSar,
    dispositionCostInput: result.dispositionCostInput,
    dispositionCostSar: result.dispositionCostSar,
    netTerminalValueSar: result.netTerminalValueSar,
    terminalPeriodIndex: result.terminalPeriodIndex,
    terminalDiscountFactor: result.terminalDiscountFactor,
    terminalPresentValueSar: result.terminalPresentValueSar,
    valueIndicationSar: result.valueIndicationSar,
  };
}

function verifyProfessionalDcfResultIntegrity(result) {
  if (!result || typeof result !== 'object') return false;
  if (![PROFESSIONAL_DCF_RESULT_STATUS.DCF_VALUE_INDICATION_READY, PROFESSIONAL_DCF_RESULT_STATUS.REVIEW_REQUIRED].includes(result.status)) return false;
  if (result.modelVersion !== PROFESSIONAL_DCF_MODEL_VERSION || result.canonicalCalculationEngine !== true) return false;
  if (!validSha(result.calculationHashSha256) || !validSha(result.inputPacketHashSha256) || !validSha(result.professionalNoiCalculationHashSha256)) return false;
  if (!Array.isArray(result.operatingPresentValueTrace) || result.operatingPresentValueTrace.length === 0) return false;
  if (![result.operatingPresentValueSar, result.netTerminalValueSar, result.valueIndicationSar].every(Number.isFinite)) return false;
  return sha256(professionalDcfResultCore(result)) === result.calculationHashSha256.toLowerCase();
}

module.exports = {
  professionalDcfResultCore,
  verifyProfessionalDcfResultIntegrity,
};
