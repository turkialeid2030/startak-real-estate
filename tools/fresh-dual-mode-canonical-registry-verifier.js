'use strict';

const fs = require('fs');
const path = require('path');
const { MODE } = require('../src/qualification/canonical-baseline-registry');
const {
  STATUS,
  verifyFreshDualModeCanonicalRegistry,
} = require('../src/qualification/fresh-dual-mode-canonical-registry-verifier');

const MAX_JSON_BYTES = 2 * 1024 * 1024;

function parseArgs(argv) {
  const allowed = new Set([
    '--registry', '--activation-contract', '--activation-plan', '--candidate', '--safety-guard',
    '--authority-registry', '--expected-registry-hash', '--signed-decision', '--output',
  ]);
  const out = {};
  const seen = new Set();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (/private[-_]?key/i.test(String(key)) || /secret[-_]?key/i.test(String(key))) throw new Error('private or secret signing key argument rejected');
    if (!allowed.has(key)) throw new Error(`unknown argument: ${key}`);
    if (seen.has(key)) throw new Error(`duplicate argument: ${key}`);
    if (typeof value !== 'string' || value.trim() === '' || value.startsWith('--')) throw new Error(`missing value for ${key}`);
    seen.add(key);
    out[key.slice(2)] = value;
  }
  if (!out.registry) throw new Error('missing required argument: --registry');
  return out;
}

function readBoundedJsonWithRaw(filePath, label, fsModule = fs) {
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
  const raw = fsModule.readFileSync(filePath, 'utf8');
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (_) {
    throw new Error(`${label}_JSON_INVALID`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error(`${label}_JSON_OBJECT_REQUIRED`);
  return { parsed, raw };
}

function readBoundedJson(filePath, label, fsModule = fs) {
  return readBoundedJsonWithRaw(filePath, label, fsModule).parsed;
}

function writeRestrictiveJson(filePath, value, fsModule = fs) {
  try {
    const existing = fsModule.lstatSync(filePath);
    if (existing.isSymbolicLink()) throw new Error('OUTPUT_SYMLINK_REJECTED');
    if (!existing.isFile()) throw new Error('OUTPUT_NOT_REGULAR_FILE');
  } catch (error) {
    if (error && (error.message === 'OUTPUT_SYMLINK_REJECTED' || error.message === 'OUTPUT_NOT_REGULAR_FILE')) throw error;
    if (error && error.code && error.code !== 'ENOENT') throw error;
  }
  fsModule.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  try { fsModule.chmodSync(filePath, 0o600); } catch (_) {}
}

function requireFreshArgs(args) {
  for (const required of [
    'activation-contract', 'activation-plan', 'candidate', 'safety-guard',
    'authority-registry', 'expected-registry-hash', 'signed-decision',
  ]) {
    if (!args[required]) throw new Error(`missing required argument for fresh composite mode: --${required}`);
  }
}

if (require.main === module) {
  try {
    const args = parseArgs(process.argv.slice(2));
    const registryFile = readBoundedJsonWithRaw(path.resolve(args.registry), 'CANONICAL_REGISTRY');
    const input = {
      registry: registryFile.parsed,
      observedRegistryContent: registryFile.raw,
    };

    if (registryFile.parsed.activeMode === MODE.GOVERNED_COMPOSITE_BASELINE) {
      requireFreshArgs(args);
      input.activationChangeContract = readBoundedJson(path.resolve(args['activation-contract']), 'FRESH_ACTIVATION_CHANGE_CONTRACT');
      input.activationPlan = readBoundedJson(path.resolve(args['activation-plan']), 'FRESH_ACTIVATION_PLAN');
      input.freshCompositeCandidate = readBoundedJson(path.resolve(args.candidate), 'FRESH_COMPOSITE_CANDIDATE');
      input.safetyGuard = readBoundedJson(path.resolve(args['safety-guard']), 'FRESH_CUTOVER_SAFETY_GUARD');
      input.freshOwnerAuthorityRegistry = readBoundedJson(path.resolve(args['authority-registry']), 'FRESH_OWNER_AUTHORITY_REGISTRY');
      input.expectedFreshOwnerAuthorityRegistryHashSha256 = args['expected-registry-hash'];
      input.signedOwnerDecision = readBoundedJson(path.resolve(args['signed-decision']), 'FRESH_SIGNED_OWNER_DECISION');
    }

    const result = verifyFreshDualModeCanonicalRegistry(input);
    if (args.output) writeRestrictiveJson(path.resolve(args.output), result);
    else process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    const pass = result.status === STATUS.LEGACY_BASELINE_VERIFIED
      || result.status === STATUS.FRESH_COMPOSITE_BASELINE_VERIFIED_WITH_FRESH_OWNER_AUTHORIZATION;
    process.exit(pass ? 0 : 1);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
}

module.exports = {
  parseArgs,
  readBoundedJsonWithRaw,
  readBoundedJson,
  writeRestrictiveJson,
  requireFreshArgs,
  verifyFreshDualModeCanonicalRegistry,
};
