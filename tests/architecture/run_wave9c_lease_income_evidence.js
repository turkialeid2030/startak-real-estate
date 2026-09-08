'use strict';

const assert = require('assert');
const {
  LEASE_EVIDENCE_SOURCE,
  LEASE_VERIFICATION_STATUS,
  ESCALATION_TYPE,
  INCENTIVE_TYPE,
  RECOVERY_TYPE,
  LEASE_INCOME_GATE_STATUS,
  createLeaseEvidenceRecord,
  createVerifiedRentRollSnapshot,
  reconcileLeaseIncomeEvidence,
} = require('../../src/market');

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

const CASE_ID = 'CASE-9C-001';
const PROPERTY_REF = 'PROPERTY-9C-001';
const AS_OF = '2026-09-07T00:00:00Z';

function verification(status = LEASE_VERIFICATION_STATUS.VERIFIED, id = 'V1') {
  return status === LEASE_VERIFICATION_STATUS.VERIFIED
    ? { status, verifiedByRef: 'USER:LEASE-REVIEWER', verifiedAt: '2026-09-06T10:00:00Z', evidenceRef: `verify://${id}` }
    : { status };
}

function lease(overrides = {}) {
  const id = overrides.leaseId || 'L1';
  return createLeaseEvidenceRecord({
    leaseId: id,
    caseId: CASE_ID,
    propertyRef: PROPERTY_REF,
    unitRef: 'UNIT-1',
    tenantRef: 'TENANT-1',
    leaseInterestRef: 'LEASEHOLD-OCCUPANCY',
    areaSqm: 600,
    baseAnnualRentSar: 580000,
    contractedAnnualRentSarAsOfDate: 600000,
    startDate: '2025-01-01T00:00:00Z',
    expiryDate: '2030-12-31T23:59:59Z',
    escalation: { type: ESCALATION_TYPE.PERCENT, rate: 0.05, intervalMonths: 12, evidenceRef: `evidence://${id}/escalation` },
    breakOptions: [{ optionDate: '2028-01-01T00:00:00Z', noticeDays: 180, description: 'Synthetic tenant break option', evidenceRef: `evidence://${id}/break` }],
    renewalOptions: [{ optionDate: '2030-12-01T00:00:00Z', noticeDays: 90, description: 'Synthetic renewal option', evidenceRef: `evidence://${id}/renewal` }],
    incentives: [{ type: INCENTIVE_TYPE.RENT_FREE, amountSar: 0, months: 2, evidenceRef: `evidence://${id}/incentive` }],
    recoveries: { type: RECOVERY_TYPE.FIXED, annualAmountSar: 30000, evidenceRef: `evidence://${id}/recoveries` },
    sourceClass: LEASE_EVIDENCE_SOURCE.VERIFIED_EXECUTED_LEASE,
    sourceRef: `SOURCE-${id}`,
    sourceDocumentHashSha256: 'a'.repeat(64),
    verification: verification(LEASE_VERIFICATION_STATUS.VERIFIED, id),
    capturedAt: '2026-09-06T09:00:00Z',
    ...overrides,
  });
}

const l1 = lease();
const l2 = lease({
  leaseId: 'L2',
  unitRef: 'UNIT-2',
  tenantRef: 'TENANT-2',
  areaSqm: 400,
  baseAnnualRentSar: 430000,
  contractedAnnualRentSarAsOfDate: 450000,
  escalation: { type: ESCALATION_TYPE.FIXED_AMOUNT, amountSar: 20000, intervalMonths: 12, evidenceRef: 'evidence://L2/escalation' },
  breakOptions: [],
  renewalOptions: [],
  incentives: [],
  recoveries: { type: RECOVERY_TYPE.NONE },
  sourceRef: 'SOURCE-L2',
  sourceDocumentHashSha256: 'b'.repeat(64),
  verification: verification(LEASE_VERIFICATION_STATUS.VERIFIED, 'L2'),
});
const inactive = lease({
  leaseId: 'OLD',
  unitRef: 'UNIT-OLD',
  tenantRef: 'TENANT-OLD',
  areaSqm: 100,
  baseAnnualRentSar: 100000,
  contractedAnnualRentSarAsOfDate: 100000,
  startDate: '2020-01-01T00:00:00Z',
  expiryDate: '2022-12-31T23:59:59Z',
  escalation: { type: ESCALATION_TYPE.NONE },
  breakOptions: [],
  renewalOptions: [],
  incentives: [],
  recoveries: { type: RECOVERY_TYPE.NONE },
  sourceClass: LEASE_EVIDENCE_SOURCE.CLIENT_PROVIDED,
  sourceRef: 'SOURCE-OLD',
  sourceDocumentHashSha256: 'c'.repeat(64),
  verification: verification(LEASE_VERIFICATION_STATUS.NOT_VERIFIED, 'OLD'),
});

check(l1.escalation.type === ESCALATION_TYPE.PERCENT && l1.escalation.rate === 0.05, 'lease preserves contractual escalation evidence');
check(l1.breakOptions.length === 1 && l1.renewalOptions.length === 1, 'lease preserves break and renewal option provenance');
check(l1.incentives[0].type === INCENTIVE_TYPE.RENT_FREE && l1.recoveries.type === RECOVERY_TYPE.FIXED, 'lease preserves incentive and recovery structures');
check(l1.contractualInterpretationPerformed === false && l1.automaticDCFAdoption === false, 'lease capture performs no legal interpretation or DCF adoption');
check(/^[a-f0-9]{64}$/.test(l1.leaseEvidenceHashSha256), 'lease evidence has deterministic SHA-256');
check(Object.isFrozen(l1) === true && Object.isFrozen(l1.escalation) === true, 'lease evidence is immutable');

throwsWith(() => lease({ expiryDate: '2024-01-01T00:00:00Z' }), 'LEASE_EXPIRY_MUST_FOLLOW_START', 'lease expiry must follow start');
throwsWith(() => lease({ escalation: { type: ESCALATION_TYPE.PERCENT, rate: 1.5, intervalMonths: 12, evidenceRef: 'evidence://bad' } }), 'decimal <= 1', 'percentage escalation must use semantic decimal range');
throwsWith(() => lease({ verification: verification(LEASE_VERIFICATION_STATUS.NOT_VERIFIED), sourceClass: LEASE_EVIDENCE_SOURCE.VERIFIED_EXECUTED_LEASE }), 'LEASE_SOURCE_CLASS_REQUIRES_VERIFICATION', 'verified executed lease label cannot be used without verification');

function rentRoll(overrides = {}) {
  return createVerifiedRentRollSnapshot({
    snapshotId: 'RR-1',
    caseId: CASE_ID,
    propertyRef: PROPERTY_REF,
    asOfDate: AS_OF,
    totalLettableAreaSqm: 1200,
    occupiedAreaSqm: 1000,
    annualContractRentSar: 1050000,
    activeLeaseCount: 2,
    sourceRef: 'SOURCE-RENT-ROLL',
    sourceDocumentHashSha256: 'd'.repeat(64),
    verification: verification(LEASE_VERIFICATION_STATUS.VERIFIED, 'RR'),
    capturedAt: '2026-09-06T09:00:00Z',
    ...overrides,
  });
}

const rr = rentRoll();
check(rr.verification.status === LEASE_VERIFICATION_STATUS.VERIFIED, 'rent-roll snapshot is explicitly verified');
check(/^[a-f0-9]{64}$/.test(rr.rentRollHashSha256), 'rent-roll snapshot has deterministic SHA-256');
throwsWith(() => rentRoll({ verification: verification(LEASE_VERIFICATION_STATUS.NOT_VERIFIED) }), 'RENT_ROLL_SNAPSHOT_MUST_BE_VERIFIED', 'professional rent-roll snapshot cannot be unverified');
throwsWith(() => rentRoll({ totalLettableAreaSqm: 900, occupiedAreaSqm: 1000 }), 'RENT_ROLL_OCCUPIED_AREA_EXCEEDS_TOTAL', 'rent roll cannot report occupied area above total lettable area');

const reconciled = reconcileLeaseIncomeEvidence({
  caseId: CASE_ID,
  propertyRef: PROPERTY_REF,
  leaseRecords: [l1, l2, inactive],
  rentRollSnapshot: rr,
  asOfDate: AS_OF,
  annualRentToleranceSar: 0,
  occupiedAreaToleranceSqm: 0,
});
check(reconciled.status === LEASE_INCOME_GATE_STATUS.READY_FOR_INCOME_ANALYSIS_HANDOFF, 'verified active lease set reconciles to verified rent roll');
check(reconciled.activeLeaseCount === 2 && reconciled.occupiedAreaSqm === 1000, 'active lease population and area reconcile deterministically');
check(reconciled.annualContractRentSar === 1050000 && reconciled.rentDeltaSar === 0, 'annual contract rent reconciles without forecast assumptions');
check(reconciled.activeLeases.every((item) => item.verification.status === LEASE_VERIFICATION_STATUS.VERIFIED), 'handoff preserves verified lease provenance');
check(reconciled.warnings.includes('INACTIVE_LEASE_NOT_VERIFIED:OLD'), 'inactive unverified lease is disclosed without contaminating active rent roll');
check(reconciled.readyForIncomeAnalysisHandoff === true, 'clean reconciliation produces bounded income-analysis handoff');
check(reconciled.contractualInterpretationPerformed === false && reconciled.noiCalculated === false, 'handoff performs neither contract interpretation nor NOI calculation');
check(reconciled.automaticDCFAdoption === false && reconciled.financialEngineInputsWritten === false, 'handoff never writes DCF/financial inputs automatically');
check(reconciled.valuationConclusionProduced === false && reconciled.transactionAuthorized === false, 'income evidence creates no value conclusion or transaction authority');
check(/^[a-f0-9]{64}$/.test(reconciled.incomeEvidencePacketHashSha256), 'income evidence packet has deterministic SHA-256');

const rentMismatch = reconcileLeaseIncomeEvidence({
  caseId: CASE_ID,
  propertyRef: PROPERTY_REF,
  leaseRecords: [l1, l2],
  rentRollSnapshot: rentRoll({ annualContractRentSar: 1000000 }),
  asOfDate: AS_OF,
});
check(rentMismatch.status === LEASE_INCOME_GATE_STATUS.HOLD_RECONCILIATION, 'rent-roll rent mismatch blocks income handoff');
check(rentMismatch.blockers.some((item) => item.startsWith('RENT_ROLL_ANNUAL_RENT_MISMATCH:')), 'rent mismatch is explicit and quantified');

const areaTolerance = reconcileLeaseIncomeEvidence({
  caseId: CASE_ID,
  propertyRef: PROPERTY_REF,
  leaseRecords: [l1, l2],
  rentRollSnapshot: rentRoll({ occupiedAreaSqm: 1001 }),
  asOfDate: AS_OF,
  occupiedAreaToleranceSqm: 2,
});
check(areaTolerance.status === LEASE_INCOME_GATE_STATUS.READY_FOR_INCOME_ANALYSIS_HANDOFF, 'explicit area tolerance can reconcile bounded rent-roll difference');

const conflictingUnit = lease({
  leaseId: 'L-CONFLICT',
  unitRef: 'UNIT-1',
  tenantRef: 'TENANT-X',
  areaSqm: 600,
  baseAnnualRentSar: 600000,
  contractedAnnualRentSarAsOfDate: 600000,
  sourceRef: 'SOURCE-L-CONFLICT',
  sourceDocumentHashSha256: 'e'.repeat(64),
  verification: verification(LEASE_VERIFICATION_STATUS.VERIFIED, 'LC'),
});
const unitConflict = reconcileLeaseIncomeEvidence({
  caseId: CASE_ID,
  propertyRef: PROPERTY_REF,
  leaseRecords: [l1, conflictingUnit],
  rentRollSnapshot: rentRoll({ occupiedAreaSqm: 1200, annualContractRentSar: 1200000, activeLeaseCount: 2 }),
  asOfDate: AS_OF,
});
check(unitConflict.status === LEASE_INCOME_GATE_STATUS.HOLD_CONFLICT, 'two active leases on same unit emit conflict hold');
check(unitConflict.blockers.some((item) => item.startsWith('ACTIVE_LEASE_UNIT_CONFLICT:UNIT-1:')), 'active unit conflict is traceable');

const unverifiedActive = lease({
  leaseId: 'L-UNVERIFIED',
  unitRef: 'UNIT-2',
  tenantRef: 'TENANT-2',
  areaSqm: 400,
  baseAnnualRentSar: 430000,
  contractedAnnualRentSarAsOfDate: 450000,
  escalation: { type: ESCALATION_TYPE.NONE },
  breakOptions: [], renewalOptions: [], incentives: [], recoveries: { type: RECOVERY_TYPE.NONE },
  sourceClass: LEASE_EVIDENCE_SOURCE.CLIENT_PROVIDED,
  sourceRef: 'SOURCE-L-UNVERIFIED',
  sourceDocumentHashSha256: 'f'.repeat(64),
  verification: verification(LEASE_VERIFICATION_STATUS.NOT_VERIFIED, 'LU'),
});
const unverifiedHold = reconcileLeaseIncomeEvidence({
  caseId: CASE_ID,
  propertyRef: PROPERTY_REF,
  leaseRecords: [l1, unverifiedActive],
  rentRollSnapshot: rr,
  asOfDate: AS_OF,
});
check(unverifiedHold.status === LEASE_INCOME_GATE_STATUS.HOLD_RECONCILIATION, 'unverified active lease blocks professional income handoff');
check(unverifiedHold.blockers.includes('ACTIVE_LEASE_NOT_VERIFIED:L-UNVERIFIED'), 'unverified active lease blocker is explicit');

const emptyAtDate = reconcileLeaseIncomeEvidence({
  caseId: CASE_ID,
  propertyRef: PROPERTY_REF,
  leaseRecords: [l1, l2],
  rentRollSnapshot: rentRoll({ asOfDate: '2020-01-01T00:00:00Z', occupiedAreaSqm: 0, annualContractRentSar: 0, activeLeaseCount: 0 }),
  asOfDate: '2020-01-01T00:00:00Z',
});
check(emptyAtDate.status === LEASE_INCOME_GATE_STATUS.HOLD_INSUFFICIENT_EVIDENCE, 'no active lease evidence produces insufficient-evidence hold');

throwsWith(() => reconcileLeaseIncomeEvidence({
  caseId: CASE_ID,
  propertyRef: PROPERTY_REF,
  leaseRecords: [l1],
  rentRollSnapshot: rr,
  asOfDate: '2026-09-08T00:00:00Z',
}), 'RENT_ROLL_AS_OF_DATE_MISMATCH', 'rent-roll snapshot date must match requested evidence date');

throwsWith(() => reconcileLeaseIncomeEvidence({
  caseId: 'CASE-OTHER',
  propertyRef: PROPERTY_REF,
  leaseRecords: [l1],
  rentRollSnapshot: rr,
  asOfDate: AS_OF,
}), 'CASE_OR_PROPERTY_ISOLATION_VIOLATION', 'cross-case lease/rent-roll evidence is rejected');

console.log(`WAVE_9C_LEASE_INCOME_EVIDENCE=PASS checks=${checks}`);
