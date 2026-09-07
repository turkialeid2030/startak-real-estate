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
const check = (v, m) => { assert.ok(v, m); checks += 1; };
const eq = (a, e, m) => { assert.strictEqual(a, e, m); checks += 1; };
const throws = (fn, re, m) => { assert.throws(fn, re, m); checks += 1; };

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((o, k) => { o[k] = stable(value[k]); return o; }, {});
}
const sha256 = (value) => crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');

function propertyPacket() {
  const core = {
    schemaVersion: 1, caseId: 'CASE-13B', propertyRef: 'PROP-13B', assignmentRef: 'ASSIGN-13B',
    assignmentHashSha256: 'a'.repeat(64), inspectionId: 'INSP-13B', inspectionHashSha256: 'b'.repeat(64),
    valuationDate: '2026-02-01', reportDate: '2026-02-05', jurisdiction: 'SAUDI_ARABIA', assetType: 'COMMERCIAL',
    assetLocation: 'Riyadh', valuedRights: { interest: 'FREEHOLD' }, basisOfValue: { basis: 'MARKET_VALUE' },
    purpose: 'PROFESSIONAL_VALUATION', evidenceFacts: [], measurements: [], propertyDataGateStatus: 'CLEAR', measurementGateStatus: 'CLEAR',
  };
  return Object.freeze({ ...core, packetHashSha256: sha256(core), status: 'READY_FOR_PROFESSIONAL_VALUATION_WORKFLOW', reasons: [],
    professionalValuationWorkflowReady: true, automaticUnderwritingAdoption: false, financialEngineInputsWritten: false,
    certifiedValuationEstablished: false, transactionAuthorized: false });
}

function item(topic) {
  return createCommercialEvidenceItem({
    evidenceItemId: `E-${topic}`, caseId: 'CASE-13B', propertyRef: 'PROP-13B', topic,
    status: EVIDENCE_ITEM_STATUS.VERIFIED, evidenceRefs: [`REF-${topic}`], asOfDate: '2026-02-01',
    rationale: `Verified ${topic}`, preparedByRef: 'A', preparedAt: '2026-02-02', reviewedByRef: 'R', reviewedAt: '2026-02-03',
    reviewEvidenceRef: `REV-${topic}`,
  });
}

function specialization(includeSales = false) {
  const matrix = expectationMatrix(COMMERCIAL_ASSET_CLASS.OFFICE, OCCUPANCY_STRUCTURE.MULTI_TENANT);
  const evidenceItems = Object.entries(matrix).filter(([, x]) => x === EVIDENCE_EXPECTATION.REQUIRED).map(([topic]) => item(topic));
  if (includeSales) evidenceItems.push(item(COMMERCIAL_EVIDENCE_TOPIC.SALE_COMPARABLES));
  return buildCommercialSpecializationPacket({
    specializationId: includeSales ? 'SP-SALES' : 'SP-BASE', caseId: 'CASE-13B', propertyRef: 'PROP-13B',
    commercialAssetClass: COMMERCIAL_ASSET_CLASS.OFFICE, occupancyStructure: OCCUPANCY_STRUCTURE.MULTI_TENANT,
    analysisContext: COMMERCIAL_ANALYSIS_CONTEXT.PROFESSIONAL_VALUATION, propertyEvidencePacket: propertyPacket(), evidenceItems,
    conditionalApplicability: { [COMMERCIAL_EVIDENCE_TOPIC.SALE_COMPARABLES]: includeSales },
    preparedByRef: 'A', preparedAt: '2026-02-03', reviewedByRef: 'R2', reviewedAt: '2026-02-04', reviewEvidenceRef: 'REV-SP',
  });
}

function supplemental(role, status = SUPPLEMENTAL_EVIDENCE_STATUS.VERIFIED) {
  return createSupplementalMethodEvidence({
    supplementalEvidenceId: `S-${role}-${status}`, caseId: 'CASE-13B', propertyRef: 'PROP-13B', role, status,
    sourceRef: `SRC-${role}`, evidenceRefs: [`REF-${role}`], asOfDate: '2026-02-01', rationale: `Evidence ${role}`,
    preparedByRef: 'A', preparedAt: '2026-02-02', reviewedByRef: 'R', reviewedAt: '2026-02-03', reviewEvidenceRef: `REV-${role}`,
  });
}

function assess(id, sp, methods, supplementalEvidence = []) {
  return buildCommercialMethodReadinessPacket({
    readinessPacketId: id, caseId: 'CASE-13B', propertyRef: 'PROP-13B', specializationPacket: sp,
    methodsToAssess: methods, supplementalEvidence, preparedByRef: 'A', preparedAt: '2026-02-04',
    reviewedByRef: 'R3', reviewedAt: '2026-02-05', reviewEvidenceRef: `REV-${id}`,
  });
}

const base = specialization(false);
const directTopics = methodRequiredTopics(COMMERCIAL_METHOD.DIRECT_CAPITALIZATION, base);
check(directTopics.includes(COMMERCIAL_EVIDENCE_TOPIC.LEASE_AND_RENT_ROLL), 'occupied direct cap requires rent roll');
check(directTopics.includes(COMMERCIAL_EVIDENCE_TOPIC.TENANT_COVENANT_AND_CONCENTRATION), 'occupied direct cap requires covenant');
check(directTopics.includes(COMMERCIAL_EVIDENCE_TOPIC.SERVICE_CHARGE_AND_RECOVERIES), 'multi-tenant direct cap requires recoveries');
check(methodRequiredTopics(COMMERCIAL_METHOD.DISCOUNTED_CASH_FLOW, base).includes(COMMERCIAL_EVIDENCE_TOPIC.CAPITAL_EXPENDITURE), 'DCF requires capex');
eq(methodSupplementalRoles(COMMERCIAL_METHOD.COST_APPROACH).length, 3, 'cost has three supplemental roles');

const income = assess('INCOME', base, [COMMERCIAL_METHOD.DIRECT_CAPITALIZATION, COMMERCIAL_METHOD.DISCOUNTED_CASH_FLOW]);
eq(income.status, METHOD_READINESS_STATUS.READY_FOR_EXISTING_METHOD_WORKFLOW, 'income methods ready');
eq(income.readyMethods.length, 2, 'two ready methods');
eq(income.automaticMethodSelection, false, 'no automatic method selection');
eq(income.selectedMethod, null, 'no selected method');
eq(income.valuationInputsWritten, false, 'no input writing');
eq(income.valuationArithmeticPerformed, false, 'no valuation arithmetic');
eq(income.methodReconciliationPerformed, false, 'no reconciliation');
eq(income.certifiedValuationEstablished, false, 'no certification');
eq(income.transactionAuthorized, false, 'no transaction authority');
check(verifyCommercialMethodReadinessPacketIntegrity(income), 'readiness integrity verifies');

const salesHold = assess('SALES-HOLD', base, [COMMERCIAL_METHOD.SALES_COMPARISON]);
eq(salesHold.status, METHOD_READINESS_STATUS.HOLD_EVIDENCE_GAPS, 'sales holds without comparable evidence');
check(salesHold.blockers.includes('METHOD_EVIDENCE_TOPIC_MISSING:SALE_COMPARABLES'), 'sales blocker explicit');
const salesReady = assess('SALES-READY', specialization(true), [COMMERCIAL_METHOD.SALES_COMPARISON]);
eq(salesReady.status, METHOD_READINESS_STATUS.READY_FOR_EXISTING_METHOD_WORKFLOW, 'sales ready with comparables');

const costHold = assess('COST-HOLD', base, [COMMERCIAL_METHOD.COST_APPROACH]);
eq(costHold.status, METHOD_READINESS_STATUS.HOLD_SUPPLEMENTAL_EVIDENCE, 'cost holds without supplemental evidence');
eq(costHold.methodAssessments[0].missingSupplementalRoles.length, 3, 'all cost roles surfaced');
const costEvidence = Object.values(SUPPLEMENTAL_EVIDENCE_ROLE).map((role) => supplemental(role));
check(costEvidence.every(verifySupplementalMethodEvidenceIntegrity), 'supplemental integrity verifies');
const costReady = assess('COST-READY', base, [COMMERCIAL_METHOD.COST_APPROACH], costEvidence);
eq(costReady.status, METHOD_READINESS_STATUS.READY_FOR_EXISTING_METHOD_WORKFLOW, 'cost ready with supplemental evidence');

const weakCost = costEvidence.map((x) => x.role === SUPPLEMENTAL_EVIDENCE_ROLE.DEPRECIATION_EVIDENCE
  ? supplemental(x.role, SUPPLEMENTAL_EVIDENCE_STATUS.ASSUMED) : x);
const weak = assess('COST-WEAK', base, [COMMERCIAL_METHOD.COST_APPROACH], weakCost);
eq(weak.status, METHOD_READINESS_STATUS.HOLD_SUPPLEMENTAL_EVIDENCE, 'assumed depreciation not qualified');
check(weak.blockers.some((x) => x.includes('DEPRECIATION_EVIDENCE')), 'depreciation blocker explicit');

const tamperedSup = [{ ...costEvidence[0], rationale: 'tampered' }, ...costEvidence.slice(1)];
eq(assess('TAMPER-SUP', base, [COMMERCIAL_METHOD.COST_APPROACH], tamperedSup).status, METHOD_READINESS_STATUS.HOLD_INTEGRITY, 'tampered supplemental fails closed');
const tamperedSp = { ...base, occupancyStructure: OCCUPANCY_STRUCTURE.SINGLE_TENANT };
eq(assess('TAMPER-SP', tamperedSp, [COMMERCIAL_METHOD.DIRECT_CAPITALIZATION]).status, METHOD_READINESS_STATUS.HOLD_SPECIALIZATION_PACKET, 'tampered specialization fails closed');

const tamperedCore = { ...income, commercialAssetClass: COMMERCIAL_ASSET_CLASS.SHOPPING_CENTRE };
check(!verifyCommercialMethodReadinessPacketIntegrity(tamperedCore), 'hashed core tampering fails integrity');
throws(() => assess('NO-METHOD', base, []), /methodsToAssess must be a non-empty array/, 'empty methods rejected');
throws(() => assess('AUTO', base, ['AUTO_CHOOSE_BEST']), /method is invalid/, 'automatic method request rejected');
throws(() => createSupplementalMethodEvidence({
  supplementalEvidenceId: 'BAD-DATE', caseId: 'CASE-13B', propertyRef: 'PROP-13B', role: SUPPLEMENTAL_EVIDENCE_ROLE.LAND_VALUE_EVIDENCE,
  status: SUPPLEMENTAL_EVIDENCE_STATUS.VERIFIED, sourceRef: 'SRC', evidenceRefs: ['REF'], asOfDate: '2026-02-03', rationale: 'bad',
  preparedByRef: 'A', preparedAt: '2026-02-02', reviewedByRef: 'R', reviewedAt: '2026-02-04', reviewEvidenceRef: 'REV',
}), /SUPPLEMENTAL_EVIDENCE_PREPARED_BEFORE_AS_OF_DATE/, 'supplemental chronology enforced');

console.log(`WAVE_13B_COMMERCIAL_METHOD_READINESS=PASS checks=${checks}`);
