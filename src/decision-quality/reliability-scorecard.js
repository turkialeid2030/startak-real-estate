'use strict';

const RELIABILITY_LEVEL = Object.freeze({
  HIGH: 'HIGH',
  MODERATE: 'MODERATE',
  LOW: 'LOW',
  INSUFFICIENT: 'INSUFFICIENT',
});

const RELIABILITY_DIMENSION = Object.freeze({
  EVIDENCE_COMPLETENESS: 'EVIDENCE_COMPLETENESS',
  EVIDENCE_AUTHORITY: 'EVIDENCE_AUTHORITY',
  CONTRADICTION_STATUS: 'CONTRADICTION_STATUS',
  MODEL_APPLICABILITY: 'MODEL_APPLICABILITY',
  ASSUMPTION_BURDEN: 'ASSUMPTION_BURDEN',
  REGULATORY_READINESS: 'REGULATORY_READINESS',
  TITLE_READINESS: 'TITLE_READINESS',
  TENANT_READINESS: 'TENANT_READINESS',
  PROFESSIONAL_REVIEW: 'PROFESSIONAL_REVIEW',
});

const LEVEL_ORDER = Object.freeze({
  [RELIABILITY_LEVEL.HIGH]: 0,
  [RELIABILITY_LEVEL.MODERATE]: 1,
  [RELIABILITY_LEVEL.LOW]: 2,
  [RELIABILITY_LEVEL.INSUFFICIENT]: 3,
});

function assertNonEmpty(value, name) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${name} must be a non-empty string`);
}

function normalizeDimensionEntry(entry) {
  if (!entry || typeof entry !== 'object') throw new TypeError('dimension entry must be an object');
  if (!Object.values(RELIABILITY_DIMENSION).includes(entry.dimension)) throw new TypeError(`Unsupported reliability dimension: ${entry.dimension}`);
  if (!Object.values(RELIABILITY_LEVEL).includes(entry.level)) throw new TypeError(`Unsupported reliability level: ${entry.level}`);
  const evidenceRefs = entry.evidenceRefs == null ? [] : entry.evidenceRefs;
  if (!Array.isArray(evidenceRefs)) throw new TypeError('dimension evidenceRefs must be an array');
  return Object.freeze({
    dimension: entry.dimension,
    level: entry.level,
    rationale: entry.rationale == null ? null : String(entry.rationale),
    evidenceRefs: Object.freeze(evidenceRefs.map(String)),
  });
}

function createDecisionReliabilityScorecard({ caseId, projectId, dimensions = [] }) {
  assertNonEmpty(caseId, 'caseId');
  assertNonEmpty(projectId, 'projectId');
  if (!Array.isArray(dimensions) || dimensions.length === 0) throw new TypeError('dimensions must be a non-empty array');

  const normalized = dimensions.map(normalizeDimensionEntry);
  const seen = new Set();
  for (const item of normalized) {
    if (seen.has(item.dimension)) throw new Error(`DUPLICATE_RELIABILITY_DIMENSION: ${item.dimension}`);
    seen.add(item.dimension);
  }

  const worst = normalized.reduce((a, b) => LEVEL_ORDER[b.level] > LEVEL_ORDER[a.level] ? b : a);
  const lowOrInsufficient = Object.freeze(normalized.filter((x) => x.level === RELIABILITY_LEVEL.LOW || x.level === RELIABILITY_LEVEL.INSUFFICIENT));
  const moderate = Object.freeze(normalized.filter((x) => x.level === RELIABILITY_LEVEL.MODERATE));

  return Object.freeze({
    schemaVersion: 1,
    caseId,
    projectId,
    overallReliability: worst.level,
    dimensions: Object.freeze(normalized),
    limitingDimensions: Object.freeze(normalized.filter((x) => x.level === worst.level)),
    lowOrInsufficientDimensions: lowOrInsufficient,
    moderateDimensions: moderate,
    numericConfidenceScore: null,
    transactionAuthorized: false,
    semantics: 'Overall reliability is a conservative worst-dimension aggregation of caller-supplied classified dimensions. No synthetic percentage confidence is produced. This is decision-support metadata, not a guarantee of outcome, compliance, valuation accuracy, or professional sufficiency.',
  });
}

module.exports = {
  RELIABILITY_LEVEL,
  RELIABILITY_DIMENSION,
  createDecisionReliabilityScorecard,
};
