'use strict';

const assert = require('assert');
const {
  POLICY_VERSION,
  FINANCING_STATUS,
  PAYMENT_KIND,
  COMPARISON_METRIC,
  DIRECTION,
  DISCLOSURE_FIELD,
  createGovernedFinancingOffer,
  computeFinancingOfferHash,
  verifyFinancingOfferIntegrity,
  financingOfferBindings,
  computeFinancingComparisonPolicyHash,
  evaluateGovernedFinancingOptions,
} = require('../../src/financing/governed-financing-optimization.js');

const H1 = '1'.repeat(64);
const H2 = '2'.repeat(64);
const H3 = '3'.repeat(64);
const H4 = '4'.repeat(64);

const base = {
  caseId: 'CASE-14',
  propertyRef: 'PROP-14',
  sourceAuthority: 'LENDER_TERM_SHEET',
  sourceVerifiedAt: '2026-09-30T08:00:00Z',
  sourceReviewAfter: '2026-11-30T23:59:59Z',
  professionalReviewerRef: 'TREASURY-REVIEWER-1',
  reviewedAt: '2026-09-30T09:00:00Z',
  validUntil: '2026-12-31T23:59:59Z',
  reviewEvidenceRef: 'REVIEW-EVIDENCE-1',
  repaymentScheduleComplete: true,
  quotedFundingDate: '2026-10-15T00:00:00Z',
  quoteValidUntil: '2026-10-31T23:59:59Z',
  maturityDate: '2028-10-15T00:00:00Z',
  currency: 'SAR',
  comparisonPrincipalSar: 1000000,
};

const offerA = createGovernedFinancingOffer({
  ...base,
  offerId: 'OFFER-A',
  providerRef: 'PROVIDER-A',
  structureLabel: 'TERM-FIXED',
  upfrontFeesSar: 10000,
  sourceRef: 'TERM-A',
  sourceEvidenceRef: 'TERM-A-PDF',
  sourceVersionHashSha256: H1,
  reviewEvidenceHashSha256: H2,
  rateDisclosureRef: 'RATE-A',
  covenantEvidenceRefs: ['COV-A'],
  securityEvidenceRefs: ['SEC-A'],
  repaymentSchedule: [
    { paymentId: 'A-1', paymentDate: '2027-10-15T00:00:00Z', paymentKind: PAYMENT_KIND.DEBT_SERVICE, amountSar: 540000 },
    { paymentId: 'A-2', paymentDate: '2028-10-15T00:00:00Z', paymentKind: PAYMENT_KIND.BALLOON, amountSar: 540000 },
  ],
});

const offerB = createGovernedFinancingOffer({
  ...base,
  offerId: 'OFFER-B',
  providerRef: 'PROVIDER-B',
  structureLabel: 'TERM-FLOATING',
  upfrontFeesSar: 5000,
  sourceRef: 'TERM-B',
  sourceEvidenceRef: 'TERM-B-PDF',
  sourceVersionHashSha256: H3,
  reviewEvidenceHashSha256: H4,
  rateDisclosureRef: 'RATE-B',
  covenantEvidenceRefs: ['COV-B'],
  securityEvidenceRefs: ['SEC-B'],
  repaymentSchedule: [
    { paymentId: 'B-1', paymentDate: '2027-10-15T00:00:00Z', paymentKind: PAYMENT_KIND.DEBT_SERVICE, amountSar: 550000 },
    { paymentId: 'B-2', paymentDate: '2028-10-15T00:00:00Z', paymentKind: PAYMENT_KIND.BALLOON, amountSar: 550000 },
  ],
});

assert(verifyFinancingOfferIntegrity(offerA));
assert.strictEqual(computeFinancingOfferHash(offerA), offerA.financingOfferHashSha256);
assert.deepStrictEqual(createGovernedFinancingOffer({
  ...base,
  offerId: 'OFFER-A',
  providerRef: 'PROVIDER-A',
  structureLabel: 'TERM-FIXED',
  upfrontFeesSar: 10000,
  sourceRef: 'TERM-A',
  sourceEvidenceRef: 'TERM-A-PDF',
  sourceVersionHashSha256: H1,
  reviewEvidenceHashSha256: H2,
  rateDisclosureRef: 'RATE-A',
  covenantEvidenceRefs: ['COV-A'],
  securityEvidenceRefs: ['SEC-A'],
  repaymentSchedule: [
    { paymentId: 'A-2', paymentDate: '2028-10-15T00:00:00Z', paymentKind: PAYMENT_KIND.BALLOON, amountSar: 540000 },
    { paymentId: 'A-1', paymentDate: '2027-10-15T00:00:00Z', paymentKind: PAYMENT_KIND.DEBT_SERVICE, amountSar: 540000 },
  ],
}), offerA);

function makePolicy(offers, overrides = {}) {
  const core = {
    version: POLICY_VERSION,
    policyId: 'POLICY-C14-1',
    caseId: 'CASE-14',
    propertyRef: 'PROP-14',
    asOfDate: '2026-10-01T00:00:00Z',
    targetFundingDate: '2026-10-15T00:00:00Z',
    offerBindings: financingOfferBindings(offers),
    allowedStructureLabels: ['TERM-FIXED', 'TERM-FLOATING'],
    requireEqualComparisonPrincipal: true,
    requiredDisclosureFields: [DISCLOSURE_FIELD.RATE, DISCLOSURE_FIELD.COVENANTS, DISCLOSURE_FIELD.SECURITY],
    rankingCriteria: [
      { metric: COMPARISON_METRIC.NOMINAL_FINANCING_COST_SAR, direction: DIRECTION.MIN },
      { metric: COMPARISON_METRIC.UPFRONT_FEES_SAR, direction: DIRECTION.MIN },
    ],
    reviewThresholds: [
      { metric: COMPARISON_METRIC.BALLOON_TOTAL_SAR, operator: DIRECTION.MAX, value: 545000 },
    ],
    reviewedByRef: 'FIN-COMMITTEE-SECRETARY',
    reviewEvidenceRef: 'POLICY-REVIEW-1',
    reviewedAt: '2026-09-30T12:00:00Z',
    ...overrides,
  };
  return { ...core, policyHashSha256: computeFinancingComparisonPolicyHash(core) };
}

function evaluate(offers = [offerA, offerB], policy = makePolicy(offers), overrides = {}) {
  return evaluateGovernedFinancingOptions({
    caseId: 'CASE-14',
    propertyRef: 'PROP-14',
    asOfDate: '2026-10-01T00:00:00Z',
    targetFundingDate: '2026-10-15T00:00:00Z',
    financingOffers: offers,
    comparisonPolicyId: policy.policyId,
    governedComparisonPolicies: { [policy.policyId]: policy },
    ...overrides,
  });
}

const ready = evaluate();
assert.strictEqual(ready.status, FINANCING_STATUS.READY_FOR_PROFESSIONAL_FINANCING_REVIEW);
assert.strictEqual(ready.professionalFinancingReviewReady, true);
assert.strictEqual(ready.offers.length, 2);
assert.strictEqual(ready.offers[0].metrics.totalScheduledPaymentsSar, 1080000);
assert.strictEqual(ready.offers[0].metrics.nominalFinancingCostSar, 90000);
assert.strictEqual(ready.offers[0].metrics.nominalFinancingCostRatio, 0.09);
assert.strictEqual(ready.offers[0].metrics.balloonTotalSar, 540000);
assert.strictEqual(ready.analyticalOrdering[0].offerId, 'OFFER-A');
assert.strictEqual(ready.analyticalOrdering[0].rank, 1);
assert(ready.riskFlags.some((x) => x.includes('OFFER-B:BALLOON_TOTAL_SAR')));
assert.strictEqual(ready.lenderSelected, false);
assert.strictEqual(ready.creditApproved, false);
assert.strictEqual(ready.transactionAuthorized, false);
assert.strictEqual(ready.decisionBinding, false);

const repeat = evaluate();
assert.deepStrictEqual(repeat, ready);

const tampered = { ...offerA, upfrontFeesSar: 1 };
const tamperedResult = evaluate([tampered, offerB], makePolicy([tampered, offerB]));
assert.strictEqual(tamperedResult.status, FINANCING_STATUS.HOLD_INTEGRITY);
assert(tamperedResult.blockers.some((x) => x === 'C14_OFFER_INTEGRITY_FAILED:OFFER-A'));

const expiredQuote = createGovernedFinancingOffer({
  ...base,
  offerId: 'EXPIRED',
  providerRef: 'PROVIDER-X',
  structureLabel: 'TERM-FIXED',
  upfrontFeesSar: 1000,
  quoteValidUntil: '2026-10-10T00:00:00Z',
  sourceRef: 'TERM-X',
  sourceEvidenceRef: 'TERM-X-PDF',
  sourceVersionHashSha256: H1,
  reviewEvidenceHashSha256: H2,
  repaymentSchedule: [
    { paymentId: 'X-1', paymentDate: '2027-10-15T00:00:00Z', paymentKind: PAYMENT_KIND.BALLOON, amountSar: 1050000 },
  ],
});
const expiredPolicy = makePolicy([expiredQuote], {
  allowedStructureLabels: ['TERM-FIXED'],
  requiredDisclosureFields: [],
});
const expiredResult = evaluate([expiredQuote], expiredPolicy);
assert.strictEqual(expiredResult.status, FINANCING_STATUS.HOLD_INTEGRITY);
assert(expiredResult.blockers.includes('C14_QUOTE_EXPIRES_BEFORE_TARGET_FUNDING:EXPIRED'));

const policyBindingTamperCore = {
  ...makePolicy([offerA, offerB]),
  offerBindings: financingOfferBindings([offerA]),
};
delete policyBindingTamperCore.policyHashSha256;
const policyBindingTamper = {
  ...policyBindingTamperCore,
  policyHashSha256: computeFinancingComparisonPolicyHash(policyBindingTamperCore),
};
const bindingResult = evaluate([offerA, offerB], policyBindingTamper);
assert.strictEqual(bindingResult.status, FINANCING_STATUS.HOLD_INTEGRITY);
assert(bindingResult.blockers.includes('C14_POLICY_OFFER_BINDINGS_MISMATCH'));

const unequalB = createGovernedFinancingOffer({
  ...base,
  comparisonPrincipalSar: 900000,
  offerId: 'OFFER-B2',
  providerRef: 'PROVIDER-B',
  structureLabel: 'TERM-FLOATING',
  upfrontFeesSar: 5000,
  sourceRef: 'TERM-B2',
  sourceEvidenceRef: 'TERM-B2-PDF',
  sourceVersionHashSha256: H3,
  reviewEvidenceHashSha256: H4,
  rateDisclosureRef: 'RATE-B2',
  covenantEvidenceRefs: ['COV-B2'],
  securityEvidenceRefs: ['SEC-B2'],
  repaymentSchedule: [
    { paymentId: 'B2-1', paymentDate: '2027-10-15T00:00:00Z', paymentKind: PAYMENT_KIND.DEBT_SERVICE, amountSar: 500000 },
    { paymentId: 'B2-2', paymentDate: '2028-10-15T00:00:00Z', paymentKind: PAYMENT_KIND.BALLOON, amountSar: 500000 },
  ],
});
const unequalResult = evaluate([offerA, unequalB], makePolicy([offerA, unequalB]));
assert.strictEqual(unequalResult.status, FINANCING_STATUS.HOLD_COMPARABILITY);
assert(unequalResult.blockers.includes('C14_UNEQUAL_COMPARISON_PRINCIPALS'));

const noRate = createGovernedFinancingOffer({
  ...base,
  offerId: 'NO-RATE',
  providerRef: 'PROVIDER-NR',
  structureLabel: 'TERM-FIXED',
  upfrontFeesSar: 10000,
  sourceRef: 'TERM-NR',
  sourceEvidenceRef: 'TERM-NR-PDF',
  sourceVersionHashSha256: H1,
  reviewEvidenceHashSha256: H2,
  covenantEvidenceRefs: ['COV-NR'],
  securityEvidenceRefs: ['SEC-NR'],
  repaymentSchedule: [
    { paymentId: 'NR-1', paymentDate: '2027-10-15T00:00:00Z', paymentKind: PAYMENT_KIND.BALLOON, amountSar: 1080000 },
  ],
});
const disclosureResult = evaluate([noRate], makePolicy([noRate], { allowedStructureLabels: ['TERM-FIXED'] }));
assert.strictEqual(disclosureResult.status, FINANCING_STATUS.HOLD_COMPARABILITY);
assert(disclosureResult.blockers.includes('C14_REQUIRED_RATE_DISCLOSURE_MISSING:NO-RATE'));

const missingContext = evaluateGovernedFinancingOptions({});
assert.strictEqual(missingContext.status, FINANCING_STATUS.HOLD_CONTEXT);
assert(missingContext.blockers.includes('C14_CASE_ID_REQUIRED'));

assert.throws(() => createGovernedFinancingOffer({
  ...base,
  offerId: 'BAD',
  providerRef: 'P',
  structureLabel: 'S',
  upfrontFeesSar: 0,
  sourceRef: 'R',
  sourceEvidenceRef: 'E',
  sourceVersionHashSha256: H1,
  reviewEvidenceHashSha256: H2,
  repaymentScheduleComplete: false,
  repaymentSchedule: [{ paymentId: 'P1', paymentDate: '2027-01-01', paymentKind: PAYMENT_KIND.DEBT_SERVICE, amountSar: 1 }],
}), /C14_COMPLETE_REPAYMENT_SCHEDULE_REQUIRED/);

console.log('C14_GOVERNED_FINANCING_OPTIMIZATION=PASS');
