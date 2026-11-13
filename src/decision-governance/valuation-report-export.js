'use strict';

const { createGovernedReportPayload } = require('./report-governance');
const { recommendationMethodologyMetadata } = require('./methodology-metadata');
const { evaluateValuationEvidenceFreshness } = require('./valuation-data-freshness');
const { AUDIT_ACTION, createAuditEvent } = require('./audit-trail');

function requireObject(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${field} must be an object`);
  return value;
}

function valuationDataSources(valuationCase) {
  const evidence = valuationCase && valuationCase.evidence && typeof valuationCase.evidence === 'object' && !Array.isArray(valuationCase.evidence)
    ? valuationCase.evidence
    : {};
  return Object.entries(evidence)
    .filter(([, descriptor]) => descriptor && typeof descriptor === 'object' && !Array.isArray(descriptor))
    .map(([field, descriptor]) => ({
      sourceName: descriptor.sourceType || field,
      sourceDate: descriptor.observedAt || null,
      sourceReference: descriptor.sourceRef || null,
      evidenceField: field,
      evidenceGrade: descriptor.grade || null,
      evidenceInputStatus: descriptor.status || null,
    }));
}

function evaluateGovernedValuationReportReadiness({ runtime, valuationCase, asOf = new Date().toISOString() } = {}) {
  if (!runtime || typeof runtime !== 'object' || Array.isArray(runtime) || !runtime.stage) {
    return Object.freeze({ ready: false, reasonCode: 'VALUATION_RUNTIME_REQUIRED', freshness: null });
  }
  if (!valuationCase || typeof valuationCase !== 'object' || Array.isArray(valuationCase)) {
    return Object.freeze({ ready: false, reasonCode: 'VALUATION_CASE_REQUIRED', freshness: null });
  }
  // A dated descriptor is not evidence for an unrelated case or tenant.
  // Bind the report to the *same* named case before considering source age.
  const validRef = (value) => typeof value === 'string' && value.trim().length > 0 && value.trim() === value;
  if (!validRef(runtime.caseId) || !validRef(valuationCase.caseId)) {
    return Object.freeze({ ready: false, reasonCode: 'REPORT_CASE_BINDING_REQUIRED', freshness: null });
  }
  if (runtime.caseId !== valuationCase.caseId) {
    return Object.freeze({ ready: false, reasonCode: 'REPORT_CASE_BINDING_MISMATCH', freshness: null });
  }
  // If either side supplies an organization/project binding, both must agree.
  if (runtime.projectId != null || valuationCase.projectId != null) {
    if (!validRef(runtime.projectId) || !validRef(valuationCase.projectId)) {
      return Object.freeze({ ready: false, reasonCode: 'REPORT_PROJECT_BINDING_REQUIRED', freshness: null });
    }
    if (runtime.projectId !== valuationCase.projectId) {
      return Object.freeze({ ready: false, reasonCode: 'REPORT_PROJECT_BINDING_MISMATCH', freshness: null });
    }
  }

  // Unnamed or unreferenced evidence must never be laundered into a
  // source-backed market report by virtue of having a recent date.
  const records = valuationCase.evidence;
  if (!records || typeof records !== 'object' || Array.isArray(records)) {
    return Object.freeze({ ready: false, reasonCode: 'VALUATION_EVIDENCE_REQUIRED', freshness: null });
  }
  for (const descriptor of Object.values(records)) {
    if (!descriptor || typeof descriptor !== 'object' || Array.isArray(descriptor)) {
      return Object.freeze({ ready: false, reasonCode: 'REPORT_EVIDENCE_DESCRIPTOR_INVALID', freshness: null });
    }
    if (!validRef(descriptor.sourceType) || !validRef(descriptor.sourceRef)) {
      return Object.freeze({ ready: false, reasonCode: 'REPORT_EVIDENCE_SOURCE_PROVENANCE_REQUIRED', freshness: null });
    }
    // A declared VERIFIED flag is only a preflight field, not independent
    // authentication of land registry / agency sources or commercial rights.
    if (descriptor.status !== 'VERIFIED') {
      return Object.freeze({ ready: false, reasonCode: 'REPORT_EVIDENCE_STATUS_NOT_VERIFIED', freshness: null });
    }
  }
  const freshness = evaluateValuationEvidenceFreshness(valuationCase, { asOf });
  if (freshness.evidenceCount === 0) {
    return Object.freeze({ ready: false, reasonCode: 'VALUATION_EVIDENCE_REQUIRED', freshness });
  }
  // Source names and dates are not sufficient when a record is stale,
  // future-dated or unparseable. Future dates otherwise appeared "CURRENT"
  // in the historic age clamping logic.
  if (freshness.items.some((item) => item.freshnessStatus === 'STALE')) {
    return Object.freeze({ ready: false, reasonCode: 'REPORT_STALE_MARKET_SOURCE', freshness });
  }
  if (freshness.items.some((item) => item.freshnessStatus === 'UNKNOWN')) {
    return Object.freeze({ ready: false, reasonCode: 'REPORT_SOURCE_DATE_UNVERIFIED_OR_FUTURE', freshness });
  }
  if (!freshness.allMaterialSourcesDated) {
    return Object.freeze({ ready: false, reasonCode: 'REPORT_SOURCE_DATE_REQUIRED', freshness });
  }
  return Object.freeze({ ready: true, reasonCode: null, freshness });
}

function buildGovernedValuationReport({ runtime, valuationCase, generatedAt = new Date().toISOString() } = {}) {
  requireObject(runtime, 'runtime');
  requireObject(runtime.stage, 'runtime.stage');
  requireObject(valuationCase, 'valuationCase');
  const readiness = evaluateGovernedValuationReportReadiness({ runtime, valuationCase, asOf: generatedAt });
  if (!readiness.ready) {
    const error = new Error(`Governed valuation report is not ready: ${readiness.reasonCode}`);
    error.code = readiness.reasonCode;
    error.readiness = readiness;
    throw error;
  }

  const stage = runtime.stage;
  const dataSources = valuationDataSources(valuationCase);
  const report = createGovernedReportPayload({
    dealId: runtime.caseId,
    versionId: `${runtime.caseId}:${generatedAt}`,
    generatedAt,
    modelVersion: recommendationMethodologyMetadata.modelVersion,
    financialStatus: 'NOT_EVALUATED_IN_VALUATION_EXPORT',
    overallDecision: 'INCOMPLETE',
    evidenceStatus: stage.status || 'UNKNOWN',
    legalStatus: 'NOT_EVALUATED',
    regulatoryStatus: 'NOT_EVALUATED',
    technicalStatus: 'NOT_EVALUATED',
    criticalMissing: [...(stage.evidenceGaps || [])],
    keyAssumptions: {
      valuationMode: runtime.mode || null,
      projectId: runtime.projectId || null,
      humanDecisionRequired: stage.humanDecisionRequired !== false,
    },
    dataSources,
    scenario: {
      valuationStageStatus: stage.status || null,
      finalValue: stage.finalValue == null ? null : stage.finalValue,
      readyForDecisionControl: Boolean(stage.readyForDecisionControl),
      reasonCodes: [...(stage.reasonCodes || [])],
    },
    transactionAuthority: 'ANALYSIS_ONLY',
  });

  const localAuditEvent = createAuditEvent({
    dealId: report.dealId,
    versionId: report.versionId,
    timestamp: generatedAt,
    actionType: AUDIT_ACTION.EXPORT_CREATED,
    changedFields: [],
    modelVersion: report.modelVersion,
    assumptionVersion: report.modelVersion,
    reason: 'GOVERNED_VALUATION_REPORT_EXPORT',
  });

  return Object.freeze({ ...report, localAuditEvent });
}

module.exports = {
  valuationDataSources,
  evaluateGovernedValuationReportReadiness,
  buildGovernedValuationReport,
};
