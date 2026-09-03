'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  AI_ASSIST_STATUS,
  buildResidentialIncomeAiDecisionSnapshot,
  validateResidentialIncomeAiAssistResponse,
} = require('../../src/residential-income-acquisition/ai-assist-contract');

const root = path.join(__dirname, '..', '..');
const gateway = fs.readFileSync(path.join(root, 'functions/api/riai/ai-assist.js'), 'utf8');

const viewModel = {
  apiStatus: 'CASE_LOADED',
  asOfDate: '2026-09-03',
  readinessStatus: 'NEEDS_DUE_DILIGENCE',
  summary: { unitCount: 10, leaseCount: 9, tenantCount: 8, evidenceLineageCount: 22 },
  blockers: [{ code: 'TITLE_EVIDENCE_REQUIRED', field: 'propertyInterest.title' }],
  evidenceGaps: [{ code: 'MARKET_RENT_EVIDENCE_REQUIRED', field: 'unit.*.marketRent' }],
  dueDiligence: [{ code: 'VERIFY_LEASES' }],
  acquisitionAnalyticalScore: {
    status: 'CALCULATED_WITH_GAPS', score: 71.5, scoreCoverage: 0.85, evidenceConfidence: 0.62,
    redFlags: [{ code: 'PURCHASE_PRICE_ABOVE_ANALYTICAL_LIMIT', severity: 'HIGH', amount: 1000000 }],
    components: [{ key: 'priceDiscipline', score: 80, weight: 0.15, status: 'SCORED' }],
  },
  lifecycleLocationUpside: {
    lifecycle: { status: 'CALCULATED', metrics: { weightedConditionScore: 76, criticalComponentsDueWithin3y: 1, replacementCapexWithin3y: 500000, replacementCapexWithin5y: 900000 } },
    location: { status: 'CALCULATED', currentLocationScore: 82, evidenceCoverage: 0.75 },
    forwardAttraction: { status: 'CALCULATED', attractionDirection: 'POSITIVE', forwardAttractionScore: 20, catalysts: [{ catalystId: 'METRO' }] },
    upside: { status: 'CALCULATED_WITH_GAPS', metrics: { eligibleCatalystCount: 2, verifiedFeasibleCount: 1, regulatoryVerificationRequiredCount: 1, prohibitedCount: 0 } },
  },
  reverseUnderwriting: {
    reverseUnderwritingCalculated: true,
    outcome: 'ABOVE_LIMIT',
    maximumJustifiedPurchasePrice: 99000000,
    currentPriceAnalysis: { purchasePrice: 100000000, priceHeadroom: -1000000 },
    bindingConstraint: { code: 'MIN_YIELD' },
  },
  exitStrategyComparison: {
    exitStrategyComparisonCalculated: true,
    benchmarkScenarioId: 'HOLD',
    highestModeledNpvScenario: { scenarioId: 'REFURBISH', npv: 12000000 },
    scenarioResults: [{ scenarioId: 'HOLD' }, { scenarioId: 'REFURBISH' }],
  },
  scenarioIntegration: {
    status: 'CALCULATED_WITH_GAPS', reviewRequired: true,
    issues: [{ code: 'POTENTIAL_UPSIDE_DOUBLE_COUNT_REVIEW' }],
    automaticFinancializationApplied: false,
  },
  property: { address: 'SHOULD_NOT_BE_EXPORTED' },
  tenants: [{ name: 'SHOULD_NOT_BE_EXPORTED' }],
};

const snapshotResult = buildResidentialIncomeAiDecisionSnapshot(viewModel);
assert.strictEqual(snapshotResult.status, AI_ASSIST_STATUS.READY);
assert.strictEqual(snapshotResult.decisionSnapshot.capability, 'RESIDENTIAL_INCOME_ACQUISITION_AI_ASSIST');
assert.strictEqual(snapshotResult.decisionSnapshot.governance.rawOperatingCaseIncluded, false);
assert.strictEqual(snapshotResult.decisionSnapshot.governance.tenantNamesIncluded, false);
assert.strictEqual(snapshotResult.decisionSnapshot.governance.evidenceDocumentTextIncluded, false);
assert.strictEqual(snapshotResult.decisionSnapshot.governance.automaticInvestmentRecommendationAllowed, false);
assert.strictEqual(snapshotResult.decisionSnapshot.governance.legalConclusionAllowed, false);
assert.strictEqual(snapshotResult.decisionSnapshot.governance.transactionAuthorizationAllowed, false);
const serialized = JSON.stringify(snapshotResult);
assert(!serialized.includes('SHOULD_NOT_BE_EXPORTED'));
assert(!serialized.includes('"address"'));
assert(!serialized.includes('"tenants"'));
assert.strictEqual(snapshotResult.decisionSnapshot.acquisitionScore.redFlags[0].amount, undefined);

const notReady = buildResidentialIncomeAiDecisionSnapshot({ apiStatus: 'NOT_LOADED' });
assert.strictEqual(notReady.status, AI_ASSIST_STATUS.NOT_READY);
assert.strictEqual(notReady.reasonCode, 'OPERATING_CASE_REQUIRED');

const validResponse = validateResidentialIncomeAiAssistResponse({
  executiveObservations: ['Evidence coverage is incomplete in two material areas.'],
  riskFlags: [{ code: 'PRICE_DISCIPLINE', severity: 'HIGH', rationale: 'The modeled purchase price exceeds the non-binding analytical limit.' }],
  evidenceGaps: ['Current market-rent evidence requires verification.'],
  dueDiligenceQuestions: ['What independent lease evidence supports the rent roll?'],
  scenarioChecks: ['Review whether lifecycle CAPEX is already represented in the refurbishment scenario.'],
  earlyWarningIndicators: [{ indicator: 'Occupancy trend', whyItMatters: 'A sustained decline would weaken operating stability.' }],
  decisionBoundary: 'This narrative is advisory analysis only and does not authorize a transaction.',
});
assert.strictEqual(validResponse.status, AI_ASSIST_STATUS.VALID);
assert.strictEqual(validResponse.value.investmentRecommendation, null);
assert.strictEqual(validResponse.value.investmentDecision, null);
assert.strictEqual(validResponse.value.legalConclusion, null);
assert.strictEqual(validResponse.value.transactionAuthorized, false);

const prohibited = validateResidentialIncomeAiAssistResponse({
  executiveObservations: ['Buy the asset immediately.'],
  riskFlags: [], evidenceGaps: [], dueDiligenceQuestions: [], scenarioChecks: [], earlyWarningIndicators: [],
  decisionBoundary: 'Advisory only.',
});
assert.strictEqual(prohibited.status, AI_ASSIST_STATUS.INVALID);
assert.strictEqual(prohibited.reasonCode, 'AUTOMATIC_DECISION_LANGUAGE_PROHIBITED');

assert(gateway.includes("RIAI_AI_PROVIDER_URL"));
assert(gateway.includes("RIAI_AI_ALLOWED_HOSTS"));
assert(gateway.includes("RIAI_AI_PROVIDER_KEY"));
assert(gateway.includes("RIAI_AI_MODEL"));
assert(gateway.includes("url.protocol !== 'https:'"));
assert(gateway.includes("AI_PROVIDER_HOST_NOT_ALLOWED"));
assert(gateway.includes("cache-control': 'no-store"));
assert(gateway.includes("rawOperatingCaseIncluded !== false"));
assert(gateway.includes("tenantNamesIncluded !== false"));
assert(gateway.includes("evidenceDocumentTextIncluded !== false"));
assert(gateway.includes("automaticInvestmentRecommendationAllowed !== false"));
assert(gateway.includes("legalConclusionAllowed !== false"));
assert(gateway.includes("transactionAuthorizationAllowed !== false"));
assert(gateway.includes("Do not reveal chain-of-thought"));
assert(gateway.includes("deterministicScoreRemainsAuthoritative: true"));
assert(gateway.includes("investmentRecommendation: null"));
assert(gateway.includes("legalConclusion: null"));
assert(gateway.includes("transactionAuthorized: false"));

console.log('RIAI_AI_GATEWAY_V1=PASS');
console.log('SANITIZED_DECISION_SNAPSHOT=PASS');
console.log('SERVER_SIDE_PROVIDER_SECRET_ONLY=PASS');
console.log('PROVIDER_HOST_ALLOWLIST_AND_HTTPS=PASS');
console.log('NO_AUTOMATIC_INVESTMENT_OR_LEGAL_DECISION=PASS');
