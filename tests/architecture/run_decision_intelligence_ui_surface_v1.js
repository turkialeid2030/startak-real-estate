'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const mainSource = fs.readFileSync(path.join(root, 'src/main.jsx'), 'utf8');
const panelSource = fs.readFileSync(path.join(root, 'src/components/DecisionIntelligenceWorkspacePanel.jsx'), 'utf8');

(function productionEntryPointUsesConditionalRuntimeWorkspace() {
  assert(mainSource.includes("import DecisionIntelligenceWorkspacePanel from './components/DecisionIntelligenceWorkspacePanel.jsx';"));
  assert(mainSource.includes('window.__STARTAK_DECISION_INTELLIGENCE_WORKSPACE__'));
  assert(mainSource.includes('runtimeDecisionWorkspace ? <DecisionIntelligenceWorkspacePanel workspace={runtimeDecisionWorkspace} /> : null'));
})();

(function panelFailsClosedWithoutWorkspace() {
  assert(panelSource.includes("if (!workspace || typeof workspace !== 'object') return null;"));
})();

(function panelExposesRequiredDecisionSections() {
  for (const marker of [
    'الأدلة والافتراضات',
    'موثوقية القرار والفحص التالي',
    'طبقة الذكاء الاصطناعي المقيدة',
    'ANALYST',
    'CHALLENGER',
    'SYNTHESIZER',
    'حدود الاستخدام',
  ]) {
    assert(panelSource.includes(marker), `missing UI marker: ${marker}`);
  }
})();

(function noSyntheticWorkspacePayloadIsEmbedded() {
  assert(!mainSource.includes('READY_FOR_REVIEW:'));
  assert(!mainSource.includes("caseId: '"));
  assert(!mainSource.includes("projectId: '"));
  assert(!panelSource.includes('numericConfidence'));
})();

(function humanAndComplianceBoundariesAreVisible() {
  assert(panelSource.includes('القرار البشري إلزامي'));
  assert(panelSource.includes('لا تمثل هذه المساحة تقييمًا معتمدًا أو رأيًا قانونيًا أو تفويضًا لتنفيذ معاملة'));
})();

console.log('DECISION_INTELLIGENCE_UI_SURFACE_V1=PASS');
