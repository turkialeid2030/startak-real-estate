'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { EXTERNAL_STATUS } = require('../src/release/governed-release-candidate');
const {
  validateExternalEvidenceManifest,
  readManifest,
} = require('./c30-external-evidence-intake');

const ARTIFACT_INDEX_SCOPE = 'C30_EXTERNAL_ARTIFACT_INDEX_ONLY';

function requireObject(value, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(code);
  return value;
}

function requireText(value, code) {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(code);
  return value.trim();
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
}

function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function resolveContainedFile(artifactRoot, relativePath) {
  const rel = requireText(relativePath, 'C30_EXTERNAL_ARTIFACT_PATH_REQUIRED');
  if (path.isAbsolute(rel)) throw new Error('C30_EXTERNAL_ARTIFACT_PATH_MUST_BE_RELATIVE');
  if (rel.includes('\0')) throw new Error('C30_EXTERNAL_ARTIFACT_PATH_INVALID');

  const rootReal = fs.realpathSync(path.resolve(artifactRoot));
  const candidate = path.resolve(rootReal, rel);
  const relative = path.relative(rootReal, candidate);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('C30_EXTERNAL_ARTIFACT_PATH_ESCAPE');
  }
  if (!fs.existsSync(candidate)) throw new Error(`C30_EXTERNAL_ARTIFACT_FILE_MISSING:${rel}`);

  const candidateReal = fs.realpathSync(candidate);
  const realRelative = path.relative(rootReal, candidateReal);
  if (realRelative.startsWith('..') || path.isAbsolute(realRelative)) {
    throw new Error('C30_EXTERNAL_ARTIFACT_SYMLINK_ESCAPE');
  }
  const stat = fs.statSync(candidateReal);
  if (!stat.isFile()) throw new Error(`C30_EXTERNAL_ARTIFACT_NOT_FILE:${rel}`);
  return candidateReal;
}

function validateArtifactIndex(indexInput, manifestResult, options = {}) {
  const index = requireObject(indexInput, 'C30_EXTERNAL_ARTIFACT_INDEX_REQUIRED');
  if (index.schemaVersion !== 1) throw new Error('C30_EXTERNAL_ARTIFACT_INDEX_SCHEMA_UNSUPPORTED');
  if (index.collectionScope !== ARTIFACT_INDEX_SCOPE) throw new Error('C30_EXTERNAL_ARTIFACT_INDEX_SCOPE_INVALID');
  if (index.candidateHeadSha !== manifestResult.candidateHeadSha) {
    throw new Error('C30_EXTERNAL_ARTIFACT_INDEX_HEAD_MISMATCH');
  }
  if (!Array.isArray(index.artifacts)) throw new Error('C30_EXTERNAL_ARTIFACTS_REQUIRED');

  const ids = index.artifacts.map((item) => item && item.evidenceId).filter(Boolean);
  if (new Set(ids).size !== ids.length) throw new Error('C30_EXTERNAL_ARTIFACT_DUPLICATE_EVIDENCE_ID');

  const manifestById = new Map(manifestResult.items.map((item) => [item.evidenceId, item]));
  for (const mapping of index.artifacts) {
    requireObject(mapping, 'C30_EXTERNAL_ARTIFACT_MAPPING_INVALID');
    const evidenceId = requireText(mapping.evidenceId, 'C30_EXTERNAL_ARTIFACT_EVIDENCE_ID_REQUIRED');
    const record = manifestById.get(evidenceId);
    if (!record) throw new Error(`C30_EXTERNAL_ARTIFACT_UNKNOWN_EVIDENCE_ID:${evidenceId}`);
    if (record.status === EXTERNAL_STATUS.NOT_SUPPLIED) {
      throw new Error(`C30_EXTERNAL_ARTIFACT_FOR_NOT_SUPPLIED:${evidenceId}`);
    }
  }

  const suppliedItems = manifestResult.items.filter((item) => item.status !== EXTERNAL_STATUS.NOT_SUPPLIED);
  for (const item of suppliedItems) {
    if (!ids.includes(item.evidenceId)) {
      throw new Error(`C30_EXTERNAL_ARTIFACT_MAPPING_MISSING:${item.evidenceId}`);
    }
  }
  if (index.artifacts.length !== suppliedItems.length) {
    throw new Error('C30_EXTERNAL_ARTIFACT_MAPPING_COUNT_INVALID');
  }

  const artifactRoot = options.artifactRoot || process.cwd();
  const verifiedArtifacts = index.artifacts.map((mapping) => {
    const record = manifestById.get(mapping.evidenceId);
    const filePath = resolveContainedFile(artifactRoot, mapping.artifactPath);
    const computedSha256 = sha256File(filePath);
    if (computedSha256 !== record.evidenceHashSha256) {
      throw new Error(`C30_EXTERNAL_ARTIFACT_HASH_MISMATCH:${mapping.evidenceId}`);
    }
    return Object.freeze({
      evidenceId: mapping.evidenceId,
      artifactPath: mapping.artifactPath,
      computedSha256,
      hashMatchesManifest: true,
    });
  });

  return Object.freeze({
    schemaVersion: 1,
    collectionScope: ARTIFACT_INDEX_SCOPE,
    candidateHeadSha: manifestResult.candidateHeadSha,
    artifactIntegrityVerified: true,
    suppliedArtifactCount: verifiedArtifacts.length,
    requiredExternalEvidenceCount: manifestResult.requiredEvidenceCount,
    c30DecisionEffect: manifestResult.c30DecisionEffect,
    artifacts: Object.freeze(verifiedArtifacts),
    // Byte-integrity verification never establishes independent approval or release authority.
    independentApprovalEstablished: false,
    releaseDecisionAuthorized: false,
    activationAuthorized: false,
    mergeAuthorized: false,
    deploymentAuthorized: false,
    publicAiAuthorized: false,
    transactionAuthority: false,
    approvalAuthorized: false,
  });
}

function runCli(argv = process.argv.slice(2), env = process.env) {
  if (argv.length < 2 || argv.length > 3) {
    throw new Error('USAGE: node tools/c30-external-evidence-artifact-verify.js <manifest.json> <artifact-index.json> [artifact-root]');
  }
  const manifest = validateExternalEvidenceManifest(readManifest(argv[0]), {
    expectedCandidateHeadSha: env.C30_EXTERNAL_EXPECTED_CANDIDATE_SHA || undefined,
  });
  const result = validateArtifactIndex(readJson(argv[1]), manifest, {
    artifactRoot: argv[2] || process.cwd(),
  });
  const output = {
    artifactIntegrityVerified: result.artifactIntegrityVerified,
    candidateHeadSha: result.candidateHeadSha,
    suppliedArtifactCount: result.suppliedArtifactCount,
    requiredExternalEvidenceCount: result.requiredExternalEvidenceCount,
    c30DecisionEffect: result.c30DecisionEffect,
    independentApprovalEstablished: result.independentApprovalEstablished,
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
    console.error(`C30_EXTERNAL_ARTIFACT_VERIFY=FAIL ${error.message}`);
    process.exit(1);
  }
}

module.exports = Object.freeze({
  ARTIFACT_INDEX_SCOPE,
  sha256File,
  resolveContainedFile,
  validateArtifactIndex,
  runCli,
});
