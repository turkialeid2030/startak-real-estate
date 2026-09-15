'use strict';

const fs = require('fs');
const path = require('path');
const {
  STATUS: SHADOW_STATUS,
  evaluateCompositeBaselineShadow,
} = require('../src/qualification/composite-baseline-shadow-release-gate');

const ROOT = path.join(__dirname, '..');
const DEFAULT_REGISTRY_PATH = path.join(ROOT, 'config', 'governance', 'canonical-baseline.json');
const MAX_JSON_BYTES = 2 * 1024 * 1024;

const STATUS = Object.freeze({
  NOT_EVALUATED: 'NOT_EVALUATED',
  MISSING_REQUIRED: 'MISSING_REQUIRED',
  HOLD: 'HOLD',
  VERIFIED: 'VERIFIED',
});

function safeResult(status, reasonCode, extra = {}) {
  return Object.freeze({
    status,
    verified: status === STATUS.VERIFIED,
    reasonCode: reasonCode || null,
    authoritativeMode: extra.authoritativeMode || 'LEGACY_FILE_SHA256',
    shadowMode: extra.shadowMode || 'GOVERNED_COMPOSITE_BASELINE',
    currentRegistryHashSha256: extra.currentRegistryHashSha256 || null,
    candidateRegistryHashSha256: extra.candidateRegistryHashSha256 || null,
    compositeEvidenceHashSha256: extra.compositeEvidenceHashSha256 || null,
    shadowEvaluationHashSha256: extra.shadowEvaluationHashSha256 || null,
    shadowComparisonMatch: extra.shadowComparisonMatch === true,
    activationApplied: false,
    releaseAuthorized: false,
    mergeAuthorized: false,
    deploymentAuthorized: false,
    goLiveAuthorized: false,
    transactionAuthorized: false,
  });
}

function readBoundedJson(filePath, label, fsModule = fs) {
  if (typeof filePath !== 'string' || filePath.trim() === '') throw new Error(`${label}_PATH_REQUIRED`);
  let stat;
  let linkStat;
  try {
    linkStat = fsModule.lstatSync(filePath);
    stat = fsModule.statSync(filePath);
  } catch (_) {
    throw new Error(`${label}_FILE_UNAVAILABLE`);
  }
  if (linkStat.isSymbolicLink()) throw new Error(`${label}_SYMLINK_REJECTED`);
  if (!stat.isFile()) throw new Error(`${label}_NOT_REGULAR_FILE`);
  if (stat.size <= 0 || stat.size > MAX_JSON_BYTES) throw new Error(`${label}_SIZE_INVALID`);
  let parsed;
  try {
    parsed = JSON.parse(fsModule.readFileSync(filePath, 'utf8'));
  } catch (_) {
    throw new Error(`${label}_JSON_INVALID`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error(`${label}_JSON_OBJECT_REQUIRED`);
  return parsed;
}

function evaluateCompositeBaselineShadowFromEnvironment({
  env = process.env,
  fsModule = fs,
  registryPath = DEFAULT_REGISTRY_PATH,
} = {}) {
  const candidatePath = env.COMPOSITE_BASELINE_SHADOW_CANDIDATE_PATH;
  const evidencePath = env.COMPOSITE_BASELINE_SHADOW_EVIDENCE_PATH;
  const required = env.REQUIRE_COMPOSITE_BASELINE_SHADOW === '1';
  const candidateProvided = typeof candidatePath === 'string' && candidatePath.trim() !== '';
  const evidenceProvided = typeof evidencePath === 'string' && evidencePath.trim() !== '';

  if (!candidateProvided && !evidenceProvided) {
    return safeResult(
      required ? STATUS.MISSING_REQUIRED : STATUS.NOT_EVALUATED,
      required ? 'COMPOSITE_BASELINE_SHADOW_INPUTS_REQUIRED' : 'COMPOSITE_BASELINE_SHADOW_INPUTS_NOT_SUPPLIED',
    );
  }
  if (!candidateProvided || !evidenceProvided) {
    return safeResult(STATUS.HOLD, 'COMPOSITE_BASELINE_SHADOW_PARTIAL_INPUT');
  }

  try {
    const currentRegistry = readBoundedJson(registryPath, 'CURRENT_REGISTRY', fsModule);
    const compositeCandidate = readBoundedJson(candidatePath, 'SHADOW_CANDIDATE', fsModule);
    const compositeEvidence = readBoundedJson(evidencePath, 'SHADOW_EVIDENCE', fsModule);
    const result = evaluateCompositeBaselineShadow({ currentRegistry, compositeCandidate, compositeEvidence });

    if (result.status !== SHADOW_STATUS.SHADOW_COMPOSITE_BASELINE_MATCH_NOT_ACTIVE) {
      return safeResult(STATUS.HOLD, 'COMPOSITE_BASELINE_SHADOW_MISMATCH', result);
    }
    return safeResult(STATUS.VERIFIED, null, result);
  } catch (error) {
    const safeCodes = new Set([
      'CURRENT_REGISTRY_FILE_UNAVAILABLE', 'CURRENT_REGISTRY_SYMLINK_REJECTED', 'CURRENT_REGISTRY_NOT_REGULAR_FILE',
      'CURRENT_REGISTRY_SIZE_INVALID', 'CURRENT_REGISTRY_JSON_INVALID', 'CURRENT_REGISTRY_JSON_OBJECT_REQUIRED',
      'SHADOW_CANDIDATE_FILE_UNAVAILABLE', 'SHADOW_CANDIDATE_SYMLINK_REJECTED', 'SHADOW_CANDIDATE_NOT_REGULAR_FILE',
      'SHADOW_CANDIDATE_SIZE_INVALID', 'SHADOW_CANDIDATE_JSON_INVALID', 'SHADOW_CANDIDATE_JSON_OBJECT_REQUIRED',
      'SHADOW_EVIDENCE_FILE_UNAVAILABLE', 'SHADOW_EVIDENCE_SYMLINK_REJECTED', 'SHADOW_EVIDENCE_NOT_REGULAR_FILE',
      'SHADOW_EVIDENCE_SIZE_INVALID', 'SHADOW_EVIDENCE_JSON_INVALID', 'SHADOW_EVIDENCE_JSON_OBJECT_REQUIRED',
    ]);
    const code = safeCodes.has(error.message) ? error.message : 'COMPOSITE_BASELINE_SHADOW_EVALUATION_ERROR';
    return safeResult(STATUS.HOLD, code);
  }
}

if (require.main === module) {
  const result = evaluateCompositeBaselineShadowFromEnvironment();
  console.log(`shadow_status=${result.status}`);
  console.log(`authoritative_mode=${result.authoritativeMode}`);
  console.log(`shadow_mode=${result.shadowMode}`);
  if (result.shadowEvaluationHashSha256) console.log(`shadow_evaluation_sha256=${result.shadowEvaluationHashSha256}`);
  if (result.reasonCode) console.log(`reason_code=${result.reasonCode}`);
  process.exit(result.status === STATUS.HOLD || result.status === STATUS.MISSING_REQUIRED ? 1 : 0);
}

module.exports = {
  STATUS,
  DEFAULT_REGISTRY_PATH,
  evaluateCompositeBaselineShadowFromEnvironment,
};
