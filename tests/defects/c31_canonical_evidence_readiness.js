'use strict';

const assert = require('assert');
const {
  READINESS_STATE,
  GATE_IDS,
  summarizeCanonicalGateResults,
  evaluateCanonicalEvidenceReadiness,
} = require('../../tools/c31-canonical-evidence-readiness');

function gate(gateId, status, verified = status === 'VERIFIED') {
  return { gateId, status, verified, reasonCode: null };
}

const current = evaluateCanonicalEvidenceReadiness({ env: {} });
assert.strictEqual(current.requiredCanonicalGateCount, 5);
assert.strictEqual(current.gates.length, 5);
assert.strictEqual(current.verifiedCount, 0);
assert.strictEqual(current.missingCount, 5);
assert.strictEqual(current.remediationCount, 0);
assert.strictEqual(current.readinessState, READINESS_STATE.HOLD);
assert.strictEqual(current.readyForIndependentActivationDecision, false);
assert.strictEqual(current.canonicalBaselineActivationAuthorized, false);
assert.strictEqual(current.releaseDecisionAuthorized, false);
assert.strictEqual(current.mergeAuthorized, false);
assert.strictEqual(current.deploymentAuthorized, false);
assert.strictEqual(current.commercialGoLiveAuthorized, false);
assert.strictEqual(current.transactionAuthority, false);
assert.strictEqual(current.approvalAuthorized, false);
assert.strictEqual(current.publicAiAuthorized, false);
for (const item of current.gates) assert.strictEqual(item.status, 'NOT_EVALUATED');

const complete = summarizeCanonicalGateResults(GATE_IDS.map((id) => gate(id, 'VERIFIED', true)));
assert.strictEqual(complete.verifiedCount, 5);
assert.strictEqual(complete.missingCount, 0);
assert.strictEqual(complete.remediationCount, 0);
assert.strictEqual(complete.readinessState, READINESS_STATE.COMPLETE);
assert.strictEqual(complete.readyForIndependentActivationDecision, true);
assert.strictEqual(complete.canonicalBaselineActivationAuthorized, false);
assert.strictEqual(complete.releaseDecisionAuthorized, false);
assert.strictEqual(complete.deploymentAuthorized, false);
assert.strictEqual(complete.publicAiAuthorized, false);
assert.ok(!complete.readinessState.startsWith('GO'));

const hold = summarizeCanonicalGateResults(GATE_IDS.map((id, index) => gate(id, index === 0 ? 'MISSING_REQUIRED' : 'VERIFIED', index !== 0)));
assert.strictEqual(hold.readinessState, READINESS_STATE.HOLD);
assert.strictEqual(hold.missingCount, 1);
assert.strictEqual(hold.readyForIndependentActivationDecision, false);

const noGo = summarizeCanonicalGateResults(GATE_IDS.map((id, index) => gate(id, index === 2 ? 'HOLD' : 'VERIFIED', index !== 2)));
assert.strictEqual(noGo.readinessState, READINESS_STATE.NO_GO);
assert.strictEqual(noGo.remediationCount, 1);
assert.strictEqual(noGo.readyForIndependentActivationDecision, false);
assert.strictEqual(noGo.canonicalBaselineActivationAuthorized, false);

assert.throws(
  () => summarizeCanonicalGateResults(GATE_IDS.slice(0, 4).map((id) => gate(id, 'VERIFIED', true))),
  /C31_CANONICAL_GATE_SET_INVALID/
);
assert.throws(
  () => summarizeCanonicalGateResults([
    gate(GATE_IDS[0], 'VERIFIED'),
    gate(GATE_IDS[0], 'VERIFIED'),
    gate(GATE_IDS[2], 'VERIFIED'),
    gate(GATE_IDS[3], 'VERIFIED'),
    gate(GATE_IDS[4], 'VERIFIED'),
  ]),
  /C31_CANONICAL_GATE_IDS_INVALID/
);

console.log('C31_CANONICAL_EVIDENCE_READINESS=PASS');
console.log(`C31_CANONICAL_REQUIRED_GATE_COUNT=${current.requiredCanonicalGateCount}`);
console.log(`C31_CANONICAL_REAL_STATE=${current.readinessState}`);
console.log('C31_CANONICAL_AUTHORITY_SEPARATION=PASS');
