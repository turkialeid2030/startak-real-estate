#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  STATUS,
  createSuccessorFreshActivationPlan,
} = require('../src/qualification/successor-fresh-activation-plan');

const MAX_JSON_BYTES = 512 * 1024;
const VALUE_ARGS = new Set([
  '--packet',
  '--reviewer-lifecycle',
  '--activation-change-id',
  '--prepared-by',
  '--prepared-at',
  '--output',
]);

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (/private[-_]?key/i.test(key) || /secret[-_]?key/i.test(key)) throw new Error('private or secret key argument rejected');
    if (!VALUE_ARGS.has(key)) throw new Error(`unknown argument: ${key}`);
    const value = argv[++i];
    if (!value || value.startsWith('--')) throw new Error(`missing value for ${key}`);
    if (out[key] !== undefined) throw new Error(`duplicate argument: ${key}`);
    out[key] = value;
  }
  return out;
}

function requiredArg(args, name) {
  const value = args[name];
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`required argument missing: ${name}`);
  return value;
}

function readBoundedRegularJson(filePath, label) {
  const resolved = path.resolve(filePath);
  const stat = fs.lstatSync(resolved);
  if (stat.isSymbolicLink()) throw new Error(`${label} must not be a symlink`);
  if (!stat.isFile()) throw new Error(`${label} must be a regular file`);
  if (stat.size > MAX_JSON_BYTES) throw new Error(`${label} exceeds maximum size`);
  return JSON.parse(fs.readFileSync(resolved, 'utf8'));
}

function writePrivateJson(filePath, value) {
  const resolved = path.resolve(filePath);
  const parent = path.dirname(resolved);
  const parentStat = fs.lstatSync(parent);
  if (!parentStat.isDirectory() || parentStat.isSymbolicLink()) throw new Error('output parent must be a real directory');
  if (fs.existsSync(resolved) && fs.lstatSync(resolved).isSymbolicLink()) throw new Error('output must not be a symlink');
  fs.writeFileSync(resolved, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  try { fs.chmodSync(resolved, 0o600); } catch (_) { /* platform may not support chmod */ }
}

function run(argv = process.argv.slice(2)) {
  try {
    const args = parseArgs(argv);
    const result = createSuccessorFreshActivationPlan({
      packet: readBoundedRegularJson(requiredArg(args, '--packet'), 'P65 review packet'),
      reviewerLifecycle: readBoundedRegularJson(requiredArg(args, '--reviewer-lifecycle'), 'P67 reviewer lifecycle lock'),
      activationChangeId: requiredArg(args, '--activation-change-id'),
      preparedByRef: requiredArg(args, '--prepared-by'),
      preparedAt: requiredArg(args, '--prepared-at'),
    });
    if (args['--output']) writePrivateJson(args['--output'], result);
    else process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return result.status === STATUS.SUCCESSOR_FRESH_ACTIVATION_PLAN_READY_NOT_AUTHORIZED ? 0 : 1;
  } catch (error) {
    process.stderr.write(`P68 configuration error: ${error.message}\n`);
    return 1;
  }
}

if (require.main === module) process.exitCode = run();

module.exports = {
  MAX_JSON_BYTES,
  VALUE_ARGS,
  parseArgs,
  readBoundedRegularJson,
  run,
};
