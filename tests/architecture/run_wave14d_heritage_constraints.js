'use strict';

const assert = require('assert');
const crypto = require('crypto');
const {
  SPECIALIZED_ASSET_CLASS,
  SPECIALIZED_OPERATING_STATE,
  SPECIALIZED_OPERATING_MODEL,
  SPECIALIZED_ANALYSIS_CONTEXT,
  SPECIALIZED_EVIDENCE_EXPECTATION,
  SPECIALIZED_EVIDENCE_ITEM_STATUS,
  SPECIALIZED_ASSET_PACKET_STATUS,
  expectationMatrix,
  createSpecializedEvidenceItem,
  buildSpecializedAssetEvidencePacket,
  verifySpecializedAssetEvidencePacketIntegrity,
} = require('../../src/specialized-assets/specialized-asset-evidence');
const {
  HERITAGE_CONSTRAINT_TYPE,
  HERITAGE_CONSTRAINT_STATUS,
  HERITAGE_IMPACT_DOMAIN,
  HERITAGE_CONSTRAINT_PACKET_STATUS,
  createHeritageConstraintRecord,
  verifyHeritageConstraintRecordIntegrity,
  isEffectiveAt,
  buildHeritageConstraintPacket,
  verifyHeritageConstraintPacketIntegrity,
} = require('../../src/specialized-assets/heritage-constraints');

let checks = 0;
const check = (value, message) => { assert.ok(value, message); checks += 1; };
const eq = (actual, expected, message) => { assert.strictEqual(actual, expected, message); checks += 1; };
const throws = (fn, pattern, message) => { assert.throws(fn, pattern, message); checks += 1; };

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((out, key) => { out[key] = stable(value[key]); return out; }, {});
}
const sha256 = (value) => crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');

function propertyPacket(assetType = 'HERITAGE_REAL_ESTATE') {
  const core = {
    schemaVersion: 1,
    caseId: 'CASE-14D',
    propertyRef: 'PROP-14D',
    assignmentRef: 'ASSIGN-14D',
    assignmentHashSha256: 'a'.repeat(64),
    inspectionId: 'INSP-14D',
    inspectionHashSha256: 'b'.repeat(64),
    valuationDate: '2026-01-01',
    reportDate: '2026-01-05',
    jurisdiction: 'SAUDI_ARABIA',
    assetType,
    assetLocation: 'Riyadh',
    valuedRights: { interest: 'FREEHOLD' },
    basisOfValue: { basis: 'MARKET_VALUE' },
    purpose: 'PROFESSIONAL_VALUATION',
    evidenceFacts: [{ key: 'heritage_asset', normalizedValue: true }],
    measurements: [],
    propertyDataGateStatus: 'CLEAR',
    measurementGateStatus: 'CLEAR',
  };
  return Object.freeze({
    ...core,
    packetHashSha256: sha256(core),
    status: 'READY_FOR_PROFESSIONAL_VALUATION_WORKFLOW',
    reasons: [],
    professionalValuationWorkflowReady: true,
    automaticUnderwritingAdoption: false,
    financialEngineInputsWritten: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
  });
}

function evidenceItem(topic, suffix = '') {
  return createSpecializedEvidenceItem({
    evidenceItemId: `SE-${topic}${suffix}`,
    caseId: 'CASE-14D',
    propertyRef: 'PROP-14D',
    topic,
    status: SPECIALIZED_EVIDENCE_ITEM_STATUS.VERIFIED,
    evidenceRefs: [`REF-${topic}${suffix}`],
    asOfDate: '2026-01-01',
    rationale: `Verified ${topic}`,
    preparedByRef: 'ANALYST-14D',
    preparedAt: '2026-01-02',
    reviewedByRef: 'REVIEWER-14D',
    reviewedAt: '2026-01-03',
    reviewEvidenceRef: `REVIEW-${topic}${suffix}`,
  });
}

function specializedPacket(assetClass = SPECIALIZED_ASSET_CLASS.HERITAGE_ASSET) {
  const matrix = expectationMatrix(
    assetClass,
    SPECIALIZED_OPERATING_STATE.VACANT,
    SPECIALIZED_OPERATING_MODEL.NOT_APPLICABLE,
  );
  const evidenceItems = [];
  const conditionalApplicability = {};
  for (const [topic, expectation] of Object.entries(matrix)) {
    if (expectation === SPECIALIZED_EVIDENCE_EXPECTATION.REQUIRED) evidenceItems.push(evidenceItem(topic));
    if (expectation === SPECIALIZED_EVIDENCE_EXPECTATION.CONDITIONAL) conditionalApplicability[topic] = false;
  }
  return buildSpecializedAssetEvidencePacket({
    specializationId: `SPEC-14D-${assetClass}`,
    caseId: 'CASE-14D',
    propertyRef: 'PROP-14D',
    assetClass,
    operatingState: SPECIALIZED_OPERATING_STATE.VACANT,
    operatingModel: SPECIALIZED_OPERATING_MODEL.NOT_APPLICABLE,
    analysisContext: SPECIALIZED_ANALYSIS_CONTEXT.PROFESSIONAL_VALUATION,
    propertyEvidencePacket: propertyPacket(assetClass === SPECIALIZED_ASSET_CLASS.HERITAGE_ASSET ? 'HERITAGE_REAL_ESTATE' : 'SPECIALIZED_REAL_ESTATE'),
    evidenceItems,
    conditionalApplicability,
    preparedByRef: 'ANALYST-14D',
    preparedAt: '2026-01-03',
    reviewedByRef: 'REVIEWER-14D-2',
    reviewedAt: '2026-01-04',
    reviewEvidenceRef: 'REVIEW-SPECIALIZED-14D',
  });
}

function constraint(type, overrides = {}) {
  const id = overrides.constraintId || `HC-${type}`;
  return createHeritageConstraintRecord({
    constraintId: id,
    caseId: 'CASE-14D',
    propertyRef: 'PROP-14D',
    type,
    status: HERITAGE_CONSTRAINT_STATUS.VERIFIED,
    statement: `Evidence-backed statement for ${type}`,
    impactDomains: [HERITAGE_IMPACT_DOMAIN.USE, HERITAGE_IMPACT_DOMAIN.COST],
    sourceRef: `SOURCE-${type}`,
    evidenceRefs: [`EVIDENCE-${type}`],
    asOfDate: '2026-01-01',
    validFrom: '2025-01-01',
    validTo: null,
    rationale: `Professional constraint rationale for ${type}`,
    preparedByRef: 'HERITAGE-ANALYST',
    preparedAt: '2026-01-02',
    reviewedByRef: 'HERITAGE-REVIEWER',
    reviewedAt: '2026-01-03',
    reviewEvidenceRef: `HERITAGE-REVIEW-${type}`,
    ...overrides,
  });
}

function packetInput(overrides = {}) {
  return {
    heritagePacketId: 'HP-14D',
    caseId: 'CASE-14D',
    propertyRef: 'PROP-14D',
    specializedAssetEvidencePacket: specializedPacket(),
    constraints: [
      constraint(HERITAGE_CONSTRAINT_TYPE.DESIGNATION_OR_RESTRICTION),
      constraint(HERITAGE_CONSTRAINT_TYPE.CONSERVATION_REQUIREMENT),
    ],
    adaptiveReuseProposed: false,
    preparedByRef: 'HERITAGE-ANALYST',
    preparedAt: '2026-01-04',
    reviewedByRef: 'HERITAGE-REVIEWER-2',
    reviewedAt: '2026-01-05',
    reviewEvidenceRef: 'HERITAGE-PACKET-REVIEW',
    ...overrides,
  };
}

const spec = specializedPacket();
eq(spec.status, SPECIALIZED_ASSET_PACKET_STATUS.READY_FOR_SPECIALIZED_ASSET_PROFESSIONAL_WORKFLOW, 'heritage specialized packet ready');
check(verifySpecializedAssetEvidencePacketIntegrity(spec), 'heritage specialized packet integrity verifies');

const designation = constraint(HERITAGE_CONSTRAINT_TYPE.DESIGNATION_OR_RESTRICTION);
check(verifyHeritageConstraintRecordIntegrity(designation), 'heritage constraint integrity verifies');
check(isEffectiveAt(designation, '2026-01-01'), 'constraint effective on valuation date');
check(!verifyHeritageConstraintRecordIntegrity({ ...designation, statement: 'tampered' }), 'tampered constraint integrity fails');

const ready = buildHeritageConstraintPacket(packetInput());
eq(ready.status, HERITAGE_CONSTRAINT_PACKET_STATUS.READY_FOR_HERITAGE_PROFESSIONAL_REVIEW, 'heritage constraint packet ready');
check(ready.readyForHeritageProfessionalReview, 'heritage professional review handoff ready');
check(verifyHeritageConstraintPacketIntegrity(ready), 'heritage packet integrity verifies');
check(Object.isFrozen(ready), 'heritage packet immutable');
eq(ready.legalInterpretationPerformed, false, 'no legal interpretation');
eq(ready.authorityApprovalEstablished, false, 'no authority approval established');
eq(ready.planningPermissionEstablished, false, 'no planning permission established');
eq(ready.valuationInputsWritten, false, 'no valuation inputs written');
eq(ready.valuationArithmeticPerformed, false, 'no valuation arithmetic');
eq(ready.adaptiveReuseFinancialFeasibilityPerformed, false, 'no adaptive reuse feasibility arithmetic');
eq(ready.certifiedValuationEstablished, false, 'no certified valuation');
eq(ready.transactionAuthorized, false, 'no transaction authority');
check(ready.impactSummary.USE.length >= 2, 'impact summary traces use constraints');
check(ready.impactSummary.COST.length >= 2, 'impact summary traces cost constraints');

const adaptiveHold = buildHeritageConstraintPacket(packetInput({ adaptiveReuseProposed: true }));
eq(adaptiveHold.status, HERITAGE_CONSTRAINT_PACKET_STATUS.HOLD_CONSTRAINT_EVIDENCE, 'adaptive reuse requires additional evidence-backed constraints');
check(adaptiveHold.blockers.includes(`REQUIRED_EFFECTIVE_HERITAGE_CONSTRAINT_MISSING:${HERITAGE_CONSTRAINT_TYPE.ADAPTIVE_REUSE_REQUIREMENT}`), 'adaptive reuse requirement blocker explicit');
check(adaptiveHold.blockers.includes(`REQUIRED_EFFECTIVE_HERITAGE_CONSTRAINT_MISSING:${HERITAGE_CONSTRAINT_TYPE.APPROVAL_OR_CONSENT}`), 'approval/consent evidence blocker explicit');

const adaptiveReady = buildHeritageConstraintPacket(packetInput({
  adaptiveReuseProposed: true,
  constraints: [
    constraint(HERITAGE_CONSTRAINT_TYPE.DESIGNATION_OR_RESTRICTION),
    constraint(HERITAGE_CONSTRAINT_TYPE.CONSERVATION_REQUIREMENT),
    constraint(HERITAGE_CONSTRAINT_TYPE.ADAPTIVE_REUSE_REQUIREMENT),
    constraint(HERITAGE_CONSTRAINT_TYPE.APPROVAL_OR_CONSENT),
  ],
}));
eq(adaptiveReady.status, HERITAGE_CONSTRAINT_PACKET_STATUS.READY_FOR_HERITAGE_PROFESSIONAL_REVIEW, 'adaptive reuse packet ready when required constraints verified');

const unverified = constraint(HERITAGE_CONSTRAINT_TYPE.DESIGNATION_OR_RESTRICTION, {
  status: HERITAGE_CONSTRAINT_STATUS.ASSUMED,
  constraintId: 'HC-DESIGNATION-ASSUMED',
});
const unverifiedHold = buildHeritageConstraintPacket(packetInput({
  constraints: [unverified, constraint(HERITAGE_CONSTRAINT_TYPE.CONSERVATION_REQUIREMENT)],
}));
eq(unverifiedHold.status, HERITAGE_CONSTRAINT_PACKET_STATUS.HOLD_CONSTRAINT_EVIDENCE, 'assumed designation cannot satisfy required heritage evidence');
check(unverifiedHold.blockers.includes(`REQUIRED_HERITAGE_CONSTRAINT_NOT_VERIFIED:${HERITAGE_CONSTRAINT_TYPE.DESIGNATION_OR_RESTRICTION}`), 'unverified designation blocker explicit');

const futureDesignation = constraint(HERITAGE_CONSTRAINT_TYPE.DESIGNATION_OR_RESTRICTION, {
  constraintId: 'HC-DESIGNATION-FUTURE',
  validFrom: '2027-01-01',
});
const futureHold = buildHeritageConstraintPacket(packetInput({
  constraints: [futureDesignation, constraint(HERITAGE_CONSTRAINT_TYPE.CONSERVATION_REQUIREMENT)],
}));
eq(futureHold.status, HERITAGE_CONSTRAINT_PACKET_STATUS.HOLD_CONSTRAINT_EVIDENCE, 'future constraint does not satisfy valuation-date requirement');
check(futureHold.warnings.includes('FUTURE_HERITAGE_CONSTRAINT_NOT_APPLIED:HC-DESIGNATION-FUTURE'), 'future constraint warning explicit');

const expiredConservation = constraint(HERITAGE_CONSTRAINT_TYPE.CONSERVATION_REQUIREMENT, {
  constraintId: 'HC-CONSERVATION-EXPIRED',
  validFrom: '2024-01-01',
  validTo: '2025-12-31',
});
const expiredHold = buildHeritageConstraintPacket(packetInput({
  constraints: [constraint(HERITAGE_CONSTRAINT_TYPE.DESIGNATION_OR_RESTRICTION), expiredConservation],
}));
eq(expiredHold.status, HERITAGE_CONSTRAINT_PACKET_STATUS.HOLD_CONSTRAINT_EVIDENCE, 'expired constraint does not satisfy valuation-date requirement');
check(expiredHold.warnings.includes('EXPIRED_HERITAGE_CONSTRAINT_NOT_APPLIED:HC-CONSERVATION-EXPIRED'), 'expired constraint warning explicit');

const duplicate = constraint(HERITAGE_CONSTRAINT_TYPE.DESIGNATION_OR_RESTRICTION, { constraintId: 'DUP' });
const duplicateHold = buildHeritageConstraintPacket(packetInput({
  constraints: [duplicate, duplicate, constraint(HERITAGE_CONSTRAINT_TYPE.CONSERVATION_REQUIREMENT)],
}));
eq(duplicateHold.status, HERITAGE_CONSTRAINT_PACKET_STATUS.HOLD_CONSTRAINT_EVIDENCE, 'duplicate constraint IDs fail closed');
check(duplicateHold.blockers.includes('DUPLICATE_HERITAGE_CONSTRAINT_ID:DUP'), 'duplicate blocker explicit');

const tampered = { ...designation, rationale: 'tampered' };
const integrityHold = buildHeritageConstraintPacket(packetInput({
  constraints: [tampered, constraint(HERITAGE_CONSTRAINT_TYPE.CONSERVATION_REQUIREMENT)],
}));
eq(integrityHold.status, HERITAGE_CONSTRAINT_PACKET_STATUS.HOLD_INTEGRITY, 'tampered heritage constraint fails closed');

const nonHeritage = buildHeritageConstraintPacket(packetInput({
  specializedAssetEvidencePacket: specializedPacket(SPECIALIZED_ASSET_CLASS.LEISURE_ATTRACTION),
}));
eq(nonHeritage.status, HERITAGE_CONSTRAINT_PACKET_STATUS.NOT_APPLICABLE_ASSET_CLASS, 'non-heritage asset class is not applicable');

const tamperedSpec = { ...spec, operatingState: SPECIALIZED_OPERATING_STATE.DEVELOPMENT };
const specHold = buildHeritageConstraintPacket(packetInput({ specializedAssetEvidencePacket: tamperedSpec }));
eq(specHold.status, HERITAGE_CONSTRAINT_PACKET_STATUS.HOLD_SPECIALIZED_PACKET, 'tampered specialized packet fails closed');

const crossCase = constraint(HERITAGE_CONSTRAINT_TYPE.DESIGNATION_OR_RESTRICTION, { caseId: 'OTHER-CASE', constraintId: 'HC-CROSS' });
throws(() => buildHeritageConstraintPacket(packetInput({ constraints: [crossCase] })), /CASE_OR_PROPERTY_ISOLATION_VIOLATION:heritageConstraint/, 'cross-case constraint rejected');

throws(() => constraint(HERITAGE_CONSTRAINT_TYPE.CONSERVATION_REQUIREMENT, { validFrom: '2026-01-01', validTo: '2025-01-01', constraintId: 'HC-BAD-DATES' }), /HERITAGE_CONSTRAINT_VALID_TO_BEFORE_VALID_FROM/, 'invalid validity interval rejected');
throws(() => constraint(HERITAGE_CONSTRAINT_TYPE.CONSERVATION_REQUIREMENT, { impactDomains: [], constraintId: 'HC-NO-IMPACT' }), /impactDomains must be a non-empty array/, 'empty impact domains rejected');

const reviewAfterPacket = constraint(HERITAGE_CONSTRAINT_TYPE.CONSERVATION_REQUIREMENT, {
  constraintId: 'HC-REVIEW-AFTER',
  reviewedAt: '2026-01-06',
});
const reviewHold = buildHeritageConstraintPacket(packetInput({
  constraints: [constraint(HERITAGE_CONSTRAINT_TYPE.DESIGNATION_OR_RESTRICTION), reviewAfterPacket],
}));
eq(reviewHold.status, HERITAGE_CONSTRAINT_PACKET_STATUS.HOLD_CONSTRAINT_EVIDENCE, 'constraint reviewed after packet review fails closed');
check(reviewHold.blockers.includes('HERITAGE_CONSTRAINT_REVIEW_AFTER_PACKET_REVIEW:HC-REVIEW-AFTER'), 'review timing blocker explicit');

check(!verifyHeritageConstraintPacketIntegrity({ ...ready, adaptiveReuseProposed: true }), 'tampered heritage packet integrity fails');

console.log(`WAVE_14D_HERITAGE_CONSTRAINTS=PASS checks=${checks}`);
