'use strict';

const {
  STANDARD_STATUS,
  deepFreeze,
  normalizeStandardRecord,
  normalizeStandardRule,
} = require('./contracts');

const REGISTRY_VERSION = 'W7A_STANDARDS_REGISTRY_V1';

function parseIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  if (date.toISOString().slice(0, 10) !== value) return null;
  return date.getTime();
}

function evaluateStandardFreshness(standard, asOfDate) {
  const normalized = normalizeStandardRecord(standard);
  const asOf = parseIsoDate(asOfDate);
  if (asOf === null) throw new TypeError('asOfDate must be an ISO date YYYY-MM-DD');

  const lastVerified = normalized.lastVerifiedAt ? parseIsoDate(normalized.lastVerifiedAt) : null;
  const nextReview = normalized.nextReviewAt ? parseIsoDate(normalized.nextReviewAt) : null;
  const reasons = [];

  if (lastVerified === null) reasons.push('STANDARD_VERIFICATION_MISSING');
  if (lastVerified !== null && lastVerified > asOf) reasons.push('STANDARD_VERIFICATION_IN_FUTURE');
  if (nextReview === null) reasons.push('STANDARD_NEXT_REVIEW_MISSING');
  if (nextReview !== null && nextReview < asOf) reasons.push('STANDARD_VERIFICATION_STALE');

  return deepFreeze({
    standardId: normalized.standardId,
    asOfDate,
    fresh: reasons.length === 0,
    reasons,
    finalComplianceConclusionPermitted: false,
  });
}

function createStandardsRegistry({ standards = [], rules = [], asOfDate } = {}) {
  if (!Array.isArray(standards) || !Array.isArray(rules)) throw new TypeError('standards and rules must be arrays');
  if (!asOfDate) throw new TypeError('asOfDate is required');

  const normalizedStandards = standards.map(normalizeStandardRecord);
  const normalizedRules = rules.map(normalizeStandardRule);
  const standardIds = new Set();
  const ruleIds = new Set();

  for (const standard of normalizedStandards) {
    if (standardIds.has(standard.standardId)) throw new TypeError(`DUPLICATE_STANDARD_ID:${standard.standardId}`);
    standardIds.add(standard.standardId);
  }
  for (const rule of normalizedRules) {
    if (ruleIds.has(rule.ruleId)) throw new TypeError(`DUPLICATE_RULE_ID:${rule.ruleId}`);
    ruleIds.add(rule.ruleId);
    if (!standardIds.has(rule.standardId)) throw new TypeError(`ORPHAN_STANDARD_RULE:${rule.ruleId}:${rule.standardId}`);
  }

  const freshness = normalizedStandards.map((standard) => evaluateStandardFreshness(standard, asOfDate));
  const staleStandardIds = freshness.filter((entry) => !entry.fresh).map((entry) => entry.standardId);
  const activeStandardIds = normalizedStandards
    .filter((standard) => standard.status === STANDARD_STATUS.ACTIVE)
    .map((standard) => standard.standardId);

  return deepFreeze({
    schemaVersion: 1,
    registryVersion: REGISTRY_VERSION,
    mode: 'NON_ENFORCING_LIBRARY_ONLY',
    asOfDate,
    standards: normalizedStandards,
    rules: normalizedRules,
    activeStandardIds,
    staleStandardIds,
    freshness,
    legalApprovalEstablished: false,
    professionalAuthorizationEstablished: false,
    transactionAuthorized: false,
  });
}

// Deliberately empty. Named standards from the 2026 directive are not seeded here
// until their official source, exact version/status/effective date and review state
// have been independently verified. This prevents the directive itself from becoming
// an accidental source of production legal/professional truth.
const INITIAL_STANDARDS = Object.freeze([]);
const INITIAL_RULES = Object.freeze([]);

function createInitialNonEnforcingRegistry(asOfDate) {
  return createStandardsRegistry({
    standards: INITIAL_STANDARDS,
    rules: INITIAL_RULES,
    asOfDate,
  });
}

module.exports = {
  REGISTRY_VERSION,
  INITIAL_STANDARDS,
  INITIAL_RULES,
  evaluateStandardFreshness,
  createStandardsRegistry,
  createInitialNonEnforcingRegistry,
};