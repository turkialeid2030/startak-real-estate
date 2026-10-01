'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  UI_ROLE,
  ROLE_PERMISSIONS,
  REVIEW_DISPOSITION,
  AI_VALIDATION_STATUS,
  sha256Hex,
  createReviewAccessGrant,
  createAiDraftEnvelope,
  createIntegratedReviewBundle,
  validateIntegratedReviewBundle,
  buildIntegratedReviewPresentation,
  recordHumanReviewDisposition,
  createDraftReviewExport,
  collectCaseEvidenceHashes,
} = require('../../src/presentation/integrated-case-review.js');

(async () => {
  const h = (value) => sha256Hex(String(value));
  const stageInput = await h('c26-ui-stage-input');
  const stageOutput = await h('c26-ui-stage-output');
  const lineage = await h('c26-ui-lineage');
  const packetHash = await h('c26-ui-stage-packet');
  const inputFingerprint = await h('c26-ui-input-fingerprint');

  const caseCore = {
    capability: 'C24_INTEGRATED_CASE_PROPERTY_ORCHESTRATION_V1',
    policyVersion: 'C24_CASE_ORCHESTRATION_POLICY_V1',
    executionId: 'EXEC-C26-UI-1',
    caseId: 'CASE-C26-UI',
    propertyRef: 'PROP-C26-UI',
    marketScopeRef: null,
    asOf: '2026-10-01T18:00:00.000Z',
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
  const caseResult = Object.freeze({ ...caseCore, resultHashSha256: await sha256Hex(caseCore) });

  const reviewerGrant = await createReviewAccessGrant({
    grantId: 'GRANT-C26-UI-REVIEWER',
    subjectRef: 'USER-C26-UI-REVIEWER',
    role: UI_ROLE.REVIEWER,
    caseId: caseResult.caseId,
    propertyRef: caseResult.propertyRef,
    permissions: ROLE_PERMISSIONS[UI_ROLE.REVIEWER],
    authorizationEvidenceHashSha256: await h('reviewer-auth-evidence'),
    issuedAt: '2026-10-01T18:00:00Z',
    validUntil: '2026-10-03T18:00:00Z',
    transactionAuthorized: false,
    approvalAuthorized: false,
    publicAiAuthorized: false,
    productionDeploymentAuthorized: false,
  });

  const evidenceHashesSha256 = collectCaseEvidenceHashes(caseResult);
  const aiDraft = await createAiDraftEnvelope({
    draftId: 'AI-DRAFT-C26-UI',
    caseId: caseResult.caseId,
    propertyRef: caseResult.propertyRef,
    validationStatus: AI_VALIDATION_STATUS.GROUNDED_REVIEW_READY,
    responseHashSha256: await h('grounded-ai-response'),
    groundingEvidenceHashesSha256: [stageOutput],
    draftText: 'Grounded draft content for controlled human review.',
    transactionAuthorized: false,
    approvalAuthorized: false,
    publicAiAuthorized: false,
  });

  const bundle = await createIntegratedReviewBundle({
    bundleId: 'BUNDLE-C26-UI',
    createdAt: '2026-10-01T19:00:00Z',
    caseResult,
    accessGrant: reviewerGrant,
    evidenceHashesSha256,
    aiDraft,
  });

  const validation = await validateIntegratedReviewBundle(bundle, '2026-10-01T20:00:00Z');
  assert.strictEqual(validation.valid, true);
  assert.deepStrictEqual(validation.blockers, []);

  const presentation = await buildIntegratedReviewPresentation({ bundle, locale: 'ar-SA', asOf: '2026-10-01T20:00:00Z' });
  assert.strictEqual(presentation.trusted, true);
  assert.strictEqual(presentation.status, 'HOLD');
  assert.strictEqual(presentation.aiDraftBoundary.visible, true);
  assert.strictEqual(presentation.aiDraftBoundary.label, 'DRAFT / HUMAN REVIEW REQUIRED');
  assert.strictEqual(presentation.approvalAuthorized, false);
  assert.strictEqual(presentation.transactionAuthorized, false);
  assert.strictEqual(presentation.publicAiAuthorized, false);
  assert.strictEqual(presentation.commercialGoLive, 'HOLD');

  const reviewRecord = await recordHumanReviewDisposition({
    bundle,
    presentation,
    subjectRef: reviewerGrant.subjectRef,
    disposition: REVIEW_DISPOSITION.RETURN_FOR_EVIDENCE,
    note: 'Required source-rights evidence remains missing.',
    recordedAt: '2026-10-01T20:10:00Z',
  });
  assert.strictEqual(reviewRecord.deterministicStateBefore, 'HOLD');
  assert.strictEqual(reviewRecord.deterministicStateAfter, 'HOLD');
  assert.strictEqual(reviewRecord.approvalAuthorized, false);
  assert.strictEqual(reviewRecord.transactionAuthorized, false);

  const exported = await createDraftReviewExport({ bundle, presentation, reviewRecord, generatedAt: '2026-10-01T20:20:00Z' });
  assert.strictEqual(exported.classification, 'DRAFT / NOT AN APPROVAL');
  assert.strictEqual(exported.caseResultHashSha256, caseResult.resultHashSha256);
  assert.strictEqual(exported.presentationHashSha256, presentation.presentationHashSha256);
  assert.strictEqual(exported.accessGrantHashSha256, reviewerGrant.accessGrantHashSha256);
  assert.strictEqual(exported.reviewRecordHashSha256, reviewRecord.reviewRecordHashSha256);
  assert.strictEqual(exported.approvalAuthorized, false);
  assert.strictEqual(exported.productionDeploymentAuthorized, false);

  const tamperedBundle = { ...bundle, caseResult: { ...bundle.caseResult, status: 'READY_FOR_HUMAN_CASE_REVIEW' } };
  const tamperedPresentation = await buildIntegratedReviewPresentation({ bundle: tamperedBundle, locale: 'en', asOf: '2026-10-01T20:00:00Z' });
  assert.strictEqual(tamperedPresentation.trusted, false);
  assert.strictEqual(tamperedPresentation.caseId, undefined);
  assert.strictEqual(tamperedPresentation.approvalAuthorized, false);

  await assert.rejects(
    () => createAiDraftEnvelope({
      draftId: 'AI-DRAFT-UNGROUNDED', caseId: caseResult.caseId, propertyRef: caseResult.propertyRef,
      validationStatus: AI_VALIDATION_STATUS.HOLD, draftText: 'This must never be rendered.',
    }),
    /C26_UI_UNGROUNDED_AI_CONTENT_FORBIDDEN/,
  );

  const viewerGrant = await createReviewAccessGrant({
    grantId: 'GRANT-C26-UI-VIEWER', subjectRef: 'USER-C26-UI-VIEWER', role: UI_ROLE.VIEWER,
    caseId: caseResult.caseId, propertyRef: caseResult.propertyRef,
    permissions: ROLE_PERMISSIONS[UI_ROLE.VIEWER], authorizationEvidenceHashSha256: await h('viewer-auth'),
    issuedAt: '2026-10-01T18:00:00Z', validUntil: '2026-10-03T18:00:00Z',
  });
  const viewerBundle = await createIntegratedReviewBundle({
    bundleId: 'BUNDLE-C26-UI-VIEWER', createdAt: '2026-10-01T19:00:00Z', caseResult,
    accessGrant: viewerGrant, evidenceHashesSha256, aiDraft: null,
  });
  const viewerPresentation = await buildIntegratedReviewPresentation({ bundle: viewerBundle, locale: 'en', asOf: '2026-10-01T20:00:00Z' });
  await assert.rejects(
    () => recordHumanReviewDisposition({
      bundle: viewerBundle, presentation: viewerPresentation, subjectRef: viewerGrant.subjectRef,
      disposition: REVIEW_DISPOSITION.ACKNOWLEDGED, note: 'Attempted viewer review', recordedAt: '2026-10-01T20:10:00Z',
    }),
    /C26_UI_REVIEW_PERMISSION_DENIED/,
  );
  await assert.rejects(
    () => createDraftReviewExport({ bundle: viewerBundle, presentation: viewerPresentation, generatedAt: '2026-10-01T20:20:00Z' }),
    /C26_UI_EXPORT_PERMISSION_DENIED/,
  );

  const badAuthHash = await h('bad-auth');
  await assert.rejects(
    () => createReviewAccessGrant({
      grantId: 'BAD-GRANT', subjectRef: 'USER', role: UI_ROLE.REVIEWER, caseId: caseResult.caseId, propertyRef: caseResult.propertyRef,
      permissions: ROLE_PERMISSIONS[UI_ROLE.REVIEWER], authorizationEvidenceHashSha256: badAuthHash,
      issuedAt: '2026-10-01T18:00:00Z', validUntil: '2026-10-03T18:00:00Z', approvalAuthorized: true,
    }),
    /C26_UI_AUTHORITY_INJECTION_FORBIDDEN/,
  );

  await assert.rejects(
    () => createIntegratedReviewBundle({
      bundleId: 'INCOMPLETE-LINEAGE', createdAt: '2026-10-01T19:00:00Z', caseResult,
      accessGrant: reviewerGrant, evidenceHashesSha256: [caseResult.resultHashSha256], aiDraft: null,
    }),
    /C26_UI_C24_LINEAGE_INCOMPLETE/,
  );

  assert.strictEqual(Object.values(REVIEW_DISPOSITION).includes('APPROVE'), false);
  assert.strictEqual(Object.values(REVIEW_DISPOSITION).includes('GO_LIVE'), false);
  assert.strictEqual(Object.values(REVIEW_DISPOSITION).includes('TRANSACT'), false);

  const mainPath = path.resolve(__dirname, '../../src/main.jsx');
  const mainSource = fs.readFileSync(mainPath, 'utf8');
  assert.match(mainSource, /import IntegratedCaseReviewPanel from ['"]\.\/components\/IntegratedCaseReviewPanel\.jsx['"]/);
  assert.match(mainSource, /<IntegratedCaseReviewPanel\s*\/>/);

  console.log('C26_INTEGRATED_CASE_REVIEW_UI=PASS');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
