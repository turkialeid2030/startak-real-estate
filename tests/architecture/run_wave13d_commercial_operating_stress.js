'use strict';

const assert = require('assert');
const crypto = require('crypto');
const { SCENARIO_KIND } = require('../../src/scenario-risk');
const {
  COMMERCIAL_ASSET_CLASS,
  OCCUPANCY_STRUCTURE,
  COMMERCIAL_ANALYSIS_CONTEXT,
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
  buildCommercialOperatingMetrics,
  verifyCommercialOperatingMetricsIntegrity,
} = require('../../src/commercial/commercial-operating-metrics');
const {
  COMMERCIAL_STRESS_MODE,
  COMMERCIAL_STRESS_ASSUMPTION_ORIGIN,
  COMMERCIAL_OPERATING_STRESS_STATUS,
  createCommercialStressScenario,
  verifyCommercialStressScenarioIntegrity,
  evaluateScenario,
  buildCommercialOperatingStressPacket,
  verifyCommercialOperatingStressIntegrity,
} = require('../../src/commercial/commercial-operating-stress');

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

function propertyPacket(occupancy = OCCUPANCY_STRUCTURE.MULTI_TENANT) {
  const core = {
    schemaVersion: 1,
    caseId: 'CASE-13D',
    propertyRef: 'PROP-13D',
    assignmentRef: 'ASSIGN-13D',
    assignmentHashSha256: 'a'.repeat(64),
    inspectionId: 'INSP-13D',
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

function specialization(occupancy = OCCUPANCY_STRUCTURE.MULTI_TENANT) {
  const matrix = expectationMatrix(COMMERCIAL_ASSET_CLASS.OFFICE, occupancy);
  const evidenceItems = Object.entries(matrix)
    .filter(([, expectation]) => expectation === EVIDENCE_EXPECTATION.REQUIRED)
    .map(([topic]) => createCommercialEvidenceItem({
      evidenceItemId: `E-${occupancy}-${topic}`,
      caseId: 'CASE-13D',
      propertyRef: 'PROP-13D',
      topic,
      status: EVIDENCE_ITEM_STATUS.VERIFIED,
      evidenceRefs: [`REF-${occupancy}-${topic}`],
      asOfDate: '2026-01-01',
      rationale: `Verified ${topic}`,
      preparedByRef: 'ANALYST-13D',
      preparedAt: '2026-01-02',
      reviewedByRef: 'REVIEWER-13D',
      reviewedAt: '2026-01-03',
      reviewEvidenceRef: `REV-${occupancy}-${topic}`,
    }));
  const conditionalApplicability = {};
  for (const [topic, expectation] of Object.entries(matrix)) {
    if (expectation === EVIDENCE_EXPECTATION.CONDITIONAL) conditionalApplicability[topic] = false;
  }
  return buildCommercialSpecializationPacket({
    specializationId: `SP-13D-${occupancy}`,
    caseId: 'CASE-13D',
    propertyRef: 'PROP-13D',
    commercialAssetClass: COMMERCIAL_ASSET_CLASS.OFFICE,
    occupancyStructure: occupancy,
    analysisContext: COMMERCIAL_ANALYSIS_CONTEXT.PROFESSIONAL_VALUATION,
    propertyEvidencePacket: propertyPacket(occupancy),
    evidenceItems,
    conditionalApplicability,
    preparedByRef: 'ANALYST-13D',
    preparedAt: '2026-01-03',
    reviewedByRef: 'REVIEWER-13D-2',
    reviewedAt: '2026-01-04',
    reviewEvidenceRef: `REV-SP-${occupancy}`,
  });
}

function lease({ id, unit, tenant, area, rent, expiry }) {
  return createLeaseEvidenceRecord({
    leaseId: id,
    caseId: 'CASE-13D',
    propertyRef: 'PROP-13D',
    unitRef: unit,
    tenantRef: tenant,
    leaseInterestRef: `INTEREST-${id}`,
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
    sourceRef: `SOURCE-${id}`,
    sourceDocumentHashSha256: sha256(`DOC-${id}`),
    verification: {
      status: LEASE_VERIFICATION_STATUS.VERIFIED,
      verifiedByRef: 'LEASE-REVIEWER',
      verifiedAt: '2025-12-31T12:00:00Z',
      evidenceRef: `VERIFY-${id}`,
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
  snapshotId: 'RR-13D',
  caseId: 'CASE-13D',
  propertyRef: 'PROP-13D',
  asOfDate: '2026-01-01',
  totalLettableAreaSqm: 1250,
  occupiedAreaSqm: 1000,
  annualContractRentSar: 1000000,
  activeLeaseCount: 4,
  sourceRef: 'RR-SOURCE-13D',
  sourceDocumentHashSha256: sha256('RR-DOC-13D'),
  verification: {
    status: LEASE_VERIFICATION_STATUS.VERIFIED,
    verifiedByRef: 'RR-REVIEWER',
    verifiedAt: '2026-01-01T12:00:00Z',
    evidenceRef: 'RR-VERIFY-13D',
  },
  capturedAt: '2026-01-01T10:00:00Z',
});

const incomePacket = reconcileLeaseIncomeEvidence({
  caseId: 'CASE-13D',
  propertyRef: 'PROP-13D',
  leaseRecords: leases,
  rentRollSnapshot: rentRoll,
  asOfDate: '2026-01-01',
  annualRentToleranceSar: 0,
  occupiedAreaToleranceSqm: 0,
  requireVerifiedActiveLeases: true,
});

const specializationPacket = specialization();
const operatingMetrics = buildCommercialOperatingMetrics({
  metricsPacketId: 'METRICS-13D',
  caseId: 'CASE-13D',
  propertyRef: 'PROP-13D',
  specializationPacket,
  incomeEvidencePacket: incomePacket,
  rentRollSnapshot: rentRoll,
  preparedByRef: 'ANALYST-13D',
  preparedAt: '2026-01-04',
  reviewedByRef: 'REVIEWER-13D-3',
  reviewedAt: '2026-01-05',
  reviewEvidenceRef: 'REV-METRICS-13D',
});

eq(operatingMetrics.status, COMMERCIAL_OPERATING_METRICS_STATUS.READY, 'Wave 13C source metrics ready');
check(verifyCommercialOperatingMetricsIntegrity(operatingMetrics), 'Wave 13C source metrics integrity');

function scenario({ id, kind = SCENARIO_KIND.DOWNSIDE, label = id, mode, tenants = [], leases: leaseIds = [], window = null }) {
  return createCommercialStressScenario({
    scenarioId: id,
    kind,
    label,
    mode,
    selectedTenantRefs: tenants,
    selectedLeaseIds: leaseIds,
    expiryWindowYears: window,
    assumptionOrigin: COMMERCIAL_STRESS_ASSUMPTION_ORIGIN.PROFESSIONAL_JUDGMENT,
    rationale: `Reviewed hypothetical stress assumption for ${id}`,
    assumptionRefs: [`ASSUMPTION-${id}`],
    preparedByRef: 'ANALYST-13D',
    preparedAt: '2026-01-05T09:00:00Z',
    reviewedByRef: 'REVIEWER-13D-4',
    reviewedAt: '2026-01-05T10:00:00Z',
    reviewEvidenceRef: `REV-${id}`,
  });
}

const tenantExit = scenario({ id: 'S-T1', mode: COMMERCIAL_STRESS_MODE.SELECTED_TENANT_EXIT, tenants: ['T1'] });
const expiry2y = scenario({ id: 'S-EXP2', mode: COMMERCIAL_STRESS_MODE.EXPIRY_NON_RENEWAL_WINDOW, window: 2 });
const combined = scenario({ id: 'S-COMBINED', kind: SCENARIO_KIND.SEVERE_DOWNSIDE, mode: COMMERCIAL_STRESS_MODE.COMBINED, tenants: ['T2'], window: 1 });
const leaseExit = scenario({ id: 'S-L4', kind: SCENARIO_KIND.CUSTOM, mode: COMMERCIAL_STRESS_MODE.SELECTED_LEASE_EXIT, leases: ['L4'] });
const overlap = scenario({ id: 'S-OVERLAP', mode: COMMERCIAL_STRESS_MODE.COMBINED, tenants: ['T1'], window: 1 });

for (const s of [tenantExit, expiry2y, combined, leaseExit, overlap]) check(verifyCommercialStressScenarioIntegrity(s), `scenario integrity ${s.scenarioId}`);
eq(tenantExit.probabilityAssigned, false, 'no probability assigned to tenant exit');
eq(tenantExit.tenantCreditEventPredicted, false, 'tenant exit is not a predicted credit event');
eq(tenantExit.legalLeaseInterpretationPerformed, false, 'tenant exit is not legal interpretation');

const tenantEval = evaluateScenario({
  scenario: tenantExit,
  activeLeases: incomePacket.activeLeases,
  totalLettableAreaSqm: 1250,
  baseOccupiedAreaSqm: 1000,
  baseAnnualContractRentSar: 1000000,
  asOfDate: '2026-01-01',
});
eq(tenantEval.blockers.length, 0, 'tenant exit has no blockers');
eq(tenantEval.result.impact.affectedLeaseCount, 1, 'T1 exit affects one lease');
eq(tenantEval.result.impact.affectedAreaSqm, 400, 'T1 exit removes 400 sqm');
eq(tenantEval.result.impact.annualContractRentRemovedSar, 400000, 'T1 exit removes 400k rent');
eq(tenantEval.result.stressed.occupiedAreaSqm, 600, 'T1 stressed occupied area');
near(tenantEval.result.stressed.occupancyRate, 0.48, 1e-12, 'T1 stressed occupancy');
eq(tenantEval.result.stressed.annualContractRentSar, 600000, 'T1 stressed annual rent');
near(tenantEval.result.stressed.rentRetentionRate, 0.6, 1e-12, 'T1 rent retention');
near(tenantEval.result.impact.occupancyRateDelta, -0.32, 1e-12, 'T1 occupancy delta');

const expiryEval = evaluateScenario({
  scenario: expiry2y, activeLeases: incomePacket.activeLeases, totalLettableAreaSqm: 1250,
  baseOccupiedAreaSqm: 1000, baseAnnualContractRentSar: 1000000, asOfDate: '2026-01-01',
});
eq(expiryEval.result.impact.affectedLeaseCount, 2, '2-year expiry window affects L1 and L2');
eq(expiryEval.result.impact.affectedAreaSqm, 700, '2-year expiry window removes 700 sqm');
eq(expiryEval.result.impact.annualContractRentRemovedSar, 700000, '2-year expiry window removes 700k');
eq(expiryEval.result.stressed.occupiedAreaSqm, 300, '2-year stressed occupied area');
near(expiryEval.result.stressed.occupancyRate, 0.24, 1e-12, '2-year stressed occupancy');
eq(expiryEval.result.stressed.annualContractRentSar, 300000, '2-year stressed rent');

const combinedEval = evaluateScenario({
  scenario: combined, activeLeases: incomePacket.activeLeases, totalLettableAreaSqm: 1250,
  baseOccupiedAreaSqm: 1000, baseAnnualContractRentSar: 1000000, asOfDate: '2026-01-01',
});
eq(combinedEval.result.impact.affectedLeaseCount, 3, 'combined T2 plus <=1y affects L1/L2/L3');
eq(combinedEval.result.impact.affectedAreaSqm, 800, 'combined stress removes 800 sqm');
eq(combinedEval.result.impact.annualContractRentRemovedSar, 800000, 'combined stress removes 800k');
eq(combinedEval.result.stressed.occupiedAreaSqm, 200, 'combined stressed occupied area');
near(combinedEval.result.stressed.occupancyRate, 0.16, 1e-12, 'combined stressed occupancy');
eq(combinedEval.result.stressed.annualContractRentSar, 200000, 'combined stressed rent');

const leaseEval = evaluateScenario({
  scenario: leaseExit, activeLeases: incomePacket.activeLeases, totalLettableAreaSqm: 1250,
  baseOccupiedAreaSqm: 1000, baseAnnualContractRentSar: 1000000, asOfDate: '2026-01-01',
});
eq(leaseEval.result.impact.affectedLeaseCount, 1, 'L4 stress affects one lease');
eq(leaseEval.result.impact.annualContractRentRemovedSar, 200000, 'L4 stress removes 200k');

const overlapEval = evaluateScenario({
  scenario: overlap, activeLeases: incomePacket.activeLeases, totalLettableAreaSqm: 1250,
  baseOccupiedAreaSqm: 1000, baseAnnualContractRentSar: 1000000, asOfDate: '2026-01-01',
});
eq(overlapEval.result.impact.affectedLeaseCount, 1, 'overlap does not double-count same lease');
eq(overlapEval.result.affectedLeases[0].causes.length, 2, 'overlap preserves both stress causes');
check(overlapEval.result.affectedLeases[0].causes.includes('SELECTED_TENANT_EXIT'), 'overlap records tenant cause');
check(overlapEval.result.affectedLeases[0].causes.includes('EXPIRY_NON_RENEWAL_WINDOW'), 'overlap records expiry cause');

const packet = buildCommercialOperatingStressPacket({
  stressPacketId: 'STRESS-13D',
  caseId: 'CASE-13D',
  propertyRef: 'PROP-13D',
  operatingMetricsPacket: operatingMetrics,
  incomeEvidencePacket: incomePacket,
  rentRollSnapshot: rentRoll,
  scenarios: [tenantExit, expiry2y, combined, leaseExit, overlap],
  preparedByRef: 'ANALYST-13D',
  preparedAt: '2026-01-05T11:00:00Z',
  reviewedByRef: 'REVIEWER-13D-5',
  reviewedAt: '2026-01-05T12:00:00Z',
  reviewEvidenceRef: 'REV-STRESS-13D',
});
eq(packet.status, COMMERCIAL_OPERATING_STRESS_STATUS.READY, 'commercial operating stress packet ready');
eq(packet.scenarioResults.length, 5, 'all five scenarios evaluated');
check(verifyCommercialOperatingStressIntegrity(packet), 'stress packet integrity verifies');
check(Object.isFrozen(packet), 'stress packet immutable');
eq(packet.scenarioAnalysisOnly, true, 'scenario analysis only');
eq(packet.probabilitiesAssigned, false, 'no probabilities assigned');
eq(packet.tenantCreditRatingProduced, false, 'no tenant credit rating');
eq(packet.defaultProbabilityEstimated, false, 'no default probability');
eq(packet.contractualRenewalPredicted, false, 'no contractual renewal prediction');
eq(packet.legalLeaseInterpretationPerformed, false, 'no legal lease interpretation');
eq(packet.valuationInputsWritten, false, 'no valuation input write');
eq(packet.valuationArithmeticPerformed, false, 'no valuation arithmetic');
eq(packet.noiForecastProduced, false, 'no NOI forecast');
eq(packet.investmentRecommendationProduced, false, 'no investment recommendation');
eq(packet.certifiedValuationEstablished, false, 'no certified valuation');
eq(packet.transactionAuthorized, false, 'no transaction authority');

const tamperedPacket = { ...packet, scenarioResults: packet.scenarioResults.map((row, index) => index === 0 ? { ...row, stressed: { ...row.stressed, annualContractRentSar: 1 } } : row) };
check(!verifyCommercialOperatingStressIntegrity(tamperedPacket), 'tampered stress packet fails integrity');

const unknownTenant = scenario({ id: 'S-UNKNOWN', mode: COMMERCIAL_STRESS_MODE.SELECTED_TENANT_EXIT, tenants: ['NO-SUCH-TENANT'] });
eq(buildCommercialOperatingStressPacket({
  stressPacketId: 'STRESS-UNKNOWN', caseId: 'CASE-13D', propertyRef: 'PROP-13D', operatingMetricsPacket: operatingMetrics,
  incomeEvidencePacket: incomePacket, rentRollSnapshot: rentRoll, scenarios: [unknownTenant], preparedByRef: 'A', preparedAt: '2026-01-05T11:00:00Z',
  reviewedByRef: 'R', reviewedAt: '2026-01-05T12:00:00Z', reviewEvidenceRef: 'REV',
}).status, COMMERCIAL_OPERATING_STRESS_STATUS.HOLD_SCENARIO_ASSUMPTIONS, 'unknown active tenant fails closed');

const duplicateScenario = buildCommercialOperatingStressPacket({
  stressPacketId: 'STRESS-DUP', caseId: 'CASE-13D', propertyRef: 'PROP-13D', operatingMetricsPacket: operatingMetrics,
  incomeEvidencePacket: incomePacket, rentRollSnapshot: rentRoll, scenarios: [tenantExit, tenantExit], preparedByRef: 'A', preparedAt: '2026-01-05T11:00:00Z',
  reviewedByRef: 'R', reviewedAt: '2026-01-05T12:00:00Z', reviewEvidenceRef: 'REV',
});
eq(duplicateScenario.status, COMMERCIAL_OPERATING_STRESS_STATUS.HOLD_SCENARIO_ASSUMPTIONS, 'duplicate scenario ids fail closed');

const tamperedMetrics = { ...operatingMetrics, metrics: { ...operatingMetrics.metrics, tenantCount: 99 } };
eq(buildCommercialOperatingStressPacket({
  stressPacketId: 'STRESS-BAD-METRICS', caseId: 'CASE-13D', propertyRef: 'PROP-13D', operatingMetricsPacket: tamperedMetrics,
  incomeEvidencePacket: incomePacket, rentRollSnapshot: rentRoll, scenarios: [tenantExit], preparedByRef: 'A', preparedAt: '2026-01-05T11:00:00Z',
  reviewedByRef: 'R', reviewedAt: '2026-01-05T12:00:00Z', reviewEvidenceRef: 'REV',
}).status, COMMERCIAL_OPERATING_STRESS_STATUS.HOLD_SOURCE_METRICS, 'tampered 13C metrics fail closed');

const tamperedIncome = { ...incomePacket, annualContractRentSar: 999999 };
eq(buildCommercialOperatingStressPacket({
  stressPacketId: 'STRESS-BAD-INCOME', caseId: 'CASE-13D', propertyRef: 'PROP-13D', operatingMetricsPacket: operatingMetrics,
  incomeEvidencePacket: tamperedIncome, rentRollSnapshot: rentRoll, scenarios: [tenantExit], preparedByRef: 'A', preparedAt: '2026-01-05T11:00:00Z',
  reviewedByRef: 'R', reviewedAt: '2026-01-05T12:00:00Z', reviewEvidenceRef: 'REV',
}).status, COMMERCIAL_OPERATING_STRESS_STATUS.HOLD_SOURCE_INTEGRITY, 'tampered source income fails closed');

throws(() => buildCommercialOperatingStressPacket({
  stressPacketId: 'STRESS-CROSS-CASE', caseId: 'CASE-13D', propertyRef: 'PROP-13D', operatingMetricsPacket: operatingMetrics,
  incomeEvidencePacket: { ...incomePacket, caseId: 'OTHER' }, rentRollSnapshot: rentRoll, scenarios: [tenantExit], preparedByRef: 'A', preparedAt: '2026-01-05T11:00:00Z',
  reviewedByRef: 'R', reviewedAt: '2026-01-05T12:00:00Z', reviewEvidenceRef: 'REV',
}), /CASE_OR_PROPERTY_ISOLATION_VIOLATION:stressSourceEvidence/, 'cross-case stress source rejected');

throws(() => scenario({ id: 'S-BASE', kind: SCENARIO_KIND.BASE, mode: COMMERCIAL_STRESS_MODE.SELECTED_TENANT_EXIT, tenants: ['T1'] }), /commercial stress kind/, 'BASE cannot masquerade as stress');
throws(() => scenario({ id: 'S-BAD-WINDOW', mode: COMMERCIAL_STRESS_MODE.EXPIRY_NON_RENEWAL_WINDOW, window: 0 }), /expiryWindowYears/, 'zero expiry window rejected');
throws(() => createCommercialStressScenario({
  scenarioId: 'S-BAD-REVIEW', kind: SCENARIO_KIND.DOWNSIDE, label: 'Bad review', mode: COMMERCIAL_STRESS_MODE.SELECTED_TENANT_EXIT,
  selectedTenantRefs: ['T1'], assumptionOrigin: COMMERCIAL_STRESS_ASSUMPTION_ORIGIN.USER_ENTERED, rationale: 'Test', assumptionRefs: ['A'],
  preparedByRef: 'A', preparedAt: '2026-01-05T11:00:00Z', reviewedByRef: 'R', reviewedAt: '2026-01-05T10:00:00Z', reviewEvidenceRef: 'REV',
}), /COMMERCIAL_STRESS_REVIEW_BEFORE_PREPARATION/, 'review cannot precede preparation');

console.log(`WAVE_13D_COMMERCIAL_OPERATING_STRESS=PASS checks=${checks}`);
