#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  STATUS,
  openSuccessorFreshReactivationGovernanceCycle,
} = require('../src/qualification/successor-fresh-reactivation-governance-cycle');

const MAX_JSON_BYTES = 1024 * 1024;
const VALUE_ARGS = new Set([
  '--p62',
  '--p63',
  '--incident-authority-registry',
  '--expected-incident-authority-registry-hash',
  '--signed-incident-decision',
  '--registry',
  '--cycle-scope',
  '--output',
]);

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (/private[-_]?key|secret[-_]?key/i.test(key)) throw new Error('private or secret signing key argument rejected');
    if (!VALUE_ARGS.has(key)) throw new Error(`unknown argument: ${key}`);
    if (out[key] !== undefined) throw new Error(`duplicate argument: ${key}`);
    const value = argv[++i];
    if (!value || value.startsWith('--')) throw new Error(`missing value for ${key}`);
    out[key] = value;
  }
  return out;
}

function requiredArg(args, name) {
  const value = args[name];
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`required argument missing: ${name}`);
  return value;
}

function readBoundedRegularFile(filePath, label) {
  const resolved = path.resolve(filePath);
  const stat = fs.lstatSync(resolved);
  if (stat.isSymbolicLink()) throw new Error(`${label} must not be a symlink`);
  if (!stat.isFile()) throw new Error(`${label} must be a regular file`);
  if (stat.size > MAX_JSON_BYTES) throw new Error(`${label} exceeds maximum size`);
  return fs.readFileSync(resolved, 'utf8');
}

function parseJsonText(text, label) {
  let value;
  try { value = JSON.parse(text); } catch (error) { throw new Error(`${label} invalid JSON: ${error.message}`); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must contain a JSON object`);
  return value;
}

function readBoundedRegularJson(filePath, label) {
  return parseJsonText(readBoundedRegularFile(filePath, label), label);
}

function writePrivateJson(filePath, value) {
  const resolved = path.resolve(filePath);
  const parent = path.dirname(resolved);
  if (!fs.existsSync(parent)) fs.mkdirSync(parent, { recursive: true });
  const parentStat = fs.lstatSync(parent);
  if (!parentStat.isDirectory() || parentStat.isSymbolicLink()) throw new Error('output parent must be a real directory');
  if (fs.existsSync(resolved) && fs.lstatSync(resolved).isSymbolicLink()) throw new Error('output must not be a symlink');
  fs.writeFileSync(resolved, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  try { fs.chmodSync(resolved, 0o600); } catch (_) { /* platform may not support chmod */ }
}

function run(argv = process.argv.slice(2)) {
  try {
    const args = parseArgs(argv);
    const registryPath = requiredArg(args, '--registry');
    const currentRegistryContent = readBoundedRegularFile(registryPath, 'canonical baseline registry');
    const currentRegistry = parseJsonText(currentRegistryContent, 'canonical baseline registry');
    const result = openSuccessorFreshReactivationGovernanceCycle({
      p62: readBoundedRegularJson(requiredArg(args, '--p62'), 'P62 result'),
      p63: readBoundedRegularJson(requiredArg(args, '--p63'), 'P63 result'),
      incidentAuthorityRegistry: readBoundedRegularJson(requiredArg(args, '--incident-authority-registry'), 'incident authority registry'),
      expectedIncidentAuthorityRegistryHashSha256: requiredArg(args, '--expected-incident-authority-registry-hash'),
      signedIncidentDecision: readBoundedRegularJson(requiredArg(args, '--signed-incident-decision'), 'signed incident decision'),
      currentRegistry,
      currentRegistryContent,
      cycleScope: readBoundedRegularJson(requiredArg(args, '--cycle-scope'), 'successor fresh cycle scope'),
    });
    if (args['--output']) writePrivateJson(args['--output'], result);
    else process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return result.status === STATUS.SUCCESSOR_FRESH_REACTIVATION_GOVERNANCE_CYCLE_OPEN_NOT_AUTHORIZED ? 0 : 1;
  } catch (error) {
    process.stderr.write(`P64 configuration error: ${error.message}\n`);
    return 1;
  }
}

if (require.main === module) process.exitCode = run();

module.exports = {
  MAX_JSON_BYTES,
  parseArgs,
  readBoundedRegularFile,
  readBoundedRegularJson,
  run,
};
