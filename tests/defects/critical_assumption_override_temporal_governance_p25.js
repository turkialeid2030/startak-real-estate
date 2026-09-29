'use strict';

const assert = require('assert/strict');
const { calculateInvestmentCase, STUDY_TYPE } = require('../../src/engines');
const { ASSUMPTION_MODEL_VERSION } = require('../../src/assumptions/assumption-model');
const {
  buildCriticalAssumptionOverrideGovernance,
} = require('../../src/assumptions/critical-assumption-override-governance');
const gold = require(require('../config/paths').getGoldBaselinePath());

const goldInputs = gold['RE-GOLD-002_existing_building'].inputs;
const baseInputs = {
  ...goldInputs,
  leaseYears: goldInputs.holdPeriod + 1,
  exitCapRate: 0.07,
  exitTransferFeeRate: 0.05,
  leverageEnabled: false,
};

function completeOverride() {
  return [{
    id: 'maintenanceRate',
    value: 0.06,
    unit: 'ratio',
    critical: true,
    override: true,
    overrideReason: 'P25 temporal-governance regression',
    sourceType: 'INTERNAL_APPROVED_EVIDENCE',
    sourceReference: 'P25-TEMPORAL-SOURCE-001',
    sourceDate: '2020-01-01T00:00:00.000Z',
    evidenceCount: 1,
    confidence: 'HIGH',
    owner: 'investment-team',
    reviewer: 'model-risk',
    approver: 'investment-committee',
    approvalReference: 'P25-TEMPORAL-APPROVAL-001',
    approvedAt: '2020-01-02T00:00:00.000Z',
    approvalStatus: 'APPROVED',
    expiresAt: '2099-12-31T00:00:00.000Z',
  }];
}

function runV2(registry) {
  return calculateInvestmentCase({
    studyType: STUDY_TYPE.EXISTING_BUILDING,
    inputs: baseInputs,
    leverageEnabled: false,
    assumptionModelVersion: ASSUMPTION_MODEL_VERSION.V2,
    assumptionRegistry: registry,
  });
}

const fresh = runV2(completeOverride());
assert.equal(fresh.criticalAssumptionOverrideGovernance.status, 'READY');
assert.equal(fresh.criticalAssumptionOverrideGovernance.decisionReady, true);
assert.notEqual(fresh.decisionStatus, 'INCOMPLETE_INPUTS');

// Expired approval/evidence remains analytically observable but cannot support a decision.
const expired = completeOverride();
expired[0].expiresAt = '2001-01-01T00:00:00.000Z';
const expiredResult = runV2(expired);
assert.equal(expiredResult.NOI, fresh.NOI,
  'expiry governance must not silently erase or rewrite the analytical override');
assert.equal(expiredResult.decisionStatus, 'INCOMPLETE_INPUTS');
assert.equal(expiredResult.analyticalResultsOnly, true);
assert.ok(expiredResult.decisionBlockers.includes('CRITICAL_OVERRIDE_EXPIRED:maintenanceRate'));

// A malformed expiry date is evidence corruption, not an excuse to ignore freshness governance.
const invalidExpiry = completeOverride();
invalidExpiry[0].expiresAt = 'not-a-date';
const invalidExpiryResult = runV2(invalidExpiry);
assert.equal(invalidExpiryResult.NOI, fresh.NOI);
assert.equal(invalidExpiryResult.decisionStatus, 'INCOMPLETE_INPUTS');
assert.ok(invalidExpiryResult.decisionBlockers.includes('CRITICAL_OVERRIDE_EXPIRY_DATE_INVALID:maintenanceRate'));

// An APPROVED status cannot make a future approval date valid today.
const futureApproval = completeOverride();
futureApproval[0].approvedAt = '2099-01-01T00:00:00.000Z';
const futureApprovalResult = runV2(futureApproval);
assert.equal(futureApprovalResult.NOI, fresh.NOI);
assert.equal(futureApprovalResult.decisionStatus, 'INCOMPLETE_INPUTS');
assert.ok(futureApprovalResult.decisionBlockers.includes('CRITICAL_OVERRIDE_APPROVAL_DATE_IN_FUTURE:maintenanceRate'));

// Likewise, evidence dated in the future cannot support present decision readiness.
const futureSource = completeOverride();
futureSource[0].sourceDate = '2099-01-01T00:00:00.000Z';
const futureSourceResult = runV2(futureSource);
assert.equal(futureSourceResult.NOI, fresh.NOI);
assert.equal(futureSourceResult.decisionStatus, 'INCOMPLETE_INPUTS');
assert.ok(futureSourceResult.decisionBlockers.includes('CRITICAL_OVERRIDE_SOURCE_DATE_IN_FUTURE:maintenanceRate'));

// The lower-level governance helper supports a deterministic as-of boundary for
// audit/replay tests; callers cannot turn invalid temporal evidence into READY.
const deterministicExpired = completeOverride();
deterministicExpired[0].expiresAt = '2026-09-28T23:59:59.000Z';
const deterministicGovernance = buildCriticalAssumptionOverrideGovernance({
  assumptionModelVersion: ASSUMPTION_MODEL_VERSION.V2,
  assumptionRegistry: deterministicExpired,
  asOf: '2026-09-29T00:00:00.000Z',
});
assert.equal(deterministicGovernance.decisionReady, false);
assert.ok(deterministicGovernance.blockers.includes('CRITICAL_OVERRIDE_EXPIRED:maintenanceRate'));

assert.throws(() => buildCriticalAssumptionOverrideGovernance({
  assumptionModelVersion: ASSUMPTION_MODEL_VERSION.V2,
  assumptionRegistry: completeOverride(),
  asOf: 'invalid-as-of',
}), /asOf must be a valid date/);

console.log('CRITICAL_ASSUMPTION_OVERRIDE_TEMPORAL_GOVERNANCE_P25=PASS');
