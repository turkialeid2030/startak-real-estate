'use strict';

const fs = require('fs');
const path = require('path');
const {
  STATUS,
  prepareSuccessorFreshOwnerActivationAuthorization,
  verifySuccessorFreshOwnerActivationAuthorization,
} = require('../src/qualification/successor-fresh-owner-activation-authorization');

const ROOT = path.join(__dirname, '..');
const DEFAULT_REGISTRY_PATH = path.join(ROOT, 'config', 'governance', 'canonical-baseline.json');
const MAX_JSON_BYTES = 2 * 1024 * 1024;

function parseArgs(argv) {
  const allowed = new Set([
    '--mode', '--safety-guard', '--review-packet', '--reviewer-lifecycle', '--activation-plan', '--shadow', '--rehearsal',
    '--authority-registry', '--expected-registry-hash', '--decision', '--registry', '--output',
  ]);
  const out = {};
  const seen = new Set();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (/private[-_]?key/i.test(String(key)) || /secret[-_]?key/i.test(String(key))) throw new Error('private or secret key argument rejected');
    if (!allowed.has(key)) throw new Error(`unknown argument: ${key}`);
    if (seen.has(key)) throw new Error(`duplicate argument: ${key}`);
    if (typeof value !== 'string' || value.trim() === '' || value.startsWith('--')) throw new Error(`missing value for ${key}`);
    seen.add(key);
    out[key.slice(2)] = value;
  }
  for (const required of [
    'mode', 'safety-guard', 'review-packet', 'reviewer-lifecycle', 'activation-plan', 'shadow', 'rehearsal',
    'authority-registry', 'expected-registry-hash', 'decision',
  ]) {
    if (!out[required]) throw new Error(`missing required argument: --${required}`);
  }
  if (!['prepare', 'verify'].includes(out.mode)) throw new Error('--mode must be prepare or verify');
  return out;
}

function inspectRegularFile(filePath, label, fsModule = fs) {
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
}

function readBoundedJson(filePath, label, fsModule = fs) {
  inspectRegularFile(filePath, label, fsModule);
  let parsed;
  try {
    parsed = JSON.parse(fsModule.readFileSync(filePath, 'utf8'));
  } catch (_) {
    throw new Error(`${label}_JSON_INVALID`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error(`${label}_JSON_OBJECT_REQUIRED`);
  return parsed;
}

function readRegistry(filePath, fsModule = fs) {
  inspectRegularFile(filePath, 'CURRENT_REGISTRY', fsModule);
  const content = fsModule.readFileSync(filePath, 'utf8');
  let parsed;
  try { parsed = JSON.parse(content); } catch (_) { throw new Error('CURRENT_REGISTRY_JSON_INVALID'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('CURRENT_REGISTRY_JSON_OBJECT_REQUIRED');
  return { currentRegistry: parsed, currentRegistryContent: content };
}

function writeRestrictiveJson(filePath, value, fsModule = fs) {
  fsModule.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  try { fsModule.chmodSync(filePath, 0o600); } catch (_) {}
}

if (require.main === module) {
  try {
    const args = parseArgs(process.argv.slice(2));
    const registryPath = path.resolve(args.registry || DEFAULT_REGISTRY_PATH);
    const registry = readRegistry(registryPath);
    const input = {
      ...registry,
      safetyGuard: readBoundedJson(path.resolve(args['safety-guard']), 'SUCCESSOR_FRESH_SAFETY_GUARD'),
      successorReviewPacket: readBoundedJson(path.resolve(args['review-packet']), 'SUCCESSOR_FRESH_REVIEW_PACKET'),
      reviewerLifecycle: readBoundedJson(path.resolve(args['reviewer-lifecycle']), 'SUCCESSOR_FRESH_REVIEWER_LIFECYCLE'),
      activationPlan: readBoundedJson(path.resolve(args['activation-plan']), 'SUCCESSOR_FRESH_ACTIVATION_PLAN'),
      successorFreshShadowEvaluation: readBoundedJson(path.resolve(args.shadow), 'SUCCESSOR_FRESH_SHADOW'),
      successorFreshRehearsalResult: readBoundedJson(path.resolve(args.rehearsal), 'SUCCESSOR_FRESH_REHEARSAL'),
      successorFreshOwnerAuthorityRegistry: readBoundedJson(path.resolve(args['authority-registry']), 'SUCCESSOR_FRESH_OWNER_AUTHORITY_REGISTRY'),
      expectedSuccessorFreshOwnerAuthorityRegistryHashSha256: args['expected-registry-hash'],
      decision: readBoundedJson(path.resolve(args.decision), 'SUCCESSOR_FRESH_OWNER_DECISION'),
    };
    const result = args.mode === 'prepare'
      ? prepareSuccessorFreshOwnerActivationAuthorization(input)
      : verifySuccessorFreshOwnerActivationAuthorization(input);
    if (args.output) writeRestrictiveJson(path.resolve(args.output), result);
    else process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    const success = args.mode === 'prepare'
      ? result.status === STATUS.READY_FOR_EXTERNAL_SUCCESSOR_FRESH_OWNER_SIGNATURE
      : result.status === STATUS.SUCCESSOR_FRESH_OWNER_ACTIVATION_AUTHORIZATION_CRYPTOGRAPHICALLY_VERIFIED_NOT_APPLIED;
    process.exit(success ? 0 : 1);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
}

module.exports = {
  STATUS,
  DEFAULT_REGISTRY_PATH,
  parseArgs,
  inspectRegularFile,
  readBoundedJson,
  readRegistry,
  prepareSuccessorFreshOwnerActivationAuthorization,
  verifySuccessorFreshOwnerActivationAuthorization,
};
