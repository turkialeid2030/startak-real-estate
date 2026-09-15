'use strict';

const fs = require('fs');
const path = require('path');
const {
  STATUS: SHADOW_STATUS,
  evaluateFreshCompositeShadow,
} = require('../src/qualification/fresh-composite-shadow-release-gate');

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
    cycleId: extra.cycleId || null,
    currentRegistryHashSha256: extra.currentRegistryHashSha256 || null,
    candidateRegistryHashSha256: extra.candidateRegistryHashSha256 || null,
    freshCompositeEvidenceHashSha256: extra.freshCompositeEvidenceHashSha256 || null,
    freshShadowEvaluationHashSha256: extra.freshShadowEvaluationHashSha256 || null,
    shadowComparisonMatch: extra.shadowComparisonMatch === true,
    activationAuthorized: false,
    activationApplied: false,
    reactivationAuthorized: false,
    releaseAuthorized: false,
    mergeAuthorized: false,
    deploymentAuthorized: false,
    goLiveAuthorized: false,
    transactionAuthorized: false,
  });
}

function readBoundedJson(filePath, label, fsModule = fs) {
  if (typeof filePath !== 'string' || filePath.trim() === '') throw new Error(`${label}_PATH_REQUIRED`);
  let lstat;
  let stat;
  try {
    lstat = fsModule.lstatSync(filePath);
    stat = fsModule.statSync(filePath);
  } catch (_) {
    throw new Error(`${label}_FILE_UNAVAILABLE`);
  }
  if (lstat.isSymbolicLink()) throw new Error(`${label}_SYMLINK_REJECTED`);
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

function evaluateFreshCompositeShadowFromEnvironment({
  env = process.env,
  fsModule = fs,
  registryPath = DEFAULT_REGISTRY_PATH,
} = {}) {
  const candidatePath = env.FRESH_COMPOSITE_SHADOW_CANDIDATE_PATH;
  const evidencePath = env.FRESH_COMPOSITE_SHADOW_EVIDENCE_PATH;
  const required = env.REQUIRE_FRESH_COMPOSITE_SHADOW === '1';
  const candidateProvided = typeof candidatePath === 'string' && candidatePath.trim() !== '';
  const evidenceProvided = typeof evidencePath === 'string' && evidencePath.trim() !== '';

  if (!candidateProvided && !evidenceProvided) {
    return safeResult(
      required ? STATUS.MISSING_REQUIRED : STATUS.NOT_EVALUATED,
      required ? 'FRESH_COMPOSITE_SHADOW_INPUTS_REQUIRED' : 'FRESH_COMPOSITE_SHADOW_INPUTS_NOT_SUPPLIED',
    );
  }
  if (!candidateProvided || !evidenceProvided) {
    return safeResult(STATUS.HOLD, 'FRESH_COMPOSITE_SHADOW_PARTIAL_INPUT');
  }

  try {
    const currentRegistry = readBoundedJson(registryPath, 'CURRENT_REGISTRY', fsModule);
    const freshCompositeCandidate = readBoundedJson(candidatePath, 'FRESH_SHADOW_CANDIDATE', fsModule);
    const freshCompositeEvidence = readBoundedJson(evidencePath, 'FRESH_SHADOW_EVIDENCE', fsModule);
    const result = evaluateFreshCompositeShadow({ currentRegistry, freshCompositeCandidate, freshCompositeEvidence });
    if (result.status !== SHADOW_STATUS.FRESH_SHADOW_COMPOSITE_MATCH_NOT_ACTIVE) {
      const blocker = Array.isArray(result.blockers) && result.blockers.length > 0 ? result.blockers[0] : 'FRESH_COMPOSITE_SHADOW_MISMATCH';
      return safeResult(STATUS.HOLD, blocker, result);
    }
    return safeResult(STATUS.VERIFIED, null, result);
  } catch (error) {
    const safeCodes = new Set([
      'CURRENT_REGISTRY_FILE_UNAVAILABLE', 'CURRENT_REGISTRY_SYMLINK_REJECTED', 'CURRENT_REGISTRY_NOT_REGULAR_FILE',
      'CURRENT_REGISTRY_SIZE_INVALID', 'CURRENT_REGISTRY_JSON_INVALID', 'CURRENT_REGISTRY_JSON_OBJECT_REQUIRED',
      'FRESH_SHADOW_CANDIDATE_FILE_UNAVAILABLE', 'FRESH_SHADOW_CANDIDATE_SYMLINK_REJECTED', 'FRESH_SHADOW_CANDIDATE_NOT_REGULAR_FILE',
      'FRESH_SHADOW_CANDIDATE_SIZE_INVALID', 'FRESH_SHADOW_CANDIDATE_JSON_INVALID', 'FRESH_SHADOW_CANDIDATE_JSON_OBJECT_REQUIRED',
      'FRESH_SHADOW_EVIDENCE_FILE_UNAVAILABLE', 'FRESH_SHADOW_EVIDENCE_SYMLINK_REJECTED', 'FRESH_SHADOW_EVIDENCE_NOT_REGULAR_FILE',
      'FRESH_SHADOW_EVIDENCE_SIZE_INVALID', 'FRESH_SHADOW_EVIDENCE_JSON_INVALID', 'FRESH_SHADOW_EVIDENCE_JSON_OBJECT_REQUIRED',
    ]);
    return safeResult(STATUS.HOLD, safeCodes.has(error.message) ? error.message : 'FRESH_COMPOSITE_SHADOW_EVALUATION_ERROR');
  }
}

function parseArgs(argv) {
  const allowed = new Set(['--candidate', '--evidence', '--registry', '--output']);
  const out = {};
  const seen = new Set();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (/private[-_]?key/i.test(String(key))) throw new Error('private signing key argument rejected');
    if (!allowed.has(key)) throw new Error(`unknown argument: ${key}`);
    if (seen.has(key)) throw new Error(`duplicate argument: ${key}`);
    if (typeof value !== 'string' || value.trim() === '' || value.startsWith('--')) throw new Error(`missing value for ${key}`);
    seen.add(key);
    out[key.slice(2)] = value;
  }
  if (!out.candidate || !out.evidence) throw new Error('candidate and evidence arguments are required');
  return out;
}

function writeRestrictiveJson(filePath, value, fsModule = fs) {
  fsModule.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  try { fsModule.chmodSync(filePath, 0o600); } catch (_) {}
}

if (require.main === module) {
  try {
    const args = parseArgs(process.argv.slice(2));
    const result = evaluateFreshCompositeShadowFromEnvironment({
      env: {
        FRESH_COMPOSITE_SHADOW_CANDIDATE_PATH: args.candidate,
        FRESH_COMPOSITE_SHADOW_EVIDENCE_PATH: args.evidence,
        REQUIRE_FRESH_COMPOSITE_SHADOW: '1',
      },
      registryPath: args.registry || DEFAULT_REGISTRY_PATH,
    });
    if (args.output) writeRestrictiveJson(args.output, result);
    else process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    process.exit(result.status === STATUS.VERIFIED ? 0 : 1);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
}

module.exports = {
  STATUS,
  DEFAULT_REGISTRY_PATH,
  readBoundedJson,
  parseArgs,
  evaluateFreshCompositeShadowFromEnvironment,
};
