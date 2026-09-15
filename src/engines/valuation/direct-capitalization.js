'use strict';

const crypto = require('crypto');
const {
  DIRECT_CAP_INPUT_STATUS,
  verifyDirectCapitalizationInputIntegrity,
} = require('../../valuation/direct-capitalization-input');

const DIRECT_CAPITALIZATION_MODEL_VERSION = 'DIRECT_CAPITALIZATION_1.0';
const DIRECT_CAPITALIZATION_RESULT_STATUS = Object.freeze({
  DIRECT_CAPITALIZATION_VALUE_INDICATION_READY: 'DIRECT_CAPITALIZATION_VALUE_INDICATION_READY',
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
    modelVersion: DIRECT_CAPITALIZATION_MODEL_VERSION,
    status,
    blockers,
    caseId: packet?.caseId || null,
    propertyRef: packet?.propertyRef || null,
    valuationDate: packet?.valuationDate || null,
    inputPacketHashSha256: packet?.directCapitalizationInputHashSha256 || null,
    selectedNoiSar: null,
    marketCapRate: null,
    valueIndicationSar: null,
    automaticMethodSelection: false,
    automaticRateDerivation: false,
    reconciliationPerformed: false,
    finalValuationConclusionEstablished: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
  });
}

function calculateDirectCapitalizationIndication(packet) {
  if (!packet || typeof packet !== 'object'
      || packet.status !== DIRECT_CAP_INPUT_STATUS.READY_FOR_CANONICAL_DIRECT_CAPITALIZATION
      || packet.readyForCanonicalDirectCapitalization !== true
      || !verifyDirectCapitalizationInputIntegrity(packet)) {
    return fail(DIRECT_CAPITALIZATION_RESULT_STATUS.INVALID_INPUT_PACKET, ['DIRECT_CAPITALIZATION_INPUT_NOT_READY_OR_INTEGRITY_FAILED'], packet);
  }
  const noi = packet.selectedNoiSar;
  const rate = packet.marketCapRate;
  if (typeof noi !== 'number' || !Number.isFinite(noi) || noi <= 0) {
    return fail(DIRECT_CAPITALIZATION_RESULT_STATUS.INVALID_ECONOMIC_CASE, ['POSITIVE_NOI_REQUIRED'], packet);
  }
  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0 || rate > 1) {
    return fail(DIRECT_CAPITALIZATION_RESULT_STATUS.INVALID_ECONOMIC_CASE, ['MARKET_CAP_RATE_INVALID'], packet);
  }
  const valueIndicationSar = noi / rate;
  if (!Number.isFinite(valueIndicationSar) || valueIndicationSar <= 0) {
    return fail(DIRECT_CAPITALIZATION_RESULT_STATUS.INVALID_ECONOMIC_CASE, ['DIRECT_CAPITALIZATION_VALUE_NON_FINITE_OR_NON_POSITIVE'], packet);
  }
  const core = {
    schemaVersion: 1,
    modelVersion: DIRECT_CAPITALIZATION_MODEL_VERSION,
    caseId: packet.caseId,
    propertyRef: packet.propertyRef,
    valuationDate: packet.valuationDate,
    inputPacketHashSha256: packet.directCapitalizationInputHashSha256,
    selectedNoiBasis: packet.selectedNoiBasis,
    selectedNoiSar: noi,
    noiConvention: packet.noiConvention,
    stabilizedPeriodIndex: packet.stabilizedPeriodIndex,
    professionalNoiCalculationHashSha256: packet.professionalNoiCalculationHashSha256,
    marketCapRate: rate,
    marketCapRateProvenance: packet.marketCapRateProvenance,
    valueIndicationSar,
  };
  return deepFreeze({
    ...core,
    calculationHashSha256: sha256(core),
    status: DIRECT_CAPITALIZATION_RESULT_STATUS.DIRECT_CAPITALIZATION_VALUE_INDICATION_READY,
    blockers: [],
    indicationType: 'DIRECT_CAPITALIZATION_VALUE_INDICATION',
    canonicalCalculationEngine: true,
    automaticMethodSelection: false,
    automaticRateDerivation: false,
    reconciliationPerformed: false,
    finalValuationConclusionEstablished: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
    semantics: 'The canonical Direct Capitalization engine divides one integrity-verified positive stabilized professional NOI by one explicit professionally reviewed market capitalization rate. The result is a method indication only; it does not select the method, derive the rate, reconcile methods, establish a final valuation, certify an appraisal or authorize a transaction.',
  });
}

module.exports = {
  DIRECT_CAPITALIZATION_MODEL_VERSION,
  DIRECT_CAPITALIZATION_RESULT_STATUS,
  calculateDirectCapitalizationIndication,
};
