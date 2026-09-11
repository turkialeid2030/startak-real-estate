#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  STATUS,
  createSuccessorFreshReviewerLifecycleLock,
} = require('../src/qualification/successor-fresh-reviewer-lifecycle-lock');

const MAX_JSON_BYTES = 512 * 1024;
const VALUE_ARGS = new Set([
  '--packet',
  '--verified-review',
  '--reviewer-registry',
  '--expected-registry-hash',
  '--signed-attestation',
  '--lock-id',
  '--lock-operator',
  '--locked-at',
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
    const result = createSuccessorFreshReviewerLifecycleLock({
      packet: readBoundedRegularJson(requiredArg(args, '--packet'), 'P65 review packet'),
      verifiedReview: readBoundedRegularJson(requiredArg(args, '--verified-review'), 'P66 verified review'),
      reviewerRegistry: readBoundedRegularJson(requiredArg(args, '--reviewer-registry'), 'successor reviewer registry'),
      expectedReviewerRegistryHashSha256: requiredArg(args, '--expected-registry-hash'),
      signedAttestation: readBoundedRegularJson(requiredArg(args, '--signed-attestation'), 'signed P66 attestation'),
      lockId: requiredArg(args, '--lock-id'),
      lockOperatorRef: requiredArg(args, '--lock-operator'),
      lockedAt: requiredArg(args, '--locked-at'),
    });
    if (args['--output']) writePrivateJson(args['--output'], result);
    else process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return result.status === STATUS.SUCCESSOR_FRESH_REVIEWER_LOCKED_BY_VERIFIED_REVIEW ? 0 : 1;
  } catch (error) {
    process.stderr.write(`P67 configuration error: ${error.message}\n`);
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
