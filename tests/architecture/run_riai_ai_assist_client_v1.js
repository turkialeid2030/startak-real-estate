'use strict';

const assert = require('assert');
const {
  AI_ASSIST_ENDPOINT,
  AI_ASSIST_CLIENT_STATUS,
  requestResidentialIncomeAiAssist,
} = require('../../src/residential-income-acquisition/ai-assist-client');

const viewModel = {
  apiStatus: 'CASE_LOADED',
  asOfDate: '2026-09-03',
  readinessStatus: 'NEEDS_DUE_DILIGENCE',
  summary: { unitCount: 2, leaseCount: 1, tenantCount: 1, evidenceLineageCount: 4 },
  blockers: [], evidenceGaps: [], dueDiligence: [],
  acquisitionAnalyticalScore: { status: 'CALCULATED', score: 75, scoreCoverage: 1, evidenceConfidence: 0.8, redFlags: [], components: [] },
  lifecycleLocationUpside: null,
  reverseUnderwriting: null,
  exitStrategyComparison: null,
  scenarioIntegration: null,
  rawOperatingCase: { tenant: 'PRIVATE TENANT', address: 'PRIVATE ADDRESS' },
};

let capturedUrl = null;
let capturedOptions = null;
const fetchImpl = async (url, options) => {
  capturedUrl = url;
  capturedOptions = options;
  return {
    ok: true,
    status: 200,
    async json() {
      return {
        ok: true,
        aiModelUsed: true,
        model: 'configured-model',
        generatedAt: '2026-09-03T00:00:00.000Z',
        advisoryOnly: true,
        deterministicScoreRemainsAuthoritative: true,
        result: {
          executiveObservations: ['The evidence package is usable but still requires explicit diligence confirmation.'],
          riskFlags: [],
          evidenceGaps: [],
          dueDiligenceQuestions: ['Which independent source confirms the principal underwriting assumptions?'],
          scenarioChecks: ['Confirm the selected benchmark scenario remains internally consistent.'],
          earlyWarningIndicators: [{ indicator: 'Evidence confidence', whyItMatters: 'A decline would weaken the reliability of the analytical narrative.' }],
          decisionBoundary: 'Advisory narrative only; no transaction is authorized.',
        },
      };
    },
  };
};

(async () => {
  const result = await requestResidentialIncomeAiAssist(viewModel, { fetchImpl, timeoutMs: 5000 });
  assert.strictEqual(result.status, AI_ASSIST_CLIENT_STATUS.SUCCESS);
  assert.strictEqual(result.aiModelUsed, true);
  assert.strictEqual(result.deterministicScoreRemainsAuthoritative, true);
  assert.strictEqual(result.result.investmentRecommendation, null);
  assert.strictEqual(result.result.legalConclusion, null);
  assert.strictEqual(capturedUrl, AI_ASSIST_ENDPOINT);
  assert.strictEqual(capturedUrl, '/api/riai/ai-assist');
  assert.strictEqual(capturedOptions.method, 'POST');
  assert.strictEqual(capturedOptions.credentials, 'same-origin');
  assert.strictEqual(capturedOptions.cache, 'no-store');
  const sent = capturedOptions.body;
  assert(sent.includes('RESIDENTIAL_INCOME_ACQUISITION_AI_ASSIST'));
  assert(!sent.includes('PRIVATE TENANT'));
  assert(!sent.includes('PRIVATE ADDRESS'));
  assert(!sent.includes('rawOperatingCase'));

  const notReady = await requestResidentialIncomeAiAssist({ apiStatus: 'NOT_LOADED' }, { fetchImpl });
  assert.strictEqual(notReady.status, AI_ASSIST_CLIENT_STATUS.NOT_READY);
  assert.strictEqual(notReady.aiModelUsed, false);

  const unavailable = await requestResidentialIncomeAiAssist(viewModel, {
    fetchImpl: async () => ({ ok: false, status: 503, async json() { return { ok: false, code: 'AI_PROVIDER_NOT_CONFIGURED' }; } }),
  });
  assert.strictEqual(unavailable.status, AI_ASSIST_CLIENT_STATUS.UNAVAILABLE);
  assert.strictEqual(unavailable.reasonCode, 'AI_PROVIDER_NOT_CONFIGURED');
  assert.strictEqual(unavailable.aiModelUsed, false);

  console.log('RIAI_AI_ASSIST_CLIENT_V1=PASS');
  console.log('SAME_ORIGIN_AI_ENDPOINT_ONLY=PASS');
  console.log('RAW_CASE_AND_PII_NOT_TRANSMITTED=PASS');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
