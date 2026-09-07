'use strict';

const crypto = require('crypto');
const {
  ENFORCEMENT_CLASS,
  normalizeStandardRule,
  verifyStandardsSnapshot,
} = require('../standards');
const {
  REPORT_QA_STATUS,
  verifyProfessionalReportContract,
} = require('./professional-report-contract');
const {
  REVIEW_LEVEL,
  REVIEW_DECISION,
  REVIEW_STATE,
  verifyProfessionalReviewSession,
} = require('./professional-review');

const REPORT_CONFORMANCE_QA_STATUS = Object.freeze({
  BLOCKED: 'CONFORMANCE_QA_BLOCKED',
  READY_FOR_OFFICIAL_STANDARDS_REVIEW: 'READY_FOR_OFFICIAL_STANDARDS_REVIEW',
});

const SECTION_TRACE_STATUS = Object.freeze({
  PRESENT: 'PRESENT',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
});

const OFFICIAL_CONFORMANCE_CLAIM_STATUS = 'NOT_ESTABLISHED_OFFICIAL_SOURCE_AND_PROFESSIONAL_VERIFICATION_REQUIRED';
const OPERATING_MODE = 'UNLICENSED_DECISION_SUPPORT';

function canonicalize(value) {
  if (value === null || value === undefined) return value === undefined ? null : value;
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((acc, key) => {
    acc[key] = canonicalize(value[key]);
    return acc;
  }, {});
}

function hashObject(value) {
  return crypto.createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

function requiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} is required`);
  return value.trim();
}

function assertSha(value, field) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/i.test(value)) {
    throw new TypeError(`${field} must be a 64-character SHA-256 hex digest`);
  }
  return value.toLowerCase();
}

function isoTime(value, field) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new TypeError(`${field} must be a valid date/time`);
  return parsed.toISOString();
}

function uniqueStrings(values, field) {
  if (!Array.isArray(values)) return [];
  const normalized = values.map((v) => requiredString(v, field));
  if (new Set(normalized).size !== normalized.length) throw new Error(`DUPLICATE_${field.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`);
  return normalized;
}

function createReportSectionTrace(input) {
  if (!input || typeof input !== 'object') throw new TypeError('input is required');
  const status = requiredString(input.status || SECTION_TRACE_STATUS.PRESENT, 'status');
  if (!Object.values(SECTION_TRACE_STATUS).includes(status)) throw new TypeError('status is invalid');
  const ruleIds = uniqueStrings(input.ruleIds || [], 'ruleId');
  if (status === SECTION_TRACE_STATUS.NOT_APPLICABLE && ruleIds.length > 0) {
    throw new Error('NOT_APPLICABLE_SECTION_CANNOT_COVER_RULES');
  }
  const core = {
    schemaVersion: 1,
    traceId: requiredString(input.traceId, 'traceId'),
    reportId: requiredString(input.reportId, 'reportId'),
    reportHashSha256: assertSha(input.reportHashSha256, 'reportHashSha256'),
    caseId: requiredString(input.caseId, 'caseId'),
    propertyRef: requiredString(input.propertyRef, 'propertyRef'),
    sectionCode: requiredString(input.sectionCode, 'sectionCode'),
    sectionTitle: requiredString(input.sectionTitle, 'sectionTitle'),
    status,
    sectionContentHashSha256: status === SECTION_TRACE_STATUS.PRESENT
      ? assertSha(input.sectionContentHashSha256, 'sectionContentHashSha256')
      : null,
    artifactReferenceIds: uniqueStrings(input.artifactReferenceIds || [], 'artifactReferenceId'),
    ruleIds,
    evidenceRefs: uniqueStrings(input.evidenceRefs || [], 'evidenceRef'),
    preparedBy: requiredString(input.preparedBy, 'preparedBy'),
    preparedAt: isoTime(input.preparedAt || Date.now(), 'preparedAt'),
  };
  return deepFreeze({ ...core, traceHashSha256: hashObject(core) });
}

function verifyReportSectionTrace(trace) {
  if (!trace || typeof trace !== 'object') return deepFreeze({ valid: false, reason: 'SECTION_TRACE_REQUIRED' });
  const { traceHashSha256, ...core } = trace;
  try {
    const expected = assertSha(traceHashSha256, 'traceHashSha256');
    const computed = hashObject(core);
    return deepFreeze({ valid: computed === expected, expectedHash: expected, computedHash: computed });
  } catch (error) {
    return deepFreeze({ valid: false, reason: 'SECTION_TRACE_HASH_INVALID' });
  }
}

function reportingRelevant(rule) {
  return rule.enforcementClass === ENFORCEMENT_CLASS.REPORTING_RULE
    || rule.enforcementClass === ENFORCEMENT_CLASS.REQUIRED_DISCLOSURE
    || (rule.reportingEffect !== null && rule.reportingEffect !== undefined && rule.reportingEffect !== '');
}

function deriveReportingRuleIds(rules, routeResult) {
  const normalizedRules = (Array.isArray(rules) ? rules : []).map(normalizeStandardRule);
  const byId = new Map(normalizedRules.map((rule) => [rule.ruleId, rule]));
  const applicable = Array.isArray(routeResult?.applicableRuleIds) ? routeResult.applicableRuleIds : [];
  const missingRuleDefinitions = applicable.filter((ruleId) => !byId.has(ruleId)).sort();
  const requiredReportingRuleIds = applicable
    .filter((ruleId) => byId.has(ruleId) && reportingRelevant(byId.get(ruleId)))
    .sort();
  return deepFreeze({ requiredReportingRuleIds, missingRuleDefinitions, normalizedRules });
}

function assessReportStandardsConformance(input) {
  if (!input || typeof input !== 'object') throw new TypeError('input is required');
  const blockers = new Set();
  const warnings = new Set();

  const report = input.report;
  const reportIntegrity = verifyProfessionalReportContract(report);
  if (!reportIntegrity.valid) blockers.add('REPORT_INTEGRITY_FAILURE');
  if (report?.qaStatus !== REPORT_QA_STATUS.READY_FOR_INTERNAL_QA) blockers.add('REPORT_NOT_READY_FOR_QA');

  const review = input.reviewSession;
  const reviewIntegrity = verifyProfessionalReviewSession(review);
  if (!reviewIntegrity.valid) blockers.add('REVIEW_SESSION_INTEGRITY_FAILURE');
  if (report && review) {
    if (review.reportId !== report.reportId || review.reportHashSha256 !== report.reportHashSha256) blockers.add('REVIEW_REPORT_BINDING_MISMATCH');
    if (review.caseId !== report.caseId || review.propertyRef !== report.propertyRef) blockers.add('REVIEW_SCOPE_MISMATCH');
  }
  if (![REVIEW_LEVEL.PROFESSIONAL_REVIEW, REVIEW_LEVEL.INDEPENDENT_REVIEW].includes(review?.reviewLevel)) {
    blockers.add('PROFESSIONAL_OR_INDEPENDENT_REVIEW_REQUIRED');
  }
  if (review?.reviewState !== REVIEW_STATE.READY_FOR_NEXT_CONTROLLED_GATE
    || review?.conclusion?.decision !== REVIEW_DECISION.APPROVE_NEXT_CONTROLLED_GATE
    || review?.professionalReviewCompleted !== true) {
    blockers.add('PROFESSIONAL_REVIEW_NOT_APPROVED');
  }

  const snapshot = input.standardsSnapshot;
  if (!snapshot || typeof input.standardsHashFn !== 'function') {
    blockers.add('STANDARDS_SNAPSHOT_OR_HASH_FUNCTION_MISSING');
  } else {
    const verification = verifyStandardsSnapshot(snapshot, input.standardsHashFn);
    if (!verification.valid) blockers.add('STANDARDS_SNAPSHOT_INTEGRITY_FAILURE');
    if (report) {
      if (snapshot.standardsSnapshotId !== report.standardsSnapshotId || snapshot.snapshotHash !== report.standardsSnapshotHash) {
        blockers.add('REPORT_STANDARDS_SNAPSHOT_BINDING_MISMATCH');
      }
      if (snapshot.valuationDate && snapshot.valuationDate !== report.valuationDate) blockers.add('STANDARDS_SNAPSHOT_VALUATION_DATE_MISMATCH');
    }
  }

  const route = input.routeResult;
  if (!route || typeof route !== 'object') {
    blockers.add('STANDARDS_ROUTE_REQUIRED');
  } else if (snapshot) {
    if (route.routerVersion !== snapshot.routerVersion) blockers.add('ROUTER_VERSION_MISMATCH');
    if ((route.routerInputHash || null) !== (snapshot.routerInputHash || null)) blockers.add('ROUTER_INPUT_HASH_MISMATCH');
    for (const code of route.blockingCodes || []) blockers.add(`ROUTER_BLOCKER:${code}`);
    for (const reviewCode of route.requiredReviews || []) blockers.add(`ROUTER_REVIEW_REQUIRED:${reviewCode}`);
    if (route.productionIntegration !== 'NON_ENFORCING_LIBRARY_ONLY') warnings.add('ROUTER_INTEGRATION_MODE_CHANGED_REQUIRES_SEPARATE_GOVERNANCE_REVIEW');
  }

  const derived = deriveReportingRuleIds(input.rules || [], route || {});
  for (const ruleId of derived.missingRuleDefinitions) blockers.add(`APPLICABLE_RULE_DEFINITION_MISSING:${ruleId}`);
  if (derived.requiredReportingRuleIds.length === 0) blockers.add('NO_ACTIVE_REPORTING_RULES_TO_ASSESS');

  const traces = Array.isArray(input.sectionTraces) ? input.sectionTraces : [];
  const traceIds = new Set();
  const artifactIds = new Set((report?.artifactReferences || []).map((ref) => ref.referenceId));
  const requiredRuleSet = new Set(derived.requiredReportingRuleIds);
  const coverage = new Map(derived.requiredReportingRuleIds.map((ruleId) => [ruleId, []]));

  for (const trace of traces) {
    if (!verifyReportSectionTrace(trace).valid) {
      blockers.add(`SECTION_TRACE_INTEGRITY_FAILURE:${trace?.traceId || 'UNKNOWN'}`);
      continue;
    }
    if (traceIds.has(trace.traceId)) blockers.add(`DUPLICATE_SECTION_TRACE:${trace.traceId}`);
    traceIds.add(trace.traceId);
    if (report && (trace.reportId !== report.reportId || trace.reportHashSha256 !== report.reportHashSha256)) {
      blockers.add(`SECTION_TRACE_REPORT_BINDING_MISMATCH:${trace.traceId}`);
    }
    if (report && (trace.caseId !== report.caseId || trace.propertyRef !== report.propertyRef)) {
      blockers.add(`SECTION_TRACE_SCOPE_MISMATCH:${trace.traceId}`);
    }
    for (const artifactReferenceId of trace.artifactReferenceIds) {
      if (!artifactIds.has(artifactReferenceId)) blockers.add(`SECTION_TRACE_UNKNOWN_ARTIFACT:${trace.traceId}:${artifactReferenceId}`);
    }
    for (const ruleId of trace.ruleIds) {
      if (!requiredRuleSet.has(ruleId)) blockers.add(`SECTION_TRACE_RULE_NOT_REPORTING_RELEVANT:${trace.traceId}:${ruleId}`);
      else coverage.get(ruleId).push(trace.traceId);
    }
  }

  for (const [ruleId, traceIdList] of coverage.entries()) {
    if (traceIdList.length === 0) blockers.add(`REPORTING_RULE_SECTION_COVERAGE_MISSING:${ruleId}`);
  }

  const blockingCodes = [...blockers].sort();
  const qaStatus = blockingCodes.length === 0
    ? REPORT_CONFORMANCE_QA_STATUS.READY_FOR_OFFICIAL_STANDARDS_REVIEW
    : REPORT_CONFORMANCE_QA_STATUS.BLOCKED;

  const core = {
    schemaVersion: 1,
    assessmentId: requiredString(input.assessmentId, 'assessmentId'),
    reportId: report?.reportId || null,
    reportHashSha256: report?.reportHashSha256 || null,
    reviewId: review?.reviewId || null,
    reviewHashSha256: review?.reviewHashSha256 || null,
    standardsSnapshotId: snapshot?.standardsSnapshotId || null,
    standardsSnapshotHash: snapshot?.snapshotHash || null,
    routerVersion: route?.routerVersion || null,
    routerInputHash: route?.routerInputHash || null,
    requiredReportingRuleIds: derived.requiredReportingRuleIds,
    sectionTraceIds: traces.map((trace) => trace?.traceId || null),
    ruleCoverage: [...coverage.entries()].map(([ruleId, traceIdsForRule]) => ({ ruleId, traceIds: [...traceIdsForRule].sort() })),
    blockingCodes,
    warnings: [...warnings].sort(),
    qaStatus,
    officialConformanceClaimStatus: OFFICIAL_CONFORMANCE_CLAIM_STATUS,
    formalConformanceEstablished: false,
    taqeemConformanceClaimEstablished: false,
    ivsConformanceClaimEstablished: false,
    ricsConformanceClaimEstablished: false,
    professionalCredentialValidated: false,
    externalIssuanceAuthorized: false,
    certifiedValuationAuthorized: false,
    legalOpinionEstablished: false,
    transactionAuthorized: false,
    operatingMode: OPERATING_MODE,
    assessedAt: isoTime(input.assessedAt || Date.now(), 'assessedAt'),
  };
  return deepFreeze({ ...core, conformanceQaHashSha256: hashObject(core) });
}

function verifyReportStandardsConformanceAssessment(assessment) {
  if (!assessment || typeof assessment !== 'object') return deepFreeze({ valid: false, reason: 'CONFORMANCE_ASSESSMENT_REQUIRED' });
  const { conformanceQaHashSha256, ...core } = assessment;
  try {
    const expected = assertSha(conformanceQaHashSha256, 'conformanceQaHashSha256');
    const computed = hashObject(core);
    return deepFreeze({ valid: computed === expected, expectedHash: expected, computedHash: computed });
  } catch (error) {
    return deepFreeze({ valid: false, reason: 'CONFORMANCE_ASSESSMENT_HASH_INVALID' });
  }
}

module.exports = {
  REPORT_CONFORMANCE_QA_STATUS,
  SECTION_TRACE_STATUS,
  OFFICIAL_CONFORMANCE_CLAIM_STATUS,
  createReportSectionTrace,
  verifyReportSectionTrace,
  deriveReportingRuleIds,
  assessReportStandardsConformance,
  verifyReportStandardsConformanceAssessment,
};
