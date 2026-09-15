#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  STATUS,
  prepareHumanIncidentCloseoutDecision,
  verifyHumanIncidentCloseoutDecision,
} = require('../src/qualification/human-incident-closeout-decision');

const MAX_JSON_BYTES = 512 * 1024;
const VALUE_ARGS = new Set([
  '--mode',
  '--p44',
  '--authority-registry',
  '--expected-authority-registry-sha256',
  '--decision',
  '--attestation',
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
  const lst = fs.lstatSync(resolved);
  if (lst.isSymbolicLink()) throw new Error(`${label} must not be a symlink`);
  if (!lst.isFile()) throw new Error(`${label} must be a regular file`);
  if (lst.size > MAX_JSON_BYTES) throw new Error(`${label} exceeds maximum size`);
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
    const mode = requiredArg(args, '--mode');
    if (!['prepare', 'verify'].includes(mode)) throw new Error('--mode must be prepare or verify');

    const common = {
      p44: readBoundedRegularJson(requiredArg(args, '--p44'), 'P44 result'),
      incidentAuthorityRegistry: readBoundedRegularJson(requiredArg(args, '--authority-registry'), 'incident authority registry'),
      expectedIncidentAuthorityRegistryHashSha256: requiredArg(args, '--expected-authority-registry-sha256'),
    };

    let result;
    if (mode === 'prepare') {
      if (args['--attestation']) throw new Error('--attestation is not allowed in prepare mode');
      result = prepareHumanIncidentCloseoutDecision({
        ...common,
        decision: readBoundedRegularJson(requiredArg(args, '--decision'), 'decision'),
      });
    } else {
      if (args['--decision']) throw new Error('--decision is not allowed in verify mode');
      result = verifyHumanIncidentCloseoutDecision({
        ...common,
        attestation: readBoundedRegularJson(requiredArg(args, '--attestation'), 'attestation'),
      });
    }

    if (args['--output']) writePrivateJson(args['--output'], result);
    else process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);

    if (mode === 'prepare') return result.status === STATUS.READY_FOR_EXTERNAL_INCIDENT_AUTHORITY_SIGNATURE ? 0 : 1;
    if (
      result.status === STATUS.INCIDENT_CLOSED_BY_VERIFIED_HUMAN_DECISION_REACTIVATION_BLOCKED
      || result.status === STATUS.INCIDENT_REMAINS_OPEN_HUMAN_DECISION_VERIFIED
    ) return 0;
    return 1;
  } catch (error) {
    process.stderr.write(`P45 configuration error: ${error.message}\n`);
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
