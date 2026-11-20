'use strict';

// Restores the temporal-evidence invariants of historical P25 PR #461 as a
// scoped, synthetic regression against the modern fail-closed governance API.
// This is NOT live approval evidence and does not enable numeric overrides
// through the production investment engine.
const assert = require('node:assert/strict');
const {
  buildCriticalAssumptionOverrideGovernance,
} = require('../../src/assumptions/critical-assumption-override-governance');
const { ASSUMPTION_MODEL_VERSION } = require('../../src/assumptions/assumption-model');

const AS_OF = '2026-11-20T12:00:00.000Z';
let checks = 0;
function verify(name, callback) {
  callback();
  checks++;
  console.log('P25_TEMPORAL_LEGACY_PARITY_' + String(checks).padStart(2, '0') + ': PASS ' + name);
}
function approvedOverride() {
  return [{
    id: 'maintenanceRate',
    value: 0.06,
    unit: 'ratio',
    critical: true,
    override: true,
    overrideReason: 'Synthetic historical P25 temporal regression',
    sourceType: 'SYNTHETIC_TEST_EVIDENCE',
    sourceReference: 'TEST-SOURCE-2026',
    sourceDate: '2026-09-29T00:00:00.000Z',
    evidenceCount: 1,
    confidence: 'HIGH',
    owner: 'synthetic-team',
    reviewer: 'synthetic-review',
    approver: 'synthetic-approver',
    approvalReference: 'TEST-APPROVAL-2026',
    approvedAt: '2026-09-29T01:00:00.000Z',
    approvalStatus: 'APPROVED',
    expiresAt: '2099-12-31T00:00:00.000Z',
  }];
}
function assess(records, asOf = AS_OF, model = ASSUMPTION_MODEL_VERSION.V2) {
  return buildCriticalAssumptionOverrideGovernance({
    assumptionModelVersion: model,
    assumptionRegistry: records,
    asOf,
  });
}
verify('complete synthetic case is mechanically documented, not external approval', () => {
  const r = assess(approvedOverride());
  assert.equal(r.status, 'READY');
  assert.equal(r.decisionReady, true);
  assert.equal(r.resolvedOverrides.maintenanceRate, 0.06);
  assert.equal(r.overrides[0].provenance.approvalReference, 'TEST-APPROVAL-2026');
});
verify('expired approval blocks decision while retaining analytical override', () => {
  const r = approvedOverride(); r[0].expiresAt = '2001-01-01T00:00:00.000Z';
  const g = assess(r);
  assert.equal(g.decisionReady, false);
  assert.equal(g.resolvedOverrides.maintenanceRate, 0.06);
  assert.ok(g.blockers.includes('CRITICAL_OVERRIDE_EXPIRED:maintenanceRate'));
});
verify('malformed expiry cannot silently bypass temporal evidence check', () => {
  const r = approvedOverride(); r[0].expiresAt = 'not-a-date';
  const g = assess(r);
  assert.equal(g.decisionReady, false);
  assert.ok(g.blockers.includes('CRITICAL_OVERRIDE_EXPIRY_DATE_INVALID:maintenanceRate'));
});
verify('future-dated approval is denied', () => {
  const r = approvedOverride(); r[0].approvedAt = '2099-01-01T00:00:00.000Z';
  const g = assess(r);
  assert.equal(g.decisionReady, false);
  assert.ok(g.blockers.includes('CRITICAL_OVERRIDE_APPROVAL_DATE_IN_FUTURE:maintenanceRate'));
});
verify('future-dated source evidence is denied', () => {
  const r = approvedOverride(); r[0].sourceDate = '2099-01-01T00:00:00.000Z';
  const g = assess(r);
  assert.equal(g.decisionReady, false);
  assert.ok(g.blockers.includes('CRITICAL_OVERRIDE_SOURCE_DATE_IN_FUTURE:maintenanceRate'));
});
verify('as-of boundary makes temporal replays deterministic', () => {
  const r = approvedOverride(); r[0].expiresAt = '2026-09-28T23:59:59.000Z';
  const g = assess(r, '2026-09-29T00:00:00.000Z');
  assert.equal(g.decisionReady, false);
  assert.ok(g.blockers.includes('CRITICAL_OVERRIDE_EXPIRED:maintenanceRate'));
});
verify('unparseable as-of timestamp is refused', () => {
  assert.throws(() => assess(approvedOverride(), 'invalid-as-of'), /asOf must be a valid date/);
});
verify('missing approval fields remain HOLD without fabricating evidence', () => {
  const r = approvedOverride();
  delete r[0].approver; delete r[0].approvalReference; delete r[0].approvedAt;
  r[0].approvalStatus = 'PENDING';
  const g = assess(r);
  assert.equal(g.decisionReady, false);
  for (const code of ['CRITICAL_OVERRIDE_APPROVER_REQUIRED:maintenanceRate',
    'CRITICAL_OVERRIDE_APPROVAL_REFERENCE_REQUIRED:maintenanceRate',
    'CRITICAL_OVERRIDE_APPROVAL_DATE_REQUIRED:maintenanceRate',
    'CRITICAL_OVERRIDE_APPROVAL_STATUS_REQUIRED:maintenanceRate']) {
    assert.ok(g.blockers.includes(code));
  }
});
verify('LEGACY model ignores V2 critical override eligibility', () => {
  const g = assess(approvedOverride(), AS_OF, ASSUMPTION_MODEL_VERSION.LEGACY);
  assert.equal(g.status, 'NOT_APPLICABLE');
  assert.deepEqual(g.resolvedOverrides, {});
  assert.equal(g.hasCriticalOverrides, false);
});
verify('duplicate critical overrides are held without selecting a winner', () => {
  const list = [...approvedOverride(), ...approvedOverride()];
  list[1].value = 0.99;
  const g = assess(list);
  assert.equal(g.decisionReady, false);
  assert.equal(g.resolvedOverrides.maintenanceRate, undefined);
  assert.ok(g.blockers.includes('DUPLICATE_CRITICAL_OVERRIDE:maintenanceRate'));
});
console.log('P25_TEMPORAL_LEGACY_PARITY_V1: PASS (' + checks + ' isolated synthetic checks; NOT external approval)');
