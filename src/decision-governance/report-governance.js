'use strict';

const { recommendationMethodologyMetadata } = require('./methodology-metadata');

const REPORT_REQUIRED_FIELDS = Object.freeze([
  'dealId', 'versionId', 'generatedAt', 'modelVersion', 'financialStatus', 'overallDecision',
  'evidenceStatus', 'legalStatus', 'regulatoryStatus', 'technicalStatus', 'criticalMissing',
  'keyAssumptions', 'dataSources', 'scenario',
]);

const FORBIDDEN_APPROVAL_LABELS = Object.freeze([
  'INVESTMENT_APPROVED', 'APPROVED_FOR_INVESTMENT', 'TRANSACTION_AUTHORIZED', 'EXECUTION_AUTHORIZED',
]);

function validDate(value) { return typeof value === 'string' && Number.isFinite(new Date(value).getTime()); }

function createGovernedReportPayload(input = {}) {
  const missing = REPORT_REQUIRED_FIELDS.filter((key) => input[key] == null || input[key] === '');
  if (missing.length) {
    const error = new Error(`Missing governed report fields: ${missing.join(', ')}`);
    error.code = 'GOVERNED_REPORT_FIELDS_MISSING';
    error.missingFields = Object.freeze(missing);
    throw error;
  }
  if (!validDate(input.generatedAt)) throw new TypeError('generatedAt must be a valid date');
  if (input.modelVersion !== recommendationMethodologyMetadata.modelVersion) {
    const error = new Error('Report modelVersion must match active methodology metadata');
    error.code = 'REPORT_MODEL_VERSION_MISMATCH';
    throw error;
  }
  const overall = String(input.overallDecision).toUpperCase();
  if (FORBIDDEN_APPROVAL_LABELS.includes(overall)) {
    const error = new Error('Report cannot export an execution or investment approval label');
    error.code = 'REPORT_APPROVAL_LABEL_FORBIDDEN';
    throw error;
  }
  const sourceDatesMissing = (input.dataSources || []).filter((source) => !source || !source.sourceName || !source.sourceDate);
  if (sourceDatesMissing.length) {
    const error = new Error('Every report data source requires sourceName and sourceDate');
    error.code = 'REPORT_SOURCE_DATE_REQUIRED';
    throw error;
  }
  return Object.freeze({
    dealId: input.dealId,
    versionId: input.versionId,
    generatedAt: input.generatedAt,
    modelVersion: input.modelVersion,
    financialStatus: input.financialStatus,
    overallDecision: input.overallDecision,
    evidenceStatus: input.evidenceStatus,
    legalStatus: input.legalStatus,
    regulatoryStatus: input.regulatoryStatus,
    technicalStatus: input.technicalStatus,
    criticalMissing: Object.freeze([...(input.criticalMissing || [])]),
    keyAssumptions: Object.freeze({ ...(input.keyAssumptions || {}) }),
    dataSources: Object.freeze((input.dataSources || []).map((source) => Object.freeze({ ...source }))),
    scenario: Object.freeze({ ...(input.scenario || {}) }),
    disclaimerScope: recommendationMethodologyMetadata.scopeNotice,
    transactionAuthority: input.transactionAuthority || 'ANALYSIS_ONLY',
    formalValuationAuthority: false,
  });
}

module.exports = { REPORT_REQUIRED_FIELDS, FORBIDDEN_APPROVAL_LABELS, createGovernedReportPayload };
