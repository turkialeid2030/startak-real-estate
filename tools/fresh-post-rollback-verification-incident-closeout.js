#!/usr/bin/env node
'use strict';

const fs = require('fs');
const {
  STATUS,
  evaluateFreshPostRollbackVerification,
} = require('../src/qualification/fresh-post-rollback-verification-incident-closeout');

const MAX_JSON_BYTES = 2 * 1024 * 1024;
const PRIVATE_KEY_ARGS = new Set(['--private-key', '--private-key-pem', '--signing-key', '--secret-key']);

function usage() {
  return 'Usage: fresh-post-rollback-verification-incident-closeout.js --activation-contract <json> --activation-execution <json> --rollback-decision <json> --rollback-execution <json> --observed-registry <json> --release-verify-evidence <json> --expected-release-verify-commit-sha <sha> --incident-id <id> --incident-ref <ref> --closeout-prepared-by-ref <ref> --closeout-prepared-at <iso> [--output <json>]';
}

function parseArgs(argv) {
  const map = new Map([
    ['--activation-contract', 'activationContractPath'],
    ['--activation-execution', 'activationExecutionPath'],
    ['--rollback-decision', 'rollbackDecisionPath'],
    ['--rollback-execution', 'rollbackExecutionPath'],
    ['--observed-registry', 'observedRegistryPath'],
    ['--release-verify-evidence', 'releaseVerifyEvidencePath'],
    ['--expected-release-verify-commit-sha', 'expectedReleaseVerifyCommitSha'],
    ['--incident-id', 'incidentId'],
    ['--incident-ref', 'incidentRef'],
    ['--closeout-prepared-by-ref', 'closeoutPreparedByRef'],
    ['--closeout-prepared-at', 'closeoutPreparedAt'],
    ['--output', 'outputPath'],
  ]);
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (PRIVATE_KEY_ARGS.has(arg)) throw new Error(`private or secret signing key argument rejected: ${arg}`);
    const key = map.get(arg);
    if (!key) throw new Error(`unknown argument: ${arg}`);
    if (Object.prototype.hasOwnProperty.call(out, key)) throw new Error(`duplicate argument: ${arg}`);
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) throw new Error(`missing value for ${arg}`);
    out[key] = value;
    i += 1;
  }
  const required = [
    'activationContractPath',
    'activationExecutionPath',
    'rollbackDecisionPath',
    'rollbackExecutionPath',
    'observedRegistryPath',
    'releaseVerifyEvidencePath',
    'expectedReleaseVerifyCommitSha',
    'incidentId',
    'incidentRef',
    'closeoutPreparedByRef',
    'closeoutPreparedAt',
  ];
  for (const field of required) if (!out[field]) throw new Error(`missing required argument: ${field}`);
  return out;
}

function safeReadJson(filePath, label, maxBytes = MAX_JSON_BYTES) {
  const stat = fs.lstatSync(filePath);
  if (stat.isSymbolicLink()) throw new Error(`${label}_SYMLINK_REJECTED`);
  if (!stat.isFile()) throw new Error(`${label}_FILE_REQUIRED`);
  if (stat.size <= 0 || stat.size > maxBytes) throw new Error(`${label}_FILE_SIZE_INVALID`);
  const raw = fs.readFileSync(filePath, 'utf8');
  const value = JSON.parse(raw);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label}_JSON_OBJECT_REQUIRED`);
  return { value, raw };
}

function writeOutput(outputPath, value) {
  const text = `${JSON.stringify(value, null, 2)}\n`;
  if (!outputPath) return process.stdout.write(text);
  fs.writeFileSync(outputPath, text, { encoding: 'utf8', mode: 0o600, flag: 'w' });
}

async function run(argv = process.argv.slice(2)) {
  try {
    const args = parseArgs(argv);
    const activationChangeContract = safeReadJson(args.activationContractPath, 'P57_ACTIVATION_CONTRACT').value;
    const activationExecution = safeReadJson(args.activationExecutionPath, 'P60_ACTIVATION_EXECUTION').value;
    const rollbackDecision = safeReadJson(args.rollbackDecisionPath, 'P61_ROLLBACK_DECISION').value;
    const rollbackExecution = safeReadJson(args.rollbackExecutionPath, 'P60_ROLLBACK_EXECUTION').value;
    const observedRegistryRead = safeReadJson(args.observedRegistryPath, 'OBSERVED_CANONICAL_REGISTRY');
    const releaseVerifyEvidence = safeReadJson(args.releaseVerifyEvidencePath, 'POST_ROLLBACK_RELEASE_VERIFY_EVIDENCE').value;

    const result = evaluateFreshPostRollbackVerification({
      activationChangeContract,
      activationExecution,
      rollbackDecision,
      rollbackExecution,
      observedRegistry: observedRegistryRead.value,
      observedRegistryContent: observedRegistryRead.raw,
      releaseVerifyEvidence,
      expectedReleaseVerifyCommitSha: args.expectedReleaseVerifyCommitSha,
      incidentId: args.incidentId,
      incidentRef: args.incidentRef,
      closeoutPreparedByRef: args.closeoutPreparedByRef,
      closeoutPreparedAt: args.closeoutPreparedAt,
    });
    writeOutput(args.outputPath, result);
    if (result.status === STATUS.HOLD_FRESH_POST_ROLLBACK_VERIFICATION) return 2;
    if (result.status === STATUS.FRESH_POST_ROLLBACK_VERIFICATION_FAILED_INCIDENT_OPEN) return 3;
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
  run,
  usage,
};
