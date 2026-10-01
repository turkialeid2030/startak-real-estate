'use strict';

const assert = require('assert/strict');
const {
  POLICY_VERSION,
  REGULATORY_CARRY_STATUS,
  COST_BASIS,
  ANNUAL_ACCRUAL_CONVENTION,
  createGovernedRegulatoryCarryCostEvidence,
  regulatoryCostBindings,
  computeRegulatoryCarryCostEvidenceHash,
  computeRegulatoryCarryCostReviewPolicyHash,
  evaluateGovernedRegulatoryCarryCost,
} = require('../../src/cost/governed-regulatory-carry-cost');

const CASE_ID = 'CASE-C12-001';
const PROPERTY_REF = 'PROPERTY-C12-001';
const AS_OF = '2026-01-01T00:00:00.000Z';
const HORIZON_START = '2026-01-01T00:00:00.000Z';
const HORIZON_END = '2027-12-31T23:59:59.999Z';
const POLICY_ID = 'C12-TEST-POLICY';

function common(itemId, category, basis) {
  return {
    itemId,
    caseId: CASE_ID,
    propertyRef: PROPERTY_REF,
    category,
    basis,
    sourceAuthority: 'AUTHORIZED:PROFESSIONAL-REGULATORY-SOURCE',
    sourceRef: `source://${itemId}`,
    sourceEvidenceRef: `evidence://${itemId}`,
    sourceVersionHashSha256: 'a'.repeat(64),
    sourceVerifiedAt: '2025-12-31T10:00:00Z',
    sourceReviewAfter: '2026-12-31T23:59:59Z',
    applicabilityDeterminedByRef: 'USER:C12-AUTHORIZED-REVIEWER',
    reviewedAt: '2025-12-31T12:00:00Z',
    validUntil: '2027-12-31T23:59:59.999Z',
    reviewEvidenceRef: `review://${itemId}`,
    reviewEvidenceHashSha256: 'b'.repeat(64),
  };
}

const annualFixed = createGovernedRegulatoryCarryCostEvidence({
  ...common('COST-ANNUAL', 'GOVERNED_ANNUAL_CHARGE', COST_BASIS.FIXED_ANNUAL_SAR),
  amountSar: 12000,
  effectiveFrom: HORIZON_START,
  effectiveTo: HORIZON_END,
  annualAccrualConvention: ANNUAL_ACCRUAL_CONVENTION.FULL_CALENDAR_YEAR_IF_ACTIVE,
});
const percentage = createGovernedRegulatoryCarryCostEvidence({
  ...common('COST-PERCENT', 'GOVERNED_PERCENT_CHARGE', COST_BASIS.PERCENT_OF_EXPLICIT_BASE_ANNUAL),
  rate: 0.02,
  explicitBaseAmountSar: 1000000,
  effectiveFrom: HORIZON_START,
  effectiveTo: HORIZON_END,
  annualAccrualConvention: ANNUAL_ACCRUAL_CONVENTION.FULL_CALENDAR_YEAR_IF_ACTIVE,
});
const perSqm = createGovernedRegulatoryCarryCostEvidence({
  ...common('COST-AREA', 'GOVERNED_AREA_CHARGE', COST_BASIS.PER_SQM_ANNUAL_SAR),
  ratePerSqmSar: 10,
  explicitAreaSqm: 1000,
  effectiveFrom: HORIZON_START,
  effectiveTo: HORIZON_END,
  annualAccrualConvention: ANNUAL_ACCRUAL_CONVENTION.FULL_CALENDAR_YEAR_IF_ACTIVE,
});
const oneTime = createGovernedRegulatoryCarryCostEvidence({
  ...common('COST-ONCE', 'GOVERNED_ONE_TIME_CHARGE', COST_BASIS.FIXED_ONE_TIME_SAR),
  amountSar: 5000,
  chargeDate: '2027-06-01T00:00:00Z',
});
const evidence = [annualFixed, percentage, perSqm, oneTime];

function policy(items = evidence, overrides = {}) {
  const core = {
    version: POLICY_VERSION,
    policyId: POLICY_ID,
    caseId: CASE_ID,
    propertyRef: PROPERTY_REF,
    asOfDate: AS_OF,
    horizonStart: HORIZON_START,
    horizonEnd: HORIZON_END,
    costItemBindings: regulatoryCostBindings(items),
    allowedCategories: [
      'GOVERNED_ANNUAL_CHARGE',
      'GOVERNED_PERCENT_CHARGE',
      'GOVERNED_AREA_CHARGE',
      'GOVERNED_ONE_TIME_CHARGE',
    ],
    requiredCategories: ['GOVERNED_ANNUAL_CHARGE'],
    allowedBases: Object.values(COST_BASIS),
    allowedAccrualConventions: Object.values(ANNUAL_ACCRUAL_CONVENTION),
    maximumAnnualCarryCostSar: 50000,
    explicitReferenceAmountSar: 1000000,
    maximumAnnualCarryCostShareOfExplicitReference: 0.05,
    reviewedByRef: 'USER:C12-POLICY-REVIEWER',
    reviewedAt: '2026-01-01T00:00:00Z',
    reviewEvidenceRef: 'review://c12/policy/001',
    ...overrides,
  };
  return { ...core, policyHashSha256: computeRegulatoryCarryCostReviewPolicyHash(core) };
}

function evaluate(items = evidence, selectedPolicy = policy(items), overrides = {}) {
  return evaluateGovernedRegulatoryCarryCost({
    caseId: CASE_ID,
    propertyRef: PROPERTY_REF,
    asOfDate: AS_OF,
    horizonStart: HORIZON_START,
    horizonEnd: HORIZON_END,
    regulatoryCostEvidence: items,
    reviewPolicyId: POLICY_ID,
    governedReviewPolicies: { [POLICY_ID]: selectedPolicy },
    ...overrides,
  });
}

const ready = evaluate();
assert.equal(ready.status, REGULATORY_CARRY_STATUS.READY_FOR_PROFESSIONAL_REGULATORY_CARRY_COST_REVIEW);
assert.equal(ready.professionalRegulatoryCarryCostReviewReady, true);
assert.equal(ready.schedule.length, 2);
assert.equal(ready.schedule[0].year, 2026);
assert.equal(ready.schedule[0].totalCarryCostSar, 42000);
assert.equal(ready.schedule[1].year, 2027);
assert.equal(ready.schedule[1].totalCarryCostSar, 47000);
assert.equal(ready.totalCarryCostSar, 89000);
assert.equal(ready.schedule[0].itemCharges.some((entry) => entry.itemId === 'COST-ONCE'), false);
assert.equal(ready.schedule[1].itemCharges.find((entry) => entry.itemId === 'COST-ONCE').amountSar, 5000);
assert.deepEqual(ready.riskFlags, []);
assert.equal(ready.statutoryRateInferredBySoftware, false);
assert.equal(ready.legalApplicabilityInferredBySoftware, false);
assert.equal(ready.taxOrZakatOpinionEstablished, false);
assert.equal(ready.acquisitionTransactionCostCalculated, false);
assert.equal(ready.exitTransactionCostCalculated, false);
assert.equal(ready.npvCalculated, false);
assert.equal(ready.irrCalculated, false);
assert.equal(ready.certifiedValuationEstablished, false);
assert.equal(ready.transactionAuthorized, false);
assert.equal(ready.approvalAuthorized, false);
assert.equal(ready.productionAuthorityGranted, false);
assert.equal(ready.publicAiAuthorized, false);
assert.equal(ready.commercialGoLiveAuthorized, false);

const repeatA = evaluate();
const repeatB = evaluate();
assert.equal(JSON.stringify(repeatA), JSON.stringify(repeatB), 'identical C12 inputs must produce deterministic byte-identical JSON');

const prorated = createGovernedRegulatoryCarryCostEvidence({
  ...common('COST-PRORATE', 'GOVERNED_PRORATED_CHARGE', COST_BASIS.FIXED_ANNUAL_SAR),
  amountSar: 36500,
  effectiveFrom: '2026-07-01T00:00:00Z',
  effectiveTo: '2026-12-31T23:59:59.999Z',
  annualAccrualConvention: ANNUAL_ACCRUAL_CONVENTION.ACTUAL_DAYS_365,
});
const proratedPolicy = policy([prorated], {
  allowedCategories: ['GOVERNED_PRORATED_CHARGE'],
  requiredCategories: [],
  maximumAnnualCarryCostSar: null,
  explicitReferenceAmountSar: null,
  maximumAnnualCarryCostShareOfExplicitReference: null,
});
const proratedResult = evaluate([prorated], proratedPolicy, { horizonEnd: '2026-12-31T23:59:59.999Z' });
assert.equal(proratedResult.status, REGULATORY_CARRY_STATUS.HOLD_POLICY);
assert.ok(proratedResult.blockers.includes('C12_POLICY_HORIZON_END_MISMATCH'));
assert.equal(proratedResult.totalCarryCostSar, null);

const oneYearProratedCore = { ...proratedPolicy, horizonEnd: '2026-12-31T23:59:59.999Z' };
delete oneYearProratedCore.policyHashSha256;
const oneYearProratedPolicy = { ...oneYearProratedCore, policyHashSha256: computeRegulatoryCarryCostReviewPolicyHash(oneYearProratedCore) };
const proratedReady = evaluate([prorated], oneYearProratedPolicy, { horizonEnd: '2026-12-31T23:59:59.999Z' });
assert.equal(proratedReady.status, REGULATORY_CARRY_STATUS.READY_FOR_PROFESSIONAL_REGULATORY_CARRY_COST_REVIEW);
assert.equal(proratedReady.schedule[0].totalCarryCostSar, 18400);

const tampered = { ...annualFixed, amountSar: 12001 };
const tamperedHeld = evaluate([tampered, percentage, perSqm, oneTime], policy([tampered, percentage, perSqm, oneTime]));
assert.equal(tamperedHeld.status, REGULATORY_CARRY_STATUS.HOLD_INTEGRITY);
assert.ok(tamperedHeld.blockers.includes('C12_COST_EVIDENCE_INTEGRITY_FAILED:COST-ANNUAL'));

const futureReviewedCore = { ...annualFixed, reviewedAt: '2026-01-02T00:00:00.000Z' };
futureReviewedCore.costEvidenceHashSha256 = computeRegulatoryCarryCostEvidenceHash(futureReviewedCore);
const futureHeld = evaluate([futureReviewedCore, percentage, perSqm, oneTime], policy([futureReviewedCore, percentage, perSqm, oneTime]));
assert.equal(futureHeld.status, REGULATORY_CARRY_STATUS.HOLD_INTEGRITY);
assert.ok(futureHeld.blockers.includes('C12_COST_EVIDENCE_REVIEW_AFTER_AS_OF:COST-ANNUAL'));

const duplicateHeld = evaluate([annualFixed, annualFixed], policy([annualFixed, annualFixed], {
  allowedCategories: ['GOVERNED_ANNUAL_CHARGE'],
  requiredCategories: ['GOVERNED_ANNUAL_CHARGE'],
}));
assert.equal(duplicateHeld.status, REGULATORY_CARRY_STATUS.HOLD_INTEGRITY);
assert.ok(duplicateHeld.blockers.includes('C12_DUPLICATE_ITEM_ID:COST-ANNUAL'));

const missingRequiredPolicy = policy(evidence, { requiredCategories: ['MISSING_REQUIRED_CATEGORY'], allowedCategories: [...policy().allowedCategories, 'MISSING_REQUIRED_CATEGORY'] });
const missingRequiredHeld = evaluate(evidence, missingRequiredPolicy);
assert.equal(missingRequiredHeld.status, REGULATORY_CARRY_STATUS.HOLD_POLICY);
assert.ok(missingRequiredHeld.blockers.includes('C12_REQUIRED_CATEGORY_MISSING:MISSING_REQUIRED_CATEGORY'));

const tamperedPolicy = { ...policy(), maximumAnnualCarryCostSar: 1 };
const policyIntegrityHeld = evaluate(evidence, tamperedPolicy);
assert.equal(policyIntegrityHeld.status, REGULATORY_CARRY_STATUS.HOLD_INTEGRITY);
assert.ok(policyIntegrityHeld.blockers.includes('C12_POLICY_INTEGRITY_HASH_MISMATCH'));

const riskPolicy = policy(evidence, { maximumAnnualCarryCostSar: 43000, maximumAnnualCarryCostShareOfExplicitReference: 0.043 });
const flagged = evaluate(evidence, riskPolicy);
assert.equal(flagged.status, REGULATORY_CARRY_STATUS.READY_FOR_PROFESSIONAL_REGULATORY_CARRY_COST_REVIEW);
assert.ok(flagged.riskFlags.some((flag) => flag.startsWith('ANNUAL_CARRY_COST_ABOVE_POLICY_MAXIMUM:2027:')));
assert.ok(flagged.riskFlags.some((flag) => flag.startsWith('ANNUAL_CARRY_COST_SHARE_ABOVE_POLICY_MAXIMUM:2027:')));

assert.throws(() => createGovernedRegulatoryCarryCostEvidence({
  ...common('COST-MISSING-BASE', 'BAD', COST_BASIS.PERCENT_OF_EXPLICIT_BASE_ANNUAL),
  rate: 0.02,
  effectiveFrom: HORIZON_START,
  effectiveTo: HORIZON_END,
  annualAccrualConvention: ANNUAL_ACCRUAL_CONVENTION.FULL_CALENDAR_YEAR_IF_ACTIVE,
}), /C12_EXPLICIT_BASE_AMOUNT_SAR_INVALID/);

assert.throws(() => createGovernedRegulatoryCarryCostEvidence({
  ...common('COST-MISSING-AREA', 'BAD', COST_BASIS.PER_SQM_ANNUAL_SAR),
  ratePerSqmSar: 10,
  effectiveFrom: HORIZON_START,
  effectiveTo: HORIZON_END,
  annualAccrualConvention: ANNUAL_ACCRUAL_CONVENTION.FULL_CALENDAR_YEAR_IF_ACTIVE,
}), /C12_EXPLICIT_AREA_SQM_INVALID/);

console.log('C12_GOVERNED_REGULATORY_CARRY_COST=PASS');
