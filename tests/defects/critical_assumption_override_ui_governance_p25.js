'use strict';

const assert = require('assert/strict');
const {
  UI_MODE,
  createUiWorkspace,
  hydrateUiDeal,
  calculateWorkspaceState,
  buildUiDisclosureViewModel,
} = require('../../src/assumptions/ui-integration-controller');
const {
  ASSUMPTION_MODEL_VERSION,
  V2_CANONICAL_ASSUMPTIONS,
} = require('../../src/assumptions/assumption-model');
const gold = require(require('../config/paths').getGoldBaselinePath());

const goldInputs = gold['RE-GOLD-002_existing_building'].inputs;
const governedInputs = {
  ...goldInputs,
  leaseYears: goldInputs.holdPeriod + 1,
  exitCapRate: 0.07,
  exitTransferFeeRate: 0.05,
  leverageEnabled: false,
};

function overrideRecord({ complete = true } = {}) {
  const record = {
    id: 'maintenanceRate',
    value: 0.06,
    unit: 'ratio',
    critical: true,
    override: true,
    overrideReason: 'P25 UI governance regression',
    sourceType: 'INTERNAL_APPROVED_EVIDENCE',
    sourceReference: 'P25-UI-SOURCE-001',
    sourceDate: '2026-09-29T00:00:00.000Z',
    evidenceCount: 1,
    confidence: 'HIGH',
    owner: 'investment-team',
    reviewer: 'model-risk',
    approver: 'investment-committee',
    approvalReference: 'P25-UI-APPROVAL-001',
    approvedAt: '2026-09-29T01:00:00.000Z',
    approvalStatus: 'APPROVED',
    expiresAt: '2099-12-31T00:00:00.000Z',
  };
  if (!complete) {
    delete record.sourceReference;
    delete record.approver;
    delete record.approvalReference;
    delete record.approvedAt;
    record.approvalStatus = 'PENDING';
  }
  return record;
}

// Fresh V2 UI state must not fabricate provenance or approval evidence.
const fresh = createUiWorkspace({ mode: UI_MODE.BUILDING, defaultInputs: governedInputs });
assert.equal(fresh.assumptionModelVersion, ASSUMPTION_MODEL_VERSION.V2);
assert.equal(fresh.assumptionRegistry, null);
assert.equal(fresh.transactionAuthorized, false);
assert.equal(fresh.inputs.maintenanceRate, V2_CANONICAL_ASSUMPTIONS.maintenanceRate);
assert.equal(Object.prototype.hasOwnProperty.call(fresh.inputs, 'exitCapRate'), false,
  'fresh building workspace must still require explicit exit-cap evidence');
assert.equal(Object.prototype.hasOwnProperty.call(fresh.inputs, 'exitTransferFeeRate'), false,
  'fresh building workspace must still require explicit exit-cost evidence');

// Hydration must preserve incomplete override provenance exactly instead of
// repairing it into an approval.
const incompleteRecord = {
  id: 'p25-ui-incomplete',
  name: 'P25 UI Incomplete Override',
  mode: UI_MODE.BUILDING,
  inputs: governedInputs,
  assumptionModelVersion: ASSUMPTION_MODEL_VERSION.V2,
  assumptionRegistry: [overrideRecord({ complete: false })],
};
const incompleteWorkspace = hydrateUiDeal({ record: incompleteRecord, defaultInputs: goldInputs });
assert.equal(incompleteWorkspace.assumptionRegistry.length, 1);
assert.equal(incompleteWorkspace.assumptionRegistry[0].sourceReference, undefined);
assert.equal(incompleteWorkspace.assumptionRegistry[0].approver, undefined);
assert.equal(incompleteWorkspace.assumptionRegistry[0].approvalReference, undefined);
assert.equal(incompleteWorkspace.assumptionRegistry[0].approvedAt, undefined);
assert.equal(incompleteWorkspace.assumptionRegistry[0].approvalStatus, 'PENDING');
assert.equal(incompleteWorkspace.transactionAuthorized, false);

const incompleteState = calculateWorkspaceState(incompleteWorkspace);
assert.equal(incompleteState.decisionReady, false);
assert.equal(incompleteState.recommendationAllowed, false);
assert.equal(incompleteState.investmentGradeEligible, false);
assert.equal(incompleteState.sensitivityReady, false);
assert.equal(incompleteState.criticalOverrideDocumentationRequired, true);
assert.equal(incompleteState.transactionAuthorized, false);
assert.equal(incompleteState.results.decisionStatus, 'INCOMPLETE_INPUTS');
assert.equal(incompleteState.results.analyticalResultsOnly, true);
assert.ok(Number.isFinite(incompleteState.results.npv), 'analytical NPV remains visible under P25 hold');
assert.ok(Number.isFinite(incompleteState.results.irr), 'analytical IRR remains visible under P25 hold');
assert.ok(incompleteState.results.decisionBlockers.includes('CRITICAL_OVERRIDE_SOURCE_EVIDENCE_REQUIRED:maintenanceRate'));
assert.ok(incompleteState.results.decisionBlockers.includes('CRITICAL_OVERRIDE_APPROVER_REQUIRED:maintenanceRate'));

const incompleteAr = buildUiDisclosureViewModel({ governance: incompleteState.governance, locale: 'ar-SA' });
const incompleteEn = buildUiDisclosureViewModel({ governance: incompleteState.governance, locale: 'en' });
assert.equal(incompleteAr.userApprovedAssumptions, false);
assert.equal(incompleteAr.canonicalBaselineIsApprovalEvidence, false);
assert.deepEqual(incompleteAr.canonicalAssumptionKeys, Object.keys(V2_CANONICAL_ASSUMPTIONS));
assert.deepEqual(incompleteAr.approvedAssumptionKeys, []);
assert.equal(incompleteAr.criticalOverrideDocumentationRequired, true);
assert.ok(incompleteAr.criticalOverrideNotice.includes('غير مكتمل') || incompleteAr.criticalOverrideNotice.includes('دون اكتمال'));
assert.ok(incompleteEn.criticalOverrideNotice.includes('critical assumption override'));

// Fully documented provenance may remove the P25 hold, provided independent
// P22/P23 requirements are already satisfied.
const completeRecord = {
  id: 'p25-ui-complete',
  name: 'P25 UI Complete Override',
  mode: UI_MODE.BUILDING,
  inputs: governedInputs,
  assumptionModelVersion: ASSUMPTION_MODEL_VERSION.V2,
  assumptionRegistry: [overrideRecord({ complete: true })],
};
const completeWorkspace = hydrateUiDeal({ record: completeRecord, defaultInputs: goldInputs });
const completeState = calculateWorkspaceState(completeWorkspace);
assert.equal(completeState.criticalOverrideDocumentationRequired, false);
assert.equal(completeState.results.criticalAssumptionOverrideGovernance.status, 'READY');
assert.notEqual(completeState.results.decisionStatus, 'INCOMPLETE_INPUTS',
  'P25 must not impose a hold when override documentation is complete and independent gates are satisfied');
assert.equal(completeState.transactionAuthorized, false,
  'P25 readiness is not transaction authority');

const completeView = buildUiDisclosureViewModel({ governance: completeState.governance, locale: 'en' });
assert.equal(completeView.userApprovedAssumptions, false,
  'a complete override is evidence for that override only, not blanket user approval of the canonical baseline');
assert.equal(completeView.canonicalBaselineIsApprovalEvidence, false);
assert.equal(completeView.criticalOverridesPresent, true);
assert.equal(completeView.criticalOverridesDocumentationComplete, true);
assert.equal(completeView.criticalOverrideApprovalEvidenceStatus, 'EXPLICIT_EVIDENCE_PRESENT');
assert.equal(completeView.criticalOverrideNotice, null);
assert.equal(completeView.transactionAuthorized, false);

console.log('CRITICAL_ASSUMPTION_OVERRIDE_UI_GOVERNANCE_P25=PASS');
