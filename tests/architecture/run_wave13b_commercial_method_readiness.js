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
  COMMERCIAL_METHOD,
  METHOD_READINESS_STATUS,
  SUPPLEMENTAL_EVIDENCE_ROLE,
  SUPPLEMENTAL_EVIDENCE_STATUS,
  createSupplementalMethodEvidence,
  verifySupplementalMethodEvidenceIntegrity,
  methodRequiredTopics,
  methodSupplementalRoles,
  buildCommercialMethodReadinessPacket,
  verifyCommercialMethodReadinessPacketIntegrity,
} = require('../../src/commercial/commercial-method-readiness');

let checks = 0;
function check(value, message) { assert.ok(value, message); checks += 1; }
function eq(actual, expected, message) { assert.strictEqual(actual, expected, message); checks += 1; }
function throws(fn, pattern, message) { assert.throws(fn, pattern, message); checks += 1; }

function stableClone(value) {
  if (Array.isArray(value)) return value.map(stableClone);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((out, key) => { out[key] = stableClone(value[key]); return out; }, {});
}
function sha256(value) { return crypto.createHash('sha256').update(JSON.stringify(stableClone(value))).digest('hex'); }

function propertyPacket() {
  const core = {
    schemaVersion: 1,
    caseId: 'CASE-13B-001',
    propertyRef: 'PROP-13B-001',
    assignmentRef: 'ASSIGN-13B-001',
    assignmentHashSha256: 'a'.repeat(64),
    inspectionId: 'INSP-13B-001',
    inspectionHashSha256: 'b'.repeat(64),
    valuationDate: '2026-02-01',
    reportDate: '2026-02-05',
    jurisdiction: 'SAUDI_ARABIA',
    assetType: 'COMMERCIAL',
    assetLocation: 'Riyadh',
    valuedRights: { interest: 'FREEHOLD' },
    basisOfValue: { basis: 'MARKET_VALUE' },
    purpose: 'PROFESSIONAL_VALUATION',
    evidenceFacts: [],
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

function commercialEvidence(topic, suffix = topic) {
  return createCommercialEvidenceItem({
    evidenceItemId: `CE-${suffix}`,
    caseId: 'CASE-13B-001',
    propertyRef: 'PROP-13B-001',
    topic,
    status: EVIDENCE_ITEM_STATUS.VERIFIED,
    evidenceRefs: [`REF-${suffix}`],
    asOfDate: '2026-02-01',
    rationale: `Verified ${topic}`,
    preparedByRef: 'ANALYST-13B',
    preparedAt: '2026-02-02',
    reviewedByRef: 'REVIEWER-13B',
    reviewedAt: '2026-02-03',
    reviewEvidenceRef: `REVIEW-${suffix}`,
  });
}

function specialization({ includeSaleComparables = false } = {}) {
  const matrix = expectationMatrix(COMMERCIAL_ASSET_CLASS.OFFICE, OCCUPANCY_STRUCTURE.MULTI_TENANT);
  const requiredTopics = Object.entries(matrix)
    .filter(([, expectation]) => expectation === EVIDENCE_EXPECTATION.REQUIRED)
    .map(([topic]) => topic);
  const evidenceItems = requiredTopics.map((topic) => commercialEvidence(topic));
  const conditionalApplicability = { [COMMERCIAL_EVIDENCE_TOPIC.SALE_COMPARABLES]: includeSaleComparables };
  if (includeSaleComparables) evidenceItems.push(commercialEvidence(COMMERCIAL_EVIDENCE_TOPIC.SALE_COMPARABLES));
  return buildCommercialSpecializationPacket({
    specializationId: includeSaleComparables ? 'COMM-13B-SALES' : 'COMM-13B-BASE',
    caseId: 'CASE-13B-001',
    propertyRef: 'PROP-13B-001',
    commercialAssetClass: COMMERCIAL_ASSET_CLASS.OFFICE,
    occupancyStructure: OCCUPANCY_STRUCTURE.MULTI_TENANT,
    analysisContext: COMMERCIAL_ANALYSIS_CONTEXT.PROFESSIONAL_VALUATION,
    propertyEvidencePacket: propertyPacket(),
    evidenceItems,
    conditionalApplicability,
    preparedByRef: 'ANALYST-13B',
    preparedAt: '2026-02-03',
    reviewedByRef: 'REVIEWER-13B-2',
    reviewedAt: '2026-02-04',
    reviewEvidenceRef: 'REVIEW-COMM-13B',
  });
}

function supplemental(role, status = SUPPLEMENTAL_EVIDENCE_STATUS.VERIFIED, suffix = role) {
  return createSupplementalMethodEvidence({
    supplementalEvidenceId: `SUP-${suffix}`,
    caseId: 'CASE-13B-001',
    propertyRef: 'PROP-13B-001',
    role,
    status,
    sourceRef: `SOURCE-${suffix}`,
    evidenceRefs: [`EVIDENCE-${suffix}`],
    asOfDate: '2026-02-01',
    rationale: `Professional supplemental evidence for ${role}`,
    preparedByRef: 'ANALYST-13B',
    preparedAt: '2026-02-02',
    reviewedByRef: 'REVIEWER-13B',
    reviewedAt: '2026-02-03',
    reviewEvidenceRef: `REVIEW-SUP-${suffix}`,
  });
}

const base = specialization();
eq(base.status, 'READY_FOR_PROFESSIONAL_METHOD_WORKFLOW', '13A specialization is ready');

const directTopics = methodRequiredTopics(COMMERCIAL_METHOD.DIRECT_CAPITALIZATION, base);
check(directTopics.includes(COMMERCIAL_EVIDENCE_TOPIC.LEASE_AND_RENT_ROLL), 'direct cap requires lease/rent roll when occupied');
check(directTopics.includes(COMMERCIAL_EVIDENCE_TOPIC.TENANT_COVENANT_AND_CONCENTRATION), 'direct cap requires tenant covenant when occupied');
check(directTopics.includes(COMMERCIAL_EVIDENCE_TOPIC.SERVICE_CHARGE_AND_RECOVERIES), 'direct cap requires recoveries for multi-tenant');
const dcfTopics = methodRequiredTopics(COMMERCIAL_METHOD.DISCOUNTED_CASH_FLOW, base);
check(dcfTopics.includes(COMMERCIAL_EVIDENCE_TOPIC.CAPITAL_EXPENDITURE), 'DCF requires capex evidence');
eq(methodSupplementalRoles(COMMERCIAL_METHOD.COST_APPROACH).length, 3, 'cost approach requires three supplemental roles');
eq(methodSupplementalRoles(COMMERCIAL_METHOD.DIRECT_CAPITALIZATION).length, 0, 'direct cap has no 13B supplemental role');

const incomeReady = buildCommercialMethodReadinessPacket({
  readinessPacketId: 'READINESS-INCOME',
  caseId: 'CASE-13B-001', propertyRef: 'PROP-13B-001', specializationPacket: base,
  methodsToAssess: [COMMERCIAL_METHOD.DIRECT_CAPITALIZATION, COMMERCIAL_METHOD.DISCOUNTED_CASH_FLOW],
  supplementalEvidence: [],
  preparedByRef: 'ANALYST-13B', preparedAt: '2026-02-04', reviewedByRef: 'REVIEWER-13B-3', reviewedAt: '2026-02-05', reviewEvidenceRef: 'REVIEW-READINESS-INCOME',
});
eq(incomeReady.status, METHOD_READINESS_STATUS.READY_FOR_EXISTING_METHOD_WORKFLOW, 'income methods evidence ready');
eq(incomeReady.readyMethods.length, 2, 'two income methods ready');
check(incomeReady.readyMethods.includes(COMMERCIAL_METHOD.DIRECT_CAPITALIZATION), 'direct cap ready');
check(incomeReady.readyMethods.includes(COMMERCIAL_METHOD.DISCOUNTED_CASH_FLOW), 'DCF ready');
eq(incomeReady.automaticMethodSelection, false, 'no automatic method selection');
eq(incomeReady.selectedMethod, null, 'no selected method');
eq(incomeReady.valuationInputsWritten, false, 'no valuation inputs written');
eq(incomeReady.valuationArithmeticPerformed, false, 'no valuation arithmetic');
eq(incomeReady.methodReconciliationPerformed, false, 'no method reconciliation');
eq(incomeReady.certifiedValuationEstablished, false, 'no certified valuation');
eq(incomeReady.transactionAuthorized, false, 'no transaction authority');
check(verifyCommercialMethodReadinessPacketIntegrity(incomeReady), 'income readiness packet integrity verifies');

const salesHold = buildCommercialMethodReadinessPacket({
  readinessPacketId: 'READINESS-SALES-HOLD',
  caseId: 'CASE-13B-001', propertyRef: 'PROP-13B-001', specializationPacket: base,
  methodsToAssess: [COMMERCIAL_METHOD.SALES_COMPARISON], supplementalEvidence: [],
  preparedByRef: 'ANALYST-13B', preparedAt: '2026-02-04', reviewedByRef: 'REVIEWER-13B-3', reviewedAt: '2026-02-05', reviewEvidenceRef: 'REVIEW-SALES-HOLD',
});
eq(salesHold.status, METHOD_READINESS_STATUS.HOLD_EVIDENCE_GAPS, 'sales comparison holds without sales evidence');
check(salesHold.blockers.some((x) => x === 'METHOD_EVIDENCE_TOPIC_MISSING:SALE_COMPARABLES'), 'sales evidence blocker surfaced');

const withSales = specialization({ includeSaleComparables: true });
const salesReady = buildCommercialMethodReadinessPacket({
  readinessPacketId: 'READINESS-SALES-READY',
  caseId: 'CASE-13B-001', propertyRef: 'PROP-13B-001', specializationPacket: withSales,
  methodsToAssess: [COMMERCIAL_METHOD.SALES_COMPARISON], supplementalEvidence: [],
  preparedByRef: 'ANALYST-13B', preparedAt: '2026-02-04', reviewedByRef: 'REVIEWER-13B-3', reviewedAt: '2026-02-05', reviewEvidenceRef: 'REVIEW-SALES-READY',
});
eq(salesReady.status, METHOD_READINESS_STATUS.READY_FOR_EXISTING_METHOD_WORKFLOW, 'sales comparison ready when evidence exists');
eq(salesReady.readyMethods[0], COMMERCIAL_METHOD.SALES_COMPARISON, 'sales comparison listed ready');

const costWithoutSupplemental = buildCommercialMethodReadinessPacket({
  readinessPacketId: 'READINESS-COST-HOLD',
  caseId: 'CASE-13B-001', propertyRef: 'PROP-13B-001', specializationPacket: base,
  methodsToAssess: [COMMERCIAL_METHOD.COST_APPROACH], supplementalEvidence: [],
  preparedByRef: 'ANALYST-13B', preparedAt: '2026-02-04', reviewedByRef: 'REVIEWER-13B-3', reviewedAt: '2026-02-05', reviewEvidenceRef: 'REVIEW-COST-HOLD',
});
eq(costWithoutSupplemental.status, METHOD_READINESS_STATUS.HOLD_SUPPLEMENTAL_EVIDENCE, 'cost holds without supplemental evidence');
eq(costWithoutSupplemental.methodAssessments[0].missingSupplementalRoles.length, 3, 'three cost supplemental roles missing');

const costSupplemental = Object.values(SUPPLEMENTAL_EVIDENCE_ROLE).map((role) => supplemental(role));
check(costSupplemental.every(verifySupplementalMethodEvidenceIntegrity), 'supplemental evidence integrity verifies');
const costReady = buildCommercialMethodReadinessPacket({
  readinessPacketId: 'READINESS-COST-READY',
  caseId: 'CASE-13B-001', propertyRef: 'PROP-13B-001', specializationPacket: base,
  methodsToAssess: [COMMERCIAL_METHOD.COST_APPROACH], supplementalEvidence: costSupplemental,
  preparedByRef: 'ANALYST-13B', preparedAt: '2026-02-04', reviewedByRef: 'REVIEWER-13B-3', reviewedAt: '2026-02-05', reviewEvidenceRef: 'REVIEW-COST-READY',
});
eq(costReady.status, METHOD_READINESS_STATUS.READY_FOR_EXISTING_METHOD_WORKFLOW, 'cost readiness passes with reviewed supplemental evidence');
eq(costReady.readyMethods[0], COMMERCIAL_METHOD.COST_APPROACH, 'cost approach listed ready');

const unverifiedCost = costSupplemental.map((item) => item.role === SUPPLEMENTAL_EVIDENCE_ROLE.DEPRECIATION_EVIDENCE
  ? supplemental(SUPPLEMENTAL_EVIDENCE_ROLE.DEPRECIATION_EVIDENCE, SUPPLEMENTAL_EVIDENCE_STATUS.ASSUMED, 'DEPR-ASSUMED')
  : item);
const costUnverified = buildCommercialMethodReadinessPacket({
  readinessPacketId: 'READINESS-COST-UNVERIFIED',
  caseId: 'CASE-13B-001', propertyRef: 'PROP-13B-001', specializationPacket: base,
  methodsToAssess: [COMMERCIAL_METHOD.COST_APPROACH], supplementalEvidence: unverifiedCost,
  preparedByRef: 'ANALYST-13B', preparedAt: '2026-02-04', reviewedByRef: 'REVIEWER-13B-3', reviewedAt: '2026-02-05', reviewEvidenceRef: 'REVIEW-COST-UNVERIFIED',
});
eq(costUnverified.status, METHOD_READINESS_STATUS.HOLD_SUPPLEMENTAL_EVIDENCE, 'assumed cost evidence not qualified');
check(costUnverified.blockers.some((x) => x.includes('METHOD_SUPPLEMENTAL_EVIDENCE_NOT_QUALIFIED:DEPRECIATION_EVIDENCE')), 'unqualified depreciation blocker surfaced');

const tamperedSupplemental = [{ ...costSupplemental[0], rationale: 'tampered' }, ...costSupplemental.slice(1)];
const integrityHold = buildCommercialMethodReadinessPacket({
  readinessPacketId: 'READINESS-INTEGRITY',
  caseId: 'CASE-13B-001', propertyRef: 'PROP-13B-001', specializationPacket: base,
  methodsToAssess: [COMMERCIAL_METHOD.COST_APPROACH], supplementalEvidence: tamperedSupplemental,
  preparedByRef: 'ANALYST-13B', preparedAt: '2026-02-04', reviewedByRef: 'REVIEWER-13B-3', reviewedAt: '2026-02-05', reviewEvidenceRef: 'REVIEW-INTEGRITY',
});
eq(integrityHold.status, METHOD_READINESS_STATUS.HOLD_INTEGRITY, 'tampered supplemental evidence fails closed');

const tamperedSpecialization = { ...base, occupancyStructure: OCCUPANCY_STRUCTURE.SINGLE_TENANT };
const specializationHold = buildCommercialMethodReadinessPacket({
  readinessPacketId: 'READINESS-SPECIALIZATION-HOLD',
  caseId: 'CASE-13B-001', propertyRef: 'PROP-13B-001', specializationPacket: tamperedSpecialization,
  methodsToAssess: [COMMERCIAL_METHOD.DIRECT_CAPITALIZATION], supplementalEvidence: [],
  preparedByRef: 'ANALYST-13B', preparedAt: '2026-02-04', reviewedByRef: 'REVIEWER-13B-3', reviewedAt: '2026-02-05', reviewEvidenceRef: 'REVIEW-SP-HOLD',
});
eq(specializationHold.status, METHOD_READINESS_STATUS.HOLD_SPECIALIZATION_PACKET, 'tampered specialization fails closed');

const tamperedReadiness = { ...incomeReady, selectedMethod: COMMERCIAL_METHOD.DIRECT_CAPITALIZATION };
check(!verifyCommercialMethodReadinessPacketIntegrity(tamperedReadiness), 'mutating governed output fails integrity');

throws(() => buildCommercialMethodReadinessPacket({
  readinessPacketId: 'BAD-NO-METHOD', caseId: 'CASE-13B-001', propertyRef: 'PROP-13B-001', specializationPacket: base,
  methodsToAssess: [], supplementalEvidence: [], preparedByRef: 'A', preparedAt: '2026-02-04', reviewedByRef: 'R', reviewedAt: '2026-02-05', reviewEvidenceRef: 'REF',
}), /methodsToAssess must be a non-empty array/, 'empty methods rejected');
throws(() => buildCommercialMethodReadinessPacket({
  readinessPacketId: 'BAD-METHOD', caseId: 'CASE-13B-001', propertyRef: 'PROP-13B-001', specializationPacket: base,
  methodsToAssess: ['AUTO_CHOOSE_BEST'], supplementalEvidence: [], preparedByRef: 'A', preparedAt: '2026-02-04', reviewedByRef: 'R', reviewedAt: '2026-02-05', reviewEvidenceRef: 'REF',
}), /method is invalid/, 'unsupported automatic-method request rejected');
throws(() => buildCommercialMethodReadinessPacket({
  readinessPacketId: 'BAD-CASE', caseId: 'CASE-13B-001', propertyRef: 'PROP-13B-001', specializationPacket: base,
  methodsToAssess: [COMMERCIAL_METHOD.COST_APPROACH], supplementalEvidence: [{ ...costSupplemental[0], caseId: 'OTHER-CASE' }],
  preparedByRef: 'A', preparedAt: '2026-02-04', reviewedByRef: 'R', reviewedAt: '2026-02-05', reviewEvidenceRef: 'REF',
}), /CASE_OR_PROPERTY_ISOLATION_VIOLATION:supplementalEvidence/, 'cross-case supplemental evidence rejected');
throws(() => createSupplementalMethodEvidence({
  supplementalEvidenceId: 'BAD-DATE', caseId: 'CASE-13B-001', propertyRef: 'PROP-13B-001',
  role: SUPPLEMENTAL_EVIDENCE_ROLE.LAND_VALUE_EVIDENCE, status: SUPPLEMENTAL_EVIDENCE_STATUS.VERIFIED,
  sourceRef: 'SOURCE', evidenceRefs: ['REF'], asOfDate: '2026-02-03', rationale: 'bad date', preparedByRef: 'A', preparedAt: '2026-02-02', reviewedByRef: 'R', reviewedAt: '2026-02-04', reviewEvidenceRef: 'REVIEW',
}), /SUPPLEMENTAL_EVIDENCE_PREPARED_BEFORE_AS_OF_DATE/, 'supplemental as-of chronology enforced');

console.log(`WAVE_13B_COMMERCIAL_METHOD_READINESS=PASS checks=${checks}`);
