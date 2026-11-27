'use strict';

const crypto = require('crypto');
const {isPlainJson}=require('../validation/plain-json-boundary');

const CAPABILITY = 'C16_GOVERNED_AUCTION_ACQUISITION_INTELLIGENCE_V1';
const POLICY_VERSION = 'C16_AUCTION_REVIEW_POLICY_V1';

const AUCTION_REVIEW_STATUS = Object.freeze({
  READY_FOR_PROFESSIONAL_AUCTION_REVIEW: 'READY_FOR_PROFESSIONAL_AUCTION_REVIEW',
  HOLD_EVIDENCE: 'HOLD_EVIDENCE',
  HOLD_INTEGRITY: 'HOLD_INTEGRITY',
  HOLD_POLICY: 'HOLD_POLICY',
  HOLD_WINDOW: 'HOLD_WINDOW',
  HOLD_ELIGIBILITY: 'HOLD_ELIGIBILITY',
  HOLD_BID_ENVELOPE: 'HOLD_BID_ENVELOPE',
  HOLD_CALCULATION: 'HOLD_CALCULATION',
});

const AUCTION_EVENT_STATUS = Object.freeze({
  SCHEDULED: 'SCHEDULED', OPEN: 'OPEN', PAUSED: 'PAUSED', CLOSED: 'CLOSED', CANCELLED: 'CANCELLED',
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
  REGISTERED: 'REGISTERED', NOT_REGISTERED: 'NOT_REGISTERED', UNRESOLVED: 'UNRESOLVED',
});

const HASH_RE = /^[a-f0-9]{64}$/i;
const nonEmpty = (v) => typeof v === 'string' && v.trim().length > 0;
const clean = (v) => nonEmpty(v) ? v.trim() : '';
const {toHalalas,fromHalalas,sumHalalas}=require('../validation/governed-sar-halala');
const finiteNN = (v) => toHalalas(v) !== null;
const finitePositive = (v) => finiteNN(v) && v > 0;

function iso(value, field) {
  if (!nonEmpty(value) || !Number.isFinite(Date.parse(value))) throw new TypeError(`${field} must be a valid date/time`);
  return new Date(value).toISOString();
}
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])]));
}
function sha256(value) {
  try { return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex'); }
  catch (_) { return null; }
}
function without(value, fields) { const out = { ...value }; fields.forEach((f) => delete out[f]); return out; }
function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze); return Object.freeze(value);
}
function uniqueStrings(values, field) {
  if (!Array.isArray(values)) throw new TypeError(`${field} must be an array`);
  const out = values.map(clean);
  if (out.some((v) => !v)) throw new TypeError(`${field} contains an invalid value`);
  return [...new Set(out)].sort();
}
function normalizeCharges(charges) {
  if (!Array.isArray(charges)) throw new TypeError('buyerAuctionCharges must be an array');
  const seen = new Set();
  return charges.map((charge) => {
    if (!charge || typeof charge !== 'object' || Array.isArray(charge)) throw new TypeError('C16_CHARGE_OBJECT_REQUIRED');
    const chargeId = clean(charge.chargeId); const label = clean(charge.label);
    if (!chargeId || !label) throw new TypeError('C16_CHARGE_ID_LABEL_REQUIRED');
    if (seen.has(chargeId)) throw new TypeError(`C16_DUPLICATE_CHARGE_ID:${chargeId}`);
    seen.add(chargeId);
    if (!finiteNN(charge.amountSar)) throw new TypeError(`C16_CHARGE_AMOUNT_INVALID:${chargeId}`);
    if (!Object.values(AUCTION_CHARGE_TREATMENT).includes(charge.treatment)) throw new TypeError(`C16_CHARGE_TREATMENT_INVALID:${chargeId}`);
    return freeze({ chargeId, label, amountSar: charge.amountSar, treatment: charge.treatment });
  }).sort((a, b) => a.chargeId.localeCompare(b.chargeId));
}

// Restored from LEG-001; hashes are consistency checks, not authenticated signatures.
function verifyRecord(r,key,ctor){
 try{return isPlainJson(r)&&HASH_RE.test(r[key])&&sha256(without(r,[key]))===r[key]&&ctor(r)[key]===r[key];}catch{return false;}
}
function computeAuctionEvidenceHash(r) { return r && typeof r === 'object' && !Array.isArray(r) ? sha256(without(r, ['auctionEvidenceHashSha256'])) : null; }
function verifyAuctionEvidenceIntegrity(r) { return verifyRecord(r,'auctionEvidenceHashSha256',createGovernedAuctionEvidence); }
function createGovernedAuctionEvidence(x = {}) {
  if (!isPlainJson(x) || !x || typeof x !== 'object' || Array.isArray(x)) throw new TypeError('C16_INPUT_JSON_INVALID');
  ['auctionEvidenceId','caseId','propertyRef','auctionId','auctionProvider','sourceRef','sourceEvidenceRef','verifiedByRef'].forEach((f) => {
    if (!nonEmpty(x[f])) throw new TypeError(`${f} must be a non-empty string`);
  });
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
    schemaVersion: 1, auctionEvidenceId: x.auctionEvidenceId.trim(), caseId: x.caseId.trim(), propertyRef: x.propertyRef.trim(),
    auctionId: x.auctionId.trim(), auctionProvider: x.auctionProvider.trim(), auctionStatus: x.auctionStatus,
    sourceRef: x.sourceRef.trim(), sourceEvidenceRef: x.sourceEvidenceRef.trim(), sourceVersionHashSha256: x.sourceVersionHashSha256.trim().toLowerCase(),
    sourceVerifiedAt, sourceReviewAfter, registrationDeadline, biddingStartAt, biddingCloseAt,
    startingBidSar: x.startingBidSar, currentBidSar: x.currentBidSar == null ? null : x.currentBidSar,
    minimumBidIncrementSar: x.minimumBidIncrementSar == null ? null : x.minimumBidIncrementSar,
    bidderDepositSar: x.bidderDepositSar, depositTreatment: x.depositTreatment,
    buyerAuctionCharges: normalizeCharges(x.buyerAuctionCharges || []),
    requiredBidderDocumentTypes: uniqueStrings(x.requiredBidderDocumentTypes || [], 'requiredBidderDocumentTypes'),
    verifiedByRef: x.verifiedByRef.trim(), bidExecutionAuthorizedByEvidence: false,
    legalEligibilityDeterminedBySoftware: false, taxApplicabilityDeterminedBySoftware: false,
  };
  return freeze({ ...core, auctionEvidenceHashSha256: sha256(core) });
}

function computeBidderEvidenceHash(r) { return r && typeof r === 'object' && !Array.isArray(r) ? sha256(without(r, ['bidderEvidenceHashSha256'])) : null; }
function verifyBidderEvidenceIntegrity(r) { return verifyRecord(r,'bidderEvidenceHashSha256',createGovernedAuctionBidderEvidence); }
function createGovernedAuctionBidderEvidence(x = {}) {
  if (!isPlainJson(x) || !x || typeof x !== 'object' || Array.isArray(x)) throw new TypeError('C16_INPUT_JSON_INVALID');
  ['bidderEvidenceId','caseId','propertyRef','auctionId','bidderRef','registrationEvidenceRef','verifiedByRef'].forEach((f) => {
    if (!nonEmpty(x[f])) throw new TypeError(`${f} must be a non-empty string`);
  });
  if (!HASH_RE.test(clean(x.registrationEvidenceHashSha256))) throw new TypeError('C16_REGISTRATION_EVIDENCE_HASH_REQUIRED');
  if (!Object.values(BIDDER_REGISTRATION_STATUS).includes(x.registrationStatus)) throw new TypeError('C16_REGISTRATION_STATUS_UNSUPPORTED');
  const registeredAt = x.registeredAt == null ? null : iso(x.registeredAt, 'registeredAt');
  if (x.registrationStatus === BIDDER_REGISTRATION_STATUS.REGISTERED && !registeredAt) throw new TypeError('C16_REGISTERED_AT_REQUIRED');
  const verifiedAt = iso(x.verifiedAt, 'verifiedAt'); const validUntil = iso(x.validUntil, 'validUntil');
  if (Date.parse(validUntil) < Date.parse(verifiedAt)) throw new TypeError('C16_BIDDER_EVIDENCE_VALIDITY_INVALID');
  const core = {
    schemaVersion: 1, bidderEvidenceId: x.bidderEvidenceId.trim(), caseId: x.caseId.trim(), propertyRef: x.propertyRef.trim(),
    auctionId: x.auctionId.trim(), bidderRef: x.bidderRef.trim(), registrationStatus: x.registrationStatus, registeredAt,
    registrationEvidenceRef: x.registrationEvidenceRef.trim(), registrationEvidenceHashSha256: x.registrationEvidenceHashSha256.trim().toLowerCase(),
    providedBidderDocumentTypes: uniqueStrings(x.providedBidderDocumentTypes || [], 'providedBidderDocumentTypes'),
    verifiedByRef: x.verifiedByRef.trim(), verifiedAt, validUntil, legalEligibilityDeterminedBySoftware: false,
  };
  return freeze({ ...core, bidderEvidenceHashSha256: sha256(core) });
}

function computeAcquisitionCeilingHash(r) { return r && typeof r === 'object' && !Array.isArray(r) ? sha256(without(r, ['acquisitionCeilingHashSha256'])) : null; }
function verifyAcquisitionCeilingIntegrity(r) { return verifyRecord(r,'acquisitionCeilingHashSha256',createGovernedAuctionAcquisitionCeiling); }
function createGovernedAuctionAcquisitionCeiling(x = {}) {
  if (!isPlainJson(x) || !x || typeof x !== 'object' || Array.isArray(x)) throw new TypeError('C16_INPUT_JSON_INVALID');
  ['ceilingId','caseId','propertyRef','auctionId','instructionIssuerRef','instructionRef','rationaleRef'].forEach((f) => {
    if (!nonEmpty(x[f])) throw new TypeError(`${f} must be a non-empty string`);
  });
  if (!HASH_RE.test(clean(x.auctionEvidenceHashSha256))) throw new TypeError('C16_CEILING_AUCTION_EVIDENCE_HASH_REQUIRED');
  if (!finitePositive(x.maximumBidSar)) throw new TypeError('C16_MAXIMUM_BID_INVALID');
  if (x.maximumKnownCashExposureSar != null && !finitePositive(x.maximumKnownCashExposureSar)) throw new TypeError('C16_MAXIMUM_CASH_EXPOSURE_INVALID');
  const reviewedAt = iso(x.reviewedAt, 'reviewedAt'); const validUntil = iso(x.validUntil, 'validUntil');
  if (Date.parse(validUntil) < Date.parse(reviewedAt)) throw new TypeError('C16_CEILING_VALIDITY_INVALID');
  const core = {
    schemaVersion: 1, ceilingId: x.ceilingId.trim(), caseId: x.caseId.trim(), propertyRef: x.propertyRef.trim(), auctionId: x.auctionId.trim(),
    auctionEvidenceHashSha256: x.auctionEvidenceHashSha256.trim().toLowerCase(), maximumBidSar: x.maximumBidSar,
    maximumKnownCashExposureSar: x.maximumKnownCashExposureSar == null ? null : x.maximumKnownCashExposureSar,
    instructionIssuerRef: x.instructionIssuerRef.trim(), instructionRef: x.instructionRef.trim(), rationaleRef: x.rationaleRef.trim(),
    reviewedAt, validUntil, maximumBidDerivedBySoftware: false, valuationPerformedByThisCapability: false, acquisitionApprovedByInstruction: false,
  };
  return freeze({ ...core, acquisitionCeilingHashSha256: sha256(core) });
}

function computeAuctionBidProposalHash(r) { return r && typeof r === 'object' && !Array.isArray(r) ? sha256(without(r, ['proposalHashSha256'])) : null; }
function verifyAuctionBidProposalIntegrity(r) { return verifyRecord(r,'proposalHashSha256',createGovernedAuctionBidProposal); }
function createGovernedAuctionBidProposal(x = {}) {
  if (!isPlainJson(x) || !x || typeof x !== 'object' || Array.isArray(x)) throw new TypeError('C16_INPUT_JSON_INVALID');
  ['proposalId','caseId','propertyRef','auctionId','bidderRef','createdByRef','evidenceRef'].forEach((f) => {
    if (!nonEmpty(x[f])) throw new TypeError(`${f} must be a non-empty string`);
  });
  if (!HASH_RE.test(clean(x.auctionEvidenceHashSha256))) throw new TypeError('C16_PROPOSAL_AUCTION_EVIDENCE_HASH_REQUIRED');
  if (!finitePositive(x.proposedBidSar)) throw new TypeError('C16_PROPOSED_BID_INVALID');
  const createdAt = iso(x.createdAt, 'createdAt');
  const core = {
    schemaVersion: 1, proposalId: x.proposalId.trim(), caseId: x.caseId.trim(), propertyRef: x.propertyRef.trim(), auctionId: x.auctionId.trim(),
    bidderRef: x.bidderRef.trim(), auctionEvidenceHashSha256: x.auctionEvidenceHashSha256.trim().toLowerCase(), proposedBidSar: x.proposedBidSar,
    createdByRef: x.createdByRef.trim(), evidenceRef: x.evidenceRef.trim(), createdAt,
    bidSubmitted: false, paymentInitiated: false, termsAccepted: false, transactionAuthorized: false,
  };
  return freeze({ ...core, proposalHashSha256: sha256(core) });
}

function computeAuctionReviewPolicyHash(r) { return r && typeof r === 'object' && !Array.isArray(r) ? sha256(without(r, ['policyHashSha256'])) : null; }
function createGovernedAuctionReviewPolicy(x = {}) {
  if (!isPlainJson(x) || !x || typeof x !== 'object' || Array.isArray(x)) throw new TypeError('C16_INPUT_JSON_INVALID');
  ['policyId','caseId','propertyRef','auctionId','reviewedByRef','reviewEvidenceRef'].forEach((f) => {
    if (!nonEmpty(x[f])) throw new TypeError(`${f} must be a non-empty string`);
  });
  ['auctionEvidenceHashSha256','bidderEvidenceHashSha256','acquisitionCeilingHashSha256','proposalHashSha256'].forEach((f) => {
    if (!HASH_RE.test(clean(x[f]))) throw new TypeError(`C16_POLICY_HASH_BINDING_REQUIRED:${f}`);
  });
  const allowedAuctionStatuses = uniqueStrings(x.allowedAuctionStatuses || [], 'allowedAuctionStatuses');
  if (!allowedAuctionStatuses.length || allowedAuctionStatuses.some((v) => !Object.values(AUCTION_EVENT_STATUS).includes(v))) throw new TypeError('C16_POLICY_ALLOWED_STATUSES_INVALID');
  if (x.requireRegisteredBidder !== true || x.requireAllRequiredDocuments !== true || x.requireResolvedDepositTreatment !== true || x.requireResolvedChargeTreatments !== true) {
    throw new TypeError('C16_PHASE0_POLICY_HARD_GATES_REQUIRED');
  }
  const reviewedAt = iso(x.reviewedAt, 'reviewedAt');
  const core = {
    version: POLICY_VERSION, policyId: x.policyId.trim(), caseId: x.caseId.trim(), propertyRef: x.propertyRef.trim(), auctionId: x.auctionId.trim(),
    auctionEvidenceHashSha256: x.auctionEvidenceHashSha256.trim().toLowerCase(), bidderEvidenceHashSha256: x.bidderEvidenceHashSha256.trim().toLowerCase(),
    acquisitionCeilingHashSha256: x.acquisitionCeilingHashSha256.trim().toLowerCase(), proposalHashSha256: x.proposalHashSha256.trim().toLowerCase(),
    allowedAuctionStatuses, requireRegisteredBidder: true, requireAllRequiredDocuments: true,
    requireResolvedDepositTreatment: true, requireResolvedChargeTreatments: true,
    reviewedByRef: x.reviewedByRef.trim(), reviewEvidenceRef: x.reviewEvidenceRef.trim(), reviewedAt,
  };
  return freeze({ ...core, policyHashSha256: sha256(core) });
}

function baseResult(status, blockers, context = {}, review = null, riskFlags = []) {
  const ready = status === AUCTION_REVIEW_STATUS.READY_FOR_PROFESSIONAL_AUCTION_REVIEW;
  return freeze({
    capability: CAPABILITY, status, blockers: freeze([...new Set(blockers)].sort()), riskFlags: freeze([...new Set(riskFlags)].sort()),
    caseId: context.caseId || null, propertyRef: context.propertyRef || null, auctionId: context.auctionId || null,
    professionalAuctionReviewReady: ready, review: ready ? review : null,
    maximumBidDerivedBySoftware: false, valuationCalculated: false, npvCalculated: false, irrCalculated: false,
    legalEligibilityDetermined: false, taxApplicabilityDetermined: false, titleValidityDetermined: false,
    bidPlaced: false, bidderRegisteredBySoftware: false, paymentTransferred: false, auctionTermsAccepted: false,
    automaticAcquisitionRecommendation: false, transactionAuthorized: false, approvalAuthorized: false, decisionBinding: false,
    productionAuthorityGranted: false, publicAiAuthorized: false, commercialGoLiveAuthorized: false, canonicalBaselineActivationAuthorized: false,
  });
}

function evaluateGovernedAuctionAcquisition(input = {}) {
  if (!isPlainJson(input) || !input || typeof input !== 'object' || Array.isArray(input)) return baseResult(AUCTION_REVIEW_STATUS.HOLD_INTEGRITY,['C16_INPUT_JSON_INVALID']);
  const { auctionEvidence, bidderEvidence, acquisitionCeiling, bidProposal, reviewPolicy, asOf } = input;
  const safeAuction=isPlainJson(auctionEvidence)?auctionEvidence:null;
  const context = { caseId: clean(safeAuction?.caseId), propertyRef: clean(safeAuction?.propertyRef), auctionId: clean(safeAuction?.auctionId) };
  const integrity = [];
  if (!verifyAuctionEvidenceIntegrity(auctionEvidence)) integrity.push('C16_AUCTION_EVIDENCE_INTEGRITY_FAILED');
  if (!verifyBidderEvidenceIntegrity(bidderEvidence)) integrity.push('C16_BIDDER_EVIDENCE_INTEGRITY_FAILED');
  if (!verifyAcquisitionCeilingIntegrity(acquisitionCeiling)) integrity.push('C16_ACQUISITION_CEILING_INTEGRITY_FAILED');
  if (!verifyAuctionBidProposalIntegrity(bidProposal)) integrity.push('C16_BID_PROPOSAL_INTEGRITY_FAILED');
  if (!verifyRecord(reviewPolicy,'policyHashSha256',createGovernedAuctionReviewPolicy)) integrity.push('C16_POLICY_INTEGRITY_FAILED');
  if (integrity.length) return baseResult(AUCTION_REVIEW_STATUS.HOLD_INTEGRITY, integrity, context);

  const evidence = [];
  for (const [name, record] of [['bidder', bidderEvidence], ['ceiling', acquisitionCeiling], ['proposal', bidProposal], ['policy', reviewPolicy]]) {
    if (record.caseId !== context.caseId) evidence.push(`C16_${name.toUpperCase()}_CASE_MISMATCH`);
    if (record.propertyRef !== context.propertyRef) evidence.push(`C16_${name.toUpperCase()}_PROPERTY_MISMATCH`);
    if (record.auctionId !== context.auctionId) evidence.push(`C16_${name.toUpperCase()}_AUCTION_MISMATCH`);
  }
  if (acquisitionCeiling.auctionEvidenceHashSha256 !== auctionEvidence.auctionEvidenceHashSha256) evidence.push('C16_CEILING_AUCTION_HASH_MISMATCH');
  if (bidProposal.auctionEvidenceHashSha256 !== auctionEvidence.auctionEvidenceHashSha256) evidence.push('C16_PROPOSAL_AUCTION_HASH_MISMATCH');
  if (bidProposal.bidderRef !== bidderEvidence.bidderRef) evidence.push('C16_PROPOSAL_BIDDER_MISMATCH');
  if (reviewPolicy.auctionEvidenceHashSha256 !== auctionEvidence.auctionEvidenceHashSha256) evidence.push('C16_POLICY_AUCTION_HASH_MISMATCH');
  if (reviewPolicy.bidderEvidenceHashSha256 !== bidderEvidence.bidderEvidenceHashSha256) evidence.push('C16_POLICY_BIDDER_HASH_MISMATCH');
  if (reviewPolicy.acquisitionCeilingHashSha256 !== acquisitionCeiling.acquisitionCeilingHashSha256) evidence.push('C16_POLICY_CEILING_HASH_MISMATCH');
  if (reviewPolicy.proposalHashSha256 !== bidProposal.proposalHashSha256) evidence.push('C16_POLICY_PROPOSAL_HASH_MISMATCH');
  if (evidence.length) return baseResult(AUCTION_REVIEW_STATUS.HOLD_EVIDENCE, evidence, context);

  const asOfMs = typeof asOf === 'string' ? Date.parse(asOf) : NaN;
  if (!Number.isFinite(asOfMs)||asOfMs>Date.now()) return baseResult(AUCTION_REVIEW_STATUS.HOLD_POLICY, ['C16_AS_OF_REQUIRED'], context);
  const policy = [];
  if (reviewPolicy.version !== POLICY_VERSION) policy.push('C16_POLICY_VERSION_MISMATCH');
  if (!reviewPolicy.allowedAuctionStatuses.includes(auctionEvidence.auctionStatus)) policy.push('C16_AUCTION_STATUS_NOT_ALLOWED_BY_POLICY');
  if (reviewPolicy.requireRegisteredBidder !== true || reviewPolicy.requireAllRequiredDocuments !== true || reviewPolicy.requireResolvedDepositTreatment !== true || reviewPolicy.requireResolvedChargeTreatments !== true) policy.push('C16_PHASE0_POLICY_HARD_GATES_MISSING');
  if (Date.parse(reviewPolicy.reviewedAt) > asOfMs) policy.push('C16_POLICY_REVIEW_FUTURE');
  if (Date.parse(bidProposal.createdAt) > asOfMs) policy.push('C16_PROPOSAL_CREATED_FUTURE');
  if([auctionEvidence.sourceVerifiedAt,bidderEvidence.verifiedAt,acquisitionCeiling.reviewedAt,bidProposal.createdAt].some(v=>Date.parse(v)>Date.parse(reviewPolicy.reviewedAt)))policy.push('C16_POLICY_PREDATES_PREREQUISITES');
  if (policy.length) return baseResult(AUCTION_REVIEW_STATUS.HOLD_POLICY, policy, context);

  const temporal = [];
  if (Date.parse(auctionEvidence.sourceVerifiedAt) > asOfMs) temporal.push('C16_AUCTION_SOURCE_VERIFIED_FUTURE');
  if (Date.parse(auctionEvidence.sourceReviewAfter) < asOfMs) temporal.push('C16_AUCTION_SOURCE_STALE');
  if (Date.parse(bidderEvidence.verifiedAt) > asOfMs) temporal.push('C16_BIDDER_EVIDENCE_VERIFIED_FUTURE');
  if (Date.parse(bidderEvidence.validUntil) < asOfMs) temporal.push('C16_BIDDER_EVIDENCE_STALE');
  if (Date.parse(acquisitionCeiling.reviewedAt) > asOfMs) temporal.push('C16_CEILING_REVIEW_FUTURE');
  if (Date.parse(acquisitionCeiling.validUntil) < asOfMs) temporal.push('C16_CEILING_EXPIRED');
  if (Date.parse(auctionEvidence.biddingCloseAt) <= asOfMs) temporal.push('C16_BIDDING_WINDOW_CLOSED');
  if ([AUCTION_EVENT_STATUS.CLOSED, AUCTION_EVENT_STATUS.CANCELLED, AUCTION_EVENT_STATUS.PAUSED].includes(auctionEvidence.auctionStatus)) temporal.push(`C16_AUCTION_NOT_ACTIONABLE:${auctionEvidence.auctionStatus}`);
  if (temporal.length) return baseResult(AUCTION_REVIEW_STATUS.HOLD_WINDOW, temporal, context);

  const eligibility = [];
  if (bidderEvidence.registrationStatus !== BIDDER_REGISTRATION_STATUS.REGISTERED) eligibility.push('C16_BIDDER_NOT_REGISTERED');
  else if(Date.parse(bidderEvidence.registeredAt)>Math.min(asOfMs,Date.parse(bidderEvidence.verifiedAt),Date.parse(auctionEvidence.registrationDeadline)))eligibility.push('C16_REGISTRATION_LATE_OR_FUTURE');
  const provided = new Set(bidderEvidence.providedBidderDocumentTypes);
  auctionEvidence.requiredBidderDocumentTypes.forEach((required) => { if (!provided.has(required)) eligibility.push(`C16_REQUIRED_BIDDER_DOCUMENT_MISSING:${required}`); });
  if (auctionEvidence.depositTreatment === DEPOSIT_TREATMENT.UNKNOWN) eligibility.push('C16_DEPOSIT_TREATMENT_UNRESOLVED');
  auctionEvidence.buyerAuctionCharges.forEach((charge) => { if (charge.treatment === AUCTION_CHARGE_TREATMENT.UNKNOWN) eligibility.push(`C16_CHARGE_TREATMENT_UNRESOLVED:${charge.chargeId}`); });
  if (eligibility.length) return baseResult(AUCTION_REVIEW_STATUS.HOLD_ELIGIBILITY, eligibility, context);

  const current = toHalalas(auctionEvidence.currentBidSar == null ? auctionEvidence.startingBidSar : auctionEvidence.currentBidSar);
  const next = auctionEvidence.currentBidSar == null ? current : sumHalalas([current,toHalalas(auctionEvidence.minimumBidIncrementSar)]);
  const proposed = toHalalas(bidProposal.proposedBidSar);
  const maximum = toHalalas(acquisitionCeiling.maximumBidSar);
  const charges = sumHalalas(auctionEvidence.buyerAuctionCharges.filter(c=>c.treatment===AUCTION_CHARGE_TREATMENT.SEPARATE_FROM_PURCHASE_PRICE).map(c=>toHalalas(c.amountSar)));
  const deposit = auctionEvidence.depositTreatment===DEPOSIT_TREATMENT.SEPARATE_FROM_PURCHASE_PRICE ? toHalalas(auctionEvidence.bidderDepositSar) : 0;
  const cash = sumHalalas([proposed,charges,deposit]);
  const cashMax = acquisitionCeiling.maximumKnownCashExposureSar == null ? null : toHalalas(acquisitionCeiling.maximumKnownCashExposureSar);
  const amounts = [current,next,proposed,maximum,charges,deposit,cash];
  if (amounts.some(v=>v===null||fromHalalas(v)===null)) return baseResult(AUCTION_REVIEW_STATUS.HOLD_CALCULATION,['C16_UNSAFE_HALALA_ARITHMETIC'],context);
  const [currentReferenceBidSar,nextMinimumBidSar,proposedBidSar,maximumBidSar,separateChargesSar,depositSeparateSar,knownCashExposureSar]=amounts.map(fromHalalas);
  const headroomToMaximumBidSar=fromHalalas(maximum-proposed);
  const cashExposureHeadroomSar=cashMax===null?null:fromHalalas(cashMax-cash);
  if (headroomToMaximumBidSar===null || (cashMax!==null&&cashExposureHeadroomSar===null)) return baseResult(AUCTION_REVIEW_STATUS.HOLD_CALCULATION,['C16_UNSAFE_HALALA_ARITHMETIC'],context);

  const envelope = [];
  if (proposed < next) envelope.push('C16_PROPOSED_BID_BELOW_NEXT_MINIMUM');
  if (proposed > maximum) envelope.push('C16_PROPOSED_BID_EXCEEDS_EXTERNAL_MAXIMUM');
  if (cashMax !== null && cash > cashMax) envelope.push('C16_KNOWN_CASH_EXPOSURE_EXCEEDS_EXTERNAL_MAXIMUM');
  if (auctionEvidence.depositTreatment === DEPOSIT_TREATMENT.CREDITABLE_TOWARD_PURCHASE_PRICE && toHalalas(auctionEvidence.bidderDepositSar)>proposed) envelope.push('C16_CREDITABLE_DEPOSIT_EXCEEDS_PROPOSED_BID');
  if (envelope.length) return baseResult(AUCTION_REVIEW_STATUS.HOLD_BID_ENVELOPE, envelope, context);

  const riskFlags = [];
  if (Date.parse(auctionEvidence.biddingStartAt) > asOfMs) riskFlags.push('C16_BIDDING_NOT_OPEN_YET');
  if (Date.parse(auctionEvidence.registrationDeadline) < asOfMs) riskFlags.push('C16_REGISTRATION_DEADLINE_PASSED_BUT_REGISTRATION_EVIDENCE_PRESENT');
  const review = freeze({
    auctionStatus: auctionEvidence.auctionStatus, biddingStartAt: auctionEvidence.biddingStartAt, biddingCloseAt: auctionEvidence.biddingCloseAt,
    registrationDeadline: auctionEvidence.registrationDeadline, currentReferenceBidSar, nextMinimumBidSar, proposedBidSar, maximumBidSar,
    headroomToMaximumBidSar, proposedBidWithinExternalMaximum: true, proposedBidMeetsNextMinimum: true,
    bidderDepositSar: auctionEvidence.bidderDepositSar, depositTreatment: auctionEvidence.depositTreatment,
    knownSeparateAuctionChargesSar: separateChargesSar, knownSeparateDepositSar: depositSeparateSar, knownCashExposureSar,
    maximumKnownCashExposureSar: acquisitionCeiling.maximumKnownCashExposureSar, cashExposureHeadroomSar,
    knownCashExposureWithinExternalMaximum: acquisitionCeiling.maximumKnownCashExposureSar == null ? null : true,
    requiredBidderDocumentTypes: auctionEvidence.requiredBidderDocumentTypes, providedBidderDocumentTypes: bidderEvidence.providedBidderDocumentTypes,
    allRequiredDocumentsPresent: true, registrationStatus: bidderEvidence.registrationStatus,
    auctionEvidenceHashSha256: auctionEvidence.auctionEvidenceHashSha256, bidderEvidenceHashSha256: bidderEvidence.bidderEvidenceHashSha256,
    acquisitionCeilingHashSha256: acquisitionCeiling.acquisitionCeilingHashSha256, proposalHashSha256: bidProposal.proposalHashSha256,
    policyHashSha256: reviewPolicy.policyHashSha256, arithmeticOnlyNotAcquisitionApproval: true,
  });
  return baseResult(AUCTION_REVIEW_STATUS.READY_FOR_PROFESSIONAL_AUCTION_REVIEW, [], context, review, riskFlags);
}

module.exports = {
  CAPABILITY, POLICY_VERSION, AUCTION_REVIEW_STATUS, AUCTION_EVENT_STATUS, DEPOSIT_TREATMENT, AUCTION_CHARGE_TREATMENT,
  BIDDER_REGISTRATION_STATUS, createGovernedAuctionEvidence, computeAuctionEvidenceHash, verifyAuctionEvidenceIntegrity,
  createGovernedAuctionBidderEvidence, computeBidderEvidenceHash, verifyBidderEvidenceIntegrity,
  createGovernedAuctionAcquisitionCeiling, computeAcquisitionCeilingHash, verifyAcquisitionCeilingIntegrity,
  createGovernedAuctionBidProposal, computeAuctionBidProposalHash, verifyAuctionBidProposalIntegrity,
  createGovernedAuctionReviewPolicy, computeAuctionReviewPolicyHash, evaluateGovernedAuctionAcquisition,
};
