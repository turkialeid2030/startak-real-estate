'use strict';

const UI_ROLE = Object.freeze({ VIEWER: 'VIEWER', ANALYST: 'ANALYST', REVIEWER: 'REVIEWER' });
const UI_PERMISSION = Object.freeze({
  VIEW_CASE: 'VIEW_CASE',
  VIEW_EVIDENCE: 'VIEW_EVIDENCE',
  RECORD_HUMAN_DISPOSITION: 'RECORD_HUMAN_DISPOSITION',
  EXPORT_DRAFT_REVIEW: 'EXPORT_DRAFT_REVIEW',
});
const REVIEW_DISPOSITION = Object.freeze({
  ACKNOWLEDGED: 'ACKNOWLEDGED',
  RETURN_FOR_EVIDENCE: 'RETURN_FOR_EVIDENCE',
  REJECT_DRAFT: 'REJECT_DRAFT',
});
const AI_VALIDATION_STATUS = Object.freeze({
  GROUNDED_REVIEW_READY: 'GROUNDED_REVIEW_READY',
  HOLD: 'HOLD',
  NOT_EVALUATED: 'NOT_EVALUATED',
});
const C24_STATUS = new Set(['READY_FOR_HUMAN_CASE_REVIEW', 'HOLD', 'NOT_EVALUATED']);
const SHA256_RE = /^[a-f0-9]{64}$/;
const ROLE_PERMISSIONS = Object.freeze({
  [UI_ROLE.VIEWER]: Object.freeze([UI_PERMISSION.VIEW_CASE, UI_PERMISSION.VIEW_EVIDENCE]),
  [UI_ROLE.ANALYST]: Object.freeze([UI_PERMISSION.VIEW_CASE, UI_PERMISSION.VIEW_EVIDENCE, UI_PERMISSION.EXPORT_DRAFT_REVIEW]),
  [UI_ROLE.REVIEWER]: Object.freeze([UI_PERMISSION.VIEW_CASE, UI_PERMISSION.VIEW_EVIDENCE, UI_PERMISSION.RECORD_HUMAN_DISPOSITION, UI_PERMISSION.EXPORT_DRAFT_REVIEW]),
});

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((out, key) => { out[key] = canonicalize(value[key]); return out; }, {});
  }
  return value;
}
function stableJson(value) { return JSON.stringify(canonicalize(value)); }
async function sha256Hex(value) {
  const runtimeCrypto = globalThis.crypto;
  if (!runtimeCrypto?.subtle) throw new Error('C26_UI_CRYPTO_UNAVAILABLE');
  const bytes = new TextEncoder().encode(typeof value === 'string' ? value : stableJson(value));
  const digest = await runtimeCrypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}
function requireText(value, code) { if (typeof value !== 'string' || value.trim() === '') throw new Error(code); return value.trim(); }
function requireSha(value, code) { if (typeof value !== 'string' || !SHA256_RE.test(value)) throw new Error(code); return value; }
function requireIso(value, code) { const v = requireText(value, code); if (Number.isNaN(Date.parse(v))) throw new Error(code); return new Date(v).toISOString(); }
function sortedUniqueSha(values, code) {
  if (!Array.isArray(values)) throw new Error(code);
  const out = values.map((v) => requireSha(v, code));
  if (new Set(out).size !== out.length) throw new Error(`${code}_DUPLICATE`);
  return out.slice().sort();
}
function sameArray(a, b) { return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => v === b[i]); }
function without(record, field) { const copy = { ...record }; delete copy[field]; return copy; }

function accessGrantMaterial(input) {
  return {
    grantId: input.grantId,
    subjectRef: input.subjectRef,
    role: input.role,
    caseId: input.caseId,
    propertyRef: input.propertyRef,
    permissions: input.permissions,
    authorizationEvidenceHashSha256: input.authorizationEvidenceHashSha256,
    issuedAt: input.issuedAt,
    validUntil: input.validUntil,
    transactionAuthorized: false,
    approvalAuthorized: false,
    publicAiAuthorized: false,
    productionDeploymentAuthorized: false,
  };
}
async function createReviewAccessGrant(input) {
  if (!input || typeof input !== 'object') throw new Error('C26_UI_ACCESS_GRANT_REQUIRED');
  if (!Object.values(UI_ROLE).includes(input.role)) throw new Error('C26_UI_ROLE_UNKNOWN');
  const expected = ROLE_PERMISSIONS[input.role].slice().sort();
  const supplied = [...(input.permissions || [])].sort();
  if (!sameArray(expected, supplied)) throw new Error('C26_UI_PERMISSION_SET_MISMATCH');
  if (input.transactionAuthorized === true || input.approvalAuthorized === true || input.publicAiAuthorized === true || input.productionDeploymentAuthorized === true) throw new Error('C26_UI_AUTHORITY_INJECTION_FORBIDDEN');
  const material = accessGrantMaterial({
    grantId: requireText(input.grantId, 'C26_UI_GRANT_ID_REQUIRED'),
    subjectRef: requireText(input.subjectRef, 'C26_UI_SUBJECT_REQUIRED'),
    role: input.role,
    caseId: requireText(input.caseId, 'C26_UI_CASE_ID_REQUIRED'),
    propertyRef: requireText(input.propertyRef, 'C26_UI_PROPERTY_REF_REQUIRED'),
    permissions: expected,
    authorizationEvidenceHashSha256: requireSha(input.authorizationEvidenceHashSha256, 'C26_UI_AUTH_EVIDENCE_HASH_INVALID'),
    issuedAt: requireIso(input.issuedAt, 'C26_UI_ISSUED_AT_INVALID'),
    validUntil: requireIso(input.validUntil, 'C26_UI_VALID_UNTIL_INVALID'),
  });
  if (Date.parse(material.validUntil) <= Date.parse(material.issuedAt)) throw new Error('C26_UI_GRANT_WINDOW_INVALID');
  return Object.freeze({ ...material, accessGrantHashSha256: await sha256Hex(material) });
}
async function verifyReviewAccessGrant(grant, asOf) {
  if (!grant || typeof grant !== 'object' || !Object.values(UI_ROLE).includes(grant.role)) return false;
  const expected = ROLE_PERMISSIONS[grant.role].slice().sort();
  if (!sameArray(expected, grant.permissions)) return false;
  if (!SHA256_RE.test(grant.accessGrantHashSha256 || '') || !SHA256_RE.test(grant.authorizationEvidenceHashSha256 || '')) return false;
  if (grant.transactionAuthorized !== false || grant.approvalAuthorized !== false || grant.publicAiAuthorized !== false || grant.productionDeploymentAuthorized !== false) return false;
  if (await sha256Hex(accessGrantMaterial(grant)) !== grant.accessGrantHashSha256) return false;
  const at = Date.parse(asOf);
  return Number.isFinite(at) && at >= Date.parse(grant.issuedAt) && at <= Date.parse(grant.validUntil);
}

function aiDraftMaterial(input) {
  return {
    draftId: input.draftId,
    caseId: input.caseId,
    propertyRef: input.propertyRef,
    validationStatus: input.validationStatus,
    responseHashSha256: input.responseHashSha256 || null,
    groundingEvidenceHashesSha256: input.groundingEvidenceHashesSha256 || [],
    draftText: input.draftText || null,
    transactionAuthorized: false,
    approvalAuthorized: false,
    publicAiAuthorized: false,
  };
}
async function createAiDraftEnvelope(input) {
  if (!input || typeof input !== 'object') throw new Error('C26_UI_AI_DRAFT_REQUIRED');
  if (!Object.values(AI_VALIDATION_STATUS).includes(input.validationStatus)) throw new Error('C26_UI_AI_VALIDATION_STATUS_UNKNOWN');
  if (input.transactionAuthorized === true || input.approvalAuthorized === true || input.publicAiAuthorized === true) throw new Error('C26_UI_AUTHORITY_INJECTION_FORBIDDEN');
  const ready = input.validationStatus === AI_VALIDATION_STATUS.GROUNDED_REVIEW_READY;
  if (!ready && ((typeof input.draftText === 'string' && input.draftText.trim()) || input.responseHashSha256 || (input.groundingEvidenceHashesSha256 || []).length)) throw new Error('C26_UI_UNGROUNDED_AI_CONTENT_FORBIDDEN');
  const material = aiDraftMaterial({
    draftId: requireText(input.draftId, 'C26_UI_AI_DRAFT_ID_REQUIRED'),
    caseId: requireText(input.caseId, 'C26_UI_CASE_ID_REQUIRED'),
    propertyRef: requireText(input.propertyRef, 'C26_UI_PROPERTY_REF_REQUIRED'),
    validationStatus: input.validationStatus,
    responseHashSha256: ready ? requireSha(input.responseHashSha256, 'C26_UI_AI_RESPONSE_HASH_INVALID') : null,
    groundingEvidenceHashesSha256: ready ? sortedUniqueSha(input.groundingEvidenceHashesSha256, 'C26_UI_AI_GROUNDING_HASH_INVALID') : [],
    draftText: ready ? requireText(input.draftText, 'C26_UI_AI_DRAFT_TEXT_REQUIRED') : null,
  });
  if (ready && material.groundingEvidenceHashesSha256.length === 0) throw new Error('C26_UI_AI_GROUNDING_REQUIRED');
  return Object.freeze({ ...material, aiDraftHashSha256: await sha256Hex(material) });
}
async function verifyAiDraftEnvelope(aiDraft) {
  if (!aiDraft || typeof aiDraft !== 'object' || !Object.values(AI_VALIDATION_STATUS).includes(aiDraft.validationStatus)) return false;
  if (!SHA256_RE.test(aiDraft.aiDraftHashSha256 || '')) return false;
  if (aiDraft.transactionAuthorized !== false || aiDraft.approvalAuthorized !== false || aiDraft.publicAiAuthorized !== false) return false;
  if (aiDraft.validationStatus !== AI_VALIDATION_STATUS.GROUNDED_REVIEW_READY && (aiDraft.draftText || aiDraft.responseHashSha256 || (aiDraft.groundingEvidenceHashesSha256 || []).length)) return false;
  return (await sha256Hex(aiDraftMaterial(aiDraft))) === aiDraft.aiDraftHashSha256;
}

function collectCaseEvidenceHashes(caseResult) {
  const hashes = new Set();
  const add = (v) => { if (typeof v === 'string' && SHA256_RE.test(v)) hashes.add(v); };
  add(caseResult.resultHashSha256); add(caseResult.inputFingerprintSha256);
  for (const stage of caseResult.stageSummary || []) { add(stage.stagePacketHashSha256); add(stage.outputHashSha256); }
  for (const item of caseResult.auditLineage || []) {
    add(item.inputHashSha256); add(item.outputHashSha256); add(item.stagePacketHashSha256);
    for (const h of item.lineageHashesSha256 || []) add(h);
  }
  return [...hashes].sort();
}
async function verifyC24CaseResult(caseResult) {
  if (!caseResult || typeof caseResult !== 'object') return false;
  if (!C24_STATUS.has(caseResult.status)) return false;
  if (!SHA256_RE.test(caseResult.resultHashSha256 || '')) return false;
  if (caseResult.transactionAuthorized !== false || caseResult.approvalAuthorized !== false || caseResult.publicAiAuthorized !== false || caseResult.autonomousActionExecuted !== false || caseResult.productionDeploymentAuthorized !== false || caseResult.commercialGoLive !== 'HOLD') return false;
  return (await sha256Hex(without(caseResult, 'resultHashSha256'))) === caseResult.resultHashSha256;
}

function reviewBundleMaterial(input) {
  return {
    schemaVersion: 1,
    bundleId: input.bundleId,
    createdAt: input.createdAt,
    caseId: input.caseId,
    propertyRef: input.propertyRef,
    caseResult: input.caseResult,
    accessGrant: input.accessGrant,
    evidenceHashesSha256: input.evidenceHashesSha256,
    aiDraft: input.aiDraft || null,
    transactionAuthorized: false,
    approvalAuthorized: false,
    publicAiAuthorized: false,
    productionDeploymentAuthorized: false,
    commercialGoLive: 'HOLD',
  };
}
async function createIntegratedReviewBundle(input) {
  if (!input || typeof input !== 'object') throw new Error('C26_UI_REVIEW_BUNDLE_REQUIRED');
  if (!(await verifyC24CaseResult(input.caseResult))) throw new Error('C26_UI_C24_RESULT_INVALID');
  const createdAt = requireIso(input.createdAt, 'C26_UI_BUNDLE_CREATED_AT_INVALID');
  if (!(await verifyReviewAccessGrant(input.accessGrant, createdAt))) throw new Error('C26_UI_ACCESS_GRANT_INVALID');
  if (input.accessGrant.caseId !== input.caseResult.caseId || input.accessGrant.propertyRef !== input.caseResult.propertyRef) throw new Error('C26_UI_CONTEXT_MISMATCH');
  const evidenceHashesSha256 = sortedUniqueSha(input.evidenceHashesSha256, 'C26_UI_EVIDENCE_HASH_INVALID');
  const requiredEvidence = collectCaseEvidenceHashes(input.caseResult);
  if (requiredEvidence.some((h) => !evidenceHashesSha256.includes(h))) throw new Error('C26_UI_C24_LINEAGE_INCOMPLETE');
  let aiDraft = null;
  if (input.aiDraft) {
    if (!(await verifyAiDraftEnvelope(input.aiDraft))) throw new Error('C26_UI_AI_DRAFT_INVALID');
    if (input.aiDraft.caseId !== input.caseResult.caseId || input.aiDraft.propertyRef !== input.caseResult.propertyRef) throw new Error('C26_UI_AI_CONTEXT_MISMATCH');
    if ((input.aiDraft.groundingEvidenceHashesSha256 || []).some((h) => !evidenceHashesSha256.includes(h))) throw new Error('C26_UI_AI_GROUNDING_NOT_BOUND_TO_EVIDENCE');
    aiDraft = input.aiDraft;
  }
  const material = reviewBundleMaterial({
    bundleId: requireText(input.bundleId, 'C26_UI_BUNDLE_ID_REQUIRED'), createdAt,
    caseId: input.caseResult.caseId, propertyRef: input.caseResult.propertyRef,
    caseResult: input.caseResult, accessGrant: input.accessGrant, evidenceHashesSha256, aiDraft,
  });
  return Object.freeze({ ...material, bundleHashSha256: await sha256Hex(material) });
}
async function validateIntegratedReviewBundle(bundle, asOf) {
  const blockers = [];
  const at = (() => { try { return requireIso(asOf, 'C26_UI_AS_OF_INVALID'); } catch (_) { return null; } })();
  if (!at) blockers.push('C26_UI_AS_OF_INVALID');
  if (!bundle || typeof bundle !== 'object') return { valid: false, blockers: ['C26_UI_REVIEW_BUNDLE_REQUIRED'] };
  if (!SHA256_RE.test(bundle.bundleHashSha256 || '') || (await sha256Hex(reviewBundleMaterial(bundle))) !== bundle.bundleHashSha256) blockers.push('C26_UI_BUNDLE_INTEGRITY_FAILED');
  if (!(await verifyC24CaseResult(bundle.caseResult))) blockers.push('C26_UI_C24_RESULT_INVALID');
  if (bundle.caseId !== bundle.caseResult?.caseId || bundle.propertyRef !== bundle.caseResult?.propertyRef) blockers.push('C26_UI_CONTEXT_MISMATCH');
  if (!at || !(await verifyReviewAccessGrant(bundle.accessGrant, at))) blockers.push('C26_UI_ACCESS_GRANT_INVALID');
  if (bundle.accessGrant?.caseId !== bundle.caseId || bundle.accessGrant?.propertyRef !== bundle.propertyRef) blockers.push('C26_UI_ACCESS_CONTEXT_MISMATCH');
  let evidence = [];
  try { evidence = sortedUniqueSha(bundle.evidenceHashesSha256, 'C26_UI_EVIDENCE_HASH_INVALID'); } catch (e) { blockers.push(e.message); }
  const requiredEvidence = bundle.caseResult ? collectCaseEvidenceHashes(bundle.caseResult) : [];
  if (requiredEvidence.some((h) => !evidence.includes(h))) blockers.push('C26_UI_C24_LINEAGE_INCOMPLETE');
  if (bundle.aiDraft) {
    if (!(await verifyAiDraftEnvelope(bundle.aiDraft))) blockers.push('C26_UI_AI_DRAFT_INVALID');
    if (bundle.aiDraft.caseId !== bundle.caseId || bundle.aiDraft.propertyRef !== bundle.propertyRef) blockers.push('C26_UI_AI_CONTEXT_MISMATCH');
    if ((bundle.aiDraft.groundingEvidenceHashesSha256 || []).some((h) => !evidence.includes(h))) blockers.push('C26_UI_AI_GROUNDING_NOT_BOUND_TO_EVIDENCE');
  }
  if (bundle.transactionAuthorized !== false || bundle.approvalAuthorized !== false || bundle.publicAiAuthorized !== false || bundle.productionDeploymentAuthorized !== false || bundle.commercialGoLive !== 'HOLD') blockers.push('C26_UI_AUTHORITY_INJECTION_FORBIDDEN');
  return { valid: blockers.length === 0, blockers: [...new Set(blockers)].sort() };
}

function presentationMaterial(input) {
  return {
    schemaVersion: 1,
    trusted: true,
    bundleHashSha256: input.bundleHashSha256,
    caseResultHashSha256: input.caseResultHashSha256,
    accessGrantHashSha256: input.accessGrantHashSha256,
    locale: input.locale,
    generatedAt: input.generatedAt,
    caseId: input.caseId,
    propertyRef: input.propertyRef,
    status: input.status,
    blockers: input.blockers,
    stageSummary: input.stageSummary,
    evidenceHashesSha256: input.evidenceHashesSha256,
    aiDraftBoundary: input.aiDraftBoundary,
    aiDraft: input.aiDraft,
    humanReviewStatus: 'NOT_RECORDED',
    transactionAuthorized: false,
    approvalAuthorized: false,
    publicAiAuthorized: false,
    productionDeploymentAuthorized: false,
    commercialGoLive: 'HOLD',
  };
}
async function buildIntegratedReviewPresentation({ bundle, locale = 'ar-SA', asOf }) {
  const generatedAt = requireIso(asOf, 'C26_UI_AS_OF_INVALID');
  const validation = await validateIntegratedReviewBundle(bundle, generatedAt);
  if (!validation.valid) {
    return Object.freeze({ trusted: false, status: 'UNTRUSTED', blockers: validation.blockers, transactionAuthorized: false, approvalAuthorized: false, publicAiAuthorized: false, productionDeploymentAuthorized: false, commercialGoLive: 'HOLD' });
  }
  const normalizedLocale = locale === 'en' ? 'en' : 'ar-SA';
  const aiReady = bundle.aiDraft?.validationStatus === AI_VALIDATION_STATUS.GROUNDED_REVIEW_READY;
  const material = presentationMaterial({
    bundleHashSha256: bundle.bundleHashSha256,
    caseResultHashSha256: bundle.caseResult.resultHashSha256,
    accessGrantHashSha256: bundle.accessGrant.accessGrantHashSha256,
    locale: normalizedLocale, generatedAt, caseId: bundle.caseId, propertyRef: bundle.propertyRef,
    status: bundle.caseResult.status,
    blockers: [...(bundle.caseResult.blockers || [])],
    stageSummary: canonicalize(bundle.caseResult.stageSummary || []),
    evidenceHashesSha256: [...bundle.evidenceHashesSha256],
    aiDraftBoundary: Object.freeze({ validationStatus: bundle.aiDraft?.validationStatus || 'NOT_SUPPLIED', visible: aiReady, label: 'DRAFT / HUMAN REVIEW REQUIRED' }),
    aiDraft: aiReady ? Object.freeze({ draftId: bundle.aiDraft.draftId, draftText: bundle.aiDraft.draftText, responseHashSha256: bundle.aiDraft.responseHashSha256, groundingEvidenceHashesSha256: [...bundle.aiDraft.groundingEvidenceHashesSha256] }) : null,
  });
  return Object.freeze({ ...material, presentationHashSha256: await sha256Hex(material) });
}
async function verifyPresentation(presentation) {
  return !!presentation && presentation.trusted === true && SHA256_RE.test(presentation.presentationHashSha256 || '') && (await sha256Hex(presentationMaterial(presentation))) === presentation.presentationHashSha256;
}

function reviewRecordMaterial(input) {
  return {
    schemaVersion: 1,
    caseId: input.caseId,
    propertyRef: input.propertyRef,
    subjectRef: input.subjectRef,
    disposition: input.disposition,
    note: input.note,
    recordedAt: input.recordedAt,
    caseResultHashSha256: input.caseResultHashSha256,
    presentationHashSha256: input.presentationHashSha256,
    accessGrantHashSha256: input.accessGrantHashSha256,
    deterministicStateBefore: input.deterministicStateBefore,
    deterministicStateAfter: input.deterministicStateBefore,
    transactionAuthorized: false,
    approvalAuthorized: false,
    publicAiAuthorized: false,
    productionDeploymentAuthorized: false,
    commercialGoLive: 'HOLD',
  };
}
async function recordHumanReviewDisposition({ bundle, presentation, subjectRef, disposition, note, recordedAt }) {
  const at = requireIso(recordedAt, 'C26_UI_REVIEW_RECORDED_AT_INVALID');
  if (!(await verifyPresentation(presentation))) throw new Error('C26_UI_PRESENTATION_INVALID');
  if (!(await validateIntegratedReviewBundle(bundle, at)).valid) throw new Error('C26_UI_REVIEW_BUNDLE_INVALID');
  if (bundle.accessGrant.role !== UI_ROLE.REVIEWER || !bundle.accessGrant.permissions.includes(UI_PERMISSION.RECORD_HUMAN_DISPOSITION)) throw new Error('C26_UI_REVIEW_PERMISSION_DENIED');
  if (bundle.accessGrant.subjectRef !== requireText(subjectRef, 'C26_UI_SUBJECT_REQUIRED')) throw new Error('C26_UI_REVIEW_SUBJECT_MISMATCH');
  if (!Object.values(REVIEW_DISPOSITION).includes(disposition)) throw new Error('C26_UI_REVIEW_DISPOSITION_FORBIDDEN');
  const material = reviewRecordMaterial({
    caseId: bundle.caseId, propertyRef: bundle.propertyRef, subjectRef: bundle.accessGrant.subjectRef,
    disposition, note: requireText(note, 'C26_UI_REVIEW_NOTE_REQUIRED'), recordedAt: at,
    caseResultHashSha256: bundle.caseResult.resultHashSha256,
    presentationHashSha256: presentation.presentationHashSha256,
    accessGrantHashSha256: bundle.accessGrant.accessGrantHashSha256,
    deterministicStateBefore: bundle.caseResult.status,
  });
  return Object.freeze({ ...material, reviewRecordHashSha256: await sha256Hex(material) });
}

function exportMaterial(input) {
  return {
    schemaVersion: 1,
    classification: 'DRAFT / NOT AN APPROVAL',
    generatedAt: input.generatedAt,
    locale: input.locale,
    caseId: input.caseId,
    propertyRef: input.propertyRef,
    caseResultHashSha256: input.caseResultHashSha256,
    presentationHashSha256: input.presentationHashSha256,
    accessGrantHashSha256: input.accessGrantHashSha256,
    reviewRecordHashSha256: input.reviewRecordHashSha256 || null,
    aiDraftHashSha256: input.aiDraftHashSha256 || null,
    evidenceHashesSha256: input.evidenceHashesSha256,
    transactionAuthorized: false,
    approvalAuthorized: false,
    publicAiAuthorized: false,
    productionDeploymentAuthorized: false,
    commercialGoLive: 'HOLD',
  };
}
async function createDraftReviewExport({ bundle, presentation, reviewRecord = null, generatedAt }) {
  const at = requireIso(generatedAt, 'C26_UI_EXPORT_GENERATED_AT_INVALID');
  if (!(await verifyPresentation(presentation))) throw new Error('C26_UI_PRESENTATION_INVALID');
  if (!(await validateIntegratedReviewBundle(bundle, at)).valid) throw new Error('C26_UI_REVIEW_BUNDLE_INVALID');
  if (!bundle.accessGrant.permissions.includes(UI_PERMISSION.EXPORT_DRAFT_REVIEW)) throw new Error('C26_UI_EXPORT_PERMISSION_DENIED');
  if (reviewRecord) {
    if (!SHA256_RE.test(reviewRecord.reviewRecordHashSha256 || '') || (await sha256Hex(reviewRecordMaterial(reviewRecord))) !== reviewRecord.reviewRecordHashSha256) throw new Error('C26_UI_REVIEW_RECORD_INVALID');
    if (reviewRecord.caseResultHashSha256 !== bundle.caseResult.resultHashSha256 || reviewRecord.presentationHashSha256 !== presentation.presentationHashSha256 || reviewRecord.accessGrantHashSha256 !== bundle.accessGrant.accessGrantHashSha256) throw new Error('C26_UI_REVIEW_RECORD_BINDING_INVALID');
  }
  const material = exportMaterial({
    generatedAt: at, locale: presentation.locale, caseId: bundle.caseId, propertyRef: bundle.propertyRef,
    caseResultHashSha256: bundle.caseResult.resultHashSha256,
    presentationHashSha256: presentation.presentationHashSha256,
    accessGrantHashSha256: bundle.accessGrant.accessGrantHashSha256,
    reviewRecordHashSha256: reviewRecord?.reviewRecordHashSha256 || null,
    aiDraftHashSha256: bundle.aiDraft?.aiDraftHashSha256 || null,
    evidenceHashesSha256: [...bundle.evidenceHashesSha256],
  });
  return Object.freeze({ ...material, exportHashSha256: await sha256Hex(material) });
}

module.exports = Object.freeze({
  UI_ROLE, UI_PERMISSION, ROLE_PERMISSIONS, REVIEW_DISPOSITION, AI_VALIDATION_STATUS,
  sha256Hex, createReviewAccessGrant, verifyReviewAccessGrant,
  createAiDraftEnvelope, createIntegratedReviewBundle, validateIntegratedReviewBundle,
  buildIntegratedReviewPresentation, recordHumanReviewDisposition, createDraftReviewExport,
  collectCaseEvidenceHashes,
});
