'use strict';

const assert = require('assert');
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
  RENTAL_REGULATION_STATUS,
  RENTAL_ACTION_TYPE,
  RENTAL_RULE_CLASS,
  NUMERIC_BASIS,
  APPLICABILITY_STATUS,
  createGovernedRentalRegulationEvidence,
  computeRentalRegulationEvidenceHash,
  verifyRentalRegulationEvidenceIntegrity,
  createGovernedRentalActionProposal,
  computeRentalActionProposalHash,
  verifyRentalActionProposalIntegrity,
  regulationBindings,
  proposalBindings,
  computeRentalRegulationPolicyHash,
  evaluateGovernedRentalRegulation,
} = require('../../src/regulation/governed-rental-regulation');

const H1 = '1'.repeat(64);
const H2 = '2'.repeat(64);
const H3 = '3'.repeat(64);
const H4 = '4'.repeat(64);

const lease = createLeaseEvidenceRecord({
  leaseId: 'LEASE-15-A',
  caseId: 'CASE-15',
  propertyRef: 'PROP-15',
  unitRef: 'UNIT-1',
  tenantRef: 'TENANT-1',
  leaseInterestRef: 'INTEREST-1',
  areaSqm: 100,
  baseAnnualRentSar: 100000,
  contractedAnnualRentSarAsOfDate: 100000,
  startDate: '2026-01-01T00:00:00Z',
  expiryDate: '2028-12-31T23:59:59Z',
  escalation: { type: ESCALATION_TYPE.NONE },
  breakOptions: [],
  renewalOptions: [],
  incentives: [],
  recoveries: { type: RECOVERY_TYPE.NONE },
  sourceClass: LEASE_EVIDENCE_SOURCE.OFFICIAL_REGISTERED_LEASE,
  sourceRef: 'LEASE-SOURCE-15',
  sourceDocumentHashSha256: H1,
  verification: {
    status: LEASE_VERIFICATION_STATUS.VERIFIED,
    verifiedByRef: 'LEASE-REVIEWER-15',
    verifiedAt: '2026-09-30T10:00:00Z',
    evidenceRef: 'LEASE-VERIFY-EVIDENCE-15',
  },
  capturedAt: '2026-09-30T08:00:00Z',
});

const rentRoll = createVerifiedRentRollSnapshot({
  snapshotId: 'RR-15',
  caseId: 'CASE-15',
  propertyRef: 'PROP-15',
  asOfDate: '2026-10-01T00:00:00Z',
  totalLettableAreaSqm: 100,
  occupiedAreaSqm: 100,
  annualContractRentSar: 100000,
  activeLeaseCount: 1,
  sourceRef: 'RR-SOURCE-15',
  sourceDocumentHashSha256: H2,
  verification: {
    status: LEASE_VERIFICATION_STATUS.VERIFIED,
    verifiedByRef: 'RR-REVIEWER-15',
    verifiedAt: '2026-09-30T10:00:00Z',
    evidenceRef: 'RR-VERIFY-EVIDENCE-15',
  },
  capturedAt: '2026-09-30T08:00:00Z',
});

const packet = reconcileLeaseIncomeEvidence({
  caseId: 'CASE-15',
  propertyRef: 'PROP-15',
  leaseRecords: [lease],
  rentRollSnapshot: rentRoll,
  asOfDate: '2026-10-01T00:00:00Z',
  annualRentToleranceSar: 0,
  occupiedAreaToleranceSqm: 0,
  requireVerifiedActiveLeases: true,
});
assert.strictEqual(packet.readyForIncomeAnalysisHandoff, true);

const ruleBase = {
  caseId: 'CASE-15',
  propertyRef: 'PROP-15',
  leaseId: 'LEASE-15-A',
  leaseEvidenceHashSha256: lease.leaseEvidenceHashSha256,
  sourceAuthority: 'AUTHORIZED_RENTAL_REGULATION_SOURCE',
  sourceVerifiedAt: '2026-09-30T08:00:00Z',
  sourceReviewAfter: '2026-12-31T23:59:59Z',
  effectiveFrom: '2026-01-01T00:00:00Z',
  effectiveUntil: '2027-12-31T23:59:59Z',
  professionalReviewerRef: 'RENTAL-LEGAL-REVIEWER-15',
  applicabilityStatus: APPLICABILITY_STATUS.APPLIES,
  applicabilityReviewedAt: '2026-09-30T12:00:00Z',
  applicabilityValidUntil: '2027-12-31T23:59:59Z',
  reviewEvidenceRef: 'RENTAL-REVIEW-15',
};

const rentRule = createGovernedRentalRegulationEvidence({
  ...ruleBase,
  ruleId: 'RULE-RENT-15',
  ruleClass: RENTAL_RULE_CLASS.RENT_ADJUSTMENT,
  numericBasis: NUMERIC_BASIS.MAX_INCREASE_RATE_FROM_CURRENT_CONTRACT_RENT,
  numericValue: 0.05,
  sourceRef: 'REG-SOURCE-RENT-15',
  sourceEvidenceRef: 'REG-EVIDENCE-RENT-15',
  sourceVersionHashSha256: H3,
  applicabilityEvidenceRef: 'APPLICABILITY-RENT-15',
  reviewEvidenceHashSha256: H4,
});

const noticeRule = createGovernedRentalRegulationEvidence({
  ...ruleBase,
  ruleId: 'RULE-NOTICE-15',
  ruleClass: RENTAL_RULE_CLASS.NOTICE_PERIOD,
  numericBasis: NUMERIC_BASIS.MIN_NOTICE_DAYS,
  numericValue: 30,
  sourceRef: 'REG-SOURCE-NOTICE-15',
  sourceEvidenceRef: 'REG-EVIDENCE-NOTICE-15',
  sourceVersionHashSha256: H1,
  applicabilityEvidenceRef: 'APPLICABILITY-NOTICE-15',
  reviewEvidenceHashSha256: H2,
});

assert(verifyRentalRegulationEvidenceIntegrity(rentRule));
assert.strictEqual(computeRentalRegulationEvidenceHash(rentRule), rentRule.regulationEvidenceHashSha256);

const rentProposal = createGovernedRentalActionProposal({
  proposalId: 'PROPOSAL-RENT-15',
  caseId: 'CASE-15',
  propertyRef: 'PROP-15',
  leaseId: 'LEASE-15-A',
  leaseEvidenceHashSha256: lease.leaseEvidenceHashSha256,
  actionType: RENTAL_ACTION_TYPE.ANNUAL_RENT_CHANGE,
  proposedEffectiveDate: '2026-11-01T00:00:00Z',
  proposedAnnualRentSar: 108000,
  evidenceRef: 'PROPOSAL-EVIDENCE-RENT-15',
  createdByRef: 'ASSET-MANAGER-15',
  createdAt: '2026-09-30T14:00:00Z',
});

const noticeProposal = createGovernedRentalActionProposal({
  proposalId: 'PROPOSAL-NOTICE-15',
  caseId: 'CASE-15',
  propertyRef: 'PROP-15',
  leaseId: 'LEASE-15-A',
  leaseEvidenceHashSha256: lease.leaseEvidenceHashSha256,
  actionType: RENTAL_ACTION_TYPE.NOTICE_EVENT,
  proposedEffectiveDate: '2026-11-20T00:00:00Z',
  noticeGivenDate: '2026-10-15T00:00:00Z',
  evidenceRef: 'PROPOSAL-EVIDENCE-NOTICE-15',
  createdByRef: 'ASSET-MANAGER-15',
  createdAt: '2026-09-30T14:00:00Z',
});

assert(verifyRentalActionProposalIntegrity(rentProposal));
assert.strictEqual(computeRentalActionProposalHash(rentProposal), rentProposal.proposalHashSha256);

function makePolicy(rules, proposals, overrides = {}) {
  const core = {
    version: POLICY_VERSION,
    policyId: 'POLICY-C15-1',
    caseId: 'CASE-15',
    propertyRef: 'PROP-15',
    asOfDate: '2026-10-01T00:00:00Z',
    incomeEvidencePacketHashSha256: packet.incomeEvidencePacketHashSha256,
    regulationBindings: regulationBindings(rules),
    proposalBindings: proposalBindings(proposals),
    allowedActionTypes: [RENTAL_ACTION_TYPE.ANNUAL_RENT_CHANGE, RENTAL_ACTION_TYPE.NOTICE_EVENT],
    allowedRuleClasses: [RENTAL_RULE_CLASS.RENT_ADJUSTMENT, RENTAL_RULE_CLASS.NOTICE_PERIOD],
    requiredRuleClassByActionType: {
      [RENTAL_ACTION_TYPE.ANNUAL_RENT_CHANGE]: [RENTAL_RULE_CLASS.RENT_ADJUSTMENT],
      [RENTAL_ACTION_TYPE.NOTICE_EVENT]: [RENTAL_RULE_CLASS.NOTICE_PERIOD],
    },
    allowUnresolvedApplicability: false,
    reviewedByRef: 'RENTAL-GOVERNANCE-REVIEWER-15',
    reviewEvidenceRef: 'POLICY-REVIEW-EVIDENCE-15',
    reviewedAt: '2026-09-30T15:00:00Z',
    ...overrides,
  };
  return { ...core, policyHashSha256: computeRentalRegulationPolicyHash(core) };
}

function evaluate(rules = [rentRule, noticeRule], proposals = [rentProposal, noticeProposal], policy = makePolicy(rules, proposals), overrides = {}) {
  return evaluateGovernedRentalRegulation({
    incomeEvidencePacket: packet,
    regulationEvidence: rules,
    proposals,
    reviewPolicyId: policy.policyId,
    governedReviewPolicies: { [policy.policyId]: policy },
    ...overrides,
  });
}

const ready = evaluate();
assert.strictEqual(ready.status, RENTAL_REGULATION_STATUS.READY_FOR_PROFESSIONAL_RENTAL_REGULATION_REVIEW);
assert.strictEqual(ready.professionalRentalRegulationReviewReady, true);
assert.strictEqual(ready.reviews.length, 2);
const rentReview = ready.reviews.find((r) => r.proposalId === 'PROPOSAL-RENT-15');
assert.strictEqual(rentReview.currentContractedAnnualRentSar, 100000);
assert.strictEqual(rentReview.numericCheck.maximumProfessionallySuppliedAnnualRentSar, 105000);
assert.strictEqual(rentReview.numericCheck.arithmeticWithinSuppliedBound, false);
assert.strictEqual(rentReview.legalComplianceConclusion, null);
const noticeReview = ready.reviews.find((r) => r.proposalId === 'PROPOSAL-NOTICE-15');
assert.strictEqual(noticeReview.numericCheck.elapsedNoticeDays, 36);
assert.strictEqual(noticeReview.numericCheck.arithmeticWithinSuppliedBound, true);
assert(ready.riskFlags.includes('PROPOSED_RENT_EXCEEDS_PROFESSIONALLY_SUPPLIED_NUMERIC_BOUND:PROPOSAL-RENT-15:RULE-RENT-15'));
assert.strictEqual(ready.legalComplianceDetermined, false);
assert.strictEqual(ready.legalApplicabilityDetermined, false);
assert.strictEqual(ready.transactionAuthorized, false);
assert.strictEqual(ready.decisionBinding, false);

assert.deepStrictEqual(evaluate(), ready);

const tamperedRule = { ...rentRule, numericValue: 0.99 };
const tamperedPolicy = makePolicy([tamperedRule, noticeRule], [rentProposal, noticeProposal]);
const tamperedResult = evaluate([tamperedRule, noticeRule], [rentProposal, noticeProposal], tamperedPolicy);
assert.strictEqual(tamperedResult.status, RENTAL_REGULATION_STATUS.HOLD_INTEGRITY);
assert(tamperedResult.blockers.includes('C15_RULE_INTEGRITY_FAILED:RULE-RENT-15'));

const ambiguousRule = createGovernedRentalRegulationEvidence({
  ...ruleBase,
  ruleId: 'RULE-RENT-15-B',
  ruleClass: RENTAL_RULE_CLASS.RENT_ADJUSTMENT,
  numericBasis: NUMERIC_BASIS.MAX_ANNUAL_RENT_SAR,
  numericValue: 106000,
  sourceRef: 'REG-SOURCE-RENT-15-B',
  sourceEvidenceRef: 'REG-EVIDENCE-RENT-15-B',
  sourceVersionHashSha256: H1,
  applicabilityEvidenceRef: 'APPLICABILITY-RENT-15-B',
  reviewEvidenceHashSha256: H2,
});
const ambiguityRules = [rentRule, ambiguousRule];
const ambiguityPolicy = makePolicy(ambiguityRules, [rentProposal], {
  allowedActionTypes: [RENTAL_ACTION_TYPE.ANNUAL_RENT_CHANGE],
  allowedRuleClasses: [RENTAL_RULE_CLASS.RENT_ADJUSTMENT],
  requiredRuleClassByActionType: {
    [RENTAL_ACTION_TYPE.ANNUAL_RENT_CHANGE]: [RENTAL_RULE_CLASS.RENT_ADJUSTMENT],
  },
});
const ambiguityResult = evaluate(ambiguityRules, [rentProposal], ambiguityPolicy);
assert.strictEqual(ambiguityResult.status, RENTAL_REGULATION_STATUS.HOLD_AMBIGUITY);
assert(ambiguityResult.blockers.some((x) => x.startsWith('C15_AMBIGUOUS_NUMERIC_RULES:PROPOSAL-RENT-15:')));

const unresolvedRule = createGovernedRentalRegulationEvidence({
  ...ruleBase,
  ruleId: 'RULE-UNRESOLVED-15',
  ruleClass: RENTAL_RULE_CLASS.RENT_ADJUSTMENT,
  numericBasis: NUMERIC_BASIS.NO_NUMERIC_CONSTRAINT,
  sourceRef: 'REG-SOURCE-UNRESOLVED-15',
  sourceEvidenceRef: 'REG-EVIDENCE-UNRESOLVED-15',
  sourceVersionHashSha256: H1,
  applicabilityStatus: APPLICABILITY_STATUS.UNRESOLVED,
  applicabilityEvidenceRef: 'APPLICABILITY-UNRESOLVED-15',
  reviewEvidenceHashSha256: H2,
});
const unresolvedPolicy = makePolicy([unresolvedRule], [rentProposal], {
  allowedActionTypes: [RENTAL_ACTION_TYPE.ANNUAL_RENT_CHANGE],
  allowedRuleClasses: [RENTAL_RULE_CLASS.RENT_ADJUSTMENT],
  requiredRuleClassByActionType: {
    [RENTAL_ACTION_TYPE.ANNUAL_RENT_CHANGE]: [RENTAL_RULE_CLASS.RENT_ADJUSTMENT],
  },
});
const unresolvedResult = evaluate([unresolvedRule], [rentProposal], unresolvedPolicy);
assert.strictEqual(unresolvedResult.status, RENTAL_REGULATION_STATUS.HOLD_APPLICABILITY);
assert(unresolvedResult.blockers.includes('C15_UNRESOLVED_APPLICABILITY:PROPOSAL-RENT-15:RENT_ADJUSTMENT'));

const bindingMismatchPolicy = makePolicy([rentRule], [rentProposal], {
  allowedActionTypes: [RENTAL_ACTION_TYPE.ANNUAL_RENT_CHANGE],
  allowedRuleClasses: [RENTAL_RULE_CLASS.RENT_ADJUSTMENT],
  requiredRuleClassByActionType: {
    [RENTAL_ACTION_TYPE.ANNUAL_RENT_CHANGE]: [RENTAL_RULE_CLASS.RENT_ADJUSTMENT],
  },
});
const bindingMismatchResult = evaluate([rentRule, noticeRule], [rentProposal], bindingMismatchPolicy);
assert.strictEqual(bindingMismatchResult.status, RENTAL_REGULATION_STATUS.HOLD_INTEGRITY);
assert(bindingMismatchResult.blockers.includes('C15_POLICY_REGULATION_BINDINGS_MISMATCH'));

const staleRule = createGovernedRentalRegulationEvidence({
  ...ruleBase,
  ruleId: 'RULE-STALE-15',
  ruleClass: RENTAL_RULE_CLASS.RENT_ADJUSTMENT,
  numericBasis: NUMERIC_BASIS.NO_RENT_INCREASE,
  sourceVerifiedAt: '2026-09-01T00:00:00Z',
  sourceReviewAfter: '2026-09-30T23:00:00Z',
  sourceRef: 'REG-SOURCE-STALE-15',
  sourceEvidenceRef: 'REG-EVIDENCE-STALE-15',
  sourceVersionHashSha256: H1,
  applicabilityEvidenceRef: 'APPLICABILITY-STALE-15',
  reviewEvidenceHashSha256: H2,
});
const stalePolicy = makePolicy([staleRule], [rentProposal], {
  allowedActionTypes: [RENTAL_ACTION_TYPE.ANNUAL_RENT_CHANGE],
  allowedRuleClasses: [RENTAL_RULE_CLASS.RENT_ADJUSTMENT],
  requiredRuleClassByActionType: {
    [RENTAL_ACTION_TYPE.ANNUAL_RENT_CHANGE]: [RENTAL_RULE_CLASS.RENT_ADJUSTMENT],
  },
});
const staleResult = evaluate([staleRule], [rentProposal], stalePolicy);
assert.strictEqual(staleResult.status, RENTAL_REGULATION_STATUS.HOLD_INTEGRITY);
assert(staleResult.blockers.includes('C15_RULE_SOURCE_STALE_OR_FUTURE:RULE-STALE-15'));

const wrongLeaseRule = createGovernedRentalRegulationEvidence({
  ...ruleBase,
  ruleId: 'RULE-WRONG-LEASE-15',
  leaseEvidenceHashSha256: '9'.repeat(64),
  ruleClass: RENTAL_RULE_CLASS.RENT_ADJUSTMENT,
  numericBasis: NUMERIC_BASIS.NO_RENT_INCREASE,
  sourceRef: 'REG-SOURCE-WRONG-LEASE-15',
  sourceEvidenceRef: 'REG-EVIDENCE-WRONG-LEASE-15',
  sourceVersionHashSha256: H1,
  applicabilityEvidenceRef: 'APPLICABILITY-WRONG-LEASE-15',
  reviewEvidenceHashSha256: H2,
});
const wrongLeasePolicy = makePolicy([wrongLeaseRule], [rentProposal], {
  allowedActionTypes: [RENTAL_ACTION_TYPE.ANNUAL_RENT_CHANGE],
  allowedRuleClasses: [RENTAL_RULE_CLASS.RENT_ADJUSTMENT],
  requiredRuleClassByActionType: {
    [RENTAL_ACTION_TYPE.ANNUAL_RENT_CHANGE]: [RENTAL_RULE_CLASS.RENT_ADJUSTMENT],
  },
});
const wrongLeaseResult = evaluate([wrongLeaseRule], [rentProposal], wrongLeasePolicy);
assert.strictEqual(wrongLeaseResult.status, RENTAL_REGULATION_STATUS.HOLD_INTEGRITY);
assert(wrongLeaseResult.blockers.includes('C15_RULE_LEASE_BINDING_MISMATCH:RULE-WRONG-LEASE-15'));

const malformedPolicy = makePolicy([rentRule, noticeRule], [rentProposal, noticeProposal], {
  requiredRuleClassByActionType: {
    [RENTAL_ACTION_TYPE.ANNUAL_RENT_CHANGE]: [RENTAL_RULE_CLASS.RENT_ADJUSTMENT],
  },
});
const malformedPolicyResult = evaluate([rentRule, noticeRule], [rentProposal, noticeProposal], malformedPolicy);
assert.strictEqual(malformedPolicyResult.status, RENTAL_REGULATION_STATUS.HOLD_POLICY);
assert(malformedPolicyResult.blockers.includes('C15_POLICY_REQUIRED_RULE_CLASSES_INVALID:NOTICE_EVENT'));

const permissiveUnresolvedPolicy = makePolicy([rentRule], [rentProposal], {
  allowedActionTypes: [RENTAL_ACTION_TYPE.ANNUAL_RENT_CHANGE],
  allowedRuleClasses: [RENTAL_RULE_CLASS.RENT_ADJUSTMENT],
  requiredRuleClassByActionType: {
    [RENTAL_ACTION_TYPE.ANNUAL_RENT_CHANGE]: [RENTAL_RULE_CLASS.RENT_ADJUSTMENT],
  },
  allowUnresolvedApplicability: true,
});
const permissiveResult = evaluate([rentRule], [rentProposal], permissiveUnresolvedPolicy);
assert.strictEqual(permissiveResult.status, RENTAL_REGULATION_STATUS.HOLD_POLICY);
assert(permissiveResult.blockers.includes('C15_PHASE0_REQUIRES_UNRESOLVED_APPLICABILITY_FALSE'));

assert.throws(() => createGovernedRentalRegulationEvidence({
  ...ruleBase,
  ruleId: 'BAD-BASIS-15',
  ruleClass: RENTAL_RULE_CLASS.NOTICE_PERIOD,
  numericBasis: NUMERIC_BASIS.MAX_ANNUAL_RENT_SAR,
  numericValue: 100,
  sourceRef: 'BAD',
  sourceEvidenceRef: 'BAD',
  sourceVersionHashSha256: H1,
  applicabilityEvidenceRef: 'BAD',
  reviewEvidenceHashSha256: H2,
}), /C15_RULE_CLASS_NUMERIC_BASIS_MISMATCH/);

assert.throws(() => createGovernedRentalActionProposal({
  proposalId: 'BAD-PROPOSAL-15',
  caseId: 'CASE-15',
  propertyRef: 'PROP-15',
  leaseId: 'LEASE-15-A',
  leaseEvidenceHashSha256: lease.leaseEvidenceHashSha256,
  actionType: RENTAL_ACTION_TYPE.NOTICE_EVENT,
  proposedEffectiveDate: '2026-11-01T00:00:00Z',
  noticeGivenDate: '2026-11-02T00:00:00Z',
  evidenceRef: 'BAD',
  createdByRef: 'BAD',
  createdAt: '2026-09-30T14:00:00Z',
}), /C15_NOTICE_AFTER_PROPOSED_EFFECTIVE_DATE/);

console.log('C15_GOVERNED_RENTAL_REGULATION=PASS');
