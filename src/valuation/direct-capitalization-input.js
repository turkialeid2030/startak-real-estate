'use strict';

const crypto = require('crypto');
const {
  RATE_INPUT_TYPE,
  verifyProfessionalRateInputIntegrity,
} = require('./professional-method-input-provenance');
const {
  PROFESSIONAL_NOI_RESULT_STATUS,
  PROFESSIONAL_NOI_MODEL_VERSION,
} = require('../engines/valuation/professional-income-noi');

const DIRECT_CAP_NOI_BASIS = Object.freeze({
  STABILIZED_NOI: 'STABILIZED_NOI',
});

const DIRECT_CAP_INPUT_STATUS = Object.freeze({
  READY_FOR_CANONICAL_DIRECT_CAPITALIZATION: 'READY_FOR_CANONICAL_DIRECT_CAPITALIZATION',
  HOLD_NOI: 'HOLD_NOI',
  HOLD_RATE_PROVENANCE: 'HOLD_RATE_PROVENANCE',
  HOLD_INTEGRITY: 'HOLD_INTEGRITY',
});

function nonEmpty(value) { return typeof value === 'string' && value.trim().length > 0; }
function assertNonEmpty(value, field) { if (!nonEmpty(value)) throw new TypeError(`${field} must be a non-empty string`); }
function iso(value, field) {
  assertNonEmpty(value, field);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError(`${field} must be a valid date/time`);
  return date.toISOString();
}
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
function validSha(value) { return nonEmpty(value) && /^[a-f0-9]{64}$/i.test(value); }
function daysBetween(earlier, later) { return Math.floor((Date.parse(later) - Date.parse(earlier)) / 86400000); }

function professionalNoiResultCore(result) {
  return {
    schemaVersion: result.schemaVersion,
    modelVersion: result.modelVersion,
    caseId: result.caseId,
    propertyRef: result.propertyRef,
    valuationDate: result.valuationDate,
    inputPacketHashSha256: result.inputPacketHashSha256,
    incomeEvidencePacketHashSha256: result.incomeEvidencePacketHashSha256,
    noiConvention: result.noiConvention,
    baselineAnnualContractRentSar: result.baselineAnnualContractRentSar,
    baselineOccupiedAreaSqm: result.baselineOccupiedAreaSqm,
    baselineActiveLeaseCount: result.baselineActiveLeaseCount,
    periodResults: result.periodResults,
    firstForecastPeriodNoiSar: result.firstForecastPeriodNoiSar,
    stabilizedPeriodIndex: result.stabilizedPeriodIndex,
    stabilizedNoiSar: result.stabilizedNoiSar,
  };
}

function verifyProfessionalNoiResultIntegrity(result) {
  if (!result || typeof result !== 'object') return false;
  if (result.status !== PROFESSIONAL_NOI_RESULT_STATUS.PROFESSIONAL_NOI_READY) return false;
  if (result.modelVersion !== PROFESSIONAL_NOI_MODEL_VERSION) return false;
  if (result.canonicalCalculationEngine !== true) return false;
  if (!validSha(result.calculationHashSha256) || !validSha(result.inputPacketHashSha256) || !validSha(result.incomeEvidencePacketHashSha256)) return false;
  if (!Array.isArray(result.periodResults) || !Number.isInteger(result.stabilizedPeriodIndex) || result.stabilizedPeriodIndex < 1) return false;
  if (typeof result.stabilizedNoiSar !== 'number' || !Number.isFinite(result.stabilizedNoiSar)) return false;
  return sha256(professionalNoiResultCore(result)) === result.calculationHashSha256.toLowerCase();
}

function hold(status, blockers, context = {}) {
  return deepFreeze({
    schemaVersion: 1,
    caseId: context.caseId || null,
    propertyRef: context.propertyRef || null,
    valuationDate: context.valuationDate || null,
    status,
    blockers,
    readyForCanonicalDirectCapitalization: false,
    professionalNoiCalculationHashSha256: context.professionalNoiCalculationHashSha256 || null,
    marketCapRateInputHashSha256: context.marketCapRateInputHashSha256 || null,
    selectedNoiBasis: context.selectedNoiBasis || null,
    selectedNoiSar: null,
    marketCapRate: null,
    automaticMethodSelection: false,
    automaticRateDerivation: false,
    reconciliationPerformed: false,
    valuationConclusionProduced: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
  });
}

function buildDirectCapitalizationInputPacket({
  packetId,
  caseId,
  propertyRef,
  valuationDate,
  professionalNoiResult,
  marketCapRateInput,
  maximumRateAgeDays,
  selectedNoiBasis = DIRECT_CAP_NOI_BASIS.STABILIZED_NOI,
  preparedByRef,
  preparedAt,
  evidenceRef,
} = {}) {
  for (const [field, value] of [['packetId', packetId], ['caseId', caseId], ['propertyRef', propertyRef], ['preparedByRef', preparedByRef], ['evidenceRef', evidenceRef]]) assertNonEmpty(value, field);
  if (!Object.values(DIRECT_CAP_NOI_BASIS).includes(selectedNoiBasis)) throw new TypeError('selectedNoiBasis is invalid');
  if (!Number.isInteger(maximumRateAgeDays) || maximumRateAgeDays < 0) throw new TypeError('maximumRateAgeDays must be a non-negative integer');
  const valuationDateIso = iso(valuationDate, 'valuationDate');
  const preparedAtIso = iso(preparedAt, 'preparedAt');
  if (Date.parse(preparedAtIso) < Date.parse(valuationDateIso)) throw new TypeError('DIRECT_CAP_INPUT_PREPARED_BEFORE_VALUATION_DATE');

  if (!professionalNoiResult || professionalNoiResult.caseId !== caseId || professionalNoiResult.propertyRef !== propertyRef) {
    throw new TypeError('CASE_OR_PROPERTY_ISOLATION_VIOLATION:professionalNoiResult');
  }
  const context = {
    caseId, propertyRef, valuationDate: valuationDateIso, selectedNoiBasis,
    professionalNoiCalculationHashSha256: professionalNoiResult.calculationHashSha256 || null,
    marketCapRateInputHashSha256: marketCapRateInput?.rateInputHashSha256 || null,
  };
  if (!verifyProfessionalNoiResultIntegrity(professionalNoiResult)) {
    return hold(DIRECT_CAP_INPUT_STATUS.HOLD_INTEGRITY, ['PROFESSIONAL_NOI_RESULT_INTEGRITY_FAILED'], context);
  }
  if (iso(professionalNoiResult.valuationDate, 'professionalNoiResult.valuationDate') !== valuationDateIso) {
    return hold(DIRECT_CAP_INPUT_STATUS.HOLD_NOI, ['PROFESSIONAL_NOI_VALUATION_DATE_MISMATCH'], context);
  }
  if (!(professionalNoiResult.stabilizedNoiSar > 0)) {
    return hold(DIRECT_CAP_INPUT_STATUS.HOLD_NOI, ['POSITIVE_STABILIZED_NOI_REQUIRED_FOR_DIRECT_CAPITALIZATION'], context);
  }

  if (!marketCapRateInput || marketCapRateInput.caseId !== caseId || marketCapRateInput.propertyRef !== propertyRef) {
    throw new TypeError('CASE_OR_PROPERTY_ISOLATION_VIOLATION:marketCapRateInput');
  }
  if (marketCapRateInput.type !== RATE_INPUT_TYPE.MARKET_CAP_RATE) {
    return hold(DIRECT_CAP_INPUT_STATUS.HOLD_RATE_PROVENANCE, [`MARKET_CAP_RATE_REQUIRED:${marketCapRateInput.type || 'UNKNOWN'}`], context);
  }
  if (!verifyProfessionalRateInputIntegrity(marketCapRateInput)) {
    return hold(DIRECT_CAP_INPUT_STATUS.HOLD_INTEGRITY, ['MARKET_CAP_RATE_INPUT_INTEGRITY_FAILED'], context);
  }
  const rateAsOfDate = iso(marketCapRateInput.asOfDate, 'marketCapRateInput.asOfDate');
  const rateReviewedAt = iso(marketCapRateInput.reviewedAt, 'marketCapRateInput.reviewedAt');
  if (Date.parse(rateAsOfDate) > Date.parse(valuationDateIso)) {
    return hold(DIRECT_CAP_INPUT_STATUS.HOLD_RATE_PROVENANCE, ['MARKET_CAP_RATE_AS_OF_AFTER_VALUATION_DATE'], context);
  }
  if (Date.parse(rateReviewedAt) > Date.parse(preparedAtIso)) {
    return hold(DIRECT_CAP_INPUT_STATUS.HOLD_RATE_PROVENANCE, ['MARKET_CAP_RATE_REVIEW_AFTER_DIRECT_CAP_PREPARATION'], context);
  }
  const ageDays = daysBetween(rateAsOfDate, valuationDateIso);
  if (ageDays < 0 || ageDays > maximumRateAgeDays) {
    return hold(DIRECT_CAP_INPUT_STATUS.HOLD_RATE_PROVENANCE, [`MARKET_CAP_RATE_STALE:${ageDays}/${maximumRateAgeDays}`], context);
  }
  if (typeof marketCapRateInput.value !== 'number' || !Number.isFinite(marketCapRateInput.value) || marketCapRateInput.value <= 0 || marketCapRateInput.value > 1) {
    return hold(DIRECT_CAP_INPUT_STATUS.HOLD_RATE_PROVENANCE, ['MARKET_CAP_RATE_VALUE_INVALID'], context);
  }

  const core = {
    schemaVersion: 1,
    packetId: packetId.trim(),
    caseId: caseId.trim(),
    propertyRef: propertyRef.trim(),
    valuationDate: valuationDateIso,
    selectedNoiBasis,
    selectedNoiSar: professionalNoiResult.stabilizedNoiSar,
    noiConvention: professionalNoiResult.noiConvention,
    stabilizedPeriodIndex: professionalNoiResult.stabilizedPeriodIndex,
    professionalNoiCalculationHashSha256: professionalNoiResult.calculationHashSha256,
    professionalNoiInputPacketHashSha256: professionalNoiResult.inputPacketHashSha256,
    marketCapRate: marketCapRateInput.value,
    marketCapRateProvenance: {
      rateId: marketCapRateInput.rateId,
      rateInputHashSha256: marketCapRateInput.rateInputHashSha256,
      source: marketCapRateInput.source,
      sourceLabel: marketCapRateInput.sourceLabel,
      rationale: marketCapRateInput.rationale,
      evidenceRefs: marketCapRateInput.evidenceRefs,
      asOfDate: rateAsOfDate,
      confidence: marketCapRateInput.confidence,
      reviewedByRef: marketCapRateInput.reviewedByRef,
      reviewedAt: rateReviewedAt,
      reviewEvidenceRef: marketCapRateInput.reviewEvidenceRef,
      maximumAgeDays: maximumRateAgeDays,
      ageDays,
    },
    preparedByRef: preparedByRef.trim(),
    preparedAt: preparedAtIso,
    evidenceRef: evidenceRef.trim(),
  };
  return deepFreeze({
    ...core,
    directCapitalizationInputHashSha256: sha256(core),
    status: DIRECT_CAP_INPUT_STATUS.READY_FOR_CANONICAL_DIRECT_CAPITALIZATION,
    blockers: [],
    readyForCanonicalDirectCapitalization: true,
    automaticMethodSelection: false,
    automaticRateDerivation: false,
    capitalizationPerformed: false,
    reconciliationPerformed: false,
    valuationConclusionProduced: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
    semantics: 'This packet binds an integrity-verified positive stabilized professional NOI to one explicit professionally reviewed market capitalization rate. It performs no capitalization arithmetic, method selection, rate derivation, reconciliation, final valuation, certification or transaction authorization.',
  });
}

function verifyDirectCapitalizationInputIntegrity(packet) {
  if (!packet || !validSha(packet.directCapitalizationInputHashSha256)) return false;
  const core = { ...packet };
  [
    'directCapitalizationInputHashSha256', 'status', 'blockers', 'readyForCanonicalDirectCapitalization',
    'automaticMethodSelection', 'automaticRateDerivation', 'capitalizationPerformed', 'reconciliationPerformed',
    'valuationConclusionProduced', 'certifiedValuationEstablished', 'transactionAuthorized', 'semantics',
  ].forEach((key) => delete core[key]);
  return sha256(core) === packet.directCapitalizationInputHashSha256.toLowerCase();
}

module.exports = {
  DIRECT_CAP_NOI_BASIS,
  DIRECT_CAP_INPUT_STATUS,
  professionalNoiResultCore,
  verifyProfessionalNoiResultIntegrity,
  buildDirectCapitalizationInputPacket,
  verifyDirectCapitalizationInputIntegrity,
};
