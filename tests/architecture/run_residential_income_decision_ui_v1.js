'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const panel = fs.readFileSync(path.join(root, 'src/components/ResidentialIncomeAcquisitionPanel.jsx'), 'utf8');
const extension = fs.readFileSync(path.join(root, 'src/components/ResidentialIncomeDecisionExtension.jsx'), 'utf8');
const api = fs.readFileSync(path.join(root, 'src/residential-income-acquisition/api.js'), 'utf8');
const intelligence = fs.readFileSync(path.join(root, 'src/residential-income-acquisition/lifecycle-location-upside.js'), 'utf8');
const decisionLayer = fs.readFileSync(path.join(root, 'src/residential-income-acquisition/decision-layer.js'), 'utf8');

assert(panel.includes("import ResidentialIncomeDecisionExtension from './ResidentialIncomeDecisionExtension';"));
assert(panel.includes('<ResidentialIncomeDecisionExtension viewModel={viewModel} dir={dir} />'));

for (const marker of [
  'data-testid="riai-decision-extension"',
  'riai-lifecycle-intelligence',
  'riai-location-intelligence',
  'riai-forward-attraction',
  'riai-upside-intelligence',
  'riai-scenario-attribution',
  'riai-acquisition-analytical-score',
  'riai-investment-committee-pack',
  'riai-acquisition-score',
  'riai-regulatory-verification-count',
]) {
  assert(extension.includes(marker), `missing UI marker: ${marker}`);
}

assert(extension.includes("const ar = dir === 'rtl';"));
assert(extension.includes("const locale = ar ? 'ar-SA' : 'en-US';"));
assert(extension.includes('تحليلي'));
assert(extension.includes('Analytical'));
assert(extension.includes('لا تمثل تقييماً معتمداً'));
assert(extension.includes('not a certified valuation'));
assert(extension.includes('لا يتم إدخال أي أثر مالي تلقائي'));
assert(extension.includes('No contextual signal is automatically financialized'));
assert(extension.includes('لا ينشئ توصية أو اعتماداً تلقائياً'));
assert(extension.includes('does not create an automatic recommendation or approval'));

assert(api.includes("intelligenceExtensionStatus: 'LIFECYCLE_LOCATION_UPSIDE_AND_IC_V1'"));
assert(api.includes('lifecycleLocationUpside,'));
assert(api.includes('scenarioIntegration,'));
assert(api.includes('acquisitionAnalyticalScore,'));
assert(api.includes('investmentCommitteePack,'));

assert(intelligence.includes('investmentDecision: null'));
assert(intelligence.includes('legalConclusion: null'));
assert(intelligence.includes('transactionAuthorized: false'));
assert(intelligence.includes('do not automatically alter rent growth, vacancy, exit cap rates, or terminal value'));
assert(decisionLayer.includes('aiModelUsed: false'));
assert(decisionLayer.includes('investmentRecommendation: null'));
assert(decisionLayer.includes('automaticFinancializationApplied: false'));
assert(decisionLayer.includes('regulatedAdvice: false'));
assert(decisionLayer.includes('transactionAuthorized: false'));

for (const source of [panel, extension]) {
  assert(!source.includes('fetch('));
  assert(!source.includes('window.'));
  assert(!source.includes('localStorage'));
}

console.log('RIAI_DECISION_UI_V1=PASS');
console.log('AR_EN_DECISION_LAYER_SURFACE=PASS');
console.log('NO_AUTO_RECOMMENDATION_UI=PASS');
console.log('NO_CONTEXTUAL_AUTO_FINANCIALIZATION_UI=PASS');
console.log('NO_NETWORK_OR_LOCAL_STORAGE_PATH=PASS');
