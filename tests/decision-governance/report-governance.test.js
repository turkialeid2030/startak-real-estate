'use strict';

const assert = require('assert');
const { recommendationMethodologyMetadata } = require('../../src/decision-governance/methodology-metadata');
const { createGovernedReportPayload } = require('../../src/decision-governance/report-governance');

const base = {
  dealId: 'deal-1', versionId: 'v1', generatedAt: '2026-09-15T12:00:00.000Z',
  modelVersion: recommendationMethodologyMetadata.modelVersion,
  financialStatus: 'PASS', overallDecision: 'DUE_DILIGENCE_REQUIRED', evidenceStatus: 'SUFFICIENT_FOR_ANALYSIS',
  legalStatus: 'PENDING', regulatoryStatus: 'PENDING', technicalStatus: 'PASS',
  criticalMissing: ['LEGAL_DD'], keyAssumptions: { discountRate: 0.1 },
  dataSources: [{ sourceName: 'Official registry', sourceDate: '2026-09-01', reference: 'registry-ref' }],
  scenario: { base: 'BASE', upside: 'UPSIDE', downside: 'DOWNSIDE' },
};

let report = createGovernedReportPayload(base);
assert.strictEqual(report.financialStatus, 'PASS');
assert.strictEqual(report.overallDecision, 'DUE_DILIGENCE_REQUIRED');
assert.strictEqual(report.transactionAuthority, 'ANALYSIS_ONLY');
assert.strictEqual(report.formalValuationAuthority, false);
assert.strictEqual(report.disclaimerScope.ar, recommendationMethodologyMetadata.scopeNotice.ar);
assert.strictEqual(report.disclaimerScope.en, recommendationMethodologyMetadata.scopeNotice.en);

assert.throws(() => createGovernedReportPayload({ ...base, overallDecision: 'INVESTMENT_APPROVED' }),
  (error) => error && error.code === 'REPORT_APPROVAL_LABEL_FORBIDDEN');
assert.throws(() => createGovernedReportPayload({ ...base, modelVersion: 'stale-model' }),
  (error) => error && error.code === 'REPORT_MODEL_VERSION_MISMATCH');
assert.throws(() => createGovernedReportPayload({ ...base, dataSources: [{ sourceName: 'Unknown date' }] }),
  (error) => error && error.code === 'REPORT_SOURCE_DATE_REQUIRED');
assert.throws(() => createGovernedReportPayload({ ...base, evidenceStatus: null }),
  (error) => error && error.code === 'GOVERNED_REPORT_FIELDS_MISSING');

report = createGovernedReportPayload({ ...base, financialStatus: 'FAIL', overallDecision: 'REJECT' });
assert.strictEqual(report.overallDecision, 'REJECT');

console.log('REPORT_GOVERNANCE_TESTS=PASS');
