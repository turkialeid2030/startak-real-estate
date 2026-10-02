'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  validate,
  EXPECTED_GATES,
} = require('../../tools/c39-historical-evidence-reuse-audit');

const ROOT = path.resolve(__dirname, '../..');
const AUDIT_PATH = path.join(ROOT, 'release/evidence/c39-historical-evidence-reuse-audit.json');
const audit = JSON.parse(fs.readFileSync(AUDIT_PATH, 'utf8'));

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function expectThrow(fn, fragment) {
  let thrown = null;
  try {
    fn();
  } catch (error) {
    thrown = error;
  }
  assert(thrown, `Expected an error containing ${fragment}`);
  assert(String(thrown.message).includes(fragment), `Expected ${fragment}, got ${thrown.message}`);
}

const result = validate(audit);
assert.strictEqual(result.gateCount, 13);
assert.strictEqual(result.currentSatisfied, 0);
assert.strictEqual(result.automaticReuseEligible, 0);
assert.strictEqual(result.currentCandidateEvidencePendingRequiredReview, 1);
assert.strictEqual(result.externalReviewPendingNoCurrentApproval, 2);
assert.strictEqual(result.engineeringOrSyntheticNotExternalEvidence, 3);
assert.strictEqual(result.providerAuthorizationNotPresent, 1);
assert.strictEqual(result.partialHistoricalContextRequiresCurrentAuthorization, 1);
assert.strictEqual(result.currentRealInputsNotSupplied, 4);
assert.strictEqual(result.historicalSourceBytesUnavailableCurrentSourceNotSupplied, 1);
assert.strictEqual(result.rollbackCurrentCandidateEvidencePendingReview, true);
assert.strictEqual(result.historicalContextAutoSatisfiesAnyGate, false);
assert.strictEqual(result.c30DecisionEffect, 'HOLD');
assert.strictEqual(result.c31DecisionEffect, 'HOLD_CANONICAL_INPUTS_REQUIRED');

assert.strictEqual(audit.gates.length, EXPECTED_GATES.length);
for (let i = 0; i < EXPECTED_GATES.length; i += 1) {
  assert.deepStrictEqual(
    [audit.gates[i].framework, audit.gates[i].gateId, audit.gates[i].currentIssue],
    EXPECTED_GATES[i],
  );
  assert.strictEqual(audit.gates[i].currentSatisfied, false);
  assert.strictEqual(audit.gates[i].automaticReuse, false);
}

{
  const mutated = clone(audit);
  mutated.gates[0].currentSatisfied = true;
  expectThrow(() => validate(mutated), 'C39_FALSE_CURRENT_SATISFACTION:SECURITY_REVIEW_AUTHORIZATION');
}

{
  const mutated = clone(audit);
  mutated.gates[1].automaticReuse = true;
  expectThrow(() => validate(mutated), 'C39_FALSE_AUTOMATIC_REUSE:PRIVACY_REVIEW_AUTHORIZATION');
}

{
  const mutated = clone(audit);
  mutated.gates[4].currentGateState = 'SUPPLIED_VERIFIED';
  expectThrow(() => validate(mutated), 'C39_C30_STATE_ESCALATED:UAT_HUMAN_APPROVAL');
}

{
  const mutated = clone(audit);
  mutated.gates[8].currentGateState = 'VERIFIED';
  expectThrow(() => validate(mutated), 'C39_C31_STATE_ESCALATED:COMPOSITE_BASELINE_SHADOW');
}

{
  const mutated = clone(audit);
  mutated.gates[6].eligibility = 'ENGINEERING_ONLY_EXTERNAL_REVIEW_NOT_PRESENT';
  expectThrow(() => validate(mutated), 'C39_ROLLBACK_CLASSIFICATION_INVALID');
}

{
  const mutated = clone(audit);
  mutated.gates[12].expectedSha256 = '0'.repeat(64);
  expectThrow(() => validate(mutated), 'C39_CANONICAL_SOURCE_EXPECTED_HASH_INVALID');
}

{
  const mutated = clone(audit);
  mutated.gates[12].historicalContextReusable = true;
  expectThrow(() => validate(mutated), 'C39_CANONICAL_SOURCE_CONTEXT_MUST_NOT_SUBSTITUTE_BYTES');
}

{
  const mutated = clone(audit);
  mutated.gates[3].historicalRefs.push(mutated.gates[3].historicalRefs[0]);
  expectThrow(() => validate(mutated), 'C39_DUPLICATE_HISTORICAL_REF:SOURCE_RIGHTS_AUTHORIZATION');
}

{
  const mutated = clone(audit);
  mutated.summary.currentRealInputsNotSupplied = 5;
  expectThrow(() => validate(mutated), 'C39_RECORDED_SUMMARY_INVALID:currentRealInputsNotSupplied');
}

{
  const mutated = clone(audit);
  mutated.authority.deploymentAuthorized = true;
  expectThrow(() => validate(mutated), 'C39_AUTHORITY_ESCALATION:deploymentAuthorized');
}

for (const key of [
  'releaseDecisionAuthorized',
  'canonicalBaselineActivationAuthorized',
  'mergeAuthorized',
  'deploymentAuthorized',
  'commercialGoLiveAuthorized',
  'transactionAuthority',
  'approvalAuthorized',
  'publicAiAuthorized',
]) {
  assert.strictEqual(result[key], false, `${key} must remain false`);
}

console.log('C39_HISTORICAL_EVIDENCE_REUSE_AUDIT=PASS');
console.log(`C39_GATE_COUNT=${result.gateCount}`);
console.log(`C39_CURRENT_SATISFIED=${result.currentSatisfied}`);
console.log(`C39_AUTOMATIC_REUSE_ELIGIBLE=${result.automaticReuseEligible}`);
console.log(`C39_ROLLBACK_CURRENT_EVIDENCE_PENDING_REVIEW=${result.rollbackCurrentCandidateEvidencePendingReview ? 1 : 0}`);
console.log(`C39_AUDIT_ARTIFACT_SHA256=${result.auditArtifactSha256}`);
console.log('C39_AUTHORITY_SEPARATION=PASS');
