'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  evaluateGovernedValuationReportReadiness,
  buildGovernedValuationReport,
} = require('../../src/decision-governance/valuation-report-export');
const { recommendationMethodologyMetadata } = require('../../src/decision-governance/methodology-metadata');

const runtime = {
  mode: 'VALUATION_V1',
  caseId: 'CASE-REPORT-1',
  projectId: 'PROJECT-1',
  stage: {
    status: 'READY_FOR_DECISION_CONTROL',
    evidenceGaps: [],
    finalValue: 120000000,
    readyForDecisionControl: true,
    reasonCodes: [],
    humanDecisionRequired: true,
    transactionAuthorized: false,
  },
};

const valuationCase = {
  projectId: 'PROJECT-1',
  evidence: {
    income: {
      grade: 'C_CONTRACTUAL',
      status: 'VERIFIED',
      sourceType: 'LEASE_LEDGER',
      sourceRef: 'LEASE-001',
      observedAt: '2026-09-10',
    },
    capRate: {
      grade: 'E_MARKET_OBSERVATION',
      status: 'OBSERVED',
      sourceType: 'MARKET_OBSERVATION',
      sourceRef: 'CAP-001',
      observedAt: '2026-09-12',
    },
  },
};

const generatedAt = '2026-09-16T11:30:00.000Z';
const readiness = evaluateGovernedValuationReportReadiness({ runtime, valuationCase, asOf: generatedAt });
assert.strictEqual(readiness.ready, true);
assert.strictEqual(readiness.reasonCode, null);

const report = buildGovernedValuationReport({ runtime, valuationCase, generatedAt });
assert.strictEqual(report.dealId, runtime.caseId);
assert.strictEqual(report.modelVersion, recommendationMethodologyMetadata.modelVersion);
assert.strictEqual(report.financialStatus, 'NOT_EVALUATED_IN_VALUATION_EXPORT');
assert.strictEqual(report.overallDecision, 'INCOMPLETE');
assert.strictEqual(report.transactionAuthority, 'ANALYSIS_ONLY');
assert.strictEqual(report.formalValuationAuthority, false);
assert.strictEqual(report.legalStatus, 'NOT_EVALUATED');
assert.strictEqual(report.regulatoryStatus, 'NOT_EVALUATED');
assert.strictEqual(report.technicalStatus, 'NOT_EVALUATED');
assert.strictEqual(report.dataSources.length, 2);
assert.ok(report.disclaimerScope.ar.includes('لا تمثل اعتمادًا قانونيًا'));
assert.ok(report.disclaimerScope.en.includes('not legal or regulatory approval'));

const missingDateCase = {
  ...valuationCase,
  evidence: {
    ...valuationCase.evidence,
    capRate: { ...valuationCase.evidence.capRate, observedAt: null },
  },
};
const blocked = evaluateGovernedValuationReportReadiness({ runtime, valuationCase: missingDateCase, asOf: generatedAt });
assert.strictEqual(blocked.ready, false);
assert.strictEqual(blocked.reasonCode, 'REPORT_SOURCE_DATE_REQUIRED');
assert.throws(
  () => buildGovernedValuationReport({ runtime, valuationCase: missingDateCase, generatedAt }),
  (error) => error && error.code === 'REPORT_SOURCE_DATE_REQUIRED',
);

const panelSource = fs.readFileSync(path.join(__dirname, '../../src/components/ValuationIntelligencePanel.jsx'), 'utf8');
assert.ok(panelSource.includes("import GovernedReportExportPanel from './GovernedReportExportPanel.jsx'"));
assert.ok(panelSource.includes('<GovernedReportExportPanel'));

console.log('VALUATION_REPORT_EXPORT_INTEGRATION_TESTS=PASS');
