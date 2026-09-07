'use strict';

const assert = require('assert');
const crypto = require('crypto');
const {
  COMMERCIAL_ASSET_CLASS,
  OCCUPANCY_STRUCTURE,
  COMMERCIAL_ANALYSIS_CONTEXT,
  COMMERCIAL_EVIDENCE_TOPIC,
  EVIDENCE_EXPECTATION,
  EVIDENCE_ITEM_STATUS,
  expectationMatrix,
  createCommercialEvidenceItem,
  buildCommercialSpecializationPacket,
} = require('../../src/commercial/commercial-specialization');
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
  COMMERCIAL_OPERATING_METRICS_STATUS,
  EXPIRY_BUCKET,
  verifyRentRollSnapshotIntegrity,
  verifyIncomeEvidencePacketIntegrity,
  leaseEvidenceTopicQualified,
  aggregateTenants,
  buildCommercialOperatingMetrics,
  verifyCommercialOperatingMetricsIntegrity,
} = require('../../src/commercial/commercial-operating-metrics');

let checks = 0;
const check = (value, message) => { assert.ok(value, message); checks += 1; };
const eq = (actual, expected, message) => { assert.strictEqual(actual, expected, message); checks += 1; };
const near = (actual, expected, tolerance, message) => { assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: ${actual}`); checks += 1; };
const throws = (fn, pattern, message) => { assert.throws(fn, pattern, message); checks += 1; };

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((out, key) => { out[key] = stable(value[key]); return out; }, {});
}
const sha256 = (value) => crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');

function propertyPacket(occupancy) {
  const core = {
    schemaVersion: 1,
    caseId: 'CASE-13C',
    propertyRef: 'PROP-13C',
    assignmentRef: 'ASSIGN-13C',
    assignmentHashSha256: 'a'.repeat(64),
    inspectionId: 'INSP-13C',
    inspectionHashSha256: 'b'.repeat(64),
    valuationDate: '2026-01-01',
    reportDate: '2026-01-05',
    jurisdiction: 'SAUDI_ARABIA',
    assetType: 'COMMERCIAL',
    assetLocation: 'Riyadh',
    valuedRights: { interest: 'FREEHOLD' },
    basisOfValue: { basis: 'MARKET_VALUE' },
    purpose: 'PROFESSIONAL_VALUATION',
    evidenceFacts: [{ key: 'occupancy_structure', normalizedValue: occupancy }],
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

function evidenceItem(topic, occupancy) {
  return createCommercialEvidenceItem({
    evidenceItemId: `CE-${occupancy}-${topic}`,
    caseId: 'CASE-13C',
    propertyRef: 'PROP-13C',
    topic,
    status: EVIDENCE_ITEM_STATUS.VERIFIED,
    evidenceRefs: [`REF-${occupancy}-${topic}`],
    asOfDate: '2026-01-01',
    rationale: `Verified ${topic}`,
    preparedByRef: 'ANALYST-13C',
    preparedAt: '2026-01-02',
    reviewedByRef: 'REVIEWER-13C',
    reviewedAt: '2026-01-03',
    reviewEvidenceRef: `REVIEW-${occupancy}-${topic}`,
  });
}

function specialization(occupancy = OCCUPANCY_STRUCTURE.MULTI_TENANT) {
  const matrix = expectationMatrix(COMMERCIAL_ASSET_CLASS.OFFICE, occupancy);
  const evidenceItems = Object.entries(matrix)
    .filter(([, expectation]) => expectation === EVIDENCE_EXPECTATION.REQUIRED)
    .map(([topic]) => evidenceItem(topic, occupancy));
  const conditionalApplicability = {};
  for (const [topic, expectation] of Object.entries(matrix)) {
    if (expectation === EVIDENCE_EXPECTATION.CONDITIONAL) conditionalApplicability[topic] = false;
  }
  return buildCommercialSpecializationPacket({
    specializationId: `COMM-13C-${occupancy}`,
    caseId: 'CASE-13C',
    propertyRef: 'PROP-13C',
    commercialAssetClass: COMMERCIAL_ASSET_CLASS.OFFICE,
    occupancyStructure: occupancy,
    analysisContext: COMMERCIAL_ANALYSIS_CONTEXT.PROFESSIONAL_VALUATION,
    propertyEvidencePacket: propertyPacket(occupancy),
    evidenceItems,
    conditionalApplicability,
    preparedByRef: 'ANALYST-13C',
    preparedAt: '2026-01-03',
    reviewedByRef: 'REVIEWER-13C-2',
    reviewedAt: '2026-01-04',
    reviewEvidenceRef: `REVIEW-COMM-${occupancy}`,
  });
}

function lease({ id, unit, tenant, area, rent, expiry }) {
  return createLeaseEvidenceRecord({
    leaseId: id,
    caseId: 'CASE-13C',
    propertyRef: 'PROP-13C',
    unitRef: unit,
    tenantRef: tenant,
    leaseInterestRef: `LEASE-INTEREST-${id}`,
    areaSqm: area,
    baseAnnualRentSar: rent,
    contractedAnnualRentSarAsOfDate: rent,
    startDate: '2025-01-01',
    expiryDate: expiry,
    escalation: { type: ESCALATION_TYPE.NONE },
    breakOptions: [],
    renewalOptions: [],
    incentives: [],
    recoveries: { type: RECOVERY_TYPE.NONE },
    sourceClass: LEASE_EVIDENCE_SOURCE.VERIFIED_EXECUTED_LEASE,
    sourceRef: `LEASE-SOURCE-${id}`,
    sourceDocumentHashSha256: sha256(`DOC-${id}`),
    verification: {
      status: LEASE_VERIFICATION_STATUS.VERIFIED,
      verifiedByRef: 'LEASE-REVIEWER',
      verifiedAt: '2025-12-31T12:00:00Z',
      evidenceRef: `LEASE-VERIFY-${id}`,
    },
    capturedAt: '2025-12-31T10:00:00Z',
  });
}

const leases = [
  lease({ id: 'L1', unit: 'U1', tenant: 'T1', area: 400, rent: 400000, expiry: '2027-01-01' }),
  lease({ id: 'L2', unit: 'U2', tenant: 'T2', area: 300, rent: 300000, expiry: '2028-01-01' }),
  lease({ id: 'L3', unit: 'U3', tenant: 'T2', area: 100, rent: 100000, expiry: '2030-01-01' }),
  lease({ id: 'L4', unit: 'U4', tenant: 'T3', area: 200, rent: 200000, expiry: '2032-01-01' }),
];

const rentRoll = createVerifiedRentRollSnapshot({
  snapshotId: 'RR-13C',
  caseId: 'CASE-13C',
  propertyRef: 'PROP-13C',
  asOfDate: '2026-01-01',
  totalLettableAreaSqm: 1250,
  occupiedAreaSqm: 1000,
  annualContractRentSar: 1000000,
  activeLeaseCount: 4,
  sourceRef: 'RENT-ROLL-SOURCE',
  sourceDocumentHashSha256: sha256('RENT-ROLL-DOC'),
  verification: {
    status: LEASE_VERIFICATION_STATUS.VERIFIED,
    verifiedByRef: 'RR-REVIEWER',
    verifiedAt: '2026-01-01T12:00:00Z',
    evidenceRef: 'RR-VERIFY-EVIDENCE',
  },
  capturedAt: '2026-01-01T10:00:00Z',
});

const incomePacket = reconcileLeaseIncomeEvidence({
  caseId: 'CASE-13C',
  propertyRef: 'PROP-13C',
  leaseRecords: leases,
  rentRollSnapshot: rentRoll,
  asOfDate: '2026-01-01',
  annualRentToleranceSar: 0,
  occupiedAreaToleranceSqm: 0,
  requireVerifiedActiveLeases: true,
});

check(verifyRentRollSnapshotIntegrity(rentRoll), 'verified rent roll integrity');
check(verifyIncomeEvidencePacketIntegrity(incomePacket), 'verified income packet integrity');
eq(incomePacket.status, LEASE_INCOME_GATE_STATUS.READY_FOR_INCOME_ANALYSIS_HANDOFF, 'Wave 9C packet ready');

const multiTenant = specialization();
check(leaseEvidenceTopicQualified(multiTenant), 'commercial lease evidence topic qualified');
const tenantAggregates = aggregateTenants(incomePacket.activeLeases);
eq(tenantAggregates.length, 3, 'three unique tenants');
eq(tenantAggregates.find((item) => item.tenantRef === 'T2').leaseCount, 2, 'T2 has two leases');
eq(tenantAggregates.find((item) => item.tenantRef === 'T2').annualContractRentSar, 400000, 'T2 rent aggregated');

const metrics = buildCommercialOperatingMetrics({
  metricsPacketId: 'METRICS-13C',
  caseId: 'CASE-13C',
  propertyRef: 'PROP-13C',
  specializationPacket: multiTenant,
  incomeEvidencePacket: incomePacket,
  rentRollSnapshot: rentRoll,
  preparedByRef: 'ANALYST-13C',
  preparedAt: '2026-01-04',
  reviewedByRef: 'REVIEWER-13C-3',
  reviewedAt: '2026-01-05',
  reviewEvidenceRef: 'REVIEW-METRICS-13C',
});

eq(metrics.status, COMMERCIAL_OPERATING_METRICS_STATUS.READY, 'operating metrics ready');
eq(metrics.metrics.activeLeaseCount, 4, 'four active leases');
eq(metrics.metrics.tenantCount, 3, 'tenant count factual');
eq(metrics.metrics.occupiedAreaSqm, 1000, 'occupied area from reconciled leases');
eq(metrics.metrics.totalLettableAreaSqm, 1250, 'total lettable area from verified rent roll');
near(metrics.metrics.leaseDerivedOccupancyRate, 0.8, 1e-12, 'lease-derived occupancy rate');
eq(metrics.metrics.annualContractRentSar, 1000000, 'annual contractual rent');
near(metrics.metrics.weightedAverageContractRentSarPerSqmYear, 1000, 1e-9, 'weighted average contractual rent');
near(metrics.metrics.topTenantRentConcentration.top1, 0.4, 1e-12, 'top-1 rent concentration');
near(metrics.metrics.topTenantRentConcentration.top3, 1, 1e-12, 'top-3 rent concentration');
near(metrics.metrics.topTenantAreaConcentration.top1, 0.4, 1e-12, 'top-1 area concentration');
near(metrics.metrics.topTenantAreaConcentration.top3, 1, 1e-12, 'top-3 area concentration');
check(metrics.metrics.rentWeightedWaleYears > 2 && metrics.metrics.rentWeightedWaleYears < 4, 'rent-weighted WALE plausible');
check(metrics.metrics.areaWeightedWaleYears > 2 && metrics.metrics.areaWeightedWaleYears < 4, 'area-weighted WALE plausible');
const bucket1 = metrics.metrics.leaseExpiryProfile.find((bucket) => bucket.bucket === EXPIRY_BUCKET.WITHIN_1_YEAR);
const bucket3 = metrics.metrics.leaseExpiryProfile.find((bucket) => bucket.bucket === EXPIRY_BUCKET.ONE_TO_THREE_YEARS);
const bucket5 = metrics.metrics.leaseExpiryProfile.find((bucket) => bucket.bucket === EXPIRY_BUCKET.THREE_TO_FIVE_YEARS);
const bucketOver5 = metrics.metrics.leaseExpiryProfile.find((bucket) => bucket.bucket === EXPIRY_BUCKET.OVER_FIVE_YEARS);
eq(bucket1.leaseCount, 1, '<=1 year expiry bucket');
eq(bucket3.leaseCount, 1, '>1-3 year expiry bucket');
eq(bucket5.leaseCount, 1, '>3-5 year expiry bucket');
eq(bucketOver5.leaseCount, 1, '>5 year expiry bucket');
near(bucket1.rentShare, 0.4, 1e-12, '<=1 year rent share');
near(bucketOver5.areaShare, 0.2, 1e-12, '>5 year area share');
check(verifyCommercialOperatingMetricsIntegrity(metrics), 'operating metrics packet integrity verifies');
check(Object.isFrozen(metrics), 'operating metrics packet immutable');
eq(metrics.factualOperatingAnalyticsOnly, true, 'factual analytics only');
eq(metrics.contractualExpiryOnly, true, 'contractual expiry only');
eq(metrics.automaticRenewalOrBreakExercise, false, 'no option exercise');
eq(metrics.creditRatingProduced, false, 'no credit rating');
eq(metrics.tenantRiskGradeProduced, false, 'no tenant risk grade');
eq(metrics.defaultProbabilityEstimated, false, 'no default probability');
eq(metrics.valuationInputAdopted, false, 'no valuation input adoption');
eq(metrics.valuationArithmeticPerformed, false, 'no valuation arithmetic');
eq(metrics.investmentRecommendationProduced, false, 'no investment recommendation');
eq(metrics.legalLeaseInterpretationPerformed, false, 'no legal lease interpretation');
eq(metrics.certifiedValuationEstablished, false, 'no certified valuation');
eq(metrics.transactionAuthorized, false, 'no transaction authority');

const tamperedMetrics = { ...metrics, metrics: { ...metrics.metrics, tenantCount: 99 } };
check(!verifyCommercialOperatingMetricsIntegrity(tamperedMetrics), 'tampered metrics fail integrity');
const tamperedIncome = { ...incomePacket, annualContractRentSar: 999999 };
eq(buildCommercialOperatingMetrics({
  metricsPacketId: 'METRICS-TAMPER-INCOME', caseId: 'CASE-13C', propertyRef: 'PROP-13C', specializationPacket: multiTenant,
  incomeEvidencePacket: tamperedIncome, rentRollSnapshot: rentRoll, preparedByRef: 'A', preparedAt: '2026-01-04', reviewedByRef: 'R', reviewedAt: '2026-01-05', reviewEvidenceRef: 'REV',
}).status, COMMERCIAL_OPERATING_METRICS_STATUS.HOLD_INTEGRITY, 'tampered income packet fails closed');
const tamperedRoll = { ...rentRoll, totalLettableAreaSqm: 9999 };
eq(buildCommercialOperatingMetrics({
  metricsPacketId: 'METRICS-TAMPER-RR', caseId: 'CASE-13C', propertyRef: 'PROP-13C', specializationPacket: multiTenant,
  incomeEvidencePacket: incomePacket, rentRollSnapshot: tamperedRoll, preparedByRef: 'A', preparedAt: '2026-01-04', reviewedByRef: 'R', reviewedAt: '2026-01-05', reviewEvidenceRef: 'REV',
}).status, COMMERCIAL_OPERATING_METRICS_STATUS.HOLD_INTEGRITY, 'tampered rent roll fails closed');

const missingLeaseInputs = buildCommercialOperatingMetrics({
  metricsPacketId: 'METRICS-MISSING', caseId: 'CASE-13C', propertyRef: 'PROP-13C', specializationPacket: multiTenant,
  preparedByRef: 'A', preparedAt: '2026-01-04', reviewedByRef: 'R', reviewedAt: '2026-01-05', reviewEvidenceRef: 'REV',
});
eq(missingLeaseInputs.status, COMMERCIAL_OPERATING_METRICS_STATUS.HOLD_LEASE_EVIDENCE, 'occupied specialization requires lease inputs');

const vacant = specialization(OCCUPANCY_STRUCTURE.VACANT);
const vacantMetrics = buildCommercialOperatingMetrics({
  metricsPacketId: 'METRICS-VACANT', caseId: 'CASE-13C', propertyRef: 'PROP-13C', specializationPacket: vacant,
  preparedByRef: 'A', preparedAt: '2026-01-04', reviewedByRef: 'R', reviewedAt: '2026-01-05', reviewEvidenceRef: 'REV',
});
eq(vacantMetrics.status, COMMERCIAL_OPERATING_METRICS_STATUS.NOT_APPLICABLE_NO_LEASE_PORTFOLIO, 'vacant case does not fabricate lease metrics');
eq(vacantMetrics.metrics, null, 'vacant metrics are null not zeros');

const vacantConflict = buildCommercialOperatingMetrics({
  metricsPacketId: 'METRICS-VACANT-CONFLICT', caseId: 'CASE-13C', propertyRef: 'PROP-13C', specializationPacket: vacant,
  incomeEvidencePacket: incomePacket, rentRollSnapshot: rentRoll, preparedByRef: 'A', preparedAt: '2026-01-04', reviewedByRef: 'R', reviewedAt: '2026-01-05', reviewEvidenceRef: 'REV',
});
eq(vacantConflict.status, COMMERCIAL_OPERATING_METRICS_STATUS.HOLD_OCCUPANCY_STRUCTURE_CONFLICT, 'lease portfolio conflicts with vacant classification');

const tamperedSpecialization = { ...multiTenant, occupancyStructure: OCCUPANCY_STRUCTURE.SINGLE_TENANT };
eq(buildCommercialOperatingMetrics({
  metricsPacketId: 'METRICS-TAMPER-SP', caseId: 'CASE-13C', propertyRef: 'PROP-13C', specializationPacket: tamperedSpecialization,
  incomeEvidencePacket: incomePacket, rentRollSnapshot: rentRoll, preparedByRef: 'A', preparedAt: '2026-01-04', reviewedByRef: 'R', reviewedAt: '2026-01-05', reviewEvidenceRef: 'REV',
}).status, COMMERCIAL_OPERATING_METRICS_STATUS.HOLD_SPECIALIZATION_PACKET, 'tampered specialization fails closed');

throws(() => buildCommercialOperatingMetrics({
  metricsPacketId: 'METRICS-CROSS-CASE', caseId: 'CASE-13C', propertyRef: 'PROP-13C', specializationPacket: multiTenant,
  incomeEvidencePacket: { ...incomePacket, caseId: 'OTHER-CASE' }, rentRollSnapshot: rentRoll,
  preparedByRef: 'A', preparedAt: '2026-01-04', reviewedByRef: 'R', reviewedAt: '2026-01-05', reviewEvidenceRef: 'REV',
}), /CASE_OR_PROPERTY_ISOLATION_VIOLATION:leaseEvidence/, 'cross-case lease input rejected');

console.log(`WAVE_13C_COMMERCIAL_OPERATING_METRICS=PASS checks=${checks}`);
