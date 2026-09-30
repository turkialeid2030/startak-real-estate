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

function toTimestamp(value, field) {
  const text = requiredString(value, field);
  const ms = new Date(text).getTime();
  if (!Number.isFinite(ms)) throw new C4GovernanceError('C4_TIMESTAMP_INVALID', field);
  return ms;
}

function normalizedIso(value, field) {
  return new Date(toTimestamp(value, field)).toISOString();
}

function assertHash(value, field) {
  const text = cleanString(value);
  if (!HASH_RE.test(text)) throw new C4GovernanceError('C4_HASH_REQUIRED', field);
  return text.toLowerCase();
}

function isJsonSafe(value, seen = new Set()) {
  if (value === null) return true;
  if (typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) return false;
  seen.add(value);
  const valid = Array.isArray(value)
    ? value.every((item) => isJsonSafe(item, seen))
    : Object.keys(value).every((key) => isJsonSafe(value[key], seen));
  seen.delete(value);
  return valid;
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

function sha256(value) {
  if (!isJsonSafe(value)) throw new C4GovernanceError('C4_NON_JSON_SAFE_PAYLOAD');
  return crypto.createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
}

function clone(value) {
  if (Array.isArray(value)) return value.map(clone);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, clone(child)]));
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

const C3_RESULT_CORE_FIELDS = Object.freeze([
  'version',
  'schemaVersion',
  'propertyRef',
  'valuationDate',
  'valuationScope',
  'asOf',
  'status',
  'decisionReady',
  'reconciliationPolicyId',
  'dependencyStatus',
  'marketContextBinding',
  'methodCoverage',
  'eligibleMethodIndications',
  'reconciliationInstruction',
  'weightedTrace',
  'candidateWeightedValueSar',
  'analyticalRangeLowSar',
  'analyticalRangeHighSar',
  'spreadRatio',
  'analyticalConfidenceClass',
  'analyticalValueIndicationSar',
  'blockers',
  'warnings',
]);

function c3ResultCore(reconciliation) {
  const core = {};
  for (const field of C3_RESULT_CORE_FIELDS) core[field] = clone(reconciliation[field]);
  return core;
}

function computeC3ResultHash(reconciliation) {
  requiredObject(reconciliation, 'reconciliation');
  return sha256(c3ResultCore(reconciliation));
}

function assertFalse(value, field, code) {
  if (value !== false) throw new C4GovernanceError(code, field);
}

function validateC3Reconciliation(reconciliation, {
  propertyRef,
  valuationDate,
  generatedAtMs,
  maxReconciliationAgeHours,
}) {
  requiredObject(reconciliation, 'reconciliation');
  if (reconciliation.schemaVersion !== C3_VALUATION_RECONCILIATION_SCHEMA_VERSION) {
    throw new C4GovernanceError('C4_C3_SCHEMA_UNSUPPORTED', 'reconciliation.schemaVersion');
  }
  if (reconciliation.status !== RECONCILIATION_GATE_STATUS.READY || reconciliation.decisionReady !== true) {
    throw new C4GovernanceError('C4_RECONCILIATION_NOT_READY');
  }
  if (!Array.isArray(reconciliation.blockers) || reconciliation.blockers.length !== 0) {
    throw new C4GovernanceError('C4_RECONCILIATION_BLOCKERS_PRESENT');
  }
  if (reconciliation.valuationScope !== VALUATION_VALUE_SCOPE.WHOLE_PROPERTY) {
    throw new C4GovernanceError('C4_WHOLE_PROPERTY_SCOPE_REQUIRED', 'reconciliation.valuationScope');
  }
  if (cleanString(reconciliation.propertyRef) !== propertyRef) {
    throw new C4GovernanceError('C4_PROPERTY_REF_MISMATCH', 'reconciliation.propertyRef');
  }
  if (normalizedIso(reconciliation.valuationDate, 'reconciliation.valuationDate') !== valuationDate) {
    throw new C4GovernanceError('C4_VALUATION_DATE_MISMATCH', 'reconciliation.valuationDate');
  }
  const asOfMs = toTimestamp(reconciliation.asOf, 'reconciliation.asOf');
  if (!(typeof maxReconciliationAgeHours === 'number' && Number.isFinite(maxReconciliationAgeHours) && maxReconciliationAgeHours > 0)) {
    throw new C4GovernanceError('C4_FRESHNESS_POLICY_INVALID', 'maxReconciliationAgeHours');
  }
  if (asOfMs > generatedAtMs) throw new C4GovernanceError('C4_RECONCILIATION_FROM_FUTURE');
  if ((generatedAtMs - asOfMs) > maxReconciliationAgeHours * HOUR_MS) {
    throw new C4GovernanceError('C4_RECONCILIATION_STALE');
  }
  if (reconciliation.dependencyStatus?.c1 !== 'READY' || reconciliation.dependencyStatus?.c2 !== 'READY') {
    throw new C4GovernanceError('C4_UPSTREAM_EVIDENCE_NOT_READY');
  }
  assertFalse(reconciliation.finalValuationConclusionEstablished, 'reconciliation.finalValuationConclusionEstablished', 'C4_UPSTREAM_FINAL_VALUATION_FORBIDDEN');
  assertFalse(reconciliation.certifiedValuationEstablished, 'reconciliation.certifiedValuationEstablished', 'C4_UPSTREAM_CERTIFIED_VALUATION_FORBIDDEN');
  assertFalse(reconciliation.transactionAuthorized, 'reconciliation.transactionAuthorized', 'C4_UPSTREAM_TRANSACTION_AUTHORITY_FORBIDDEN');
  assertFalse(reconciliation.publicAiAuthorized, 'reconciliation.publicAiAuthorized', 'C4_UPSTREAM_PUBLIC_AI_AUTHORITY_FORBIDDEN');
  if (!(typeof reconciliation.analyticalValueIndicationSar === 'number'
      && Number.isFinite(reconciliation.analyticalValueIndicationSar)
      && reconciliation.analyticalValueIndicationSar > 0)) {
    throw new C4GovernanceError('C4_ANALYTICAL_VALUE_INDICATION_INVALID');
  }
  if (!Array.isArray(reconciliation.eligibleMethodIndications) || reconciliation.eligibleMethodIndications.length === 0) {
    throw new C4GovernanceError('C4_METHOD_LINEAGE_REQUIRED');
  }
  for (const method of reconciliation.eligibleMethodIndications) {
    requiredObject(method, 'reconciliation.eligibleMethodIndications[]');
    requiredString(method.id, 'reconciliation.eligibleMethodIndications[].id');
    assertHash(method.calculationHashSha256, `method.${method.id}.calculationHashSha256`);
    assertHash(method.sourceResultHashSha256, `method.${method.id}.sourceResultHashSha256`);
  }
  const declaredHash = assertHash(reconciliation.resultHashSha256, 'reconciliation.resultHashSha256');
  const computedHash = computeC3ResultHash(reconciliation);
  if (declaredHash !== computedHash) throw new C4GovernanceError('C4_RECONCILIATION_HASH_MISMATCH');
  return { asOfMs, declaredHash };
}

function validateEvidenceLineage(evidenceLineage, reconciliation) {
  requiredObject(evidenceLineage, 'evidenceLineage');
  const c1ResultHashSha256 = assertHash(evidenceLineage.c1ResultHashSha256, 'evidenceLineage.c1ResultHashSha256');
  const c2ResultHashSha256 = assertHash(evidenceLineage.c2ResultHashSha256, 'evidenceLineage.c2ResultHashSha256');
  const reconciliationResultHashSha256 = assertHash(evidenceLineage.reconciliationResultHashSha256, 'evidenceLineage.reconciliationResultHashSha256');
  if (reconciliationResultHashSha256 !== reconciliation.resultHashSha256.toLowerCase()) {
    throw new C4GovernanceError('C4_LINEAGE_RECONCILIATION_HASH_MISMATCH');
  }
  if (!Array.isArray(evidenceLineage.sourceEvidenceHashes) || evidenceLineage.sourceEvidenceHashes.length === 0) {
    throw new C4GovernanceError('C4_SOURCE_EVIDENCE_HASHES_REQUIRED');
  }
  const sourceEvidenceHashes = evidenceLineage.sourceEvidenceHashes.map((value, index) => assertHash(value, `evidenceLineage.sourceEvidenceHashes[${index}]`));
  const methodMap = requiredObject(evidenceLineage.methodSourceResultHashesById, 'evidenceLineage.methodSourceResultHashesById');
  const expectedMethods = reconciliation.eligibleMethodIndications;
  if (Object.keys(methodMap).length !== expectedMethods.length) throw new C4GovernanceError('C4_METHOD_LINEAGE_CARDINALITY_MISMATCH');
  const methodSourceResultHashesById = {};
  for (const method of expectedMethods) {
    const declared = assertHash(methodMap[method.id], `evidenceLineage.methodSourceResultHashesById.${method.id}`);
    const expected = assertHash(method.sourceResultHashSha256, `reconciliation.method.${method.id}.sourceResultHashSha256`);
    if (declared !== expected) throw new C4GovernanceError('C4_METHOD_SOURCE_HASH_MISMATCH', method.id);
    methodSourceResultHashesById[method.id] = declared;
  }
  for (const id of Object.keys(methodMap)) {
    if (!expectedMethods.some((method) => method.id === id)) throw new C4GovernanceError('C4_UNKNOWN_METHOD_LINEAGE', id);
  }
  return {
    c1ResultHashSha256,
    c2ResultHashSha256,
    reconciliationResultHashSha256,
    sourceEvidenceHashes: [...new Set(sourceEvidenceHashes)].sort(),
    methodSourceResultHashesById,
  };
}

function validateHumanReview(humanReview, { reconciliationAsOfMs, generatedAtMs }) {
  if (humanReview === null || humanReview === undefined) return null;
  requiredObject(humanReview, 'humanReview');
  for (const forbidden of ['approved', 'approvalStatus', 'transactionAuthorized', 'commercialGoLive', 'finalValuationConclusionEstablished', 'certifiedValuationEstablished']) {
    if (Object.prototype.hasOwnProperty.call(humanReview, forbidden)) throw new C4GovernanceError('C4_REVIEW_AUTHORITY_FIELD_FORBIDDEN', `humanReview.${forbidden}`);
  }
  const reviewerId = requiredString(humanReview.reviewerId, 'humanReview.reviewerId');
  const recommendation = requiredString(humanReview.recommendation, 'humanReview.recommendation');
  if (!Object.values(C4_REVIEW_RECOMMENDATION).includes(recommendation)) {
    throw new C4GovernanceError('C4_REVIEW_RECOMMENDATION_INVALID', 'humanReview.recommendation');
  }
  const rationale = requiredString(humanReview.rationale, 'humanReview.rationale');
  const reviewedAtMs = toTimestamp(humanReview.reviewedAt, 'humanReview.reviewedAt');
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

function decisionCore(snapshot) {
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

function buildGovernedDealDecision({
  caseId,
  projectId,
  propertyRef,
  valuationDate,
  reconciliation,
  evidenceLineage,
  generatedAt,
  maxReconciliationAgeHours,
  humanReview = null,
} = {}) {
  const scopedCaseId = requiredString(caseId, 'caseId');
  const scopedProjectId = requiredString(projectId, 'projectId');
  const scopedPropertyRef = requiredString(propertyRef, 'propertyRef');
  const scopedValuationDate = normalizedIso(valuationDate, 'valuationDate');
  const generatedAtMs = toTimestamp(generatedAt, 'generatedAt');
  const reconciliationValidation = validateC3Reconciliation(reconciliation, {
    propertyRef: scopedPropertyRef,
    valuationDate: scopedValuationDate,
    generatedAtMs,
    maxReconciliationAgeHours,
  });
  const lineage = validateEvidenceLineage(evidenceLineage, reconciliation);
  const review = validateHumanReview(humanReview, {
    reconciliationAsOfMs: reconciliationValidation.asOfMs,
    generatedAtMs,
  });

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
      resultHashSha256: reconciliationValidation.declaredHash,
      status: reconciliation.status,
      asOf: new Date(reconciliationValidation.asOfMs).toISOString(),
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
  const allowedKeys = new Set([...Object.keys(decisionCore(snapshot)), 'snapshotHashSha256']);
  for (const key of Object.keys(snapshot)) {
    if (!allowedKeys.has(key)) throw new C4GovernanceError('C4_SNAPSHOT_FIELD_NOT_ALLOWED', key);
  }
  if (snapshot.schemaVersion !== C4_GOVERNED_DEAL_DECISION_SCHEMA_VERSION) throw new C4GovernanceError('C4_SNAPSHOT_SCHEMA_UNSUPPORTED');
  requiredString(snapshot.caseId, 'snapshot.caseId');
  requiredString(snapshot.projectId, 'snapshot.projectId');
  requiredString(snapshot.propertyRef, 'snapshot.propertyRef');
  normalizedIso(snapshot.valuationDate, 'snapshot.valuationDate');
  const generatedAtMs = toTimestamp(snapshot.generatedAt, 'snapshot.generatedAt');
  if (!(typeof snapshot.maxReconciliationAgeHours === 'number' && Number.isFinite(snapshot.maxReconciliationAgeHours) && snapshot.maxReconciliationAgeHours > 0)) {
    throw new C4GovernanceError('C4_FRESHNESS_POLICY_INVALID', 'snapshot.maxReconciliationAgeHours');
  }
  requiredObject(snapshot.reconciliationSummary, 'snapshot.reconciliationSummary');
  if (snapshot.reconciliationSummary.schemaVersion !== C3_VALUATION_RECONCILIATION_SCHEMA_VERSION
      || snapshot.reconciliationSummary.status !== RECONCILIATION_GATE_STATUS.READY
      || snapshot.reconciliationSummary.valuationScope !== VALUATION_VALUE_SCOPE.WHOLE_PROPERTY) {
    throw new C4GovernanceError('C4_SNAPSHOT_RECONCILIATION_NOT_QUALIFIED');
  }
  const reconciliationHash = assertHash(snapshot.reconciliationSummary.resultHashSha256, 'snapshot.reconciliationSummary.resultHashSha256');
  const lineage = requiredObject(snapshot.evidenceLineage, 'snapshot.evidenceLineage');
  assertHash(lineage.c1ResultHashSha256, 'snapshot.evidenceLineage.c1ResultHashSha256');
  assertHash(lineage.c2ResultHashSha256, 'snapshot.evidenceLineage.c2ResultHashSha256');
  if (assertHash(lineage.reconciliationResultHashSha256, 'snapshot.evidenceLineage.reconciliationResultHashSha256') !== reconciliationHash) {
    throw new C4GovernanceError('C4_LINEAGE_RECONCILIATION_HASH_MISMATCH');
  }
  if (!Array.isArray(lineage.sourceEvidenceHashes) || lineage.sourceEvidenceHashes.length === 0) throw new C4GovernanceError('C4_SOURCE_EVIDENCE_HASHES_REQUIRED');
  lineage.sourceEvidenceHashes.forEach((hash, index) => assertHash(hash, `snapshot.evidenceLineage.sourceEvidenceHashes[${index}]`));
  requiredObject(lineage.methodSourceResultHashesById, 'snapshot.evidenceLineage.methodSourceResultHashesById');
  for (const [id, hash] of Object.entries(lineage.methodSourceResultHashesById)) assertHash(hash, `snapshot.evidenceLineage.methodSourceResultHashesById.${id}`);

  const authority = requiredObject(snapshot.authorityBoundary, 'snapshot.authorityBoundary');
  if (authority.commercialGoLive !== 'HOLD') throw new C4GovernanceError('C4_COMMERCIAL_GO_LIVE_FORBIDDEN');
  for (const field of ['transactionAuthority', 'publicAi', 'canonicalBaselineActivationAuthorized', 'approvalAuthorized', 'finalValuationConclusionEstablished', 'certifiedValuationEstablished']) {
    if (authority[field] !== false) throw new C4GovernanceError('C4_AUTHORITY_ESCALATION_FORBIDDEN', `snapshot.authorityBoundary.${field}`);
  }
  if (snapshot.humanDecisionRequired !== true || snapshot.transactionReady !== false || snapshot.reportReady !== true) {
    throw new C4GovernanceError('C4_SNAPSHOT_SEMANTICS_INVALID');
  }
  const reconciliationAsOfMs = toTimestamp(snapshot.reconciliationSummary.asOf, 'snapshot.reconciliationSummary.asOf');
  if (reconciliationAsOfMs > generatedAtMs || (generatedAtMs - reconciliationAsOfMs) > snapshot.maxReconciliationAgeHours * HOUR_MS) {
    throw new C4GovernanceError('C4_SNAPSHOT_RECONCILIATION_STALE');
  }
  const review = validateHumanReview(snapshot.humanReview, { reconciliationAsOfMs, generatedAtMs });
  const expectedStatus = review ? C4_DECISION_STATUS.REVIEW_RECOMMENDATION_RECORDED : C4_DECISION_STATUS.READY_FOR_HUMAN_REVIEW;
  if (snapshot.status !== expectedStatus) throw new C4GovernanceError('C4_SNAPSHOT_REVIEW_STATUS_MISMATCH');
  const declaredHash = assertHash(snapshot.snapshotHashSha256, 'snapshot.snapshotHashSha256');
  const computedHash = sha256(decisionCore(snapshot));
  if (declaredHash !== computedHash) throw new C4GovernanceError('C4_SNAPSHOT_HASH_MISMATCH');
  return true;
}

function buildGovernedDealDecisionReport({ reportId, decisionSnapshot, generatedAt } = {}) {
  const scopedReportId = requiredString(reportId, 'reportId');
  validateGovernedDealDecisionSnapshot(decisionSnapshot);
  const generatedAtMs = toTimestamp(generatedAt, 'report.generatedAt');
  const decisionGeneratedAtMs = toTimestamp(decisionSnapshot.generatedAt, 'decisionSnapshot.generatedAt');
  if (generatedAtMs < decisionGeneratedAtMs) throw new C4GovernanceError('C4_REPORT_BEFORE_DECISION_SNAPSHOT');

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
    approval: {
      status: 'NOT_ESTABLISHED',
      authorized: false,
      transactionAuthorized: false,
    },
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
