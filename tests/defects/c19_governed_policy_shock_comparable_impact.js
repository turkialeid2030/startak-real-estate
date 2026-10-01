'use strict';

const assert = require('assert');
const {
  MARKET_EVIDENCE_LEVEL,
  MARKET_TRANSACTION_TYPE,
  MARKET_VERIFICATION_STATUS,
  createComparableEvidenceRecord,
} = require('../../src/market/comparable-evidence');
const {
  REVIEW_STATUS,
  SHOCK_CLASS,
  EVIDENCE_STATE,
  IMPACT_ACTION,
  ADJUSTMENT_DIRECTION,
  ADJUSTMENT_METHOD,
  createPolicyShockEvidence,
  createProfessionalComparableImpact,
  createPolicyShockReviewPolicy,
  evaluateGovernedPolicyShockComparableImpact,
} = require('../../src/market/governed-policy-shock-comparable-impact');

const H = 'a'.repeat(64);
const AS_OF = '2026-10-01T08:00:00Z';

function comparable(id, unitValue, transactionDate = '2026-08-01T00:00:00Z') {
  return createComparableEvidenceRecord({
    comparableId: id,
    caseId: 'CASE-C19',
    sourcePropertyRef: `PROP-${id}`,
    assetType: 'LAND',
    transactionType: MARKET_TRANSACTION_TYPE.SALE,
    evidenceLevel: MARKET_EVIDENCE_LEVEL.OFFICIAL_REGISTERED_TRANSACTION,
    sourceName: 'OFFICIAL_SOURCE',
    sourceRef: `SRC-${id}`,
    sourceDate: '2026-08-02T00:00:00Z',
    transactionDate,
    location: { city: 'Riyadh', district: 'Test' },
    areaSqm: 1000,
    amountSar: unitValue * 1000,
    verification: {
      status: MARKET_VERIFICATION_STATUS.VERIFIED,
      verifiedByRef: 'VERIFY-1',
      verifiedAt: '2026-08-03T00:00:00Z',
      evidenceRef: `EV-${id}`,
    },
    capturedAt: '2026-08-04T00:00:00Z',
  });
}

function shock(id, shockClass = SHOCK_CLASS.TRANSFER_COST_TAX_OR_FEE, effectiveAt = '2026-11-01T00:00:00Z') {
  return createPolicyShockEvidence({
    shockEvidenceId: id,
    caseId: 'CASE-C19',
    marketScopeRef: 'RIYADH-LAND',
    shockClass,
    evidenceState: EVIDENCE_STATE.SATISFIED,
    sourceCapability: 'C2S_GOVERNED_SOURCE_INTELLIGENCE',
    sourceRecordId: `REC-${id}`,
    sourceRecordHashSha256: H,
    sourceStatus: 'VERIFIED_EXTERNAL_EVIDENCE',
    sourceReference: `REF-${id}`,
    knownAt: '2026-09-20T00:00:00Z',
    effectiveAt,
    reviewedByRef: 'PROF-1',
    reviewEvidenceRef: `REVIEW-${id}`,
    reviewedAt: '2026-09-21T00:00:00Z',
    validUntil: '2027-01-01T00:00:00Z',
  });
}

function impact(id, c, s, action, extra = {}) {
  return createProfessionalComparableImpact({
    impactId: id,
    caseId: 'CASE-C19',
    comparableId: c.comparableId,
    comparableHashSha256: c.comparableHashSha256,
    shockEvidenceHashSha256: s.shockEvidenceHashSha256,
    action,
    rationaleRef: `RATIONALE-${id}`,
    preparedByRef: 'ANALYST-1',
    preparedAt: '2026-09-22T00:00:00Z',
    reviewedByRef: 'PROF-1',
    reviewedAt: '2026-09-23T00:00:00Z',
    reviewEvidenceRef: `REVIEW-IMPACT-${id}`,
    validUntil: '2027-01-01T00:00:00Z',
    ...extra,
  });
}

function policy(comparables, shocks, impacts, overrides = {}) {
  return createPolicyShockReviewPolicy({
    policyId: 'POL-C19',
    caseId: 'CASE-C19',
    marketScopeRef: 'RIYADH-LAND',
    allowedShockClasses: [SHOCK_CLASS.TRANSFER_COST_TAX_OR_FEE, SHOCK_CLASS.RENTAL_REGULATION],
    allowedImpactActions: Object.values(IMPACT_ACTION),
    shockEvidenceHashesSha256: shocks.map((s) => s.shockEvidenceHashSha256),
    comparableHashesSha256: comparables.map((c) => c.comparableHashSha256),
    impactHashesSha256: impacts.map((i) => i.impactHashSha256),
    requireFullComparableShockMatrix: true,
    reviewedByRef: 'PROF-1',
    reviewEvidenceRef: 'POLICY-REVIEW-1',
    reviewedAt: '2026-09-24T00:00:00Z',
    validUntil: '2027-01-01T00:00:00Z',
    ...overrides,
  });
}

const c1 = comparable('C1', 1000);
const c2 = comparable('C2', 1200);
const s1 = shock('S1');
const i1 = impact('I1', c1, s1, IMPACT_ACTION.APPLY_SCENARIO_ADJUSTMENT, {
  adjustmentDirection: ADJUSTMENT_DIRECTION.DECREASE,
  adjustmentMethod: ADJUSTMENT_METHOD.PERCENT_OF_BASE,
  adjustmentMagnitude: 0.05,
});
const i2 = impact('I2', c2, s1, IMPACT_ACTION.NO_SCENARIO_ADJUSTMENT);
const p1 = policy([c1, c2], [s1], [i1, i2]);

const ready = evaluateGovernedPolicyShockComparableImpact({ comparables: [c2, c1], shockEvidence: [s1], impacts: [i2, i1], reviewPolicy: p1, asOf: AS_OF });
assert.equal(ready.status, REVIEW_STATUS.READY_FOR_PROFESSIONAL_POLICY_SHOCK_REVIEW);
assert.equal(ready.blockers.length, 0);
assert.equal(ready.scenarioImpacts.length, 2);
assert.equal(ready.scenarioImpacts.find((x) => x.impactId === 'I1').scenarioUnitValueSarPerSqm, 950);
assert.equal(ready.scenarioImpacts.find((x) => x.impactId === 'I2').scenarioUnitValueSarPerSqm, 1200);
assert.equal(ready.legalApplicabilityDeterminedBySoftware, false);
assert.equal(ready.marketImpactEstimatedBySoftware, false);
assert.equal(ready.transactionAuthorized, false);

const readyAgain = evaluateGovernedPolicyShockComparableImpact({ comparables: [c1, c2], shockEvidence: [s1], impacts: [i1, i2], reviewPolicy: p1, asOf: AS_OF });
assert.deepStrictEqual(readyAgain, ready);

const exclusion = impact('I3', c1, s1, IMPACT_ACTION.PROFESSIONAL_SCENARIO_EXCLUSION);
const exclusionPolicy = policy([c1], [s1], [exclusion]);
const excluded = evaluateGovernedPolicyShockComparableImpact({ comparables: [c1], shockEvidence: [s1], impacts: [exclusion], reviewPolicy: exclusionPolicy, asOf: AS_OF });
assert.equal(excluded.status, REVIEW_STATUS.READY_FOR_PROFESSIONAL_POLICY_SHOCK_REVIEW);
assert.equal(excluded.scenarioImpacts[0].excludedFromScenarioByProfessional, true);
assert.equal(excluded.scenarioImpacts[0].scenarioUnitValueSarPerSqm, null);
assert.equal(excluded.automaticComparableExclusion, false);

const reviewOnly = impact('I4', c1, s1, IMPACT_ACTION.REVIEW_ONLY);
const reviewPolicy = policy([c1], [s1], [reviewOnly]);
const reviewed = evaluateGovernedPolicyShockComparableImpact({ comparables: [c1], shockEvidence: [s1], impacts: [reviewOnly], reviewPolicy, asOf: AS_OF });
assert.equal(reviewed.status, REVIEW_STATUS.READY_FOR_PROFESSIONAL_POLICY_SHOCK_REVIEW);
assert(reviewed.warnings.some((w) => w.includes('REVIEW_ONLY')));

const missingMatrixPolicy = policy([c1, c2], [s1], [i1], { requireFullComparableShockMatrix: true });
const missingMatrix = evaluateGovernedPolicyShockComparableImpact({ comparables: [c1, c2], shockEvidence: [s1], impacts: [i1], reviewPolicy: missingMatrixPolicy, asOf: AS_OF });
assert.equal(missingMatrix.status, REVIEW_STATUS.HOLD_COVERAGE);
assert.equal(missingMatrix.scenarioImpacts.length, 0);
assert(missingMatrix.blockers.some((b) => b.startsWith('C19_COVERAGE_MISSING_PAIR')));

const duplicatePair = impact('I5', c1, s1, IMPACT_ACTION.NO_SCENARIO_ADJUSTMENT);
const duplicatePairPolicy = policy([c1], [s1], [i1, duplicatePair]);
const dup = evaluateGovernedPolicyShockComparableImpact({ comparables: [c1], shockEvidence: [s1], impacts: [i1, duplicatePair], reviewPolicy: duplicatePairPolicy, asOf: AS_OF });
assert.equal(dup.status, REVIEW_STATUS.HOLD_COVERAGE);
assert(dup.blockers.some((b) => b.startsWith('C19_COVERAGE_DUPLICATE_PAIR')));

const futureShock = createPolicyShockEvidence({
  shockEvidenceId: 'S-FUTURE', caseId: 'CASE-C19', marketScopeRef: 'RIYADH-LAND', shockClass: SHOCK_CLASS.TRANSFER_COST_TAX_OR_FEE,
  evidenceState: EVIDENCE_STATE.SATISFIED, sourceCapability: 'C2S', sourceRecordId: 'RF', sourceRecordHashSha256: H,
  sourceStatus: 'VERIFIED', sourceReference: 'FUTURE', knownAt: '2026-10-02T00:00:00Z', effectiveAt: '2026-11-01T00:00:00Z',
  reviewedByRef: 'PROF', reviewEvidenceRef: 'REV', reviewedAt: '2026-10-02T01:00:00Z', validUntil: '2027-01-01T00:00:00Z',
});
const futureImpact = impact('I-FUTURE', c1, futureShock, IMPACT_ACTION.NO_SCENARIO_ADJUSTMENT);
const futurePolicy = policy([c1], [futureShock], [futureImpact], { reviewedAt: '2026-09-24T00:00:00Z' });
const future = evaluateGovernedPolicyShockComparableImpact({ comparables: [c1], shockEvidence: [futureShock], impacts: [futureImpact], reviewPolicy: futurePolicy, asOf: AS_OF });
assert.equal(future.status, REVIEW_STATUS.HOLD_WINDOW);
assert(future.blockers.some((b) => b.includes('SHOCK_NOT_KNOWN_AS_OF')));

const unresolvedShock = createPolicyShockEvidence({
  shockEvidenceId: 'S-UNRES', caseId: 'CASE-C19', marketScopeRef: 'RIYADH-LAND', shockClass: SHOCK_CLASS.RENTAL_REGULATION,
  evidenceState: EVIDENCE_STATE.UNRESOLVED, unresolvedReasonRef: 'PENDING-PROFESSIONAL-REVIEW', sourceCapability: 'C2S', sourceRecordId: 'RU', sourceRecordHashSha256: H,
  sourceStatus: 'PENDING', sourceReference: 'UNRES', knownAt: '2026-09-20T00:00:00Z', effectiveAt: '2026-11-01T00:00:00Z',
  reviewedByRef: 'PROF', reviewEvidenceRef: 'REV-U', reviewedAt: '2026-09-21T00:00:00Z', validUntil: '2027-01-01T00:00:00Z',
});
const unresolvedImpact = impact('I-UNRES', c1, unresolvedShock, IMPACT_ACTION.REVIEW_ONLY);
const unresolvedPolicy = policy([c1], [unresolvedShock], [unresolvedImpact]);
const unresolved = evaluateGovernedPolicyShockComparableImpact({ comparables: [c1], shockEvidence: [unresolvedShock], impacts: [unresolvedImpact], reviewPolicy: unresolvedPolicy, asOf: AS_OF });
assert.equal(unresolved.status, REVIEW_STATUS.HOLD_EVIDENCE);
assert.equal(unresolved.scenarioImpacts.length, 0);

const tamperedImpact = { ...i1, rationaleRef: 'TAMPERED' };
const tampered = evaluateGovernedPolicyShockComparableImpact({ comparables: [c1, c2], shockEvidence: [s1], impacts: [tamperedImpact, i2], reviewPolicy: p1, asOf: AS_OF });
assert.equal(tampered.status, REVIEW_STATUS.HOLD_INTEGRITY);
assert(tampered.blockers.some((b) => b.startsWith('C19_INTEGRITY_IMPACT')));

const wrongCaseComparable = { ...c1, caseId: 'OTHER' };
const wrongContext = evaluateGovernedPolicyShockComparableImpact({ comparables: [wrongCaseComparable], shockEvidence: [s1], impacts: [i1], reviewPolicy: policy([c1], [s1], [i1]), asOf: AS_OF });
assert.equal(wrongContext.status, REVIEW_STATUS.HOLD_INTEGRITY);
assert(wrongContext.blockers.some((b) => b.startsWith('C19_INTEGRITY_COMPARABLE')));

const nonPositiveImpact = impact('I-NP', c1, s1, IMPACT_ACTION.APPLY_SCENARIO_ADJUSTMENT, {
  adjustmentDirection: ADJUSTMENT_DIRECTION.DECREASE,
  adjustmentMethod: ADJUSTMENT_METHOD.AMOUNT_SAR_PER_SQM,
  adjustmentMagnitude: 1000,
});
const nonPositivePolicy = policy([c1], [s1], [nonPositiveImpact]);
const nonPositive = evaluateGovernedPolicyShockComparableImpact({ comparables: [c1], shockEvidence: [s1], impacts: [nonPositiveImpact], reviewPolicy: nonPositivePolicy, asOf: AS_OF });
assert.equal(nonPositive.status, REVIEW_STATUS.HOLD_CALCULATION);
assert.equal(nonPositive.scenarioImpacts.length, 0);

assert.throws(() => createProfessionalComparableImpact({
  impactId: 'BAD', caseId: 'CASE-C19', comparableId: c1.comparableId, comparableHashSha256: c1.comparableHashSha256,
  shockEvidenceHashSha256: s1.shockEvidenceHashSha256, action: IMPACT_ACTION.NO_SCENARIO_ADJUSTMENT,
  adjustmentDirection: ADJUSTMENT_DIRECTION.INCREASE, adjustmentMethod: ADJUSTMENT_METHOD.PERCENT_OF_BASE, adjustmentMagnitude: 0.1,
  rationaleRef: 'R', preparedByRef: 'A', preparedAt: '2026-09-20T00:00:00Z', reviewedByRef: 'B', reviewedAt: '2026-09-21T00:00:00Z', reviewEvidenceRef: 'E', validUntil: '2027-01-01T00:00:00Z',
}), /ADJUSTMENT_FIELDS_ONLY_FOR_APPLY_ACTION/);

console.log('C19_GOVERNED_POLICY_SHOCK_COMPARABLE_IMPACT=PASS');
