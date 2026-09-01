'use strict';

const REGULATORY_CLASSIFICATION = Object.freeze({
  DECISION_SUPPORT_ONLY: 'DECISION_SUPPORT_ONLY',
  REGULATED_REAL_ESTATE_CONSULTATION_ANALYSIS: 'REGULATED_REAL_ESTATE_CONSULTATION_ANALYSIS',
  LICENSE_OR_AUTHORIZATION_REQUIRED: 'LICENSE_OR_AUTHORIZATION_REQUIRED',
  OTHER_RESOLVED_SCOPE: 'OTHER_RESOLVED_SCOPE',
});

const AUTHORIZED_REVIEWER_TYPE = Object.freeze({
  LEGAL_COUNSEL: 'LEGAL_COUNSEL',
  AUTHORIZED_REGULATORY_REVIEWER: 'AUTHORIZED_REGULATORY_REVIEWER',
});

const REGULATORY_CLOSURE_STATUS = Object.freeze({
  EVIDENCE_PACK_COMPLETE: 'EVIDENCE_PACK_COMPLETE',
  HOLD_SCOPE: 'HOLD_SCOPE',
  HOLD_REVIEW: 'HOLD_REVIEW',
  HOLD_CLASSIFICATION: 'HOLD_CLASSIFICATION',
  HOLD_AUTHORIZATION: 'HOLD_AUTHORIZATION',
  HOLD_SOURCE_EVIDENCE: 'HOLD_SOURCE_EVIDENCE',
  HOLD_SOURCE_FRESHNESS: 'HOLD_SOURCE_FRESHNESS',
  HOLD_OPERATING_BOUNDARIES: 'HOLD_OPERATING_BOUNDARIES',
  HOLD_EVIDENCE_REFS: 'HOLD_EVIDENCE_REFS',
});

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isIsoDate(value) {
  return nonEmptyString(value) && Number.isFinite(Date.parse(value));
}

function allTrue(obj, keys) {
  return keys.every((key) => obj && obj[key] === true);
}

function cleanRefs(refs) {
  return Array.isArray(refs) ? refs.filter(nonEmptyString).map((ref) => ref.trim()) : [];
}

function hold(status, reasons, context = {}) {
  return {
    caseId: context.caseId || null,
    projectId: context.projectId || null,
    status,
    reasons,
    readyForProductionReadinessAudit: false,
    classificationReviewCompleted: false,
    regulatedScopeResolved: false,
    legalCounselOrAuthorizedReviewerCompleted: false,
    softwareDoesNotSelfEstablishLegalApproval: true,
    legalApprovalEstablished: false,
    productionDeploymentAuthorized: false,
    humanApprovalRequired: true,
    transactionAuthorized: false,
  };
}

function validateSource(source, asOfDate, index) {
  if (!source || typeof source !== 'object') {
    return { status: REGULATORY_CLOSURE_STATUS.HOLD_SOURCE_EVIDENCE, reason: `sources[${index}] must be an object` };
  }
  const complete =
    nonEmptyString(source.authority) &&
    nonEmptyString(source.sourceRef) &&
    nonEmptyString(source.versionHash) &&
    isIsoDate(source.lastVerifiedDate) &&
    isIsoDate(source.reviewAfterDate);
  if (!complete) {
    return { status: REGULATORY_CLOSURE_STATUS.HOLD_SOURCE_EVIDENCE, reason: `sources[${index}] authority/sourceRef/versionHash/verification dates required` };
  }
  if (Date.parse(source.lastVerifiedDate) > Date.parse(asOfDate) || Date.parse(source.reviewAfterDate) < Date.parse(asOfDate)) {
    return { status: REGULATORY_CLOSURE_STATUS.HOLD_SOURCE_FRESHNESS, reason: `sources[${index}] is future-verified or outside review window` };
  }
  return null;
}

function buildRegulatoryClosureEvidence({
  caseId,
  projectId,
  jurisdiction,
  asOfDate,
  classificationReview,
  sources,
  evidenceRefs = [],
}) {
  const context = { caseId, projectId };
  if (!nonEmptyString(caseId) || !nonEmptyString(projectId) || !nonEmptyString(jurisdiction) || !isIsoDate(asOfDate)) {
    return hold(REGULATORY_CLOSURE_STATUS.HOLD_SCOPE, ['caseId, projectId, jurisdiction, and valid asOfDate are required'], context);
  }

  const reviewValid =
    classificationReview?.completed === true &&
    Object.values(AUTHORIZED_REVIEWER_TYPE).includes(classificationReview?.reviewerType) &&
    nonEmptyString(classificationReview?.reviewerRef) &&
    nonEmptyString(classificationReview?.reviewRef) &&
    isIsoDate(classificationReview?.reviewedAt) &&
    Date.parse(classificationReview.reviewedAt) <= Date.parse(asOfDate);
  if (!reviewValid) {
    return hold(REGULATORY_CLOSURE_STATUS.HOLD_REVIEW, ['authorized legal/regulatory classification review evidence is required'], context);
  }

  const classificationValid =
    Object.values(REGULATORY_CLASSIFICATION).includes(classificationReview?.classification) &&
    classificationReview?.regulatedScopeResolved === true &&
    classificationReview?.licensingRequirementResolved === true;
  if (!classificationValid) {
    return hold(REGULATORY_CLOSURE_STATUS.HOLD_CLASSIFICATION, ['operating classification and licensing requirement must be explicitly resolved by the reviewer'], context);
  }

  const authorizationRequired =
    classificationReview.classification === REGULATORY_CLASSIFICATION.LICENSE_OR_AUTHORIZATION_REQUIRED ||
    classificationReview.classification === REGULATORY_CLASSIFICATION.REGULATED_REAL_ESTATE_CONSULTATION_ANALYSIS;
  if (authorizationRequired && !(classificationReview?.requiredAuthorizationSatisfied === true && nonEmptyString(classificationReview?.authorizationEvidenceRef))) {
    return hold(REGULATORY_CLOSURE_STATUS.HOLD_AUTHORIZATION, ['reviewer classified the scope as regulated/authorization-dependent but authorization evidence is incomplete'], context);
  }

  if (!Array.isArray(sources) || sources.length === 0) {
    return hold(REGULATORY_CLOSURE_STATUS.HOLD_SOURCE_EVIDENCE, ['at least one authoritative source reference is required'], context);
  }
  for (const [index, source] of sources.entries()) {
    const failure = validateSource(source, asOfDate, index);
    if (failure) return hold(failure.status, [failure.reason], context);
  }

  const operatingBoundariesValid = allTrue(classificationReview, [
    'permittedOperatingScopeDefined',
    'prohibitedClaimsDefined',
    'privacyRegulatoryReviewCompleted',
    'termsAndDisclosureReviewCompleted',
    'humanProfessionalBoundaryDefined',
    'softwareDoesNotSelfEstablishLegalApproval',
  ]) &&
    Array.isArray(classificationReview?.permittedUses) && classificationReview.permittedUses.filter(nonEmptyString).length > 0 &&
    Array.isArray(classificationReview?.prohibitedUses) && classificationReview.prohibitedUses.filter(nonEmptyString).length > 0;
  if (!operatingBoundariesValid) {
    return hold(REGULATORY_CLOSURE_STATUS.HOLD_OPERATING_BOUNDARIES, ['permitted/prohibited use, privacy, disclosure, and professional-review boundaries are incomplete'], context);
  }

  const requiredRefs = [
    classificationReview.reviewerRef,
    classificationReview.reviewRef,
    ...sources.map((source) => source.sourceRef),
  ];
  if (authorizationRequired) requiredRefs.push(classificationReview.authorizationEvidenceRef);
  const refs = cleanRefs(evidenceRefs);
  const normalizedRequired = requiredRefs.map((ref) => ref.trim());
  if (!normalizedRequired.every((ref) => refs.includes(ref))) {
    return hold(REGULATORY_CLOSURE_STATUS.HOLD_EVIDENCE_REFS, ['evidenceRefs must contain the complete reviewer, source, and authorization reference chain'], context);
  }

  return {
    caseId,
    projectId,
    status: REGULATORY_CLOSURE_STATUS.EVIDENCE_PACK_COMPLETE,
    reasons: [],
    jurisdiction: jurisdiction.trim(),
    asOfDate,
    classification: classificationReview.classification,
    reviewerType: classificationReview.reviewerType,
    reviewerRef: classificationReview.reviewerRef.trim(),
    reviewRef: classificationReview.reviewRef.trim(),
    reviewedAt: classificationReview.reviewedAt,
    authorizationRequired,
    authorizationEvidenceRef: authorizationRequired ? classificationReview.authorizationEvidenceRef.trim() : null,
    permittedUses: classificationReview.permittedUses.filter(nonEmptyString).map((value) => value.trim()),
    prohibitedUses: classificationReview.prohibitedUses.filter(nonEmptyString).map((value) => value.trim()),
    sources: sources.map((source) => ({
      authority: source.authority.trim(),
      sourceRef: source.sourceRef.trim(),
      versionHash: source.versionHash.trim(),
      effectiveDate: isIsoDate(source.effectiveDate) ? source.effectiveDate : null,
      lastVerifiedDate: source.lastVerifiedDate,
      reviewAfterDate: source.reviewAfterDate,
    })),
    evidenceRefs: refs,
    readyForProductionReadinessAudit: true,
    classificationReviewCompleted: true,
    regulatedScopeResolved: true,
    legalCounselOrAuthorizedReviewerCompleted: true,
    softwareDoesNotSelfEstablishLegalApproval: true,
    legalApprovalEstablished: false,
    productionDeploymentAuthorized: false,
    humanApprovalRequired: true,
    transactionAuthorized: false,
    semantics: 'EVIDENCE_PACK_COMPLETE records caller-supplied legal/regulatory classification evidence, source provenance, operating boundaries, and any required authorization evidence for human production-readiness review. STARTAK does not determine legal status, issue a license, provide legal advice, or establish legal approval by itself.',
  };
}

module.exports = {
  REGULATORY_CLASSIFICATION,
  AUTHORIZED_REVIEWER_TYPE,
  REGULATORY_CLOSURE_STATUS,
  buildRegulatoryClosureEvidence,
};
