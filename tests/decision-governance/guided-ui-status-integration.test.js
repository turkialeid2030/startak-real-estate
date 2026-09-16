'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { buildGuidedUiStatus } = require('../../src/decision-governance/guided-ui-status');

const valuationCase = {
  evidence: {
    income: { sourceType: 'LEASE_LEDGER', observedAt: '2026-09-10' },
  },
};

const valuationHold = buildGuidedUiStatus({
  runtime: { stage: { status: 'HOLD_EVIDENCE', readyForDecisionControl: false, evidenceGaps: ['capRate'] } },
  valuationCase,
  financialResultPresent: true,
});
assert.strictEqual(valuationHold.nextStep, 'VALUATION');
assert.strictEqual(valuationHold.financialResultPresent, true);
assert.strictEqual(valuationHold.buyRejectDecisionAllowed, false);

const evidenceHold = buildGuidedUiStatus({
  runtime: { stage: { status: 'READY_FOR_DECISION_CONTROL', readyForDecisionControl: true, evidenceGaps: ['capRate'] } },
  valuationCase,
  financialResultPresent: true,
});
assert.strictEqual(evidenceHold.nextStep, 'EVIDENCE');
assert.strictEqual(evidenceHold.buyRejectDecisionAllowed, false);

const riskHold = buildGuidedUiStatus({
  runtime: { stage: { status: 'READY_FOR_DECISION_CONTROL', readyForDecisionControl: true, evidenceGaps: [] } },
  valuationCase,
  financialResultPresent: true,
});
assert.strictEqual(riskHold.nextStep, 'RISKS');
assert.strictEqual(riskHold.evidenceComplete, true);
assert.strictEqual(riskHold.overallDecisionAllowed, false);
assert.strictEqual(riskHold.buyRejectDecisionAllowed, false);

const panelSource = fs.readFileSync(path.join(__dirname, '../../src/components/ValuationIntelligencePanel.jsx'), 'utf8');
assert.ok(panelSource.includes("import GuidedDecisionStatusPanel from './GuidedDecisionStatusPanel.jsx'"));
assert.ok(panelSource.includes('<GuidedDecisionStatusPanel'));

console.log('GUIDED_UI_STATUS_INTEGRATION_TESTS=PASS');
