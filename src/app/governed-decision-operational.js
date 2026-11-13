'use strict';

const { sha256Hex } = require('../crypto/sha256');
const {
  C4_REPORT_CLASSIFICATION,
  C4_AUTHORITY_BOUNDARY,
} = require('../contracts/governed-deal-decision');
const {
  validateGovernedDealDecisionSnapshot,
  buildGovernedDealDecisionReport,
} = require('../decision-intelligence/governed-deal-decision');

const C5_GOVERNED_EXPORT_SCHEMA_VERSION = 'C5_GOVERNED_DECISION_EXPORT_V1';
const HOUR_MS = 60 * 60 * 1000;

const C5_OPERATIONAL_STATUS = Object.freeze({
  READY_FOR_GOVERNED_EXPORT: 'READY_FOR_GOVERNED_EXPORT',
  HOLD_NOT_APPLICABLE: 'HOLD_NOT_APPLICABLE',
  HOLD_NO_GOVERNED_DECISION: 'HOLD_NO_GOVERNED_DECISION',
  HOLD_INVALID_GOVERNED_DECISION: 'HOLD_INVALID_GOVERNED_DECISION',
  HOLD_SCOPE_MISMATCH: 'HOLD_SCOPE_MISMATCH',
  HOLD_STALE: 'HOLD_STALE',
});

class C5OperationalError extends Error {
  constructor(code, field = null) {
    super(`${code}${field ? ` (${field})` : ''}`);
    this.name = 'C5OperationalError';
    this.code = code;
    this.field = field;
  }
}

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
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
  if (!isJsonSafe(value)) throw new C5OperationalError('C5_NON_JSON_SAFE_PAYLOAD');
  return sha256Hex(JSON.stringify(canonicalize(value)));
}

function toMs(value) {
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function normalizeAsOf(value) {
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  if (!Number.isFinite(ms)) throw new C5OperationalError('C5_AS_OF_INVALID');
  return { ms, iso: new Date(ms).toISOString() };
}

function savedDealStateCore(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) throw new C5OperationalError('C5_SAVED_DEAL_REQUIRED');
  const core = clone(record);
  delete core.governedDealDecision;
  // C6 review metadata is an immutable human-governance overlay. It must not
  // redefine the material economic/valuation state to which the C4 decision is
  // bound; otherwise merely recording a recommendation would invalidate the
  // same governed snapshot it references.
  delete core.governedHumanReview;
  delete core.name;
  delete core.savedAt;
  return core;
}

function computeSavedDealStateHash(record) {
  return sha256(savedDealStateCore(record));
}

function normalizeExpectedContext(expectedContext = {}) {
  if (!expectedContext || typeof expectedContext !== 'object' || Array.isArray(expectedContext)) {
    throw new C5OperationalError('C5_EXPECTED_CONTEXT_INVALID');
  }
  return {
    caseId: cleanString(expectedContext.caseId) || null,
    projectId: cleanString(expectedContext.projectId) || null,
    propertyRef: cleanString(expectedContext.propertyRef) || null,
  };
}

function fail(status, reasonCodes, details = {}) {
  return Object.freeze({
    schemaVersion: 1,
    status,
    ready: false,
    canExport: false,
    reasonCodes: Object.freeze([...new Set(reasonCodes)]),
    ...details,
    transactionAuthorized: false,
    approvalAuthorized: false,
    publicAiAuthorized: false,
    commercialGoLive: 'HOLD',
    certifiedValuationEstablished: false,
    finalValuationConclusionEstablished: false,
    humanDecisionRequired: true,
  });
}

function evaluateGovernedDecisionOperationalState({ savedDealRecord, expectedContext = {}, asOf = new Date() } = {}) {
  const now = normalizeAsOf(asOf);
  if (!savedDealRecord || typeof savedDealRecord !== 'object' || Array.isArray(savedDealRecord)) {
    return fail(C5_OPERATIONAL_STATUS.HOLD_INVALID_GOVERNED_DECISION, ['C5_SAVED_DEAL_REQUIRED']);
  }
  if (savedDealRecord.mode !== 'building') {
    return fail(C5_OPERATIONAL_STATUS.HOLD_NOT_APPLICABLE, ['C5_GOVERNED_DECISION_REQUIRES_BUILDING_MODE'], {
      savedDealId: cleanString(savedDealRecord.id) || null,
    });
  }
  if (!Object.prototype.hasOwnProperty.call(savedDealRecord, 'governedDealDecision')) {
    return fail(C5_OPERATIONAL_STATUS.HOLD_NO_GOVERNED_DECISION, ['C5_GOVERNED_DECISION_NOT_ATTACHED'], {
      savedDealId: cleanString(savedDealRecord.id) || null,
    });
  }

  const snapshot = savedDealRecord.governedDealDecision;
  try {
    validateGovernedDealDecisionSnapshot(snapshot);
  } catch (error) {
    return fail(C5_OPERATIONAL_STATUS.HOLD_INVALID_GOVERNED_DECISION, [error.code || 'C5_GOVERNED_DECISION_INVALID'], {
      savedDealId: cleanString(savedDealRecord.id) || null,
    });
  }

  const reasons = [];
  const context = normalizeExpectedContext(expectedContext);
  if (context.caseId && context.caseId !== snapshot.caseId) reasons.push('C5_CASE_ID_MISMATCH');
  if (context.projectId && context.projectId !== snapshot.projectId) reasons.push('C5_PROJECT_ID_MISMATCH');
  if (context.propertyRef && context.propertyRef !== snapshot.propertyRef) reasons.push('C5_PROPERTY_REF_MISMATCH');

  if (!savedDealRecord.valuationCase || typeof savedDealRecord.valuationCase !== 'object' || Array.isArray(savedDealRecord.valuationCase)) {
    reasons.push('C5_VALUATION_CASE_REQUIRED_FOR_UI_BINDING');
  } else if (cleanString(savedDealRecord.valuationCase.projectId) !== snapshot.projectId) {
    reasons.push('C5_VALUATION_CASE_PROJECT_MISMATCH');
  }

  if (reasons.length) {
    return fail(C5_OPERATIONAL_STATUS.HOLD_SCOPE_MISMATCH, reasons, {
      savedDealId: cleanString(savedDealRecord.id) || null,
      caseId: snapshot.caseId,
      projectId: snapshot.projectId,
      propertyRef: snapshot.propertyRef,
      snapshotHashSha256: snapshot.snapshotHashSha256,
    });
  }

  const generatedAtMs = toMs(snapshot.generatedAt);
  const reconciliationAsOfMs = toMs(snapshot.reconciliationSummary?.asOf);
  if (generatedAtMs === null || reconciliationAsOfMs === null) {
    return fail(C5_OPERATIONAL_STATUS.HOLD_INVALID_GOVERNED_DECISION, ['C5_SNAPSHOT_TIME_INVALID']);
  }
  const freshnessLimitMs = snapshot.maxReconciliationAgeHours * HOUR_MS;
  const freshnessReasons = [];
  if (generatedAtMs > now.ms) freshnessReasons.push('C5_SNAPSHOT_FROM_FUTURE');
  if (reconciliationAsOfMs > now.ms) freshnessReasons.push('C5_RECONCILIATION_FROM_FUTURE');
  if (now.ms - reconciliationAsOfMs > freshnessLimitMs) freshnessReasons.push('C5_RECONCILIATION_STALE_NOW');
  if (freshnessReasons.length) {
    return fail(C5_OPERATIONAL_STATUS.HOLD_STALE, freshnessReasons, {
      savedDealId: cleanString(savedDealRecord.id) || null,
      caseId: snapshot.caseId,
      projectId: snapshot.projectId,
      propertyRef: snapshot.propertyRef,
      snapshotHashSha256: snapshot.snapshotHashSha256,
      reconciliationAsOf: snapshot.reconciliationSummary.asOf,
      maxReconciliationAgeHours: snapshot.maxReconciliationAgeHours,
      evaluatedAt: now.iso,
    });
  }

  const dealStateHashSha256 = computeSavedDealStateHash(savedDealRecord);
  return Object.freeze({
    schemaVersion: 1,
    status: C5_OPERATIONAL_STATUS.READY_FOR_GOVERNED_EXPORT,
    ready: true,
    canExport: true,
    reasonCodes: Object.freeze([]),
    savedDealId: cleanString(savedDealRecord.id) || null,
    caseId: snapshot.caseId,
    projectId: snapshot.projectId,
    propertyRef: snapshot.propertyRef,
    valuationDate: snapshot.valuationDate,
    snapshotStatus: snapshot.status,
    snapshotHashSha256: snapshot.snapshotHashSha256,
    dealStateHashSha256,
    reconciliationAsOf: snapshot.reconciliationSummary.asOf,
    maxReconciliationAgeHours: snapshot.maxReconciliationAgeHours,
    evaluatedAt: now.iso,
    analyticalValueIndicationSar: snapshot.reconciliationSummary.analyticalValueIndicationSar,
    analyticalRangeLowSar: snapshot.reconciliationSummary.analyticalRangeLowSar,
    analyticalRangeHighSar: snapshot.reconciliationSummary.analyticalRangeHighSar,
    analyticalConfidenceClass: snapshot.reconciliationSummary.analyticalConfidenceClass,
    eligibleMethodCount: snapshot.reconciliationSummary.eligibleMethodCount,
    eligibleApproachFamilies: Object.freeze([...(snapshot.reconciliationSummary.eligibleApproachFamilies || [])]),
    reviewerRecommendation: snapshot.humanReview ? snapshot.humanReview.recommendation : null,
    reviewerId: snapshot.humanReview ? snapshot.humanReview.reviewerId : null,
    approvalStatus: 'NOT_ESTABLISHED',
    transactionAuthorized: false,
    approvalAuthorized: false,
    publicAiAuthorized: false,
    commercialGoLive: 'HOLD',
    certifiedValuationEstablished: false,
    finalValuationConclusionEstablished: false,
    humanDecisionRequired: true,
    reportClassification: C4_REPORT_CLASSIFICATION.NON_AUTHORIZING_ANALYTICAL_OUTPUT,
  });
}

function exportCore(envelope) {
  const { exportHashSha256: _discarded, ...core } = envelope;
  return core;
}

function buildGovernedDecisionOperationalExport({
  savedDealRecord,
  expectedContext = {},
  reportId,
  generatedAt = new Date(),
} = {}) {
  const generated = normalizeAsOf(generatedAt);
  const operational = evaluateGovernedDecisionOperationalState({
    savedDealRecord,
    expectedContext,
    asOf: generated.iso,
  });
  if (!operational.canExport) throw new C5OperationalError('C5_EXPORT_BLOCKED', operational.reasonCodes.join(','));

  const report = buildGovernedDealDecisionReport({
    reportId: cleanString(reportId) || `C5-${operational.caseId}-${generated.iso}`,
    decisionSnapshot: savedDealRecord.governedDealDecision,
    generatedAt: generated.iso,
  });
  if (report.classification !== C4_REPORT_CLASSIFICATION.NON_AUTHORIZING_ANALYTICAL_OUTPUT) {
    throw new C5OperationalError('C5_REPORT_CLASSIFICATION_INVALID');
  }

  const core = {
    schemaVersion: C5_GOVERNED_EXPORT_SCHEMA_VERSION,
    classification: C4_REPORT_CLASSIFICATION.NON_AUTHORIZING_ANALYTICAL_OUTPUT,
    generatedAt: generated.iso,
    sourceSavedDealId: operational.savedDealId,
    savedDealStateHashSha256: operational.dealStateHashSha256,
    decisionSnapshotHashSha256: operational.snapshotHashSha256,
    governedReportHashSha256: report.reportHashSha256,
    caseId: operational.caseId,
    projectId: operational.projectId,
    propertyRef: operational.propertyRef,
    valuationDate: operational.valuationDate,
    reviewerRecommendation: operational.reviewerRecommendation,
    approvalStatus: 'NOT_ESTABLISHED',
    report,
    authorityBoundary: { ...C4_AUTHORITY_BOUNDARY },
    humanDecisionRequired: true,
    exportEligible: true,
    transactionAuthorized: false,
    approvalAuthorized: false,
    publicAiAuthorized: false,
    commercialGoLive: 'HOLD',
    certifiedValuationEstablished: false,
    finalValuationConclusionEstablished: false,
    disclosures: Object.freeze([
      'NON_AUTHORIZING_ANALYTICAL_OUTPUT',
      'NOT_A_FINAL_OR_CERTIFIED_VALUATION',
      'REVIEWER_RECOMMENDATION_DOES_NOT_EQUAL_APPROVAL',
      'SEPARATE_HUMAN_APPROVAL_REQUIRED',
      'TRANSACTION_AUTHORITY_FALSE',
      'PUBLIC_AI_FALSE',
      'COMMERCIAL_GO_LIVE_HOLD',
    ]),
    semantics: 'C5 operational export packages a currently valid saved-deal C4 analytical snapshot and governed C4 report for human review. It does not authorize a transaction, approval, commercial go-live, public AI, or a final/licensed/certified valuation.',
  };
  return Object.freeze({ ...core, exportHashSha256: sha256(core) });
}

function verifyGovernedDecisionOperationalExport(envelope) {
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) return false;
  if (envelope.schemaVersion !== C5_GOVERNED_EXPORT_SCHEMA_VERSION) return false;
  if (envelope.classification !== C4_REPORT_CLASSIFICATION.NON_AUTHORIZING_ANALYTICAL_OUTPUT) return false;
  if (!envelope.authorityBoundary || envelope.authorityBoundary.commercialGoLive !== 'HOLD') return false;
  for (const field of ['transactionAuthority', 'publicAi', 'canonicalBaselineActivationAuthorized', 'approvalAuthorized', 'finalValuationConclusionEstablished', 'certifiedValuationEstablished']) {
    if (envelope.authorityBoundary[field] !== false) return false;
  }
  if (envelope.transactionAuthorized !== false || envelope.approvalAuthorized !== false || envelope.publicAiAuthorized !== false) return false;
  if (envelope.commercialGoLive !== 'HOLD' || envelope.certifiedValuationEstablished !== false || envelope.finalValuationConclusionEstablished !== false) return false;
  if (envelope.approvalStatus !== 'NOT_ESTABLISHED' || envelope.humanDecisionRequired !== true || envelope.exportEligible !== true) return false;
  if (!/^[a-f0-9]{64}$/i.test(cleanString(envelope.exportHashSha256))) return false;
  try {
    return sha256(exportCore(envelope)) === envelope.exportHashSha256.toLowerCase();
  } catch (_) {
    return false;
  }
}

module.exports = {
  C5_GOVERNED_EXPORT_SCHEMA_VERSION,
  C5_OPERATIONAL_STATUS,
  C5OperationalError,
  computeSavedDealStateHash,
  evaluateGovernedDecisionOperationalState,
  buildGovernedDecisionOperationalExport,
  verifyGovernedDecisionOperationalExport,
};
