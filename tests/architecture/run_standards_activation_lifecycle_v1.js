'use strict';

const assert = require('assert');
const {
  STANDARD_STATUS,
  REVIEW_STATUS,
  LIFECYCLE_STATE,
  ACTOR_TYPE,
  createStandardLifecycle,
  advanceStandardLifecycle,
} = require('../../src/standards');

let checks = 0;
function check(fn) { fn(); checks++; }

function step(record, toState, data = {}, overrides = {}) {
  return advanceStandardLifecycle(record, {
    toState,
    actorId: overrides.actorId || 'human-reviewer-1',
    actorType: overrides.actorType || ACTOR_TYPE.HUMAN,
    occurredAt: overrides.occurredAt || '2026-09-07T20:00:00Z',
    reason: overrides.reason || `Advance to ${toState}`,
    evidenceRefs: overrides.evidenceRefs || [`EVIDENCE:${toState}`],
    data,
  });
}

function buildToReleaseApproval({
  sourceStatus = STANDARD_STATUS.ACTIVE,
  effectiveDate = '2026-08-01',
  standardId = 'STD-LIFECYCLE-1',
} = {}) {
  let record = createStandardLifecycle({
    standardId,
    currentStandardStatus: sourceStatus,
    detectedAt: '2026-09-01T08:00:00Z',
    detectedBy: 'standards-monitor',
    detectionEvidenceRefs: ['SRC-DETECTION-1'],
  });
  record = step(record, LIFECYCLE_STATE.SOURCE_VERIFICATION);
  record = step(record, LIFECYCLE_STATE.CLASSIFIED, {
    sourceVerified: true,
    officialSource: true,
    sourceEvidenceRef: 'OFFICIAL-SOURCE-1',
    verifiedVersion: '2026.1',
    verifiedSourceStatus: sourceStatus,
    effectiveDate,
  });
  record = step(record, LIFECYCLE_STATE.IMPACT_ASSESSMENT);
  record = step(record, LIFECYCLE_STATE.IMPLEMENTATION, {
    impactAnalysisId: 'IMPACT-1',
  });
  record = step(record, LIFECYCLE_STATE.CONFORMANCE_TEST, {
    implementationVersion: 'IMPL-2026.1',
    affectedArtifactRefs: ['src/standards/contracts.js', 'reports/template-v1'],
  });
  record = step(record, LIFECYCLE_STATE.PROFESSIONAL_LEGAL_REVIEW, {
    conformancePassed: true,
    regressionPassed: true,
    conformanceTestRunId: 'CONF-RUN-1',
    regressionTestRunId: 'REG-RUN-1',
  });
  record = step(record, LIFECYCLE_STATE.RELEASE_APPROVAL, {
    professionalReviewStatus: REVIEW_STATUS.APPROVED,
    professionalReviewApprovalId: 'PRO-APPROVAL-1',
    legalReviewStatus: REVIEW_STATUS.APPROVED,
    legalReviewApprovalId: 'LEGAL-APPROVAL-1',
  });
  return record;
}

// Creation is non-enforcing and transaction authority is always false.
const initial = createStandardLifecycle({
  standardId: 'STD-TEST-FUTURE',
  currentStandardStatus: STANDARD_STATUS.FUTURE,
  detectedAt: '2026-09-01T08:00:00Z',
  detectedBy: 'standards-monitor',
  detectionEvidenceRefs: ['SRC-DETECTION-1'],
});
check(() => assert.strictEqual(initial.lifecycleState, LIFECYCLE_STATE.DETECTED));
check(() => assert.strictEqual(initial.productionEnforcementAuthorized, false));
check(() => assert.strictEqual(initial.transactionAuthorized, false));
check(() => assert.strictEqual(initial.currentStandardStatus, STANDARD_STATUS.FUTURE));
check(() => assert.ok(Object.isFrozen(initial)));
check(() => assert.throws(
  () => createStandardLifecycle({ standardId: 'X', currentStandardStatus: 'INVALID', detectedBy: 'reviewer' }),
  /currentStandardStatus is invalid/,
));

// Direct jumps are forbidden.
check(() => assert.throws(
  () => step(initial, LIFECYCLE_STATE.CLASSIFIED),
  (error) => error && error.code === 'STANDARD_LIFECYCLE_TRANSITION_FORBIDDEN',
));

let sourceReview = step(initial, LIFECYCLE_STATE.SOURCE_VERIFICATION);
check(() => assert.strictEqual(sourceReview.lifecycleState, LIFECYCLE_STATE.SOURCE_VERIFICATION));
check(() => assert.strictEqual(sourceReview.history.length, 1));
check(() => assert.strictEqual(sourceReview.history[0].actorType, ACTOR_TYPE.HUMAN));

// Source verification must be explicit, official, and evidence-backed.
check(() => assert.throws(
  () => step(sourceReview, LIFECYCLE_STATE.CLASSIFIED, {}),
  (error) => error && error.code === 'STANDARD_LIFECYCLE_GATE_BLOCKED'
    && error.gateReasons.includes('STANDARD_SOURCE_UNVERIFIED')
    && error.gateReasons.includes('STANDARD_OFFICIAL_SOURCE_UNVERIFIED')
    && error.gateReasons.includes('STANDARD_SOURCE_EVIDENCE_MISSING'),
));

const sourceHold = step(sourceReview, LIFECYCLE_STATE.HOLD_SOURCE_UNVERIFIED);
check(() => assert.strictEqual(sourceHold.lifecycleState, LIFECYCLE_STATE.HOLD_SOURCE_UNVERIFIED));
sourceReview = step(sourceHold, LIFECYCLE_STATE.SOURCE_VERIFICATION);

let classified = step(sourceReview, LIFECYCLE_STATE.CLASSIFIED, {
  sourceVerified: true,
  officialSource: true,
  sourceEvidenceRef: 'OFFICIAL-SOURCE-FUTURE',
});
check(() => assert.strictEqual(classified.sourceVerified, true));
check(() => assert.strictEqual(classified.officialSource, true));
check(() => assert.strictEqual(classified.productionEnforcementAuthorized, false));

// Version/status must be classified before impact analysis.
check(() => assert.throws(
  () => step(classified, LIFECYCLE_STATE.IMPACT_ASSESSMENT),
  (error) => error && error.gateReasons.includes('STANDARD_VERSION_UNVERIFIED')
    && error.gateReasons.includes('STANDARD_STATUS_UNVERIFIED'),
));
const versionHold = step(classified, LIFECYCLE_STATE.HOLD_VERSION_UNVERIFIED);
check(() => assert.strictEqual(versionHold.lifecycleState, LIFECYCLE_STATE.HOLD_VERSION_UNVERIFIED));
classified = step(versionHold, LIFECYCLE_STATE.CLASSIFIED);

let impact = step(classified, LIFECYCLE_STATE.IMPACT_ASSESSMENT, {
  verifiedVersion: '2026.1',
  verifiedSourceStatus: STANDARD_STATUS.FUTURE,
  effectiveDate: '2026-10-01',
});
check(() => assert.strictEqual(impact.verifiedVersion, '2026.1'));
check(() => assert.strictEqual(impact.verifiedSourceStatus, STANDARD_STATUS.FUTURE));
check(() => assert.strictEqual(impact.effectiveDate, '2026-10-01'));

// Invalid real date is blocked; no rollover dates are accepted.
const invalidDateClassified = step(
  step(createStandardLifecycle({
    standardId: 'STD-BAD-DATE',
    currentStandardStatus: STANDARD_STATUS.UNDER_REVIEW,
    detectedBy: 'monitor',
  }), LIFECYCLE_STATE.SOURCE_VERIFICATION),
  LIFECYCLE_STATE.CLASSIFIED,
  { sourceVerified: true, officialSource: true, sourceEvidenceRef: 'SRC' },
);
check(() => assert.throws(
  () => step(invalidDateClassified, LIFECYCLE_STATE.IMPACT_ASSESSMENT, {
    verifiedVersion: '1',
    verifiedSourceStatus: STANDARD_STATUS.UNDER_REVIEW,
    effectiveDate: '2026-02-31',
  }),
  (error) => error && error.gateReasons.includes('STANDARD_EFFECTIVE_DATE_INVALID'),
));

// Impact analysis is mandatory before implementation.
check(() => assert.throws(
  () => step(impact, LIFECYCLE_STATE.IMPLEMENTATION),
  (error) => error && error.gateReasons.includes('STANDARD_IMPACT_ANALYSIS_INCOMPLETE'),
));
const impactHold = step(impact, LIFECYCLE_STATE.HOLD_IMPACT_INCOMPLETE);
check(() => assert.strictEqual(impactHold.lifecycleState, LIFECYCLE_STATE.HOLD_IMPACT_INCOMPLETE));
impact = step(impactHold, LIFECYCLE_STATE.IMPACT_ASSESSMENT);
let implementation = step(impact, LIFECYCLE_STATE.IMPLEMENTATION, { impactAnalysisId: 'IMPACT-FUTURE-1' });
check(() => assert.strictEqual(implementation.impactAnalysisId, 'IMPACT-FUTURE-1'));

// Implementation must declare version and affected artifacts before conformance test.
check(() => assert.throws(
  () => step(implementation, LIFECYCLE_STATE.CONFORMANCE_TEST),
  (error) => error && error.gateReasons.includes('STANDARD_IMPLEMENTATION_VERSION_MISSING')
    && error.gateReasons.includes('STANDARD_AFFECTED_ARTIFACTS_MISSING'),
));
let conformance = step(implementation, LIFECYCLE_STATE.CONFORMANCE_TEST, {
  implementationVersion: 'W7C-IMPL-1',
  affectedArtifactRefs: ['src/standards/lifecycle.js'],
});
check(() => assert.strictEqual(conformance.implementationVersion, 'W7C-IMPL-1'));
check(() => assert.deepStrictEqual(conformance.affectedArtifactRefs, ['src/standards/lifecycle.js']));

// Failed/missing conformance evidence cannot progress to professional/legal review.
check(() => assert.throws(
  () => step(conformance, LIFECYCLE_STATE.PROFESSIONAL_LEGAL_REVIEW, {
    conformancePassed: false,
    regressionPassed: true,
    conformanceTestRunId: 'CONF-FAIL',
    regressionTestRunId: 'REG-1',
  }),
  (error) => error && error.gateReasons.includes('STANDARD_CONFORMANCE_TEST_FAILED'),
));
const testHold = step(conformance, LIFECYCLE_STATE.HOLD_TEST_FAILURE);
check(() => assert.strictEqual(testHold.lifecycleState, LIFECYCLE_STATE.HOLD_TEST_FAILURE));
conformance = step(testHold, LIFECYCLE_STATE.CONFORMANCE_TEST);
let professionalReview = step(conformance, LIFECYCLE_STATE.PROFESSIONAL_LEGAL_REVIEW, {
  conformancePassed: true,
  regressionPassed: true,
  conformanceTestRunId: 'CONF-PASS',
  regressionTestRunId: 'REG-PASS',
});
check(() => assert.strictEqual(professionalReview.conformancePassed, true));
check(() => assert.strictEqual(professionalReview.regressionPassed, true));

// AI cannot approve the professional/legal review gate.
check(() => assert.throws(
  () => step(professionalReview, LIFECYCLE_STATE.RELEASE_APPROVAL, {
    professionalReviewStatus: REVIEW_STATUS.APPROVED,
    professionalReviewApprovalId: 'PRO-AI',
    legalReviewStatus: REVIEW_STATUS.APPROVED,
    legalReviewApprovalId: 'LEGAL-AI',
  }, { actorType: ACTOR_TYPE.AI, actorId: 'ai-reviewer' }),
  (error) => error && error.gateReasons.includes('AI_CANNOT_APPROVE_STANDARD_REVIEW'),
));
check(() => assert.throws(
  () => step(professionalReview, LIFECYCLE_STATE.RELEASE_APPROVAL, {
    professionalReviewStatus: REVIEW_STATUS.PENDING,
    legalReviewStatus: REVIEW_STATUS.PENDING,
  }),
  (error) => error && error.gateReasons.includes('STANDARD_PROFESSIONAL_REVIEW_UNAPPROVED')
    && error.gateReasons.includes('STANDARD_LEGAL_REVIEW_UNAPPROVED'),
));
const reviewHold = step(professionalReview, LIFECYCLE_STATE.HOLD_REVIEW_REQUIRED);
check(() => assert.strictEqual(reviewHold.lifecycleState, LIFECYCLE_STATE.HOLD_REVIEW_REQUIRED));
professionalReview = step(reviewHold, LIFECYCLE_STATE.PROFESSIONAL_LEGAL_REVIEW);
let releaseApproval = step(professionalReview, LIFECYCLE_STATE.RELEASE_APPROVAL, {
  professionalReviewStatus: REVIEW_STATUS.APPROVED,
  professionalReviewApprovalId: 'PRO-APPROVAL-FUTURE',
  legalReviewStatus: REVIEW_STATUS.APPROVED,
  legalReviewApprovalId: 'LEGAL-APPROVAL-FUTURE',
});
check(() => assert.strictEqual(releaseApproval.productionEnforcementAuthorized, false));

// FUTURE remains non-enforcing until an explicit human activation on/after effective date.
check(() => assert.throws(
  () => step(releaseApproval, LIFECYCLE_STATE.ACTIVATED, {
    releaseApprovalId: 'RELEASE-1',
    activationApprovalId: 'ACTIVATE-1',
  }, { occurredAt: '2026-09-30T23:59:59Z' }),
  (error) => error && error.gateReasons.includes('FUTURE_STANDARD_NOT_YET_EFFECTIVE'),
));
check(() => assert.throws(
  () => step(releaseApproval, LIFECYCLE_STATE.ACTIVATED, {
    releaseApprovalId: 'RELEASE-1',
    activationApprovalId: 'ACTIVATE-1',
  }, { occurredAt: '2026-10-01T00:00:00Z', actorType: ACTOR_TYPE.SYSTEM, actorId: 'release-bot' }),
  (error) => error && error.gateReasons.includes('HUMAN_STANDARD_ACTIVATION_REQUIRED'),
));
let activated = step(releaseApproval, LIFECYCLE_STATE.ACTIVATED, {
  releaseApprovalId: 'RELEASE-1',
  activationApprovalId: 'ACTIVATE-1',
}, { occurredAt: '2026-10-01T00:00:00Z', actorType: ACTOR_TYPE.HUMAN, actorId: 'authorized-human' });
check(() => assert.strictEqual(activated.lifecycleState, LIFECYCLE_STATE.ACTIVATED));
check(() => assert.strictEqual(activated.proposedStandardStatus, STANDARD_STATUS.ACTIVE));
check(() => assert.strictEqual(activated.productionEnforcementAuthorized, true));
check(() => assert.strictEqual(activated.transactionAuthorized, false));
check(() => assert.strictEqual(activated.activatedAt, '2026-10-01T00:00:00.000Z'));
check(() => assert.ok(Object.isFrozen(activated)));

// DRAFT / UNDER_REVIEW / RETIRED cannot activate even with an old nominal effective date.
for (const status of [STANDARD_STATUS.DRAFT, STANDARD_STATUS.UNDER_REVIEW, STANDARD_STATUS.RETIRED]) {
  const releasable = buildToReleaseApproval({
    sourceStatus: status,
    effectiveDate: '2026-01-01',
    standardId: `STD-BLOCK-${status}`,
  });
  check(() => assert.throws(
    () => step(releasable, LIFECYCLE_STATE.ACTIVATED, {
      releaseApprovalId: `REL-${status}`,
      activationApprovalId: `ACT-${status}`,
    }, { occurredAt: '2026-09-07T20:00:00Z' }),
    (error) => error && error.code === 'STANDARD_LIFECYCLE_GATE_BLOCKED',
  ));
}

// Release approval is itself mandatory.
const activeRelease = buildToReleaseApproval({ sourceStatus: STANDARD_STATUS.ACTIVE, standardId: 'STD-ACTIVE-READY' });
check(() => assert.throws(
  () => step(activeRelease, LIFECYCLE_STATE.ACTIVATED, { activationApprovalId: 'ACT-ONLY' }),
  (error) => error && error.gateReasons.includes('STANDARD_RELEASE_APPROVAL_MISSING'),
));
check(() => assert.throws(
  () => step(activeRelease, LIFECYCLE_STATE.ACTIVATED, { releaseApprovalId: 'REL-ONLY' }),
  (error) => error && error.gateReasons.includes('STANDARD_ACTIVATION_APPROVAL_MISSING'),
));

// Activated standards enter monitoring; monitoring can suspend but cannot self-resume.
let monitoring = step(activated, LIFECYCLE_STATE.MONITORING, {}, { occurredAt: '2026-10-02T00:00:00Z' });
check(() => assert.strictEqual(monitoring.lifecycleState, LIFECYCLE_STATE.MONITORING));
check(() => assert.strictEqual(monitoring.transactionAuthorized, false));
const suspended = step(monitoring, LIFECYCLE_STATE.SUSPENDED, {}, { occurredAt: '2026-10-03T00:00:00Z' });
check(() => assert.strictEqual(suspended.lifecycleState, LIFECYCLE_STATE.SUSPENDED));
check(() => assert.throws(
  () => step(suspended, LIFECYCLE_STATE.MONITORING),
  (error) => error && error.code === 'STANDARD_LIFECYCLE_TRANSITION_FORBIDDEN',
));

console.log(`STANDARDS_ACTIVATION_LIFECYCLE_ARCHITECTURE: PASS (${checks} checks)`);
