'use strict';

const assert = require('assert');
const {
  createCanonicalBaselineReconstitutionProposal,
} = require('../../src/qualification/canonical-baseline-reconstitution');
const {
  STATUS,
  DECISION_RESULT,
  createCanonicalRebaselineGovernanceDecision,
} = require('../../src/qualification/canonical-rebaseline-governance-decision');

const SHA_A = 'a'.repeat(64);
const SHA_B = 'b'.repeat(64);
const SHA_C = 'c'.repeat(64);
const COMMIT = '1'.repeat(40);

function proposal() {
  return createCanonicalBaselineReconstitutionProposal({
    proposalId: 'rebaseline-001',
    qualifiedSourceCommitSha: COMMIT,
    releaseArtifactSha256: SHA_A,
    environmentConfigSha256: SHA_B,
    preparedByRef: 'owner:turkialeid2030',
    independentReviewerRef: 'reviewer:independent-001',
    preparedAt: '2026-09-09T19:18:00Z',
  });
}

function decision(actorRef, result = DECISION_RESULT.APPROVE, id = 'd1') {
  return {
    decisionId: id,
    actorRef,
    result,
    decisionSourceRef: `evidence://${id}`,
    decisionArtifactSha256: SHA_C,
    decidedAt: '2026-09-09T19:19:00Z',
    rationaleRef: `rationale://${id}`,
  };
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test('P25-01 holds an invalid or absent P24 proposal', () => {
  const out = createCanonicalRebaselineGovernanceDecision({});
  assert.strictEqual(out.status, STATUS.HOLD_REBASELINE_PROPOSAL);
  assert.strictEqual(out.canonicalBaselineChanged, false);
});

test('P25-02 approved owner direction waits for independent review', () => {
  const p = proposal();
  const out = createCanonicalRebaselineGovernanceDecision({
    proposal: p,
    ownerDecision: decision(p.preparedByRef),
  });
  assert.strictEqual(out.status, STATUS.WAITING_FOR_INDEPENDENT_REVIEW);
  assert.deepStrictEqual(out.blockers, ['INDEPENDENT_REVIEW_REQUIRED']);
  assert.strictEqual(out.canonicalBaselineChanged, false);
  assert.strictEqual(out.releaseAuthorized, false);
});

test('P25-03 owner actor must match proposal preparer', () => {
  const p = proposal();
  const out = createCanonicalRebaselineGovernanceDecision({
    proposal: p,
    ownerDecision: decision('owner:someone-else'),
  });
  assert.strictEqual(out.status, STATUS.HOLD_OWNER_DIRECTION);
});

test('P25-04 rejected owner direction remains hold', () => {
  const p = proposal();
  const out = createCanonicalRebaselineGovernanceDecision({
    proposal: p,
    ownerDecision: decision(p.preparedByRef, DECISION_RESULT.REJECT),
  });
  assert.strictEqual(out.status, STATUS.HOLD_OWNER_DIRECTION);
});

test('P25-05 independent reviewer must match proposal reviewer', () => {
  const p = proposal();
  const out = createCanonicalRebaselineGovernanceDecision({
    proposal: p,
    ownerDecision: decision(p.preparedByRef, DECISION_RESULT.APPROVE, 'owner'),
    independentReview: decision('reviewer:wrong', DECISION_RESULT.APPROVE, 'review'),
  });
  assert.strictEqual(out.status, STATUS.HOLD_INDEPENDENT_REVIEW);
});

test('P25-06 independent review rejection remains hold', () => {
  const p = proposal();
  const out = createCanonicalRebaselineGovernanceDecision({
    proposal: p,
    ownerDecision: decision(p.preparedByRef, DECISION_RESULT.APPROVE, 'owner'),
    independentReview: decision(p.independentReviewerRef, DECISION_RESULT.REJECT, 'review'),
  });
  assert.strictEqual(out.status, STATUS.HOLD_INDEPENDENT_REVIEW);
});

test('P25-07 dual approval only enables explicit code-change eligibility', () => {
  const p = proposal();
  const out = createCanonicalRebaselineGovernanceDecision({
    proposal: p,
    ownerDecision: decision(p.preparedByRef, DECISION_RESULT.APPROVE, 'owner'),
    independentReview: decision(p.independentReviewerRef, DECISION_RESULT.APPROVE, 'review'),
  });
  assert.strictEqual(out.status, STATUS.READY_FOR_EXPLICIT_BASELINE_ACTIVATION_CHANGE);
  assert.strictEqual(out.automaticBaselineSwitchAllowed, false);
  assert.strictEqual(out.explicitReviewedCodeChangeRequired, true);
  assert.strictEqual(out.postChangeReleaseVerifyRequired, true);
  assert.strictEqual(out.e2iPolicyReviewRequired, true);
  assert.strictEqual(out.canonicalBaselineChanged, false);
  assert.strictEqual(out.legacyCanonicalEvidenceClosed, false);
  assert.strictEqual(out.existingE2iCanonicalEvidenceSatisfied, false);
  assert.strictEqual(out.releaseAuthorized, false);
  assert.strictEqual(out.mergeAuthorized, false);
  assert.strictEqual(out.deploymentAuthorized, false);
  assert.strictEqual(out.goLiveAuthorized, false);
  assert.strictEqual(out.transactionAuthorized, false);
  assert.ok(/^[a-f0-9]{64}$/.test(out.governanceDecisionHashSha256));
  assert.ok(Object.isFrozen(out));
});

test('P25-08 decision artifact hashes are validated', () => {
  const p = proposal();
  const bad = decision(p.preparedByRef);
  bad.decisionArtifactSha256 = 'not-a-hash';
  const out = createCanonicalRebaselineGovernanceDecision({ proposal: p, ownerDecision: bad });
  assert.strictEqual(out.status, STATUS.HOLD_OWNER_DIRECTION);
});

let passed = 0;
for (const { name, fn } of tests) {
  try {
    fn();
    passed += 1;
  } catch (error) {
    console.error(`FAIL ${name}: ${error.stack || error.message}`);
    process.exitCode = 1;
  }
}

if (passed !== tests.length) process.exit(1);
console.log(`canonical rebaseline governance decision tests: ${passed}/${tests.length} PASS`);
