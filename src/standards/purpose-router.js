'use strict';

const {
  APPLICABILITY_DATE_BASIS,
  CONFLICT_STATE,
  STANDARD_STATUS,
  deepFreeze,
  normalizeStandardRecord,
  normalizeStandardRule,
  evaluateProductionEnforcementEligibility,
  isStrictIsoDate,
} = require('./contracts');
const { evaluateStandardFreshness } = require('./registry');

const ROUTER_VERSION = 'W7A_PURPOSE_ROUTER_V1';

const CONTEXT_DATE_FIELD = Object.freeze({
  [APPLICABILITY_DATE_BASIS.VALUATION_DATE]: 'valuationDate',
  [APPLICABILITY_DATE_BASIS.REPORT_DATE]: 'reportDate',
  [APPLICABILITY_DATE_BASIS.ENGAGEMENT_DATE]: 'engagementDate',
  [APPLICABILITY_DATE_BASIS.TRANSACTION_DATE]: 'transactionDate',
  [APPLICABILITY_DATE_BASIS.FINANCING_DECISION_DATE]: 'financingDecisionDate',
});

function normalizeScalar(value) {
  return typeof value === 'string' ? value.trim() : value;
}

function asArray(value) {
  return Array.isArray(value) ? value : [value];
}

function equalsExpected(actual, expected) {
  const actualValues = asArray(actual).map(normalizeScalar);
  const expectedValues = asArray(expected).map(normalizeScalar);
  return expectedValues.some((item) => actualValues.includes(item));
}

function matchesDeclarativeConditions(context, conditions) {
  return Object.entries(conditions || {}).every(([field, expected]) => {
    if (expected === undefined || expected === null) return true;
    return equalsExpected(context?.[field], expected);
  });
}

function scopeMatches(value, scope) {
  if (!Array.isArray(scope) || scope.length === 0) return true;
  if (Array.isArray(value)) return value.some((item) => scope.includes(item));
  return scope.includes(value);
}

function ruleScopeMatches(context, rule) {
  if (rule.jurisdiction !== '*' && context.jurisdiction !== rule.jurisdiction) return false;
  if (!scopeMatches(context.valuationPurpose, rule.purposeScope)) return false;
  if (!scopeMatches(context.assetType, rule.assetScope)) return false;
  if (!scopeMatches(context.regulatedEntityStatus, rule.regulatedEntityScope)) return false;
  if (!scopeMatches(context.transactionContext, rule.transactionScope)) return false;
  if (!scopeMatches(context.financingContext, rule.financingScope)) return false;
  if (!matchesDeclarativeConditions(context, rule.appliesWhen)) return false;
  if (Object.keys(rule.excludesWhen || {}).length > 0 && matchesDeclarativeConditions(context, rule.excludesWhen)) return false;
  return true;
}

function parseIsoDate(value) {
  if (!isStrictIsoDate(value)) return null;
  return new Date(`${value}T00:00:00Z`).getTime();
}

function evaluateRuleTemporalApplicability(context, rule) {
  if (rule.applicabilityDateBasis === APPLICABILITY_DATE_BASIS.OTHER_REVIEW_REQUIRED) {
    return deepFreeze({ applicable: false, reviewRequired: true, reason: 'APPLICABILITY_DATE_REVIEW_REQUIRED' });
  }

  const dateField = CONTEXT_DATE_FIELD[rule.applicabilityDateBasis];
  const contextMs = parseIsoDate(context?.[dateField]);
  if (contextMs === null) {
    return deepFreeze({ applicable: false, reviewRequired: true, reason: `APPLICABILITY_DATE_MISSING:${dateField}` });
  }

  const fromMs = rule.effectiveFrom ? parseIsoDate(rule.effectiveFrom) : null;
  const toMs = rule.effectiveTo ? parseIsoDate(rule.effectiveTo) : null;
  if (rule.effectiveFrom && fromMs === null) return deepFreeze({ applicable: false, reviewRequired: true, reason: 'RULE_EFFECTIVE_FROM_INVALID' });
  if (rule.effectiveTo && toMs === null) return deepFreeze({ applicable: false, reviewRequired: true, reason: 'RULE_EFFECTIVE_TO_INVALID' });
  if (fromMs !== null && contextMs < fromMs) return deepFreeze({ applicable: false, reviewRequired: false, reason: 'RULE_NOT_YET_EFFECTIVE' });
  if (toMs !== null && contextMs > toMs) return deepFreeze({ applicable: false, reviewRequired: false, reason: 'RULE_NO_LONGER_EFFECTIVE' });

  return deepFreeze({ applicable: true, reviewRequired: false, reason: null });
}

function normalizeConflictRecord(input) {
  const state = Object.values(CONFLICT_STATE).includes(input?.state)
    ? input.state
    : CONFLICT_STATE.LEGAL_OR_PROFESSIONAL_REVIEW_REQUIRED;
  return deepFreeze({
    conflictId: input?.conflictId || null,
    ruleIds: Object.freeze([...(input?.ruleIds || [])]),
    subject: input?.subject || 'UNSPECIFIED',
    state,
    resolutionRuleId: input?.resolutionRuleId || null,
    rationale: input?.rationale || null,
    reviewer: input?.reviewer || null,
    evidenceRefs: Object.freeze([...(input?.evidenceRefs || [])]),
  });
}

function resolveStandardsVerificationAsOfDate(context) {
  const candidate = context?.standardsVerificationAsOfDate || context?.reportDate || context?.valuationDate;
  return isStrictIsoDate(candidate) ? candidate : null;
}

function routeStandards({ context, standards = [], rules = [], conflicts = [], routerInputHash = null } = {}) {
  if (!context || typeof context !== 'object') throw new TypeError('context is required');
  if (!Array.isArray(standards) || !Array.isArray(rules) || !Array.isArray(conflicts)) {
    throw new TypeError('standards, rules, and conflicts must be arrays');
  }

  const normalizedStandards = standards.map(normalizeStandardRecord);
  const normalizedRules = rules.map(normalizeStandardRule);
  const standardById = new Map(normalizedStandards.map((standard) => [standard.standardId, standard]));
  const applicableRuleIds = [];
  const applicableStandardIds = new Set();
  const excludedRules = [];
  const blockers = new Set();
  const requiredReviews = new Set();
  const standardsAsOfDate = resolveStandardsVerificationAsOfDate(context);

  for (const rule of normalizedRules) {
    if (!ruleScopeMatches(context, rule)) {
      excludedRules.push({ ruleId: rule.ruleId, reason: 'SCOPE_NOT_MATCHED' });
      continue;
    }

    const standard = standardById.get(rule.standardId);
    if (!standard) {
      excludedRules.push({ ruleId: rule.ruleId, reason: 'STANDARD_NOT_FOUND' });
      blockers.add('STANDARD_SOURCE_UNVERIFIED');
      continue;
    }

    // DRAFT/FUTURE/UNDER_REVIEW/etc. remain bibliographic/future-readiness inputs.
    // Neither the current date nor an AI process may promote them into production enforcement.
    if (standard.status !== STANDARD_STATUS.ACTIVE) {
      excludedRules.push({ ruleId: rule.ruleId, reason: `STANDARD_${standard.status}_NON_ENFORCING` });
      continue;
    }

    const enforcement = evaluateProductionEnforcementEligibility(standard, rule);
    if (!enforcement.eligible) {
      excludedRules.push({ ruleId: rule.ruleId, reason: enforcement.reasons.join('|') });
      if (enforcement.reasons.some((reason) => reason.includes('UNAPPROVED'))) blockers.add('STANDARD_RULE_UNAPPROVED');
      if (enforcement.reasons.includes('STANDARD_SOURCE_UNVERIFIED')) blockers.add('STANDARD_SOURCE_UNVERIFIED');
      continue;
    }

    if (!standardsAsOfDate) {
      excludedRules.push({ ruleId: rule.ruleId, reason: 'STANDARD_VERIFICATION_AS_OF_DATE_MISSING' });
      blockers.add('STANDARD_VERIFICATION_STALE');
      requiredReviews.add('STANDARDS_SOURCE_VERIFICATION_REVIEW');
      continue;
    }

    const freshness = evaluateStandardFreshness(standard, standardsAsOfDate);
    if (!freshness.fresh) {
      excludedRules.push({ ruleId: rule.ruleId, reason: freshness.reasons.join('|') });
      blockers.add('STANDARD_VERIFICATION_STALE');
      requiredReviews.add('STANDARDS_SOURCE_VERIFICATION_REVIEW');
      continue;
    }

    const temporal = evaluateRuleTemporalApplicability(context, rule);
    if (!temporal.applicable) {
      excludedRules.push({ ruleId: rule.ruleId, reason: temporal.reason });
      if (temporal.reviewRequired) {
        requiredReviews.add('STANDARDS_APPLICABILITY_REVIEW');
        blockers.add('STANDARD_RULESET_CONFLICT');
      }
      continue;
    }

    applicableRuleIds.push(rule.ruleId);
    applicableStandardIds.add(rule.standardId);
  }

  const normalizedConflicts = conflicts.map(normalizeConflictRecord);
  for (const conflict of normalizedConflicts) {
    if (conflict.state === CONFLICT_STATE.INTERPRETATION_REQUIRED
      || conflict.state === CONFLICT_STATE.LEGAL_OR_PROFESSIONAL_REVIEW_REQUIRED) {
      blockers.add('STANDARD_RULESET_CONFLICT');
      requiredReviews.add('LEGAL_OR_PROFESSIONAL_STANDARDS_REVIEW');
    }
  }

  const result = {
    schemaVersion: 1,
    routerVersion: ROUTER_VERSION,
    routerInputHash,
    standardsVerificationAsOfDate: standardsAsOfDate,
    productionIntegration: 'NON_ENFORCING_LIBRARY_ONLY',
    applicableStandardIds: [...applicableStandardIds].sort(),
    applicableRuleIds: [...applicableRuleIds].sort(),
    excludedRuleIds: excludedRules.map((entry) => entry.ruleId),
    excludedRules,
    conflictRecords: normalizedConflicts,
    requiredReviews: [...requiredReviews].sort(),
    blockingCodes: [...blockers].sort(),
    transactionAuthorized: false,
  };

  return deepFreeze(result);
}

module.exports = {
  ROUTER_VERSION,
  CONTEXT_DATE_FIELD,
  matchesDeclarativeConditions,
  ruleScopeMatches,
  evaluateRuleTemporalApplicability,
  resolveStandardsVerificationAsOfDate,
  routeStandards,
};