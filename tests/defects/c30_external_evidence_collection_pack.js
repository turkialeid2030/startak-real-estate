'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  validateExternalEvidenceManifest,
  EVIDENCE_COMPLETE,
} = require('../../tools/c30-external-evidence-intake');

const EXPECTED_SHA = '2f066168f6cdca672d668ff5367ab250fe5cb907';
const templatePath = path.resolve(__dirname, '../../release/evidence/c30-external-evidence-manifest.template.json');
const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));

const baseline = validateExternalEvidenceManifest(template, { expectedCandidateHeadSha: EXPECTED_SHA });
assert.strictEqual(baseline.candidateHeadSha, EXPECTED_SHA);
assert.strictEqual(baseline.requiredEvidenceCount, 8);
assert.strictEqual(baseline.counts.notSupplied, 8);
assert.strictEqual(baseline.counts.suppliedVerified, 0);
assert.strictEqual(baseline.counts.rejected, 0);
assert.strictEqual(baseline.c30DecisionEffect, 'HOLD');
assert.strictEqual(baseline.releaseDecisionAuthorized, false);
assert.strictEqual(baseline.activationAuthorized, false);
assert.strictEqual(baseline.deploymentAuthorized, false);
assert.strictEqual(baseline.publicAiAuthorized, false);
assert.strictEqual(baseline.transactionAuthority, false);
assert.strictEqual(baseline.approvalAuthorized, false);

const syntheticVerified = {
  ...template,
  items: template.items.map((item, index) => ({
    ...item,
    status: 'SUPPLIED_VERIFIED',
    evidenceRef: `synthetic-test://artifact/${index + 1}`,
    evidenceHashSha256: String(index + 1).padStart(64, '0'),
    verifiedByRef: `synthetic-test-reviewer-${index + 1}`,
    verifiedAt: '2026-10-01T20:00:00.000Z',
    validUntil: null,
    reasonCode: null,
  })),
};
const verifiedResult = validateExternalEvidenceManifest(syntheticVerified, { expectedCandidateHeadSha: EXPECTED_SHA });
assert.strictEqual(verifiedResult.counts.suppliedVerified, 8);
assert.strictEqual(verifiedResult.counts.notSupplied, 0);
assert.strictEqual(verifiedResult.counts.rejected, 0);
assert.strictEqual(verifiedResult.c30DecisionEffect, EVIDENCE_COMPLETE);
assert.strictEqual(verifiedResult.releaseDecisionAuthorized, false);
assert.strictEqual(verifiedResult.activationAuthorized, false);

const syntheticRejected = JSON.parse(JSON.stringify(syntheticVerified));
syntheticRejected.items[0].status = 'REJECTED';
syntheticRejected.items[0].reasonCode = 'SYNTHETIC_REJECTION_FOR_REGRESSION_ONLY';
const rejectedResult = validateExternalEvidenceManifest(syntheticRejected, { expectedCandidateHeadSha: EXPECTED_SHA });
assert.strictEqual(rejectedResult.counts.rejected, 1);
assert.strictEqual(rejectedResult.c30DecisionEffect, 'NO_GO');
assert.strictEqual(rejectedResult.releaseDecisionAuthorized, false);

assert.throws(() => validateExternalEvidenceManifest({ ...template, candidateHeadSha: 'a'.repeat(40) }, {
  expectedCandidateHeadSha: EXPECTED_SHA,
}), /C30_EXTERNAL_MANIFEST_HEAD_MISMATCH/);

const duplicate = JSON.parse(JSON.stringify(template));
duplicate.items[7].evidenceId = duplicate.items[0].evidenceId;
assert.throws(() => validateExternalEvidenceManifest(duplicate, { expectedCandidateHeadSha: EXPECTED_SHA }), /C30_EXTERNAL_DUPLICATE_EVIDENCE_ID/);

const fabricatedNotSupplied = JSON.parse(JSON.stringify(template));
fabricatedNotSupplied.items[0].evidenceRef = 'should-not-exist';
assert.throws(() => validateExternalEvidenceManifest(fabricatedNotSupplied, { expectedCandidateHeadSha: EXPECTED_SHA }), /C30_NOT_SUPPLIED_MUST_NOT_FABRICATE_EVIDENCE/);

const itemHeadMismatch = JSON.parse(JSON.stringify(template));
itemHeadMismatch.items[0].candidateHeadSha = 'b'.repeat(40);
assert.throws(() => validateExternalEvidenceManifest(itemHeadMismatch, { expectedCandidateHeadSha: EXPECTED_SHA }), /C30_EXTERNAL_ITEM_HEAD_MISMATCH/);

console.log('C30_EXTERNAL_EVIDENCE_COLLECTION_PACK=PASS');
console.log(`C30_EXTERNAL_TEMPLATE_DECISION=${baseline.c30DecisionEffect}`);
console.log(`C30_EXTERNAL_REQUIRED_COUNT=${baseline.requiredEvidenceCount}`);
