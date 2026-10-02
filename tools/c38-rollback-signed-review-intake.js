'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const TRUST_PATH = path.join(ROOT, 'release/evidence/c38-rollback-reviewer-trust.json');
const TEMPLATE_PATH = path.join(ROOT, 'release/evidence/c38-rollback-signed-review-response.template.json');
const C36_CANDIDATE_PATH = path.join(ROOT, 'release/evidence/c36-rollback-candidate-evidence.json');
const C37_PAYLOAD_PATH = path.join(ROOT, 'release/evidence/c37-rollback-independent-review-payload.json');

const EXPECTED = Object.freeze({
  evidenceId: 'ROLLBACK_OPERATIONAL_VERIFICATION',
  reviewPurpose: 'INDEPENDENT_OPERATIONAL_ROLLBACK_REHEARSAL_ACCEPTANCE',
  reviewerRef: 'human:said',
  reviewerId: 'reviewer-said-2026-09-17',
  ownerRef: 'github:turkialeid2030',
  ownerDesignationIssue: 592,
  candidateHeadSha: '2f066168f6cdca672d668ff5367ab250fe5cb907',
  rollbackPointSha: 'ba617ef387843b6916bb8da0bf08b16e0922260f',
  c36CandidateArtifactSha256: '4475f40dcbc5d6b2b2edfc1a6584686b6c7f7c29afab1861b4f16ece1ad52409',
  c37ReviewPayloadSha256: 'ba03306c60c65507823c0fb434d0bac09c599fef6fdc0956722f727606b979c9',
  sourceRehearsalReportSha256: 'a0ba299578af8577de23a467bd3f7e410c636b85fa92e8b107ce73ed1498fe76',
  sourceWorkflowRunId: 37046492311,
  sourceWorkflowJobId: 110969106434,
  publicKeySha256: '0af393bd7c091106c3b16e493b4f99d39570c77675c9c5dee175d5a7727ebbc1',
  historicalSourceCommitSha: '5ee9ad2dc5db71c6e0d627f4c27c24d507ee541e',
  historicalRegistryHashSha256: '2cd45d81863afb8d41a30404d5b1cf2113c216abf6ae13e51d6f41e0962d0f53',
  designationRecordedAt: '2026-10-02T19:33:38.000Z',
});

const QUESTION_IDS = Object.freeze([
  'Q1_EXECUTION_REALITY',
  'Q2_SHA_BINDING',
  'Q3_RECOVERY_RESULT',
  'Q4_MATERIAL_DEFECT',
  'Q5_SCOPE_ACCEPTANCE',
]);

const APPROVE_ANSWERS = Object.freeze({
  Q1_EXECUTION_REALITY: 'YES',
  Q2_SHA_BINDING: 'YES',
  Q3_RECOVERY_RESULT: 'YES',
  Q4_MATERIAL_DEFECT: 'NO',
  Q5_SCOPE_ACCEPTANCE: 'YES',
});

const AUTHORITY_KEYS = Object.freeze([
  'releaseDecisionAuthorized',
  'canonicalBaselineActivationAuthorized',
  'mergeAuthorized',
  'deploymentAuthorized',
  'commercialGoLiveAuthorized',
  'transactionAuthority',
  'approvalAuthorized',
  'publicAiAuthorized',
]);

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function sha256Bytes(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function sha256File(filePath) {
  return sha256Bytes(fs.readFileSync(filePath));
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}

function assertEqual(actual, expected, code) {
  if (actual !== expected) fail(code);
}

function assertNoAuthorityEscalation(record, prefix) {
  for (const key of AUTHORITY_KEYS) {
    if (record[key] !== false) fail(`${prefix}_AUTHORITY_ESCALATION:${key}`);
  }
}

function validateTrust(trust) {
  assertEqual(trust.schemaVersion, 1, 'C38_TRUST_SCHEMA_INVALID');
  assertEqual(trust.scope, 'C38_ROLLBACK_REVIEWER_PUBLIC_TRUST', 'C38_TRUST_SCOPE_INVALID');
  assertEqual(trust.trustStatus, 'PUBLIC_KEY_PROVENANCE_VERIFIED_REVIEW_SCOPE_DESIGNATED', 'C38_TRUST_STATUS_INVALID');
  assertEqual(trust.ownerRef, EXPECTED.ownerRef, 'C38_TRUST_OWNER_INVALID');
  assertEqual(trust.ownerDesignationIssue, EXPECTED.ownerDesignationIssue, 'C38_TRUST_DESIGNATION_INVALID');
  assertEqual(trust.reviewerId, EXPECTED.reviewerId, 'C38_TRUST_REVIEWER_ID_INVALID');
  assertEqual(trust.reviewerSubjectRef, EXPECTED.reviewerRef, 'C38_TRUST_REVIEWER_REF_INVALID');
  if (trust.reviewerSubjectRef === trust.ownerRef) fail('C38_TRUST_SELF_REVIEW_FORBIDDEN');
  assertEqual(trust.allowedPurpose, EXPECTED.reviewPurpose, 'C38_TRUST_PURPOSE_INVALID');
  assertEqual(trust.allowedEvidenceId, EXPECTED.evidenceId, 'C38_TRUST_EVIDENCE_ID_INVALID');
  assertEqual(trust.publicKeySha256, EXPECTED.publicKeySha256, 'C38_TRUST_KEY_FINGERPRINT_DECLARATION_INVALID');
  const actualPublicKeyHash = sha256Bytes(Buffer.from(trust.publicKeyPem || '', 'utf8'));
  assertEqual(actualPublicKeyHash, EXPECTED.publicKeySha256, 'C38_TRUST_KEY_FINGERPRINT_MISMATCH');
  assertEqual(trust.historicalSourceCommitSha, EXPECTED.historicalSourceCommitSha, 'C38_TRUST_PROVENANCE_COMMIT_INVALID');
  assertEqual(trust.historicalSourcePath, 'governance/operator-templates/canonical-rebaseline-reviewer-registry.current.json', 'C38_TRUST_PROVENANCE_PATH_INVALID');
  assertEqual(trust.historicalRegistryHashSha256, EXPECTED.historicalRegistryHashSha256, 'C38_TRUST_REGISTRY_HASH_INVALID');
  assertEqual(trust.historicalVerifiedReviewIssue, 254, 'C38_TRUST_HISTORY_ISSUE_INVALID');
  assertEqual(trust.historicalKeyRotationIssue, 367, 'C38_TRUST_ROTATION_ISSUE_INVALID');
  assertEqual(trust.historicalAllowedPurpose, 'CANONICAL_REBASELINE_INDEPENDENT_REVIEW', 'C38_TRUST_HISTORICAL_PURPOSE_INVALID');
  assertEqual(trust.keyActiveFrom, '2026-09-21T06:01:00.000Z', 'C38_TRUST_ACTIVE_FROM_INVALID');
  assertEqual(trust.rollbackDesignationRecordedAt, EXPECTED.designationRecordedAt, 'C38_TRUST_ROLLBACK_DESIGNATION_TIME_INVALID');
  if (trust.activeUntil !== null) fail('C38_TRUST_UNEXPECTED_EXPIRY');
  if (trust.privateKeyStoredInRepository !== false) fail('C38_TRUST_PRIVATE_KEY_BOUNDARY_INVALID');
  if (trust.priorReviewDecisionReusable !== false) fail('C38_TRUST_PRIOR_REVIEW_REUSE_FORBIDDEN');
  if (trust.trustRecordIsEvidenceAcceptance !== false) fail('C38_TRUST_FALSE_EVIDENCE_ACCEPTANCE');
  return { actualPublicKeyHash };
}

function validateRepositoryAnchors() {
  const actualC36 = sha256File(C36_CANDIDATE_PATH);
  const actualC37 = sha256File(C37_PAYLOAD_PATH);
  assertEqual(actualC36, EXPECTED.c36CandidateArtifactSha256, 'C38_C36_CANDIDATE_HASH_MISMATCH');
  assertEqual(actualC37, EXPECTED.c37ReviewPayloadSha256, 'C38_C37_REVIEW_PAYLOAD_HASH_MISMATCH');
  return { actualC36, actualC37 };
}

function validateBaseTuple(r, prefix = 'C38_RESPONSE') {
  assertEqual(r.schemaVersion, 1, `${prefix}_SCHEMA_INVALID`);
  assertEqual(r.scope, 'C38_ROLLBACK_SIGNED_REVIEW_RESPONSE', `${prefix}_SCOPE_INVALID`);
  assertEqual(r.reviewPurpose, EXPECTED.reviewPurpose, `${prefix}_PURPOSE_INVALID`);
  assertEqual(r.evidenceId, EXPECTED.evidenceId, `${prefix}_EVIDENCE_ID_INVALID`);
  assertEqual(r.reviewerRef, EXPECTED.reviewerRef, `${prefix}_REVIEWER_REF_INVALID`);
  assertEqual(r.reviewerId, EXPECTED.reviewerId, `${prefix}_REVIEWER_ID_INVALID`);
  assertEqual(r.ownerRef, EXPECTED.ownerRef, `${prefix}_OWNER_REF_INVALID`);
  if (r.reviewerRef === r.ownerRef) fail(`${prefix}_SELF_REVIEW_FORBIDDEN`);
  assertEqual(r.ownerDesignationIssue, EXPECTED.ownerDesignationIssue, `${prefix}_OWNER_DESIGNATION_INVALID`);
  assertEqual(r.candidateHeadSha, EXPECTED.candidateHeadSha, `${prefix}_CANDIDATE_HEAD_INVALID`);
  assertEqual(r.rollbackPointSha, EXPECTED.rollbackPointSha, `${prefix}_ROLLBACK_POINT_INVALID`);
  assertEqual(r.c36CandidateArtifactSha256, EXPECTED.c36CandidateArtifactSha256, `${prefix}_C36_HASH_INVALID`);
  assertEqual(r.c37ReviewPayloadSha256, EXPECTED.c37ReviewPayloadSha256, `${prefix}_C37_PAYLOAD_HASH_INVALID`);
  assertEqual(r.sourceRehearsalReportSha256, EXPECTED.sourceRehearsalReportSha256, `${prefix}_SOURCE_REPORT_HASH_INVALID`);
  assertEqual(r.sourceWorkflowRunId, EXPECTED.sourceWorkflowRunId, `${prefix}_SOURCE_RUN_INVALID`);
  assertEqual(r.sourceWorkflowJobId, EXPECTED.sourceWorkflowJobId, `${prefix}_SOURCE_JOB_INVALID`);
  assertEqual(r.signatureAlgorithm, 'RSA-SHA256', `${prefix}_SIGNATURE_ALGORITHM_INVALID`);
  if (r.templateIsEvidence !== false) fail(`${prefix}_TEMPLATE_EVIDENCE_FLAG_INVALID`);
  if (r.signedReviewVerified !== false || r.independentReviewAccepted !== false || r.evidenceSatisfied !== false) {
    fail(`${prefix}_PRECLAIMED_ACCEPTANCE_FORBIDDEN`);
  }
  assertEqual(r.c30EvidenceStatus, 'NOT_SUPPLIED_PENDING_INDEPENDENT_REVIEW', `${prefix}_C30_GATE_ESCALATED`);
  assertNoAuthorityEscalation(r, prefix);
}

function validateBlankTemplate(template) {
  validateBaseTuple(template, 'C38_TEMPLATE');
  if (!Array.isArray(template.reviewerAnswers) || template.reviewerAnswers.length !== QUESTION_IDS.length) fail('C38_TEMPLATE_QUESTIONS_INVALID');
  template.reviewerAnswers.forEach((item, index) => {
    assertEqual(item.id, QUESTION_IDS[index], `C38_TEMPLATE_QUESTION_ID_INVALID:${index}`);
    if (item.answer !== null || item.reviewerNote !== null) fail(`C38_TEMPLATE_PREPOPULATED_ANSWER:${item.id}`);
  });
  if (template.reviewDecision !== null || template.reasonCode !== null || template.reviewedAt !== null || template.signatureBase64 !== null) {
    fail('C38_TEMPLATE_FALSE_REVIEW_COMPLETION');
  }
}

function validateCompletedSubstantiveFields(response, now = new Date()) {
  validateBaseTuple(response);
  if (!Array.isArray(response.reviewerAnswers) || response.reviewerAnswers.length !== QUESTION_IDS.length) fail('C38_RESPONSE_QUESTIONS_INVALID');
  const seen = new Set();
  for (let i = 0; i < response.reviewerAnswers.length; i += 1) {
    const item = response.reviewerAnswers[i];
    assertEqual(item.id, QUESTION_IDS[i], `C38_RESPONSE_QUESTION_ID_INVALID:${i}`);
    if (seen.has(item.id)) fail(`C38_RESPONSE_DUPLICATE_QUESTION:${item.id}`);
    seen.add(item.id);
    if (!['YES', 'NO'].includes(item.answer)) fail(`C38_RESPONSE_ANSWER_INVALID:${item.id}`);
    if (item.answer === 'NO' && (typeof item.reviewerNote !== 'string' || !item.reviewerNote.trim())) {
      fail(`C38_RESPONSE_NO_REQUIRES_NOTE:${item.id}`);
    }
    if (item.reviewerNote !== null && typeof item.reviewerNote !== 'string') fail(`C38_RESPONSE_NOTE_INVALID:${item.id}`);
  }

  if (!['APPROVE', 'REJECT', 'HOLD'].includes(response.reviewDecision)) fail('C38_RESPONSE_DECISION_INVALID');
  if (response.reviewDecision === 'APPROVE') {
    for (const item of response.reviewerAnswers) {
      if (item.answer !== APPROVE_ANSWERS[item.id]) fail(`C38_RESPONSE_APPROVE_INCONSISTENT:${item.id}`);
    }
  } else if (typeof response.reasonCode !== 'string' || !response.reasonCode.trim()) {
    fail('C38_RESPONSE_NONAPPROVE_REASON_REQUIRED');
  }

  const reviewedAtMs = Date.parse(response.reviewedAt);
  if (!Number.isFinite(reviewedAtMs)) fail('C38_RESPONSE_REVIEW_TIME_INVALID');
  const designationMs = Date.parse(EXPECTED.designationRecordedAt);
  if (reviewedAtMs < designationMs) fail('C38_RESPONSE_REVIEW_PREDATES_DESIGNATION');
  const nowMs = now instanceof Date ? now.getTime() : Date.parse(now);
  if (!Number.isFinite(nowMs)) fail('C38_VERIFIER_NOW_INVALID');
  if (reviewedAtMs > nowMs + (5 * 60 * 1000)) fail('C38_RESPONSE_REVIEW_TIME_IN_FUTURE');
}

function signingPayloadObject(response) {
  return {
    schemaVersion: response.schemaVersion,
    scope: response.scope,
    reviewPurpose: response.reviewPurpose,
    evidenceId: response.evidenceId,
    reviewerRef: response.reviewerRef,
    reviewerId: response.reviewerId,
    ownerRef: response.ownerRef,
    ownerDesignationIssue: response.ownerDesignationIssue,
    candidateHeadSha: response.candidateHeadSha,
    rollbackPointSha: response.rollbackPointSha,
    c36CandidateArtifactSha256: response.c36CandidateArtifactSha256,
    c37ReviewPayloadSha256: response.c37ReviewPayloadSha256,
    sourceRehearsalReportSha256: response.sourceRehearsalReportSha256,
    sourceWorkflowRunId: response.sourceWorkflowRunId,
    sourceWorkflowJobId: response.sourceWorkflowJobId,
    reviewerAnswers: response.reviewerAnswers,
    reviewDecision: response.reviewDecision,
    reasonCode: response.reasonCode,
    reviewedAt: response.reviewedAt,
    signatureAlgorithm: response.signatureAlgorithm,
  };
}

function canonicalSigningPayload(response) {
  return stableStringify(signingPayloadObject(response));
}

function verifyDetachedRsaSha256(publicKeyPem, payloadUtf8, signatureBase64) {
  if (typeof signatureBase64 !== 'string' || !signatureBase64.trim()) return false;
  let signature;
  try {
    signature = Buffer.from(signatureBase64, 'base64');
  } catch (_error) {
    return false;
  }
  if (!signature.length || signature.toString('base64').replace(/=+$/u, '') !== signatureBase64.trim().replace(/=+$/u, '')) return false;
  try {
    return crypto.verify('RSA-SHA256', Buffer.from(payloadUtf8, 'utf8'), publicKeyPem, signature);
  } catch (_error) {
    return false;
  }
}

function verifySignedResponse(response, { trust, now = new Date() } = {}) {
  const activeTrust = trust || readJson(TRUST_PATH);
  validateTrust(activeTrust);
  validateRepositoryAnchors();
  validateCompletedSubstantiveFields(response, now);
  const payload = canonicalSigningPayload(response);
  if (!verifyDetachedRsaSha256(activeTrust.publicKeyPem, payload, response.signatureBase64)) fail('C38_RESPONSE_RSA_SIGNATURE_INVALID');

  const stateByDecision = {
    APPROVE: 'SIGNED_REVIEW_VERIFIED_READY_FOR_GOVERNED_C30_INTAKE',
    REJECT: 'SIGNED_REVIEW_VERIFIED_REJECTED_READY_FOR_C30_NO_GO_INTAKE',
    HOLD: 'SIGNED_REVIEW_VERIFIED_HOLD_READY_FOR_C30_HOLD_INTAKE',
  };

  return {
    schemaVersion: 1,
    scope: 'C38_SIGNED_ROLLBACK_REVIEW_VERIFICATION_RESULT',
    reviewerRef: response.reviewerRef,
    reviewerId: response.reviewerId,
    reviewDecision: response.reviewDecision,
    reviewedAt: response.reviewedAt,
    signingPayloadSha256: sha256Bytes(Buffer.from(payload, 'utf8')),
    rsaSha256SignatureVerified: true,
    substantiveReviewPresent: true,
    signedReviewVerified: true,
    governedC30IntakeReady: true,
    evidenceSatisfied: false,
    c30EvidenceStatus: 'NOT_SUPPLIED_PENDING_GOVERNED_INTAKE',
    handoffState: stateByDecision[response.reviewDecision],
    releaseDecisionAuthorized: false,
    canonicalBaselineActivationAuthorized: false,
    mergeAuthorized: false,
    deploymentAuthorized: false,
    commercialGoLiveAuthorized: false,
    transactionAuthority: false,
    approvalAuthorized: false,
    publicAiAuthorized: false,
  };
}

function waitingState() {
  const trust = readJson(TRUST_PATH);
  const template = readJson(TEMPLATE_PATH);
  const trustResult = validateTrust(trust);
  const anchors = validateRepositoryAnchors();
  validateBlankTemplate(template);
  return {
    schemaVersion: 1,
    scope: 'C38_SIGNED_ROLLBACK_REVIEW_INTAKE_SUMMARY',
    publicTrustValidated: true,
    reviewerRef: EXPECTED.reviewerRef,
    reviewerId: EXPECTED.reviewerId,
    publicKeySha256: trustResult.actualPublicKeyHash,
    historicalTrustSourceCommitSha: EXPECTED.historicalSourceCommitSha,
    c36CandidateArtifactIntegrityVerified: anchors.actualC36 === EXPECTED.c36CandidateArtifactSha256,
    c37ReviewPayloadIntegrityVerified: anchors.actualC37 === EXPECTED.c37ReviewPayloadSha256,
    responseTemplateBlank: true,
    genuineSignedReviewSupplied: false,
    signedReviewVerified: false,
    governedC30IntakeReady: false,
    evidenceSatisfied: false,
    c30EvidenceStatus: 'NOT_SUPPLIED_PENDING_INDEPENDENT_REVIEW',
    handoffState: 'AWAITING_GENUINE_SIGNED_REVIEW',
    releaseDecisionAuthorized: false,
    canonicalBaselineActivationAuthorized: false,
    mergeAuthorized: false,
    deploymentAuthorized: false,
    commercialGoLiveAuthorized: false,
    transactionAuthority: false,
    approvalAuthorized: false,
    publicAiAuthorized: false,
    trustRecordSha256: sha256File(TRUST_PATH),
    responseTemplateSha256: sha256File(TEMPLATE_PATH),
  };
}

function parseArgs(argv) {
  const args = { response: null, now: null, printSigningPayload: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--response') args.response = argv[++i];
    else if (argv[i] === '--now') args.now = argv[++i];
    else if (argv[i] === '--print-signing-payload') args.printSigningPayload = argv[++i];
    else fail(`C38_UNKNOWN_ARGUMENT:${argv[i]}`);
  }
  return args;
}

if (require.main === module) {
  const args = parseArgs(process.argv.slice(2));
  if (args.printSigningPayload) {
    const response = readJson(path.resolve(args.printSigningPayload));
    validateCompletedSubstantiveFields(response, args.now || new Date());
    process.stdout.write(`${canonicalSigningPayload(response)}\n`);
  } else if (args.response) {
    const response = readJson(path.resolve(args.response));
    const result = verifySignedResponse(response, { now: args.now || new Date() });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    process.stdout.write(`${JSON.stringify(waitingState(), null, 2)}\n`);
  }
}

module.exports = {
  EXPECTED,
  QUESTION_IDS,
  APPROVE_ANSWERS,
  AUTHORITY_KEYS,
  stableStringify,
  validateTrust,
  validateRepositoryAnchors,
  validateBlankTemplate,
  validateCompletedSubstantiveFields,
  signingPayloadObject,
  canonicalSigningPayload,
  verifyDetachedRsaSha256,
  verifySignedResponse,
  waitingState,
};
