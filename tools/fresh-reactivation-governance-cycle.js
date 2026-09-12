#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  STATUS,
  openFreshReactivationGovernanceCycle,
} = require('../src/qualification/fresh-reactivation-governance-cycle');

const MAX_JSON_BYTES = 512 * 1024;
const VALUE_ARGS = new Set([
  '--p45',
  '--registry',
  '--cycle-scope',
  '--output',
]);

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (/private[-_]?key/i.test(key)) throw new Error('private signing key argument rejected');
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
    const result = openFreshReactivationGovernanceCycle({
      p45: readBoundedRegularJson(requiredArg(args, '--p45'), 'P45 result'),
      currentRegistry: readBoundedRegularJson(requiredArg(args, '--registry'), 'canonical baseline registry'),
      cycleScope: readBoundedRegularJson(requiredArg(args, '--cycle-scope'), 'fresh cycle scope'),
    });
    if (args['--output']) writePrivateJson(args['--output'], result);
    else process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return result.status === STATUS.FRESH_REACTIVATION_GOVERNANCE_CYCLE_OPEN_NOT_AUTHORIZED ? 0 : 1;
  } catch (error) {
    process.stderr.write(`P46 configuration error: ${error.message}\n`);
    return 1;
  }
}

if (require.main === module) process.exitCode = run();

module.exports = {
  MAX_JSON_BYTES,
  parseArgs,
  readBoundedRegularJson,
  run,
};
