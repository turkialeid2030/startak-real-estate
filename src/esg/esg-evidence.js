'use strict';

const crypto = require('crypto');

const ESG_PILLAR = Object.freeze({
  ENVIRONMENTAL: 'ENVIRONMENTAL',
  SOCIAL: 'SOCIAL',
  GOVERNANCE: 'GOVERNANCE',
});

const ESG_FACTOR = Object.freeze({
  ENERGY_PERFORMANCE: 'ENERGY_PERFORMANCE',
  WATER_EFFICIENCY: 'WATER_EFFICIENCY',
  GHG_EMISSIONS: 'GHG_EMISSIONS',
  CLIMATE_PHYSICAL_RISK: 'CLIMATE_PHYSICAL_RISK',
  RESILIENCE_ADAPTATION: 'RESILIENCE_ADAPTATION',
  INDOOR_ENVIRONMENT_QUALITY: 'INDOOR_ENVIRONMENT_QUALITY',
  ACCESSIBILITY_INCLUSION: 'ACCESSIBILITY_INCLUSION',
  HEALTH_SAFETY: 'HEALTH_SAFETY',
  COMMUNITY_IMPACT: 'COMMUNITY_IMPACT',
  GOVERNANCE_COMPLIANCE: 'GOVERNANCE_COMPLIANCE',
  CERTIFICATION_RATING: 'CERTIFICATION_RATING',
  OTHER: 'OTHER',
});

const ESG_SOURCE_CLASS = Object.freeze({
  OFFICIAL_AUTHORITY: 'OFFICIAL_AUTHORITY',
  VERIFIED_TECHNICAL_REPORT: 'VERIFIED_TECHNICAL_REPORT',
  VERIFIED_OWNER_RECORD: 'VERIFIED_OWNER_RECORD',
  CLIENT_PROVIDED: 'CLIENT_PROVIDED',
  PUBLIC_SOURCE: 'PUBLIC_SOURCE',
  ASSUMED: 'ASSUMED',
});

const ESG_VERIFICATION_STATUS = Object.freeze({
  VERIFIED: 'VERIFIED',
  NOT_VERIFIED: 'NOT_VERIFIED',
});

const ESG_EVIDENCE_SET_STATUS = Object.freeze({
  READY_FOR_MATERIALITY_REVIEW: 'READY_FOR_MATERIALITY_REVIEW',
  HOLD_MISSING_EVIDENCE: 'HOLD_MISSING_EVIDENCE',
  HOLD_TEMPORAL_VALIDITY: 'HOLD_TEMPORAL_VALIDITY',
  HOLD_VERIFICATION: 'HOLD_VERIFICATION',
  HOLD_STALE: 'HOLD_STALE',
  HOLD_CONTRADICTION: 'HOLD_CONTRADICTION',
  HOLD_INTEGRITY: 'HOLD_INTEGRITY',
});

const ESG_MATERIALITY_OUTCOME = Object.freeze({
  MATERIAL: 'MATERIAL',
  POTENTIALLY_MATERIAL: 'POTENTIALLY_MATERIAL',
  NOT_MATERIAL: 'NOT_MATERIAL',
  REVIEW_REQUIRED: 'REVIEW_REQUIRED',
});

const ESG_MATERIALITY_STATUS = Object.freeze({
  MATERIALITY_REVIEW_RECORDED: 'MATERIALITY_REVIEW_RECORDED',
  HOLD_EVIDENCE_SET: 'HOLD_EVIDENCE_SET',
  HOLD_REVIEW: 'HOLD_REVIEW',
});

const ESG_VALUE_DIRECTION = Object.freeze({
  UPWARD: 'UPWARD',
  DOWNWARD: 'DOWNWARD',
  NEUTRAL: 'NEUTRAL',
  UNCERTAIN: 'UNCERTAIN',
});

const ESG_VALUATION_CONSIDERATION_STATUS = Object.freeze({
  READY_FOR_PROFESSIONAL_CONSIDERATION: 'READY_FOR_PROFESSIONAL_CONSIDERATION',
  HOLD_MATERIALITY: 'HOLD_MATERIALITY',
  HOLD_MARKET_LINKAGE: 'HOLD_MARKET_LINKAGE',
  HOLD_INTEGRITY: 'HOLD_INTEGRITY',
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
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new TypeError(`${field} must be a valid date/time`);
  return d.toISOString();
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

function verifyHash(record, field) {
  if (!record || typeof record !== 'object') return false;
  const digest = record[field];
  if (!nonEmpty(digest) || !/^[a-f0-9]{64}$/i.test(digest)) return false;
  const payload = { ...record };
  delete payload[field];
  return sha256(payload) === digest.toLowerCase();
}

function createEsgEvidenceRecord({
  evidenceId,
  caseId,
  propertyRef,
  pillar,
  factor,
  claimKey,
  normalizedValue,
  unit = null,
  observation,
  sourceClass,
  sourceName,
  sourceRef,
  sourceUrl = null,
  sourceDate,
  validFrom,
  validTo = null,
  verification,
  capturedAt,
} = {}) {
  for (const [field, value] of [
    ['evidenceId', evidenceId], ['caseId', caseId], ['propertyRef', propertyRef],
    ['claimKey', claimKey], ['observation', observation], ['sourceName', sourceName], ['sourceRef', sourceRef],
  ]) assertNonEmpty(value, field);
  assertEnum(pillar, ESG_PILLAR, 'pillar');
  assertEnum(factor, ESG_FACTOR, 'factor');
  assertEnum(sourceClass, ESG_SOURCE_CLASS, 'sourceClass');
  if (normalizedValue === undefined || normalizedValue === null) throw new TypeError('normalizedValue is required');
  if (unit !== null && unit !== undefined && !nonEmpty(unit)) throw new TypeError('unit must be null or non-empty');
  if (sourceUrl !== null && sourceUrl !== undefined && !nonEmpty(sourceUrl)) throw new TypeError('sourceUrl must be null or non-empty');
  if (!verification || typeof verification !== 'object') throw new TypeError('verification is required');
  assertEnum(verification.status, ESG_VERIFICATION_STATUS, 'verification.status');

  const sourceDateIso = iso(sourceDate, 'sourceDate');
  const validFromIso = iso(validFrom, 'validFrom');
  const validToIso = validTo === null || validTo === undefined ? null : iso(validTo, 'validTo');
  const capturedAtIso = iso(capturedAt, 'capturedAt');
  if (Date.parse(sourceDateIso) > Date.parse(capturedAtIso)) throw new TypeError('ESG_SOURCE_DATE_AFTER_CAPTURE');
  if (validToIso && Date.parse(validToIso) < Date.parse(validFromIso)) throw new TypeError('ESG_VALID_TO_BEFORE_VALID_FROM');

  let normalizedVerification;
  if (verification.status === ESG_VERIFICATION_STATUS.VERIFIED) {
    assertNonEmpty(verification.verifiedByRef, 'verification.verifiedByRef');
    assertNonEmpty(verification.verificationEvidenceRef, 'verification.verificationEvidenceRef');
    const verifiedAtIso = iso(verification.verifiedAt, 'verification.verifiedAt');
    if (Date.parse(verifiedAtIso) < Date.parse(capturedAtIso)) throw new TypeError('ESG_VERIFICATION_BEFORE_CAPTURE');
    normalizedVerification = {
      status: verification.status,
      verifiedByRef: verification.verifiedByRef.trim(),
      verifiedAt: verifiedAtIso,
      verificationEvidenceRef: verification.verificationEvidenceRef.trim(),
    };
  } else {
    normalizedVerification = {
      status: verification.status,
      verifiedByRef: null,
      verifiedAt: null,
      verificationEvidenceRef: null,
    };
  }

  const record = {
    schemaVersion: 1,
    evidenceId: evidenceId.trim(),
    caseId: caseId.trim(),
    propertyRef: propertyRef.trim(),
    pillar,
    factor,
    claimKey: claimKey.trim(),
    normalizedValue: stableClone(normalizedValue),
    unit: unit ? unit.trim() : null,
    observation: observation.trim(),
    sourceClass,
    sourceName: sourceName.trim(),
    sourceRef: sourceRef.trim(),
    sourceUrl: sourceUrl ? sourceUrl.trim() : null,
    sourceDate: sourceDateIso,
    validFrom: validFromIso,
    validTo: validToIso,
    verification: normalizedVerification,
    capturedAt: capturedAtIso,
    automaticValueAdjustmentApplied: false,
    canonicalEngineInputsWritten: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
  };
  record.esgEvidenceHashSha256 = sha256(record);
  return deepFreeze(record);
}

function verifyEsgEvidenceIntegrity(record) {
  return verifyHash(record, 'esgEvidenceHashSha256');
}

function assessEsgEvidenceSet({
  caseId,
  propertyRef,
  valuationDate,
  records,
  requiredFactors,
  allowedSourceClasses,
  maxAgeDaysByFactor = {},
} = {}) {
  assertNonEmpty(caseId, 'caseId');
  assertNonEmpty(propertyRef, 'propertyRef');
  const valuationDateIso = iso(valuationDate, 'valuationDate');
  if (!Array.isArray(records)) throw new TypeError('records must be an array');
  if (!Array.isArray(requiredFactors) || requiredFactors.length === 0) throw new TypeError('requiredFactors must be a non-empty array');
  if (!Array.isArray(allowedSourceClasses) || allowedSourceClasses.length === 0) throw new TypeError('allowedSourceClasses must be a non-empty array');
  const required = [...new Set(requiredFactors)];
  required.forEach((factor) => assertEnum(factor, ESG_FACTOR, 'requiredFactor'));
  allowedSourceClasses.forEach((sourceClass) => assertEnum(sourceClass, ESG_SOURCE_CLASS, 'allowedSourceClass'));
  for (const [factor, days] of Object.entries(maxAgeDaysByFactor)) {
    assertEnum(factor, ESG_FACTOR, `maxAgeDaysByFactor.${factor}`);
    if (!Number.isInteger(days) || days < 0) throw new TypeError(`maxAgeDaysByFactor.${factor} must be a non-negative integer`);
  }

  const blockers = [];
  const seenIds = new Set();
  for (const record of records) {
    if (!record || record.caseId !== caseId || record.propertyRef !== propertyRef) throw new TypeError('CASE_OR_PROPERTY_ISOLATION_VIOLATION:esgEvidence');
    if (seenIds.has(record.evidenceId)) blockers.push(`DUPLICATE_ESG_EVIDENCE_ID:${record.evidenceId}`);
    seenIds.add(record.evidenceId);
    if (!verifyEsgEvidenceIntegrity(record)) blockers.push(`ESG_EVIDENCE_INTEGRITY_FAILED:${record.evidenceId || 'UNKNOWN'}`);
  }
  if (blockers.length) {
    return deepFreeze({
      schemaVersion: 1, caseId, propertyRef, valuationDate: valuationDateIso,
      status: ESG_EVIDENCE_SET_STATUS.HOLD_INTEGRITY,
      blockers, eligibleEvidence: [], readyForMaterialityReview: false,
      automaticValueAdjustmentApplied: false, canonicalEngineInputsWritten: false,
      certifiedValuationEstablished: false, transactionAuthorized: false,
    });
  }

  const eligibleEvidence = [];
  const missing = [];
  const temporal = [];
  const verification = [];
  const stale = [];
  const contradictions = [];

  for (const factor of required) {
    const candidates = records.filter((record) => record.factor === factor);
    if (!candidates.length) {
      missing.push(`MISSING_REQUIRED_ESG_FACTOR:${factor}`);
      continue;
    }
    const temporallyValid = candidates.filter((record) => {
      const t = Date.parse(valuationDateIso);
      return Date.parse(record.validFrom) <= t && (!record.validTo || t <= Date.parse(record.validTo));
    });
    if (!temporallyValid.length) {
      temporal.push(`NO_TEMPORALLY_VALID_ESG_EVIDENCE:${factor}`);
      continue;
    }
    const verified = temporallyValid.filter((record) => record.verification.status === ESG_VERIFICATION_STATUS.VERIFIED
      && allowedSourceClasses.includes(record.sourceClass));
    if (!verified.length) {
      verification.push(`NO_VERIFIED_ALLOWED_ESG_EVIDENCE:${factor}`);
      continue;
    }

    const maxAgeDays = maxAgeDaysByFactor[factor];
    const fresh = verified.filter((record) => {
      if (maxAgeDays === undefined) return true;
      const age = Math.floor((Date.parse(valuationDateIso) - Date.parse(record.sourceDate)) / 86400000);
      return age >= 0 && age <= maxAgeDays;
    });
    if (!fresh.length) {
      stale.push(`NO_FRESH_ESG_EVIDENCE:${factor}`);
      continue;
    }

    const byClaim = new Map();
    for (const record of fresh) {
      const group = byClaim.get(record.claimKey) || [];
      group.push(record);
      byClaim.set(record.claimKey, group);
    }
    for (const [claimKey, group] of byClaim.entries()) {
      if (group.length < 2) continue;
      const first = JSON.stringify(stableClone(group[0].normalizedValue));
      if (group.slice(1).some((record) => JSON.stringify(stableClone(record.normalizedValue)) !== first)) {
        contradictions.push(`CONTRADICTORY_ESG_CLAIM:${factor}:${claimKey}`);
      }
    }

    eligibleEvidence.push(...fresh.map((record) => ({
      evidenceId: record.evidenceId,
      pillar: record.pillar,
      factor: record.factor,
      claimKey: record.claimKey,
      normalizedValue: stableClone(record.normalizedValue),
      unit: record.unit,
      observation: record.observation,
      sourceClass: record.sourceClass,
      sourceName: record.sourceName,
      sourceRef: record.sourceRef,
      sourceDate: record.sourceDate,
      esgEvidenceHashSha256: record.esgEvidenceHashSha256,
    })));
  }

  let status = ESG_EVIDENCE_SET_STATUS.READY_FOR_MATERIALITY_REVIEW;
  if (contradictions.length) status = ESG_EVIDENCE_SET_STATUS.HOLD_CONTRADICTION;
  else if (missing.length) status = ESG_EVIDENCE_SET_STATUS.HOLD_MISSING_EVIDENCE;
  else if (temporal.length) status = ESG_EVIDENCE_SET_STATUS.HOLD_TEMPORAL_VALIDITY;
  else if (verification.length) status = ESG_EVIDENCE_SET_STATUS.HOLD_VERIFICATION;
  else if (stale.length) status = ESG_EVIDENCE_SET_STATUS.HOLD_STALE;

  const result = {
    schemaVersion: 1,
    caseId,
    propertyRef,
    valuationDate: valuationDateIso,
    status,
    blockers: [...contradictions, ...missing, ...temporal, ...verification, ...stale],
    requiredFactors: required,
    allowedSourceClasses: [...allowedSourceClasses],
    maxAgeDaysByFactor: { ...maxAgeDaysByFactor },
    eligibleEvidence,
    readyForMaterialityReview: status === ESG_EVIDENCE_SET_STATUS.READY_FOR_MATERIALITY_REVIEW,
    esgValueEffectEstablished: false,
    automaticValueAdjustmentApplied: false,
    canonicalEngineInputsWritten: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
    semantics: 'Evidence readiness means the configured ESG evidence is verified, temporally valid, sufficiently fresh and internally non-contradictory for professional materiality review. It does not establish a value effect or permit an automatic valuation adjustment.',
  };
  result.esgEvidenceSetHashSha256 = sha256(result);
  return deepFreeze(result);
}

function verifyEsgEvidenceSetIntegrity(set) {
  return verifyHash(set, 'esgEvidenceSetHashSha256');
}

function recordEsgMaterialityAssessment({
  assessmentId,
  caseId,
  propertyRef,
  evidenceSet,
  factorReviews,
  reviewedByRef,
  reviewedAt,
  reviewEvidenceRef,
} = {}) {
  for (const [field, value] of [
    ['assessmentId', assessmentId], ['caseId', caseId], ['propertyRef', propertyRef],
    ['reviewedByRef', reviewedByRef], ['reviewEvidenceRef', reviewEvidenceRef],
  ]) assertNonEmpty(value, field);
  if (!evidenceSet || evidenceSet.caseId !== caseId || evidenceSet.propertyRef !== propertyRef) throw new TypeError('CASE_OR_PROPERTY_ISOLATION_VIOLATION:esgEvidenceSet');
  if (!Array.isArray(factorReviews) || factorReviews.length === 0) throw new TypeError('factorReviews must be a non-empty array');
  const reviewedAtIso = iso(reviewedAt, 'reviewedAt');

  if (!verifyEsgEvidenceSetIntegrity(evidenceSet) || evidenceSet.status !== ESG_EVIDENCE_SET_STATUS.READY_FOR_MATERIALITY_REVIEW) {
    return deepFreeze({
      schemaVersion: 1, assessmentId: assessmentId.trim(), caseId, propertyRef,
      status: ESG_MATERIALITY_STATUS.HOLD_EVIDENCE_SET,
      blockers: ['ESG_EVIDENCE_SET_NOT_READY_OR_INTEGRITY_FAILED'],
      materialFactors: [], potentiallyMaterialFactors: [],
      automaticValueAdjustmentApplied: false, canonicalEngineInputsWritten: false,
      certifiedValuationEstablished: false, transactionAuthorized: false,
    });
  }

  const eligibleById = new Map(evidenceSet.eligibleEvidence.map((item) => [item.evidenceId, item]));
  const seenFactors = new Set();
  const normalizedReviews = [];
  const blockers = [];

  for (const review of factorReviews) {
    if (!review || typeof review !== 'object') {
      blockers.push('INVALID_ESG_FACTOR_REVIEW');
      continue;
    }
    assertEnum(review.factor, ESG_FACTOR, 'factorReview.factor');
    assertEnum(review.outcome, ESG_MATERIALITY_OUTCOME, 'factorReview.outcome');
    if (seenFactors.has(review.factor)) blockers.push(`DUPLICATE_ESG_FACTOR_REVIEW:${review.factor}`);
    seenFactors.add(review.factor);
    if (!nonEmpty(review.rationale)) blockers.push(`ESG_FACTOR_REVIEW_RATIONALE_REQUIRED:${review.factor}`);
    if (!Array.isArray(review.evidenceIds) || review.evidenceIds.length === 0) blockers.push(`ESG_FACTOR_REVIEW_EVIDENCE_REQUIRED:${review.factor}`);
    const evidenceIds = Array.isArray(review.evidenceIds) ? [...new Set(review.evidenceIds)] : [];
    for (const id of evidenceIds) {
      const evidence = eligibleById.get(id);
      if (!evidence) blockers.push(`ESG_FACTOR_REVIEW_UNKNOWN_EVIDENCE:${review.factor}:${id}`);
      else if (evidence.factor !== review.factor) blockers.push(`ESG_FACTOR_REVIEW_EVIDENCE_FACTOR_MISMATCH:${review.factor}:${id}`);
    }
    normalizedReviews.push({
      factor: review.factor,
      outcome: review.outcome,
      rationale: nonEmpty(review.rationale) ? review.rationale.trim() : null,
      evidenceIds,
      evidenceHashes: evidenceIds.map((id) => eligibleById.get(id)?.esgEvidenceHashSha256 || null),
    });
  }

  for (const factor of evidenceSet.requiredFactors) {
    if (!seenFactors.has(factor)) blockers.push(`MISSING_ESG_FACTOR_MATERIALITY_REVIEW:${factor}`);
  }

  if (blockers.length) {
    return deepFreeze({
      schemaVersion: 1, assessmentId: assessmentId.trim(), caseId, propertyRef,
      status: ESG_MATERIALITY_STATUS.HOLD_REVIEW, blockers,
      materialFactors: [], potentiallyMaterialFactors: [],
      automaticValueAdjustmentApplied: false, canonicalEngineInputsWritten: false,
      certifiedValuationEstablished: false, transactionAuthorized: false,
    });
  }

  const core = {
    schemaVersion: 1,
    assessmentId: assessmentId.trim(),
    caseId,
    propertyRef,
    valuationDate: evidenceSet.valuationDate,
    esgEvidenceSetHashSha256: evidenceSet.esgEvidenceSetHashSha256,
    factorReviews: normalizedReviews,
    reviewedByRef: reviewedByRef.trim(),
    reviewedAt: reviewedAtIso,
    reviewEvidenceRef: reviewEvidenceRef.trim(),
  };

  return deepFreeze({
    ...core,
    esgMaterialityAssessmentHashSha256: sha256(core),
    status: ESG_MATERIALITY_STATUS.MATERIALITY_REVIEW_RECORDED,
    blockers: [],
    materialFactors: normalizedReviews.filter((item) => item.outcome === ESG_MATERIALITY_OUTCOME.MATERIAL).map((item) => item.factor),
    potentiallyMaterialFactors: normalizedReviews.filter((item) => item.outcome === ESG_MATERIALITY_OUTCOME.POTENTIALLY_MATERIAL).map((item) => item.factor),
    professionalMaterialityJudgmentRecorded: true,
    esgValueEffectEstablished: false,
    automaticValueAdjustmentApplied: false,
    numericValueAdjustmentProduced: false,
    canonicalEngineInputsWritten: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
  });
}

function verifyEsgMaterialityAssessmentIntegrity(assessment) {
  if (!assessment || assessment.status !== ESG_MATERIALITY_STATUS.MATERIALITY_REVIEW_RECORDED) return false;
  const hash = assessment.esgMaterialityAssessmentHashSha256;
  if (!nonEmpty(hash) || !/^[a-f0-9]{64}$/i.test(hash)) return false;
  const core = {
    schemaVersion: assessment.schemaVersion,
    assessmentId: assessment.assessmentId,
    caseId: assessment.caseId,
    propertyRef: assessment.propertyRef,
    valuationDate: assessment.valuationDate,
    esgEvidenceSetHashSha256: assessment.esgEvidenceSetHashSha256,
    factorReviews: assessment.factorReviews,
    reviewedByRef: assessment.reviewedByRef,
    reviewedAt: assessment.reviewedAt,
    reviewEvidenceRef: assessment.reviewEvidenceRef,
  };
  return sha256(core) === hash.toLowerCase();
}

function buildEsgValuationConsiderationPacket({
  packetId,
  caseId,
  propertyRef,
  materialityAssessment,
  considerations,
  preparedByRef,
  preparedAt,
  packetEvidenceRef,
} = {}) {
  for (const [field, value] of [
    ['packetId', packetId], ['caseId', caseId], ['propertyRef', propertyRef],
    ['preparedByRef', preparedByRef], ['packetEvidenceRef', packetEvidenceRef],
  ]) assertNonEmpty(value, field);
  if (!materialityAssessment || materialityAssessment.caseId !== caseId || materialityAssessment.propertyRef !== propertyRef) throw new TypeError('CASE_OR_PROPERTY_ISOLATION_VIOLATION:esgMaterialityAssessment');
  if (!Array.isArray(considerations) || considerations.length === 0) throw new TypeError('considerations must be a non-empty array');
  const preparedAtIso = iso(preparedAt, 'preparedAt');

  if (!verifyEsgMaterialityAssessmentIntegrity(materialityAssessment)) {
    return deepFreeze({
      schemaVersion: 1, packetId: packetId.trim(), caseId, propertyRef,
      status: ESG_VALUATION_CONSIDERATION_STATUS.HOLD_INTEGRITY,
      blockers: ['ESG_MATERIALITY_ASSESSMENT_INTEGRITY_FAILED'],
      professionalValuationConsiderationReady: false,
      automaticValueAdjustmentApplied: false, numericValueAdjustmentProduced: false,
      canonicalEngineInputsWritten: false, certifiedValuationEstablished: false, transactionAuthorized: false,
    });
  }

  const reviewByFactor = new Map(materialityAssessment.factorReviews.map((item) => [item.factor, item]));
  const normalized = [];
  const blockers = [];
  const seen = new Set();
  for (const consideration of considerations) {
    if (!consideration || typeof consideration !== 'object') {
      blockers.push('INVALID_ESG_VALUATION_CONSIDERATION');
      continue;
    }
    assertEnum(consideration.factor, ESG_FACTOR, 'consideration.factor');
    assertEnum(consideration.direction, ESG_VALUE_DIRECTION, 'consideration.direction');
    if (seen.has(consideration.factor)) blockers.push(`DUPLICATE_ESG_VALUATION_CONSIDERATION:${consideration.factor}`);
    seen.add(consideration.factor);
    const materiality = reviewByFactor.get(consideration.factor);
    if (!materiality || ![ESG_MATERIALITY_OUTCOME.MATERIAL, ESG_MATERIALITY_OUTCOME.POTENTIALLY_MATERIAL].includes(materiality.outcome)) {
      blockers.push(`ESG_FACTOR_NOT_MATERIAL_FOR_VALUATION_CONSIDERATION:${consideration.factor}`);
    }
    if (!nonEmpty(consideration.rationale)) blockers.push(`ESG_VALUATION_RATIONALE_REQUIRED:${consideration.factor}`);
    if (!Array.isArray(consideration.marketEvidenceRefs) || consideration.marketEvidenceRefs.length === 0
      || consideration.marketEvidenceRefs.some((ref) => !nonEmpty(ref))) {
      blockers.push(`ESG_MARKET_EVIDENCE_REQUIRED:${consideration.factor}`);
    }
    normalized.push({
      factor: consideration.factor,
      direction: consideration.direction,
      rationale: nonEmpty(consideration.rationale) ? consideration.rationale.trim() : null,
      marketEvidenceRefs: Array.isArray(consideration.marketEvidenceRefs)
        ? [...new Set(consideration.marketEvidenceRefs.filter(nonEmpty).map((ref) => ref.trim()))]
        : [],
      materialityOutcome: materiality?.outcome || null,
      materialityEvidenceIds: materiality?.evidenceIds || [],
    });
  }

  if (blockers.some((item) => item.startsWith('ESG_FACTOR_NOT_MATERIAL'))) {
    return deepFreeze({
      schemaVersion: 1, packetId: packetId.trim(), caseId, propertyRef,
      status: ESG_VALUATION_CONSIDERATION_STATUS.HOLD_MATERIALITY,
      blockers,
      professionalValuationConsiderationReady: false,
      automaticValueAdjustmentApplied: false, numericValueAdjustmentProduced: false,
      canonicalEngineInputsWritten: false, certifiedValuationEstablished: false, transactionAuthorized: false,
    });
  }
  if (blockers.length) {
    return deepFreeze({
      schemaVersion: 1, packetId: packetId.trim(), caseId, propertyRef,
      status: ESG_VALUATION_CONSIDERATION_STATUS.HOLD_MARKET_LINKAGE,
      blockers,
      professionalValuationConsiderationReady: false,
      automaticValueAdjustmentApplied: false, numericValueAdjustmentProduced: false,
      canonicalEngineInputsWritten: false, certifiedValuationEstablished: false, transactionAuthorized: false,
    });
  }

  const core = {
    schemaVersion: 1,
    packetId: packetId.trim(),
    caseId,
    propertyRef,
    valuationDate: materialityAssessment.valuationDate,
    esgMaterialityAssessmentHashSha256: materialityAssessment.esgMaterialityAssessmentHashSha256,
    considerations: normalized,
    preparedByRef: preparedByRef.trim(),
    preparedAt: preparedAtIso,
    packetEvidenceRef: packetEvidenceRef.trim(),
  };

  return deepFreeze({
    ...core,
    esgValuationConsiderationHashSha256: sha256(core),
    status: ESG_VALUATION_CONSIDERATION_STATUS.READY_FOR_PROFESSIONAL_CONSIDERATION,
    blockers: [],
    professionalValuationConsiderationReady: true,
    marketEvidenceLinkageRequired: true,
    explicitProfessionalAdoptionRequired: true,
    esgValueEffectEstablished: false,
    automaticValueAdjustmentApplied: false,
    numericValueAdjustmentProduced: false,
    canonicalEngineInputsWritten: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
    semantics: 'An ESG factor may be professionally considered only after verified evidence, explicit materiality review and market-evidence linkage. This packet records a directional professional consideration only; it does not calculate or apply a value adjustment, alter canonical engine inputs, certify a valuation, or authorize a transaction.',
  });
}

module.exports = {
  ESG_PILLAR,
  ESG_FACTOR,
  ESG_SOURCE_CLASS,
  ESG_VERIFICATION_STATUS,
  ESG_EVIDENCE_SET_STATUS,
  ESG_MATERIALITY_OUTCOME,
  ESG_MATERIALITY_STATUS,
  ESG_VALUE_DIRECTION,
  ESG_VALUATION_CONSIDERATION_STATUS,
  createEsgEvidenceRecord,
  verifyEsgEvidenceIntegrity,
  assessEsgEvidenceSet,
  verifyEsgEvidenceSetIntegrity,
  recordEsgMaterialityAssessment,
  verifyEsgMaterialityAssessmentIntegrity,
  buildEsgValuationConsiderationPacket,
};
