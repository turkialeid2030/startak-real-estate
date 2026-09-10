#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
  ACTION,
  STATUS,
  executeControlledCanonicalBaselineChange,
} = require('../src/qualification/controlled-canonical-baseline-activation-executor');
const { stableStringify } = require('../src/qualification/canonical-baseline-registry');

const MAX_JSON_BYTES = 2 * 1024 * 1024;
const PRIVATE_KEY_ARGS = new Set(['--private-key', '--private-key-pem', '--signing-key', '--secret-key']);

function sha256Text(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function sha256Object(value) {
  return sha256Text(stableStringify(value));
}

function usage() {
  return 'Usage: controlled-canonical-baseline-activation.js --action activate|rollback --registry <json> --contract <json> --authority-registry <json> --expected-authority-registry-sha256 <sha256> --attestation <json> --execution-id <id> --operator-ref <ref> --executed-at <iso> [--apply --confirm-exact-registry-mutation] [--output <json>]';
}

function parseArgs(argv) {
  const result = { apply: false, confirmMutation: false };
  const valueArgs = new Map([
    ['--action', 'action'],
    ['--registry', 'registryPath'],
    ['--contract', 'contractPath'],
    ['--authority-registry', 'authorityRegistryPath'],
    ['--expected-authority-registry-sha256', 'expectedAuthorityRegistryHash'],
    ['--attestation', 'attestationPath'],
    ['--execution-id', 'executionId'],
    ['--operator-ref', 'operatorRef'],
    ['--executed-at', 'executedAt'],
    ['--output', 'outputPath'],
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (PRIVATE_KEY_ARGS.has(arg)) throw new Error(`private signing key argument rejected: ${arg}`);
    if (arg === '--apply') { result.apply = true; continue; }
    if (arg === '--confirm-exact-registry-mutation') { result.confirmMutation = true; continue; }
    const key = valueArgs.get(arg);
    if (!key) throw new Error(`unknown argument: ${arg}`);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`missing value for ${arg}`);
    result[key] = value;
    index += 1;
  }
  const required = ['action', 'registryPath', 'contractPath', 'authorityRegistryPath', 'expectedAuthorityRegistryHash', 'attestationPath', 'executionId', 'operatorRef', 'executedAt'];
  for (const field of required) if (!result[field]) throw new Error(`missing required argument: ${field}`);
  if (!['activate', 'rollback'].includes(result.action)) throw new Error('--action must be activate or rollback');
  if (result.apply && !result.confirmMutation) throw new Error('--apply requires --confirm-exact-registry-mutation');
  if (!result.apply && result.confirmMutation) throw new Error('--confirm-exact-registry-mutation requires --apply');
  return result;
}

function safeReadJson(filePath, label, maxBytes = MAX_JSON_BYTES) {
  const stat = fs.lstatSync(filePath);
  if (stat.isSymbolicLink()) throw new Error(`${label}_SYMLINK_REJECTED`);
  if (!stat.isFile()) throw new Error(`${label}_FILE_REQUIRED`);
  if (stat.size > maxBytes) throw new Error(`${label}_FILE_TOO_LARGE`);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function createAtomicRegistryWriter(registryPath) {
  return async ({ expectedPriorRegistryHashSha256, expectedPriorContent, nextContent, nextContentSha256 }) => {
    const stat = fs.lstatSync(registryPath);
    if (stat.isSymbolicLink()) throw new Error('CANONICAL_REGISTRY_SYMLINK_REJECTED');
    if (!stat.isFile()) throw new Error('CANONICAL_REGISTRY_FILE_REQUIRED');
    const priorContent = fs.readFileSync(registryPath, 'utf8');
    const priorRegistry = JSON.parse(priorContent);
    if (priorContent !== expectedPriorContent) throw new Error('CANONICAL_REGISTRY_PRIOR_CONTENT_MISMATCH');
    if (sha256Object(priorRegistry) !== expectedPriorRegistryHashSha256) throw new Error('CANONICAL_REGISTRY_PRIOR_HASH_MISMATCH');
    if (sha256Text(nextContent) !== nextContentSha256) throw new Error('CANONICAL_REGISTRY_NEXT_CONTENT_HASH_MISMATCH');

    const dir = path.dirname(registryPath);
    const tempPath = path.join(dir, `.${path.basename(registryPath)}.${process.pid}.${Date.now()}.tmp`);
    let fd;
    try {
      fd = fs.openSync(tempPath, 'wx', 0o600);
      fs.writeFileSync(fd, nextContent, 'utf8');
      fs.fsyncSync(fd);
      fs.closeSync(fd);
      fd = null;
      fs.renameSync(tempPath, registryPath);
      const observed = fs.readFileSync(registryPath, 'utf8');
      return Object.freeze({ applied: true, observedContentSha256: sha256Text(observed) });
    } finally {
      if (fd !== null && fd !== undefined) {
        try { fs.closeSync(fd); } catch (_) { /* best effort */ }
      }
      try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch (_) { /* best effort */ }
    }
  };
}

function writeOutput(outputPath, result) {
  const text = `${JSON.stringify(result, null, 2)}\n`;
  if (!outputPath) {
    process.stdout.write(text);
    return;
  }
  fs.writeFileSync(outputPath, text, { encoding: 'utf8', mode: 0o600, flag: 'w' });
}

async function run(argv = process.argv.slice(2)) {
  let args;
  try {
    args = parseArgs(argv);
    const currentRegistry = safeReadJson(args.registryPath, 'CANONICAL_REGISTRY');
    const contract = safeReadJson(args.contractPath, 'P39_CONTRACT');
    const activationAuthorityRegistry = safeReadJson(args.authorityRegistryPath, 'ACTIVATION_AUTHORITY_REGISTRY');
    const activationAttestation = safeReadJson(args.attestationPath, 'ACTIVATION_ATTESTATION');
    const result = await executeControlledCanonicalBaselineChange({
      action: args.action === 'activate' ? ACTION.ACTIVATE : ACTION.ROLLBACK,
      dryRun: !args.apply,
      currentRegistry,
      contract,
      activationAuthorityRegistry,
      expectedActivationAuthorityRegistryHashSha256: args.expectedAuthorityRegistryHash,
      activationAttestation,
      executionId: args.executionId,
      operatorRef: args.operatorRef,
      executedAt: args.executedAt,
      registryWriter: args.apply ? createAtomicRegistryWriter(args.registryPath) : null,
    });
    writeOutput(args.outputPath, result);
    if (result.status === STATUS.HOLD_ACTIVATION_EXECUTION) return 2;
    return 0;
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    return 1;
  }
}

if (require.main === module) {
  run().then((code) => { process.exitCode = code; });
}

module.exports = {
  parseArgs,
  safeReadJson,
  createAtomicRegistryWriter,
  run,
  usage,
};
