'use strict';

const PRIORITY_LEVEL = Object.freeze({
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  MODERATE: 'MODERATE',
  LOW: 'LOW',
});

const IMPACT_LEVEL = Object.freeze({
  DECISION_BLOCKING: 'DECISION_BLOCKING',
  MATERIAL: 'MATERIAL',
  MODERATE: 'MODERATE',
  LIMITED: 'LIMITED',
});

const EFFORT_LEVEL = Object.freeze({
  LOW: 'LOW',
  MODERATE: 'MODERATE',
  HIGH: 'HIGH',
});

const URGENCY_LEVEL = Object.freeze({
  IMMEDIATE: 'IMMEDIATE',
  NEAR_TERM: 'NEAR_TERM',
  NORMAL: 'NORMAL',
});

const IMPACT_ORDER = Object.freeze({
  [IMPACT_LEVEL.DECISION_BLOCKING]: 4,
  [IMPACT_LEVEL.MATERIAL]: 3,
  [IMPACT_LEVEL.MODERATE]: 2,
  [IMPACT_LEVEL.LIMITED]: 1,
});

const URGENCY_ORDER = Object.freeze({
  [URGENCY_LEVEL.IMMEDIATE]: 3,
  [URGENCY_LEVEL.NEAR_TERM]: 2,
  [URGENCY_LEVEL.NORMAL]: 1,
});

const EFFORT_ORDER = Object.freeze({
  [EFFORT_LEVEL.LOW]: 1,
  [EFFORT_LEVEL.MODERATE]: 2,
  [EFFORT_LEVEL.HIGH]: 3,
});

function assertNonEmpty(value, name) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${name} must be a non-empty string`);
}

function normalizeCandidate(candidate, index) {
  if (!candidate || typeof candidate !== 'object') throw new TypeError(`candidate[${index}] must be an object`);
  assertNonEmpty(candidate.id, `candidate[${index}].id`);
  assertNonEmpty(candidate.question, `candidate[${index}].question`);
  if (!Object.values(IMPACT_LEVEL).includes(candidate.impact)) throw new TypeError(`Unsupported impact: ${candidate.impact}`);
  if (!Object.values(EFFORT_LEVEL).includes(candidate.effort)) throw new TypeError(`Unsupported effort: ${candidate.effort}`);
  if (!Object.values(URGENCY_LEVEL).includes(candidate.urgency)) throw new TypeError(`Unsupported urgency: ${candidate.urgency}`);
  const evidenceRefs = candidate.evidenceRefs == null ? [] : candidate.evidenceRefs;
  if (!Array.isArray(evidenceRefs)) throw new TypeError('evidenceRefs must be an array');
  return Object.freeze({
    id: candidate.id,
    question: candidate.question,
    impact: candidate.impact,
    effort: candidate.effort,
    urgency: candidate.urgency,
    professionalReviewType: candidate.professionalReviewType == null ? null : String(candidate.professionalReviewType),
    blockingGate: candidate.blockingGate == null ? null : String(candidate.blockingGate),
    rationale: candidate.rationale == null ? null : String(candidate.rationale),
    evidenceRefs: Object.freeze(evidenceRefs.map(String)),
  });
}

function priorityTuple(candidate) {
  return [
    IMPACT_ORDER[candidate.impact],
    URGENCY_ORDER[candidate.urgency],
    -EFFORT_ORDER[candidate.effort],
  ];
}

function compareTupleDesc(a, b) {
  const aa = priorityTuple(a);
  const bb = priorityTuple(b);
  for (let i = 0; i < aa.length; i += 1) {
    if (aa[i] !== bb[i]) return bb[i] - aa[i];
  }
  return a.id.localeCompare(b.id);
}

function derivePriorityLevel(candidate) {
  if (candidate.impact === IMPACT_LEVEL.DECISION_BLOCKING) return PRIORITY_LEVEL.CRITICAL;
  if (candidate.impact === IMPACT_LEVEL.MATERIAL && candidate.urgency !== URGENCY_LEVEL.NORMAL) return PRIORITY_LEVEL.HIGH;
  if (candidate.impact === IMPACT_LEVEL.MATERIAL || candidate.impact === IMPACT_LEVEL.MODERATE) return PRIORITY_LEVEL.MODERATE;
  return PRIORITY_LEVEL.LOW;
}

function buildNextBestDueDiligence({ caseId, projectId, candidates = [] }) {
  assertNonEmpty(caseId, 'caseId');
  assertNonEmpty(projectId, 'projectId');
  if (!Array.isArray(candidates) || candidates.length === 0) throw new TypeError('candidates must be a non-empty array');

  const normalized = candidates.map(normalizeCandidate);
  const ids = new Set();
  for (const item of normalized) {
    if (ids.has(item.id)) throw new Error(`DUPLICATE_DUE_DILIGENCE_ID: ${item.id}`);
    ids.add(item.id);
  }

  const ranked = [...normalized].sort(compareTupleDesc).map((item, index) => Object.freeze({
    rank: index + 1,
    priority: derivePriorityLevel(item),
    ...item,
  }));

  return Object.freeze({
    schemaVersion: 1,
    caseId,
    projectId,
    nextBestAction: ranked[0],
    rankedActions: Object.freeze(ranked),
    numericValueOfInformation: null,
    expectedMonetaryValue: null,
    transactionAuthorized: false,
    semantics: 'Prioritization is deterministic and based only on caller-supplied impact, urgency, and effort classifications. It is not a probabilistic or monetary value-of-information estimate and does not invent costs, probabilities, market facts, regulatory conclusions, or professional opinions.',
  });
}

module.exports = {
  PRIORITY_LEVEL,
  IMPACT_LEVEL,
  EFFORT_LEVEL,
  URGENCY_LEVEL,
  buildNextBestDueDiligence,
};
