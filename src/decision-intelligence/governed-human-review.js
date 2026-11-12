'use strict';

const { sha256Hex } = require('../crypto/sha256');
const {
  C6_GOVERNED_HUMAN_REVIEW_SCHEMA_VERSION,
  C6_GOVERNED_REVIEW_EXPORT_SCHEMA_VERSION,
  C6_REVIEW_RECOMMENDATION,
  C6_REVIEW_STATUS,
  C6_AUTHORITY_BOUNDARY,
} = require('../contracts/governed-human-review');
const { C4_REPORT_CLASSIFICATION } = require('../contracts/governed-deal-decision');
const {
  computeSavedDealStateHash,
  evaluateGovernedDecisionOperationalState,
  buildGovernedDecisionOperationalExport,
  verifyGovernedDecisionOperationalExport,
} = require('../app/governed-decision-operational');

const HASH_RE = /^[a-f0-9]{64}$/i;

class C6ReviewError extends Error {
  constructor(code, field = null) {
    super(`${code}${field ? ` (${field})` : ''}`);
    this.name = 'C6ReviewError';
    this.code = code;
    this.field = field;
  }
}

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function requiredString(value, field) {
  const text = cleanString(value);
  if (!text) throw new C6ReviewError('C6_REQUIRED_FIELD', field);
  return text;
}

function hash64(value, field) {
  const text = cleanString(value).toLowerCase();
  if (!HASH_RE.test(text)) throw new C6ReviewError('C6_HASH_REQUIRED', field);
  return text;
}

function normalizeTime(value, field) {
  const ms = value instanceof Date ? value.getTime() : new Date(requiredString(value, field)).getTime();
  if (!Number.isFinite(ms)) throw new C6ReviewError('C6_TIMESTAMP_INVALID', field);
  return { ms, iso: new Date(ms).toISOString() };
}

function clone(value) {
  if (Array.isArray(value)) return value.map(clone);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, clone(child)]));
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((acc, key) => {
      acc[key] = canonicalize(value[key]);
      return acc;
    }, Object.create(null));
  }
  return value;
}

function isJsonSafe(value, seen = new Set()) {
  if (value === null || ['string', 'boolean'].includes(typeof value)) return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object' || seen.has(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) return false;
  seen.add(value);
  const ok = Array.isArray(value)
    ? value.every((item) => isJsonSafe(item, seen))
    : Object.values(value).every((item) => isJsonSafe(item, seen));
  seen.delete(value);
  return ok;
}

function sha256(value) {
  if (!isJsonSafe(value)) throw new C6ReviewError('C6_NON_JSON_SAFE_PAYLOAD');
  return sha256Hex(JSON.stringify(canonicalize(value)));
}

function reviewCore(review) {
  return {
    schemaVersion: review.schemaVersion,
    status: review.status,
    reviewerId: review.reviewerId,
    recommendation: review.recommendation,
    rationale: review.rationale,
    reviewedAt: review.reviewedAt,
    decisionSnapshotHashSha256: review.decisionSnapshotHashSha256,
    savedDealStateHashSha256: review.savedDealStateHashSha256,
    approvalStatus: review.approvalStatus,
    authorityBoundary: clone(review.authorityBoundary),
    humanDecisionRequired: review.humanDecisionRequired,
    transactionAuthorized: review.transactionAuthorized,
    approvalAuthorized: review.approvalAuthorized,
    publicAiAuthorized: review.publicAiAuthorized,
    commercialGoLive: review.commercialGoLive,
    finalValuationConclusionEstablished: review.finalValuationConclusionEstablished,
    certifiedValuationEstablished: review.certifiedValuationEstablished,
    semantics: review.semantics,
  };
}

function validateAuthority(review) {
  const authority = review.authorityBoundary;
  if (!authority || typeof authority !== 'object' || Array.isArray(authority)) throw new C6ReviewError('C6_AUTHORITY_BOUNDARY_REQUIRED');
  if (authority.commercialGoLive !== 'HOLD') throw new C6ReviewError('C6_COMMERCIAL_GO_LIVE_FORBIDDEN');
  for (const field of ['transactionAuthority', 'publicAi', 'canonicalBaselineActivationAuthorized', 'approvalAuthorized', 'finalValuationConclusionEstablished', 'certifiedValuationEstablished']) {
    if (authority[field] !== false) throw new C6ReviewError('C6_AUTHORITY_ESCALATION_FORBIDDEN', field);
  }
  if (review.approvalStatus !== 'NOT_ESTABLISHED') throw new C6ReviewError('C6_APPROVAL_STATUS_FORBIDDEN');
  if (review.transactionAuthorized !== false || review.approvalAuthorized !== false || review.publicAiAuthorized !== false) throw new C6ReviewError('C6_AUTHORITY_ESCALATION_FORBIDDEN');
  if (review.commercialGoLive !== 'HOLD') throw new C6ReviewError('C6_COMMERCIAL_GO_LIVE_FORBIDDEN');
  if (review.finalValuationConclusionEstablished !== false || review.certifiedValuationEstablished !== false) throw new C6ReviewError('C6_VALUATION_AUTHORITY_FORBIDDEN');
  if (review.humanDecisionRequired !== true) throw new C6ReviewError('C6_HUMAN_DECISION_REQUIRED');
}

function upstreamReviewAlreadyRecorded(savedDealRecord) {
  return Boolean(savedDealRecord?.governedDealDecision?.humanReview);
}

function validateGovernedHumanReview(review, { savedDealRecord = null } = {}) {
  if (!review || typeof review !== 'object' || Array.isArray(review)) throw new C6ReviewError('C6_REVIEW_OBJECT_REQUIRED');
  const allowed = new Set([...Object.keys(reviewCore(review)), 'reviewHashSha256']);
  if (Object.keys(review).some((key) => !allowed.has(key))) throw new C6ReviewError('C6_REVIEW_FIELD_NOT_ALLOWED');
  if (review.schemaVersion !== C6_GOVERNED_HUMAN_REVIEW_SCHEMA_VERSION) throw new C6ReviewError('C6_REVIEW_SCHEMA_UNSUPPORTED');
  if (review.status !== C6_REVIEW_STATUS.REVIEW_RECORDED) throw new C6ReviewError('C6_REVIEW_STATUS_INVALID');
  requiredString(review.reviewerId, 'reviewerId');
  const recommendation = requiredString(review.recommendation, 'recommendation');
  if (!Object.values(C6_REVIEW_RECOMMENDATION).includes(recommendation)) throw new C6ReviewError('C6_RECOMMENDATION_INVALID');
  requiredString(review.rationale, 'rationale');
  normalizeTime(review.reviewedAt, 'reviewedAt');
  const snapshotHash = hash64(review.decisionSnapshotHashSha256, 'decisionSnapshotHashSha256');
  const stateHash = hash64(review.savedDealStateHashSha256, 'savedDealStateHashSha256');
  validateAuthority(review);
  if (hash64(review.reviewHashSha256, 'reviewHashSha256') !== sha256(reviewCore(review))) throw new C6ReviewError('C6_REVIEW_HASH_MISMATCH');

  if (savedDealRecord) {
    if (savedDealRecord.mode !== 'building') throw new C6ReviewError('C6_REVIEW_REQUIRES_BUILDING_MODE');
    if (!savedDealRecord.governedDealDecision) throw new C6ReviewError('C6_GOVERNED_DECISION_REQUIRED');
    if (upstreamReviewAlreadyRecorded(savedDealRecord)) throw new C6ReviewError('C6_UPSTREAM_REVIEW_ALREADY_RECORDED');
    if (snapshotHash !== cleanString(savedDealRecord.governedDealDecision.snapshotHashSha256).toLowerCase()) throw new C6ReviewError('C6_DECISION_SNAPSHOT_HASH_MISMATCH');
    if (stateHash !== computeSavedDealStateHash(savedDealRecord)) throw new C6ReviewError('C6_SAVED_DEAL_STATE_HASH_MISMATCH');
  }
  return true;
}

function buildGovernedHumanReview({ savedDealRecord, reviewerId, recommendation, rationale, reviewedAt = new Date() } = {}) {
  if (!savedDealRecord || typeof savedDealRecord !== 'object' || Array.isArray(savedDealRecord)) throw new C6ReviewError('C6_SAVED_DEAL_REQUIRED');
  if (Object.prototype.hasOwnProperty.call(savedDealRecord, 'governedHumanReview')) throw new C6ReviewError('C6_REVIEW_ALREADY_RECORDED');
  if (upstreamReviewAlreadyRecorded(savedDealRecord)) throw new C6ReviewError('C6_UPSTREAM_REVIEW_ALREADY_RECORDED');
  const reviewed = normalizeTime(reviewedAt, 'reviewedAt');
  const operational = evaluateGovernedDecisionOperationalState({ savedDealRecord, asOf: reviewed.iso });
  if (!operational.canExport) throw new C6ReviewError('C6_REVIEW_BLOCKED', operational.reasonCodes.join(','));
  const scopedReviewerId = requiredString(reviewerId, 'reviewerId');
  const scopedRecommendation = requiredString(recommendation, 'recommendation');
  if (!Object.values(C6_REVIEW_RECOMMENDATION).includes(scopedRecommendation)) throw new C6ReviewError('C6_RECOMMENDATION_INVALID');
  const scopedRationale = requiredString(rationale, 'rationale');

  const core = {
    schemaVersion: C6_GOVERNED_HUMAN_REVIEW_SCHEMA_VERSION,
    status: C6_REVIEW_STATUS.REVIEW_RECORDED,
    reviewerId: scopedReviewerId,
    recommendation: scopedRecommendation,
    rationale: scopedRationale,
    reviewedAt: reviewed.iso,
    decisionSnapshotHashSha256: operational.snapshotHashSha256,
    savedDealStateHashSha256: operational.dealStateHashSha256,
    approvalStatus: 'NOT_ESTABLISHED',
    authorityBoundary: { ...C6_AUTHORITY_BOUNDARY },
    humanDecisionRequired: true,
    transactionAuthorized: false,
    approvalAuthorized: false,
    publicAiAuthorized: false,
    commercialGoLive: 'HOLD',
    finalValuationConclusionEstablished: false,
    certifiedValuationEstablished: false,
    semantics: 'C6 records a human reviewer recommendation bound to an immutable governed analytical snapshot and saved-deal state. It is not approval, transaction authority, commercial go-live, public-AI authority, or a final/licensed/certified valuation.',
  };
  const review = Object.freeze({ ...core, reviewHashSha256: sha256(core) });
  validateGovernedHumanReview(review, { savedDealRecord });
  return review;
}

function withGovernedHumanReview(savedDealRecord, review) {
  if (!savedDealRecord || typeof savedDealRecord !== 'object' || Array.isArray(savedDealRecord)) throw new C6ReviewError('C6_SAVED_DEAL_REQUIRED');
  if (Object.prototype.hasOwnProperty.call(savedDealRecord, 'governedHumanReview')) throw new C6ReviewError('C6_REVIEW_ALREADY_RECORDED');
  validateGovernedHumanReview(review, { savedDealRecord });
  return { ...savedDealRecord, governedHumanReview: clone(review) };
}

function evaluateControlledHumanReviewState({ savedDealRecord, asOf = new Date() } = {}) {
  const operational = evaluateGovernedDecisionOperationalState({ savedDealRecord, asOf });
  const base = {
    schemaVersion: 1,
    c5Status: operational.status,
    reasonCodes: [...(operational.reasonCodes || [])],
    caseId: operational.caseId || null,
    projectId: operational.projectId || null,
    propertyRef: operational.propertyRef || null,
    decisionSnapshotHashSha256: operational.snapshotHashSha256 || null,
    savedDealStateHashSha256: operational.dealStateHashSha256 || null,
    commercialGoLive: 'HOLD',
    transactionAuthorized: false,
    approvalAuthorized: false,
    publicAiAuthorized: false,
    finalValuationConclusionEstablished: false,
    certifiedValuationEstablished: false,
    humanDecisionRequired: true,
  };
  if (!operational.canExport) return Object.freeze({ ...base, status: 'HOLD', canRecordReview: false, canExportReviewedOutput: false, review: null });
  if (upstreamReviewAlreadyRecorded(savedDealRecord)) {
    return Object.freeze({
      ...base,
      status: 'HOLD_UPSTREAM_REVIEW_ALREADY_RECORDED',
      canRecordReview: false,
      canExportReviewedOutput: false,
      reasonCodes: ['C6_UPSTREAM_REVIEW_ALREADY_RECORDED'],
      review: null,
    });
  }
  if (!savedDealRecord.governedHumanReview) return Object.freeze({ ...base, status: 'READY_FOR_HUMAN_REVIEW', canRecordReview: true, canExportReviewedOutput: false, review: null });
  try {
    validateGovernedHumanReview(savedDealRecord.governedHumanReview, { savedDealRecord });
  } catch (error) {
    return Object.freeze({ ...base, status: 'HOLD_INVALID_REVIEW', canRecordReview: false, canExportReviewedOutput: false, reasonCodes: [error.code || 'C6_INVALID_REVIEW'], review: null });
  }
  return Object.freeze({ ...base, status: 'REVIEW_RECORDED', canRecordReview: false, canExportReviewedOutput: true, reasonCodes: [], review: clone(savedDealRecord.governedHumanReview) });
}

function reviewedExportCore(envelope) {
  const { exportHashSha256: _discarded, ...core } = envelope;
  return core;
}

function buildGovernedReviewedDecisionExport({ savedDealRecord, reportId, generatedAt = new Date() } = {}) {
  const generated = normalizeTime(generatedAt, 'generatedAt');
  const state = evaluateControlledHumanReviewState({ savedDealRecord, asOf: generated.iso });
  if (!state.canExportReviewedOutput) throw new C6ReviewError('C6_REVIEWED_EXPORT_BLOCKED', state.reasonCodes.join(','));
  validateGovernedHumanReview(savedDealRecord.governedHumanReview, { savedDealRecord });
  const c5Export = buildGovernedDecisionOperationalExport({ savedDealRecord, reportId, generatedAt: generated.iso });
  if (!verifyGovernedDecisionOperationalExport(c5Export)) throw new C6ReviewError('C6_NESTED_C5_EXPORT_INVALID');
  const core = {
    schemaVersion: C6_GOVERNED_REVIEW_EXPORT_SCHEMA_VERSION,
    classification: C4_REPORT_CLASSIFICATION.NON_AUTHORIZING_ANALYTICAL_OUTPUT,
    generatedAt: generated.iso,
    sourceSavedDealId: savedDealRecord.id || null,
    caseId: state.caseId,
    projectId: state.projectId,
    propertyRef: state.propertyRef,
    decisionSnapshotHashSha256: state.decisionSnapshotHashSha256,
    savedDealStateHashSha256: state.savedDealStateHashSha256,
    reviewHashSha256: savedDealRecord.governedHumanReview.reviewHashSha256,
    review: clone(savedDealRecord.governedHumanReview),
    c5ExportHashSha256: c5Export.exportHashSha256,
    c5Export,
    approvalStatus: 'NOT_ESTABLISHED',
    authorityBoundary: { ...C6_AUTHORITY_BOUNDARY },
    humanDecisionRequired: true,
    transactionAuthorized: false,
    approvalAuthorized: false,
    publicAiAuthorized: false,
    commercialGoLive: 'HOLD',
    finalValuationConclusionEstablished: false,
    certifiedValuationEstablished: false,
    disclosures: [
      'NON_AUTHORIZING_ANALYTICAL_OUTPUT',
      'HUMAN_REVIEW_RECOMMENDATION_ONLY',
      'REVIEWER_RECOMMENDATION_DOES_NOT_EQUAL_APPROVAL',
      'SEPARATE_APPROVAL_AUTHORITY_REQUIRED',
      'TRANSACTION_AUTHORITY_FALSE',
      'PUBLIC_AI_FALSE',
      'COMMERCIAL_GO_LIVE_HOLD',
      'NOT_A_FINAL_OR_CERTIFIED_VALUATION',
    ],
    semantics: 'C6 reviewed export binds a human recommendation to the exact C4 decision snapshot and saved-deal state and nests the governed C5 export. It remains non-authorizing analytical output.',
  };
  return Object.freeze({ ...core, exportHashSha256: sha256(core) });
}

function verifyGovernedReviewedDecisionExport(envelope) {
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) return false;
  if (envelope.schemaVersion !== C6_GOVERNED_REVIEW_EXPORT_SCHEMA_VERSION) return false;
  if (envelope.classification !== C4_REPORT_CLASSIFICATION.NON_AUTHORIZING_ANALYTICAL_OUTPUT) return false;
  if (envelope.approvalStatus !== 'NOT_ESTABLISHED' || envelope.humanDecisionRequired !== true) return false;
  if (envelope.transactionAuthorized !== false || envelope.approvalAuthorized !== false || envelope.publicAiAuthorized !== false || envelope.commercialGoLive !== 'HOLD') return false;
  if (envelope.finalValuationConclusionEstablished !== false || envelope.certifiedValuationEstablished !== false) return false;
  if (!envelope.review || envelope.reviewHashSha256 !== envelope.review.reviewHashSha256) return false;
  if (!envelope.c5Export || envelope.c5ExportHashSha256 !== envelope.c5Export.exportHashSha256) return false;
  if (!verifyGovernedDecisionOperationalExport(envelope.c5Export)) return false;
  if (envelope.decisionSnapshotHashSha256 !== envelope.c5Export.decisionSnapshotHashSha256) return false;
  if (envelope.savedDealStateHashSha256 !== envelope.c5Export.savedDealStateHashSha256) return false;
  if (envelope.review.decisionSnapshotHashSha256 !== envelope.decisionSnapshotHashSha256) return false;
  if (envelope.review.savedDealStateHashSha256 !== envelope.savedDealStateHashSha256) return false;
  try {
    validateGovernedHumanReview(envelope.review);
    return hash64(envelope.exportHashSha256, 'exportHashSha256') === sha256(reviewedExportCore(envelope));
  } catch (_) {
    return false;
  }
}

module.exports = {
  C6ReviewError,
  buildGovernedHumanReview,
  validateGovernedHumanReview,
  withGovernedHumanReview,
  evaluateControlledHumanReviewState,
  buildGovernedReviewedDecisionExport,
  verifyGovernedReviewedDecisionExport,
};
