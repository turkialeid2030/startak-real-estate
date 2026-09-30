'use strict';

const assert = require('assert/strict');
const {
  LEASE_EVIDENCE_SOURCE,
  LEASE_VERIFICATION_STATUS,
  ESCALATION_TYPE,
  RECOVERY_TYPE,
  createLeaseEvidenceRecord,
  createVerifiedRentRollSnapshot,
  reconcileLeaseIncomeEvidence,
} = require('../../src/market/lease-income-evidence');
const {
  POLICY_VERSION,
  INCOME_ASSET_STATUS,
  createGovernedTenantStrengthAssessment,
  tenantAssessmentBindings,
  computeIncomeAssetReviewPolicyHash,
  evaluateGovernedIncomeAssetIntelligence,
} = require('../../src/income/governed-income-asset-intelligence');

const CASE_ID = 'CASE-C11-001';
const PROPERTY_REF = 'PROPERTY-C11-001';
const AS_OF = '2026-09-07T00:00:00.000Z';
const POLICY_ID = 'C11-TEST-POLICY';

function verification(id) {
  return {
    status: LEASE_VERIFICATION_STATUS.VERIFIED,
    verifiedByRef: 'USER:C11-LEASE-REVIEWER',
    verifiedAt: '2026-09-06T10:00:00Z',
    evidenceRef: `verify://${id}`,
  };
}

function lease({
  leaseId,
  unitRef,
  tenantRef,
  areaSqm,
  annualRentSar,
  expiryDate,
  sourceHash,
} = {}) {
  return createLeaseEvidenceRecord({
    leaseId,
    caseId: CASE_ID,
    propertyRef: PROPERTY_REF,
    unitRef,
    tenantRef,
    leaseInterestRef: 'LEASEHOLD-OCCUPANCY',
    areaSqm,
    baseAnnualRentSar: annualRentSar,
    contractedAnnualRentSarAsOfDate: annualRentSar,
    startDate: '2025-01-01T00:00:00Z',
    expiryDate,
    escalation: { type: ESCALATION_TYPE.NONE },
    breakOptions: [],
    renewalOptions: [],
    incentives: [],
    recoveries: { type: RECOVERY_TYPE.NONE },
    sourceClass: LEASE_EVIDENCE_SOURCE.VERIFIED_EXECUTED_LEASE,
    sourceRef: `SOURCE-${leaseId}`,
    sourceDocumentHashSha256: sourceHash.repeat(64),
    verification: verification(leaseId),
    capturedAt: '2026-09-06T09:00:00Z',
  });
}

const l1 = lease({
  leaseId: 'L1', unitRef: 'U1', tenantRef: 'TENANT-A', areaSqm: 600,
  annualRentSar: 600000, expiryDate: '2027-09-07T00:00:00Z', sourceHash: 'a',
});
const l2 = lease({
  leaseId: 'L2', unitRef: 'U2', tenantRef: 'TENANT-B', areaSqm: 250,
  annualRentSar: 250000, expiryDate: '2030-12-31T23:59:59Z', sourceHash: 'b',
});
const l3 = lease({
  leaseId: 'L3', unitRef: 'U3', tenantRef: 'TENANT-B', areaSqm: 150,
  annualRentSar: 200000, expiryDate: '2031-12-31T23:59:59Z', sourceHash: 'c',
});

function rentRoll(overrides = {}) {
  return createVerifiedRentRollSnapshot({
    snapshotId: 'RR-C11-001',
    caseId: CASE_ID,
    propertyRef: PROPERTY_REF,
    asOfDate: AS_OF,
    totalLettableAreaSqm: 1200,
    occupiedAreaSqm: 1000,
    annualContractRentSar: 1050000,
    activeLeaseCount: 3,
    sourceRef: 'SOURCE-C11-RENT-ROLL',
    sourceDocumentHashSha256: 'd'.repeat(64),
    verification: verification('RR-C11'),
    capturedAt: '2026-09-06T09:00:00Z',
    ...overrides,
  });
}

function incomePacket(snapshot = rentRoll(), leaseRecords = [l1, l2, l3]) {
  return reconcileLeaseIncomeEvidence({
    caseId: CASE_ID,
    propertyRef: PROPERTY_REF,
    leaseRecords,
    rentRollSnapshot: snapshot,
    asOfDate: AS_OF,
    annualRentToleranceSar: 0,
    occupiedAreaToleranceSqm: 0,
  });
}

function assessment(tenantRef, band, hashChar) {
  return createGovernedTenantStrengthAssessment({
    assessmentId: `ASSESS-${tenantRef}`,
    caseId: CASE_ID,
    propertyRef: PROPERTY_REF,
    tenantRef,
    strengthBand: band,
    methodologyRef: 'METHOD:C11-PROFESSIONAL-TENANT-STRENGTH-V1',
    evidenceRefs: [`evidence://${tenantRef}/financials`, `evidence://${tenantRef}/review`],
    assessedByRef: 'USER:C11-CREDIT-REVIEWER',
    assessedAt: '2026-09-06T12:00:00Z',
    validUntil: '2027-09-06T23:59:59Z',
    reviewEvidenceRef: `review://${tenantRef}/${hashChar}`,
  });
}

const assessments = [
  assessment('TENANT-A', 'PROFESSIONALLY_REVIEWED_A', 'a'),
  assessment('TENANT-B', 'PROFESSIONALLY_REVIEWED_B', 'b'),
];

function policy(packet, snapshot, assessmentSet = assessments, overrides = {}) {
  const core = {
    version: POLICY_VERSION,
    policyId: POLICY_ID,
    caseId: CASE_ID,
    propertyRef: PROPERTY_REF,
    asOfDate: AS_OF,
    incomeEvidencePacketHashSha256: packet.incomeEvidencePacketHashSha256,
    rentRollHashSha256: snapshot.rentRollHashSha256,
    tenantAssessmentBindings: tenantAssessmentBindings(assessmentSet),
    minimumOccupancyRatio: 0.8,
    maximumTopTenantRentShare: 0.7,
    maximumTopThreeTenantRentShare: 1,
    expiryConcentrationRules: [
      { horizonMonths: 12, maximumRentShare: 0.6 },
      { horizonMonths: 60, maximumRentShare: 1 },
    ],
    reviewedByRef: 'USER:C11-ASSET-REVIEWER',
    reviewedAt: '2026-09-07T12:00:00Z',
    reviewEvidenceRef: 'review://c11/policy/001',
    ...overrides,
  };
  return { ...core, policyHashSha256: computeIncomeAssetReviewPolicyHash(core) };
}

function evaluate(packet, snapshot, assessmentSet, selectedPolicy) {
  return evaluateGovernedIncomeAssetIntelligence({
    incomeEvidencePacket: packet,
    rentRollSnapshot: snapshot,
    tenantStrengthAssessments: assessmentSet,
    reviewPolicyId: POLICY_ID,
    governedReviewPolicies: { [POLICY_ID]: selectedPolicy },
  });
}

const snapshot = rentRoll();
const packet = incomePacket(snapshot);
const basePolicy = policy(packet, snapshot);
const ready = evaluate(packet, snapshot, assessments, basePolicy);

assert.equal(ready.status, INCOME_ASSET_STATUS.READY_FOR_PROFESSIONAL_INCOME_ASSET_REVIEW);
assert.equal(ready.professionalIncomeAssetReviewReady, true);
assert.equal(ready.metrics.totalLettableAreaSqm, 1200);
assert.equal(ready.metrics.occupiedAreaSqm, 1000);
assert.equal(ready.metrics.vacantAreaSqm, 200);
assert.equal(ready.metrics.occupancyRatio, 1000 / 1200);
assert.equal(ready.metrics.annualContractRentSar, 1050000);
assert.equal(ready.metrics.annualRentPerOccupiedSqmSar, 1050);
assert.equal(ready.metrics.activeLeaseCount, 3);
assert.equal(ready.metrics.activeTenantCount, 2);
assert.equal(ready.tenants[0].tenantRef, 'TENANT-A');
assert.equal(ready.tenants[0].annualContractRentSar, 600000);
assert.equal(ready.tenants[1].annualContractRentSar, 450000);
assert.equal(ready.metrics.topTenantRentShare, 600000 / 1050000);
assert.equal(ready.metrics.topThreeTenantRentShare, 1);
assert.equal(ready.metrics.tenantRentHhi, (600000 / 1050000) ** 2 + (450000 / 1050000) ** 2);
assert.equal(ready.expiryConcentration[0].horizonMonths, 12);
assert.equal(ready.expiryConcentration[0].expiringAnnualRentSar, 600000, 'lease expiring exactly on horizon boundary is included');
assert.equal(ready.expiryConcentration[0].rentShare, 600000 / 1050000);
assert.equal(ready.expiryConcentration[0].boundarySemantics, 'expiryDate <= calendar-month-clamped horizonEnd');
assert.deepEqual(ready.riskFlags, []);
assert.equal(ready.tenantStrengthAutomaticallyScored, false);
assert.equal(ready.marketRentApplied, false);
assert.equal(ready.noiForecastGenerated, false);
assert.equal(ready.capitalizationPerformed, false);
assert.equal(ready.dcfPerformed, false);
assert.equal(ready.capRateDerived, false);
assert.equal(ready.discountRateDerived, false);
assert.equal(ready.certifiedValuationEstablished, false);
assert.equal(ready.automaticUnderwritingAdoption, false);
assert.equal(ready.transactionAuthorized, false);
assert.equal(ready.approvalAuthorized, false);
assert.equal(ready.productionAuthorityGranted, false);
assert.equal(ready.publicAiAuthorized, false);
assert.equal(ready.commercialGoLiveAuthorized, false);

const repeatA = evaluate(packet, snapshot, assessments, basePolicy);
const repeatB = evaluate(packet, snapshot, assessments, basePolicy);
assert.equal(JSON.stringify(repeatA), JSON.stringify(repeatB), 'identical C11 inputs must produce deterministic byte-identical JSON');

const heldUpstream = evaluateGovernedIncomeAssetIntelligence({
  incomeEvidencePacket: { ...packet, status: 'HOLD_RECONCILIATION', readyForIncomeAnalysisHandoff: false },
  rentRollSnapshot: snapshot,
  tenantStrengthAssessments: assessments,
  reviewPolicyId: POLICY_ID,
  governedReviewPolicies: { [POLICY_ID]: basePolicy },
});
assert.equal(heldUpstream.status, INCOME_ASSET_STATUS.HOLD_UPSTREAM_EVIDENCE);
assert.ok(heldUpstream.blockers.includes('C11_INCOME_EVIDENCE_PACKET_NOT_READY'));

const tamperedPacket = { ...packet, annualContractRentSar: packet.annualContractRentSar + 1 };
const packetHeld = evaluateGovernedIncomeAssetIntelligence({
  incomeEvidencePacket: tamperedPacket,
  rentRollSnapshot: snapshot,
  tenantStrengthAssessments: assessments,
  reviewPolicyId: POLICY_ID,
  governedReviewPolicies: { [POLICY_ID]: basePolicy },
});
assert.equal(packetHeld.status, INCOME_ASSET_STATUS.HOLD_INTEGRITY);
assert.ok(packetHeld.blockers.includes('C11_INCOME_EVIDENCE_PACKET_INTEGRITY_FAILED'));

const tamperedSnapshot = { ...snapshot, occupiedAreaSqm: 999 };
const snapshotHeld = evaluateGovernedIncomeAssetIntelligence({
  incomeEvidencePacket: packet,
  rentRollSnapshot: tamperedSnapshot,
  tenantStrengthAssessments: assessments,
  reviewPolicyId: POLICY_ID,
  governedReviewPolicies: { [POLICY_ID]: basePolicy },
});
assert.equal(snapshotHeld.status, INCOME_ASSET_STATUS.HOLD_INTEGRITY);
assert.ok(snapshotHeld.blockers.includes('C11_RENT_ROLL_INTEGRITY_FAILED'));

const missingTenantHeld = evaluate(packet, snapshot, [assessments[0]], policy(packet, snapshot, [assessments[0]]));
assert.equal(missingTenantHeld.status, INCOME_ASSET_STATUS.HOLD_TENANT_EVIDENCE);
assert.ok(missingTenantHeld.blockers.includes('C11_ACTIVE_TENANT_ASSESSMENT_MISSING:TENANT-B'));

const tamperedAssessment = { ...assessments[0], strengthBand: 'TAMPERED' };
const tamperedAssessmentHeld = evaluate(
  packet,
  snapshot,
  [tamperedAssessment, assessments[1]],
  policy(packet, snapshot, [tamperedAssessment, assessments[1]]),
);
assert.equal(tamperedAssessmentHeld.status, INCOME_ASSET_STATUS.HOLD_TENANT_EVIDENCE);
assert.ok(tamperedAssessmentHeld.blockers.includes('C11_TENANT_ASSESSMENT_INTEGRITY_FAILED:TENANT-A'));

const expiredAssessment = createGovernedTenantStrengthAssessment({
  assessmentId: 'ASSESS-TENANT-A-OLD',
  caseId: CASE_ID,
  propertyRef: PROPERTY_REF,
  tenantRef: 'TENANT-A',
  strengthBand: 'PROFESSIONALLY_REVIEWED_A',
  methodologyRef: 'METHOD:C11-PROFESSIONAL-TENANT-STRENGTH-V1',
  evidenceRefs: ['evidence://TENANT-A/old'],
  assessedByRef: 'USER:C11-CREDIT-REVIEWER',
  assessedAt: '2025-01-01T00:00:00Z',
  validUntil: '2026-09-06T23:59:59Z',
  reviewEvidenceRef: 'review://TENANT-A/old',
});
const expiredHeld = evaluate(
  packet,
  snapshot,
  [expiredAssessment, assessments[1]],
  policy(packet, snapshot, [expiredAssessment, assessments[1]]),
);
assert.equal(expiredHeld.status, INCOME_ASSET_STATUS.HOLD_TENANT_EVIDENCE);
assert.ok(expiredHeld.blockers.includes('C11_TENANT_ASSESSMENT_EXPIRED:TENANT-A'));

const duplicateTenantHeld = evaluate(
  packet,
  snapshot,
  [assessments[0], assessments[0], assessments[1]],
  policy(packet, snapshot, [assessments[0], assessments[0], assessments[1]]),
);
assert.equal(duplicateTenantHeld.status, INCOME_ASSET_STATUS.HOLD_TENANT_EVIDENCE);
assert.ok(duplicateTenantHeld.blockers.includes('C11_DUPLICATE_TENANT_ASSESSMENT:TENANT-A'));

const missingPolicy = evaluateGovernedIncomeAssetIntelligence({
  incomeEvidencePacket: packet,
  rentRollSnapshot: snapshot,
  tenantStrengthAssessments: assessments,
  reviewPolicyId: POLICY_ID,
  governedReviewPolicies: {},
});
assert.equal(missingPolicy.status, INCOME_ASSET_STATUS.HOLD_POLICY);
assert.ok(missingPolicy.blockers.includes(`C11_GOVERNED_POLICY_NOT_FOUND:${POLICY_ID}`));

const policyTamper = { ...basePolicy, maximumTopTenantRentShare: 0.1 };
const policyTamperHeld = evaluate(packet, snapshot, assessments, policyTamper);
assert.equal(policyTamperHeld.status, INCOME_ASSET_STATUS.HOLD_INTEGRITY);
assert.ok(policyTamperHeld.blockers.includes('C11_POLICY_INTEGRITY_HASH_MISMATCH'));

const wrongPacketHashCore = {
  ...basePolicy,
  incomeEvidencePacketHashSha256: 'f'.repeat(64),
};
delete wrongPacketHashCore.policyHashSha256;
const wrongPacketHashPolicy = {
  ...wrongPacketHashCore,
  policyHashSha256: computeIncomeAssetReviewPolicyHash(wrongPacketHashCore),
};
const wrongPacketHashHeld = evaluate(packet, snapshot, assessments, wrongPacketHashPolicy);
assert.equal(wrongPacketHashHeld.status, INCOME_ASSET_STATUS.HOLD_INTEGRITY);
assert.ok(wrongPacketHashHeld.blockers.includes('C11_POLICY_INCOME_EVIDENCE_HASH_MISMATCH'));

const malformedThresholdPolicy = policy(packet, snapshot, assessments, { minimumOccupancyRatio: 1.1 });
const malformedThresholdHeld = evaluate(packet, snapshot, assessments, malformedThresholdPolicy);
assert.equal(malformedThresholdHeld.status, INCOME_ASSET_STATUS.HOLD_POLICY);
assert.ok(malformedThresholdHeld.blockers.includes('C11_POLICY_MINIMUM_OCCUPANCY_RATIO_INVALID'));

const riskPolicy = policy(packet, snapshot, assessments, {
  minimumOccupancyRatio: 0.9,
  maximumTopTenantRentShare: 0.5,
  maximumTopThreeTenantRentShare: 0.99,
  expiryConcentrationRules: [{ horizonMonths: 12, maximumRentShare: 0.5 }],
});
const riskReady = evaluate(packet, snapshot, assessments, riskPolicy);
assert.equal(riskReady.status, INCOME_ASSET_STATUS.READY_FOR_PROFESSIONAL_INCOME_ASSET_REVIEW, 'economic risk flags do not masquerade as evidence-integrity holds');
assert.ok(riskReady.riskFlags.some((item) => item.startsWith('OCCUPANCY_BELOW_POLICY_MINIMUM:')));
assert.ok(riskReady.riskFlags.some((item) => item.startsWith('TOP_TENANT_RENT_SHARE_ABOVE_POLICY_MAXIMUM:')));
assert.ok(riskReady.riskFlags.some((item) => item.startsWith('TOP_THREE_TENANT_RENT_SHARE_ABOVE_POLICY_MAXIMUM:')));
assert.ok(riskReady.riskFlags.some((item) => item.startsWith('LEASE_EXPIRY_RENT_SHARE_ABOVE_POLICY_MAXIMUM:12:')));
assert.equal(riskReady.automaticAcquisitionRecommendation, false);
assert.equal(riskReady.decisionBinding, false);

const equalityPolicy = policy(packet, snapshot, assessments, {
  minimumOccupancyRatio: 1000 / 1200,
  maximumTopTenantRentShare: 600000 / 1050000,
  maximumTopThreeTenantRentShare: 1,
  expiryConcentrationRules: [{ horizonMonths: 12, maximumRentShare: 600000 / 1050000 }],
});
const equalityReady = evaluate(packet, snapshot, assessments, equalityPolicy);
assert.equal(equalityReady.status, INCOME_ASSET_STATUS.READY_FOR_PROFESSIONAL_INCOME_ASSET_REVIEW);
assert.deepEqual(equalityReady.riskFlags, [], 'policy boundaries are inclusive: equality to min/max is not a breach');

console.log('PASS c11_governed_income_asset_intelligence');
