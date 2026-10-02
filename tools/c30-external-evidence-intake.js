'use strict';

const fs = require('fs');
const path = require('path');
const {
  EXTERNAL_STATUS,
  REQUIRED_EXTERNAL_EVIDENCE,
  createExternalEvidenceItem,
} = require('../src/release/governed-release-candidate');

const GIT_SHA_RE = /^[a-f0-9]{40}$/;
const COLLECTION_SCOPE = 'C30_EXTERNAL_EVIDENCE_ONLY';
const EVIDENCE_COMPLETE = 'EVIDENCE_COMPLETE_PENDING_RELEASE_REEVALUATION';

function requireObject(value, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(code);
  return value;
}

function requireCandidateSha(value, code) {
  if (typeof value !== 'string' || !GIT_SHA_RE.test(value)) throw new Error(code);
  return value;
}

function validateExternalEvidenceManifest(input, options = {}) {
  const manifest = requireObject(input, 'C30_EXTERNAL_MANIFEST_REQUIRED');
  if (manifest.schemaVersion !== 1) throw new Error('C30_EXTERNAL_MANIFEST_SCHEMA_UNSUPPORTED');
  if (manifest.collectionScope !== COLLECTION_SCOPE) throw new Error('C30_EXTERNAL_COLLECTION_SCOPE_INVALID');

  const candidateHeadSha = requireCandidateSha(manifest.candidateHeadSha, 'C30_EXTERNAL_MANIFEST_HEAD_INVALID');
  if (options.expectedCandidateHeadSha) {
    const expected = requireCandidateSha(options.expectedCandidateHeadSha, 'C30_EXTERNAL_EXPECTED_HEAD_INVALID');
    if (candidateHeadSha !== expected) throw new Error('C30_EXTERNAL_MANIFEST_HEAD_MISMATCH');
  }

  if (!Array.isArray(manifest.items)) throw new Error('C30_EXTERNAL_ITEMS_REQUIRED');

  const ids = manifest.items.map((item) => item && item.evidenceId).filter(Boolean);
  if (new Set(ids).size !== ids.length) throw new Error('C30_EXTERNAL_DUPLICATE_EVIDENCE_ID');

  for (const requiredId of REQUIRED_EXTERNAL_EVIDENCE) {
    if (!ids.includes(requiredId)) throw new Error(`C30_EXTERNAL_REQUIRED_ITEM_MISSING:${requiredId}`);
  }
  for (const id of ids) {
    if (!REQUIRED_EXTERNAL_EVIDENCE.includes(id)) throw new Error(`C30_EXTERNAL_UNKNOWN_ITEM:${id}`);
  }
  if (manifest.items.length !== REQUIRED_EXTERNAL_EVIDENCE.length) {
    throw new Error('C30_EXTERNAL_ITEM_COUNT_INVALID');
  }

  const normalizedItems = manifest.items.map((item) => {
    requireObject(item, 'C30_EXTERNAL_ITEM_INVALID');
    if (item.candidateHeadSha !== candidateHeadSha) throw new Error(`C30_EXTERNAL_ITEM_HEAD_MISMATCH:${item.evidenceId || 'UNKNOWN'}`);
    return createExternalEvidenceItem(item);
  });

  const counts = Object.freeze({
    suppliedVerified: normalizedItems.filter((item) => item.status === EXTERNAL_STATUS.SUPPLIED_VERIFIED).length,
    notSupplied: normalizedItems.filter((item) => item.status === EXTERNAL_STATUS.NOT_SUPPLIED).length,
    rejected: normalizedItems.filter((item) => item.status === EXTERNAL_STATUS.REJECTED).length,
  });

  let c30DecisionEffect = EVIDENCE_COMPLETE;
  if (counts.rejected > 0) c30DecisionEffect = 'NO_GO';
  else if (counts.notSupplied > 0) c30DecisionEffect = 'HOLD';

  return Object.freeze({
    schemaVersion: 1,
    collectionScope: COLLECTION_SCOPE,
    candidateHeadSha,
    requiredEvidenceCount: REQUIRED_EXTERNAL_EVIDENCE.length,
    allRequiredPresent: true,
    items: Object.freeze(normalizedItems),
    counts,
    c30DecisionEffect,
    // External evidence completeness never grants release/deployment authority.
    releaseDecisionAuthorized: false,
    activationAuthorized: false,
    mergeAuthorized: false,
    deploymentAuthorized: false,
    publicAiAuthorized: false,
    transactionAuthority: false,
    approvalAuthorized: false,
  });
}

function readManifest(filePath) {
  const absolute = path.resolve(filePath);
  return JSON.parse(fs.readFileSync(absolute, 'utf8'));
}

function runCli(argv = process.argv.slice(2), env = process.env) {
  if (argv.length !== 1) throw new Error('USAGE: node tools/c30-external-evidence-intake.js <manifest.json>');
  const result = validateExternalEvidenceManifest(readManifest(argv[0]), {
    expectedCandidateHeadSha: env.C30_EXTERNAL_EXPECTED_CANDIDATE_SHA || undefined,
  });
  const output = {
    intakeValid: true,
    candidateHeadSha: result.candidateHeadSha,
    requiredEvidenceCount: result.requiredEvidenceCount,
    counts: result.counts,
    c30DecisionEffect: result.c30DecisionEffect,
    releaseDecisionAuthorized: result.releaseDecisionAuthorized,
    activationAuthorized: result.activationAuthorized,
    deploymentAuthorized: result.deploymentAuthorized,
    publicAiAuthorized: result.publicAiAuthorized,
  };
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  return result;
}

if (require.main === module) {
  try {
    runCli();
  } catch (error) {
    console.error(`C30_EXTERNAL_EVIDENCE_INTAKE=FAIL ${error.message}`);
    process.exit(1);
  }
}

module.exports = Object.freeze({
  COLLECTION_SCOPE,
  EVIDENCE_COMPLETE,
  validateExternalEvidenceManifest,
  readManifest,
  runCli,
});
