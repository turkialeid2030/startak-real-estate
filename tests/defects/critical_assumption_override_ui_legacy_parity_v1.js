'use strict';

// Restores historical P25 UI negative tests as a modern fail-closed parity
// check. This test does not authorize or apply the old unreviewed override
// engine: it verifies that old deal evidence survives hydration, evaluation,
// and serialization and that the modern canonical economic verdict stays HOLD.
const assert = require('node:assert/strict');
const {
  UI_MODE,
  createUiWorkspace,
  hydrateUiDeal,
  calculateUiInvestmentState,
  buildUiDisclosureViewModel,
  prepareUpdatedUiDealForSave,
} = require('../../src/assumptions/ui-integration-controller');
const {
  ASSUMPTION_MODEL_VERSION,
  V2_CANONICAL_ASSUMPTIONS,
} = require('../../src/assumptions/assumption-model');
const gold = require(require('../config/paths').getGoldBaselinePath());
const goldenInputs = gold['RE-GOLD-002_existing_building'].inputs;
const inputs = {
  ...goldenInputs,
  leaseYears: goldenInputs.holdPeriod + 1,
  exitCapRate: 0.07,
  exitTransferFeeRate: 0.05,
  leverageEnabled: false,
};
function syntheticOverride() {
  return [{
    id: 'maintenanceRate', value: 0.06, unit: 'ratio', critical: true, override: true,
    overrideReason: 'Synthetic historical P25 UI legacy parity',
    owner: 'synthetic-owner', confidence: 'MEDIUM',
    sourceType: 'SYNTHETIC_TEST_EVIDENCE',
    sourceDate: '2026-09-29T00:00:00.000Z',
    approvalStatus: 'PENDING',
  }];
}
let checks = 0;
function check(name, callback) {
  callback();
  checks++;
  console.log('P25_UI_LEGACY_PARITY_' + String(checks).padStart(2, '0') + ': PASS ' + name);
}
const fresh = createUiWorkspace({ mode: UI_MODE.BUILDING, defaultInputs: inputs });
check('V2 fresh defaults are numeric baseline and have no registry', () => {
  assert.equal(fresh.assumptionModelVersion, ASSUMPTION_MODEL_VERSION.V2);
  assert.equal(fresh.inputs.maintenanceRate, V2_CANONICAL_ASSUMPTIONS.maintenanceRate);
  assert.equal(fresh.transactionAuthorized, false);
  assert.ok(!fresh.assumptionRegistry);
  assert.equal(Object.prototype.hasOwnProperty.call(fresh.inputs, 'exitCapRate'), false);
});
const original = {
  id: 'p25-modern-legacy-deal', name: 'Synthetic legacy P25 deal',
  mode: UI_MODE.BUILDING, inputs,
  assumptionModelVersion: ASSUMPTION_MODEL_VERSION.V2,
  assumptionRegistry: syntheticOverride(),
};
const hydrated = hydrateUiDeal({ record: original, defaultInputs: goldenInputs });
check('saved provenance preserved without invented source or approval', () => {
  assert.equal(hydrated.assumptionRegistry.length, 1);
  assert.equal(hydrated.assumptionRegistry[0].sourceReference, undefined);
  assert.equal(hydrated.assumptionRegistry[0].approver, undefined);
  assert.equal(hydrated.assumptionRegistry[0].approvalReference, undefined);
  assert.equal(hydrated.assumptionRegistry[0].approvedAt, undefined);
  assert.equal(hydrated.assumptionRegistry[0].approvalStatus, 'PENDING');
  assert.equal(hydrated.transactionAuthorized, false);
});
check('registry is cloned; editing UI registry does not mutate saved source', () => {
  assert.notStrictEqual(hydrated.assumptionRegistry, original.assumptionRegistry);
  assert.notStrictEqual(hydrated.assumptionRegistry[0], original.assumptionRegistry[0]);
});
const baseline = calculateUiInvestmentState({
  mode: UI_MODE.BUILDING, inputs: hydrated.inputs,
  assumptionModelVersion: ASSUMPTION_MODEL_VERSION.V2,
  includePurchaseAlternative: false,
});
const scoped = calculateUiInvestmentState({
  mode: UI_MODE.BUILDING, inputs: hydrated.inputs,
  assumptionRegistry: hydrated.assumptionRegistry,
  assumptionModelVersion: ASSUMPTION_MODEL_VERSION.V2,
  includePurchaseAlternative: false,
});
check('override registry flows through UI calculation and holds investment decision', () => {
  assert.equal(scoped.assumptionOverrideHold, true);
  assert.equal(scoped.results.decisionStatus, 'INCOMPLETE_INPUTS');
  assert.equal(scoped.results.verdict, 'INCOMPLETE_INPUTS');
  assert.equal(scoped.results.analyticalResultsOnly, true);
  assert.equal(scoped.results.criticalAssumptionOverrideGovernance.decisionReady, false);
  assert.ok(scoped.results.decisionBlockers.includes('CRITICAL_OVERRIDE_NOT_APPLIED_IN_CANONICAL_ENGINE'));
});
check('modern engine does NOT apply unsupported numeric override silently', () => {
  assert.equal(scoped.results.NOI, baseline.results.NOI);
  assert.equal(scoped.results.npv, baseline.results.npv);
  assert.equal(scoped.results.appliedCriticalAssumptionOverrides, false);
  assert.equal(scoped.transactionAuthorized, false);
});
check('decision HOLD blocks UI sensitivity presentation', () => {
  assert.equal(scoped.sensitivityReady, false);
  assert.equal(scoped.sensitivityRenderPolicy, 'HOLD_INCOMPLETE_ASSUMPTION_OVERRIDE');
});
check('canonical baseline disclosure is never independent financial approval', () => {
  const ui = buildUiDisclosureViewModel({ governance: scoped.governance, locale: 'ar-SA' });
  assert.equal(ui.userApprovedAssumptions, false);
  assert.equal(ui.approvalEvidenceStatus, 'NOT_SUPPLIED');
  assert.deepEqual(ui.independentlyApprovedAssumptionKeys, []);
  assert.equal(ui.transactionAuthorized, false);
});
check('updated saved deal still contains unapproved assumption provenance', () => {
  const updated = prepareUpdatedUiDealForSave({
    ...original, assumptionRegistry: hydrated.assumptionRegistry,
  }, ASSUMPTION_MODEL_VERSION.V2);
  assert.equal(updated.assumptionRegistry.length, 1);
  assert.equal(updated.assumptionRegistry[0].approvalStatus, 'PENDING');
  assert.equal(updated.assumptionRegistry[0].sourceReference, undefined);
});
check('new-deal baseline does not borrow the prior deal registry', () => {
  const newState = calculateUiInvestmentState({
    mode: UI_MODE.BUILDING,
    inputs: { ...fresh.inputs, exitCapRate: 0.07, exitTransferFeeRate: 0.05,
      leaseYears: goldenInputs.holdPeriod + 1 },
    assumptionModelVersion: ASSUMPTION_MODEL_VERSION.V2,
    assumptionRegistry: null,
    includePurchaseAlternative: false,
  });
  assert.equal(newState.assumptionOverrideHold, false);
  assert.equal(newState.transactionAuthorized, false);
});
console.log('P25_UI_LEGACY_PARITY_V1: PASS (' + checks + ' synthetic checks; economic override stays unsupported/HOLD)');
