'use strict';

const assert = require('assert');
const {
  EVIDENCE_GRADE,
  INPUT_STATUS,
  createEvidenceRecord,
  QUALITY_STATUS,
  profileEvidence,
  assessEvidenceQuality,
} = require('../../src/valuation-intelligence');

function record(field, grade, status) {
  return createEvidenceRecord({ field, grade, status, sourceType: 'SYNTHETIC_TEST_FIXTURE' });
}

const cleanEvidence = [
  record('titleDeed', EVIDENCE_GRADE.A_VERIFIED_OFFICIAL, INPUT_STATUS.VERIFIED),
  record('landArea', EVIDENCE_GRADE.A_VERIFIED_OFFICIAL, INPUT_STATUS.VERIFIED),
  record('marketComparable1', EVIDENCE_GRADE.B_VERIFIED_TRANSACTION, INPUT_STATUS.OBSERVED),
  record('marketComparable2', EVIDENCE_GRADE.E_MARKET_OBSERVATION, INPUT_STATUS.OBSERVED),
];

const profile = profileEvidence(cleanEvidence);
assert.strictEqual(profile.total, 4);
assert.strictEqual(profile.assumptionBurdenRatio, 0);
assert.strictEqual(profile.lowGradeRatio, 0);
assert.strictEqual(profile.conflictFields.length, 0);

const noPolicy = assessEvidenceQuality({ evidence: cleanEvidence });
assert.strictEqual(noPolicy.status, QUALITY_STATUS.UNRATED_POLICY_REQUIRED);

const policy = {
  minEvidenceCount: 3,
  maxAssumptionBurdenRatio: 0.25,
  maxLowGradeRatio: 0.25,
};
const criticalRequirements = [{
  field: 'titleDeed',
  allowedGrades: [EVIDENCE_GRADE.A_VERIFIED_OFFICIAL],
  allowedStatuses: [INPUT_STATUS.VERIFIED],
}];

const qualified = assessEvidenceQuality({ evidence: cleanEvidence, policy, criticalRequirements });
assert.strictEqual(qualified.status, QUALITY_STATUS.QUALIFIED);

const assumptionHeavy = [
  record('titleDeed', EVIDENCE_GRADE.A_VERIFIED_OFFICIAL, INPUT_STATUS.VERIFIED),
  record('rent', EVIDENCE_GRADE.G_EXPERT_ASSUMPTION, INPUT_STATUS.ASSUMED),
  record('opex', EVIDENCE_GRADE.G_EXPERT_ASSUMPTION, INPUT_STATUS.ASSUMED),
  record('leasableArea', EVIDENCE_GRADE.H_CLIENT_SUPPLIED_UNVERIFIED, INPUT_STATUS.UNVERIFIED),
];
const assumptionHold = assessEvidenceQuality({ evidence: assumptionHeavy, policy, criticalRequirements });
assert.strictEqual(assumptionHold.status, QUALITY_STATUS.HOLD_ASSUMPTION_BURDEN);
assert.strictEqual(assumptionHold.profile.assumptionBurdenRatio, 0.75);

const criticalMissing = assessEvidenceQuality({
  evidence: [record('landArea', EVIDENCE_GRADE.A_VERIFIED_OFFICIAL, INPUT_STATUS.VERIFIED)],
  policy: { ...policy, minEvidenceCount: 1 },
  criticalRequirements,
});
assert.strictEqual(criticalMissing.status, QUALITY_STATUS.HOLD_CRITICAL_FACT);
assert.strictEqual(criticalMissing.failures[0].field, 'titleDeed');

const criticalWeak = assessEvidenceQuality({
  evidence: [record('titleDeed', EVIDENCE_GRADE.H_CLIENT_SUPPLIED_UNVERIFIED, INPUT_STATUS.UNVERIFIED)],
  policy: { ...policy, minEvidenceCount: 1, maxAssumptionBurdenRatio: 1, maxLowGradeRatio: 1 },
  criticalRequirements,
});
assert.strictEqual(criticalWeak.status, QUALITY_STATUS.HOLD_CRITICAL_FACT);

const conflict = assessEvidenceQuality({
  evidence: [
    record('streetWidth', EVIDENCE_GRADE.A_VERIFIED_OFFICIAL, INPUT_STATUS.CONFLICT),
    record('streetWidth', EVIDENCE_GRADE.E_MARKET_OBSERVATION, INPUT_STATUS.CONFLICT),
  ],
  policy: { ...policy, minEvidenceCount: 1, maxAssumptionBurdenRatio: 1, maxLowGradeRatio: 1 },
});
assert.strictEqual(conflict.status, QUALITY_STATUS.HOLD_CONFLICT);
assert.deepStrictEqual(conflict.profile.conflictFields, ['streetWidth']);

const lowGradeObserved = [
  record('a', EVIDENCE_GRADE.A_VERIFIED_OFFICIAL, INPUT_STATUS.VERIFIED),
  record('b', EVIDENCE_GRADE.G_EXPERT_ASSUMPTION, INPUT_STATUS.OBSERVED),
  record('c', EVIDENCE_GRADE.H_CLIENT_SUPPLIED_UNVERIFIED, INPUT_STATUS.OBSERVED),
  record('d', EVIDENCE_GRADE.E_MARKET_OBSERVATION, INPUT_STATUS.OBSERVED),
];
const lowGradeHold = assessEvidenceQuality({
  evidence: lowGradeObserved,
  policy: { minEvidenceCount: 1, maxAssumptionBurdenRatio: 1, maxLowGradeRatio: 0.25 },
});
assert.strictEqual(lowGradeHold.status, QUALITY_STATUS.HOLD_LOW_GRADE_BURDEN);
assert.strictEqual(lowGradeHold.profile.lowGradeRatio, 0.5);

console.log('EVIDENCE_QUALITY_PROFILE=PASS');
console.log('ASSUMPTION_BURDEN_GATE=PASS');
console.log('CRITICAL_FACT_GATE=PASS');
console.log('NO_FAKE_CONFIDENCE_PERCENTAGE=PASS');
