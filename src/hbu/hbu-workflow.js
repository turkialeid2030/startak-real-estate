'use strict';

const crypto = require('crypto');
const {
  PROPERTY_EVIDENCE_PACKET_STATUS,
} = require('../property/property-evidence-bridge');
const {
  PLANNING_EVIDENCE_STATUS,
} = require('../planning/planning-evidence');

const HBU_GATE_OUTCOME = Object.freeze({
  PASS: 'PASS',
  FAIL: 'FAIL',
  REVIEW_REQUIRED: 'REVIEW_REQUIRED',
  NOT_EVALUATED: 'NOT_EVALUATED',
});

const HBU_CANDIDATE_STATUS = Object.freeze({
  CANDIDATE_FOR_MAX_PRODUCTIVITY_COMPARISON: 'CANDIDATE_FOR_MAX_PRODUCTIVITY_COMPARISON',
  HOLD_LEGAL_PERMISSIBILITY: 'HOLD_LEGAL_PERMISSIBILITY',
  HOLD_PHYSICAL_POSSIBILITY: 'HOLD_PHYSICAL_POSSIBILITY',
  HOLD_FINANCIAL_FEASIBILITY: 'HOLD_FINANCIAL_FEASIBILITY',
  REVIEW_REQUIRED: 'REVIEW_REQUIRED',
});

const HBU_DECISION_STATUS = Object.freeze({
  HBU_CONCLUSION_RECORDED: 'HBU_CONCLUSION_RECORDED',
  HOLD_CANDIDATES: 'HOLD_CANDIDATES',
  HOLD_DECISION: 'HOLD_DECISION',
});

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function assertNonEmpty(value, field) {
  if (!nonEmpty(value)) throw new TypeError(`${field} must be a non-empty string`);
}

function assertEnum(value, enumeration, field) {
  if (!Object.values(enumeration).includes(value)) throw new TypeError(`${field} is invalid`);
}

function iso(value, field) {
  assertNonEmpty(value, field);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new TypeError(`${field} must be a valid date/time`);
  return d.toISOString();
}

function assertSha256(value, field) {
  if (!nonEmpty(value) || !/^[a-f0-9]{64}$/i.test(value)) throw new TypeError(`${field} must be a SHA-256 digest`);
}

function stableClone(value) {
  if (Array.isArray(value)) return value.map(stableClone);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((out, key) => {
    out[key] = stableClone(value[key]);
    return out;
  }, {});
}

function sha256(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stableClone(value))).digest('hex');
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function normalizeReview(review, gateName, createdAtIso) {
  if (!review || typeof review !== 'object') throw new TypeError(`${gateName} review is required`);
  assertEnum(review.outcome, HBU_GATE_OUTCOME, `${gateName}.outcome`);
  if (review.outcome === HBU_GATE_OUTCOME.NOT_EVALUATED) {
    return {
      outcome: review.outcome,
      rationale: null,
      evidenceRefs: [],
      reviewedByRef: null,
      reviewedAt: null,
      reviewEvidenceRef: null,
      professionalJudgmentExplicit: false,
    };
  }
  assertNonEmpty(review.rationale, `${gateName}.rationale`);
  assertNonEmpty(review.reviewedByRef, `${gateName}.reviewedByRef`);
  assertNonEmpty(review.reviewEvidenceRef, `${gateName}.reviewEvidenceRef`);
  if (!Array.isArray(review.evidenceRefs) || review.evidenceRefs.length === 0 || review.evidenceRefs.some((ref) => !nonEmpty(ref))) {
    throw new TypeError(`${gateName}.evidenceRefs must be a non-empty array`);
  }
  const reviewedAtIso = iso(review.reviewedAt, `${gateName}.reviewedAt`);
  if (Date.parse(reviewedAtIso) < Date.parse(createdAtIso)) throw new TypeError(`${gateName.toUpperCase()}_REVIEW_BEFORE_SCENARIO_CREATION`);
  return {
    outcome: review.outcome,
    rationale: review.rationale.trim(),
    evidenceRefs: [...new Set(review.evidenceRefs.map((ref) => ref.trim()))],
    reviewedByRef: review.reviewedByRef.trim(),
    reviewedAt: reviewedAtIso,
    reviewEvidenceRef: review.reviewEvidenceRef.trim(),
    professionalJudgmentExplicit: true,
  };
}

function verifyHbuScenarioCandidateIntegrity(candidate) {
  if (!candidate || typeof candidate !== 'object' || !/^[a-f0-9]{64}$/i.test(String(candidate.hbuScenarioHashSha256 || ''))) return false;
  const { hbuScenarioHashSha256, ...payload } = candidate;
  return sha256(payload) === candidate.hbuScenarioHashSha256.toLowerCase();
}

function createHbuScenarioCandidate({
  scenarioId,
  caseId,
  propertyRef,
  proposedUse,
  currentUse = null,
  scenarioDescription,
  planningEvidenceSet,
  propertyEvidencePacket,
  legalPermissibilityReview,
  physicalPossibilityReview,
  financialFeasibilityReview,
  createdByRef,
  createdAt,
  scenarioEvidenceRef,
} = {}) {
  for (const [field, value] of [
    ['scenarioId', scenarioId], ['caseId', caseId], ['propertyRef', propertyRef], ['proposedUse', proposedUse],
    ['scenarioDescription', scenarioDescription], ['createdByRef', createdByRef], ['scenarioEvidenceRef', scenarioEvidenceRef],
  ]) assertNonEmpty(value, field);
  if (currentUse !== null && currentUse !== undefined && !nonEmpty(currentUse)) throw new TypeError('currentUse must be null or non-empty');
  const createdAtIso = iso(createdAt, 'createdAt');

  if (!planningEvidenceSet || planningEvidenceSet.caseId !== caseId || planningEvidenceSet.propertyRef !== propertyRef) {
    throw new TypeError('CASE_OR_PROPERTY_ISOLATION_VIOLATION:planningEvidenceSet');
  }
  if (!propertyEvidencePacket || propertyEvidencePacket.caseId !== caseId || propertyEvidencePacket.propertyRef !== propertyRef) {
    throw new TypeError('CASE_OR_PROPERTY_ISOLATION_VIOLATION:propertyEvidencePacket');
  }
  assertSha256(planningEvidenceSet.planningEvidenceSetHashSha256, 'planningEvidenceSet.planningEvidenceSetHashSha256');
  assertSha256(propertyEvidencePacket.packetHashSha256, 'propertyEvidencePacket.packetHashSha256');

  const legal = normalizeReview(legalPermissibilityReview, 'legalPermissibility', createdAtIso);
  const physical = normalizeReview(physicalPossibilityReview, 'physicalPossibility', createdAtIso);
  const financial = normalizeReview(financialFeasibilityReview, 'financialFeasibility', createdAtIso);

  if (legal.outcome !== HBU_GATE_OUTCOME.PASS) {
    if (physical.outcome !== HBU_GATE_OUTCOME.NOT_EVALUATED || financial.outcome !== HBU_GATE_OUTCOME.NOT_EVALUATED) {
      throw new TypeError('HBU_GATE_SEQUENCE_VIOLATION: downstream gates cannot be evaluated before legal permissibility passes');
    }
  } else if (physical.outcome !== HBU_GATE_OUTCOME.PASS && financial.outcome !== HBU_GATE_OUTCOME.NOT_EVALUATED) {
    throw new TypeError('HBU_GATE_SEQUENCE_VIOLATION: financial feasibility cannot be evaluated before physical possibility passes');
  }

  let status;
  const blockers = [];
  if (planningEvidenceSet.status !== PLANNING_EVIDENCE_STATUS.READY_FOR_HBU_LEGAL_REVIEW
      || planningEvidenceSet.readyForHbuLegalReview !== true) {
    status = HBU_CANDIDATE_STATUS.HOLD_LEGAL_PERMISSIBILITY;
    blockers.push('PLANNING_EVIDENCE_NOT_READY_FOR_HBU_LEGAL_REVIEW');
  } else if (legal.outcome === HBU_GATE_OUTCOME.FAIL) {
    status = HBU_CANDIDATE_STATUS.HOLD_LEGAL_PERMISSIBILITY;
    blockers.push('LEGALLY_PERMISSIBLE_GATE_FAILED');
  } else if (legal.outcome === HBU_GATE_OUTCOME.REVIEW_REQUIRED || legal.outcome === HBU_GATE_OUTCOME.NOT_EVALUATED) {
    status = HBU_CANDIDATE_STATUS.REVIEW_REQUIRED;
    blockers.push('LEGALLY_PERMISSIBLE_GATE_REVIEW_REQUIRED');
  } else if (propertyEvidencePacket.status !== PROPERTY_EVIDENCE_PACKET_STATUS.READY_FOR_PROFESSIONAL_VALUATION_WORKFLOW
      || propertyEvidencePacket.professionalValuationWorkflowReady !== true) {
    status = HBU_CANDIDATE_STATUS.HOLD_PHYSICAL_POSSIBILITY;
    blockers.push('PROPERTY_EVIDENCE_NOT_READY_FOR_PHYSICAL_REVIEW');
  } else if (physical.outcome === HBU_GATE_OUTCOME.FAIL) {
    status = HBU_CANDIDATE_STATUS.HOLD_PHYSICAL_POSSIBILITY;
    blockers.push('PHYSICALLY_POSSIBLE_GATE_FAILED');
  } else if (physical.outcome === HBU_GATE_OUTCOME.REVIEW_REQUIRED || physical.outcome === HBU_GATE_OUTCOME.NOT_EVALUATED) {
    status = HBU_CANDIDATE_STATUS.REVIEW_REQUIRED;
    blockers.push('PHYSICALLY_POSSIBLE_GATE_REVIEW_REQUIRED');
  } else if (financial.outcome === HBU_GATE_OUTCOME.FAIL) {
    status = HBU_CANDIDATE_STATUS.HOLD_FINANCIAL_FEASIBILITY;
    blockers.push('FINANCIALLY_FEASIBLE_GATE_FAILED');
  } else if (financial.outcome === HBU_GATE_OUTCOME.REVIEW_REQUIRED || financial.outcome === HBU_GATE_OUTCOME.NOT_EVALUATED) {
    status = HBU_CANDIDATE_STATUS.REVIEW_REQUIRED;
    blockers.push('FINANCIALLY_FEASIBLE_GATE_REVIEW_REQUIRED');
  } else {
    status = HBU_CANDIDATE_STATUS.CANDIDATE_FOR_MAX_PRODUCTIVITY_COMPARISON;
  }

  const candidate = {
    schemaVersion: 1,
    scenarioId: scenarioId.trim(),
    caseId: caseId.trim(),
    propertyRef: propertyRef.trim(),
    proposedUse: proposedUse.trim(),
    currentUse: currentUse ? currentUse.trim() : null,
    scenarioDescription: scenarioDescription.trim(),
    planningEvidenceSetHashSha256: planningEvidenceSet.planningEvidenceSetHashSha256,
    propertyEvidencePacketHashSha256: propertyEvidencePacket.packetHashSha256,
    valuationDate: planningEvidenceSet.valuationDate,
    gates: {
      legallyPermissible: legal,
      physicallyPossible: physical,
      financiallyFeasible: financial,
      maximallyProductive: {
        outcome: HBU_GATE_OUTCOME.NOT_EVALUATED,
        rationale: null,
        evidenceRefs: [],
        reviewedByRef: null,
        reviewedAt: null,
        reviewEvidenceRef: null,
        professionalJudgmentExplicit: false,
      },
    },
    status,
    blockers,
    createdByRef: createdByRef.trim(),
    createdAt: createdAtIso,
    scenarioEvidenceRef: scenarioEvidenceRef.trim(),
    maximallyProductiveDecisionRecorded: false,
    highestAndBestUseConclusionEstablished: false,
    legalOpinionEstablished: false,
    automaticUseSelection: false,
    valuationConclusionProduced: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
  };
  candidate.hbuScenarioHashSha256 = sha256(candidate);
  return deepFreeze(candidate);
}

function recordMaximallyProductiveDecision({
  decisionId,
  caseId,
  propertyRef,
  candidates,
  selectedScenarioId,
  comparisonBasis,
  comparativeMetrics = {},
  rationale,
  evidenceRefs,
  decidedByRef,
  decidedAt,
  decisionEvidenceRef,
} = {}) {
  for (const [field, value] of [
    ['decisionId', decisionId], ['caseId', caseId], ['propertyRef', propertyRef],
    ['selectedScenarioId', selectedScenarioId], ['comparisonBasis', comparisonBasis], ['rationale', rationale],
    ['decidedByRef', decidedByRef], ['decisionEvidenceRef', decisionEvidenceRef],
  ]) assertNonEmpty(value, field);
  if (!Array.isArray(candidates) || candidates.length === 0) throw new TypeError('candidates must be a non-empty array');
  if (!Array.isArray(evidenceRefs) || evidenceRefs.length === 0 || evidenceRefs.some((ref) => !nonEmpty(ref))) throw new TypeError('evidenceRefs must be a non-empty array');
  if (!comparativeMetrics || typeof comparativeMetrics !== 'object' || Array.isArray(comparativeMetrics)) throw new TypeError('comparativeMetrics must be an object');
  const decidedAtIso = iso(decidedAt, 'decidedAt');

  const ids = new Set();
  const blockers = [];
  for (const candidate of candidates) {
    if (!candidate || candidate.caseId !== caseId || candidate.propertyRef !== propertyRef) throw new TypeError('CASE_OR_PROPERTY_ISOLATION_VIOLATION:hbuCandidate');
    if (!verifyHbuScenarioCandidateIntegrity(candidate)) blockers.push(`HBU_SCENARIO_INTEGRITY_FAILED:${candidate?.scenarioId || 'UNKNOWN'}`);
    if (ids.has(candidate.scenarioId)) blockers.push(`DUPLICATE_HBU_SCENARIO_ID:${candidate.scenarioId}`);
    ids.add(candidate.scenarioId);
    if (candidate.status !== HBU_CANDIDATE_STATUS.CANDIDATE_FOR_MAX_PRODUCTIVITY_COMPARISON) blockers.push(`HBU_SCENARIO_NOT_FEASIBLE_FOR_COMPARISON:${candidate.scenarioId}`);
    if (Date.parse(decidedAtIso) < Date.parse(candidate.createdAt)) blockers.push(`HBU_DECISION_BEFORE_SCENARIO_CREATION:${candidate.scenarioId}`);
  }

  if (!ids.has(selectedScenarioId)) blockers.push(`SELECTED_HBU_SCENARIO_NOT_FOUND:${selectedScenarioId}`);
  for (const [scenarioId, metric] of Object.entries(comparativeMetrics)) {
    if (!ids.has(scenarioId)) blockers.push(`COMPARATIVE_METRIC_FOR_UNKNOWN_SCENARIO:${scenarioId}`);
    if (!metric || typeof metric !== 'object' || !nonEmpty(metric.metricName) || typeof metric.value !== 'number' || !Number.isFinite(metric.value)) {
      blockers.push(`INVALID_COMPARATIVE_METRIC:${scenarioId}`);
    }
  }

  if (blockers.length) {
    return deepFreeze({
      schemaVersion: 1,
      decisionId: decisionId.trim(),
      caseId,
      propertyRef,
      status: HBU_DECISION_STATUS.HOLD_CANDIDATES,
      blockers,
      highestAndBestUseConclusionEstablished: false,
      professionalJudgmentExplicit: true,
      automaticUseSelection: false,
      valuationConclusionProduced: false,
      certifiedValuationEstablished: false,
      transactionAuthorized: false,
    });
  }

  const scenarioOutcomes = candidates.map((candidate) => ({
    scenarioId: candidate.scenarioId,
    proposedUse: candidate.proposedUse,
    hbuScenarioHashSha256: candidate.hbuScenarioHashSha256,
    maximallyProductiveOutcome: candidate.scenarioId === selectedScenarioId ? HBU_GATE_OUTCOME.PASS : HBU_GATE_OUTCOME.FAIL,
    selected: candidate.scenarioId === selectedScenarioId,
    comparativeMetric: comparativeMetrics[candidate.scenarioId] || null,
  }));

  const core = {
    schemaVersion: 1,
    decisionId: decisionId.trim(),
    caseId,
    propertyRef,
    selectedScenarioId: selectedScenarioId.trim(),
    comparisonBasis: comparisonBasis.trim(),
    rationale: rationale.trim(),
    evidenceRefs: [...new Set(evidenceRefs.map((ref) => ref.trim()))],
    scenarioOutcomes,
    decidedByRef: decidedByRef.trim(),
    decidedAt: decidedAtIso,
    decisionEvidenceRef: decisionEvidenceRef.trim(),
  };

  return deepFreeze({
    ...core,
    hbuDecisionHashSha256: sha256(core),
    status: HBU_DECISION_STATUS.HBU_CONCLUSION_RECORDED,
    blockers: [],
    highestAndBestUseConclusionEstablished: true,
    professionalJudgmentExplicit: true,
    legalOpinionEstablished: false,
    automaticUseSelection: false,
    automaticMaxProductivityRanking: false,
    valuationConclusionProduced: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
    semantics: 'The HBU conclusion records accountable professional judgement after sequential legal-permissibility, physical-possibility and financial-feasibility gates and an explicit maximally-productive comparison. The system does not infer legal rights, auto-rank uses, calculate a valuation conclusion, certify a valuation, or authorize a transaction.',
  });
}

module.exports = {
  HBU_GATE_OUTCOME,
  HBU_CANDIDATE_STATUS,
  HBU_DECISION_STATUS,
  createHbuScenarioCandidate,
  verifyHbuScenarioCandidateIntegrity,
  recordMaximallyProductiveDecision,
};
