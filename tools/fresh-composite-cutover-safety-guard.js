'use strict';

const fs = require('fs');
const path = require('path');
const currentRegistry = require('../config/governance/canonical-baseline.json');
const {
  STATUS,
  evaluateFreshCompositeCutoverSafetyGuard,
} = require('../src/qualification/fresh-composite-cutover-safety-guard');

const MAX_JSON_BYTES = 2 * 1024 * 1024;

function parseArgs(argv) {
  const allowed = new Set(['--reviewer-lock', '--activation-plan', '--shadow', '--rehearsal', '--output']);
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
  for (const required of ['reviewer-lock', 'activation-plan', 'shadow', 'rehearsal']) {
    if (!out[required]) throw new Error(`missing required argument: --${required}`);
  }
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
    const result = evaluateFreshCompositeCutoverSafetyGuard({
      currentRegistry,
      reviewerLifecycle: readBoundedJson(path.resolve(args['reviewer-lock']), 'FRESH_REVIEWER_LOCK'),
      activationPlan: readBoundedJson(path.resolve(args['activation-plan']), 'FRESH_ACTIVATION_PLAN'),
      freshShadowEvaluation: readBoundedJson(path.resolve(args.shadow), 'FRESH_SHADOW'),
      freshRehearsalResult: readBoundedJson(path.resolve(args.rehearsal), 'FRESH_REHEARSAL'),
    });
    if (args.output) writeRestrictiveJson(path.resolve(args.output), result);
    else process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    process.exit(result.status === STATUS.FRESH_CUTOVER_SAFETY_GUARD_SATISFIED_NOT_AUTHORIZED ? 0 : 1);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
}

module.exports = {
  parseArgs,
  readBoundedJson,
  evaluateFreshCompositeCutoverSafetyGuard,
};
