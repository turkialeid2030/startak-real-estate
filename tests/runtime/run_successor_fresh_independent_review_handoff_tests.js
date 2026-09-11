'use strict';

const assert = require('assert');
const crypto = require('crypto');
const {
  MODE,
  AUTHORITY,
  stableStringify,
} = require('../../src/qualification/canonical-baseline-registry');
const {
  STATUS: P64_STATUS,
} = require('../../src/qualification/successor-fresh-reactivation-governance-cycle');
const {
  STATUS,
  p64CycleCore,
  validateP64SuccessorCycle,
  createSuccessorFreshIndependentReviewHandoff,
} = require('../../src/qualification/successor-fresh-independent-review-handoff');

const hashObject = (value) => crypto.createHash('sha256').update(stableStringify(value), 'utf8').digest('hex');
const h = (char) => char.repeat(64);

function p64Fixture() {
  const base = {
    schemaVersion: 1,
    cycleKind: 'SUCCESSOR_FRESH_REACTIVATION_AFTER_FRESH_INCIDENT',
    cycleId: 'cycle:p65-successor',
    ownerActorRef: 'owner:p65',
    preparedAt: '2026-09-10T19:00:00.000Z',
    currentAuthoritativeMode: MODE.LEGACY_FILE_SHA256,
    currentRegistryHashSha256: h('1'),
    currentRegistryContentSha256: h('2'),
    requestedTargetMode: MODE.GOVERNED_COMPOSITE_BASELINE,
    qualifiedSourceCommitSha: 'a'.repeat(40),
    releaseArtifactSha256: h('3'),
    environmentConfigSha256: h('4'),
    cycleRationaleRef: 'rationale:p65-successor',
    cycleEvidenceArtifactSha256: h('5'),
    predecessorIncidentCloseoutPacketHashSha256: h('6'),
    predecessorHumanDecisionRecordHashSha256: h('7'),
    predecessorGovernanceResetRecordHashSha256: h('8'),
    predecessorRootCauseAnalysisSha256: h('9'),
    predecessorCorrectivePreventiveActionSha256: h('b'),
  };
  const hash = hashObject(base);
  const predecessorCycle = {
    incidentId: 'incident:p65',
    incidentRef: 'incident-ref:p65',
    failedFreshCycleId: 'cycle:p65-failed',
    failedFreshReactivationGovernanceCycleHashSha256: h('c'),
    incidentCloseoutPacketHashSha256: base.predecessorIncidentCloseoutPacketHashSha256,
    verifiedFreshIncidentCloseoutDecisionRecordHashSha256: base.predecessorHumanDecisionRecordHashSha256,
    governanceResetRecordHashSha256: base.predecessorGovernanceResetRecordHashSha256,
    rootCauseAnalysisSha256: base.predecessorRootCauseAnalysisSha256,
    correctivePreventiveActionSha256: base.predecessorCorrectivePreventiveActionSha256,
    restoredLegacyRegistryHashSha256: base.currentRegistryHashSha256,
    restoredLegacyRegistryContentSha256: base.currentRegistryContentSha256,
    predecessorFailedFreshCycleHistoricalOnly: true,
    predecessorAuthoritiesReusable: false,
  };
  return {
    ...base,
    status: P64_STATUS.SUCCESSOR_FRESH_REACTIVATION_GOVERNANCE_CYCLE_OPEN_NOT_AUTHORIZED,
    verified: true,
    blockers: [],
    successorFreshReactivationGovernanceCycleHashSha256: hash,
    successorFreshGovernanceCycleOpened: true,
    predecessorP63Reverified: true,
    predecessorCycle,
    predecessorFailedFreshCycleHistoricalOnly: true,
    predecessorFreshReviewerArtifactsAccepted: false,
    predecessorFreshOwnerAuthorizationAccepted: false,
    predecessorFreshActivationPlanAccepted: false,
    predecessorFreshActivationContractAccepted: false,
    predecessorFreshRollbackEvidenceAcceptedAsAuthority: false,
    freshIndependentReviewerDesignationRequired: true,
    freshIndependentReviewRequired: true,
    freshReviewerLifecycleLockRequired: true,
    freshActivationPlanRequired: true,
    freshShadowEvidenceRequired: true,
    freshCutoverRehearsalRequired: true,
    freshCutoverSafetyEvidenceRequired: true,
    freshOwnerActivationAuthorizationRequired: true,
    freshActivationChangeContractRequired: true,
    postActivationReleaseVerifyRequired: true,
    incidentClosureTreatedAsReleaseAuthorization: false,
    reactivationAuthorized: false,
    currentBaselineMutationPerformed: false,
    releaseStillBlocked: true,
    ...AUTHORITY,
  };
}

function designation(p64, overrides = {}) {
  return {
    designationId: 'designation:p65',
    designatedByRef: p64.ownerActorRef,
    reviewerRef: 'reviewer:p65-new',
    reviewerDisplayName: 'Independent Reviewer P65',
    designatedAt: '2026-09-10T19:05:00.000Z',
    designationSourceRef: 'designation-source:p65',
    designationArtifactSha256: h('d'),
    ...overrides,
  };
}

(() => {
  const p64 = p64Fixture();
  assert.strictEqual(hashObject(p64CycleCore(p64)), p64.successorFreshReactivationGovernanceCycleHashSha256);
  assert.deepStrictEqual(validateP64SuccessorCycle(p64), []);

  const input = {
    p64,
    reviewerDesignation: designation(p64),
    reviewRequestId: 'review-request:p65',
    requestedAt: '2026-09-10T19:10:00.000Z',
  };
  const ready = createSuccessorFreshIndependentReviewHandoff(input);
  assert.strictEqual(ready.status, STATUS.SUCCESSOR_FRESH_REVIEW_PACKET_READY_NOT_APPROVED);
  assert.strictEqual(ready.verified, true);
  assert.strictEqual(ready.reviewPacketReady, true);
  assert.strictEqual(ready.successorFreshReviewerDesignated, true);
  assert.strictEqual(ready.independentReviewAccepted, false);
  assert.strictEqual(ready.reviewerIdentityCryptographicallyVerified, false);
  assert.strictEqual(ready.reviewerTrustRootVerified, false);
  assert.strictEqual(ready.successorFreshCryptographicReviewAttestationRequired, true);
  assert.strictEqual(ready.predecessorReviewerAuthorityAccepted, false);
  assert.strictEqual(ready.predecessorActivationAuthorityAccepted, false);
  assert.strictEqual(ready.reactivationAuthorized, false);
  assert.strictEqual(ready.releaseAuthorized, false);
  assert.match(ready.successorFreshReviewPacketHashSha256, /^[a-f0-9]{64}$/);
  assert.match(ready.successorFreshReviewerDesignation.successorFreshReviewerDesignationHashSha256, /^[a-f0-9]{64}$/);

  const deterministic = createSuccessorFreshIndependentReviewHandoff(input);
  assert.strictEqual(deterministic.successorFreshReviewPacketHashSha256, ready.successorFreshReviewPacketHashSha256);
  assert.strictEqual(deterministic.successorFreshReviewerDesignation.successorFreshReviewerDesignationHashSha256, ready.successorFreshReviewerDesignation.successorFreshReviewerDesignationHashSha256);

  const ownerReviewer = createSuccessorFreshIndependentReviewHandoff({ ...input, reviewerDesignation: designation(p64, { reviewerRef: p64.ownerActorRef }) });
  assert(ownerReviewer.blockers.includes('OWNER_AND_SUCCESSOR_FRESH_INDEPENDENT_REVIEWER_MUST_DIFFER'));

  const wrongDesignator = createSuccessorFreshIndependentReviewHandoff({ ...input, reviewerDesignation: designation(p64, { designatedByRef: 'other:actor' }) });
  assert(wrongDesignator.blockers.includes('SUCCESSOR_FRESH_REVIEWER_MUST_BE_DESIGNATED_BY_CYCLE_OWNER'));

  const earlyDesignation = createSuccessorFreshIndependentReviewHandoff({ ...input, reviewerDesignation: designation(p64, { designatedAt: '2026-09-10T18:59:59.000Z' }) });
  assert(earlyDesignation.blockers.includes('SUCCESSOR_FRESH_REVIEWER_DESIGNATION_PRECEDES_CYCLE_OPENING'));

  const earlyRequest = createSuccessorFreshIndependentReviewHandoff({ ...input, requestedAt: '2026-09-10T19:04:59.000Z' });
  assert(earlyRequest.blockers.includes('SUCCESSOR_FRESH_REVIEW_REQUEST_PRECEDES_REVIEWER_DESIGNATION'));

  const tamperedCycle = { ...p64, releaseArtifactSha256: h('e') };
  const cycleTamper = createSuccessorFreshIndependentReviewHandoff({ ...input, p64: tamperedCycle });
  assert(cycleTamper.blockers.includes('P64_SUCCESSOR_FRESH_CYCLE_HASH_MISMATCH'));

  const priorReviewerReuse = createSuccessorFreshIndependentReviewHandoff({
    ...input,
    reviewerDesignation: designation(p64, { nested: { freshReviewerLifecycleLockHashSha256: h('f') } }),
  });
  assert(priorReviewerReuse.blockers.some((code) => code.startsWith('PREDECESSOR_FRESH_REVIEW_OR_ACTIVATION_ARTIFACT_REUSE_NOT_ALLOWED')));

  const priorOwnerReuse = createSuccessorFreshIndependentReviewHandoff({ ...input, verifiedFreshOwnerAuthorizationRecordHashSha256: h('a') });
  assert(priorOwnerReuse.blockers.some((code) => code.startsWith('PREDECESSOR_FRESH_REVIEW_OR_ACTIVATION_ARTIFACT_REUSE_NOT_ALLOWED')));

  const escalation = createSuccessorFreshIndependentReviewHandoff({ ...input, releaseAuthorized: true });
  assert(escalation.blockers.includes('CALLER_AUTHORITY_ESCALATION_NOT_ALLOWED'));

  const secret = createSuccessorFreshIndependentReviewHandoff({ ...input, privateKeyPem: 'forbidden' });
  assert(secret.blockers.some((code) => code.startsWith('PRIVATE_OR_SECRET_KEY_MATERIAL_REJECTED')));

  process.stdout.write('successor fresh independent review handoff tests passed\n');
})();
