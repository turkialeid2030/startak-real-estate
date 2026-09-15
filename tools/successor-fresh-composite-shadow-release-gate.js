'use strict';

const fs = require('fs');
const path = require('path');
const {
  STATUS: SHADOW_STATUS,
  evaluateSuccessorFreshCompositeShadow,
} = require('../src/qualification/successor-fresh-composite-shadow-release-gate');

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
    currentRegistryContentSha256: extra.currentRegistryContentSha256 || null,
    candidateRegistryHashSha256: extra.candidateRegistryHashSha256 || null,
    candidateRegistryContentSha256: extra.candidateRegistryContentSha256 || null,
    successorFreshCompositeEvidenceHashSha256: extra.successorFreshCompositeEvidenceHashSha256 || null,
    successorFreshShadowEvaluationHashSha256: extra.successorFreshShadowEvaluationHashSha256 || null,
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

function readBoundedRegularFile(filePath, label, fsModule = fs) {
  if (typeof filePath !== 'string' || filePath.trim() === '') throw new Error(`${label}_PATH_REQUIRED`);
  let stat;
  try {
    const lst = fsModule.lstatSync(filePath);
    if (lst.isSymbolicLink()) throw new Error(`${label}_SYMLINK_REJECTED`);
    stat = fsModule.statSync(filePath);
  } catch (error) {
    if (error.message === `${label}_SYMLINK_REJECTED`) throw error;
    throw new Error(`${label}_FILE_UNAVAILABLE`);
  }
  if (!stat.isFile()) throw new Error(`${label}_NOT_REGULAR_FILE`);
  if (stat.size <= 0 || stat.size > MAX_JSON_BYTES) throw new Error(`${label}_SIZE_INVALID`);
  return fsModule.readFileSync(filePath, 'utf8');
}

function readBoundedJson(filePath, label, fsModule = fs) {
  const raw = readBoundedRegularFile(filePath, label, fsModule);
  let parsed;
  try { parsed = JSON.parse(raw); } catch (_) { throw new Error(`${label}_JSON_INVALID`); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error(`${label}_JSON_OBJECT_REQUIRED`);
  return { parsed, raw };
}

function evaluateSuccessorFreshCompositeShadowFromEnvironment({
  env = process.env,
  fsModule = fs,
  registryPath = DEFAULT_REGISTRY_PATH,
} = {}) {
  const candidatePath = env.SUCCESSOR_FRESH_COMPOSITE_SHADOW_CANDIDATE_PATH;
  const evidencePath = env.SUCCESSOR_FRESH_COMPOSITE_SHADOW_EVIDENCE_PATH;
  const required = env.REQUIRE_SUCCESSOR_FRESH_COMPOSITE_SHADOW === '1';
  const candidateProvided = typeof candidatePath === 'string' && candidatePath.trim() !== '';
  const evidenceProvided = typeof evidencePath === 'string' && evidencePath.trim() !== '';

  if (!candidateProvided && !evidenceProvided) {
    return safeResult(
      required ? STATUS.MISSING_REQUIRED : STATUS.NOT_EVALUATED,
      required ? 'SUCCESSOR_FRESH_COMPOSITE_SHADOW_INPUTS_REQUIRED' : 'SUCCESSOR_FRESH_COMPOSITE_SHADOW_INPUTS_NOT_SUPPLIED',
    );
  }
  if (!candidateProvided || !evidenceProvided) {
    return safeResult(STATUS.HOLD, 'SUCCESSOR_FRESH_COMPOSITE_SHADOW_PARTIAL_INPUT');
  }

  try {
    const current = readBoundedJson(registryPath, 'CURRENT_REGISTRY', fsModule);
    const candidate = readBoundedJson(candidatePath, 'SUCCESSOR_FRESH_SHADOW_CANDIDATE', fsModule);
    const evidence = readBoundedJson(evidencePath, 'SUCCESSOR_FRESH_SHADOW_EVIDENCE', fsModule);
    const result = evaluateSuccessorFreshCompositeShadow({
      currentRegistry: current.parsed,
      currentRegistryContent: current.raw,
      successorFreshCompositeCandidate: candidate.parsed,
      successorFreshCompositeEvidence: evidence.parsed,
    });
    if (result.status !== SHADOW_STATUS.SUCCESSOR_FRESH_SHADOW_COMPOSITE_MATCH_NOT_ACTIVE) {
      const blocker = Array.isArray(result.blockers) && result.blockers.length > 0 ? result.blockers[0] : 'SUCCESSOR_FRESH_COMPOSITE_SHADOW_MISMATCH';
      return safeResult(STATUS.HOLD, blocker, result);
    }
    return safeResult(STATUS.VERIFIED, null, result);
  } catch (error) {
    const safePrefixes = [
      'CURRENT_REGISTRY_',
      'SUCCESSOR_FRESH_SHADOW_CANDIDATE_',
      'SUCCESSOR_FRESH_SHADOW_EVIDENCE_',
    ];
    const safe = safePrefixes.some((prefix) => String(error.message).startsWith(prefix));
    return safeResult(STATUS.HOLD, safe ? error.message : 'SUCCESSOR_FRESH_COMPOSITE_SHADOW_EVALUATION_ERROR');
  }
}

function parseArgs(argv) {
  const allowed = new Set(['--candidate', '--evidence', '--registry', '--output']);
  const out = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    const value = argv[i + 1];
    if (/private[-_]?key|secret[-_]?key/i.test(String(key))) throw new Error('private or secret key argument rejected');
    if (!allowed.has(key)) throw new Error(`unknown argument: ${key}`);
    if (out[key] !== undefined) throw new Error(`duplicate argument: ${key}`);
    if (typeof value !== 'string' || value.trim() === '' || value.startsWith('--')) throw new Error(`missing value for ${key}`);
    out[key] = value;
  }
  if (!out['--candidate'] || !out['--evidence']) throw new Error('candidate and evidence arguments are required');
  return out;
}

function writeRestrictiveJson(filePath, value, fsModule = fs) {
  const resolved = path.resolve(filePath);
  const parent = path.dirname(resolved);
  const parentStat = fsModule.lstatSync(parent);
  if (!parentStat.isDirectory() || parentStat.isSymbolicLink()) throw new Error('output parent must be a real directory');
  if (fsModule.existsSync(resolved) && fsModule.lstatSync(resolved).isSymbolicLink()) throw new Error('output must not be a symlink');
  fsModule.writeFileSync(resolved, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  try { fsModule.chmodSync(resolved, 0o600); } catch (_) {}
}

function run(argv = process.argv.slice(2)) {
  try {
    const args = parseArgs(argv);
    const result = evaluateSuccessorFreshCompositeShadowFromEnvironment({
      env: {
        SUCCESSOR_FRESH_COMPOSITE_SHADOW_CANDIDATE_PATH: args['--candidate'],
        SUCCESSOR_FRESH_COMPOSITE_SHADOW_EVIDENCE_PATH: args['--evidence'],
        REQUIRE_SUCCESSOR_FRESH_COMPOSITE_SHADOW: '1',
      },
      registryPath: args['--registry'] || DEFAULT_REGISTRY_PATH,
    });
    if (args['--output']) writeRestrictiveJson(args['--output'], result);
    else process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return result.status === STATUS.VERIFIED ? 0 : 1;
  } catch (error) {
    process.stderr.write(`P71 configuration error: ${error.message}\n`);
    return 1;
  }
}

if (require.main === module) process.exitCode = run();

module.exports = {
  STATUS,
  DEFAULT_REGISTRY_PATH,
  MAX_JSON_BYTES,
  readBoundedRegularFile,
  readBoundedJson,
  parseArgs,
  writeRestrictiveJson,
  evaluateSuccessorFreshCompositeShadowFromEnvironment,
  run,
};
