'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  EXPECTED,
  waitingState,
  validateTrust,
  validateBlankTemplate,
  validateCompletedSubstantiveFields,
  canonicalSigningPayload,
  verifyDetachedRsaSha256,
  verifySignedResponse,
} = require('../../tools/c38-rollback-signed-review-intake');

const ROOT = path.resolve(__dirname, '../..');
const trust = JSON.parse(fs.readFileSync(path.join(ROOT, 'release/evidence/c38-rollback-reviewer-trust.json'), 'utf8'));
const template = JSON.parse(fs.readFileSync(path.join(ROOT, 'release/evidence/c38-rollback-signed-review-response.template.json'), 'utf8'));

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
  assert(thrown, `Expected error containing ${fragment}`);
  assert(String(thrown.message).includes(fragment), `Expected ${fragment}, got ${thrown.message}`);
}

function completedApproveResponse() {
  const r = clone(template);
  const answers = {
    Q1_EXECUTION_REALITY: ['YES', 'تمت مراجعة سجل التنفيذ الفعلي.'],
    Q2_SHA_BINDING: ['YES', 'تمت مراجعة روابط الالتزامات والبصمات.'],
    Q3_RECOVERY_RESULT: ['YES', 'نتائج التحقق الثلاثة موثقة بالنجاح.'],
    Q4_MATERIAL_DEFECT: ['NO', 'لم تظهر ملاحظة تشغيلية جوهرية في الأدلة المعروضة.'],
    Q5_SCOPE_ACCEPTANCE: ['YES', 'القبول - إن صدر - يقتصر على دليل الرجوع ولا يمنح سلطة نشر.'],
  };
  r.reviewerAnswers = r.reviewerAnswers.map((item) => ({
    id: item.id,
    answer: answers[item.id][0],
    reviewerNote: answers[item.id][1],
  }));
  r.reviewDecision = 'APPROVE';
  r.reasonCode = null;
  r.reviewedAt = '2026-10-02T19:40:00.000Z';
  r.signatureBase64 = null;
  return r;
}

const state = waitingState();
assert.strictEqual(state.publicTrustValidated, true);
assert.strictEqual(state.reviewerRef, 'human:said');
assert.strictEqual(state.publicKeySha256, EXPECTED.publicKeySha256);
assert.strictEqual(state.c36CandidateArtifactIntegrityVerified, true);
assert.strictEqual(state.c37ReviewPayloadIntegrityVerified, true);
assert.strictEqual(state.responseTemplateBlank, true);
assert.strictEqual(state.genuineSignedReviewSupplied, false);
assert.strictEqual(state.signedReviewVerified, false);
assert.strictEqual(state.governedC30IntakeReady, false);
assert.strictEqual(state.evidenceSatisfied, false);
assert.strictEqual(state.handoffState, 'AWAITING_GENUINE_SIGNED_REVIEW');
assert.strictEqual(state.c30EvidenceStatus, 'NOT_SUPPLIED_PENDING_INDEPENDENT_REVIEW');

validateTrust(trust);
validateBlankTemplate(template);

{
  const mutated = clone(trust);
  mutated.publicKeySha256 = '0'.repeat(64);
  expectThrow(() => validateTrust(mutated), 'C38_TRUST_KEY_FINGERPRINT_DECLARATION_INVALID');
}

{
  const mutated = clone(trust);
  mutated.priorReviewDecisionReusable = true;
  expectThrow(() => validateTrust(mutated), 'C38_TRUST_PRIOR_REVIEW_REUSE_FORBIDDEN');
}

{
  const mutated = clone(template);
  mutated.reviewerAnswers[0].answer = 'YES';
  expectThrow(() => validateBlankTemplate(mutated), 'C38_TEMPLATE_PREPOPULATED_ANSWER:Q1_EXECUTION_REALITY');
}

const approve = completedApproveResponse();
validateCompletedSubstantiveFields(approve, new Date('2026-10-02T20:00:00.000Z'));
const payloadA = canonicalSigningPayload(approve);
const payloadB = canonicalSigningPayload(clone(approve));
assert.strictEqual(payloadA, payloadB);
assert(payloadA.includes('INDEPENDENT_OPERATIONAL_ROLLBACK_REHEARSAL_ACCEPTANCE'));
assert(!payloadA.includes('signatureBase64'));

{
  const mutated = completedApproveResponse();
  mutated.reviewerAnswers[0].answer = 'NO';
  mutated.reviewerAnswers[0].reviewerNote = 'لم أتحقق.';
  expectThrow(() => validateCompletedSubstantiveFields(mutated, new Date('2026-10-02T20:00:00.000Z')), 'C38_RESPONSE_APPROVE_INCONSISTENT:Q1_EXECUTION_REALITY');
}

{
  const mutated = completedApproveResponse();
  mutated.reviewDecision = 'REJECT';
  mutated.reasonCode = null;
  expectThrow(() => validateCompletedSubstantiveFields(mutated, new Date('2026-10-02T20:00:00.000Z')), 'C38_RESPONSE_NONAPPROVE_REASON_REQUIRED');
}

{
  const mutated = completedApproveResponse();
  mutated.reviewedAt = '2026-10-02T21:00:00.000Z';
  expectThrow(() => validateCompletedSubstantiveFields(mutated, new Date('2026-10-02T20:00:00.000Z')), 'C38_RESPONSE_REVIEW_TIME_IN_FUTURE');
}

{
  const mutated = completedApproveResponse();
  mutated.reviewedAt = '2026-10-02T18:00:00.000Z';
  expectThrow(() => validateCompletedSubstantiveFields(mutated, new Date('2026-10-02T20:00:00.000Z')), 'C38_RESPONSE_REVIEW_PREDATES_DESIGNATION');
}

{
  const mutated = completedApproveResponse();
  mutated.mergeAuthorized = true;
  expectThrow(() => validateCompletedSubstantiveFields(mutated, new Date('2026-10-02T20:00:00.000Z')), 'C38_RESPONSE_AUTHORITY_ESCALATION:mergeAuthorized');
}

{
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const publicPem = publicKey.export({ type: 'spki', format: 'pem' });
  const testPayload = 'C38_SYNTHETIC_CRYPTO_TEST_ONLY';
  const signature = crypto.sign('RSA-SHA256', Buffer.from(testPayload, 'utf8'), privateKey).toString('base64');
  assert.strictEqual(verifyDetachedRsaSha256(publicPem, testPayload, signature), true);
  assert.strictEqual(verifyDetachedRsaSha256(publicPem, `${testPayload}:MUTATED`, signature), false);
}

{
  const unsigned = completedApproveResponse();
  unsigned.signatureBase64 = 'bm90LWEtcmVhbC1zaWduYXR1cmU=';
  expectThrow(
    () => verifySignedResponse(unsigned, { trust, now: new Date('2026-10-02T20:00:00.000Z') }),
    'C38_RESPONSE_RSA_SIGNATURE_INVALID',
  );
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
  assert.strictEqual(state[key], false, `${key} must remain false`);
}

console.log('C38_ROLLBACK_SIGNED_REVIEW_INTAKE=PASS');
console.log(`C38_PUBLIC_KEY_SHA256=${state.publicKeySha256}`);
console.log(`C38_C36_ARTIFACT_INTEGRITY=${state.c36CandidateArtifactIntegrityVerified ? 'PASS' : 'FAIL'}`);
console.log(`C38_C37_PAYLOAD_INTEGRITY=${state.c37ReviewPayloadIntegrityVerified ? 'PASS' : 'FAIL'}`);
console.log(`C38_GENUINE_SIGNED_REVIEW_SUPPLIED=${state.genuineSignedReviewSupplied ? 1 : 0}`);
console.log(`C38_C30_ROLLBACK_GATE=${state.c30EvidenceStatus}`);
console.log('C38_SYNTHETIC_CRYPTO_TEST_ONLY=PASS');
console.log('C38_AUTHORITY_SEPARATION=PASS');
