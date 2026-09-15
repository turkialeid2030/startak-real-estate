#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  STATUS,
  evaluateSuccessorFreshCompositeCutoverSafetyGuard,
} = require('../src/qualification/successor-fresh-composite-cutover-safety-guard');

const ROOT = path.join(__dirname, '..');
const DEFAULT_REGISTRY_PATH = path.join(ROOT, 'config', 'governance', 'canonical-baseline.json');
const MAX_JSON_BYTES = 2 * 1024 * 1024;
const VALUE_ARGS = new Set([
  '--review-packet',
  '--reviewer-lifecycle',
  '--activation-plan',
  '--shadow',
  '--rehearsal',
  '--registry',
  '--output',
]);

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    const value = argv[i + 1];
    if (/private[-_]?key|secret[-_]?key/i.test(String(key))) throw new Error('private or secret key argument rejected');
    if (!VALUE_ARGS.has(key)) throw new Error(`unknown argument: ${key}`);
    if (out[key] !== undefined) throw new Error(`duplicate argument: ${key}`);
    if (typeof value !== 'string' || value.trim() === '' || value.startsWith('--')) throw new Error(`missing value for ${key}`);
    out[key] = value;
  }
  for (const key of ['--review-packet', '--reviewer-lifecycle', '--activation-plan', '--shadow', '--rehearsal']) {
    if (!out[key]) throw new Error(`required argument missing: ${key}`);
  }
  return out;
}

function readBoundedRegularText(filePath, label, fsModule = fs) {
  const resolved = path.resolve(filePath);
  let stat;
  try {
    const lst = fsModule.lstatSync(resolved);
    if (lst.isSymbolicLink()) throw new Error(`${label} must not be a symlink`);
    stat = fsModule.statSync(resolved);
  } catch (error) {
    if (error.message === `${label} must not be a symlink`) throw error;
    throw new Error(`${label} unavailable`);
  }
  if (!stat.isFile()) throw new Error(`${label} must be a regular file`);
  if (stat.size <= 0 || stat.size > MAX_JSON_BYTES) throw new Error(`${label} exceeds allowed size`);
  return fsModule.readFileSync(resolved, 'utf8');
}

function readBoundedRegularJson(filePath, label, fsModule = fs) {
  const raw = readBoundedRegularText(filePath, label, fsModule);
  let parsed;
  try { parsed = JSON.parse(raw); } catch (_) { throw new Error(`${label} must contain valid JSON`); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error(`${label} must contain a JSON object`);
  return { parsed, raw };
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
    const registry = readBoundedRegularJson(args['--registry'] || DEFAULT_REGISTRY_PATH, 'registry');
    const reviewPacket = readBoundedRegularJson(args['--review-packet'], 'review packet').parsed;
    const reviewerLifecycle = readBoundedRegularJson(args['--reviewer-lifecycle'], 'reviewer lifecycle').parsed;
    const activationPlan = readBoundedRegularJson(args['--activation-plan'], 'activation plan').parsed;
    const shadow = readBoundedRegularJson(args['--shadow'], 'shadow').parsed;
    const rehearsal = readBoundedRegularJson(args['--rehearsal'], 'rehearsal').parsed;

    const result = evaluateSuccessorFreshCompositeCutoverSafetyGuard({
      currentRegistry: registry.parsed,
      currentRegistryContent: registry.raw,
      successorReviewPacket: reviewPacket,
      reviewerLifecycle,
      activationPlan,
      successorFreshShadowEvaluation: shadow,
      successorFreshRehearsalResult: rehearsal,
    });
    if (args['--output']) writeRestrictiveJson(args['--output'], result);
    else process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return result.status === STATUS.SUCCESSOR_FRESH_CUTOVER_SAFETY_GUARD_SATISFIED_NOT_AUTHORIZED ? 0 : 1;
  } catch (error) {
    process.stderr.write(`P73 configuration error: ${error.message}\n`);
    return 1;
  }
}

if (require.main === module) process.exitCode = run();

module.exports = {
  MAX_JSON_BYTES,
  DEFAULT_REGISTRY_PATH,
  parseArgs,
  readBoundedRegularText,
  readBoundedRegularJson,
  writeRestrictiveJson,
  run,
};
