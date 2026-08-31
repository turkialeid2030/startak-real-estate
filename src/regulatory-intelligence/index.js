'use strict';

const REGULATORY_RULE_STATUS = Object.freeze({
  CURRENT: 'CURRENT',
  SUPERSEDED: 'SUPERSEDED',
  UNDER_REVIEW: 'UNDER_REVIEW',
  UNKNOWN: 'UNKNOWN',
});

const REGULATORY_RESULT_STATUS = Object.freeze({
  PASS_INFORMATIONAL: 'PASS_INFORMATIONAL',
  REQUIREMENT_TRIGGERED: 'REQUIREMENT_TRIGGERED',
  REGULATORY_REVIEW_REQUIRED: 'REGULATORY_REVIEW_REQUIRED',
  HOLD_EVIDENCE: 'HOLD_EVIDENCE',
});

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) freeze(child);
  return value;
}

function requiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}

function createRegulatoryRule({
  ruleId,
  authority,
  regulationName,
  article = null,
  officialSource,
  effectiveDate = null,
  lastVerifiedDate,
  versionHash,
  reviewAfterDate,
  jurisdiction = 'SA',
  applicability = {},
  trigger,
  requirement,
  status = REGULATORY_RULE_STATUS.CURRENT,
  professionalReviewType = null,
}) {
  requiredString(ruleId, 'ruleId');
  requiredString(authority, 'authority');
  requiredString(regulationName, 'regulationName');
  requiredString(officialSource, 'officialSource');
  requiredString(lastVerifiedDate, 'lastVerifiedDate');
  requiredString(versionHash, 'versionHash');
  requiredString(reviewAfterDate, 'reviewAfterDate');
  requiredString(jurisdiction, 'jurisdiction');
  requiredString(trigger, 'trigger');
  requiredString(requirement, 'requirement');
  if (!Object.values(REGULATORY_RULE_STATUS).includes(status)) throw new TypeError(`invalid regulatory rule status: ${status}`);
  if (article !== null && typeof article !== 'string') throw new TypeError('article must be a string or null');
  if (effectiveDate !== null && typeof effectiveDate !== 'string') throw new TypeError('effectiveDate must be a string or null');
  if (!applicability || typeof applicability !== 'object' || Array.isArray(applicability)) throw new TypeError('applicability must be an object');
  if (professionalReviewType !== null && typeof professionalReviewType !== 'string') throw new TypeError('professionalReviewType must be a string or null');
  return freeze({ schemaVersion: 1, ruleId, authority, regulationName, article, officialSource, effectiveDate, lastVerifiedDate, versionHash, reviewAfterDate, jurisdiction, applicability: { ...applicability }, trigger, requirement, status, professionalReviewType });
}

function dateIsPast(dateString, asOfDate) {
  const date = Date.parse(dateString);
  const asOf = Date.parse(asOfDate);
  if (!Number.isFinite(date) || !Number.isFinite(asOf)) throw new TypeError('invalid ISO date');
  return date < asOf;
}

function matchesScalar(ruleValue, caseValue) {
  if (ruleValue === undefined || ruleValue === null) return true;
  if (Array.isArray(ruleValue)) return ruleValue.includes(caseValue);
  return ruleValue === caseValue;
}

function ruleApplies(rule, context) {
  const a = rule.applicability || {};
  for (const [key, expected] of Object.entries(a)) {
    if (!matchesScalar(expected, context[key])) return false;
  }
  return true;
}

function evaluateRegulatoryContext({ rules, context, asOfDate, evidence = {} }) {
  if (!Array.isArray(rules)) throw new TypeError('rules must be an array');
  if (!context || typeof context !== 'object') throw new TypeError('context must be an object');
  requiredString(asOfDate, 'asOfDate');
  const results = [];
  const blockers = [];

  for (const rule of rules) {
    if (!rule || !rule.ruleId) throw new TypeError('qualified regulatory rule required');
    if (!ruleApplies(rule, context)) continue;

    if (rule.status !== REGULATORY_RULE_STATUS.CURRENT || dateIsPast(rule.reviewAfterDate, asOfDate)) {
      const result = { ruleId: rule.ruleId, status: REGULATORY_RESULT_STATUS.REGULATORY_REVIEW_REQUIRED, reason: rule.status !== REGULATORY_RULE_STATUS.CURRENT ? `RULE_STATUS_${rule.status}` : 'RULE_FRESHNESS_EXPIRED', authority: rule.authority, officialSource: rule.officialSource, professionalReviewType: rule.professionalReviewType };
      results.push(result);
      blockers.push(result);
      continue;
    }

    const evidenceKey = `rule:${rule.ruleId}:satisfied`;
    const hasEvidence = Object.prototype.hasOwnProperty.call(evidence, evidenceKey);
    if (!hasEvidence) {
      const result = { ruleId: rule.ruleId, status: REGULATORY_RESULT_STATUS.HOLD_EVIDENCE, reason: 'REQUIREMENT_EVIDENCE_NOT_PROVIDED', requirement: rule.requirement, authority: rule.authority, officialSource: rule.officialSource, professionalReviewType: rule.professionalReviewType };
      results.push(result);
      blockers.push(result);
      continue;
    }

    const satisfied = evidence[evidenceKey] === true;
    const result = { ruleId: rule.ruleId, status: satisfied ? REGULATORY_RESULT_STATUS.PASS_INFORMATIONAL : REGULATORY_RESULT_STATUS.REQUIREMENT_TRIGGERED, requirement: rule.requirement, authority: rule.authority, officialSource: rule.officialSource, professionalReviewType: rule.professionalReviewType };
    results.push(result);
    if (!satisfied) blockers.push(result);
  }

  const reviewRequired = blockers.some((item) => item.status === REGULATORY_RESULT_STATUS.REGULATORY_REVIEW_REQUIRED);
  const evidenceHold = blockers.some((item) => item.status === REGULATORY_RESULT_STATUS.HOLD_EVIDENCE);
  const requirementTriggered = blockers.some((item) => item.status === REGULATORY_RESULT_STATUS.REQUIREMENT_TRIGGERED);
  const overallStatus = reviewRequired
    ? REGULATORY_RESULT_STATUS.REGULATORY_REVIEW_REQUIRED
    : evidenceHold
      ? REGULATORY_RESULT_STATUS.HOLD_EVIDENCE
      : requirementTriggered
        ? REGULATORY_RESULT_STATUS.REQUIREMENT_TRIGGERED
        : REGULATORY_RESULT_STATUS.PASS_INFORMATIONAL;

  return freeze({ schemaVersion: 1, overallStatus, asOfDate, matchedRuleCount: results.length, results, blockers, semantics: 'Regulatory Intelligence identifies potentially applicable requirements and evidence gaps. PASS_INFORMATIONAL does not constitute legal compliance certification or legal advice.' });
}

module.exports = { REGULATORY_RULE_STATUS, REGULATORY_RESULT_STATUS, createRegulatoryRule, ruleApplies, evaluateRegulatoryContext };
