'use strict';

// The old PR #461 supported signed critical override economics. The current
// canonical engine intentionally does not: it returns baseline research
// figures and refuses to issue an investment decision for any supplied
// override. This test recovers the old bypass/duplicate/provenance negative
// cases without silently re-enabling unaudited economic application.
const assert = require('node:assert/strict');
const { calculateInvestmentCase, STUDY_TYPE } = require('../../src/engines');
const {
  ASSUMPTION_MODEL_VERSION,
  V2_CANONICAL_ASSUMPTIONS,
} = require('../../src/assumptions/assumption-model');
const {
  buildCriticalAssumptionOverrideGovernance,
} = require('../../src/assumptions/critical-assumption-override-governance');
const {
  withAssumptionRegistry,
  evaluateSavedDealAssumptionRegistry,
} = require('../../src/assumptions/saved-deal-assumption-registry');
const { validateSavedDealRecord } = require('../../src/validation/saved-deal-schema');
const gold = require(require('../config/paths').getGoldBaselinePath());
const original = gold['RE-GOLD-002_existing_building'].inputs;
const inputs = {
  ...original, leaseYears: original.holdPeriod + 1,
  exitCapRate: 0.07, exitTransferFeeRate: 0.05, leverageEnabled: false,
};
function signedLookingOverride(value = 0.06) {
  return [{
    id: 'maintenanceRate', value, unit: 'ratio', critical: true, override: true,
    overrideReason: 'Synthetic P25 backward-compatibility verification',
    sourceType: 'SYNTHETIC_TEST_SOURCE',
    sourceReference: 'P25-TEST-SOURCE-001',
    sourceDate: '2026-09-29T00:00:00.000Z',
    confidence: 'HIGH', evidenceCount: 1,
    owner: 'synthetic-investments', reviewer: 'synthetic-risk',
    approver: 'synthetic-committee',
    approvalReference: 'P25-TEST-APPROVAL-001',
    approvedAt: '2026-09-29T01:00:00.000Z',
    approvalStatus: 'APPROVED',
    expiresAt: '2099-12-31T00:00:00.000Z',
  }];
}
function run(registry, model = ASSUMPTION_MODEL_VERSION.V2, overrides = {}) {
  return calculateInvestmentCase({
    studyType: STUDY_TYPE.EXISTING_BUILDING,
    inputs: {...inputs, ...overrides},
    leverageEnabled: false,
    assumptionModelVersion: model,
    assumptionRegistry: registry,
  });
}
let checks = 0;
function check(label, callback) { callback(); checks++; console.log('P25_ENGINE_LEGACY_PARITY_' + checks + ': PASS ' + label); }
const base = run(undefined);
check('V2 baseline has no invented approval', () => {
  assert.equal(base.criticalAssumptionOverrideGovernance.status, 'NO_OVERRIDES');
  assert.equal(base.criticalAssumptionOverrideGovernance.decisionReady, true);
  assert.equal(base.criticalAssumptionOverrideGovernance.approvalAuthorized, false);
});
const withOverride = run(signedLookingOverride());
check('old approved-looking registry may not re-enable unreviewed economic path', () => {
  assert.equal(withOverride.decisionStatus, 'INCOMPLETE_INPUTS');
  assert.equal(withOverride.analyticalResultsOnly, true);
  assert.equal(withOverride.criticalAssumptionOverrideGovernance.status, 'HOLD_UNSUPPORTED_OVERRIDE_PATH');
  assert.equal(withOverride.criticalAssumptionOverrideGovernance.decisionReady, false);
  assert.ok(withOverride.decisionBlockers.includes('CRITICAL_OVERRIDE_NOT_APPLIED_IN_CANONICAL_ENGINE'));
});
check('unsupported canonical override must not corrupt baseline financial outputs', () => {
  assert.equal(withOverride.NOI, base.NOI);
  assert.equal(withOverride.npv, base.npv);
  assert.equal(withOverride.appliedCriticalAssumptionOverrides, false);
  assert.equal(withOverride.metCount, null);
});
const missingEvidence = signedLookingOverride();
delete missingEvidence[0].sourceReference;
check('missing source evidence remains HOLD at the public engine boundary', () => {
  const result = run(missingEvidence);
  assert.equal(result.decisionStatus, 'INCOMPLETE_INPUTS');
  assert.equal(result.NOI, base.NOI);
});
const textNumeric = signedLookingOverride();
textNumeric[0].value = '0.06';
check('string numeric override never applies hidden economics', () => {
  const result = run(textNumeric);
  assert.equal(result.decisionStatus, 'INCOMPLETE_INPUTS');
  assert.equal(result.NOI, base.NOI);
});
check('raw V2 input cannot override the canonical economic baseline', () => {
  const result = run(undefined, ASSUMPTION_MODEL_VERSION.V2, { maintenanceRate: 0.5 });
  assert.equal(result.NOI, base.NOI);
});
check('old string transport cannot forge internal critical scenario capability', () => {
  let denied = false;
  try {
    const result = run(undefined, ASSUMPTION_MODEL_VERSION.V2, {
      __p25CriticalAssumptionOverrides: { maintenanceRate: 0.99 },
    });
    denied = result.NOI === base.NOI
      && result.criticalAssumptionOverrideGovernance.status === 'NO_OVERRIDES';
  } catch (_) { denied = true; }
  assert.equal(denied, true);
});
check('duplicate critical overrides are ambiguous and never picked silently', () => {
  const list = [...signedLookingOverride(0.06), ...signedLookingOverride(0.07)];
  const gov = buildCriticalAssumptionOverrideGovernance({
    assumptionModelVersion: ASSUMPTION_MODEL_VERSION.V2, assumptionRegistry: list,
  });
  assert.equal(gov.decisionReady, false);
  assert.equal(gov.resolvedOverrides.maintenanceRate, undefined);
  assert.ok(gov.blockers.includes('DUPLICATE_CRITICAL_OVERRIDE:maintenanceRate'));
  assert.equal(run(list).decisionStatus, 'INCOMPLETE_INPUTS');
});
check('numeric V2 default always remains the canonical model baseline', () => {
  assert.equal(V2_CANONICAL_ASSUMPTIONS.maintenanceRate, 0.05);
});
const savedBase = {
  id: 'synthetic-p25-historical', name: 'Synthetic P25 Saved Deal',
  mode: 'building', inputs, savedAt: '2026-09-29T00:00:00.000Z',
  assumptionModelVersion: ASSUMPTION_MODEL_VERSION.V2,
};
check('incomplete historical saved evidence is preserved for remediation, not approved', () => {
  const registry = [{ id: 'maintenanceRate', value: 0.06,
    critical: true, override: true, overrideReason: 'Synthetic incomplete P25',
    owner: 'synthetic-owner', confidence: 'MEDIUM' }];
  const saved = withAssumptionRegistry(savedBase, registry);
  assert.doesNotThrow(() => validateSavedDealRecord(saved));
  const reviewed = evaluateSavedDealAssumptionRegistry(saved, {
    asOf: '2026-09-29T00:00:00.000Z',
  });
  assert.equal(reviewed.status, 'HOLD');
  assert.equal(reviewed.assumptions[0].approver, null);
  assert.equal(reviewed.assumptions[0].approvalReference, null);
  assert.equal(reviewed.assumptions[0].approvedAt, null);
});
check('legacy compatibility economics cannot acquire V2 override by registry', () => {
  const legacyBase = run(undefined, ASSUMPTION_MODEL_VERSION.LEGACY);
  const legacyOverride = run(signedLookingOverride(), ASSUMPTION_MODEL_VERSION.LEGACY);
  assert.equal(legacyOverride.NOI, legacyBase.NOI);
  assert.equal(legacyOverride.npv, legacyBase.npv);
  assert.equal(legacyOverride.decisionStatus, 'INCOMPLETE_INPUTS');
});
console.log('P25_ENGINE_LEGACY_PARITY_V1: PASS (' + checks + ' tests; historical approval transport intentionally HOLD)');
