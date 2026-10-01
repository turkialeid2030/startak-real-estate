'use strict';

const {
  UI_ROLE,
  ROLE_PERMISSIONS,
  AI_VALIDATION_STATUS,
  sha256Hex,
  createReviewAccessGrant,
  createAiDraftEnvelope,
  createIntegratedReviewBundle,
  collectCaseEvidenceHashes,
} = require('../../src/presentation/integrated-case-review.js');

function iso(ms) { return new Date(ms).toISOString(); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }

async function sealValidationFixture({ bundleId, createdAt, caseResult, accessGrant, evidenceHashesSha256, aiDraft = null }) {
  // Test-only helper used to construct integrity-valid negative fixtures that
  // the production creator correctly refuses to create. This lets browser E2E
  // exercise the validator's downstream lineage/context gates independently.
  const material = {
    schemaVersion: 1,
    bundleId,
    createdAt,
    caseId: caseResult.caseId,
    propertyRef: caseResult.propertyRef,
    caseResult,
    accessGrant,
    evidenceHashesSha256: [...evidenceHashesSha256].sort(),
    aiDraft,
    transactionAuthorized: false,
    approvalAuthorized: false,
    publicAiAuthorized: false,
    productionDeploymentAuthorized: false,
    commercialGoLive: 'HOLD',
  };
  return Object.freeze({ ...material, bundleHashSha256: await sha256Hex(material) });
}

async function buildCaseResult(nowMs) {
  const h = (value) => sha256Hex(String(value));
  const stageInput = await h('post-c30-browser-stage-input');
  const stageOutput = await h('post-c30-browser-stage-output');
  const lineage = await h('post-c30-browser-lineage');
  const packetHash = await h('post-c30-browser-stage-packet');
  const inputFingerprint = await h('post-c30-browser-input-fingerprint');

  const core = {
    capability: 'C24_INTEGRATED_CASE_PROPERTY_ORCHESTRATION_V1',
    policyVersion: 'C24_CASE_ORCHESTRATION_POLICY_V1',
    executionId: 'EXEC-POST-C30-BROWSER-1',
    caseId: 'CASE-POST-C30-BROWSER',
    propertyRef: 'PROP-POST-C30-BROWSER',
    marketScopeRef: null,
    asOf: iso(nowMs - (5 * 60 * 60 * 1000)),
    status: 'HOLD',
    blockers: ['SOURCE_ACQUISITION_PROVENANCE:RIGHTS_EVIDENCE_REQUIRED'],
    riskFlags: [],
    stageSummary: [{
      stageId: 'SOURCE_ACQUISITION_PROVENANCE',
      capabilityRef: 'C2N_SOURCE_ACQUISITION',
      status: 'HOLD',
      blockers: ['RIGHTS_EVIDENCE_REQUIRED'],
      stagePacketHashSha256: packetHash,
      outputHashSha256: stageOutput,
    }],
    inputFingerprintSha256: inputFingerprint,
    auditLineage: [{
      stageId: 'SOURCE_ACQUISITION_PROVENANCE',
      capabilityRef: 'C2N_SOURCE_ACQUISITION',
      inputHashSha256: stageInput,
      outputHashSha256: stageOutput,
      lineageHashesSha256: [lineage],
      stagePacketHashSha256: packetHash,
    }],
    humanCaseReviewReady: false,
    aiOverrideApplied: false,
    transactionAuthorized: false,
    approvalAuthorized: false,
    publicAiAuthorized: false,
    autonomousActionExecuted: false,
    productionDeploymentAuthorized: false,
    commercialGoLive: 'HOLD',
  };
  return Object.freeze({ ...core, resultHashSha256: await sha256Hex(core) });
}

async function buildGrant({
  role,
  subjectRef,
  caseResult,
  nowMs,
  expired = false,
  caseId = caseResult.caseId,
  propertyRef = caseResult.propertyRef,
  grantSuffix = role,
}) {
  const issuedAt = expired ? iso(nowMs - (4 * 60 * 60 * 1000)) : iso(nowMs - (60 * 60 * 1000));
  const validUntil = expired ? iso(nowMs - (2 * 60 * 60 * 1000)) : iso(nowMs + (4 * 60 * 60 * 1000));
  return createReviewAccessGrant({
    grantId: `GRANT-POST-C30-${grantSuffix}`,
    subjectRef,
    role,
    caseId,
    propertyRef,
    permissions: ROLE_PERMISSIONS[role],
    authorizationEvidenceHashSha256: await sha256Hex(`post-c30-auth-${grantSuffix}-${expired ? 'expired' : 'active'}`),
    issuedAt,
    validUntil,
    transactionAuthorized: false,
    approvalAuthorized: false,
    publicAiAuthorized: false,
    productionDeploymentAuthorized: false,
  });
}

async function buildPostC30IntegratedReviewBundles({ now = new Date() } = {}) {
  const nowMs = now.getTime();
  const caseResult = await buildCaseResult(nowMs);
  const evidenceHashesSha256 = collectCaseEvidenceHashes(caseResult);
  const stageOutput = caseResult.stageSummary[0].outputHashSha256;

  const reviewerGrant = await buildGrant({
    role: UI_ROLE.REVIEWER,
    subjectRef: 'USER-POST-C30-REVIEWER',
    caseResult,
    nowMs,
  });
  const aiDraft = await createAiDraftEnvelope({
    draftId: 'AI-DRAFT-POST-C30-BROWSER',
    caseId: caseResult.caseId,
    propertyRef: caseResult.propertyRef,
    validationStatus: AI_VALIDATION_STATUS.GROUNDED_REVIEW_READY,
    responseHashSha256: await sha256Hex('post-c30-grounded-browser-response'),
    groundingEvidenceHashesSha256: [stageOutput],
    draftText: 'Grounded browser draft. Human review is still required.',
    transactionAuthorized: false,
    approvalAuthorized: false,
    publicAiAuthorized: false,
  });
  const reviewer = await createIntegratedReviewBundle({
    bundleId: 'BUNDLE-POST-C30-REVIEWER',
    createdAt: iso(nowMs - (30 * 60 * 1000)),
    caseResult,
    accessGrant: reviewerGrant,
    evidenceHashesSha256,
    aiDraft,
  });

  const viewerGrant = await buildGrant({
    role: UI_ROLE.VIEWER,
    subjectRef: 'USER-POST-C30-VIEWER',
    caseResult,
    nowMs,
  });
  const viewer = await createIntegratedReviewBundle({
    bundleId: 'BUNDLE-POST-C30-VIEWER',
    createdAt: iso(nowMs - (25 * 60 * 1000)),
    caseResult,
    accessGrant: viewerGrant,
    evidenceHashesSha256,
    aiDraft: null,
  });

  const expiredGrant = await buildGrant({
    role: UI_ROLE.REVIEWER,
    subjectRef: 'USER-POST-C30-EXPIRED',
    caseResult,
    nowMs,
    expired: true,
    grantSuffix: 'EXPIRED',
  });
  const expired = await sealValidationFixture({
    bundleId: 'BUNDLE-POST-C30-EXPIRED',
    createdAt: iso(nowMs - (3 * 60 * 60 * 1000)),
    caseResult,
    accessGrant: expiredGrant,
    evidenceHashesSha256,
  });

  // Integrity-tamper fixture: mutation deliberately occurs after the signed
  // bundle is created so validation must fail at the bundle integrity gate.
  const tampered = clone(reviewer);
  tampered.caseResult.status = 'READY_FOR_HUMAN_CASE_REVIEW';

  // Test-only sealed invalid bundle: creation API would reject this lineage
  // omission, so we seal it directly to prove the runtime validator fails at
  // C26_UI_C24_LINEAGE_INCOMPLETE rather than only at integrity validation.
  const incompleteEvidence = evidenceHashesSha256
    .filter((hash) => hash !== caseResult.auditLineage[0].inputHashSha256);
  const incompleteLineage = await sealValidationFixture({
    bundleId: 'BUNDLE-POST-C30-INCOMPLETE-LINEAGE',
    createdAt: iso(nowMs - (20 * 60 * 1000)),
    caseResult,
    accessGrant: reviewerGrant,
    evidenceHashesSha256: incompleteEvidence,
  });

  // A valid independently hashed grant for another case is placed inside an
  // integrity-valid test fixture, exercising the access-context mismatch gate.
  const otherContextGrant = await buildGrant({
    role: UI_ROLE.REVIEWER,
    subjectRef: 'USER-POST-C30-CROSS-CONTEXT',
    caseResult,
    nowMs,
    caseId: 'CASE-OTHER-CONTEXT',
    propertyRef: caseResult.propertyRef,
    grantSuffix: 'CROSS-CONTEXT',
  });
  const crossContext = await sealValidationFixture({
    bundleId: 'BUNDLE-POST-C30-CROSS-CONTEXT',
    createdAt: iso(nowMs - (15 * 60 * 1000)),
    caseResult,
    accessGrant: otherContextGrant,
    evidenceHashesSha256,
  });

  return Object.freeze({
    reviewer,
    viewer,
    expired,
    tampered,
    incompleteLineage,
    crossContext,
    caseResult,
  });
}

module.exports = { buildPostC30IntegratedReviewBundles };
