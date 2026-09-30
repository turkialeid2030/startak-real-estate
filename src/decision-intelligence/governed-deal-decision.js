'use strict';

const crypto = require('crypto');
const {
  C4_GOVERNED_DEAL_DECISION_SCHEMA_VERSION,
  C4_GOVERNED_REPORT_SCHEMA_VERSION,
  C4_DECISION_STATUS,
  C4_REVIEW_RECOMMENDATION,
  C4_REPORT_CLASSIFICATION,
  C4_AUTHORITY_BOUNDARY,
} = require('../contracts/governed-deal-decision');
const {
  C3_VALUATION_RECONCILIATION_SCHEMA_VERSION,
  RECONCILIATION_GATE_STATUS,
  VALUATION_VALUE_SCOPE,
} = require('../contracts/valuation-reconciliation');

const HASH_RE = /^[a-f0-9]{64}$/i;
const HOUR_MS = 60 * 60 * 1000;
const C3_RESULT_CORE_FIELDS = Object.freeze([
  'version', 'schemaVersion', 'propertyRef', 'valuationDate', 'valuationScope', 'asOf',
  'status', 'decisionReady', 'reconciliationPolicyId', 'dependencyStatus',
  'marketContextBinding', 'methodCoverage', 'eligibleMethodIndications',
  'reconciliationInstruction', 'weightedTrace', 'candidateWeightedValueSar',
  'analyticalRangeLowSar', 'analyticalRangeHighSar', 'spreadRatio',
  'analyticalConfidenceClass', 'analyticalValueIndicationSar', 'blockers', 'warnings',
]);

class C4GovernanceError extends Error {
  constructor(code, field = null) {
    super(`${code}${field ? ` (${field})` : ''}`);
    this.name = 'C4GovernanceError';
    this.code = code;
    this.field = field;
  }
}

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function requiredString(value, field) {
  const text = cleanString(value);
  if (!text) throw new C4GovernanceError('C4_REQUIRED_FIELD', field);
  return text;
}

function requiredObject(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new C4GovernanceError('C4_OBJECT_REQUIRED', field);
  return value;
}

function timestamp(value, field) {
  const ms = new Date(requiredString(value, field)).getTime();
  if (!Number.isFinite(ms)) throw new C4GovernanceError('C4_TIMESTAMP_INVALID', field);
  return ms;
}

function iso(value, field) {
  return new Date(timestamp(value, field)).toISOString();
}

function hash64(value, field) {
  const text = cleanString(value).toLowerCase();
  if (!HASH_RE.test(text)) throw new C4GovernanceError('C4_HASH_REQUIRED', field);
  return text;
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
  if (!isJsonSafe(value)) throw new C4GovernanceError('C4_NON_JSON_SAFE_PAYLOAD');
  return crypto.createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function c3Core(reconciliation) {
  return Object.fromEntries(C3_RESULT_CORE_FIELDS.map((field) => [field, clone(reconciliation[field])]));
}

function computeC3ResultHash(reconciliation) {
  requiredObject(reconciliation, 'reconciliation');
  return sha256(c3Core(reconciliation));
}

function requireFalse(value, field, code) {
  if (value !== false) throw new C4GovernanceError(code, field);
}

function validateC3(reconciliation, { propertyRef, valuationDate, generatedAtMs, maxReconciliationAgeHours }) {
  requiredObject(reconciliation, 'reconciliation');
  if (reconciliation.schemaVersion !== C3_VALUATION_RECONCILIATION_SCHEMA_VERSION) throw new C4GovernanceError('C4_C3_SCHEMA_UNSUPPORTED');
  if (reconciliation.status !== RECONCILIATION_GATE_STATUS.READY || reconciliation.decisionReady !== true) throw new C4GovernanceError('C4_RECONCILIATION_NOT_READY');
  if (!Array.isArray(reconciliation.blockers) || reconciliation.blockers.length) throw new C4GovernanceError('C4_RECONCILIATION_BLOCKERS_PRESENT');
  if (reconciliation.valuationScope !== VALUATION_VALUE_SCOPE.WHOLE_PROPERTY) throw new C4GovernanceError('C4_WHOLE_PROPERTY_SCOPE_REQUIRED');
  if (cleanString(reconciliation.propertyRef) !== propertyRef) throw new C4GovernanceError('C4_PROPERTY_REF_MISMATCH');
  if (iso(reconciliation.valuationDate, 'reconciliation.valuationDate') !== valuationDate) throw new C4GovernanceError('C4_VALUATION_DATE_MISMATCH');
  if (!(typeof maxReconciliationAgeHours === 'number' && Number.isFinite(maxReconciliationAgeHours) && maxReconciliationAgeHours > 0)) {
    throw new C4GovernanceError('C4_FRESHNESS_POLICY_INVALID');
  }
  const asOfMs = timestamp(reconciliation.asOf, 'reconciliation.asOf');
  if (asOfMs > generatedAtMs) throw new C4GovernanceError('C4_RECONCILIATION_FROM_FUTURE');
  if (generatedAtMs - asOfMs > maxReconciliationAgeHours * HOUR_MS) throw new C4GovernanceError('C4_RECONCILIATION_STALE');
  if (reconciliation.dependencyStatus?.c1 !== 'READY' || reconciliation.dependencyStatus?.c2 !== 'READY') throw new C4GovernanceError('C4_UPSTREAM_EVIDENCE_NOT_READY');
  requireFalse(reconciliation.finalValuationConclusionEstablished, 'finalValuationConclusionEstablished', 'C4_UPSTREAM_FINAL_VALUATION_FORBIDDEN');
  requireFalse(reconciliation.certifiedValuationEstablished, 'certifiedValuationEstablished', 'C4_UPSTREAM_CERTIFIED_VALUATION_FORBIDDEN');
  requireFalse(reconciliation.transactionAuthorized, 'transactionAuthorized', 'C4_UPSTREAM_TRANSACTION_AUTHORITY_FORBIDDEN');
  requireFalse(reconciliation.publicAiAuthorized, 'publicAiAuthorized', 'C4_UPSTREAM_PUBLIC_AI_AUTHORITY_FORBIDDEN');
  if (!(typeof reconciliation.analyticalValueIndicationSar === 'number' && Number.isFinite(reconciliation.analyticalValueIndicationSar) && reconciliation.analyticalValueIndicationSar > 0)) {
    throw new C4GovernanceError('C4_ANALYTICAL_VALUE_INDICATION_INVALID');
  }
  if (!Array.isArray(reconciliation.eligibleMethodIndications) || !reconciliation.eligibleMethodIndications.length) throw new C4GovernanceError('C4_METHOD_LINEAGE_REQUIRED');
  for (const method of reconciliation.eligibleMethodIndications) {
    requiredObject(method, 'eligibleMethodIndication');
    const id = requiredString(method.id, 'method.id');
    hash64(method.calculationHashSha256, `method.${id}.calculationHashSha256`);
    hash64(method.sourceResultHashSha256, `method.${id}.sourceResultHashSha256`);
  }
  const declaredHash = hash64(reconciliation.resultHashSha256, 'reconciliation.resultHashSha256');
  if (declaredHash !== computeC3ResultHash(reconciliation)) throw new C4GovernanceError('C4_RECONCILIATION_HASH_MISMATCH');
  return { asOfMs, declaredHash };
}

function normalizeLineage(lineage, reconciliation) {
  requiredObject(lineage, 'evidenceLineage');
  const normalized = {
    c1ResultHashSha256: hash64(lineage.c1ResultHashSha256, 'evidenceLineage.c1ResultHashSha256'),
    c2ResultHashSha256: hash64(lineage.c2ResultHashSha256, 'evidenceLineage.c2ResultHashSha256'),
    reconciliationResultHashSha256: hash64(lineage.reconciliationResultHashSha256, 'evidenceLineage.reconciliationResultHashSha256'),
  };
  if (normalized.reconciliationResultHashSha256 !== reconciliation.resultHashSha256.toLowerCase()) throw new C4GovernanceError('C4_LINEAGE_RECONCILIATION_HASH_MISMATCH');
  if (!Array.isArray(lineage.sourceEvidenceHashes) || !lineage.sourceEvidenceHashes.length) throw new C4GovernanceError('C4_SOURCE_EVIDENCE_HASHES_REQUIRED');
  normalized.sourceEvidenceHashes = [...new Set(lineage.sourceEvidenceHashes.map((item, index) => hash64(item, `evidenceLineage.sourceEvidenceHashes[${index}]`)))].sort();
  const map = requiredObject(lineage.methodSourceResultHashesById, 'evidenceLineage.methodSourceResultHashesById');
  const methods = reconciliation.eligibleMethodIndications;
  if (Object.keys(map).length !== methods.length) throw new C4GovernanceError('C4_METHOD_LINEAGE_CARDINALITY_MISMATCH');
  normalized.methodSourceResultHashesById = {};
  for (const method of methods) {
    const declared = hash64(map[method.id], `evidenceLineage.methodSourceResultHashesById.${method.id}`);
    if (declared !== hash64(method.sourceResultHashSha256, `method.${method.id}.sourceResultHashSha256`)) throw new C4GovernanceError('C4_METHOD_SOURCE_HASH_MISMATCH', method.id);
    normalized.methodSourceResultHashesById[method.id] = declared;
  }
  if (Object.keys(map).some((id) => !methods.some((method) => method.id === id))) throw new C4GovernanceError('C4_UNKNOWN_METHOD_LINEAGE');
  return normalized;
}

function normalizeReview(review, { reconciliationAsOfMs, generatedAtMs }) {
  if (review === null || review === undefined) return null;
  requiredObject(review, 'humanReview');
  if (review.approved === true || (Object.prototype.hasOwnProperty.call(review, 'approvalStatus') && review.approvalStatus !== 'NOT_ESTABLISHED')) {
    throw new C4GovernanceError('C4_REVIEW_AUTHORITY_FIELD_FORBIDDEN');
  }
  for (const field of ['approvalEstablished', 'transactionAuthorized', 'finalValuationConclusionEstablished', 'certifiedValuationEstablished']) {
    if (Object.prototype.hasOwnProperty.call(review, field) && review[field] !== false) throw new C4GovernanceError('C4_REVIEW_AUTHORITY_FIELD_FORBIDDEN', field);
  }
  if (Object.prototype.hasOwnProperty.call(review, 'commercialGoLive') && review.commercialGoLive !== 'HOLD') throw new C4GovernanceError('C4_REVIEW_AUTHORITY_FIELD_FORBIDDEN', 'commercialGoLive');
  const reviewerId = requiredString(review.reviewerId, 'humanReview.reviewerId');
  const recommendation = requiredString(review.recommendation, 'humanReview.recommendation');
  if (!Object.values(C4_REVIEW_RECOMMENDATION).includes(recommendation)) throw new C4GovernanceError('C4_REVIEW_RECOMMENDATION_INVALID');
  const rationale = requiredString(review.rationale, 'humanReview.rationale');
  const reviewedAtMs = timestamp(review.reviewedAt, 'humanReview.reviewedAt');
  if (reviewedAtMs < reconciliationAsOfMs) throw new C4GovernanceError('C4_REVIEW_BEFORE_RECONCILIATION');
  if (reviewedAtMs > generatedAtMs) throw new C4GovernanceError('C4_REVIEW_FROM_FUTURE');
  return {
    reviewerId,
    recommendation,
    rationale,
    reviewedAt: new Date(reviewedAtMs).toISOString(),
    approvalEstablished: false,
    transactionAuthorized: false,
  };
}

function snapshotCore(snapshot) {
  return {
    schemaVersion: snapshot.schemaVersion,
    caseId: snapshot.caseId,
    projectId: snapshot.projectId,
    propertyRef: snapshot.propertyRef,
    valuationDate: snapshot.valuationDate,
    generatedAt: snapshot.generatedAt,
    maxReconciliationAgeHours: snapshot.maxReconciliationAgeHours,
    status: snapshot.status,
    reconciliationSummary: clone(snapshot.reconciliationSummary),
    evidenceLineage: clone(snapshot.evidenceLineage),
    humanReview: clone(snapshot.humanReview),
    authorityBoundary: clone(snapshot.authorityBoundary),
    humanDecisionRequired: snapshot.humanDecisionRequired,
    transactionReady: snapshot.transactionReady,
    reportReady: snapshot.reportReady,
    semantics: snapshot.semantics,
  };
}

function buildGovernedDealDecision({ caseId, projectId, propertyRef, valuationDate, reconciliation, evidenceLineage, generatedAt, maxReconciliationAgeHours, humanReview = null } = {}) {
  const scopedCaseId = requiredString(caseId, 'caseId');
  const scopedProjectId = requiredString(projectId, 'projectId');
  const scopedPropertyRef = requiredString(propertyRef, 'propertyRef');
  const scopedValuationDate = iso(valuationDate, 'valuationDate');
  const generatedAtMs = timestamp(generatedAt, 'generatedAt');
  const upstream = validateC3(reconciliation, { propertyRef: scopedPropertyRef, valuationDate: scopedValuationDate, generatedAtMs, maxReconciliationAgeHours });
  const lineage = normalizeLineage(evidenceLineage, reconciliation);
  const review = normalizeReview(humanReview, { reconciliationAsOfMs: upstream.asOfMs, generatedAtMs });
  const core = {
    schemaVersion: C4_GOVERNED_DEAL_DECISION_SCHEMA_VERSION,
    caseId: scopedCaseId,
    projectId: scopedProjectId,
    propertyRef: scopedPropertyRef,
    valuationDate: scopedValuationDate,
    generatedAt: new Date(generatedAtMs).toISOString(),
    maxReconciliationAgeHours,
    status: review ? C4_DECISION_STATUS.REVIEW_RECOMMENDATION_RECORDED : C4_DECISION_STATUS.READY_FOR_HUMAN_REVIEW,
    reconciliationSummary: {
      schemaVersion: reconciliation.schemaVersion,
      resultHashSha256: upstream.declaredHash,
      status: reconciliation.status,
      asOf: new Date(upstream.asOfMs).toISOString(),
      valuationScope: reconciliation.valuationScope,
      reconciliationPolicyId: reconciliation.reconciliationPolicyId,
      analyticalValueIndicationSar: reconciliation.analyticalValueIndicationSar,
      analyticalRangeLowSar: reconciliation.analyticalRangeLowSar,
      analyticalRangeHighSar: reconciliation.analyticalRangeHighSar,
      analyticalConfidenceClass: reconciliation.analyticalConfidenceClass,
      eligibleMethodCount: reconciliation.eligibleMethodIndications.length,
      eligibleApproachFamilies: clone(reconciliation.methodCoverage?.eligibleApproachFamilies || []),
    },
    evidenceLineage: lineage,
    humanReview: review,
    authorityBoundary: { ...C4_AUTHORITY_BOUNDARY },
    humanDecisionRequired: true,
    transactionReady: false,
    reportReady: true,
    semantics: 'C4 binds a qualified governed reconciliation to an auditable deal/case snapshot and optional human reviewer recommendation. It does not approve a transaction, establish commercial go-live, create a final or certified valuation, or authorize public AI.',
  };
  return deepFreeze({ ...core, snapshotHashSha256: sha256(core) });
}

function validateGovernedDealDecisionSnapshot(snapshot) {
  requiredObject(snapshot, 'governedDealDecision');
  const allowed = new Set([...Object.keys(snapshotCore(snapshot)), 'snapshotHashSha256']);
  if (Object.keys(snapshot).some((key) => !allowed.has(key))) throw new C4GovernanceError('C4_SNAPSHOT_FIELD_NOT_ALLOWED');
  if (snapshot.schemaVersion !== C4_GOVERNED_DEAL_DECISION_SCHEMA_VERSION) throw new C4GovernanceError('C4_SNAPSHOT_SCHEMA_UNSUPPORTED');
  requiredString(snapshot.caseId, 'snapshot.caseId');
  requiredString(snapshot.projectId, 'snapshot.projectId');
  requiredString(snapshot.propertyRef, 'snapshot.propertyRef');
  iso(snapshot.valuationDate, 'snapshot.valuationDate');
  const generatedAtMs = timestamp(snapshot.generatedAt, 'snapshot.generatedAt');
  if (!(typeof snapshot.maxReconciliationAgeHours === 'number' && Number.isFinite(snapshot.maxReconciliationAgeHours) && snapshot.maxReconciliationAgeHours > 0)) throw new C4GovernanceError('C4_FRESHNESS_POLICY_INVALID');
  const summary = requiredObject(snapshot.reconciliationSummary, 'snapshot.reconciliationSummary');
  if (summary.schemaVersion !== C3_VALUATION_RECONCILIATION_SCHEMA_VERSION || summary.status !== RECONCILIATION_GATE_STATUS.READY || summary.valuationScope !== VALUATION_VALUE_SCOPE.WHOLE_PROPERTY) throw new C4GovernanceError('C4_SNAPSHOT_RECONCILIATION_NOT_QUALIFIED');
  const reconciliationHash = hash64(summary.resultHashSha256, 'snapshot.reconciliationSummary.resultHashSha256');
  const lineage = requiredObject(snapshot.evidenceLineage, 'snapshot.evidenceLineage');
  hash64(lineage.c1ResultHashSha256, 'snapshot.evidenceLineage.c1ResultHashSha256');
  hash64(lineage.c2ResultHashSha256, 'snapshot.evidenceLineage.c2ResultHashSha256');
  if (hash64(lineage.reconciliationResultHashSha256, 'snapshot.evidenceLineage.reconciliationResultHashSha256') !== reconciliationHash) throw new C4GovernanceError('C4_LINEAGE_RECONCILIATION_HASH_MISMATCH');
  if (!Array.isArray(lineage.sourceEvidenceHashes) || !lineage.sourceEvidenceHashes.length) throw new C4GovernanceError('C4_SOURCE_EVIDENCE_HASHES_REQUIRED');
  lineage.sourceEvidenceHashes.forEach((item, index) => hash64(item, `snapshot.evidenceLineage.sourceEvidenceHashes[${index}]`));
  const methodMap = requiredObject(lineage.methodSourceResultHashesById, 'snapshot.evidenceLineage.methodSourceResultHashesById');
  Object.entries(methodMap).forEach(([id, value]) => hash64(value, `snapshot.evidenceLineage.methodSourceResultHashesById.${id}`));
  const authority = requiredObject(snapshot.authorityBoundary, 'snapshot.authorityBoundary');
  if (authority.commercialGoLive !== 'HOLD') throw new C4GovernanceError('C4_COMMERCIAL_GO_LIVE_FORBIDDEN');
  ['transactionAuthority', 'publicAi', 'canonicalBaselineActivationAuthorized', 'approvalAuthorized', 'finalValuationConclusionEstablished', 'certifiedValuationEstablished'].forEach((field) => {
    if (authority[field] !== false) throw new C4GovernanceError('C4_AUTHORITY_ESCALATION_FORBIDDEN', field);
  });
  if (snapshot.humanDecisionRequired !== true || snapshot.transactionReady !== false || snapshot.reportReady !== true) throw new C4GovernanceError('C4_SNAPSHOT_SEMANTICS_INVALID');
  const asOfMs = timestamp(summary.asOf, 'snapshot.reconciliationSummary.asOf');
  if (asOfMs > generatedAtMs || generatedAtMs - asOfMs > snapshot.maxReconciliationAgeHours * HOUR_MS) throw new C4GovernanceError('C4_SNAPSHOT_RECONCILIATION_STALE');
  const review = normalizeReview(snapshot.humanReview, { reconciliationAsOfMs: asOfMs, generatedAtMs });
  const expectedStatus = review ? C4_DECISION_STATUS.REVIEW_RECOMMENDATION_RECORDED : C4_DECISION_STATUS.READY_FOR_HUMAN_REVIEW;
  if (snapshot.status !== expectedStatus) throw new C4GovernanceError('C4_SNAPSHOT_REVIEW_STATUS_MISMATCH');
  if (hash64(snapshot.snapshotHashSha256, 'snapshot.snapshotHashSha256') !== sha256(snapshotCore(snapshot))) throw new C4GovernanceError('C4_SNAPSHOT_HASH_MISMATCH');
  return true;
}

function buildGovernedDealDecisionReport({ reportId, decisionSnapshot, generatedAt } = {}) {
  const scopedReportId = requiredString(reportId, 'reportId');
  validateGovernedDealDecisionSnapshot(decisionSnapshot);
  const generatedAtMs = timestamp(generatedAt, 'report.generatedAt');
  if (generatedAtMs < timestamp(decisionSnapshot.generatedAt, 'decisionSnapshot.generatedAt')) throw new C4GovernanceError('C4_REPORT_BEFORE_DECISION_SNAPSHOT');
  const core = {
    schemaVersion: C4_GOVERNED_REPORT_SCHEMA_VERSION,
    reportId: scopedReportId,
    classification: C4_REPORT_CLASSIFICATION.NON_AUTHORIZING_ANALYTICAL_OUTPUT,
    generatedAt: new Date(generatedAtMs).toISOString(),
    decisionSnapshotHashSha256: decisionSnapshot.snapshotHashSha256,
    caseId: decisionSnapshot.caseId,
    projectId: decisionSnapshot.projectId,
    propertyRef: decisionSnapshot.propertyRef,
    valuationDate: decisionSnapshot.valuationDate,
    reconciliation: clone(decisionSnapshot.reconciliationSummary),
    evidenceLineage: clone(decisionSnapshot.evidenceLineage),
    reviewerRecommendation: decisionSnapshot.humanReview ? clone(decisionSnapshot.humanReview) : null,
    approval: { status: 'NOT_ESTABLISHED', authorized: false, transactionAuthorized: false },
    authorityBoundary: { ...C4_AUTHORITY_BOUNDARY },
    humanDecisionRequired: true,
    disclosures: [
      'NON_AUTHORIZING_ANALYTICAL_OUTPUT',
      'NOT_A_FINAL_OR_CERTIFIED_VALUATION',
      'HUMAN_DECISION_AND_SEPARATE_APPROVAL_AUTHORITY_REQUIRED',
      'REVIEWER_RECOMMENDATION_DOES_NOT_EQUAL_APPROVAL',
      'TRANSACTION_AUTHORITY_FALSE',
      'COMMERCIAL_GO_LIVE_HOLD',
    ],
    semantics: 'This governed report projects an auditable analytical reconciliation and any recorded human reviewer recommendation. It is non-authorizing and cannot establish approval, transaction authority, commercial go-live, a licensed/certified valuation, or public-AI authority.',
  };
  return deepFreeze({ ...core, reportHashSha256: sha256(core) });
}

module.exports = {
  C4GovernanceError,
  computeC3ResultHash,
  buildGovernedDealDecision,
  validateGovernedDealDecisionSnapshot,
  buildGovernedDealDecisionReport,
};
