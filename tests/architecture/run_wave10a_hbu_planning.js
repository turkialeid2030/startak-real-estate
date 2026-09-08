'use strict';

const assert = require('assert');
const {
  PLANNING_CONSTRAINT_TYPE,
  PLANNING_AUTHORITY_CLASS,
  PLANNING_VERIFICATION_STATUS,
  PLANNING_CARDINALITY,
  PLANNING_EVIDENCE_STATUS,
  createPlanningEvidenceRecord,
  verifyPlanningEvidenceIntegrity,
  assessPlanningEvidenceSet,
} = require('../../src/planning');
const {
  HBU_GATE_OUTCOME,
  HBU_CANDIDATE_STATUS,
  HBU_DECISION_STATUS,
  createHbuScenarioCandidate,
  verifyHbuScenarioCandidateIntegrity,
  recordMaximallyProductiveDecision,
} = require('../../src/hbu');
const {
  PROPERTY_EVIDENCE_PACKET_STATUS,
} = require('../../src/property/property-evidence-bridge');

let checks = 0;
function check(condition, message) {
  assert.ok(condition, message);
  checks += 1;
}
function throwsWith(fn, fragment, message) {
  let ok = false;
  try { fn(); } catch (error) { ok = String(error.message).includes(fragment); }
  check(ok, message);
}

const CASE_ID = 'CASE-10A-001';
const PROPERTY_REF = 'PROPERTY-10A-001';
const VALUATION_DATE = '2026-09-07T00:00:00Z';
const REQUIRED = [
  PLANNING_CONSTRAINT_TYPE.ZONING_CLASSIFICATION,
  PLANNING_CONSTRAINT_TYPE.PERMITTED_USE,
  PLANNING_CONSTRAINT_TYPE.FAR,
  PLANNING_CONSTRAINT_TYPE.BCR,
  PLANNING_CONSTRAINT_TYPE.HEIGHT_LIMIT,
  PLANNING_CONSTRAINT_TYPE.SETBACK,
  PLANNING_CONSTRAINT_TYPE.PARKING_REQUIREMENT,
  PLANNING_CONSTRAINT_TYPE.PERMIT_STATUS,
  PLANNING_CONSTRAINT_TYPE.DEVELOPMENT_RESTRICTION,
  PLANNING_CONSTRAINT_TYPE.DEVELOPMENT_CONDITION,
];
const CARDINALITY = Object.fromEntries(REQUIRED.map((type) => [
  type,
  [PLANNING_CONSTRAINT_TYPE.SETBACK, PLANNING_CONSTRAINT_TYPE.DEVELOPMENT_RESTRICTION, PLANNING_CONSTRAINT_TYPE.DEVELOPMENT_CONDITION].includes(type)
    ? PLANNING_CARDINALITY.MULTIPLE
    : PLANNING_CARDINALITY.SINGLE,
]));

function planningRecord(type, value, overrides = {}) {
  return createPlanningEvidenceRecord({
    evidenceId: overrides.evidenceId || `PE-${type}`,
    caseId: overrides.caseId || CASE_ID,
    propertyRef: overrides.propertyRef || PROPERTY_REF,
    constraintType: type,
    value,
    unit: overrides.unit ?? null,
    authorityClass: overrides.authorityClass || PLANNING_AUTHORITY_CLASS.OFFICIAL_AUTHORITY,
    sourceAuthority: overrides.sourceAuthority || 'SYNTHETIC OFFICIAL PLANNING AUTHORITY',
    sourceRef: overrides.sourceRef || `SOURCE-${type}`,
    sourceUrl: null,
    sourceEffectiveDate: overrides.sourceEffectiveDate || '2026-01-01T00:00:00Z',
    validFrom: overrides.validFrom || '2026-01-01T00:00:00Z',
    validTo: overrides.validTo === undefined ? null : overrides.validTo,
    verification: overrides.verification || {
      status: PLANNING_VERIFICATION_STATUS.VERIFIED,
      verifiedByRef: 'USER:PLANNING-REVIEWER',
      verifiedAt: '2026-08-20T10:00:00Z',
      verificationEvidenceRef: `review://${type}`,
    },
    capturedAt: overrides.capturedAt || '2026-08-20T09:00:00Z',
  });
}

const records = [
  planningRecord(PLANNING_CONSTRAINT_TYPE.ZONING_CLASSIFICATION, 'SYNTHETIC_MIXED_USE'),
  planningRecord(PLANNING_CONSTRAINT_TYPE.PERMITTED_USE, 'OFFICE'),
  planningRecord(PLANNING_CONSTRAINT_TYPE.FAR, 4.0, { unit: 'ratio' }),
  planningRecord(PLANNING_CONSTRAINT_TYPE.BCR, 0.6, { unit: 'ratio' }),
  planningRecord(PLANNING_CONSTRAINT_TYPE.HEIGHT_LIMIT, 45, { unit: 'm' }),
  planningRecord(PLANNING_CONSTRAINT_TYPE.SETBACK, { front: 6, side: 3, rear: 3 }, { unit: 'm' }),
  planningRecord(PLANNING_CONSTRAINT_TYPE.PARKING_REQUIREMENT, '1_SPACE_PER_50_SQM'),
  planningRecord(PLANNING_CONSTRAINT_TYPE.PERMIT_STATUS, 'PERMIT_REVIEW_REQUIRED'),
  planningRecord(PLANNING_CONSTRAINT_TYPE.DEVELOPMENT_RESTRICTION, 'SYNTHETIC_HEIGHT_ENVELOPE'),
  planningRecord(PLANNING_CONSTRAINT_TYPE.DEVELOPMENT_CONDITION, 'SYNTHETIC_ACCESS_CONDITION'),
];

check(records.every((record) => verifyPlanningEvidenceIntegrity(record)), 'planning records have deterministic integrity hashes');
check(records.every((record) => record.legalOpinionEstablished === false && record.planningComplianceEstablished === false), 'planning evidence does not manufacture legal/compliance conclusions');
check(records.every((record) => record.transactionAuthorized === false), 'planning evidence never authorizes a transaction');

const readyPlanning = assessPlanningEvidenceSet({
  caseId: CASE_ID,
  propertyRef: PROPERTY_REF,
  valuationDate: VALUATION_DATE,
  records,
  requiredConstraintTypes: REQUIRED,
  allowedAuthorityClasses: [PLANNING_AUTHORITY_CLASS.OFFICIAL_AUTHORITY],
  cardinalityByType: CARDINALITY,
});
check(readyPlanning.status === PLANNING_EVIDENCE_STATUS.READY_FOR_HBU_LEGAL_REVIEW, 'complete verified planning set is ready for HBU legal-permissibility review');
check(readyPlanning.readyForHbuLegalReview === true, 'planning set signals review readiness only');
check(readyPlanning.legalPermissibilityConclusionEstablished === false && readyPlanning.legalOpinionEstablished === false, 'planning readiness is not a legal conclusion');
check(/^[a-f0-9]{64}$/.test(readyPlanning.planningEvidenceSetHashSha256), 'planning set has deterministic SHA-256');

const missingPlanning = assessPlanningEvidenceSet({
  caseId: CASE_ID,
  propertyRef: PROPERTY_REF,
  valuationDate: VALUATION_DATE,
  records: records.filter((record) => record.constraintType !== PLANNING_CONSTRAINT_TYPE.PARKING_REQUIREMENT),
  requiredConstraintTypes: REQUIRED,
  allowedAuthorityClasses: [PLANNING_AUTHORITY_CLASS.OFFICIAL_AUTHORITY],
  cardinalityByType: CARDINALITY,
});
check(missingPlanning.status === PLANNING_EVIDENCE_STATUS.HOLD_MISSING_EVIDENCE, 'missing mandatory planning evidence fails closed');
check(missingPlanning.blockers.includes('MISSING_REQUIRED_PLANNING_EVIDENCE:PARKING_REQUIREMENT'), 'missing planning evidence is explicit');

const expiredParking = planningRecord(PLANNING_CONSTRAINT_TYPE.PARKING_REQUIREMENT, 'OLD_RULE', {
  evidenceId: 'PE-PARKING-EXPIRED', validTo: '2026-06-30T00:00:00Z',
});
const temporalPlanning = assessPlanningEvidenceSet({
  caseId: CASE_ID,
  propertyRef: PROPERTY_REF,
  valuationDate: VALUATION_DATE,
  records: [...records.filter((record) => record.constraintType !== PLANNING_CONSTRAINT_TYPE.PARKING_REQUIREMENT), expiredParking],
  requiredConstraintTypes: REQUIRED,
  allowedAuthorityClasses: [PLANNING_AUTHORITY_CLASS.OFFICIAL_AUTHORITY],
  cardinalityByType: CARDINALITY,
});
check(temporalPlanning.status === PLANNING_EVIDENCE_STATUS.HOLD_TEMPORAL_VALIDITY, 'planning evidence not valid on valuation date is held');

const unverifiedUse = planningRecord(PLANNING_CONSTRAINT_TYPE.PERMITTED_USE, 'OFFICE', {
  evidenceId: 'PE-USE-UNVERIFIED',
  authorityClass: PLANNING_AUTHORITY_CLASS.CLIENT_PROVIDED,
  verification: { status: PLANNING_VERIFICATION_STATUS.NOT_VERIFIED },
});
const authorityPlanning = assessPlanningEvidenceSet({
  caseId: CASE_ID,
  propertyRef: PROPERTY_REF,
  valuationDate: VALUATION_DATE,
  records: [...records.filter((record) => record.constraintType !== PLANNING_CONSTRAINT_TYPE.PERMITTED_USE), unverifiedUse],
  requiredConstraintTypes: REQUIRED,
  allowedAuthorityClasses: [PLANNING_AUTHORITY_CLASS.OFFICIAL_AUTHORITY],
  cardinalityByType: CARDINALITY,
});
check(authorityPlanning.status === PLANNING_EVIDENCE_STATUS.HOLD_AUTHORITY_OR_VERIFICATION, 'unverified/client-provided planning evidence cannot satisfy official evidence gate');

const conflictingFar = planningRecord(PLANNING_CONSTRAINT_TYPE.FAR, 5.0, { evidenceId: 'PE-FAR-CONFLICT', unit: 'ratio', sourceRef: 'SOURCE-FAR-2' });
const conflictPlanning = assessPlanningEvidenceSet({
  caseId: CASE_ID,
  propertyRef: PROPERTY_REF,
  valuationDate: VALUATION_DATE,
  records: [...records, conflictingFar],
  requiredConstraintTypes: REQUIRED,
  allowedAuthorityClasses: [PLANNING_AUTHORITY_CLASS.OFFICIAL_AUTHORITY],
  cardinalityByType: CARDINALITY,
});
check(conflictPlanning.status === PLANNING_EVIDENCE_STATUS.HOLD_CONFLICT, 'conflicting single-value planning evidence fails closed');
check(conflictPlanning.blockers.includes('CONFLICTING_SINGLE_VALUE_PLANNING_EVIDENCE:FAR'), 'planning conflict identifies affected constraint');

const tamperedRecord = { ...records[0], value: 'TAMPERED' };
const tamperedPlanning = assessPlanningEvidenceSet({
  caseId: CASE_ID,
  propertyRef: PROPERTY_REF,
  valuationDate: VALUATION_DATE,
  records: [tamperedRecord, ...records.slice(1)],
  requiredConstraintTypes: REQUIRED,
  allowedAuthorityClasses: [PLANNING_AUTHORITY_CLASS.OFFICIAL_AUTHORITY],
  cardinalityByType: CARDINALITY,
});
check(tamperedPlanning.status === PLANNING_EVIDENCE_STATUS.HOLD_CONFLICT, 'tampered planning evidence hash fails closed');
check(tamperedPlanning.blockers.some((item) => item.startsWith('PLANNING_EVIDENCE_INTEGRITY_FAILED:')), 'tampering blocker is explicit');

throwsWith(() => assessPlanningEvidenceSet({
  caseId: 'CASE-OTHER', propertyRef: PROPERTY_REF, valuationDate: VALUATION_DATE, records,
  requiredConstraintTypes: REQUIRED, allowedAuthorityClasses: [PLANNING_AUTHORITY_CLASS.OFFICIAL_AUTHORITY], cardinalityByType: CARDINALITY,
}), 'CASE_OR_PROPERTY_ISOLATION_VIOLATION', 'cross-case planning evidence is rejected');

const propertyPacket = Object.freeze({
  schemaVersion: 1,
  caseId: CASE_ID,
  propertyRef: PROPERTY_REF,
  status: PROPERTY_EVIDENCE_PACKET_STATUS.READY_FOR_PROFESSIONAL_VALUATION_WORKFLOW,
  professionalValuationWorkflowReady: true,
  packetHashSha256: 'a'.repeat(64),
});

function review(outcome, name, evidenceRef) {
  if (outcome === HBU_GATE_OUTCOME.NOT_EVALUATED) return { outcome };
  return {
    outcome,
    rationale: `${name} synthetic professional assessment`,
    evidenceRefs: [evidenceRef],
    reviewedByRef: 'USER:HBU-REVIEWER',
    reviewedAt: '2026-09-07T10:00:00Z',
    reviewEvidenceRef: `review://${name}`,
  };
}

function candidate(id, proposedUse, financialOutcome = HBU_GATE_OUTCOME.PASS) {
  return createHbuScenarioCandidate({
    scenarioId: id,
    caseId: CASE_ID,
    propertyRef: PROPERTY_REF,
    proposedUse,
    currentUse: 'EXISTING_OFFICE',
    scenarioDescription: `${proposedUse} HBU candidate`,
    planningEvidenceSet: readyPlanning,
    propertyEvidencePacket: propertyPacket,
    legalPermissibilityReview: review(HBU_GATE_OUTCOME.PASS, `${id}-LEGAL`, 'evidence://planning'),
    physicalPossibilityReview: review(HBU_GATE_OUTCOME.PASS, `${id}-PHYSICAL`, 'evidence://inspection'),
    financialFeasibilityReview: review(financialOutcome, `${id}-FINANCIAL`, 'evidence://feasibility'),
    createdByRef: 'USER:HBU-ANALYST',
    createdAt: '2026-09-07T09:00:00Z',
    scenarioEvidenceRef: `evidence://${id}`,
  });
}

const officeCandidate = candidate('HBU-OFFICE', 'OFFICE');
const mixedCandidate = candidate('HBU-MIXED', 'MIXED_USE');
check(officeCandidate.status === HBU_CANDIDATE_STATUS.CANDIDATE_FOR_MAX_PRODUCTIVITY_COMPARISON, 'scenario passing first three HBU gates becomes candidate for max-productivity comparison');
check(verifyHbuScenarioCandidateIntegrity(officeCandidate), 'HBU candidate has deterministic integrity hash');
check(officeCandidate.maximallyProductiveDecisionRecorded === false && officeCandidate.highestAndBestUseConclusionEstablished === false, 'candidate does not prematurely establish HBU conclusion');
check(officeCandidate.automaticUseSelection === false && officeCandidate.valuationConclusionProduced === false, 'HBU candidate does not auto-select use or value');

const infeasibleCandidate = candidate('HBU-INFEASIBLE', 'HOTEL', HBU_GATE_OUTCOME.FAIL);
check(infeasibleCandidate.status === HBU_CANDIDATE_STATUS.HOLD_FINANCIAL_FEASIBILITY, 'financially infeasible use is held after sequential legal and physical gates');

throwsWith(() => createHbuScenarioCandidate({
  scenarioId: 'HBU-SEQUENCE', caseId: CASE_ID, propertyRef: PROPERTY_REF, proposedUse: 'RETAIL',
  scenarioDescription: 'Sequence violation', planningEvidenceSet: readyPlanning, propertyEvidencePacket: propertyPacket,
  legalPermissibilityReview: review(HBU_GATE_OUTCOME.FAIL, 'SEQ-LEGAL', 'evidence://planning'),
  physicalPossibilityReview: review(HBU_GATE_OUTCOME.PASS, 'SEQ-PHYSICAL', 'evidence://inspection'),
  financialFeasibilityReview: review(HBU_GATE_OUTCOME.NOT_EVALUATED, 'SEQ-FINANCIAL', 'evidence://feasibility'),
  createdByRef: 'USER:HBU-ANALYST', createdAt: '2026-09-07T09:00:00Z', scenarioEvidenceRef: 'evidence://sequence',
}), 'HBU_GATE_SEQUENCE_VIOLATION', 'physical gate cannot be evaluated before legal permissibility passes');

throwsWith(() => createHbuScenarioCandidate({
  scenarioId: 'HBU-SEQUENCE-2', caseId: CASE_ID, propertyRef: PROPERTY_REF, proposedUse: 'RETAIL',
  scenarioDescription: 'Sequence violation 2', planningEvidenceSet: readyPlanning, propertyEvidencePacket: propertyPacket,
  legalPermissibilityReview: review(HBU_GATE_OUTCOME.PASS, 'SEQ2-LEGAL', 'evidence://planning'),
  physicalPossibilityReview: review(HBU_GATE_OUTCOME.FAIL, 'SEQ2-PHYSICAL', 'evidence://inspection'),
  financialFeasibilityReview: review(HBU_GATE_OUTCOME.PASS, 'SEQ2-FINANCIAL', 'evidence://feasibility'),
  createdByRef: 'USER:HBU-ANALYST', createdAt: '2026-09-07T09:00:00Z', scenarioEvidenceRef: 'evidence://sequence2',
}), 'HBU_GATE_SEQUENCE_VIOLATION', 'financial feasibility cannot be evaluated before physical possibility passes');

const decision = recordMaximallyProductiveDecision({
  decisionId: 'HBU-DECISION-001',
  caseId: CASE_ID,
  propertyRef: PROPERTY_REF,
  candidates: [officeCandidate, mixedCandidate],
  selectedScenarioId: 'HBU-MIXED',
  comparisonBasis: 'Synthetic professional comparison using residual land-value indication and marketability evidence',
  comparativeMetrics: {
    'HBU-OFFICE': { metricName: 'SYNTHETIC_INDICATIVE_RESIDUAL', value: 95000000 },
    'HBU-MIXED': { metricName: 'SYNTHETIC_INDICATIVE_RESIDUAL', value: 110000000 },
  },
  rationale: 'Mixed use selected after accountable professional comparison of feasible candidates; metrics are synthetic test evidence.',
  evidenceRefs: ['evidence://hbu-comparison'],
  decidedByRef: 'USER:HBU-VALUER',
  decidedAt: '2026-09-07T11:00:00Z',
  decisionEvidenceRef: 'decision://hbu-001',
});
check(decision.status === HBU_DECISION_STATUS.HBU_CONCLUSION_RECORDED, 'maximally productive decision can be recorded only across feasible candidates');
check(decision.highestAndBestUseConclusionEstablished === true && decision.professionalJudgmentExplicit === true, 'HBU conclusion is an explicit accountable professional judgment');
check(decision.automaticUseSelection === false && decision.automaticMaxProductivityRanking === false, 'system does not auto-rank or auto-select HBU candidates');
check(decision.valuationConclusionProduced === false && decision.certifiedValuationEstablished === false && decision.transactionAuthorized === false, 'HBU conclusion creates no value certification or transaction authority');
check(/^[a-f0-9]{64}$/.test(decision.hbuDecisionHashSha256), 'HBU decision has deterministic SHA-256');

const badDecision = recordMaximallyProductiveDecision({
  decisionId: 'HBU-DECISION-HOLD', caseId: CASE_ID, propertyRef: PROPERTY_REF,
  candidates: [officeCandidate, infeasibleCandidate], selectedScenarioId: 'HBU-INFEASIBLE',
  comparisonBasis: 'Synthetic invalid comparison', comparativeMetrics: {}, rationale: 'Should be held',
  evidenceRefs: ['evidence://hold'], decidedByRef: 'USER:HBU-VALUER', decidedAt: '2026-09-07T11:00:00Z', decisionEvidenceRef: 'decision://hold',
});
check(badDecision.status === HBU_DECISION_STATUS.HOLD_CANDIDATES, 'infeasible candidate blocks maximally-productive decision');
check(badDecision.highestAndBestUseConclusionEstablished === false, 'held HBU decision produces no conclusion');

const tamperedCandidate = { ...officeCandidate, proposedUse: 'TAMPERED' };
const tamperedDecision = recordMaximallyProductiveDecision({
  decisionId: 'HBU-DECISION-TAMPER', caseId: CASE_ID, propertyRef: PROPERTY_REF,
  candidates: [tamperedCandidate, mixedCandidate], selectedScenarioId: 'HBU-MIXED',
  comparisonBasis: 'Synthetic tamper check', comparativeMetrics: {}, rationale: 'Tamper must hold',
  evidenceRefs: ['evidence://tamper'], decidedByRef: 'USER:HBU-VALUER', decidedAt: '2026-09-07T11:00:00Z', decisionEvidenceRef: 'decision://tamper',
});
check(tamperedDecision.status === HBU_DECISION_STATUS.HOLD_CANDIDATES, 'tampered HBU scenario integrity fails closed');
check(tamperedDecision.blockers.some((item) => item.startsWith('HBU_SCENARIO_INTEGRITY_FAILED:')), 'tampered HBU candidate blocker is explicit');

console.log(`WAVE_10A_HBU_PLANNING=PASS checks=${checks}`);
