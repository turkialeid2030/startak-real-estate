#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  STATUS,
  evaluatePostRollbackCanonicalBaselineVerification,
} = require('../src/qualification/post-rollback-canonical-baseline-verification');

const MAX_JSON_BYTES = 512 * 1024;
const VALUE_ARGS = new Set([
  '--contract',
  '--activation-execution',
  '--rollback-decision',
  '--rollback-execution',
  '--registry',
  '--release-verify-evidence',
  '--incident-id',
  '--incident-ref',
  '--closeout-prepared-by',
  '--closeout-prepared-at',
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
  let args;
  try {
    args = parseArgs(argv);
    const result = evaluatePostRollbackCanonicalBaselineVerification({
      contract: readBoundedRegularJson(requiredArg(args, '--contract'), 'contract'),
      activationExecution: readBoundedRegularJson(requiredArg(args, '--activation-execution'), 'activation execution'),
      rollbackDecision: readBoundedRegularJson(requiredArg(args, '--rollback-decision'), 'rollback decision'),
      rollbackExecution: readBoundedRegularJson(requiredArg(args, '--rollback-execution'), 'rollback execution'),
      observedRegistry: readBoundedRegularJson(requiredArg(args, '--registry'), 'registry'),
      releaseVerifyEvidence: readBoundedRegularJson(requiredArg(args, '--release-verify-evidence'), 'release verify evidence'),
      incidentId: requiredArg(args, '--incident-id'),
      incidentRef: requiredArg(args, '--incident-ref'),
      closeoutPreparedByRef: requiredArg(args, '--closeout-prepared-by'),
      closeoutPreparedAt: requiredArg(args, '--closeout-prepared-at'),
    });
    if (args['--output']) writePrivateJson(args['--output'], result);
    else process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);

    if (result.status === STATUS.POST_ROLLBACK_RELEASE_VERIFY_EVIDENCE_CONSISTENT_INCIDENT_CLOSEOUT_READY) return 0;
    if (result.status === STATUS.POST_ROLLBACK_VERIFICATION_FAILED_INCIDENT_OPEN) return 2;
    return 1;
  } catch (error) {
    process.stderr.write(`P44 configuration error: ${error.message}\n`);
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
