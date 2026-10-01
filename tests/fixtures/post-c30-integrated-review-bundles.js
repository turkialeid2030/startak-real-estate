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

async function buildGrant({ role, subjectRef, caseResult, nowMs, expired = false }) {
  const issuedAt = expired ? iso(nowMs - (4 * 60 * 60 * 1000)) : iso(nowMs - (60 * 60 * 1000));
  const validUntil = expired ? iso(nowMs - (2 * 60 * 60 * 1000)) : iso(nowMs + (4 * 60 * 60 * 1000));
  return createReviewAccessGrant({
    grantId: `GRANT-POST-C30-${role}`,
    subjectRef,
    role,
    caseId: caseResult.caseId,
    propertyRef: caseResult.propertyRef,
    permissions: ROLE_PERMISSIONS[role],
    authorizationEvidenceHashSha256: await sha256Hex(`post-c30-auth-${role}-${expired ? 'expired' : 'active'}`),
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
  });
  const expired = await createIntegratedReviewBundle({
    bundleId: 'BUNDLE-POST-C30-EXPIRED',
    createdAt: iso(nowMs - (3 * 60 * 60 * 1000)),
    caseResult,
    accessGrant: expiredGrant,
    evidenceHashesSha256,
    aiDraft: null,
  });

  const tampered = clone(reviewer);
  tampered.caseResult.status = 'READY_FOR_HUMAN_CASE_REVIEW';

  const incompleteLineage = clone(reviewer);
  incompleteLineage.evidenceHashesSha256 = incompleteLineage.evidenceHashesSha256
    .filter((hash) => hash !== caseResult.auditLineage[0].inputHashSha256);

  const crossContext = clone(reviewer);
  crossContext.accessGrant.caseId = 'CASE-OTHER-CONTEXT';

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
