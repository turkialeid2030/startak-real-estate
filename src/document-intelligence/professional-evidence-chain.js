'use strict';

const crypto = require('crypto');
const {
  TRUTH_STATUS,
  VERIFICATION_STATUS,
  deepFreeze,
} = require('./contracts');

const EVIDENCE_SOURCE_ROLE = Object.freeze({
  TITLE_DEED: 'TITLE_DEED',
  REAL_ESTATE_REGISTRY: 'REAL_ESTATE_REGISTRY',
  BUILDING_PERMIT: 'BUILDING_PERMIT',
  APPROVED_PLAN: 'APPROVED_PLAN',
  SURVEY: 'SURVEY',
  INSPECTION: 'INSPECTION',
  LEASE: 'LEASE',
  FINANCIAL_RECORD: 'FINANCIAL_RECORD',
  MARKET_EVIDENCE: 'MARKET_EVIDENCE',
  CLIENT_PROVIDED: 'CLIENT_PROVIDED',
  OTHER: 'OTHER',
});

const EVIDENCE_SENSITIVITY_CLASS = Object.freeze({
  ROUTINE: 'ROUTINE',
  MATERIAL: 'MATERIAL',
  CRITICAL: 'CRITICAL',
});

const EXTRACTOR_TYPE = Object.freeze({
  HUMAN: 'HUMAN',
  SYSTEM: 'SYSTEM',
  AI: 'AI',
});

const PROFESSIONAL_REVIEW_OUTCOME = Object.freeze({
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
});

const ADMISSIBILITY_TARGET = Object.freeze({
  ANALYSIS_ONLY: 'ANALYSIS_ONLY',
  PROFESSIONAL_REPORT: 'PROFESSIONAL_REPORT',
  ENGINE_INPUT: 'ENGINE_INPUT',
});

const ADMISSIBILITY_STATUS = Object.freeze({
  READY: 'READY',
  READY_WITH_LIMITATIONS: 'READY_WITH_LIMITATIONS',
  HOLD_EVIDENCE: 'HOLD_EVIDENCE',
  HOLD_INTEGRITY: 'HOLD_INTEGRITY',
  REJECTED: 'REJECTED',
});

function isNonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function assertEnum(value, enumeration, field) {
  if (!Object.values(enumeration).includes(value)) {
    throw new TypeError(`${field} must be one of: ${Object.values(enumeration).join(', ')}`);
  }
}

function assertNonEmpty(value, field) {
  if (!isNonEmpty(value)) throw new TypeError(`${field} must be a non-empty string`);
}

function canonicalIso(value, field) {
  const d = new Date(value);
  if (!isNonEmpty(value) || Number.isNaN(d.getTime())) throw new TypeError(`${field} must be a valid ISO-compatible date/time`);
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

function projectFactForChain(fact) {
  if (!fact || typeof fact !== 'object') throw new TypeError('fact is required');
  const required = ['factId', 'caseId', 'documentId', 'documentHashSha256', 'key', 'valueType', 'capturedAt'];
  for (const key of required) assertNonEmpty(fact[key], `fact.${key}`);
  if (!/^[a-f0-9]{64}$/i.test(fact.documentHashSha256)) throw new TypeError('fact.documentHashSha256 must be a SHA-256 digest');
  if (!fact.sourceLocator || typeof fact.sourceLocator !== 'object') throw new TypeError('fact.sourceLocator is required');
  if (!fact.extraction || !isNonEmpty(fact.extraction.method) || typeof fact.extraction.confidence !== 'number') {
    throw new TypeError('fact extraction method/confidence are required');
  }
  if (fact.extraction.confidence < 0 || fact.extraction.confidence > 1) throw new TypeError('fact extraction confidence must be between 0 and 1');
  return {
    factId: fact.factId,
    caseId: fact.caseId,
    documentId: fact.documentId,
    documentHashSha256: fact.documentHashSha256.toLowerCase(),
    key: fact.key,
    valueType: fact.valueType,
    unit: fact.unit ?? null,
    normalizedValueHashSha256: sha256({ value: fact.normalizedValue, unit: fact.unit ?? null, valueType: fact.valueType }),
    sourceLocator: fact.sourceLocator,
    extractionMethod: fact.extraction.method,
    extractionConfidence: fact.extraction.confidence,
    truthStatus: fact.truthStatus,
    verificationStatus: fact.verification?.status || null,
    verificationReference: fact.verification?.reference || null,
    verifiedAt: fact.verification?.verifiedAt || null,
    authorityClass: fact.authorityClass || null,
    authorityVerified: Boolean(fact.authorityVerified),
    capturedAt: canonicalIso(fact.capturedAt, 'fact.capturedAt'),
  };
}

function buildChainPayload(record) {
  return {
    schemaVersion: record.schemaVersion,
    recordId: record.recordId,
    caseId: record.caseId,
    factProjection: record.factProjection,
    sourceRole: record.sourceRole,
    sourceReference: record.sourceReference,
    evidenceLink: record.evidenceLink,
    extractor: record.extractor,
    capturedByRef: record.capturedByRef,
    sensitivityClass: record.sensitivityClass,
    createdAt: record.createdAt,
  };
}

function createProfessionalEvidenceChainRecord({
  recordId,
  fact,
  sourceRole,
  sourceReference,
  evidenceLink,
  extractor,
  capturedByRef,
  sensitivityClass = EVIDENCE_SENSITIVITY_CLASS.MATERIAL,
  createdAt,
}) {
  assertNonEmpty(recordId, 'recordId');
  assertEnum(sourceRole, EVIDENCE_SOURCE_ROLE, 'sourceRole');
  assertNonEmpty(sourceReference, 'sourceReference');
  assertNonEmpty(evidenceLink, 'evidenceLink');
  assertNonEmpty(capturedByRef, 'capturedByRef');
  assertEnum(sensitivityClass, EVIDENCE_SENSITIVITY_CLASS, 'sensitivityClass');
  if (!extractor || typeof extractor !== 'object') throw new TypeError('extractor is required');
  assertEnum(extractor.type, EXTRACTOR_TYPE, 'extractor.type');
  assertNonEmpty(extractor.name, 'extractor.name');
  assertNonEmpty(extractor.version, 'extractor.version');

  const factProjection = projectFactForChain(fact);
  const canonicalCreatedAt = canonicalIso(createdAt || factProjection.capturedAt, 'createdAt');
  if (Date.parse(canonicalCreatedAt) < Date.parse(factProjection.capturedAt)) {
    throw new TypeError('EVIDENCE_CHAIN_TIMELINE_INVALID: chain record cannot predate fact capture');
  }

  const record = {
    schemaVersion: 1,
    recordId: recordId.trim(),
    caseId: factProjection.caseId,
    fact,
    factProjection,
    sourceRole,
    sourceReference: sourceReference.trim(),
    evidenceLink: evidenceLink.trim(),
    extractor: {
      type: extractor.type,
      name: extractor.name.trim(),
      version: extractor.version.trim(),
    },
    capturedByRef: capturedByRef.trim(),
    sensitivityClass,
    createdAt: canonicalCreatedAt,
    professionalReview: null,
    transactionAuthorized: false,
    certifiedValuationEstablished: false,
  };
  record.chainHashSha256 = sha256(buildChainPayload(record));
  return deepFreeze(record);
}

function validateProfessionalEvidenceChainIntegrity(record) {
  if (!record || typeof record !== 'object') return false;
  if (!isNonEmpty(record.chainHashSha256) || !/^[a-f0-9]{64}$/i.test(record.chainHashSha256)) return false;
  try {
    return sha256(buildChainPayload(record)) === record.chainHashSha256.toLowerCase();
  } catch (_) {
    return false;
  }
}

function recordProfessionalEvidenceReview({ record, review }) {
  if (!validateProfessionalEvidenceChainIntegrity(record)) throw new TypeError('EVIDENCE_CHAIN_INTEGRITY_FAILED');
  if (!review || typeof review !== 'object') throw new TypeError('review is required');
  assertNonEmpty(review.reviewId, 'review.reviewId');
  assertNonEmpty(review.reviewedByRef, 'review.reviewedByRef');
  assertNonEmpty(review.reviewEvidenceRef, 'review.reviewEvidenceRef');
  assertEnum(review.outcome, PROFESSIONAL_REVIEW_OUTCOME, 'review.outcome');
  const reviewedAt = canonicalIso(review.reviewedAt, 'review.reviewedAt');
  if (Date.parse(reviewedAt) < Date.parse(record.createdAt)) {
    throw new TypeError('EVIDENCE_REVIEW_TIMELINE_INVALID');
  }
  const acknowledgements = review.acknowledgements || {};
  const required = ['sourceViewed', 'locatorChecked', 'semanticMappingChecked', 'documentHashChecked', 'accountabilityAccepted'];
  if (!required.every((key) => acknowledgements[key] === true)) {
    throw new TypeError('EVIDENCE_REVIEW_ACKNOWLEDGEMENTS_INCOMPLETE');
  }

  return deepFreeze({
    ...record,
    professionalReview: {
      reviewId: review.reviewId.trim(),
      outcome: review.outcome,
      reviewedByRef: review.reviewedByRef.trim(),
      reviewEvidenceRef: review.reviewEvidenceRef.trim(),
      reviewedAt,
      acknowledgements: Object.freeze(Object.fromEntries(required.map((key) => [key, true]))),
    },
  });
}

function assessProfessionalEvidenceAdmissibility({ record, target = ADMISSIBILITY_TARGET.ANALYSIS_ONLY } = {}) {
  assertEnum(target, ADMISSIBILITY_TARGET, 'target');
  const reasons = [];
  if (!validateProfessionalEvidenceChainIntegrity(record)) {
    return deepFreeze({
      schemaVersion: 1,
      status: ADMISSIBILITY_STATUS.HOLD_INTEGRITY,
      reasons: ['EVIDENCE_CHAIN_INTEGRITY_FAILED'],
      readyForProfessionalUse: false,
      eligibleForEngine: false,
      transactionAuthorized: false,
      certifiedValuationEstablished: false,
    });
  }

  if (record.professionalReview?.outcome === PROFESSIONAL_REVIEW_OUTCOME.REJECTED) {
    return deepFreeze({
      schemaVersion: 1,
      status: ADMISSIBILITY_STATUS.REJECTED,
      reasons: ['EVIDENCE_REJECTED_BY_HUMAN_REVIEW'],
      readyForProfessionalUse: false,
      eligibleForEngine: false,
      transactionAuthorized: false,
      certifiedValuationEstablished: false,
    });
  }

  const fact = record.fact;
  const verifiedFact = fact?.truthStatus === TRUTH_STATUS.VERIFIED_FACT
    && fact?.verification?.status === VERIFICATION_STATUS.VERIFIED;
  const humanApproved = record.professionalReview?.outcome === PROFESSIONAL_REVIEW_OUTCOME.APPROVED;
  const requiresVerifiedFact = target !== ADMISSIBILITY_TARGET.ANALYSIS_ONLY;
  const requiresHumanApproval = requiresVerifiedFact
    && record.sensitivityClass !== EVIDENCE_SENSITIVITY_CLASS.ROUTINE;

  if (requiresVerifiedFact && !verifiedFact) reasons.push('VERIFIED_FACT_REQUIRED');
  if (requiresHumanApproval && !humanApproved) reasons.push('PROFESSIONAL_HUMAN_REVIEW_REQUIRED');
  if (requiresVerifiedFact
      && record.sensitivityClass === EVIDENCE_SENSITIVITY_CLASS.CRITICAL
      && fact?.authorityVerified !== true) {
    reasons.push('CRITICAL_EVIDENCE_AUTHORITY_VERIFICATION_REQUIRED');
  }

  if (reasons.length) {
    return deepFreeze({
      schemaVersion: 1,
      status: ADMISSIBILITY_STATUS.HOLD_EVIDENCE,
      reasons,
      readyForProfessionalUse: false,
      eligibleForEngine: false,
      transactionAuthorized: false,
      certifiedValuationEstablished: false,
    });
  }

  if (target === ADMISSIBILITY_TARGET.ANALYSIS_ONLY && !verifiedFact) {
    return deepFreeze({
      schemaVersion: 1,
      status: ADMISSIBILITY_STATUS.READY_WITH_LIMITATIONS,
      reasons: ['EXTRACTED_EVIDENCE_ONLY_NOT_VERIFIED_FACT'],
      readyForProfessionalUse: true,
      eligibleForEngine: false,
      transactionAuthorized: false,
      certifiedValuationEstablished: false,
      semantics: 'Evidence may be displayed or analysed with limitations, but cannot be adopted as a professional report fact or financial-engine input until its target-specific gates are satisfied.',
    });
  }

  return deepFreeze({
    schemaVersion: 1,
    status: ADMISSIBILITY_STATUS.READY,
    reasons: [],
    readyForProfessionalUse: true,
    eligibleForEngine: target === ADMISSIBILITY_TARGET.ENGINE_INPUT,
    transactionAuthorized: false,
    certifiedValuationEstablished: false,
    semantics: 'Admissibility means this evidence record passed chain-integrity and target-specific verification/review gates. It does not establish legal validity, certified valuation authority, or transaction authorization.',
  });
}

module.exports = {
  EVIDENCE_SOURCE_ROLE,
  EVIDENCE_SENSITIVITY_CLASS,
  EXTRACTOR_TYPE,
  PROFESSIONAL_REVIEW_OUTCOME,
  ADMISSIBILITY_TARGET,
  ADMISSIBILITY_STATUS,
  createProfessionalEvidenceChainRecord,
  validateProfessionalEvidenceChainIntegrity,
  recordProfessionalEvidenceReview,
  assessProfessionalEvidenceAdmissibility,
};
