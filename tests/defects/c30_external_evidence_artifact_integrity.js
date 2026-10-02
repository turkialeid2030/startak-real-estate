'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  REQUIRED_EXTERNAL_EVIDENCE,
  EXTERNAL_STATUS,
} = require('../../src/release/governed-release-candidate');
const {
  COLLECTION_SCOPE,
  EVIDENCE_COMPLETE,
  validateExternalEvidenceManifest,
} = require('../../tools/c30-external-evidence-intake');
const {
  ARTIFACT_INDEX_SCOPE,
  sha256File,
  validateArtifactIndex,
} = require('../../tools/c30-external-evidence-artifact-verify');

const CANDIDATE_SHA = '2f066168f6cdca672d668ff5367ab250fe5cb907';

function notSuppliedItem(evidenceId) {
  return {
    evidenceId,
    candidateHeadSha: CANDIDATE_SHA,
    status: EXTERNAL_STATUS.NOT_SUPPLIED,
    evidenceRef: null,
    evidenceHashSha256: null,
    verifiedByRef: null,
    verifiedAt: null,
    validUntil: null,
    reasonCode: 'C30_EXTERNAL_NOT_SUPPLIED',
  };
}

function suppliedItem(evidenceId, hash) {
  return {
    evidenceId,
    candidateHeadSha: CANDIDATE_SHA,
    status: EXTERNAL_STATUS.SUPPLIED_VERIFIED,
    evidenceRef: `urn:c30:test:${evidenceId.toLowerCase()}`,
    evidenceHashSha256: hash,
    verifiedByRef: 'urn:c30:test:independent-reviewer',
    verifiedAt: '2026-10-01T00:00:00.000Z',
    validUntil: null,
    reasonCode: null,
  };
}

function manifest(items) {
  return {
    schemaVersion: 1,
    collectionScope: COLLECTION_SCOPE,
    candidateHeadSha: CANDIDATE_SHA,
    items,
  };
}

function artifactIndex(artifacts) {
  return {
    schemaVersion: 1,
    collectionScope: ARTIFACT_INDEX_SCOPE,
    candidateHeadSha: CANDIDATE_SHA,
    artifacts,
  };
}

function expectCode(fn, code) {
  assert.throws(fn, (error) => error && String(error.message).includes(code));
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'startak-c30-artifact-'));
try {
  const baseline = validateExternalEvidenceManifest(
    manifest(REQUIRED_EXTERNAL_EVIDENCE.map(notSuppliedItem)),
    { expectedCandidateHeadSha: CANDIDATE_SHA },
  );
  const emptyResult = validateArtifactIndex(artifactIndex([]), baseline, { artifactRoot: root });
  assert.strictEqual(emptyResult.artifactIntegrityVerified, true);
  assert.strictEqual(emptyResult.suppliedArtifactCount, 0);
  assert.strictEqual(emptyResult.c30DecisionEffect, 'HOLD');
  assert.strictEqual(emptyResult.releaseDecisionAuthorized, false);
  assert.strictEqual(emptyResult.activationAuthorized, false);
  assert.strictEqual(emptyResult.deploymentAuthorized, false);
  assert.strictEqual(emptyResult.publicAiAuthorized, false);
  assert.strictEqual(emptyResult.independentApprovalEstablished, false);

  expectCode(
    () => validateArtifactIndex(
      artifactIndex([{ evidenceId: 'SECURITY_REVIEW_AUTHORIZATION', artifactPath: 'security.pdf' }]),
      baseline,
      { artifactRoot: root },
    ),
    'C30_EXTERNAL_ARTIFACT_FOR_NOT_SUPPLIED',
  );

  const securityPath = path.join(root, 'security.txt');
  fs.writeFileSync(securityPath, 'synthetic security artifact for integrity semantics only\n');
  const securityHash = sha256File(securityPath);
  const oneSuppliedItems = REQUIRED_EXTERNAL_EVIDENCE.map((id) => (
    id === 'SECURITY_REVIEW_AUTHORIZATION' ? suppliedItem(id, securityHash) : notSuppliedItem(id)
  ));
  const oneSuppliedManifest = validateExternalEvidenceManifest(manifest(oneSuppliedItems));
  const oneSuppliedResult = validateArtifactIndex(
    artifactIndex([{ evidenceId: 'SECURITY_REVIEW_AUTHORIZATION', artifactPath: 'security.txt' }]),
    oneSuppliedManifest,
    { artifactRoot: root },
  );
  assert.strictEqual(oneSuppliedResult.suppliedArtifactCount, 1);
  assert.strictEqual(oneSuppliedResult.artifacts[0].computedSha256, securityHash);
  assert.strictEqual(oneSuppliedResult.artifacts[0].hashMatchesManifest, true);
  assert.strictEqual(oneSuppliedResult.c30DecisionEffect, 'HOLD');
  assert.strictEqual(oneSuppliedResult.releaseDecisionAuthorized, false);

  expectCode(
    () => validateArtifactIndex(artifactIndex([]), oneSuppliedManifest, { artifactRoot: root }),
    'C30_EXTERNAL_ARTIFACT_MAPPING_MISSING',
  );

  expectCode(
    () => validateArtifactIndex(
      artifactIndex([{ evidenceId: 'SECURITY_REVIEW_AUTHORIZATION', artifactPath: '../escape.txt' }]),
      oneSuppliedManifest,
      { artifactRoot: root },
    ),
    'C30_EXTERNAL_ARTIFACT_PATH_ESCAPE',
  );

  const badHashItems = REQUIRED_EXTERNAL_EVIDENCE.map((id) => (
    id === 'SECURITY_REVIEW_AUTHORIZATION' ? suppliedItem(id, '0'.repeat(64)) : notSuppliedItem(id)
  ));
  const badHashManifest = validateExternalEvidenceManifest(manifest(badHashItems));
  expectCode(
    () => validateArtifactIndex(
      artifactIndex([{ evidenceId: 'SECURITY_REVIEW_AUTHORIZATION', artifactPath: 'security.txt' }]),
      badHashManifest,
      { artifactRoot: root },
    ),
    'C30_EXTERNAL_ARTIFACT_HASH_MISMATCH',
  );

  const allSuppliedItems = [];
  const allArtifacts = [];
  for (const evidenceId of REQUIRED_EXTERNAL_EVIDENCE) {
    const filename = `${evidenceId}.txt`;
    const filePath = path.join(root, filename);
    fs.writeFileSync(filePath, `synthetic fixture for ${evidenceId}; not release evidence\n`);
    allSuppliedItems.push(suppliedItem(evidenceId, sha256File(filePath)));
    allArtifacts.push({ evidenceId, artifactPath: filename });
  }
  const allSuppliedManifest = validateExternalEvidenceManifest(manifest(allSuppliedItems));
  assert.strictEqual(allSuppliedManifest.c30DecisionEffect, EVIDENCE_COMPLETE);
  const allSuppliedResult = validateArtifactIndex(artifactIndex(allArtifacts), allSuppliedManifest, { artifactRoot: root });
  assert.strictEqual(allSuppliedResult.artifactIntegrityVerified, true);
  assert.strictEqual(allSuppliedResult.suppliedArtifactCount, REQUIRED_EXTERNAL_EVIDENCE.length);
  assert.strictEqual(allSuppliedResult.c30DecisionEffect, EVIDENCE_COMPLETE);
  assert.strictEqual(allSuppliedResult.independentApprovalEstablished, false);
  assert.strictEqual(allSuppliedResult.releaseDecisionAuthorized, false);
  assert.strictEqual(allSuppliedResult.activationAuthorized, false);
  assert.strictEqual(allSuppliedResult.mergeAuthorized, false);
  assert.strictEqual(allSuppliedResult.deploymentAuthorized, false);
  assert.strictEqual(allSuppliedResult.publicAiAuthorized, false);
  assert.strictEqual(allSuppliedResult.transactionAuthority, false);
  assert.strictEqual(allSuppliedResult.approvalAuthorized, false);

  console.log('C30_EXTERNAL_EVIDENCE_ARTIFACT_INTEGRITY=PASS');
  console.log(`C30_EXTERNAL_ARTIFACT_REQUIRED_COUNT=${REQUIRED_EXTERNAL_EVIDENCE.length}`);
  console.log('C30_EXTERNAL_ARTIFACT_AUTHORITY_SEPARATION=PASS');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
