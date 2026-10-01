'use strict';

const assert = require('assert/strict');
const {
  POLICY_VERSION,
  CLOSING_STATUS,
  EVIDENCE_CLASS,
  PROFESSIONAL_STATUS,
  createGovernedClosingEvidence,
  computeClosingEvidenceHash,
  closingEvidenceBindings,
  computeClosingReviewPolicyHash,
  evaluateGovernedClosingIntelligence,
} = require('../../src/closing/governed-encumbrance-mortgage-closing');

const CASE_ID = 'CASE-C13-001';
const PROPERTY_REF = 'PROPERTY-C13-001';
const AS_OF = '2026-01-01T00:00:00.000Z';
const CLOSING_DATE = '2026-03-31T00:00:00.000Z';
const POLICY_ID = 'C13-TEST-POLICY';

function common(recordId, evidenceClass, professionalStatus) {
  return {
    recordId,
    caseId: CASE_ID,
    propertyRef: PROPERTY_REF,
    evidenceClass,
    professionalStatus,
    sourceAuthority: 'AUTHORIZED:PROFESSIONAL-CLOSING-SOURCE',
    sourceRef: `source://${recordId}`,
    sourceEvidenceRef: `evidence://${recordId}`,
    sourceVersionHashSha256: 'a'.repeat(64),
    sourceVerifiedAt: '2025-12-20T00:00:00Z',
    sourceReviewAfter: '2026-12-31T23:59:59Z',
    professionalReviewerRef: 'USER:C13-AUTHORIZED-REVIEWER',
    reviewedAt: '2025-12-31T12:00:00Z',
    validUntil: '2026-12-31T23:59:59Z',
    reviewEvidenceRef: `review://${recordId}`,
    reviewEvidenceHashSha256: 'b'.repeat(64),
  };
}

const mortgage = createGovernedClosingEvidence({
  ...common('MORTGAGE-1', EVIDENCE_CLASS.MORTGAGE_OR_SECURITY_INTEREST, PROFESSIONAL_STATUS.SETTLEMENT_OR_RELEASE_DOCUMENTED),
  settlementAmountSar: 2000000,
  payoffValidUntil: '2026-04-15T00:00:00Z',
});
const lien = createGovernedClosingEvidence({
  ...common('LIEN-1', EVIDENCE_CLASS.LIEN_OR_ENCUMBRANCE, PROFESSIONAL_STATUS.OPEN),
  settlementAmountSar: 150000,
});
const restriction = createGovernedClosingEvidence({
  ...common('RESTRICTION-1', EVIDENCE_CLASS.EASEMENT_OR_RESTRICTION, PROFESSIONAL_STATUS.OPEN),
});
const condition = createGovernedClosingEvidence({
  ...common('CONDITION-1', EVIDENCE_CLASS.CLOSING_CONDITION, PROFESSIONAL_STATUS.VERIFIED_CLEARED),
});
const evidence = [mortgage, lien, restriction, condition];

function policy(records = evidence, overrides = {}) {
  const core = {
    version: POLICY_VERSION,
    policyId: POLICY_ID,
    caseId: CASE_ID,
    propertyRef: PROPERTY_REF,
    asOfDate: AS_OF,
    targetClosingDate: CLOSING_DATE,
    evidenceBindings: closingEvidenceBindings(records),
    allowedEvidenceClasses: Object.values(EVIDENCE_CLASS),
    requiredEvidenceClasses: [EVIDENCE_CLASS.MORTGAGE_OR_SECURITY_INTEREST],
    unresolvedStatuses: [PROFESSIONAL_STATUS.OPEN, PROFESSIONAL_STATUS.SETTLEMENT_OR_RELEASE_DOCUMENTED],
    allowUnknownSettlementAmounts: true,
    reviewedByRef: 'USER:C13-POLICY-REVIEWER',
    reviewedAt: '2026-01-01T00:00:00Z',
    reviewEvidenceRef: 'review://c13/policy/001',
    ...overrides,
  };
  return { ...core, policyHashSha256: computeClosingReviewPolicyHash(core) };
}

function evaluate(records = evidence, selectedPolicy = policy(records), overrides = {}) {
  return evaluateGovernedClosingIntelligence({
    caseId: CASE_ID,
    propertyRef: PROPERTY_REF,
    asOfDate: AS_OF,
    targetClosingDate: CLOSING_DATE,
    closingEvidence: records,
    reviewPolicyId: POLICY_ID,
    governedReviewPolicies: { [POLICY_ID]: selectedPolicy },
    ...overrides,
  });
}

const ready = evaluate();
assert.equal(ready.status, CLOSING_STATUS.READY_FOR_PROFESSIONAL_CLOSING_REVIEW);
assert.equal(ready.professionalClosingReviewReady, true);
assert.equal(ready.knownSettlementTotalSar, 2150000);
assert.deepEqual(ready.unknownSettlementRecordIds, ['RESTRICTION-1']);
assert.ok(ready.riskFlags.includes('UNRESOLVED_BY_GOVERNED_POLICY:MORTGAGE-1:SETTLEMENT_OR_RELEASE_DOCUMENTED'));
assert.ok(ready.riskFlags.includes('UNRESOLVED_BY_GOVERNED_POLICY:LIEN-1:OPEN'));
assert.ok(ready.riskFlags.includes('UNRESOLVED_BY_GOVERNED_POLICY:RESTRICTION-1:OPEN'));
assert.equal(ready.legalTitleOpinionEstablished, false);
assert.equal(ready.lienPriorityDetermined, false);
assert.equal(ready.mortgageReleaseLegallyConfirmed, false);
assert.equal(ready.easementOrRestrictionLegallyInterpreted, false);
assert.equal(ready.lenderPayoffGenerated, false);
assert.equal(ready.transactionAuthorized, false);
assert.equal(ready.approvalAuthorized, false);
assert.equal(ready.productionAuthorityGranted, false);
assert.equal(ready.publicAiAuthorized, false);
assert.equal(ready.commercialGoLiveAuthorized, false);

const repeatA = evaluate();
const repeatB = evaluate();
assert.equal(JSON.stringify(repeatA), JSON.stringify(repeatB), 'identical C13 inputs must produce byte-identical JSON');

const tampered = { ...mortgage, settlementAmountSar: 2000001 };
const tamperedHeld = evaluate([tampered, lien, restriction, condition], policy([tampered, lien, restriction, condition]));
assert.equal(tamperedHeld.status, CLOSING_STATUS.HOLD_INTEGRITY);
assert.ok(tamperedHeld.blockers.includes('C13_EVIDENCE_INTEGRITY_FAILED:MORTGAGE-1'));
assert.equal(tamperedHeld.knownSettlementTotalSar, null);

const futureReviewed = { ...mortgage, reviewedAt: '2026-01-02T00:00:00.000Z' };
futureReviewed.closingEvidenceHashSha256 = computeClosingEvidenceHash(futureReviewed);
const futureHeld = evaluate([futureReviewed, lien, restriction, condition], policy([futureReviewed, lien, restriction, condition]));
assert.equal(futureHeld.status, CLOSING_STATUS.HOLD_INTEGRITY);
assert.ok(futureHeld.blockers.includes('C13_REVIEW_AFTER_AS_OF:MORTGAGE-1'));

const duplicateHeld = evaluate([mortgage, mortgage], policy([mortgage, mortgage], {
  allowedEvidenceClasses: [EVIDENCE_CLASS.MORTGAGE_OR_SECURITY_INTEREST],
  requiredEvidenceClasses: [EVIDENCE_CLASS.MORTGAGE_OR_SECURITY_INTEREST],
}));
assert.equal(duplicateHeld.status, CLOSING_STATUS.HOLD_INTEGRITY);
assert.ok(duplicateHeld.blockers.includes('C13_DUPLICATE_RECORD_ID:MORTGAGE-1'));

const stalePayoffCore = { ...mortgage, payoffValidUntil: '2026-03-01T00:00:00Z' };
stalePayoffCore.closingEvidenceHashSha256 = computeClosingEvidenceHash(stalePayoffCore);
const stalePayoffHeld = evaluate([stalePayoffCore], policy([stalePayoffCore], {
  allowedEvidenceClasses: [EVIDENCE_CLASS.MORTGAGE_OR_SECURITY_INTEREST],
  requiredEvidenceClasses: [EVIDENCE_CLASS.MORTGAGE_OR_SECURITY_INTEREST],
}));
assert.equal(stalePayoffHeld.status, CLOSING_STATUS.HOLD_INTEGRITY);
assert.ok(stalePayoffHeld.blockers.includes('C13_PAYOFF_EXPIRES_BEFORE_TARGET_CLOSING:MORTGAGE-1'));

const missingRequiredPolicy = policy(evidence, {
  requiredEvidenceClasses: [EVIDENCE_CLASS.PAYOFF_OR_RELEASE_REQUIREMENT],
});
const missingRequiredHeld = evaluate(evidence, missingRequiredPolicy);
assert.equal(missingRequiredHeld.status, CLOSING_STATUS.HOLD_POLICY);
assert.ok(missingRequiredHeld.blockers.includes('C13_REQUIRED_EVIDENCE_CLASS_MISSING:PAYOFF_OR_RELEASE_REQUIREMENT'));

const noUnknownPolicy = policy(evidence, { allowUnknownSettlementAmounts: false });
const unknownHeld = evaluate(evidence, noUnknownPolicy);
assert.equal(unknownHeld.status, CLOSING_STATUS.HOLD_POLICY);
assert.ok(unknownHeld.blockers.some((b) => b.startsWith('C13_UNKNOWN_SETTLEMENT_AMOUNTS_NOT_ALLOWED:RESTRICTION-1')));

const tamperedPolicy = { ...policy(), allowUnknownSettlementAmounts: false };
const policyIntegrityHeld = evaluate(evidence, tamperedPolicy);
assert.equal(policyIntegrityHeld.status, CLOSING_STATUS.HOLD_INTEGRITY);
assert.ok(policyIntegrityHeld.blockers.includes('C13_POLICY_INTEGRITY_HASH_MISMATCH'));

const clearedOnly = createGovernedClosingEvidence({
  ...common('CLEARED-1', EVIDENCE_CLASS.MORTGAGE_OR_SECURITY_INTEREST, PROFESSIONAL_STATUS.VERIFIED_CLEARED),
});
const clearedPolicy = policy([clearedOnly], {
  allowedEvidenceClasses: [EVIDENCE_CLASS.MORTGAGE_OR_SECURITY_INTEREST],
  requiredEvidenceClasses: [EVIDENCE_CLASS.MORTGAGE_OR_SECURITY_INTEREST],
  unresolvedStatuses: [PROFESSIONAL_STATUS.OPEN],
  allowUnknownSettlementAmounts: false,
});
const clearedReady = evaluate([clearedOnly], clearedPolicy);
assert.equal(clearedReady.status, CLOSING_STATUS.READY_FOR_PROFESSIONAL_CLOSING_REVIEW);
assert.equal(clearedReady.knownSettlementTotalSar, 0);
assert.deepEqual(clearedReady.unknownSettlementRecordIds, []);
assert.deepEqual(clearedReady.riskFlags, []);

assert.throws(() => createGovernedClosingEvidence({
  ...common('BAD-AMOUNT', EVIDENCE_CLASS.LIEN_OR_ENCUMBRANCE, PROFESSIONAL_STATUS.OPEN),
  settlementAmountSar: -1,
}), /C13_SETTLEMENT_AMOUNT_SAR_INVALID/);

assert.throws(() => createGovernedClosingEvidence({
  ...common('BAD-PAYOFF', EVIDENCE_CLASS.PAYOFF_OR_RELEASE_REQUIREMENT, PROFESSIONAL_STATUS.OPEN),
  payoffValidUntil: '2026-04-15T00:00:00Z',
}), /C13_PAYOFF_VALIDITY_WITHOUT_SETTLEMENT_AMOUNT/);

console.log('C13_GOVERNED_ENCUMBRANCE_MORTGAGE_CLOSING=PASS');
