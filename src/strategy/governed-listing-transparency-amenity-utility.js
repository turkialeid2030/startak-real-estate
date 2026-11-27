'use strict';

const crypto = require('crypto');
const {assertPlainJson,isPlainJson}=require('../validation/plain-json-boundary');
const {strictCalendarDateMs}=require('../validation/strict-calendar-instant');
function safeInput(v){try{assertPlainJson(v,{maxNodes:500000});return !!v&&typeof v==='object'&&!Array.isArray(v);}catch{return false;}}
function verifyCanonical(r,field,create,compute){try{return isPlainJson(r)&&!!r&&typeof r==='object'&&!Array.isArray(r)&&HASH_RE.test(clean(r[field]))&&compute(r)===r[field]&&create(r)[field]===r[field];}catch{return false;}}

const CAPABILITY = 'C21_GOVERNED_LISTING_TRANSPARENCY_AMENITY_UTILITY_INTELLIGENCE_V1';
const POLICY_VERSION = 'C21_LISTING_TRANSPARENCY_AMENITY_UTILITY_POLICY_V1';

const REVIEW_STATUS = Object.freeze({
  READY_FOR_PROFESSIONAL_LISTING_AMENITY_REVIEW: 'READY_FOR_PROFESSIONAL_LISTING_AMENITY_REVIEW',
  HOLD_EVIDENCE: 'HOLD_EVIDENCE',
  HOLD_INTEGRITY: 'HOLD_INTEGRITY',
  HOLD_POLICY: 'HOLD_POLICY',
  HOLD_CONTEXT: 'HOLD_CONTEXT',
  HOLD_WINDOW: 'HOLD_WINDOW',
  HOLD_COVERAGE: 'HOLD_COVERAGE',
  HOLD_CALCULATION: 'HOLD_CALCULATION',
});

const LISTING_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  UNDER_OFFER: 'UNDER_OFFER',
  WITHDRAWN: 'WITHDRAWN',
  CLOSED: 'CLOSED',
  UNKNOWN: 'UNKNOWN',
});

const AMENITY_CLASS = Object.freeze({
  EDUCATION: 'EDUCATION',
  HEALTHCARE: 'HEALTHCARE',
  RETAIL: 'RETAIL',
  PUBLIC_TRANSPORT: 'PUBLIC_TRANSPORT',
  ROAD_ACCESS: 'ROAD_ACCESS',
  PARK_RECREATION: 'PARK_RECREATION',
  EMPLOYMENT_ACTIVITY_CENTER: 'EMPLOYMENT_ACTIVITY_CENTER',
  RELIGIOUS: 'RELIGIOUS',
  OTHER: 'OTHER',
});

const AMENITY_STATE = Object.freeze({
  EXISTING_VERIFIED: 'EXISTING_VERIFIED',
  PLANNED_NOT_DELIVERED: 'PLANNED_NOT_DELIVERED',
  PROPOSED_UNCERTAIN: 'PROPOSED_UNCERTAIN',
  UNRESOLVED: 'UNRESOLVED',
});

const AMENITY_METRIC_TYPE = Object.freeze({
  DISTANCE_METERS_EXTERNAL: 'DISTANCE_METERS_EXTERNAL',
  DRIVE_TIME_MINUTES_EXTERNAL: 'DRIVE_TIME_MINUTES_EXTERNAL',
  WALK_TIME_MINUTES_EXTERNAL: 'WALK_TIME_MINUTES_EXTERNAL',
  COUNT_WITHIN_EXTERNAL_BOUNDARY: 'COUNT_WITHIN_EXTERNAL_BOUNDARY',
  OTHER_EXTERNAL_NUMERIC: 'OTHER_EXTERNAL_NUMERIC',
});

const HASH_RE = /^[a-f0-9]{64}$/i;
const nonEmpty = (v) => typeof v === 'string' && v.trim().length > 0;
const clean = (v) => nonEmpty(v) ? v.trim() : '';
const finitePositive = (v) => typeof v === 'number' && Number.isFinite(v) && v > 0;
const finiteNN = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const inRange = (v, min, max) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;

function iso(value, field) {
  if (!nonEmpty(value) || !Number.isFinite(strictCalendarDateMs(value))) throw new TypeError(`${field} must be a valid date/time`);
  return new Date(value).toISOString();
}
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])]));
}
function sha256(value) {
  if(!isPlainJson(value))return null;
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
  if (out.some((v) => !v)) throw new TypeError(`${field} contains invalid value`);
  if (new Set(out).size !== out.length) throw new TypeError(`${field} contains duplicate values`);
  return [...out].sort();
}
function exactSet(left, right) {
  return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((v, i) => v === right[i]);
}
function statusFor(blockers) {
  if (blockers.some((b) => b.startsWith('C21_INTEGRITY_') || b.startsWith('C21_AUTHORITY_INJECTION'))) return REVIEW_STATUS.HOLD_INTEGRITY;
  if (blockers.some((b) => b.startsWith('C21_POLICY_'))) return REVIEW_STATUS.HOLD_POLICY;
  if (blockers.some((b) => b.startsWith('C21_CONTEXT_'))) return REVIEW_STATUS.HOLD_CONTEXT;
  if (blockers.some((b) => b.startsWith('C21_WINDOW_'))) return REVIEW_STATUS.HOLD_WINDOW;
  if (blockers.some((b) => b.startsWith('C21_COVERAGE_'))) return REVIEW_STATUS.HOLD_COVERAGE;
  if (blockers.some((b) => b.startsWith('C21_CALCULATION_'))) return REVIEW_STATUS.HOLD_CALCULATION;
  return REVIEW_STATUS.HOLD_EVIDENCE;
}

function computeListingHash(r) { return r && typeof r === 'object' && !Array.isArray(r)&&isPlainJson(r) ? sha256(without(r, ['listingEvidenceHashSha256'])) : null; }
function verifyListingIntegrity(r) { return verifyCanonical(r,'listingEvidenceHashSha256',createGovernedListingEvidence,computeListingHash); }

function createGovernedListingEvidence(x = {}) {
  if(!safeInput(x)||authorityInjection(x))throw TypeError('C21_INTEGRITY_CONSTRUCTOR_INPUT');
  ['listingEvidenceId','caseId','propertyRef','marketScopeRef','listingRef','deduplicationKey','sourceProviderId','sourceTier','sourceRecordId','sourceReference','reviewedByRef','reviewEvidenceRef'].forEach((f) => {
    if (!nonEmpty(x[f])) throw new TypeError(`${f} must be a non-empty string`);
  });
  if (!Object.values(LISTING_STATUS).includes(x.listingStatus)) throw new TypeError('C21_LISTING_STATUS_UNSUPPORTED');
  if (!HASH_RE.test(clean(x.sourceRecordHashSha256))) throw new TypeError('C21_LISTING_SOURCE_HASH_REQUIRED');
  if (x.provenanceVerified !== true) throw new TypeError('C21_LISTING_PROVENANCE_REQUIRED');
  const askingPriceSar = x.askingPriceSar == null ? null : x.askingPriceSar;
  const areaSqm = x.areaSqm == null ? null : x.areaSqm;
  if ((askingPriceSar == null) !== (areaSqm == null)) throw new TypeError('C21_LISTING_PRICE_AREA_PAIR_REQUIRED');
  if (askingPriceSar != null && (!finitePositive(askingPriceSar) || !finitePositive(areaSqm)||!finitePositive(askingPriceSar/areaSqm))) throw new TypeError('C21_LISTING_PRICE_AREA_INVALID');
  const publishedAt = iso(x.publishedAt, 'publishedAt');
  const observedAt = iso(x.observedAt, 'observedAt');
  const reviewedAt = iso(x.reviewedAt, 'reviewedAt');
  const validUntil = iso(x.validUntil, 'validUntil');
  if (Date.parse(observedAt) < Date.parse(publishedAt)) throw new TypeError('C21_LISTING_OBSERVED_BEFORE_PUBLISHED');
  if (Date.parse(reviewedAt) < Date.parse(observedAt)) throw new TypeError('C21_LISTING_REVIEWED_BEFORE_OBSERVED');
  if (Date.parse(validUntil) < Date.parse(reviewedAt)) throw new TypeError('C21_LISTING_VALIDITY_INVALID');
  const core = {
    schemaVersion: 1,
    listingEvidenceId: x.listingEvidenceId.trim(),
    caseId: x.caseId.trim(),
    propertyRef: x.propertyRef.trim(),
    marketScopeRef: x.marketScopeRef.trim(),
    listingRef: x.listingRef.trim(),
    deduplicationKey: x.deduplicationKey.trim(),
    listingStatus: x.listingStatus,
    askingPriceSar,
    areaSqm,
    sourceProviderId: x.sourceProviderId.trim(),
    sourceTier: x.sourceTier.trim(),
    sourceRecordId: x.sourceRecordId.trim(),
    sourceRecordHashSha256: x.sourceRecordHashSha256.trim().toLowerCase(),
    sourceReference: x.sourceReference.trim(),
    provenanceVerified: true,
    publishedAt,
    observedAt,
    reviewedAt,
    validUntil,
    reviewedByRef: x.reviewedByRef.trim(),
    reviewEvidenceRef: x.reviewEvidenceRef.trim(),
    askingEvidenceOnly: true,
    closedTransactionEvidence: false,
    listingAuthenticityGuaranteedBySoftware: false,
    valuationEvidencePromotedBySoftware: false,
  };
  return freeze({ ...core, listingEvidenceHashSha256: sha256(core) });
}

function computeAmenityHash(r) { return r && typeof r === 'object' && !Array.isArray(r)&&isPlainJson(r) ? sha256(without(r, ['amenityEvidenceHashSha256'])) : null; }
function verifyAmenityIntegrity(r) { return verifyCanonical(r,'amenityEvidenceHashSha256',createGovernedAmenityEvidence,computeAmenityHash); }

function createGovernedAmenityEvidence(x = {}) {
  if(!safeInput(x)||authorityInjection(x))throw TypeError('C21_INTEGRITY_CONSTRUCTOR_INPUT');
  ['amenityEvidenceId','caseId','propertyRef','marketScopeRef','amenityRef','sourceProviderId','sourceTier','sourceRecordId','sourceReference','reviewedByRef','reviewEvidenceRef'].forEach((f) => {
    if (!nonEmpty(x[f])) throw new TypeError(`${f} must be a non-empty string`);
  });
  if (!Object.values(AMENITY_CLASS).includes(x.amenityClass)) throw new TypeError('C21_AMENITY_CLASS_UNSUPPORTED');
  if (!Object.values(AMENITY_STATE).includes(x.amenityState)) throw new TypeError('C21_AMENITY_STATE_UNSUPPORTED');
  if (!Object.values(AMENITY_METRIC_TYPE).includes(x.metricType)) throw new TypeError('C21_AMENITY_METRIC_TYPE_UNSUPPORTED');
  if (!finiteNN(x.metricValue)||(x.metricType===AMENITY_METRIC_TYPE.COUNT_WITHIN_EXTERNAL_BOUNDARY&&!Number.isSafeInteger(x.metricValue))) throw new TypeError('C21_AMENITY_METRIC_VALUE_INVALID');
  if (!HASH_RE.test(clean(x.sourceRecordHashSha256))) throw new TypeError('C21_AMENITY_SOURCE_HASH_REQUIRED');
  if (x.provenanceVerified !== true) throw new TypeError('C21_AMENITY_PROVENANCE_REQUIRED');
  if (x.amenityClass === AMENITY_CLASS.OTHER && !nonEmpty(x.amenityLabel)) throw new TypeError('C21_OTHER_AMENITY_LABEL_REQUIRED');
  if (x.amenityState === AMENITY_STATE.UNRESOLVED && !nonEmpty(x.unresolvedReasonRef)) throw new TypeError('C21_AMENITY_UNRESOLVED_REASON_REQUIRED');
  const knownAt = iso(x.knownAt, 'knownAt');
  const observedAt = iso(x.observedAt, 'observedAt');
  const reviewedAt = iso(x.reviewedAt, 'reviewedAt');
  const validUntil = iso(x.validUntil, 'validUntil');
  if (Date.parse(observedAt) > Date.parse(knownAt)) throw new TypeError('C21_AMENITY_OBSERVED_AFTER_KNOWN_AT');
  if (Date.parse(reviewedAt) < Date.parse(knownAt)) throw new TypeError('C21_AMENITY_REVIEWED_BEFORE_KNOWN_AT');
  if (Date.parse(validUntil) < Date.parse(reviewedAt)) throw new TypeError('C21_AMENITY_VALIDITY_INVALID');
  const core = {
    schemaVersion: 1,
    amenityEvidenceId: x.amenityEvidenceId.trim(),
    caseId: x.caseId.trim(),
    propertyRef: x.propertyRef.trim(),
    marketScopeRef: x.marketScopeRef.trim(),
    amenityRef: x.amenityRef.trim(),
    amenityClass: x.amenityClass,
    amenityLabel: x.amenityClass === AMENITY_CLASS.OTHER ? x.amenityLabel.trim() : null,
    amenityState: x.amenityState,
    metricType: x.metricType,
    metricValue: x.metricValue,
    sourceProviderId: x.sourceProviderId.trim(),
    sourceTier: x.sourceTier.trim(),
    sourceRecordId: x.sourceRecordId.trim(),
    sourceRecordHashSha256: x.sourceRecordHashSha256.trim().toLowerCase(),
    sourceReference: x.sourceReference.trim(),
    provenanceVerified: true,
    observedAt,
    knownAt,
    reviewedAt,
    validUntil,
    reviewedByRef: x.reviewedByRef.trim(),
    reviewEvidenceRef: x.reviewEvidenceRef.trim(),
    unresolvedReasonRef: x.amenityState === AMENITY_STATE.UNRESOLVED ? x.unresolvedReasonRef.trim() : null,
    distanceOrTravelTimeInferredBySoftware: false,
    serviceAvailabilityInferredBySoftware: false,
    deliveryStatusInferredBySoftware: false,
  };
  return freeze({ ...core, amenityEvidenceHashSha256: sha256(core) });
}

function computeUtilityAssessmentHash(r) { return r && typeof r === 'object' && !Array.isArray(r)&&isPlainJson(r) ? sha256(without(r, ['utilityAssessmentHashSha256'])) : null; }
function verifyUtilityAssessmentIntegrity(r) { return verifyCanonical(r,'utilityAssessmentHashSha256',createProfessionalAmenityUtilityAssessment,computeUtilityAssessmentHash); }

function createProfessionalAmenityUtilityAssessment(x = {}) {
  if(!safeInput(x)||authorityInjection(x))throw TypeError('C21_INTEGRITY_CONSTRUCTOR_INPUT');
  ['assessmentId','caseId','propertyRef','amenityEvidenceHashSha256','rationaleRef','preparedByRef','reviewedByRef','reviewEvidenceRef'].forEach((f) => {
    if (!nonEmpty(x[f])) throw new TypeError(`${f} must be a non-empty string`);
  });
  if (!HASH_RE.test(clean(x.amenityEvidenceHashSha256))) throw new TypeError('C21_UTILITY_AMENITY_HASH_REQUIRED');
  if (!inRange(x.utilityScore, 0, 100)) throw new TypeError('C21_UTILITY_SCORE_INVALID');
  if (!(typeof x.importanceWeight === 'number' && Number.isFinite(x.importanceWeight) && x.importanceWeight > 0 && x.importanceWeight <= 1)) throw new TypeError('C21_UTILITY_WEIGHT_INVALID');
  const preparedAt = iso(x.preparedAt, 'preparedAt');
  const reviewedAt = iso(x.reviewedAt, 'reviewedAt');
  const validUntil = iso(x.validUntil, 'validUntil');
  if (Date.parse(reviewedAt) < Date.parse(preparedAt)) throw new TypeError('C21_UTILITY_REVIEW_BEFORE_PREPARATION');
  if (Date.parse(validUntil) < Date.parse(reviewedAt)) throw new TypeError('C21_UTILITY_VALIDITY_INVALID');
  const core = {
    schemaVersion: 1,
    assessmentId: x.assessmentId.trim(),
    caseId: x.caseId.trim(),
    propertyRef: x.propertyRef.trim(),
    amenityEvidenceHashSha256: x.amenityEvidenceHashSha256.trim().toLowerCase(),
    utilityScore: x.utilityScore,
    importanceWeight: x.importanceWeight,
    rationaleRef: x.rationaleRef.trim(),
    preparedByRef: x.preparedByRef.trim(),
    preparedAt,
    reviewedByRef: x.reviewedByRef.trim(),
    reviewedAt,
    reviewEvidenceRef: x.reviewEvidenceRef.trim(),
    validUntil,
    professionalJudgmentSuppliedExternally: true,
    utilityScoreInventedBySoftware: false,
    importanceWeightInventedBySoftware: false,
    investmentAttractivenessDeterminedBySoftware: false,
  };
  return freeze({ ...core, utilityAssessmentHashSha256: sha256(core) });
}

function computePolicyHash(r) { return r && typeof r === 'object' && !Array.isArray(r)&&isPlainJson(r) ? sha256(without(r, ['policyHashSha256'])) : null; }
function verifyPolicyIntegrity(r) { return verifyCanonical(r,'policyHashSha256',createGovernedListingAmenityReviewPolicy,computePolicyHash); }

function createGovernedListingAmenityReviewPolicy(x = {}) {
  if(!safeInput(x)||authorityInjection(x))throw TypeError('C21_INTEGRITY_CONSTRUCTOR_INPUT');
  ['policyId','caseId','propertyRef','marketScopeRef','reviewedByRef','reviewEvidenceRef'].forEach((f) => {
    if (!nonEmpty(x[f])) throw new TypeError(`${f} must be a non-empty string`);
  });
  const allowedListingSourceTiers = uniqueStrings(x.allowedListingSourceTiers || [], 'allowedListingSourceTiers');
  const allowedAmenitySourceTiers = uniqueStrings(x.allowedAmenitySourceTiers || [], 'allowedAmenitySourceTiers');
  const allowedListingStatuses = uniqueStrings(x.allowedListingStatuses || [], 'allowedListingStatuses');
  const allowedAmenityClasses = uniqueStrings(x.allowedAmenityClasses || [], 'allowedAmenityClasses');
  const requiredAmenityClasses = uniqueStrings(x.requiredAmenityClasses || [], 'requiredAmenityClasses');
  if (!allowedListingSourceTiers.length || !allowedAmenitySourceTiers.length) throw new TypeError('C21_POLICY_SOURCE_TIERS_REQUIRED');
  if (!allowedListingStatuses.length || allowedListingStatuses.some((v) => !Object.values(LISTING_STATUS).includes(v))) throw new TypeError('C21_POLICY_LISTING_STATUS_INVALID');
  if (!allowedAmenityClasses.length || allowedAmenityClasses.some((v) => !Object.values(AMENITY_CLASS).includes(v))) throw new TypeError('C21_POLICY_AMENITY_CLASS_INVALID');
  if (requiredAmenityClasses.some((v) => !allowedAmenityClasses.includes(v))) throw new TypeError('C21_POLICY_REQUIRED_AMENITY_NOT_ALLOWED');
  const listingHashesSha256 = uniqueStrings(x.listingHashesSha256 || [], 'listingHashesSha256');
  const amenityHashesSha256 = uniqueStrings(x.amenityHashesSha256 || [], 'amenityHashesSha256');
  const utilityAssessmentHashesSha256 = uniqueStrings(x.utilityAssessmentHashesSha256 || [], 'utilityAssessmentHashesSha256');
  if (listingHashesSha256.some((h) => !HASH_RE.test(h)) || amenityHashesSha256.some((h) => !HASH_RE.test(h)) || utilityAssessmentHashesSha256.some((h) => !HASH_RE.test(h))) throw new TypeError('C21_POLICY_HASH_BINDING_INVALID');
  if (typeof x.allowPlannedProposedReviewContext !== 'boolean') throw new TypeError('C21_POLICY_PLANNED_CONTEXT_BOOLEAN_REQUIRED');
  const reviewedAt = iso(x.reviewedAt, 'reviewedAt');
  const validUntil = iso(x.validUntil, 'validUntil');
  if (Date.parse(validUntil) < Date.parse(reviewedAt)) throw new TypeError('C21_POLICY_VALIDITY_INVALID');
  const core = {
    version: POLICY_VERSION,
    policyId: x.policyId.trim(),
    caseId: x.caseId.trim(),
    propertyRef: x.propertyRef.trim(),
    marketScopeRef: x.marketScopeRef.trim(),
    allowedListingSourceTiers,
    allowedAmenitySourceTiers,
    allowedListingStatuses,
    allowedAmenityClasses,
    requiredAmenityClasses,
    listingHashesSha256,
    amenityHashesSha256,
    utilityAssessmentHashesSha256,
    allowPlannedProposedReviewContext: x.allowPlannedProposedReviewContext,
    reviewedByRef: x.reviewedByRef.trim(),
    reviewEvidenceRef: x.reviewEvidenceRef.trim(),
    reviewedAt,
    validUntil,
    askingToClosedTransactionPromotionAllowed: false,
    geospatialInferenceAllowed: false,
    automaticInvestmentRanking: false,
    automaticValuationUse: false,
  };
  return freeze({ ...core, policyHashSha256: sha256(core) });
}

const FALSE_ONLY_FIELDS = Object.freeze([
  'transactionAuthorized','approvalAuthorized','productionAuthorized','publicAiAuthorized','canonicalBaselineActivationAuthorized',
  'askingToClosedTransactionPromotionAllowed','closedTransactionEvidence','valuationEvidencePromotedBySoftware','listingAuthenticityGuaranteedBySoftware',
  'geospatialInferenceAllowed','distanceOrTravelTimeInferredBySoftware','serviceAvailabilityInferredBySoftware','deliveryStatusInferredBySoftware',
  'automaticInvestmentRanking','automaticValuationUse','utilityScoreInventedBySoftware','importanceWeightInventedBySoftware',
  'investmentAttractivenessDeterminedBySoftware','valuationCalculated','avmCalculated','npvCalculated','irrCalculated','recommendedBySoftware',
]);
function authorityInjection(record) {
  if (!record || typeof record !== 'object') return false;
  if (FALSE_ONLY_FIELDS.some((f) => Object.prototype.hasOwnProperty.call(record, f) && record[f] !== false)) return true;
  if (Object.prototype.hasOwnProperty.call(record, 'commercialGoLive') && record.commercialGoLive !== 'HOLD') return true;
  return false;
}

function evaluateGovernedListingAmenityReview(input = {}) {
 const held=(code)=>freeze({capability:CAPABILITY,policyVersion:POLICY_VERSION,status:statusFor([code]),professionalListingAmenityReviewReady:false,asOf:null,blockers:[code],riskFlags:[],review:null,recommendation:null,transactionAuthorized:false,approvalAuthorized:false,productionAuthorized:false,publicAiAuthorized:false,commercialGoLive:'HOLD',canonicalBaselineActivationAuthorized:false,geospatialInferenceAllowed:false,askingToClosedTransactionPromotionAllowed:false,automaticInvestmentRanking:false,automaticValuationUse:false,valuationCalculated:false,avmCalculated:false,npvCalculated:false,irrCalculated:false,sourceAuthenticityIndependentlyVerified:false,sourceRightsIndependentlyAuthenticated:false});
 if(!safeInput(input)||authorityInjection(input))return held('C21_INTEGRITY_INPUT_JSON_INVALID');
 if(!Number.isFinite(strictCalendarDateMs(input.asOf))||strictCalendarDateMs(input.asOf)>Date.now())return held('C21_WINDOW_AS_OF_INVALID');
 if(![input.listings,input.amenities,input.utilityAssessments].every(a=>Array.isArray(a)&&a.length<=500))return held('C21_EVIDENCE_COLLECTIONS_REQUIRED_OR_LIMIT');
 if(!input.listings.length||!input.amenities.length)return held('C21_EVIDENCE_NONEMPTY_LISTINGS_AND_AMENITIES_REQUIRED');
 if(![input.caseId,input.propertyRef,input.marketScopeRef].every(nonEmpty))return held('C21_CONTEXT_EXPLICIT_SCOPE_REQUIRED');
 try{return evaluateChecked(input);}catch{return held('C21_INTEGRITY_EVALUATION_FAILED');}
}
function evaluateChecked(input) {
  const listings = Array.isArray(input.listings) ? input.listings : [];
  const amenities = Array.isArray(input.amenities) ? input.amenities : [];
  const utilityAssessments = Array.isArray(input.utilityAssessments) ? input.utilityAssessments : [];
  const policy = input.reviewPolicy;
  const asOf = iso(input.asOf, 'asOf');
  const blockers = [];
  const riskFlags = [];

  if (!policy || !verifyPolicyIntegrity(policy)) blockers.push('C21_INTEGRITY_POLICY');
  if (authorityInjection(policy)) blockers.push('C21_AUTHORITY_INJECTION:POLICY');

  if(policy&&(policy.caseId!==input.caseId||policy.propertyRef!==input.propertyRef||policy.marketScopeRef!==input.marketScopeRef))blockers.push('C21_CONTEXT_POLICY_SCOPE_MISMATCH');
  const sourceListingIds=new Set(),listingRefs=new Set();
  const listingIds = new Set();
  const listingHashes = [];
  const dedupKeys = new Set();
  for (const r of listings) {
    const id = clean(r && r.listingEvidenceId) || 'UNKNOWN';
    if (!verifyListingIntegrity(r)) blockers.push(`C21_INTEGRITY_LISTING:${id}`);
    if (authorityInjection(r)) blockers.push(`C21_AUTHORITY_INJECTION:LISTING:${id}`);
    if (listingIds.has(id)) blockers.push(`C21_INTEGRITY_DUPLICATE_LISTING_ID:${id}`); else listingIds.add(id);
    const sourceKey=JSON.stringify([r?.sourceProviderId,r?.sourceRecordId]);
    if(sourceListingIds.has(sourceKey)||listingRefs.has(r?.listingRef))blockers.push('C21_INTEGRITY_DUPLICATE_LISTING_SOURCE:'+id);
    sourceListingIds.add(sourceKey);listingRefs.add(r?.listingRef);
    const key = clean(r && r.deduplicationKey);
    if (key && dedupKeys.has(key)) blockers.push(`C21_INTEGRITY_DUPLICATE_LISTING_DEDUP_KEY:${key}`); else if (key) dedupKeys.add(key);
    const hash = clean(r && r.listingEvidenceHashSha256).toLowerCase();
    if (HASH_RE.test(hash)) listingHashes.push(hash);
    if (r && r.closedTransactionEvidence !== false) blockers.push(`C21_INTEGRITY_ASKING_PROMOTED_TO_CLOSED:${id}`);
  }
  if (new Set(listingHashes).size !== listingHashes.length) blockers.push('C21_INTEGRITY_DUPLICATE_LISTING_HASH');

  const amenityIds = new Set(),amenityMetrics=new Set();
  const amenityHashes = [];
  for (const r of amenities) {
    const id = clean(r && r.amenityEvidenceId) || 'UNKNOWN';
    const metricKey=JSON.stringify([r?.amenityRef,r?.metricType]);if(amenityMetrics.has(metricKey))blockers.push('C21_INTEGRITY_DUPLICATE_AMENITY_METRIC:'+id);amenityMetrics.add(metricKey);
    if (!verifyAmenityIntegrity(r)) blockers.push(`C21_INTEGRITY_AMENITY:${id}`);
    if (authorityInjection(r)) blockers.push(`C21_AUTHORITY_INJECTION:AMENITY:${id}`);
    if (amenityIds.has(id)) blockers.push(`C21_INTEGRITY_DUPLICATE_AMENITY_ID:${id}`); else amenityIds.add(id);
    const hash = clean(r && r.amenityEvidenceHashSha256).toLowerCase();
    if (HASH_RE.test(hash)) amenityHashes.push(hash);
  }
  if (new Set(amenityHashes).size !== amenityHashes.length) blockers.push('C21_INTEGRITY_DUPLICATE_AMENITY_HASH');

  const assessmentIds = new Set();
  const assessmentHashes = [];
  const assessmentAmenityHashes = new Set();
  for (const r of utilityAssessments) {
    const id = clean(r && r.assessmentId) || 'UNKNOWN';
    if (!verifyUtilityAssessmentIntegrity(r)) blockers.push(`C21_INTEGRITY_UTILITY:${id}`);
    if (authorityInjection(r)) blockers.push(`C21_AUTHORITY_INJECTION:UTILITY:${id}`);
    if (assessmentIds.has(id)) blockers.push(`C21_INTEGRITY_DUPLICATE_UTILITY_ID:${id}`); else assessmentIds.add(id);
    const aHash = clean(r && r.amenityEvidenceHashSha256).toLowerCase();
    if (aHash && assessmentAmenityHashes.has(aHash)) blockers.push(`C21_INTEGRITY_DUPLICATE_UTILITY_AMENITY_BINDING:${aHash}`); else if (aHash) assessmentAmenityHashes.add(aHash);
    const hash = clean(r && r.utilityAssessmentHashSha256).toLowerCase();
    if (HASH_RE.test(hash)) assessmentHashes.push(hash);
  }
  if (new Set(assessmentHashes).size !== assessmentHashes.length) blockers.push('C21_INTEGRITY_DUPLICATE_UTILITY_HASH');

  if (policy && verifyPolicyIntegrity(policy)) {
    if (!exactSet(policy.listingHashesSha256, [...listingHashes].sort())) blockers.push('C21_POLICY_LISTING_BINDING_MISMATCH');
    if (!exactSet(policy.amenityHashesSha256, [...amenityHashes].sort())) blockers.push('C21_POLICY_AMENITY_BINDING_MISMATCH');
    if (!exactSet(policy.utilityAssessmentHashesSha256, [...assessmentHashes].sort())) blockers.push('C21_POLICY_UTILITY_BINDING_MISMATCH');
    if([...listings,...amenities,...utilityAssessments].some(r=>r&&Date.parse(r.reviewedAt)>Date.parse(policy.reviewedAt)))blockers.push('C21_WINDOW_POLICY_REVIEW_BEFORE_BOUND_EVIDENCE');
    if (Date.parse(policy.reviewedAt) > Date.parse(asOf)) blockers.push('C21_WINDOW_POLICY_REVIEWED_IN_FUTURE');
    if (Date.parse(policy.validUntil) < Date.parse(asOf)) blockers.push('C21_WINDOW_POLICY_EXPIRED');

    for (const r of listings) {
      const id = clean(r && r.listingEvidenceId) || 'UNKNOWN';
      if (!r || typeof r !== 'object') continue;
      if (r.caseId !== policy.caseId || r.propertyRef !== policy.propertyRef || r.marketScopeRef !== policy.marketScopeRef) blockers.push(`C21_CONTEXT_LISTING:${id}`);
      if (!policy.allowedListingSourceTiers.includes(r.sourceTier)) blockers.push(`C21_POLICY_LISTING_SOURCE_TIER:${id}`);
      if (!policy.allowedListingStatuses.includes(r.listingStatus)) blockers.push(`C21_POLICY_LISTING_STATUS:${id}`);
      if (r.provenanceVerified !== true) blockers.push(`C21_EVIDENCE_LISTING_PROVENANCE:${id}`);
      if (Date.parse(r.publishedAt) > Date.parse(asOf) || Date.parse(r.observedAt) > Date.parse(asOf) || Date.parse(r.reviewedAt) > Date.parse(asOf)) blockers.push(`C21_WINDOW_LISTING_FUTURE:${id}`);
      if (Date.parse(r.validUntil) < Date.parse(asOf)) blockers.push(`C21_WINDOW_LISTING_STALE:${id}`);
    }

    const amenityByHash = new Map(amenities.map((r) => [clean(r && r.amenityEvidenceHashSha256).toLowerCase(), r]));
    for (const r of amenities) {
      const id = clean(r && r.amenityEvidenceId) || 'UNKNOWN';
      if (!r || typeof r !== 'object') continue;
      if (r.caseId !== policy.caseId || r.propertyRef !== policy.propertyRef || r.marketScopeRef !== policy.marketScopeRef) blockers.push(`C21_CONTEXT_AMENITY:${id}`);
      if (!policy.allowedAmenitySourceTiers.includes(r.sourceTier)) blockers.push(`C21_POLICY_AMENITY_SOURCE_TIER:${id}`);
      if (!policy.allowedAmenityClasses.includes(r.amenityClass)) blockers.push(`C21_POLICY_AMENITY_CLASS:${id}`);
      if (r.provenanceVerified !== true) blockers.push(`C21_EVIDENCE_AMENITY_PROVENANCE:${id}`);
      if (Date.parse(r.knownAt) > Date.parse(asOf) || Date.parse(r.reviewedAt) > Date.parse(asOf)) blockers.push(`C21_WINDOW_AMENITY_FUTURE:${id}`);
      if (Date.parse(r.validUntil) < Date.parse(asOf)) blockers.push(`C21_WINDOW_AMENITY_STALE:${id}`);
      if (r.amenityState === AMENITY_STATE.UNRESOLVED) blockers.push(`C21_EVIDENCE_AMENITY_UNRESOLVED:${id}`);
      if ((r.amenityState === AMENITY_STATE.PLANNED_NOT_DELIVERED || r.amenityState === AMENITY_STATE.PROPOSED_UNCERTAIN) && !policy.allowPlannedProposedReviewContext) blockers.push(`C21_POLICY_PLANNED_PROPOSED_CONTEXT_NOT_ALLOWED:${id}`);
    }

    for (const requiredClass of policy.requiredAmenityClasses) {
      const satisfied = amenities.some((r) => r.amenityClass === requiredClass && r.amenityState === AMENITY_STATE.EXISTING_VERIFIED);
      if (!satisfied) blockers.push(`C21_COVERAGE_REQUIRED_AMENITY_CLASS:${requiredClass}`);
    }

    for (const a of utilityAssessments) {
      const id = clean(a && a.assessmentId) || 'UNKNOWN';
      if (!a || typeof a !== 'object') continue;
      if (a.caseId !== policy.caseId || a.propertyRef !== policy.propertyRef) blockers.push(`C21_CONTEXT_UTILITY:${id}`);
      if (Date.parse(a.reviewedAt) > Date.parse(asOf) || Date.parse(a.preparedAt) > Date.parse(asOf)) blockers.push(`C21_WINDOW_UTILITY_FUTURE:${id}`);
      if (Date.parse(a.validUntil) < Date.parse(asOf)) blockers.push(`C21_WINDOW_UTILITY_STALE:${id}`);
      const amenity = amenityByHash.get(clean(a.amenityEvidenceHashSha256).toLowerCase());
      if (!amenity) blockers.push(`C21_EVIDENCE_UTILITY_AMENITY_MISSING:${id}`);
      else if (amenity.amenityState !== AMENITY_STATE.EXISTING_VERIFIED) blockers.push(`C21_EVIDENCE_UTILITY_NON_EXISTING_AMENITY:${id}`);
      else if(Date.parse(a.preparedAt)<Date.parse(amenity.reviewedAt))blockers.push(`C21_WINDOW_UTILITY_PREPARED_BEFORE_AMENITY_REVIEW:${id}`);
    }
  }

  if(utilityAssessments.length&&Math.abs(utilityAssessments.reduce((sum,a)=>sum+a.importanceWeight,0)-1)>1e-9)blockers.push('C21_CALCULATION_EXPLICIT_WEIGHTS_MUST_SUM_TO_ONE');
  if(listings.some(r=>r?.askingPriceSar!=null&&!finitePositive(r.askingPriceSar/r.areaSqm)))blockers.push('C21_CALCULATION_PRICE_PER_SQM_INVALID');
  const priceValues=listings.filter(r=>r?.askingPriceSar!=null&&[LISTING_STATUS.ACTIVE,LISTING_STATUS.UNDER_OFFER].includes(r.listingStatus)).map(r=>r.askingPriceSar/r.areaSqm);
  if(priceValues.length&&!Number.isFinite(priceValues.reduce((a,b)=>a+b,0)))blockers.push('C21_CALCULATION_PRICE_SUM_INVALID');
  const uniqueBlockers = [...new Set(blockers)].sort();
  const uniqueRiskFlags = [...new Set(riskFlags)].sort();
  const ready = uniqueBlockers.length === 0;
  let review = null;
  if (ready) {
    const activeListings = listings.filter((r) => r.listingStatus === LISTING_STATUS.ACTIVE || r.listingStatus === LISTING_STATUS.UNDER_OFFER);
    const pricePerSqm = activeListings.filter((r) => r.askingPriceSar != null).map((r) => r.askingPriceSar / r.areaSqm);
    const utilityWeight = utilityAssessments.reduce((sum, a) => sum + a.importanceWeight, 0);
    const weightedUtility = utilityWeight > 0 ? utilityAssessments.reduce((sum, a) => sum + (a.utilityScore * a.importanceWeight), 0) / utilityWeight : null;
    review = freeze({
      listingTransparency: {
        listingCount: listings.length,
        activeOrUnderOfferCount: activeListings.length,
        listingsWithExplicitPriceAndArea: pricePerSqm.length,
        meanAskingPricePerSqmSar: pricePerSqm.length ? pricePerSqm.reduce((a, b) => a + b, 0) / pricePerSqm.length : null,
        askingEvidenceOnly: true,
        closedTransactionEvidenceCount: 0,
      },
      amenityUtility: {
        existingVerifiedAmenityCount: amenities.filter((r) => r.amenityState === AMENITY_STATE.EXISTING_VERIFIED).length,
        plannedNotDeliveredCount: amenities.filter((r) => r.amenityState === AMENITY_STATE.PLANNED_NOT_DELIVERED).length,
        proposedUncertainCount: amenities.filter((r) => r.amenityState === AMENITY_STATE.PROPOSED_UNCERTAIN).length,
        utilityAssessmentCount: utilityAssessments.length,
        weightedProfessionalUtilityScore: weightedUtility,
        scoreSource: weightedUtility == null ? null : 'EXTERNALLY_SUPPLIED_PROFESSIONAL_SCORES_AND_WEIGHTS',
      },
      recommendation: null,
      valuationConclusion: null,
    });
  }

  return freeze({
    capability: CAPABILITY,
    policyVersion: POLICY_VERSION,
    status: ready ? REVIEW_STATUS.READY_FOR_PROFESSIONAL_LISTING_AMENITY_REVIEW : statusFor(uniqueBlockers),
    professionalListingAmenityReviewReady: ready,
    sourceAuthenticityIndependentlyVerified:false,
    sourceRightsIndependentlyAuthenticated:false,
    asOf,
    blockers: uniqueBlockers,
    riskFlags: uniqueRiskFlags,
    review,
    recommendation: null,
    transactionAuthorized: false,
    approvalAuthorized: false,
    productionAuthorized: false,
    publicAiAuthorized: false,
    commercialGoLive: 'HOLD',
    canonicalBaselineActivationAuthorized: false,
    geospatialInferenceAllowed: false,
    askingToClosedTransactionPromotionAllowed: false,
    automaticInvestmentRanking: false,
    automaticValuationUse: false,
    valuationCalculated: false,
    avmCalculated: false,
    npvCalculated: false,
    irrCalculated: false,
  });
}

module.exports = Object.freeze({
  CAPABILITY,
  POLICY_VERSION,
  REVIEW_STATUS,
  LISTING_STATUS,
  AMENITY_CLASS,
  AMENITY_STATE,
  AMENITY_METRIC_TYPE,
  createGovernedListingEvidence,
  computeListingHash,
  verifyListingIntegrity,
  createGovernedAmenityEvidence,
  computeAmenityHash,
  verifyAmenityIntegrity,
  createProfessionalAmenityUtilityAssessment,
  computeUtilityAssessmentHash,
  verifyUtilityAssessmentIntegrity,
  createGovernedListingAmenityReviewPolicy,
  computePolicyHash,
  verifyPolicyIntegrity,
  evaluateGovernedListingAmenityReview,
});