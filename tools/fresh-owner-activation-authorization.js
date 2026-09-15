'use strict';

const fs = require('fs');
const path = require('path');
const currentRegistry = require('../config/governance/canonical-baseline.json');
const {
  STATUS,
  prepareFreshOwnerActivationAuthorization,
  verifyFreshOwnerActivationAuthorization,
} = require('../src/qualification/fresh-owner-activation-authorization');

const MAX_JSON_BYTES = 2 * 1024 * 1024;

function parseArgs(argv) {
  const allowed = new Set(['--mode', '--safety-guard', '--activation-plan', '--authority-registry', '--expected-registry-hash', '--decision', '--output']);
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
  for (const required of ['mode', 'safety-guard', 'activation-plan', 'authority-registry', 'expected-registry-hash', 'decision']) {
    if (!out[required]) throw new Error(`missing required argument: --${required}`);
  }
  if (!['prepare', 'verify'].includes(out.mode)) throw new Error('--mode must be prepare or verify');
  return out;
}

function readBoundedJson(filePath, label, fsModule = fs) {
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

function writeRestrictiveJson(filePath, value, fsModule = fs) {
  fsModule.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  try { fsModule.chmodSync(filePath, 0o600); } catch (_) {}
}

if (require.main === module) {
  try {
    const args = parseArgs(process.argv.slice(2));
    const input = {
      currentRegistry,
      safetyGuard: readBoundedJson(path.resolve(args['safety-guard']), 'FRESH_SAFETY_GUARD'),
      activationPlan: readBoundedJson(path.resolve(args['activation-plan']), 'FRESH_ACTIVATION_PLAN'),
      freshOwnerAuthorityRegistry: readBoundedJson(path.resolve(args['authority-registry']), 'FRESH_OWNER_AUTHORITY_REGISTRY'),
      expectedFreshOwnerAuthorityRegistryHashSha256: args['expected-registry-hash'],
      decision: readBoundedJson(path.resolve(args.decision), 'FRESH_OWNER_DECISION'),
    };
    const result = args.mode === 'prepare'
      ? prepareFreshOwnerActivationAuthorization(input)
      : verifyFreshOwnerActivationAuthorization(input);
    if (args.output) writeRestrictiveJson(path.resolve(args.output), result);
    else process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    const success = args.mode === 'prepare'
      ? result.status === STATUS.READY_FOR_EXTERNAL_FRESH_OWNER_SIGNATURE
      : result.status === STATUS.FRESH_OWNER_ACTIVATION_AUTHORIZATION_CRYPTOGRAPHICALLY_VERIFIED_NOT_APPLIED;
    process.exit(success ? 0 : 1);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
}

module.exports = {
  parseArgs,
  readBoundedJson,
  prepareFreshOwnerActivationAuthorization,
  verifyFreshOwnerActivationAuthorization,
};
