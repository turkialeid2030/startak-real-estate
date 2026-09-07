'use strict';

const STANDARD_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  FUTURE: 'FUTURE',
  DRAFT: 'DRAFT',
  SUPERSEDED: 'SUPERSEDED',
  RETIRED: 'RETIRED',
  SUSPENDED: 'SUSPENDED',
  UNDER_REVIEW: 'UNDER_REVIEW',
});

const AUTHORITY_LEVEL = Object.freeze({
  SAUDI_LAW_OR_REGULATION: 'SAUDI_LAW_OR_REGULATION',
  SAUDI_MANDATORY_PROFESSIONAL: 'SAUDI_MANDATORY_PROFESSIONAL',
  SECTOR_REGULATOR: 'SECTOR_REGULATOR',
  FINANCIAL_REPORTING_FRAMEWORK: 'FINANCIAL_REPORTING_FRAMEWORK',
  INTERNATIONAL_VALUATION_STANDARD: 'INTERNATIONAL_VALUATION_STANDARD',
  PROFESSIONAL_BEST_PRACTICE: 'PROFESSIONAL_BEST_PRACTICE',
  INTERNAL_GOVERNANCE_POLICY: 'INTERNAL_GOVERNANCE_POLICY',
});

const ENFORCEMENT_CLASS = Object.freeze({
  BLOCKING: 'BLOCKING',
  REQUIRED_DISCLOSURE: 'REQUIRED_DISCLOSURE',
  REQUIRED_REVIEW: 'REQUIRED_REVIEW',
  CALCULATION_RULE: 'CALCULATION_RULE',
  REPORTING_RULE: 'REPORTING_RULE',
  GUIDANCE_ONLY: 'GUIDANCE_ONLY',
  FUTURE_READINESS_ONLY: 'FUTURE_READINESS_ONLY',
});

const APPLICABILITY_DATE_BASIS = Object.freeze({
  VALUATION_DATE: 'VALUATION_DATE',
  REPORT_DATE: 'REPORT_DATE',
  ENGAGEMENT_DATE: 'ENGAGEMENT_DATE',
  TRANSACTION_DATE: 'TRANSACTION_DATE',
  FINANCING_DECISION_DATE: 'FINANCING_DECISION_DATE',
  OTHER_REVIEW_REQUIRED: 'OTHER_REVIEW_REQUIRED',
});

const REVIEW_STATUS = Object.freeze({
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  NOT_REQUIRED: 'NOT_REQUIRED',
  REJECTED: 'REJECTED',
});

const CONFLICT_STATE = Object.freeze({
  NO_CONFLICT: 'NO_CONFLICT',
  INTERPRETATION_REQUIRED: 'INTERPRETATION_REQUIRED',
  CONFLICT_RESOLVED_BY_RULE: 'CONFLICT_RESOLVED_BY_RULE',
  LEGAL_OR_PROFESSIONAL_REVIEW_REQUIRED: 'LEGAL_OR_PROFESSIONAL_REVIEW_REQUIRED',
});

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function assertNonEmptyString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${field} must be a non-empty string`);
  }
}

function assertEnum(value, allowed, field) {
  if (!Object.values(allowed).includes(value)) {
    throw new TypeError(`${field} must be one of: ${Object.values(allowed).join(', ')}`);
  }
}

function isStrictIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function assertOptionalIsoDate(value, field) {
  if (value === null || value === undefined || value === '') return;
  if (!isStrictIsoDate(value)) {
    throw new TypeError(`${field} must be a real ISO date YYYY-MM-DD or null`);
  }
}

function assertStringArray(value, field) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || item.trim() === '')) {
    throw new TypeError(`${field} must be an array of non-empty strings`);
  }
}

function assertPlainObject(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${field} must be an object`);
  }
}

function normalizeStandardRecord(input) {
  assertPlainObject(input, 'standard');
  for (const field of ['standardId', 'titleAr', 'titleEn', 'issuer', 'jurisdiction', 'category', 'version', 'sourceUrl', 'ruleVersionHash']) {
    assertNonEmptyString(input[field], `standard.${field}`);
  }
  assertEnum(input.status, STANDARD_STATUS, 'standard.status');
  assertEnum(input.authorityLevel, AUTHORITY_LEVEL, 'standard.authorityLevel');
  if (typeof input.officialSource !== 'boolean') throw new TypeError('standard.officialSource must be boolean');
  assertOptionalIsoDate(input.publicationDate, 'standard.publicationDate');
  assertOptionalIsoDate(input.effectiveDate, 'standard.effectiveDate');
  assertOptionalIsoDate(input.expiryDate, 'standard.expiryDate');
  assertOptionalIsoDate(input.lastVerifiedAt, 'standard.lastVerifiedAt');
  assertOptionalIsoDate(input.nextReviewAt, 'standard.nextReviewAt');
  assertStringArray(input.supersedesStandardIds || [], 'standard.supersedesStandardIds');
  assertStringArray(input.supersededByStandardIds || [], 'standard.supersededByStandardIds');
  assertStringArray(input.applicableAssetTypes || [], 'standard.applicableAssetTypes');
  assertStringArray(input.applicablePurposes || [], 'standard.applicablePurposes');
  assertEnum(input.professionalReviewStatus || REVIEW_STATUS.PENDING, REVIEW_STATUS, 'standard.professionalReviewStatus');
  assertEnum(input.legalReviewStatus || REVIEW_STATUS.PENDING, REVIEW_STATUS, 'standard.legalReviewStatus');

  return deepFreeze({
    schemaVersion: 1,
    ...input,
    supersedesStandardIds: [...(input.supersedesStandardIds || [])],
    supersededByStandardIds: [...(input.supersededByStandardIds || [])],
    applicableAssetTypes: [...(input.applicableAssetTypes || [])],
    applicablePurposes: [...(input.applicablePurposes || [])],
    professionalReviewStatus: input.professionalReviewStatus || REVIEW_STATUS.PENDING,
    legalReviewStatus: input.legalReviewStatus || REVIEW_STATUS.PENDING,
  });
}

function normalizeStandardRule(input) {
  assertPlainObject(input, 'rule');
  for (const field of ['ruleId', 'standardId', 'provisionReference', 'ruleTitle', 'ruleType', 'jurisdiction', 'severity', 'implementationVersion']) {
    assertNonEmptyString(input[field], `rule.${field}`);
  }
  assertEnum(input.authorityLevel, AUTHORITY_LEVEL, 'rule.authorityLevel');
  assertEnum(input.enforcementClass, ENFORCEMENT_CLASS, 'rule.enforcementClass');
  assertEnum(input.applicabilityDateBasis, APPLICABILITY_DATE_BASIS, 'rule.applicabilityDateBasis');
  assertEnum(input.reviewStatus || REVIEW_STATUS.PENDING, REVIEW_STATUS, 'rule.reviewStatus');
  assertStringArray(input.purposeScope || [], 'rule.purposeScope');
  assertStringArray(input.assetScope || [], 'rule.assetScope');
  assertStringArray(input.regulatedEntityScope || [], 'rule.regulatedEntityScope');
  assertStringArray(input.transactionScope || [], 'rule.transactionScope');
  assertStringArray(input.financingScope || [], 'rule.financingScope');
  assertStringArray(input.requiredInputs || [], 'rule.requiredInputs');
  assertStringArray(input.testIds || [], 'rule.testIds');
  assertStringArray(input.evidenceIds || [], 'rule.evidenceIds');
  assertPlainObject(input.appliesWhen || {}, 'rule.appliesWhen');
  assertPlainObject(input.excludesWhen || {}, 'rule.excludesWhen');
  assertOptionalIsoDate(input.effectiveFrom, 'rule.effectiveFrom');
  assertOptionalIsoDate(input.effectiveTo, 'rule.effectiveTo');

  return deepFreeze({
    schemaVersion: 1,
    ...input,
    purposeScope: [...(input.purposeScope || [])],
    assetScope: [...(input.assetScope || [])],
    regulatedEntityScope: [...(input.regulatedEntityScope || [])],
    transactionScope: [...(input.transactionScope || [])],
    financingScope: [...(input.financingScope || [])],
    requiredInputs: [...(input.requiredInputs || [])],
    testIds: [...(input.testIds || [])],
    evidenceIds: [...(input.evidenceIds || [])],
    appliesWhen: { ...(input.appliesWhen || {}) },
    excludesWhen: { ...(input.excludesWhen || {}) },
    reviewStatus: input.reviewStatus || REVIEW_STATUS.PENDING,
    activationApprovalId: input.activationApprovalId || null,
  });
}

function isReviewApprovedOrNotRequired(status) {
  return status === REVIEW_STATUS.APPROVED || status === REVIEW_STATUS.NOT_REQUIRED;
}

function evaluateProductionEnforcementEligibility(standard, rule) {
  const reasons = [];
  if (!standard || !rule || standard.standardId !== rule.standardId) reasons.push('STANDARD_RULE_LINK_INVALID');
  if (standard?.status !== STANDARD_STATUS.ACTIVE) reasons.push(`STANDARD_STATUS_${standard?.status || 'MISSING'}_NON_ENFORCING`);
  if (standard?.officialSource !== true) reasons.push('STANDARD_SOURCE_UNVERIFIED');
  if (!standard?.lastVerifiedAt) reasons.push('STANDARD_VERIFICATION_MISSING');
  if (!isReviewApprovedOrNotRequired(standard?.professionalReviewStatus)) reasons.push('STANDARD_PROFESSIONAL_REVIEW_UNAPPROVED');
  if (!isReviewApprovedOrNotRequired(standard?.legalReviewStatus)) reasons.push('STANDARD_LEGAL_REVIEW_UNAPPROVED');
  if (rule?.reviewStatus !== REVIEW_STATUS.APPROVED) reasons.push('STANDARD_RULE_UNAPPROVED');
  if (typeof rule?.activationApprovalId !== 'string' || rule.activationApprovalId.trim() === '') reasons.push('STANDARD_RULE_ACTIVATION_UNAPPROVED');
  if (rule?.enforcementClass === ENFORCEMENT_CLASS.FUTURE_READINESS_ONLY) reasons.push('FUTURE_READINESS_ONLY_NON_ENFORCING');

  return deepFreeze({
    eligible: reasons.length === 0,
    reasons,
  });
}

module.exports = {
  STANDARD_STATUS,
  AUTHORITY_LEVEL,
  ENFORCEMENT_CLASS,
  APPLICABILITY_DATE_BASIS,
  REVIEW_STATUS,
  CONFLICT_STATE,
  deepFreeze,
  isStrictIsoDate,
  normalizeStandardRecord,
  normalizeStandardRule,
  evaluateProductionEnforcementEligibility,
};