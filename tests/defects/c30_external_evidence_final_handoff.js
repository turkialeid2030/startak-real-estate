'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  REQUIRED_EXTERNAL_EVIDENCE,
} = require('../../src/release/governed-release-candidate');
const {
  HANDOFF_STATE,
  validateHandoffOwnerMap,
  buildFinalExternalEvidenceHandoff,
} = require('../../tools/c30-external-evidence-final-handoff');

const candidateHeadSha = '2f066168f6cdca672d668ff5367ab250fe5cb907';
const manifestTemplate = JSON.parse(fs.readFileSync(path.join(__dirname, '../../release/evidence/c30-external-evidence-manifest.template.json'), 'utf8'));
const artifactIndexTemplate = JSON.parse(fs.readFileSync(path.join(__dirname, '../../release/evidence/c30-external-artifact-index.template.json'), 'utf8'));
const ownerMap = JSON.parse(fs.readFileSync(path.join(__dirname, '../../release/evidence/c30-external-evidence-handoff-map.json'), 'utf8'));

function hash(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function makeFullManifest(root, rejectedId = null) {
  const items = [];
  const artifacts = [];
  REQUIRED_EXTERNAL_EVIDENCE.forEach((evidenceId, index) => {
    const fileName = `evidence-${index + 1}.txt`;
    const content = `synthetic-fixture-only:${evidenceId}`;
    fs.writeFileSync(path.join(root, fileName), content);
    items.push({
      evidenceId,
      candidateHeadSha,
      status: evidenceId === rejectedId ? 'REJECTED' : 'SUPPLIED_VERIFIED',
      evidenceRef: `TEST-FIXTURE-${index + 1}`,
      evidenceHashSha256: hash(content),
      verifiedByRef: `INDEPENDENT-TEST-VERIFIER-${index + 1}`,
      verifiedAt: '2026-10-01T12:00:00.000Z',
      validUntil: '2027-10-01T12:00:00.000Z',
      reasonCode: evidenceId === rejectedId ? 'TEST_REJECTED' : null,
    });
    artifacts.push({ evidenceId, artifactPath: fileName });
  });
  return {
    manifest: {
      schemaVersion: 1,
      collectionScope: 'C30_EXTERNAL_EVIDENCE_ONLY',
      candidateHeadSha,
      sourceTrackerIssue: 541,
      items,
    },
    artifactIndex: {
      schemaVersion: 1,
      collectionScope: 'C30_EXTERNAL_ARTIFACT_INDEX_ONLY',
      candidateHeadSha,
      artifacts,
    },
  };
}

// Real current posture: all eight are NOT_SUPPLIED, therefore HOLD.
const current = buildFinalExternalEvidenceHandoff({
  manifest: manifestTemplate,
  artifactIndex: artifactIndexTemplate,
  ownerMap,
}, { expectedCandidateHeadSha: candidateHeadSha, artifactRoot: path.join(__dirname, '../..') });
assert.strictEqual(current.handoffState, HANDOFF_STATE.HOLD);
assert.strictEqual(current.counts.notSupplied, 8);
assert.strictEqual(current.readyForIndependentReleaseDecision, false);
assert.strictEqual(current.releaseDecisionAuthorized, false);
assert.strictEqual(current.deploymentAuthorized, false);
assert.strictEqual(current.publicAiAuthorized, false);

// Even complete, synthetically supplied fixtures only advance to independent decision review; no authority is granted.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'c30-handoff-'));
try {
  const full = makeFullManifest(tmp);
  const complete = buildFinalExternalEvidenceHandoff({
    manifest: full.manifest,
    artifactIndex: full.artifactIndex,
    ownerMap,
  }, { expectedCandidateHeadSha: candidateHeadSha, artifactRoot: tmp });
  assert.strictEqual(complete.handoffState, HANDOFF_STATE.COMPLETE);
  assert.strictEqual(complete.counts.suppliedVerified, 8);
  assert.strictEqual(complete.suppliedArtifactCount, 8);
  assert.strictEqual(complete.readyForIndependentReleaseDecision, true);
  assert.strictEqual(complete.independentApprovalEstablished, false);
  assert.strictEqual(complete.releaseDecisionAuthorized, false);
  assert.strictEqual(complete.activationAuthorized, false);
  assert.strictEqual(complete.mergeAuthorized, false);
  assert.strictEqual(complete.deploymentAuthorized, false);
  assert.strictEqual(complete.transactionAuthority, false);
  assert.strictEqual(complete.approvalAuthorized, false);
  assert.strictEqual(complete.publicAiAuthorized, false);

  const rejected = makeFullManifest(tmp, 'LEGAL_REGULATORY_APPROVAL');
  const noGo = buildFinalExternalEvidenceHandoff({
    manifest: rejected.manifest,
    artifactIndex: rejected.artifactIndex,
    ownerMap,
  }, { expectedCandidateHeadSha: candidateHeadSha, artifactRoot: tmp });
  assert.strictEqual(noGo.handoffState, HANDOFF_STATE.NO_GO);
  assert.strictEqual(noGo.readyForIndependentReleaseDecision, false);
  assert.strictEqual(noGo.releaseDecisionAuthorized, false);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

// Separation of duties is hard-gated in the owner map.
const selfApprove = clone(ownerMap);
selfApprove.gates[0].engineeringMaySelfApprove = true;
assert.throws(
  () => validateHandoffOwnerMap(selfApprove, { candidateHeadSha }),
  /C30_EXTERNAL_HANDOFF_SELF_APPROVAL_PROHIBITED/
);

const duplicateIssue = clone(ownerMap);
duplicateIssue.gates[1].issueNumber = duplicateIssue.gates[0].issueNumber;
assert.throws(
  () => validateHandoffOwnerMap(duplicateIssue, { candidateHeadSha }),
  /C30_EXTERNAL_HANDOFF_DUPLICATE_ISSUE_NUMBER/
);

const wrongHead = clone(ownerMap);
wrongHead.candidateHeadSha = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
assert.throws(
  () => validateHandoffOwnerMap(wrongHead, { candidateHeadSha }),
  /C30_EXTERNAL_HANDOFF_MAP_HEAD_MISMATCH/
);

console.log('C30_EXTERNAL_EVIDENCE_FINAL_HANDOFF=PASS');
console.log(`C30_EXTERNAL_FINAL_HANDOFF_REQUIRED_COUNT=${REQUIRED_EXTERNAL_EVIDENCE.length}`);
console.log(`C30_EXTERNAL_FINAL_HANDOFF_REAL_STATE=${current.handoffState}`);
console.log('C30_EXTERNAL_FINAL_HANDOFF_AUTHORITY_SEPARATION=PASS');
