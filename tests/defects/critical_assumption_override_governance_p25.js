'use strict';

const assert = require('assert/strict');
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

const goldInputs = gold['RE-GOLD-002_existing_building'].inputs;
const baseInputs = {
  ...goldInputs,
  // Independent P22/P23 preconditions so P25 is the only decision-governance
  // variable under test.
  leaseYears: goldInputs.holdPeriod + 1,
  exitCapRate: 0.07,
  exitTransferFeeRate: 0.05,
  leverageEnabled: false,
};

function runV2(assumptionRegistry) {
  return calculateInvestmentCase({
    studyType: STUDY_TYPE.EXISTING_BUILDING,
    inputs: baseInputs,
    leverageEnabled: false,
    assumptionModelVersion: ASSUMPTION_MODEL_VERSION.V2,
    assumptionRegistry,
  });
}

function completeOverride(value = 0.06) {
  return [{
    id: 'maintenanceRate',
    value,
    unit: 'ratio',
    critical: true,
    override: true,
    overrideReason: 'P25 deterministic test override',
    sourceType: 'INTERNAL_APPROVED_EVIDENCE',
    sourceReference: 'P25-TEST-SOURCE-001',
    sourceDate: '2026-09-29T00:00:00.000Z',
    evidenceCount: 1,
    confidence: 'HIGH',
    owner: 'investment-team',
    reviewer: 'model-risk',
    approver: 'investment-committee',
    approvalReference: 'P25-TEST-APPROVAL-001',
    approvedAt: '2026-09-29T01:00:00.000Z',
    approvalStatus: 'APPROVED',
    expiresAt: '2099-12-31T00:00:00.000Z',
  }];
}

const baseline = runV2(undefined);
assert.equal(baseline.criticalAssumptionOverrideGovernance.status, 'NO_OVERRIDES');
assert.equal(baseline.criticalAssumptionOverrideGovernance.decisionReady, true);
assert.equal(baseline.assumptionModelDisclosure.userApprovedAssumptions, false,
  'canonical V2 baseline must not be represented as user approval evidence');

const complete = runV2(completeOverride());
assert.equal(complete.criticalAssumptionOverrideGovernance.status, 'READY');
assert.equal(complete.criticalAssumptionOverrideGovernance.decisionReady, true);
assert.equal(complete.criticalAssumptionOverrideGovernance.resolvedOverrides.maintenanceRate, 0.06);
assert.notEqual(complete.NOI, baseline.NOI,
  'explicit critical override must change analytical economics when its value changes');
assert.ok(complete.NOI < baseline.NOI,
  'higher maintenance rate should reduce NOI in this deterministic case');
assert.equal(complete.criticalAssumptionOverrideGovernance.overrides[0].baselineValue,
  V2_CANONICAL_ASSUMPTIONS.maintenanceRate);
assert.ok(Math.abs(complete.criticalAssumptionOverrideGovernance.overrides[0].absoluteDelta - 0.01) < 1e-12);
assert.ok(Math.abs(complete.criticalAssumptionOverrideGovernance.overrides[0].percentDelta - 0.2) < 1e-12);
assert.notEqual(complete.decisionStatus, 'INCOMPLETE_INPUTS',
  'fully documented critical override must not create a P25 decision hold');

// Incomplete provenance: the numeric analytical override remains visible, but
// decision readiness fails closed and no source/approval evidence is invented.
const missingSource = completeOverride();
delete missingSource[0].sourceReference;
const incompleteSource = runV2(missingSource);
assert.equal(incompleteSource.NOI, complete.NOI,
  'documentation failure must not erase or rewrite the analytical override value');
assert.equal(incompleteSource.decisionStatus, 'INCOMPLETE_INPUTS');
assert.equal(incompleteSource.verdict, 'INCOMPLETE_INPUTS');
assert.equal(incompleteSource.analyticalResultsOnly, true);
assert.ok(Number.isFinite(incompleteSource.npv), 'P25 must preserve analytical NPV');
assert.ok(Number.isFinite(incompleteSource.irr), 'P25 must preserve analytical IRR');
assert.ok(incompleteSource.decisionBlockers.includes('CRITICAL_OVERRIDE_SOURCE_EVIDENCE_REQUIRED:maintenanceRate'));
assert.equal(incompleteSource.criticalAssumptionOverrideGovernance.overrides[0].provenance.sourceReference, null);

const missingApproval = completeOverride();
delete missingApproval[0].approver;
delete missingApproval[0].approvalReference;
delete missingApproval[0].approvedAt;
missingApproval[0].approvalStatus = 'PENDING';
const incompleteApproval = runV2(missingApproval);
assert.equal(incompleteApproval.decisionStatus, 'INCOMPLETE_INPUTS');
assert.ok(incompleteApproval.decisionBlockers.includes('CRITICAL_OVERRIDE_APPROVER_REQUIRED:maintenanceRate'));
assert.ok(incompleteApproval.decisionBlockers.includes('CRITICAL_OVERRIDE_APPROVAL_REFERENCE_REQUIRED:maintenanceRate'));
assert.ok(incompleteApproval.decisionBlockers.includes('CRITICAL_OVERRIDE_APPROVAL_DATE_REQUIRED:maintenanceRate'));
assert.ok(incompleteApproval.decisionBlockers.includes('CRITICAL_OVERRIDE_APPROVAL_STATUS_REQUIRED:maintenanceRate'));

// Weakly typed numeric text is not accepted as a critical analytical override.
const stringValue = completeOverride();
stringValue[0].value = '0.06';
const weakTyped = runV2(stringValue);
assert.equal(weakTyped.NOI, baseline.NOI,
  'string numeric value must not bypass the strict critical-override numeric boundary');
assert.equal(weakTyped.decisionStatus, 'INCOMPLETE_INPUTS');
assert.ok(weakTyped.decisionBlockers.includes('CRITICAL_OVERRIDE_NUMERIC_VALUE_REQUIRED:maintenanceRate'));

// A raw input value is still unable to bypass the V2 canonical baseline.
const rawInputAttempt = calculateInvestmentCase({
  studyType: STUDY_TYPE.EXISTING_BUILDING,
  inputs: { ...baseInputs, maintenanceRate: 0.50 },
  leverageEnabled: false,
  assumptionModelVersion: ASSUMPTION_MODEL_VERSION.V2,
});
assert.equal(rawInputAttempt.NOI, baseline.NOI,
  'top-level raw economic input cannot masquerade as an approved V2 critical override');

// Duplicate critical overrides are ambiguous: do not choose one silently.
const duplicateGovernance = buildCriticalAssumptionOverrideGovernance({
  assumptionModelVersion: ASSUMPTION_MODEL_VERSION.V2,
  assumptionRegistry: [...completeOverride(0.06), ...completeOverride(0.07)],
});
assert.equal(duplicateGovernance.decisionReady, false);
assert.equal(duplicateGovernance.resolvedOverrides.maintenanceRate, undefined);
assert.ok(duplicateGovernance.blockers.includes('DUPLICATE_CRITICAL_OVERRIDE:maintenanceRate'));

// Persistence is structural, not an approval factory. Incomplete evidence must
// remain loadable for remediation, then evaluate to HOLD.
const savedBase = {
  id: 'p25-saved',
  name: 'P25 Saved Deal',
  mode: 'building',
  inputs: baseInputs,
  savedAt: '2026-09-29T00:00:00.000Z',
  assumptionModelVersion: ASSUMPTION_MODEL_VERSION.V2,
};
const persistableIncomplete = [{
  id: 'maintenanceRate',
  value: 0.06,
  critical: true,
  override: true,
  owner: 'investment-team',
  confidence: 'MEDIUM',
}];
const savedIncomplete = withAssumptionRegistry(savedBase, persistableIncomplete);
assert.doesNotThrow(() => validateSavedDealRecord(savedIncomplete));
const evaluatedIncomplete = evaluateSavedDealAssumptionRegistry(savedIncomplete, {
  asOf: '2026-09-29T00:00:00.000Z',
});
assert.equal(evaluatedIncomplete.status, 'HOLD');
assert.equal(evaluatedIncomplete.assumptions[0].approver, null);
assert.equal(evaluatedIncomplete.assumptions[0].approvalReference, null);
assert.equal(evaluatedIncomplete.assumptions[0].approvedAt, null);
assert.equal(evaluatedIncomplete.assumptions[0].approvalStatus, null);

// LEGACY is compatibility-only and P25 override metadata must not alter its
// economics or create an artificial approval path.
const legacyNoRegistry = calculateInvestmentCase({
  studyType: STUDY_TYPE.EXISTING_BUILDING,
  inputs: baseInputs,
  leverageEnabled: false,
  assumptionModelVersion: ASSUMPTION_MODEL_VERSION.LEGACY,
});
const legacyWithRegistry = calculateInvestmentCase({
  studyType: STUDY_TYPE.EXISTING_BUILDING,
  inputs: baseInputs,
  leverageEnabled: false,
  assumptionModelVersion: ASSUMPTION_MODEL_VERSION.LEGACY,
  assumptionRegistry: completeOverride(0.06),
});
assert.equal(legacyWithRegistry.NOI, legacyNoRegistry.NOI);
assert.equal(legacyWithRegistry.npv, legacyNoRegistry.npv);
assert.equal(legacyWithRegistry.criticalAssumptionOverrideGovernance.status, 'NOT_APPLICABLE');

console.log('CRITICAL_ASSUMPTION_OVERRIDE_GOVERNANCE_P25=PASS');
