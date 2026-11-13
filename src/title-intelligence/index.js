'use strict';

const TITLE_FACT_STATUS = Object.freeze({
  VERIFIED: 'VERIFIED',
  OBSERVED: 'OBSERVED',
  UNVERIFIED: 'UNVERIFIED',
  CONFLICT: 'CONFLICT',
  NOT_AVAILABLE: 'NOT_AVAILABLE',
});

const TITLE_RESULT_STATUS = Object.freeze({
  FACTS_SUFFICIENT_FOR_ANALYSIS: 'FACTS_SUFFICIENT_FOR_ANALYSIS',
  HOLD_EVIDENCE: 'HOLD_EVIDENCE',
  LEGAL_REVIEW_REQUIRED: 'LEGAL_REVIEW_REQUIRED',
});

const REQUIRED_TITLE_FACTS = Object.freeze([
  'documentId',
  'ownerName',
  'propertyAreaSqm',
  'city',
  'parcelOrPlotId',
]);

const LEGAL_SENSITIVE_FACTS = Object.freeze(new Set([
  'encumbranceDetected',
  'mortgageDetected',
  'waqfRestrictionDetected',
  'usufructRestrictionDetected',
  'easementDetected',
  'ownershipDisputeDetected',
  'executionRestrictionDetected',
]));

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

function createTitleFact({
  caseId,
  propertyId,
  key,
  value = null,
  status,
  sourceType,
  sourceRef = null,
  observedAt = null,
  note = null,
}) {
  requiredString(caseId, 'caseId');
  requiredString(propertyId, 'propertyId');
  requiredString(key, 'key');
  if (!Object.values(TITLE_FACT_STATUS).includes(status)) throw new TypeError(`invalid title fact status: ${status}`);
  requiredString(sourceType, 'sourceType');
  if (sourceRef !== null) requiredString(sourceRef, 'sourceRef');
  if (observedAt !== null) requiredString(observedAt, 'observedAt');
  if (note !== null && typeof note !== 'string') throw new TypeError('note must be a string or null');
  return freeze({
    schemaVersion: 1,
    caseId: caseId.trim(),
    propertyId: propertyId.trim(),
    key: key.trim(),
    value,
    status,
    sourceType: sourceType.trim(),
    sourceRef: sourceRef ? sourceRef.trim() : null,
    observedAt: observedAt ? observedAt.trim() : null,
    note: note ? note.trim() : null,
    semantics: 'Extracted property/title fact only; this record is not a legal conclusion.',
  });
}

// Required title facts are inputs to analysis, not authenticated legal findings.
// Reject malformed values and conflicting independently tagged observations before
// allowing a single verified/observed record to satisfy an essential field.
function comparableRequiredTitleValue(value, key) {
  // A malformed/negative parcel area must not qualify merely because it was
  // tagged VERIFIED, nor may an arbitrary number substitute for a deed ID.
  if (key === 'propertyAreaSqm') {
    return typeof value === 'number' && Number.isFinite(value) && value > 0
      ? 'areaSqm:' + value
      : null;
  }
  if (REQUIRED_TITLE_FACTS.includes(key)) {
    return typeof value === 'string' && value.trim()
      ? 'string:' + value.normalize('NFKC').trim().replace(/\s+/g, ' ')
      : null;
  }
  if (typeof value === 'string' && value.trim()) {
    return 'string:' + value.normalize('NFKC').trim().replace(/\s+/g, ' ');
  }
  if (typeof value === 'number' && Number.isFinite(value)) return 'number:' + value;
  if (typeof value === 'boolean') return 'boolean:' + value;
  return null;
}

function assessTitleFacts({ caseId, propertyId, facts, requiredFacts = REQUIRED_TITLE_FACTS }) {
  requiredString(caseId, 'caseId');
  requiredString(propertyId, 'propertyId');
  if (!Array.isArray(facts)) throw new TypeError('facts must be an array');
  if (!Array.isArray(requiredFacts)) throw new TypeError('requiredFacts must be an array');

  const isolated = [];
  for (const fact of facts) {
    if (!fact || fact.caseId !== caseId || fact.propertyId !== propertyId) {
      throw new TypeError('PROPERTY_OR_CASE_ISOLATION_VIOLATION');
    }
    isolated.push(fact);
  }

  const byKey = new Map();
  for (const fact of isolated) {
    const list = byKey.get(fact.key) || [];
    list.push(fact);
    byKey.set(fact.key, list);
  }

  const blockers = [];
  const legalReviewFlags = [];
  const checks = [];

  for (const key of requiredFacts) {
    const entries = byKey.get(key) || [];
    if (entries.length === 0) {
      blockers.push({ key, code: 'REQUIRED_TITLE_FACT_MISSING' });
      checks.push({ key, status: 'MISSING' });
      continue;
    }
    if (entries.some((entry) => entry.status === TITLE_FACT_STATUS.CONFLICT)) {
      blockers.push({ key, code: 'UNRESOLVED_TITLE_FACT_CONFLICT' });
      checks.push({ key, status: 'CONFLICT' });
      continue;
    }
    const qualified = entries.filter((entry) =>
      [TITLE_FACT_STATUS.VERIFIED, TITLE_FACT_STATUS.OBSERVED].includes(entry.status));
    if (qualified.length === 0) {
      blockers.push({ key, code: 'QUALIFIED_TITLE_EVIDENCE_REQUIRED' });
      checks.push({ key, status: 'UNQUALIFIED' });
      continue;
    }
    const values = qualified.map((entry) => comparableRequiredTitleValue(entry.value, key));
    if (values.includes(null)) {
      blockers.push({ key, code: 'INVALID_REQUIRED_TITLE_FACT_VALUE' });
      checks.push({ key, status: 'INVALID_VALUE' });
      continue;
    }
    if (new Set(values).size > 1) {
      // A second VERIFIED/OBSERVED record is not silently discarded merely
      // because neither source explicitly marked itself CONFLICT.
      blockers.push({ key, code: 'UNRESOLVED_TITLE_FACT_CONFLICT' });
      checks.push({ key, status: 'CONFLICT' });
      continue;
    }
    const usable = qualified.find((entry) =>
      typeof entry.sourceRef === 'string' && entry.sourceRef.trim() &&
      typeof entry.observedAt === 'string' && entry.observedAt.trim());
    if (!usable) {
      blockers.push({ key, code: 'REQUIRED_TITLE_SOURCE_PROVENANCE_MISSING' });
      checks.push({ key, status: 'NO_SOURCE_PROVENANCE' });
      continue;
    }
    checks.push({ key, status: 'SATISFIED', sourceRef: usable.sourceRef, observedAt: usable.observedAt });
  }

  for (const [key, entries] of byKey.entries()) {
    if (!LEGAL_SENSITIVE_FACTS.has(key)) continue;
    for (const entry of entries) {
      if (entry.status === TITLE_FACT_STATUS.CONFLICT) {
        legalReviewFlags.push({ key, code: 'LEGAL_FACT_CONFLICT_REQUIRES_REVIEW' });
      } else if (entry.value === true && [TITLE_FACT_STATUS.VERIFIED, TITLE_FACT_STATUS.OBSERVED].includes(entry.status)) {
        legalReviewFlags.push({ key, code: 'LEGAL_INTERPRETATION_REQUIRED' });
      }
    }
  }

  let status = TITLE_RESULT_STATUS.FACTS_SUFFICIENT_FOR_ANALYSIS;
  if (legalReviewFlags.length > 0) status = TITLE_RESULT_STATUS.LEGAL_REVIEW_REQUIRED;
  else if (blockers.length > 0) status = TITLE_RESULT_STATUS.HOLD_EVIDENCE;

  return freeze({
    schemaVersion: 1,
    caseId,
    propertyId,
    status,
    blockers,
    legalReviewFlags,
    checks,
    facts: isolated,
    legalConclusion: null,
    semantics: 'This assessment checks factual sufficiency and flags potential legal-review needs. It does not validate title, certify ownership, or conclude transaction legality.',
  });
}

module.exports = {
  TITLE_FACT_STATUS,
  TITLE_RESULT_STATUS,
  REQUIRED_TITLE_FACTS,
  LEGAL_SENSITIVE_FACTS,
  createTitleFact,
  assessTitleFacts,
};
