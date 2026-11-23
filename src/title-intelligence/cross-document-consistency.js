'use strict';

// Evidence-consistency check only: source types, verification labels, source
// references and dates are supplied by the caller and are NOT authenticated
// by this module. Never use this as a legal title or appraisal authorization.
const {
  TITLE_FACT_STATUS, TITLE_RESULT_STATUS, assessTitleFacts,
} = require('./index');

const STATUS = Object.freeze({
  CANDIDATE_FOR_INDEPENDENT_REVIEW: 'CANDIDATE_FOR_INDEPENDENT_REVIEW',
  HOLD_CORE_TITLE_FACTS: 'HOLD_CORE_TITLE_FACTS',
  HOLD_LEGAL_REVIEW: 'HOLD_LEGAL_REVIEW',
  HOLD_SOURCE_REQUIREMENTS: 'HOLD_SOURCE_REQUIREMENTS',
  HOLD_TEMPORAL_EVIDENCE: 'HOLD_TEMPORAL_EVIDENCE',
  HOLD_CROSS_DOCUMENT_CONFLICT: 'HOLD_CROSS_DOCUMENT_CONFLICT',
});
const ROLES = Object.freeze(['DEED', 'SURVEY']);
const PAIRED_KEYS = Object.freeze(['propertyAreaSqm', 'parcelOrPlotId']);
const DAY_MS = 86400000;

function canonicalValue(key, value) {
  if (key === 'propertyAreaSqm') {
    return typeof value === 'number' && Number.isFinite(value) && value > 0
      ? 'area:' + value : null;
  }
  return typeof value === 'string' && value.trim().length > 0
    ? 'text:' + value.normalize('NFKC').trim().replace(/\s+/g, ' ') : null;
}
function dateMs(input) {
  if (typeof input !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(input)) return NaN;
  const ms = Date.parse(input);
  return Number.isFinite(ms) ? ms : NaN;
}
function result(status, caseId, propertyId, asOf, blockers, checks) {
  return Object.freeze({
    schemaVersion: 1, status, caseId, propertyId, asOf,
    blockers: Object.freeze([...new Set(blockers)].sort()),
    checks: Object.freeze(checks.map(x => Object.freeze(x))),
    verifiedSourceRights: false,
    independentlyAuthenticatedSources: false,
    legalTitleValidityEstablished: false,
    valuationCertified: false,
    transactionAuthorized: false,
    automaticallyAdoptIntoFinancialEngine: false,
    semantics: 'Consistency check of self-reported deed/survey references only. Source authenticity, Saudi legal rights, professional approval and actual parcel identity require independent review.',
  });
}
function assessTitleCrossDocumentConsistency({
  caseId, propertyId, facts, asOf, maxAgeDaysBySourceType,
} = {}) {
  if (typeof caseId !== 'string' || !caseId.trim() || typeof propertyId !== 'string' || !propertyId.trim()) {
    throw new TypeError('CASE_AND_PROPERTY_REQUIRED');
  }
  if (!Array.isArray(facts)) throw new TypeError('TITLE_FACTS_ARRAY_REQUIRED');
  const asOfMs = dateMs(asOf);
  if (!Number.isFinite(asOfMs)) throw new TypeError('VALUATION_DATE_REQUIRED');
  if (!maxAgeDaysBySourceType || typeof maxAgeDaysBySourceType !== 'object' || Array.isArray(maxAgeDaysBySourceType)) {
    throw new TypeError('EXPLICIT_SOURCE_FRESHNESS_POLICY_REQUIRED');
  }
  for (const role of ROLES) {
    const days = maxAgeDaysBySourceType[role];
    if (typeof days !== 'number' || !Number.isFinite(days) || days < 0) {
      throw new TypeError('SOURCE_FRESHNESS_DAYS_INVALID:' + role);
    }
  }
  // The five mandatory core title facts cannot be bypassed by pairing a
  // parcel and area alone. This base check also fails on contradictory values.
  const core = assessTitleFacts({ caseId, propertyId, facts });
  if (core.status === TITLE_RESULT_STATUS.HOLD_EVIDENCE) {
    const coreConflict = core.blockers.some(x => x.code === 'UNRESOLVED_TITLE_FACT_CONFLICT');
    return result(coreConflict ? STATUS.HOLD_CROSS_DOCUMENT_CONFLICT
      : STATUS.HOLD_CORE_TITLE_FACTS, caseId, propertyId, asOf,
      core.blockers.map(x => x.key + ':' + x.code), []);
  }
  if (core.status === TITLE_RESULT_STATUS.LEGAL_REVIEW_REQUIRED) {
    return result(STATUS.HOLD_LEGAL_REVIEW, caseId, propertyId, asOf,
      core.legalReviewFlags.map(x => x.key + ':' + x.code), []);
  }
  const sources = [], temporal = [], conflicts = [], checks = [];
  // No qualified source may be dated in the future, beyond its explicit age
  // budget or missing its reference, even when the required paired keys match.
  for (const fact of facts) {
    if (![TITLE_FACT_STATUS.VERIFIED, TITLE_FACT_STATUS.OBSERVED].includes(fact.status)) continue;
    if (!ROLES.includes(fact.sourceType)) {
      sources.push('UNRECOGNIZED_QUALIFIED_SOURCE_ROLE:' + fact.key);
      continue;
    }
    if (typeof fact.sourceRef !== 'string' || !fact.sourceRef.trim()) {
      sources.push('SOURCE_REFERENCE_MISSING:' + fact.key);
    }
    const observed = dateMs(fact.observedAt);
    if (!Number.isFinite(observed) || observed > asOfMs ||
      asOfMs - observed > maxAgeDaysBySourceType[fact.sourceType] * DAY_MS) {
      temporal.push('SOURCE_DATE_INVALID_OR_STALE:' + fact.key + ':' + fact.sourceType);
    }
  }
  for (const key of PAIRED_KEYS) {
    const pair = facts.filter(f => f.key === key);
    const observed = pair.filter(f =>
      f.status === TITLE_FACT_STATUS.VERIFIED &&
      ROLES.includes(f.sourceType));
    const byRole = ROLES.map(role => observed.filter(f => f.sourceType === role));
    if (pair.some(f => f.status !== TITLE_FACT_STATUS.VERIFIED)) {
      sources.push('PAIR_NOT_VERIFIED:' + key);
    }
    if (byRole.some(entries => entries.length === 0)) {
      sources.push('INDEPENDENT_DEED_SURVEY_PAIR_REQUIRED:' + key);
    }
    const values = observed.map(f => canonicalValue(key, f.value));
    if (values.includes(null)) sources.push('PAIR_VALUE_INVALID:' + key);
    else if (new Set(values).size > 1) conflicts.push('DEED_SURVEY_VALUE_CONFLICT:' + key);
    const refs = byRole.map(entries => new Set(entries.map(f => f.sourceRef).filter(Boolean)));
    if (refs[0].size && refs[1].size && [...refs[0]].some(ref => refs[1].has(ref))) {
      sources.push('SOURCE_REFERENCE_NOT_INDEPENDENT:' + key);
    }
    checks.push({
      key, deedObservations: byRole[0].length, surveyObservations: byRole[1].length,
      distinctSourceReferences: new Set(observed.map(f => f.sourceRef).filter(Boolean)).size,
      consensusEstablished: values.length >= 2 && !values.includes(null) && new Set(values).size === 1,
    });
  }
  // A disagreement outranks missing provenance; both remain explicit blockers.
  const blockers = [...conflicts, ...temporal, ...sources];
  const status = conflicts.length ? STATUS.HOLD_CROSS_DOCUMENT_CONFLICT
    : temporal.length ? STATUS.HOLD_TEMPORAL_EVIDENCE
    : sources.length ? STATUS.HOLD_SOURCE_REQUIREMENTS
    : STATUS.CANDIDATE_FOR_INDEPENDENT_REVIEW;
  return result(status, caseId, propertyId, asOf, blockers, checks);
}
module.exports = { STATUS, ROLES, PAIRED_KEYS, assessTitleCrossDocumentConsistency };
