'use strict';

const crypto = require('crypto');
const {
  PROPERTY_EVIDENCE_PACKET_STATUS,
} = require('../property/property-evidence-bridge');
const {
  ADJUSTMENT_ANALYSIS_STATUS,
  LEASE_INCOME_GATE_STATUS,
} = require('../market');

const VALUATION_METHOD = Object.freeze({
  SALES_COMPARISON: 'SALES_COMPARISON',
  DIRECT_CAPITALIZATION: 'DIRECT_CAPITALIZATION',
  DISCOUNTED_CASH_FLOW: 'DISCOUNTED_CASH_FLOW',
});

const RATE_INPUT_TYPE = Object.freeze({
  MARKET_CAP_RATE: 'MARKET_CAP_RATE',
  DISCOUNT_RATE: 'DISCOUNT_RATE',
  EXIT_CAP_RATE: 'EXIT_CAP_RATE',
});

const RATE_SOURCE = Object.freeze({
  VERIFIED_MARKET_ANALYSIS: 'VERIFIED_MARKET_ANALYSIS',
  PROFESSIONAL_JUDGMENT: 'PROFESSIONAL_JUDGMENT',
  EXTERNAL_PROFESSIONAL_REPORT: 'EXTERNAL_PROFESSIONAL_REPORT',
  OTHER: 'OTHER',
});

const RATE_CONFIDENCE = Object.freeze({
  LOW: 'LOW',
  MODERATE: 'MODERATE',
  HIGH: 'HIGH',
});

const METHOD_INPUT_STATUS = Object.freeze({
  READY_FOR_CANONICAL_ENGINE_ADOPTION_REVIEW: 'READY_FOR_CANONICAL_ENGINE_ADOPTION_REVIEW',
  HOLD_PROPERTY_EVIDENCE: 'HOLD_PROPERTY_EVIDENCE',
  HOLD_METHOD_EVIDENCE: 'HOLD_METHOD_EVIDENCE',
  HOLD_RATE_PROVENANCE: 'HOLD_RATE_PROVENANCE',
  HOLD_INPUT_COMPLETENESS: 'HOLD_INPUT_COMPLETENESS',
});

const REQUIRED_RATE_TYPES_BY_METHOD = Object.freeze({
  [VALUATION_METHOD.SALES_COMPARISON]: Object.freeze([]),
  [VALUATION_METHOD.DIRECT_CAPITALIZATION]: Object.freeze([RATE_INPUT_TYPE.MARKET_CAP_RATE]),
  [VALUATION_METHOD.DISCOUNTED_CASH_FLOW]: Object.freeze([RATE_INPUT_TYPE.DISCOUNT_RATE, RATE_INPUT_TYPE.EXIT_CAP_RATE]),
});

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function assertNonEmpty(value, field) {
  if (!nonEmpty(value)) throw new TypeError(`${field} must be a non-empty string`);
}

function assertEnum(value, enumeration, field) {
  if (!Object.values(enumeration).includes(value)) throw new TypeError(`${field} is invalid`);
}

function iso(value, field) {
  assertNonEmpty(value, field);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError(`${field} must be a valid date/time`);
  return date.toISOString();
}

function assertSha256(value, field) {
  if (!nonEmpty(value) || !/^[a-f0-9]{64}$/i.test(value)) throw new TypeError(`${field} must be a SHA-256 digest`);
}

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

function daysBetween(earlier, later) {
  return Math.floor((Date.parse(later) - Date.parse(earlier)) / 86400000);
}

function verifyProfessionalRateInputIntegrity(rate) {
  if (!rate || typeof rate !== 'object' || !/^[a-f0-9]{64}$/i.test(String(rate.rateInputHashSha256 || ''))) return false;
  const { rateInputHashSha256, ...payload } = rate;
  return sha256(payload) === rateInputHashSha256.toLowerCase();
}

function verifyMarketAnalysisSubjectBindingIntegrity(binding) {
  if (!binding || typeof binding !== 'object' || !/^[a-f0-9]{64}$/i.test(String(binding.bindingHashSha256 || ''))) return false;
  const { bindingHashSha256, ...payload } = binding;
  return sha256(payload) === bindingHashSha256.toLowerCase();
}

function createProfessionalRateInput({
  rateId,
  caseId,
  propertyRef,
  type,
  value,
  source,
  sourceLabel = null,
  rationale,
  evidenceRefs,
  asOfDate,
  preparedByRef,
  preparedAt,
  reviewedByRef,
  reviewedAt,
  reviewEvidenceRef,
  confidence,
} = {}) {
  for (const [field, item] of [
    ['rateId', rateId], ['caseId', caseId], ['propertyRef', propertyRef],
    ['rationale', rationale], ['preparedByRef', preparedByRef], ['reviewedByRef', reviewedByRef],
    ['reviewEvidenceRef', reviewEvidenceRef],
  ]) assertNonEmpty(item, field);
  assertEnum(type, RATE_INPUT_TYPE, 'type');
  assertEnum(source, RATE_SOURCE, 'source');
  assertEnum(confidence, RATE_CONFIDENCE, 'confidence');
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 1) {
    throw new TypeError('value must be a finite decimal rate > 0 and <= 1');
  }
  if (source === RATE_SOURCE.OTHER && !nonEmpty(sourceLabel)) throw new TypeError('OTHER_RATE_SOURCE_REQUIRES_LABEL');
  if (!Array.isArray(evidenceRefs) || evidenceRefs.length === 0 || evidenceRefs.some((ref) => !nonEmpty(ref))) {
    throw new TypeError('evidenceRefs must contain at least one non-empty reference');
  }

  const asOfDateIso = iso(asOfDate, 'asOfDate');
  const preparedAtIso = iso(preparedAt, 'preparedAt');
  const reviewedAtIso = iso(reviewedAt, 'reviewedAt');
  if (Date.parse(preparedAtIso) < Date.parse(asOfDateIso)) throw new TypeError('RATE_PREPARATION_BEFORE_AS_OF_DATE');
  if (Date.parse(reviewedAtIso) < Date.parse(preparedAtIso)) throw new TypeError('RATE_REVIEW_BEFORE_PREPARATION');

  const record = {
    schemaVersion: 1,
    rateId: rateId.trim(),
    caseId: caseId.trim(),
    propertyRef: propertyRef.trim(),
    type,
    value,
    source,
    sourceLabel: sourceLabel ? sourceLabel.trim() : null,
    rationale: rationale.trim(),
    evidenceRefs: [...new Set(evidenceRefs.map((ref) => ref.trim()))],
    asOfDate: asOfDateIso,
    preparedByRef: preparedByRef.trim(),
    preparedAt: preparedAtIso,
    reviewedByRef: reviewedByRef.trim(),
    reviewedAt: reviewedAtIso,
    reviewEvidenceRef: reviewEvidenceRef.trim(),
    confidence,
    professionalJudgmentExplicit: true,
    automaticallyDerived: false,
    canonicalEngineInputWritten: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
  };
  record.rateInputHashSha256 = sha256(record);
  return deepFreeze(record);
}

function createMarketAnalysisSubjectBinding({
  bindingId,
  caseId,
  propertyRef,
  marketAdjustmentAnalysis,
  boundByRef,
  boundAt,
  bindingEvidenceRef,
} = {}) {
  for (const [field, value] of [
    ['bindingId', bindingId], ['caseId', caseId], ['propertyRef', propertyRef],
    ['boundByRef', boundByRef], ['bindingEvidenceRef', bindingEvidenceRef],
  ]) assertNonEmpty(value, field);
  if (!marketAdjustmentAnalysis || typeof marketAdjustmentAnalysis !== 'object') throw new TypeError('marketAdjustmentAnalysis is required');
  if (marketAdjustmentAnalysis.caseId !== caseId) throw new TypeError('CASE_ISOLATION_VIOLATION:marketAdjustmentAnalysis');
  assertSha256(marketAdjustmentAnalysis.analysisHashSha256, 'marketAdjustmentAnalysis.analysisHashSha256');
  const binding = {
    schemaVersion: 1,
    bindingId: bindingId.trim(),
    caseId: caseId.trim(),
    propertyRef: propertyRef.trim(),
    marketAdjustmentAnalysisHashSha256: marketAdjustmentAnalysis.analysisHashSha256,
    boundByRef: boundByRef.trim(),
    boundAt: iso(boundAt, 'boundAt'),
    bindingEvidenceRef: bindingEvidenceRef.trim(),
    subjectPropertyBindingExplicit: true,
    automaticallyInferred: false,
  };
  binding.bindingHashSha256 = sha256(binding);
  return deepFreeze(binding);
}

function hold(status, reasons, context = {}) {
  return deepFreeze({
    schemaVersion: 1,
    caseId: context.caseId || null,
    propertyRef: context.propertyRef || null,
    method: context.method || null,
    status,
    reasons,
    candidateCanonicalRateBindings: Object.freeze({}),
    readyForCanonicalEngineAdoptionReview: false,
    explicitHumanAdoptionRequired: true,
    canonicalCalculationEngineRemainsAuthoritative: true,
    canonicalEngineInputWriteAuthorized: false,
    financialEngineInputsWritten: false,
    automaticMethodSelection: false,
    automaticValuationWeighting: false,
    valuationConclusionProduced: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
  });
}

function assertUpstreamIdentity(packet, caseId, propertyRef, kind) {
  if (!packet || typeof packet !== 'object') throw new TypeError(`${kind} is required`);
  if (packet.caseId !== caseId || packet.propertyRef !== propertyRef) {
    throw new TypeError(`CASE_OR_PROPERTY_ISOLATION_VIOLATION:${kind}`);
  }
}

function validatePropertyEvidencePacket(propertyEvidencePacket, caseId, propertyRef) {
  assertUpstreamIdentity(propertyEvidencePacket, caseId, propertyRef, 'propertyEvidencePacket');
  assertSha256(propertyEvidencePacket.packetHashSha256, 'propertyEvidencePacket.packetHashSha256');
  return propertyEvidencePacket.status === PROPERTY_EVIDENCE_PACKET_STATUS.READY_FOR_PROFESSIONAL_VALUATION_WORKFLOW
    && propertyEvidencePacket.professionalValuationWorkflowReady === true;
}

function buildProfessionalMethodInputPacket({
  caseId,
  propertyRef,
  method,
  propertyEvidencePacket,
  marketAdjustmentAnalysis = null,
  marketAnalysisSubjectBinding = null,
  incomeEvidencePacket = null,
  rateInputs = [],
  maximumRateAgeDaysByType = {},
  preparedByRef,
  preparedAt,
  preparationEvidenceRef,
} = {}) {
  assertNonEmpty(caseId, 'caseId');
  assertNonEmpty(propertyRef, 'propertyRef');
  assertEnum(method, VALUATION_METHOD, 'method');
  assertNonEmpty(preparedByRef, 'preparedByRef');
  assertNonEmpty(preparationEvidenceRef, 'preparationEvidenceRef');
  const preparedAtIso = iso(preparedAt, 'preparedAt');
  if (!Array.isArray(rateInputs)) throw new TypeError('rateInputs must be an array');
  if (!maximumRateAgeDaysByType || typeof maximumRateAgeDaysByType !== 'object' || Array.isArray(maximumRateAgeDaysByType)) {
    throw new TypeError('maximumRateAgeDaysByType must be an object');
  }

  if (!validatePropertyEvidencePacket(propertyEvidencePacket, caseId, propertyRef)) {
    return hold(METHOD_INPUT_STATUS.HOLD_PROPERTY_EVIDENCE, ['PROPERTY_EVIDENCE_PACKET_NOT_READY'], { caseId, propertyRef, method });
  }
  const valuationDateIso = iso(propertyEvidencePacket.valuationDate, 'propertyEvidencePacket.valuationDate');
  if (Date.parse(preparedAtIso) < Date.parse(valuationDateIso)) throw new TypeError('METHOD_INPUT_PREPARATION_BEFORE_VALUATION_DATE');

  if (method === VALUATION_METHOD.SALES_COMPARISON) {
    if (!marketAdjustmentAnalysis || typeof marketAdjustmentAnalysis !== 'object') throw new TypeError('marketAdjustmentAnalysis is required');
    if (marketAdjustmentAnalysis.caseId !== caseId) throw new TypeError('CASE_ISOLATION_VIOLATION:marketAdjustmentAnalysis');
    assertSha256(marketAdjustmentAnalysis.analysisHashSha256, 'marketAdjustmentAnalysis.analysisHashSha256');
    assertUpstreamIdentity(marketAnalysisSubjectBinding, caseId, propertyRef, 'marketAnalysisSubjectBinding');
    if (!verifyMarketAnalysisSubjectBindingIntegrity(marketAnalysisSubjectBinding)) {
      return hold(METHOD_INPUT_STATUS.HOLD_METHOD_EVIDENCE, ['MARKET_ANALYSIS_SUBJECT_BINDING_INTEGRITY_FAILED'], { caseId, propertyRef, method });
    }
    if (marketAnalysisSubjectBinding.marketAdjustmentAnalysisHashSha256 !== marketAdjustmentAnalysis.analysisHashSha256) {
      return hold(METHOD_INPUT_STATUS.HOLD_METHOD_EVIDENCE, ['MARKET_ANALYSIS_SUBJECT_BINDING_HASH_MISMATCH'], { caseId, propertyRef, method });
    }
    if (Date.parse(marketAnalysisSubjectBinding.boundAt) > Date.parse(preparedAtIso)) {
      return hold(METHOD_INPUT_STATUS.HOLD_METHOD_EVIDENCE, ['MARKET_ANALYSIS_SUBJECT_BINDING_AFTER_METHOD_INPUT_PREPARATION'], { caseId, propertyRef, method });
    }
    if (marketAdjustmentAnalysis.status !== ADJUSTMENT_ANALYSIS_STATUS.READY_FOR_RECONCILIATION
        || marketAdjustmentAnalysis.reconciliationReady !== true) {
      return hold(METHOD_INPUT_STATUS.HOLD_METHOD_EVIDENCE, ['MARKET_ADJUSTMENT_ANALYSIS_NOT_READY'], { caseId, propertyRef, method });
    }
  }

  if ([VALUATION_METHOD.DIRECT_CAPITALIZATION, VALUATION_METHOD.DISCOUNTED_CASH_FLOW].includes(method)) {
    assertUpstreamIdentity(incomeEvidencePacket, caseId, propertyRef, 'incomeEvidencePacket');
    assertSha256(incomeEvidencePacket.incomeEvidencePacketHashSha256, 'incomeEvidencePacket.incomeEvidencePacketHashSha256');
    if (incomeEvidencePacket.status !== LEASE_INCOME_GATE_STATUS.READY_FOR_INCOME_ANALYSIS_HANDOFF
        || incomeEvidencePacket.readyForIncomeAnalysisHandoff !== true) {
      return hold(METHOD_INPUT_STATUS.HOLD_METHOD_EVIDENCE, ['INCOME_EVIDENCE_PACKET_NOT_READY'], { caseId, propertyRef, method });
    }
  }

  const requiredRateTypes = REQUIRED_RATE_TYPES_BY_METHOD[method];
  const byType = new Map();
  const seenRateIds = new Set();
  const provenanceReasons = [];
  for (const rate of rateInputs) {
    if (!rate || rate.caseId !== caseId || rate.propertyRef !== propertyRef) {
      throw new TypeError('CASE_OR_PROPERTY_ISOLATION_VIOLATION:rateInput');
    }
    assertEnum(rate.type, RATE_INPUT_TYPE, 'rateInput.type');
    if (!verifyProfessionalRateInputIntegrity(rate)) {
      provenanceReasons.push(`RATE_INPUT_INTEGRITY_FAILED:${rate.rateId || 'UNKNOWN'}`);
      continue;
    }
    if (seenRateIds.has(rate.rateId)) provenanceReasons.push(`DUPLICATE_RATE_ID:${rate.rateId}`);
    seenRateIds.add(rate.rateId);
    if (byType.has(rate.type)) provenanceReasons.push(`DUPLICATE_RATE_TYPE:${rate.type}`);
    else byType.set(rate.type, rate);
  }

  const completenessReasons = [];
  for (const type of requiredRateTypes) {
    const rate = byType.get(type);
    if (!rate) {
      completenessReasons.push(type === RATE_INPUT_TYPE.EXIT_CAP_RATE
        ? 'EXPLICIT_EXIT_CAP_RATE_REQUIRED'
        : `REQUIRED_RATE_INPUT_MISSING:${type}`);
      continue;
    }
    if (Date.parse(rate.reviewedAt) > Date.parse(preparedAtIso)) provenanceReasons.push(`RATE_REVIEW_AFTER_METHOD_INPUT_PREPARATION:${type}`);
    if (Date.parse(rate.asOfDate) > Date.parse(valuationDateIso)) provenanceReasons.push(`RATE_AS_OF_DATE_AFTER_VALUATION_DATE:${type}`);
    const maxAge = maximumRateAgeDaysByType[type];
    if (!Number.isInteger(maxAge) || maxAge < 0) {
      provenanceReasons.push(`RATE_FRESHNESS_POLICY_REQUIRED:${type}`);
    } else {
      const ageDays = daysBetween(rate.asOfDate, valuationDateIso);
      if (ageDays < 0 || ageDays > maxAge) provenanceReasons.push(`RATE_PROVENANCE_STALE:${type}:${ageDays}/${maxAge}`);
    }
  }

  if (provenanceReasons.length) {
    return hold(METHOD_INPUT_STATUS.HOLD_RATE_PROVENANCE, provenanceReasons, { caseId, propertyRef, method });
  }
  if (completenessReasons.length) {
    return hold(METHOD_INPUT_STATUS.HOLD_INPUT_COMPLETENESS, completenessReasons, { caseId, propertyRef, method });
  }

  const candidateCanonicalRateBindings = {};
  if (method === VALUATION_METHOD.DIRECT_CAPITALIZATION) {
    candidateCanonicalRateBindings.marketCapRate = byType.get(RATE_INPUT_TYPE.MARKET_CAP_RATE).value;
  } else if (method === VALUATION_METHOD.DISCOUNTED_CASH_FLOW) {
    candidateCanonicalRateBindings.discountRate = byType.get(RATE_INPUT_TYPE.DISCOUNT_RATE).value;
    candidateCanonicalRateBindings.exitCapRate = byType.get(RATE_INPUT_TYPE.EXIT_CAP_RATE).value;
  }

  const methodEvidence = method === VALUATION_METHOD.SALES_COMPARISON
    ? {
      marketAdjustmentAnalysisHashSha256: marketAdjustmentAnalysis.analysisHashSha256,
      marketAnalysisSubjectBindingHashSha256: marketAnalysisSubjectBinding.bindingHashSha256,
      adjustedComparableIndications: marketAdjustmentAnalysis.indications.map((item) => ({
        comparableId: item.comparableId,
        adjustedUnitValueSarPerSqm: item.adjustedUnitValueSarPerSqm,
        valuationWeight: null,
      })),
    }
    : {
      incomeEvidencePacketHashSha256: incomeEvidencePacket.incomeEvidencePacketHashSha256,
      activeLeaseCount: incomeEvidencePacket.activeLeaseCount,
      occupiedAreaSqm: incomeEvidencePacket.occupiedAreaSqm,
      annualContractRentSar: incomeEvidencePacket.annualContractRentSar,
      noi: null,
    };

  const rateProvenance = requiredRateTypes.map((type) => {
    const rate = byType.get(type);
    return {
      type,
      rateId: rate.rateId,
      value: rate.value,
      rateInputHashSha256: rate.rateInputHashSha256,
      source: rate.source,
      sourceLabel: rate.sourceLabel,
      rationale: rate.rationale,
      evidenceRefs: rate.evidenceRefs,
      asOfDate: rate.asOfDate,
      confidence: rate.confidence,
      reviewedByRef: rate.reviewedByRef,
      reviewedAt: rate.reviewedAt,
      reviewEvidenceRef: rate.reviewEvidenceRef,
      maximumAgeDays: maximumRateAgeDaysByType[type],
    };
  });

  const core = {
    schemaVersion: 1,
    caseId,
    propertyRef,
    method,
    propertyEvidencePacketHashSha256: propertyEvidencePacket.packetHashSha256,
    valuationDate: valuationDateIso,
    basisOfValue: propertyEvidencePacket.basisOfValue,
    purpose: propertyEvidencePacket.purpose,
    methodEvidence,
    rateProvenance,
    candidateCanonicalRateBindings,
    preparedByRef: preparedByRef.trim(),
    preparedAt: preparedAtIso,
    preparationEvidenceRef: preparationEvidenceRef.trim(),
  };

  return deepFreeze({
    ...core,
    methodInputPacketHashSha256: sha256(core),
    status: METHOD_INPUT_STATUS.READY_FOR_CANONICAL_ENGINE_ADOPTION_REVIEW,
    reasons: [],
    readyForCanonicalEngineAdoptionReview: true,
    explicitHumanAdoptionRequired: true,
    canonicalCalculationEngineRemainsAuthoritative: true,
    canonicalEngineInputWriteAuthorized: false,
    financialEngineInputsWritten: false,
    automaticMethodSelection: false,
    automaticValuationWeighting: false,
    valuationConclusionProduced: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
    semantics: 'This packet binds professionally reviewed evidence and rate provenance into candidate method inputs only. It does not write the canonical engine, derive missing rates, substitute marketCapRate for exitCapRate, infer the sales-analysis subject property, select a valuation method, weight indications, calculate a final value, certify a valuation, or authorize a transaction.',
  });
}

module.exports = {
  VALUATION_METHOD,
  RATE_INPUT_TYPE,
  RATE_SOURCE,
  RATE_CONFIDENCE,
  METHOD_INPUT_STATUS,
  REQUIRED_RATE_TYPES_BY_METHOD,
  createProfessionalRateInput,
  verifyProfessionalRateInputIntegrity,
  createMarketAnalysisSubjectBinding,
  verifyMarketAnalysisSubjectBindingIntegrity,
  buildProfessionalMethodInputPacket,
};
