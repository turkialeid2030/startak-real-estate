#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  STATUS,
  verifySuccessorFreshCompositeEvidence,
} = require('../src/qualification/successor-fresh-composite-evidence-verifier');

const MAX_JSON_BYTES = 512 * 1024;
const MAX_EVIDENCE_BYTES = 64 * 1024 * 1024;
const VALUE_ARGS = new Set([
  '--candidate', '--activation-plan', '--current-registry', '--source-commit',
  '--release-artifact', '--environment-config', '--evidence-id', '--operator',
  '--verified-at', '--release-artifact-ref', '--environment-config-ref', '--output',
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
function readRegular(filePath, label, maxBytes, encoding = null) {
  const resolved = path.resolve(filePath);
  const stat = fs.lstatSync(resolved);
  if (stat.isSymbolicLink()) throw new Error(`${label} must not be a symlink`);
  if (!stat.isFile()) throw new Error(`${label} must be a regular file`);
  if (stat.size > maxBytes) throw new Error(`${label} exceeds maximum size`);
  return fs.readFileSync(resolved, encoding || undefined);
}
function readJson(filePath, label) {
  return JSON.parse(readRegular(filePath, label, MAX_JSON_BYTES, 'utf8'));
}
function writePrivateJson(filePath, value) {
  const resolved = path.resolve(filePath);
  const parent = path.dirname(resolved);
  const parentStat = fs.lstatSync(parent);
  if (!parentStat.isDirectory() || parentStat.isSymbolicLink()) throw new Error('output parent must be a real directory');
  if (fs.existsSync(resolved) && fs.lstatSync(resolved).isSymbolicLink()) throw new Error('output must not be a symlink');
  fs.writeFileSync(resolved, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  try { fs.chmodSync(resolved, 0o600); } catch (_) { /* platform dependent */ }
}
function run(argv = process.argv.slice(2)) {
  try {
    const args = parseArgs(argv);
    const registryPath = requiredArg(args, '--current-registry');
    const currentRegistryContent = readRegular(registryPath, 'current registry', MAX_JSON_BYTES, 'utf8');
    const result = verifySuccessorFreshCompositeEvidence({
      candidate: readJson(requiredArg(args, '--candidate'), 'candidate'),
      activationPlan: readJson(requiredArg(args, '--activation-plan'), 'activation plan'),
      currentRegistry: JSON.parse(currentRegistryContent),
      currentRegistryContent,
      observedSourceCommitSha: requiredArg(args, '--source-commit'),
      releaseArtifactBytes: readRegular(requiredArg(args, '--release-artifact'), 'release artifact', MAX_EVIDENCE_BYTES),
      environmentConfigBytes: readRegular(requiredArg(args, '--environment-config'), 'environment config', MAX_EVIDENCE_BYTES),
      evidenceId: requiredArg(args, '--evidence-id'),
      evidenceOperatorRef: requiredArg(args, '--operator'),
      verifiedAt: requiredArg(args, '--verified-at'),
      releaseArtifactRef: requiredArg(args, '--release-artifact-ref'),
      environmentConfigRef: requiredArg(args, '--environment-config-ref'),
    });
    if (args['--output']) writePrivateJson(args['--output'], result);
    else process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return result.status === STATUS.SUCCESSOR_FRESH_COMPOSITE_EVIDENCE_MATCH_NOT_ACTIVE ? 0 : 1;
  } catch (error) {
    process.stderr.write(`P70 configuration error: ${error.message}\n`);
    return 1;
  }
}

if (require.main === module) process.exitCode = run();
module.exports = { MAX_JSON_BYTES, MAX_EVIDENCE_BYTES, parseArgs, readRegular, readJson, run };
