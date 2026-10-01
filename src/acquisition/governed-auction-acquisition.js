'use strict';

const crypto = require('crypto');

const CAPABILITY = 'C16_GOVERNED_AUCTION_ACQUISITION_INTELLIGENCE_V1';
const POLICY_VERSION = 'C16_AUCTION_REVIEW_POLICY_V1';

const AUCTION_REVIEW_STATUS = Object.freeze({
  READY_FOR_PROFESSIONAL_AUCTION_REVIEW: 'READY_FOR_PROFESSIONAL_AUCTION_REVIEW',
  HOLD_EVIDENCE: 'HOLD_EVIDENCE',
  HOLD_INTEGRITY: 'HOLD_INTEGRITY',
  HOLD_POLICY: 'HOLD_POLICY',
  HOLD_WINDOW: 'HOLD_WINDOW',
  HOLD_ELIGIBILITY: 'HOLD_ELIGIBILITY',
  HOLD_CALCULATION: 'HOLD_CALCULATION',
});

const AUCTION_EVENT_STATUS = Object.freeze({
  SCHEDULED: 'SCHEDULED',
  OPEN: 'OPEN',
  PAUSED: 'PAUSED',
  CLOSED: 'CLOSED',
  CANCELLED: 'CANCELLED',
});

const DEPOSIT_TREATMENT = Object.freeze({
  SEPARATE_FROM_PURCHASE_PRICE: 'SEPARATE_FROM_PURCHASE_PRICE',
  CREDITABLE_TOWARD_PURCHASE_PRICE: 'CREDITABLE_TOWARD_PURCHASE_PRICE',
  UNKNOWN: 'UNKNOWN',
});

const AUCTION_CHARGE_TREATMENT = Object.freeze({
  SEPARATE_FROM_PURCHASE_PRICE: 'SEPARATE_FROM_PURCHASE_PRICE',
  INCLUDED_IN_BID_AMOUNT: 'INCLUDED_IN_BID_AMOUNT',
  UNKNOWN: 'UNKNOWN',
});

const BIDDER_REGISTRATION_STATUS = Object.freeze({
  REGISTERED: 'REGISTERED',
  NOT_REGISTERED: 'NOT_REGISTERED',
  UNRESOLVED: 'UNRESOLVED',
});

const HASH_RE = /^[a-f0-9]{64}$/i;
const nonEmpty = (v) => typeof v === 'string' && v.trim().length > 0;
const clean = (v) => nonEmpty(v) ? v.trim() : '';
const finiteNN = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const finitePositive = (v) => typeof v === 'number' && Number.isFinite(v) && v > 0;

function iso(value, field) {
  if (!nonEmpty(value) || !Number.isFinite(Date.parse(value))) throw new TypeError(`${field} must be a valid date/time`);
  return new Date(value).toISOString();
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((out, key) => {
    out[key] = stable(value[key]);
    return out;
  }, {});
}

function sha256(value) {
  try {
    return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
  } catch (_) {
    return null;
  }
}

function without(value, fields) {
  const out = { ...value };
  for (const field of fields) delete out[field];
  return out;
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}

function uniqueStrings(values, field) {
  if (!Array.isArray(values)) throw new TypeError(`${field} must be an array`);
  const out = values.map((v) => clean(v));
  if (out.some((v) => !v)) throw new TypeError(`${field} contains an invalid value`);
  return [...new Set(out)].sort();
}

function normalizeCharges(charges) {
  if (!Array.isArray(charges)) throw new TypeError('buyerAuctionCharges must be an array');
  const seen = new Set();
  return charges.map((charge) => {
    if (!charge || typeof charge !== 'object' || Array.isArray(charge)) throw new TypeError('C16_CHARGE_OBJECT_REQUIRED');
    const chargeId = clean(charge.chargeId);
    const label = clean(charge.label);
    if (!chargeId || !label) throw new TypeError('C16_CHARGE_ID_LABEL_REQUIRED');
    if (seen.has(chargeId)) throw new TypeError(`C16_DUPLICATE_CHARGE_ID:${chargeId}`);
    seen.add(chargeId);
    if (!finiteNN(charge.amountSar)) throw new TypeError(`C16_CHARGE_AMOUNT_INVALID:${chargeId}`);
    if (!Object.values(AUCTION_CHARGE_TREATMENT).includes(charge.treatment)) {
      throw new TypeError(`C16_CHARGE_TREATMENT_INVALID:${chargeId}`);
    }
    return freeze({ chargeId, label, amountSar: charge.amountSar, treatment: charge.treatment });
  }).sort((a, b) => a.chargeId.localeCompare(b.chargeId));
}

function computeAuctionEvidenceHash(record) {
  return record && typeof record === 'object' && !Array.isArray(record)
    ? sha256(without(record, ['auctionEvidenceHashSha256']))
    : null;
}

function verifyAuctionEvidenceIntegrity(record) {
  return !!record
    && HASH_RE.test(clean(record.auctionEvidenceHashSha256))
    && computeAuctionEvidenceHash(record) === clean(record.auctionEvidenceHashSha256).toLowerCase();
}

function createGovernedAuctionEvidence(x = {}) {
  for (const field of ['auctionEvidenceId', 'caseId', 'propertyRef', 'auctionId', 'auctionProvider', 'sourceRef', 'sourceEvidenceRef', 'verifiedByRef']) {
    if (!nonEmpty(x[field])) throw new TypeError(`${field} must be a non-empty string`);
  }
  if (!HASH_RE.test(clean(x.sourceVersionHashSha256))) throw new TypeError('C16_SOURCE_VERSION_HASH_REQUIRED');
  if (!Object.values(AUCTION_EVENT_STATUS).includes(x.auctionStatus)) throw new TypeError('C16_AUCTION_STATUS_UNSUPPORTED');
  if (!finitePositive(x.startingBidSar)) throw new TypeError('C16_STARTING_BID_INVALID');
  if (x.currentBidSar != null && !finiteNN(x.currentBidSar)) throw new TypeError('C16_CURRENT_BID_INVALID');
  if (x.currentBidSar != null && x.currentBidSar < x.startingBidSar) throw new TypeError('C16_CURRENT_BID_BELOW_STARTING_BID');
  if (x.minimumBidIncrementSar != null && !finitePositive(x.minimumBidIncrementSar)) throw new TypeError('C16_MINIMUM_INCREMENT_INVALID');
  if (x.currentBidSar != null && x.minimumBidIncrementSar == null) throw new TypeError('C16_INCREMENT_REQUIRED_WITH_CURRENT_BID');
  if (!finiteNN(x.bidderDepositSar)) throw new TypeError('C16_DEPOSIT_INVALID');
  if (!Object.values(DEPOSIT_TREATMENT).includes(x.depositTreatment)) throw new TypeError('C16_DEPOSIT_TREATMENT_UNSUPPORTED');
  const registrationDeadline = iso(x.registrationDeadline, 'registrationDeadline');
  const biddingStartAt = iso(x.biddingStartAt, 'biddingStartAt');
  const biddingCloseAt = iso(x.biddingCloseAt, 'biddingCloseAt');
  const sourceVerifiedAt = iso(x.sourceVerifiedAt, 'sourceVerifiedAt');
  const sourceReviewAfter = iso(x.sourceReviewAfter, 'sourceReviewAfter');
  if (Date.parse(biddingCloseAt) <= Date.parse(biddingStartAt)) throw new TypeError('C16_BIDDING_WINDOW_INVALID');
  if (Date.parse(registrationDeadline) > Date.parse(biddingCloseAt)) throw new TypeError('C16_REGISTRATION_AFTER_BIDDING_CLOSE');
  if (Date.parse(sourceReviewAfter) < Date.parse(sourceVerifiedAt)) throw new TypeError('C16_SOURCE_REVIEW_WINDOW_INVALID');
  const core = {
    schemaVersion: 1,
    auctionEvidenceId: x.auctionEvidenceId.trim(),
    caseId: x.caseId.trim(),
    propertyRef: x.propertyRef.trim(),
    auctionId: x.auctionId.trim(),
    auctionProvider: x.auctionProvider.trim(),
    auctionStatus: x.auctionStatus,
    sourceRef: x.sourceRef.trim(),
    sourceEvidenceRef: x.sourceEvidenceRef.trim(),
    sourceVersionHashSha256: x.sourceVersionHashSha256.trim().toLowerCase(),
    sourceVerifiedAt,
    sourceReviewAfter,
    registrationDeadline,
    biddingStartAt,
    biddingCloseAt,
    startingBidSar: x.startingBidSar,
    currentBidSar: x.currentBidSar == null ? null : x.currentBidSar,
    minimumBidIncrementSar: x.minimumBidIncrementSar == null ? null : x.minimumBidIncrementSar,
    bidderDepositSar: x.bidderDepositSar,
    depositTreatment: x.depositTreatment,
    buyerAuctionCharges: normalizeCharges(x.buyerAuctionCharges || []),
    requiredBidderDocumentTypes: uniqueStrings(x.requiredBidderDocumentTypes || [], 'requiredBidderDocumentTypes'),
    verifiedByRef: x.verifiedByRef.trim(),
    bidExecutionAuthorizedByEvidence: false,
    legalEligibilityDeterminedBySoftware: false,
    taxApplicabilityDeterminedBySoftware: false,
  };
  return freeze({ ...core, auctionEvidenceHashSha256: sha256(core) });
}

function computeBidderEvidenceHash(record) {
  return record && typeof record === 'object' && !Array.isArray(record)
    ? sha256(without(record, ['bidderEvidenceHashSha256']))
    : null;
}

function verifyBidderEvidenceIntegrity(record) {
  return !!record
    && HASH_RE.test(clean(record.bidderEvidenceHashSha256))
    && computeBidderEvidenceHash(record) === clean(record.bidderEvidenceHashSha256).toLowerCase();
}

function createGovernedAuctionBidderEvidence(x = {}) {
  for (const field of ['bidderEvidenceId', 'caseId', 'propertyRef', 'auctionId', 'bidderRef', 'registrationEvidenceRef', 'verifiedByRef']) {
    if (!nonEmpty(x[field])) throw new TypeError(`${field} must be a non-empty string`);
  }
  if (!HASH_RE.test(clean(x.registrationEvidenceHashSha256))) throw new TypeError('C16_REGISTRATION_EVIDENCE_HASH_REQUIRED');
  if (!Object.values(BIDDER_REGISTRATION_STATUS).includes(x.registrationStatus)) throw new TypeError('C16_REGISTRATION_STATUS_UNSUPPORTED');
  const registeredAt = x.registeredAt == null ? null : iso(x.registeredAt, 'registeredAt');
  if (x.registrationStatus === BIDDER_REGISTRATION_STATUS.REGISTERED && !registeredAt) throw new TypeError('C16_REGISTERED_AT_REQUIRED');
  const verifiedAt = iso(x.verifiedAt, 'verifiedAt');
  const validUntil = iso(x.validUntil, 'validUntil');
  if (Date.parse(validUntil) < Date.parse(verifiedAt)) throw new TypeError('C16_BIDDER_EVIDENCE_VALIDITY_INVALID');
  const core = {
    schemaVersion: 1,
    bidderEvidenceId: x.bidderEvidenceId.trim(),
    caseId: x.caseId.trim(),
    propertyRef: x.propertyRef.trim(),
    auctionId: x.auctionId.trim(),
    bidderRef: x.bidderRef.trim(),
    registrationStatus: x.registrationStatus,
    registeredAt,
    registrationEvidenceRef: x.registrationEvidenceRef.trim(),
    registrationEvidenceHashSha256: x.registrationEvidenceHashSha256.trim().toLowerCase(),
    providedBidderDocumentTypes: uniqueStrings(x.providedBidderDocumentTypes || [], 'providedBidderDocumentTypes'),
    verifiedByRef: x.verifiedByRef.trim(),
    verifiedAt,
    validUntil,
    legalEligibilityDeterminedBySoftware: false,
  };
  return freeze({ ...core, bidderEvidenceHashSha256: sha256(core) });
}

function computeAcquisitionCeilingHash(record) {
  return record && typeof record === 'object' && !Array.isArray(record)
    ? sha256(without(record, ['acquisitionCeilingHashSha256']))
    : null;
}

function verifyAcquisitionCeilingIntegrity(record) {
  return !!record
    && HASH_RE.test(clean(record.acquisitionCeilingHashSha256))
    && computeAcquisitionCeilingHash(record) === clean(record.acquisitionCeilingHashSha256).toLowerCase();
}

function createGovernedAuctionAcquisitionCeiling(x = {}) {
  for (const field of ['ceilingId', 'caseId', 'propertyRef', 'auctionId', 'instructionIssuerRef', 'instructionRef', 'rationaleRef']) {
    if (!nonEmpty(x[field])) throw new TypeError(`${field} must be a non-empty string`);
  }
  if (!HASH_RE.test(clean(x.auctionEvidenceHashSha256))) throw new TypeError('C16_CEILING_AUCTION_EVIDENCE_HASH_REQUIRED');
  if (!finitePositive(x.maximumBidSar)) throw new TypeError('C16_MAXIMUM_BID_INVALID');
  if (x.maximumKnownCashExposureSar != null && !finitePositive(x.maximumKnownCashExposureSar)) throw new TypeError('C16_MAXIMUM_CASH_EXPOSURE_INVALID');
  const reviewedAt = iso(x.reviewedAt, 'reviewedAt');
  const validUntil = iso(x.validUntil, 'validUntil');
  if (Date.parse(validUntil) < Date.parse(reviewedAt)) throw new TypeError('C16_CEILING_VALIDITY_INVALID');
  const core = {
    schemaVersion: 1,
    ceilingId: x.ceilingId.trim(),
    caseId: x.caseId.trim(),
    propertyRef: x.propertyRef.trim(),
    auctionId: x.auctionId.trim(),
    auctionEvidenceHashSha256: x.auctionEvidenceHashSha256.trim().toLowerCase(),
    maximumBidSar: x.maximumBidSar,
    maximumKnownCashExposureSar: x.maximumKnownCashExposureSar == null ? null : x.maximumKnownCashExposureSar,
    instructionIssuerRef: x.instructionIssuerRef.trim(),
    instructionRef: x.instructionRef.trim(),
    rationaleRef: x.rationaleRef.trim(),
    reviewedAt,
    validUntil,
    maximumBidDerivedBySoftware: false,
    valuationPerformedByThisCapability: false,
    acquisitionApprovedByInstruction: false,
  };
  return freeze({ ...core, acquisitionCeilingHashSha256: sha256(core) });
}

function computeAuctionBidProposalHash(record) {
  return record && typeof record === 'object' && !Array.isArray(record)
    ? sha256(without(record, ['proposalHashSha256']))
    : null;
}

function verifyAuctionBidProposalIntegrity(record) {
  return !!record
    && HASH_RE.test(clean(record.proposalHashSha256))
    && computeAuctionBidProposalHash(record) === clean(record.proposalHashSha256).toLowerCase();
}

function createGovernedAuctionBidProposal(x = {}) {
  for (const field of ['proposalId', 'caseId', 'propertyRef', 'auctionId', 'bidderRef', 'createdByRef', 'evidenceRef']) {
    if (!nonEmpty(x[field])) throw new TypeError(`${field} must be a non-empty string`);
  }
  if (!HASH_RE.test(clean(x.auctionEvidenceHashSha256))) throw new TypeError('C16_PROPOSAL_AUCTION_EVIDENCE_HASH_REQUIRED');
  if (!finitePositive(x.proposedBidSar)) throw new TypeError('C16_PROPOSED_BID_INVALID');
  const createdAt = iso(x.createdAt, 'createdAt');
  const core = {
    schemaVersion: 1,
    proposalId: x.proposalId.trim(),
    caseId: x.caseId.trim(),
    propertyRef: x.propertyRef.trim(),
    auctionId: x.auctionId.trim(),
    bidderRef: x.bidderRef.trim(),
    auctionEvidenceHashSha256: x.auctionEvidenceHashSha256.trim().toLowerCase(),
    proposedBidSar: x.proposedBidSar,
    createdByRef: x.createdByRef.trim(),
    evidenceRef: x.evidenceRef.trim(),
    createdAt,
    bidSubmitted: false,
    paymentInitiated: false,
    termsAccepted: false,
    transactionAuthorized: false,
  };
  return freeze({ ...core, proposalHashSha256: sha256(core) });
}

function computeAuctionReviewPolicyHash(policy) {
  return policy && typeof policy === 'object' && !Array.isArray(policy)
    ? sha256(without(policy, ['policyHashSha256']))
    : null;
}

function createGovernedAuctionReviewPolicy(x = {}) {
  for (const field of ['policyId', 'caseId', 'propertyRef', 'auctionId', 'reviewedByRef', 'reviewEvidenceRef']) {
    if (!nonEmpty(x[field])) throw new TypeError(`${field} must be a non-empty string`);
  }
  for (const field of ['auctionEvidenceHashSha256', 'bidderEvidenceHashSha256', 'acquisitionCeilingHashSha256', 'proposalHashSha256']) {
    if (!HASH_RE.test(clean(x[field]))) throw new TypeError(`C16_POLICY_HASH_BINDING_REQUIRED:${field}`);
  }
  const allowedStatuses = uniqueStrings(x.allowedAuctionStatuses || [], 'allowedAuctionStatuses');
  if (!allowedStatuses.length || allowedStatuses.some((v) => !Object.values(AUCTION_EVENT_STATUS).includes(v))) {
    throw new TypeError('C16_POLICY_ALLOWED_STATUSES_INVALID');
  }
  if (x.requireRegisteredBidder !== true || x.requireAllRequiredDocuments !== true
      || x.requireResolvedDepositTreatment !== true || x.requireResolvedChargeTreatments !== true) {
    throw new TypeError('C16_PHASE0_POLICY_HARD_GATES_REQUIRED');
  }
  const reviewedAt = iso(x.reviewedAt, 'reviewedAt');
  const core = {
    version: POLICY_VERSION,
    policyId: x.policyId.trim(),
    caseId: x.caseId.trim(),
    propertyRef: x.propertyRef.trim(),
    auctionId: x.auctionId.trim(),
    auctionEvidenceHashSha256: x.auctionEvidenceHashSha256.trim().toLowerCase(),
    bidderEvidenceHashSha256: x.bidderEvidenceHashSha256.trim().toLowerCase(),
    acquisitionCeilingHashSha256: x.acquisitionCeilingHashSha256.trim().toLowerCase(),
    proposalHashSha256: x.proposalHashSha256.trim().toLowerCase(),
    allowedAuctionStatuses: allowedStatuses,
    requireRegisteredBidder: true,
    requireAllRequiredDocuments: true,
    requireResolvedDepositTreatment: true,
    requireResolvedChargeTreatments: true,
    reviewedByRef: x.reviewedByRef.trim(),
    reviewEvidenceRef: x.reviewEvidenceRef.trim(),
    reviewedAt,
  };
  return freeze({ ...core, policyHashSha256: sha256(core) });
}

function baseResult(status, blockers, context = {}, review = null, riskFlags = []) {
  const ready = status === AUCTION_REVIEW_STATUS.READY_FOR_PROFESSIONAL_AUCTION_REVIEW;
  return freeze({
    capability: CAPABILITY,
    status,
    blockers: freeze([...new Set(blockers)].sort()),
    riskFlags: freeze([...new Set(riskFlags)].sort()),
    caseId: context.caseId || null,
    propertyRef: context.propertyRef || null,
    auctionId: context.auctionId || null,
    professionalAuctionReviewReady: ready,
    review: ready ? review : null,
    maximumBidDerivedBySoftware: false,
    valuationCalculated: false,
    npvCalculated: false,
    irrCalculated: false,
    legalEligibilityDetermined: false,
    taxApplicabilityDetermined: false,
    titleValidityDetermined: false,
    bidPlaced: false,
    bidderRegisteredBySoftware: false,
    paymentTransferred: false,
    auctionTermsAccepted: false,
    automaticAcquisitionRecommendation: false,
    transactionAuthorized: false,
    approvalAuthorized: false,
    decisionBinding: false,
    productionAuthorityGranted: false,
    publicAiAuthorized: false,
    commercialGoLiveAuthorized: false,
    canonicalBaselineActivationAuthorized: false,
  });
}

function evaluateGovernedAuctionAcquisition({
  auctionEvidence,
  bidderEvidence,
  acquisitionCeiling,
  bidProposal,
  reviewPolicy,
  asOf,
} = {}) {
  const context = {
    caseId: clean(auctionEvidence?.caseId),
    propertyRef: clean(auctionEvidence?.propertyRef),
    auctionId: clean(auctionEvidence?.auctionId),
  };
  const integrityBlockers = [];
  if (!verifyAuctionEvidenceIntegrity(auctionEvidence)) integrityBlockers.push('C16_AUCTION_EVIDENCE_INTEGRITY_FAILED');
  if (!verifyBidderEvidenceIntegrity(bidderEvidence)) integrityBlockers.push('C16_BIDDER_EVIDENCE_INTEGRITY_FAILED');
  if (!verifyAcquisitionCeilingIntegrity(acquisitionCeiling)) integrityBlockers.push('C16_ACQUISITION_CEILING_INTEGRITY_FAILED');
  if (!verifyAuctionBidProposalIntegrity(bidProposal)) integrityBlockers.push('C16_BID_PROPOSAL_INTEGRITY_FAILED');
  if (!reviewPolicy || !HASH_RE.test(clean(reviewPolicy.policyHashSha256))
      || computeAuctionReviewPolicyHash(reviewPolicy) !== clean(reviewPolicy.policyHashSha256).toLowerCase()) {
    integrityBlockers.push('C16_POLICY_INTEGRITY_FAILED');
  }
  if (integrityBlockers.length) return baseResult(AUCTION_REVIEW_STATUS.HOLD_INTEGRITY, integrityBlockers, context);

  const evidenceBlockers = [];
  for (const [name, record] of [['bidder', bidderEvidence], ['ceiling', acquisitionCeiling], ['proposal', bidProposal], ['policy', reviewPolicy]]) {
    if (record.caseId !== context.caseId) evidenceBlockers.push(`C16_${name.toUpperCase()}_CASE_MISMATCH`);
    if (record.propertyRef !== context.propertyRef) evidenceBlockers.push(`C16_${name.toUpperCase()}_PROPERTY_MISMATCH`);
    if (record.auctionId !== context.auctionId) evidenceBlockers.push(`C16_${name.toUpperCase()}_AUCTION_MISMATCH`);
  }
  if (acquisitionCeiling.auctionEvidenceHashSha256 !== auctionEvidence.auctionEvidenceHashSha256) evidenceBlockers.push('C16_CEILING_AUCTION_HASH_MISMATCH');
  if (bidProposal.auctionEvidenceHashSha256 !== auctionEvidence.auctionEvidenceHashSha256) evidenceBlockers.push('C16_PROPOSAL_AUCTION_HASH_MISMATCH');
  if (bidProposal.bidderRef !== bidderEvidence.bidderRef) evidenceBlockers.push('C16_PROPOSAL_BIDDER_MISMATCH');
  if (reviewPolicy.auctionEvidenceHashSha256 !== auctionEvidence.auctionEvidenceHashSha256) evidenceBlockers.push('C16_POLICY_AUCTION_HASH_MISMATCH');
  if (reviewPolicy.bidderEvidenceHashSha256 !== bidderEvidence.bidderEvidenceHashSha256) evidenceBlockers.push('C16_POLICY_BIDDER_HASH_MISMATCH');
  if (reviewPolicy.acquisitionCeilingHashSha256 !== acquisitionCeiling.acquisitionCeilingHashSha256) evidenceBlockers.push('C16_POLICY_CEILING_HASH_MISMATCH');
  if (reviewPolicy.proposalHashSha256 !== bidProposal.proposalHashSha256) evidenceBlockers.push('C16_POLICY_PROPOSAL_HASH_MISMATCH');
  if (evidenceBlockers.length) return baseResult(AUCTION_REVIEW_STATUS.HOLD_EVIDENCE, evidenceBlockers, context);

  const asOfMs = Date.parse(asOf || '');
  if (!Number.isFinite(asOfMs)) return baseResult(AUCTION_REVIEW_STATUS.HOLD_POLICY, ['C16_AS_OF_REQUIRED'], context);

  const policyBlockers = [];
  if (reviewPolicy.version !== POLICY_VERSION) policyBlockers.push('C16_POLICY_VERSION_MISMATCH');
  if (!reviewPolicy.allowedAuctionStatuses.includes(auctionEvidence.auctionStatus)) policyBlockers.push('C16_AUCTION_STATUS_NOT_ALLOWED_BY_POLICY');
  if (reviewPolicy.requireRegisteredBidder !== true || reviewPolicy.requireAllRequiredDocuments !== true
      || reviewPolicy.requireResolvedDepositTreatment !== true || reviewPolicy.requireResolvedChargeTreatments !== true) {
    policyBlockers.push('C16_PHASE0_POLICY_HARD_GATES_MISSING');
  }
  if (Date.parse(reviewPolicy.reviewedAt) > asOfMs) policyBlockers.push('C16_POLICY_REVIEW_FUTURE');
  if (Date.parse(bidProposal.createdAt) > asOfMs) policyBlockers.push('C16_PROPOSAL_CREATED_FUTURE');
  if (policyBlockers.length) return baseResult(AUCTION_REVIEW_STATUS.HOLD_POLICY, policyBlockers, context);

  const temporalBlockers = [];
  if (Date.parse(auctionEvidence.sourceVerifiedAt) > asOfMs) temporalBlockers.push('C16_AUCTION_SOURCE_VERIFIED_FUTURE');
  if (Date.parse(auctionEvidence.sourceReviewAfter) < asOfMs) temporalBlockers.push('C16_AUCTION_SOURCE_STALE');
  if (Date.parse(bidderEvidence.verifiedAt) > asOfMs) temporalBlockers.push('C16_BIDDER_EVIDENCE_VERIFIED_FUTURE');
  if (Date.parse(bidderEvidence.validUntil) < asOfMs) temporalBlockers.push('C16_BIDDER_EVIDENCE_STALE');
  if (Date.parse(acquisitionCeiling.reviewedAt) > asOfMs) temporalBlockers.push('C16_CEILING_REVIEW_FUTURE');
  if (Date.parse(acquisitionCeiling.validUntil) < asOfMs) temporalBlockers.push('C16_CEILING_EXPIRED');
  if (Date.parse(auctionEvidence.biddingCloseAt) <= asOfMs) temporalBlockers.push('C16_BIDDING_WINDOW_CLOSED');
  if (auctionEvidence.auctionStatus === AUCTION_EVENT_STATUS.CLOSED || auctionEvidence.auctionStatus === AUCTION_EVENT_STATUS.CANCELLED) {
    temporalBlockers.push(`C16_AUCTION_NOT_ACTIONABLE:${auctionEvidence.auctionStatus}`);
  }
  if (temporalBlockers.length) return baseResult(AUCTION_REVIEW_STATUS.HOLD_WINDOW, temporalBlockers, context);

  const eligibilityBlockers = [];
  if (bidderEvidence.registrationStatus !== BIDDER_REGISTRATION_STATUS.REGISTERED) eligibilityBlockers.push('C16_BIDDER_NOT_REGISTERED');
  const provided = new Set(bidderEvidence.providedBidderDocumentTypes);
  for (const required of auctionEvidence.requiredBidderDocumentTypes) {
    if (!provided.has(required)) eligibilityBlockers.push(`C16_REQUIRED_BIDDER_DOCUMENT_MISSING:${required}`);
  }
  if (auctionEvidence.depositTreatment === DEPOSIT_TREATMENT.UNKNOWN) eligibilityBlockers.push('C16_DEPOSIT_TREATMENT_UNRESOLVED');
  for (const charge of auctionEvidence.buyerAuctionCharges) {
    if (charge.treatment === AUCTION_CHARGE_TREATMENT.UNKNOWN) eligibilityBlockers.push(`C16_CHARGE_TREATMENT_UNRESOLVED:${charge.chargeId}`);
  }
  if (eligibilityBlockers.length) return baseResult(AUCTION_REVIEW_STATUS.HOLD_ELIGIBILITY, eligibilityBlockers, context);

  const riskFlags = [];
  if (Date.parse(auctionEvidence.biddingStartAt) > asOfMs) riskFlags.push('C16_BIDDING_NOT_OPEN_YET');
  if (Date.parse(auctionEvidence.registrationDeadline) < asOfMs) riskFlags.push('C16_REGISTRATION_DEADLINE_PASSED_BUT_REGISTRATION_EVIDENCE_PRESENT');

  const currentReferenceBidSar = auctionEvidence.currentBidSar == null ? auctionEvidence.startingBidSar : auctionEvidence.currentBidSar;
  const nextMinimumBidSar = auctionEvidence.currentBidSar == null
    ? auctionEvidence.startingBidSar
    : auctionEvidence.currentBidSar + auctionEvidence.minimumBidIncrementSar;
  const proposedBidSar = bidProposal.proposedBidSar;
  const maximumBidSar = acquisitionCeiling.maximumBidSar;
  const headroomToMaximumBidSar = maximumBidSar - proposedBidSar;
  if (proposedBidSar < nextMinimumBidSar) riskFlags.push('C16_PROPOSED_BID_BELOW_NEXT_MINIMUM');
  if (proposedBidSar > maximumBidSar) riskFlags.push('C16_PROPOSED_BID_EXCEEDS_EXTERNAL_MAXIMUM');

  const separateChargesSar = auctionEvidence.buyerAuctionCharges
    .filter((charge) => charge.treatment === AUCTION_CHARGE_TREATMENT.SEPARATE_FROM_PURCHASE_PRICE)
    .reduce((sum, charge) => sum + charge.amountSar, 0);
  const depositSeparateSar = auctionEvidence.depositTreatment === DEPOSIT_TREATMENT.SEPARATE_FROM_PURCHASE_PRICE
    ? auctionEvidence.bidderDepositSar : 0;
  const knownCashExposureSar = proposedBidSar + separateChargesSar + depositSeparateSar;
  let cashExposureHeadroomSar = null;
  if (acquisitionCeiling.maximumKnownCashExposureSar != null) {
    cashExposureHeadroomSar = acquisitionCeiling.maximumKnownCashExposureSar - knownCashExposureSar;
    if (knownCashExposureSar > acquisitionCeiling.maximumKnownCashExposureSar) riskFlags.push('C16_KNOWN_CASH_EXPOSURE_EXCEEDS_EXTERNAL_MAXIMUM');
  }

  if (![nextMinimumBidSar, headroomToMaximumBidSar, separateChargesSar, depositSeparateSar, knownCashExposureSar].every(Number.isFinite)) {
    return baseResult(AUCTION_REVIEW_STATUS.HOLD_CALCULATION, ['C16_NONFINITE_AUCTION_ARITHMETIC'], context);
  }

  const review = freeze({
    auctionStatus: auctionEvidence.auctionStatus,
    biddingStartAt: auctionEvidence.biddingStartAt,
    biddingCloseAt: auctionEvidence.biddingCloseAt,
    registrationDeadline: auctionEvidence.registrationDeadline,
    currentReferenceBidSar,
    nextMinimumBidSar,
    proposedBidSar,
    maximumBidSar,
    headroomToMaximumBidSar,
    proposedBidWithinExternalMaximum: proposedBidSar <= maximumBidSar,
    proposedBidMeetsNextMinimum: proposedBidSar >= nextMinimumBidSar,
    bidderDepositSar: auctionEvidence.bidderDepositSar,
    depositTreatment: auctionEvidence.depositTreatment,
    knownSeparateAuctionChargesSar: separateChargesSar,
    knownSeparateDepositSar: depositSeparateSar,
    knownCashExposureSar,
    maximumKnownCashExposureSar: acquisitionCeiling.maximumKnownCashExposureSar,
    cashExposureHeadroomSar,
    knownCashExposureWithinExternalMaximum: acquisitionCeiling.maximumKnownCashExposureSar == null
      ? null : knownCashExposureSar <= acquisitionCeiling.maximumKnownCashExposureSar,
    requiredBidderDocumentTypes: auctionEvidence.requiredBidderDocumentTypes,
    providedBidderDocumentTypes: bidderEvidence.providedBidderDocumentTypes,
    allRequiredDocumentsPresent: true,
    registrationStatus: bidderEvidence.registrationStatus,
    auctionEvidenceHashSha256: auctionEvidence.auctionEvidenceHashSha256,
    bidderEvidenceHashSha256: bidderEvidence.bidderEvidenceHashSha256,
    acquisitionCeilingHashSha256: acquisitionCeiling.acquisitionCeilingHashSha256,
    proposalHashSha256: bidProposal.proposalHashSha256,
    policyHashSha256: reviewPolicy.policyHashSha256,
    arithmeticOnlyNotAcquisitionApproval: true,
  });

  return baseResult(AUCTION_REVIEW_STATUS.READY_FOR_PROFESSIONAL_AUCTION_REVIEW, [], context, review, riskFlags);
}

module.exports = {
  CAPABILITY,
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
  computeBidderEvidenceHash,
  verifyBidderEvidenceIntegrity,
  createGovernedAuctionAcquisitionCeiling,
  computeAcquisitionCeilingHash,
  verifyAcquisitionCeilingIntegrity,
  createGovernedAuctionBidProposal,
  computeAuctionBidProposalHash,
  verifyAuctionBidProposalIntegrity,
  createGovernedAuctionReviewPolicy,
  computeAuctionReviewPolicyHash,
  evaluateGovernedAuctionAcquisition,
};
