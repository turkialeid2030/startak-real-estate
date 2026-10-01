'use strict';

const assert = require('assert');
const {
  POLICY_VERSION,
  AUCTION_REVIEW_STATUS,
  AUCTION_EVENT_STATUS,
  DEPOSIT_TREATMENT,
  AUCTION_CHARGE_TREATMENT,
  BIDDER_REGISTRATION_STATUS,
  createGovernedAuctionEvidence,
  computeAuctionEvidenceHash,
  verifyAuctionEvidenceIntegrity,
  createGovernedAuctionBidderEvidence,
  verifyBidderEvidenceIntegrity,
  createGovernedAuctionAcquisitionCeiling,
  verifyAcquisitionCeilingIntegrity,
  createGovernedAuctionBidProposal,
  verifyAuctionBidProposalIntegrity,
  createGovernedAuctionReviewPolicy,
  computeAuctionReviewPolicyHash,
  evaluateGovernedAuctionAcquisition,
} = require('../../src/acquisition/governed-auction-acquisition');

const H1 = '1'.repeat(64);
const H2 = '2'.repeat(64);
const AS_OF = '2026-10-01T12:00:00Z';

function makeAuction(overrides = {}) {
  return createGovernedAuctionEvidence({
    auctionEvidenceId: 'AUC-EVID-16',
    caseId: 'CASE-16',
    propertyRef: 'PROP-16',
    auctionId: 'AUCTION-16',
    auctionProvider: 'GOVERNED-AUCTION-PROVIDER',
    auctionStatus: AUCTION_EVENT_STATUS.OPEN,
    sourceRef: 'AUCTION-SOURCE-16',
    sourceEvidenceRef: 'AUCTION-SOURCE-EVIDENCE-16',
    sourceVersionHashSha256: H1,
    sourceVerifiedAt: '2026-10-01T09:00:00Z',
    sourceReviewAfter: '2026-10-02T12:00:00Z',
    registrationDeadline: '2026-10-01T10:00:00Z',
    biddingStartAt: '2026-10-01T11:00:00Z',
    biddingCloseAt: '2026-10-01T18:00:00Z',
    startingBidSar: 9000000,
    currentBidSar: 10000000,
    minimumBidIncrementSar: 100000,
    bidderDepositSar: 500000,
    depositTreatment: DEPOSIT_TREATMENT.CREDITABLE_TOWARD_PURCHASE_PRICE,
    buyerAuctionCharges: [
      { chargeId: 'CHARGE-PLATFORM', label: 'Explicit auction platform charge', amountSar: 50000, treatment: AUCTION_CHARGE_TREATMENT.SEPARATE_FROM_PURCHASE_PRICE },
      { chargeId: 'CHARGE-INCLUDED', label: 'Explicit included auction charge', amountSar: 20000, treatment: AUCTION_CHARGE_TREATMENT.INCLUDED_IN_BID_AMOUNT },
    ],
    requiredBidderDocumentTypes: ['COMMERCIAL_REGISTRATION', 'AUTHORIZATION'],
    verifiedByRef: 'AUCTION-REVIEWER-16',
    ...overrides,
  });
}

function makeBidder(overrides = {}) {
  return createGovernedAuctionBidderEvidence({
    bidderEvidenceId: 'BIDDER-EVID-16',
    caseId: 'CASE-16',
    propertyRef: 'PROP-16',
    auctionId: 'AUCTION-16',
    bidderRef: 'BIDDER-16',
    registrationStatus: BIDDER_REGISTRATION_STATUS.REGISTERED,
    registeredAt: '2026-10-01T08:00:00Z',
    registrationEvidenceRef: 'REG-EVID-16',
    registrationEvidenceHashSha256: H2,
    providedBidderDocumentTypes: ['COMMERCIAL_REGISTRATION', 'AUTHORIZATION'],
    verifiedByRef: 'BIDDER-REVIEWER-16',
    verifiedAt: '2026-10-01T09:30:00Z',
    validUntil: '2026-10-01T20:00:00Z',
    ...overrides,
  });
}

function makeCeiling(auction, overrides = {}) {
  return createGovernedAuctionAcquisitionCeiling({
    ceilingId: 'CEILING-16',
    caseId: 'CASE-16',
    propertyRef: 'PROP-16',
    auctionId: 'AUCTION-16',
    auctionEvidenceHashSha256: auction.auctionEvidenceHashSha256,
    maximumBidSar: 11000000,
    maximumKnownCashExposureSar: 11100000,
    instructionIssuerRef: 'INVESTMENT-REVIEWER-16',
    instructionRef: 'MAX-BID-INSTRUCTION-16',
    rationaleRef: 'MAX-BID-RATIONALE-16',
    reviewedAt: '2026-10-01T10:00:00Z',
    validUntil: '2026-10-01T18:00:00Z',
    ...overrides,
  });
}

function makeProposal(auction, overrides = {}) {
  return createGovernedAuctionBidProposal({
    proposalId: 'PROPOSAL-16',
    caseId: 'CASE-16',
    propertyRef: 'PROP-16',
    auctionId: 'AUCTION-16',
    bidderRef: 'BIDDER-16',
    auctionEvidenceHashSha256: auction.auctionEvidenceHashSha256,
    proposedBidSar: 10500000,
    createdByRef: 'ASSET-MANAGER-16',
    evidenceRef: 'PROPOSAL-EVIDENCE-16',
    createdAt: '2026-10-01T10:30:00Z',
    ...overrides,
  });
}

function makePolicy(auction, bidder, ceiling, proposal, overrides = {}) {
  return createGovernedAuctionReviewPolicy({
    policyId: 'POLICY-16',
    caseId: 'CASE-16',
    propertyRef: 'PROP-16',
    auctionId: 'AUCTION-16',
    auctionEvidenceHashSha256: auction.auctionEvidenceHashSha256,
    bidderEvidenceHashSha256: bidder.bidderEvidenceHashSha256,
    acquisitionCeilingHashSha256: ceiling.acquisitionCeilingHashSha256,
    proposalHashSha256: proposal.proposalHashSha256,
    allowedAuctionStatuses: [AUCTION_EVENT_STATUS.OPEN, AUCTION_EVENT_STATUS.SCHEDULED],
    requireRegisteredBidder: true,
    requireAllRequiredDocuments: true,
    requireResolvedDepositTreatment: true,
    requireResolvedChargeTreatments: true,
    reviewedByRef: 'AUCTION-GOVERNANCE-16',
    reviewEvidenceRef: 'POLICY-EVIDENCE-16',
    reviewedAt: '2026-10-01T10:45:00Z',
    ...overrides,
  });
}

function fixture(overrides = {}) {
  const auction = overrides.auction || makeAuction(overrides.auctionOverrides);
  const bidder = overrides.bidder || makeBidder(overrides.bidderOverrides);
  const ceiling = overrides.ceiling || makeCeiling(auction, overrides.ceilingOverrides);
  const proposal = overrides.proposal || makeProposal(auction, overrides.proposalOverrides);
  const policy = overrides.policy || makePolicy(auction, bidder, ceiling, proposal, overrides.policyOverrides);
  return { auction, bidder, ceiling, proposal, policy };
}

function evaluate(f = fixture(), asOf = AS_OF) {
  return evaluateGovernedAuctionAcquisition({
    auctionEvidence: f.auction,
    bidderEvidence: f.bidder,
    acquisitionCeiling: f.ceiling,
    bidProposal: f.proposal,
    reviewPolicy: f.policy,
    asOf,
  });
}

const f = fixture();
assert(verifyAuctionEvidenceIntegrity(f.auction));
assert(verifyBidderEvidenceIntegrity(f.bidder));
assert(verifyAcquisitionCeilingIntegrity(f.ceiling));
assert(verifyAuctionBidProposalIntegrity(f.proposal));
assert.strictEqual(computeAuctionEvidenceHash(f.auction), f.auction.auctionEvidenceHashSha256);
assert.strictEqual(computeAuctionReviewPolicyHash(f.policy), f.policy.policyHashSha256);
assert.strictEqual(f.policy.version, POLICY_VERSION);

const ready = evaluate(f);
assert.strictEqual(ready.status, AUCTION_REVIEW_STATUS.READY_FOR_PROFESSIONAL_AUCTION_REVIEW);
assert.strictEqual(ready.professionalAuctionReviewReady, true);
assert.strictEqual(ready.review.currentReferenceBidSar, 10000000);
assert.strictEqual(ready.review.nextMinimumBidSar, 10100000);
assert.strictEqual(ready.review.proposedBidSar, 10500000);
assert.strictEqual(ready.review.maximumBidSar, 11000000);
assert.strictEqual(ready.review.headroomToMaximumBidSar, 500000);
assert.strictEqual(ready.review.knownSeparateAuctionChargesSar, 50000);
assert.strictEqual(ready.review.knownSeparateDepositSar, 0);
assert.strictEqual(ready.review.knownCashExposureSar, 10550000);
assert.strictEqual(ready.review.cashExposureHeadroomSar, 550000);
assert.strictEqual(ready.transactionAuthorized, false);
assert.strictEqual(ready.approvalAuthorized, false);
assert.strictEqual(ready.bidPlaced, false);
assert.strictEqual(ready.paymentTransferred, false);
assert.strictEqual(ready.auctionTermsAccepted, false);
assert.strictEqual(ready.automaticAcquisitionRecommendation, false);
assert.strictEqual(ready.maximumBidDerivedBySoftware, false);
assert.strictEqual(ready.valuationCalculated, false);
assert.strictEqual(ready.npvCalculated, false);
assert.strictEqual(ready.irrCalculated, false);
assert.deepStrictEqual(evaluate(f), ready);

const startingOnlyAuction = makeAuction({
  auctionEvidenceId: 'AUC-START-ONLY',
  auctionStatus: AUCTION_EVENT_STATUS.SCHEDULED,
  currentBidSar: null,
  minimumBidIncrementSar: null,
  registrationDeadline: '2026-10-01T13:00:00Z',
  biddingStartAt: '2026-10-01T14:00:00Z',
  biddingCloseAt: '2026-10-01T20:00:00Z',
});
const startingBidder = makeBidder({ bidderEvidenceId: 'BIDDER-START-ONLY' });
const startingCeiling = makeCeiling(startingOnlyAuction, { ceilingId: 'CEIL-START-ONLY', validUntil: '2026-10-01T20:00:00Z' });
const startingProposal = makeProposal(startingOnlyAuction, { proposalId: 'PROP-START-ONLY', proposedBidSar: 9500000 });
const startingPolicy = makePolicy(startingOnlyAuction, startingBidder, startingCeiling, startingProposal, { policyId: 'POL-START-ONLY' });
const scheduled = evaluate({ auction: startingOnlyAuction, bidder: startingBidder, ceiling: startingCeiling, proposal: startingProposal, policy: startingPolicy });
assert.strictEqual(scheduled.status, AUCTION_REVIEW_STATUS.READY_FOR_PROFESSIONAL_AUCTION_REVIEW);
assert.strictEqual(scheduled.review.nextMinimumBidSar, 9000000);
assert(scheduled.riskFlags.includes('C16_BIDDING_NOT_OPEN_YET'));

const aboveProposal = makeProposal(f.auction, { proposalId: 'PROP-ABOVE', proposedBidSar: 11100000 });
const abovePolicy = makePolicy(f.auction, f.bidder, f.ceiling, aboveProposal, { policyId: 'POL-ABOVE' });
const above = evaluate({ ...f, proposal: aboveProposal, policy: abovePolicy });
assert.strictEqual(above.status, AUCTION_REVIEW_STATUS.HOLD_BID_ENVELOPE);
assert(above.blockers.includes('C16_PROPOSED_BID_EXCEEDS_EXTERNAL_MAXIMUM'));
assert.strictEqual(above.review, null);

const belowProposal = makeProposal(f.auction, { proposalId: 'PROP-BELOW', proposedBidSar: 10050000 });
const belowPolicy = makePolicy(f.auction, f.bidder, f.ceiling, belowProposal, { policyId: 'POL-BELOW' });
const below = evaluate({ ...f, proposal: belowProposal, policy: belowPolicy });
assert.strictEqual(below.status, AUCTION_REVIEW_STATUS.HOLD_BID_ENVELOPE);
assert(below.blockers.includes('C16_PROPOSED_BID_BELOW_NEXT_MINIMUM'));

const tightCeiling = makeCeiling(f.auction, { ceilingId: 'CEIL-TIGHT', maximumKnownCashExposureSar: 10540000 });
const tightPolicy = makePolicy(f.auction, f.bidder, tightCeiling, f.proposal, { policyId: 'POL-TIGHT' });
const tight = evaluate({ ...f, ceiling: tightCeiling, policy: tightPolicy });
assert.strictEqual(tight.status, AUCTION_REVIEW_STATUS.HOLD_BID_ENVELOPE);
assert(tight.blockers.includes('C16_KNOWN_CASH_EXPOSURE_EXCEEDS_EXTERNAL_MAXIMUM'));

const separateDepositAuction = makeAuction({ auctionEvidenceId: 'AUC-DEP-SEPARATE', depositTreatment: DEPOSIT_TREATMENT.SEPARATE_FROM_PURCHASE_PRICE });
const depBidder = makeBidder({ bidderEvidenceId: 'BIDDER-DEP-SEPARATE' });
const depCeiling = makeCeiling(separateDepositAuction, { ceilingId: 'CEIL-DEP-SEPARATE', maximumKnownCashExposureSar: 11200000 });
const depProposal = makeProposal(separateDepositAuction, { proposalId: 'PROP-DEP-SEPARATE' });
const depPolicy = makePolicy(separateDepositAuction, depBidder, depCeiling, depProposal, { policyId: 'POL-DEP-SEPARATE' });
const depReady = evaluate({ auction: separateDepositAuction, bidder: depBidder, ceiling: depCeiling, proposal: depProposal, policy: depPolicy });
assert.strictEqual(depReady.status, AUCTION_REVIEW_STATUS.READY_FOR_PROFESSIONAL_AUCTION_REVIEW);
assert.strictEqual(depReady.review.knownSeparateDepositSar, 500000);
assert.strictEqual(depReady.review.knownCashExposureSar, 11050000);

const unknownDepositAuction = makeAuction({ auctionEvidenceId: 'AUC-DEP-UNKNOWN', depositTreatment: DEPOSIT_TREATMENT.UNKNOWN });
const unknownBidder = makeBidder({ bidderEvidenceId: 'BIDDER-DEP-UNKNOWN' });
const unknownCeiling = makeCeiling(unknownDepositAuction, { ceilingId: 'CEIL-DEP-UNKNOWN' });
const unknownProposal = makeProposal(unknownDepositAuction, { proposalId: 'PROP-DEP-UNKNOWN' });
const unknownPolicy = makePolicy(unknownDepositAuction, unknownBidder, unknownCeiling, unknownProposal, { policyId: 'POL-DEP-UNKNOWN' });
const unknownDeposit = evaluate({ auction: unknownDepositAuction, bidder: unknownBidder, ceiling: unknownCeiling, proposal: unknownProposal, policy: unknownPolicy });
assert.strictEqual(unknownDeposit.status, AUCTION_REVIEW_STATUS.HOLD_ELIGIBILITY);
assert(unknownDeposit.blockers.includes('C16_DEPOSIT_TREATMENT_UNRESOLVED'));

const unknownChargeAuction = makeAuction({
  auctionEvidenceId: 'AUC-CHARGE-UNKNOWN',
  buyerAuctionCharges: [{ chargeId: 'UNKNOWN-FEE', label: 'Unknown treatment fee', amountSar: 10000, treatment: AUCTION_CHARGE_TREATMENT.UNKNOWN }],
});
const chargeBidder = makeBidder({ bidderEvidenceId: 'BIDDER-CHARGE-UNKNOWN' });
const chargeCeiling = makeCeiling(unknownChargeAuction, { ceilingId: 'CEIL-CHARGE-UNKNOWN' });
const chargeProposal = makeProposal(unknownChargeAuction, { proposalId: 'PROP-CHARGE-UNKNOWN' });
const chargePolicy = makePolicy(unknownChargeAuction, chargeBidder, chargeCeiling, chargeProposal, { policyId: 'POL-CHARGE-UNKNOWN' });
const unknownCharge = evaluate({ auction: unknownChargeAuction, bidder: chargeBidder, ceiling: chargeCeiling, proposal: chargeProposal, policy: chargePolicy });
assert.strictEqual(unknownCharge.status, AUCTION_REVIEW_STATUS.HOLD_ELIGIBILITY);
assert(unknownCharge.blockers.includes('C16_CHARGE_TREATMENT_UNRESOLVED:UNKNOWN-FEE'));

const missingDocBidder = makeBidder({ bidderEvidenceId: 'BIDDER-MISSING-DOC', providedBidderDocumentTypes: ['COMMERCIAL_REGISTRATION'] });
const missingDocCeiling = makeCeiling(f.auction, { ceilingId: 'CEIL-MISSING-DOC' });
const missingDocProposal = makeProposal(f.auction, { proposalId: 'PROP-MISSING-DOC' });
const missingDocPolicy = makePolicy(f.auction, missingDocBidder, missingDocCeiling, missingDocProposal, { policyId: 'POL-MISSING-DOC' });
const missingDoc = evaluate({ auction: f.auction, bidder: missingDocBidder, ceiling: missingDocCeiling, proposal: missingDocProposal, policy: missingDocPolicy });
assert.strictEqual(missingDoc.status, AUCTION_REVIEW_STATUS.HOLD_ELIGIBILITY);
assert(missingDoc.blockers.includes('C16_REQUIRED_BIDDER_DOCUMENT_MISSING:AUTHORIZATION'));

const unregisteredBidder = makeBidder({
  bidderEvidenceId: 'BIDDER-NOT-REG',
  registrationStatus: BIDDER_REGISTRATION_STATUS.NOT_REGISTERED,
  registeredAt: null,
});
const unregCeiling = makeCeiling(f.auction, { ceilingId: 'CEIL-NOT-REG' });
const unregProposal = makeProposal(f.auction, { proposalId: 'PROP-NOT-REG' });
const unregPolicy = makePolicy(f.auction, unregisteredBidder, unregCeiling, unregProposal, { policyId: 'POL-NOT-REG' });
const unregistered = evaluate({ auction: f.auction, bidder: unregisteredBidder, ceiling: unregCeiling, proposal: unregProposal, policy: unregPolicy });
assert.strictEqual(unregistered.status, AUCTION_REVIEW_STATUS.HOLD_ELIGIBILITY);
assert(unregistered.blockers.includes('C16_BIDDER_NOT_REGISTERED'));

const staleAuction = makeAuction({ auctionEvidenceId: 'AUC-STALE', sourceReviewAfter: '2026-10-01T11:00:00Z' });
const staleBidder = makeBidder({ bidderEvidenceId: 'BIDDER-STALE' });
const staleCeiling = makeCeiling(staleAuction, { ceilingId: 'CEIL-STALE' });
const staleProposal = makeProposal(staleAuction, { proposalId: 'PROP-STALE' });
const stalePolicy = makePolicy(staleAuction, staleBidder, staleCeiling, staleProposal, { policyId: 'POL-STALE' });
const stale = evaluate({ auction: staleAuction, bidder: staleBidder, ceiling: staleCeiling, proposal: staleProposal, policy: stalePolicy });
assert.strictEqual(stale.status, AUCTION_REVIEW_STATUS.HOLD_WINDOW);
assert(stale.blockers.includes('C16_AUCTION_SOURCE_STALE'));

const closedAuction = makeAuction({ auctionEvidenceId: 'AUC-CLOSED-TIME', biddingCloseAt: '2026-10-01T11:30:00Z' });
const closedBidder = makeBidder({ bidderEvidenceId: 'BIDDER-CLOSED-TIME' });
const closedCeiling = makeCeiling(closedAuction, { ceilingId: 'CEIL-CLOSED-TIME' });
const closedProposal = makeProposal(closedAuction, { proposalId: 'PROP-CLOSED-TIME' });
const closedPolicy = makePolicy(closedAuction, closedBidder, closedCeiling, closedProposal, { policyId: 'POL-CLOSED-TIME' });
const closed = evaluate({ auction: closedAuction, bidder: closedBidder, ceiling: closedCeiling, proposal: closedProposal, policy: closedPolicy });
assert.strictEqual(closed.status, AUCTION_REVIEW_STATUS.HOLD_WINDOW);
assert(closed.blockers.includes('C16_BIDDING_WINDOW_CLOSED'));

const tamperedAuction = { ...f.auction, currentBidSar: 1 };
const tampered = evaluate({ ...f, auction: tamperedAuction });
assert.strictEqual(tampered.status, AUCTION_REVIEW_STATUS.HOLD_INTEGRITY);
assert(tampered.blockers.includes('C16_AUCTION_EVIDENCE_INTEGRITY_FAILED'));

const wrongBidder = makeBidder({ bidderEvidenceId: 'BIDDER-WRONG-PROP', propertyRef: 'OTHER-PROP' });
const wrongCeiling = makeCeiling(f.auction, { ceilingId: 'CEIL-WRONG-PROP' });
const wrongProposal = makeProposal(f.auction, { proposalId: 'PROP-WRONG-PROP' });
const wrongPolicy = makePolicy(f.auction, wrongBidder, wrongCeiling, wrongProposal, { policyId: 'POL-WRONG-PROP' });
const wrongContext = evaluate({ auction: f.auction, bidder: wrongBidder, ceiling: wrongCeiling, proposal: wrongProposal, policy: wrongPolicy });
assert.strictEqual(wrongContext.status, AUCTION_REVIEW_STATUS.HOLD_EVIDENCE);
assert(wrongContext.blockers.includes('C16_BIDDER_PROPERTY_MISMATCH'));

assert.throws(() => createGovernedAuctionReviewPolicy({
  policyId: 'BAD-POL', caseId: 'CASE-16', propertyRef: 'PROP-16', auctionId: 'AUCTION-16',
  auctionEvidenceHashSha256: H1, bidderEvidenceHashSha256: H1, acquisitionCeilingHashSha256: H1, proposalHashSha256: H1,
  allowedAuctionStatuses: [AUCTION_EVENT_STATUS.OPEN], requireRegisteredBidder: false, requireAllRequiredDocuments: true,
  requireResolvedDepositTreatment: true, requireResolvedChargeTreatments: true, reviewedByRef: 'R', reviewEvidenceRef: 'E', reviewedAt: AS_OF,
}), /C16_PHASE0_POLICY_HARD_GATES_REQUIRED/);

assert.throws(() => createGovernedAuctionEvidence({
  auctionEvidenceId: 'BAD-CHARGE', caseId: 'CASE-16', propertyRef: 'PROP-16', auctionId: 'AUCTION-16', auctionProvider: 'P',
  auctionStatus: AUCTION_EVENT_STATUS.OPEN, sourceRef: 'S', sourceEvidenceRef: 'E', sourceVersionHashSha256: H1,
  sourceVerifiedAt: '2026-10-01T09:00:00Z', sourceReviewAfter: '2026-10-02T00:00:00Z', registrationDeadline: '2026-10-01T10:00:00Z',
  biddingStartAt: '2026-10-01T11:00:00Z', biddingCloseAt: '2026-10-01T18:00:00Z', startingBidSar: 1, currentBidSar: null,
  minimumBidIncrementSar: null, bidderDepositSar: 0, depositTreatment: DEPOSIT_TREATMENT.CREDITABLE_TOWARD_PURCHASE_PRICE,
  buyerAuctionCharges: [
    { chargeId: 'DUP', label: 'A', amountSar: 1, treatment: AUCTION_CHARGE_TREATMENT.SEPARATE_FROM_PURCHASE_PRICE },
    { chargeId: 'DUP', label: 'B', amountSar: 1, treatment: AUCTION_CHARGE_TREATMENT.SEPARATE_FROM_PURCHASE_PRICE },
  ], requiredBidderDocumentTypes: [], verifiedByRef: 'V',
}), /C16_DUPLICATE_CHARGE_ID:DUP/);

console.log('C16_GOVERNED_AUCTION_ACQUISITION=PASS');
