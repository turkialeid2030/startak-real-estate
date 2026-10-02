'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  PROGRAM_STATE,
  validateAcquisitionMap,
  buildReleaseBlockerLedger,
  evaluateCurrentReleaseBlockerLedger,
} = require('../../tools/c32-release-blocker-ledger');

const ROOT = path.join(__dirname, '..', '..');
const acquisitionMap = JSON.parse(fs.readFileSync(path.join(ROOT, 'release', 'evidence', 'c32-evidence-acquisition-map.json'), 'utf8'));

function makeC30(status = 'NOT_SUPPLIED', integrity = false) {
  const ids = [
    'SECURITY_REVIEW_AUTHORIZATION',
    'PRIVACY_REVIEW_AUTHORIZATION',
    'AI_PROVIDER_PRODUCTION_AUTHORIZATION',
    'SOURCE_RIGHTS_AUTHORIZATION',
    'UAT_HUMAN_APPROVAL',
    'HISTORICAL_REPLAY_EVIDENCE',
    'ROLLBACK_OPERATIONAL_VERIFICATION',
    'LEGAL_REGULATORY_APPROVAL',
  ];
  return {
    handoffState: status === 'REJECTED' ? 'NO_GO_EXTERNAL_REMEDIATION_REQUIRED' : status === 'SUPPLIED_VERIFIED' ? 'EVIDENCE_COMPLETE_AWAITING_INDEPENDENT_RELEASE_DECISION' : 'HOLD_EXTERNAL_EVIDENCE_REQUIRED',
    gates: ids.map((evidenceId) => ({ evidenceId, status, artifactIntegrityVerified: integrity })),
  };
}

function makeC31(status = 'NOT_EVALUATED', verified = false) {
  const ids = [
    'COMPOSITE_BASELINE_SHADOW',
    'FRESH_COMPOSITE_SHADOW',
    'SUCCESSOR_FRESH_COMPOSITE_SHADOW',
    'COMPOSITE_CUTOVER_SAFETY',
    'CANONICAL_SOURCE_HASH',
  ];
  return {
    readinessState: status === 'HOLD' || status === 'MISMATCH' ? 'NO_GO_CANONICAL_REMEDIATION_REQUIRED' : verified ? 'CANONICAL_EVIDENCE_COMPLETE_AWAITING_INDEPENDENT_ACTIVATION_DECISION' : 'HOLD_CANONICAL_INPUTS_REQUIRED',
    gates: ids.map((gateId) => ({ gateId, status, verified })),
  };
}

const current = evaluateCurrentReleaseBlockerLedger({ env: {} });
assert.strictEqual(current.totalRequiredItems, 13);
assert.strictEqual(current.satisfiedCount, 0);
assert.strictEqual(current.waitingCount, 13);
assert.strictEqual(current.remediationCount, 0);
assert.strictEqual(current.programState, PROGRAM_STATE.WAITING);
assert.strictEqual(current.readyForIndependentDecisions, false);
assert.strictEqual(current.releaseDecisionAuthorized, false);
assert.strictEqual(current.canonicalBaselineActivationAuthorized, false);
assert.strictEqual(current.mergeAuthorized, false);
assert.strictEqual(current.deploymentAuthorized, false);
assert.strictEqual(current.commercialGoLiveAuthorized, false);
assert.strictEqual(current.transactionAuthority, false);
assert.strictEqual(current.approvalAuthorized, false);
assert.strictEqual(current.publicAiAuthorized, false);
assert.ok(current.blockers.every((blocker) => blocker.syntheticSubstituteAllowed === false));

const completeSynthetic = buildReleaseBlockerLedger({
  c30: makeC30('SUPPLIED_VERIFIED', true),
  c31: makeC31('VERIFIED', true),
  acquisitionMap,
});
assert.strictEqual(completeSynthetic.satisfiedCount, 13);
assert.strictEqual(completeSynthetic.programState, PROGRAM_STATE.COMPLETE);
assert.strictEqual(completeSynthetic.readyForIndependentDecisions, true);
for (const authorityField of [
  'releaseDecisionAuthorized',
  'canonicalBaselineActivationAuthorized',
  'mergeAuthorized',
  'deploymentAuthorized',
  'commercialGoLiveAuthorized',
  'transactionAuthority',
  'approvalAuthorized',
  'publicAiAuthorized',
]) assert.strictEqual(completeSynthetic[authorityField], false, authorityField);

const remediation = buildReleaseBlockerLedger({
  c30: makeC30('REJECTED', false),
  c31: makeC31('NOT_EVALUATED', false),
  acquisitionMap,
});
assert.strictEqual(remediation.programState, PROGRAM_STATE.REMEDIATION);
assert.strictEqual(remediation.remediationCount, 8);
assert.strictEqual(remediation.readyForIndependentDecisions, false);

const c31Remediation = buildReleaseBlockerLedger({
  c30: makeC30('NOT_SUPPLIED', false),
  c31: makeC31('HOLD', false),
  acquisitionMap,
});
assert.strictEqual(c31Remediation.programState, PROGRAM_STATE.REMEDIATION);
assert.strictEqual(c31Remediation.remediationCount, 5);

const duplicate = JSON.parse(JSON.stringify(acquisitionMap));
duplicate.requests[1].requestKey = duplicate.requests[0].requestKey;
assert.throws(() => validateAcquisitionMap(duplicate, makeC30(), makeC31()), /C32_ACQUISITION_REQUEST_KEYS_DUPLICATE/);

const syntheticAllowed = JSON.parse(JSON.stringify(acquisitionMap));
syntheticAllowed.requests[0].syntheticSubstituteAllowed = true;
assert.throws(() => validateAcquisitionMap(syntheticAllowed, makeC30(), makeC31()), /C32_SYNTHETIC_SUBSTITUTE_MUST_BE_FALSE/);

console.log('C32_RELEASE_BLOCKER_LEDGER=PASS');
console.log('C32_TOTAL_REQUIRED_ITEMS=13');
console.log(`C32_CURRENT_REAL_STATE=${current.programState}`);
console.log('C32_AUTHORITY_SEPARATION=PASS');
