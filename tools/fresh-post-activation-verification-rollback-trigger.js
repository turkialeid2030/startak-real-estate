#!/usr/bin/env node
'use strict';

const fs = require('fs');
const {
  STATUS,
  evaluateFreshPostActivationVerification,
} = require('../src/qualification/fresh-post-activation-verification-rollback-trigger');

const MAX_JSON_BYTES = 2 * 1024 * 1024;
const PRIVATE_KEY_ARGS = new Set(['--private-key', '--private-key-pem', '--signing-key', '--secret-key']);

function usage() {
  return 'Usage: fresh-post-activation-verification-rollback-trigger.js --activation-execution <json> --observed-registry <json> --activation-contract <json> --activation-plan <json> --candidate <json> --safety-guard <json> --owner-authority-registry <json> --expected-owner-authority-registry-sha256 <sha256> --signed-owner-decision <json> [--release-verify-evidence <json>] [--output <json>]';
}

function parseArgs(argv) {
  const map = new Map([
    ['--activation-execution', 'activationExecutionPath'],
    ['--observed-registry', 'observedRegistryPath'],
    ['--activation-contract', 'activationContractPath'],
    ['--activation-plan', 'activationPlanPath'],
    ['--candidate', 'candidatePath'],
    ['--safety-guard', 'safetyGuardPath'],
    ['--owner-authority-registry', 'ownerAuthorityRegistryPath'],
    ['--expected-owner-authority-registry-sha256', 'expectedOwnerAuthorityRegistrySha256'],
    ['--signed-owner-decision', 'signedOwnerDecisionPath'],
    ['--release-verify-evidence', 'releaseVerifyEvidencePath'],
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
    'activationExecutionPath',
    'observedRegistryPath',
    'activationContractPath',
    'activationPlanPath',
    'candidatePath',
    'safetyGuardPath',
    'ownerAuthorityRegistryPath',
    'expectedOwnerAuthorityRegistrySha256',
    'signedOwnerDecisionPath',
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
    const activationExecution = safeReadJson(args.activationExecutionPath, 'P60_ACTIVATION_EXECUTION').value;
    const observedRegistryRead = safeReadJson(args.observedRegistryPath, 'OBSERVED_CANONICAL_REGISTRY');
    const activationChangeContract = safeReadJson(args.activationContractPath, 'P57_ACTIVATION_CONTRACT').value;
    const activationPlan = safeReadJson(args.activationPlanPath, 'P50_ACTIVATION_PLAN').value;
    const freshCompositeCandidate = safeReadJson(args.candidatePath, 'P51_CANDIDATE').value;
    const safetyGuard = safeReadJson(args.safetyGuardPath, 'P55_SAFETY_GUARD').value;
    const freshOwnerAuthorityRegistry = safeReadJson(args.ownerAuthorityRegistryPath, 'FRESH_OWNER_AUTHORITY_REGISTRY').value;
    const signedOwnerDecision = safeReadJson(args.signedOwnerDecisionPath, 'SIGNED_OWNER_DECISION').value;
    const releaseVerifyEvidence = args.releaseVerifyEvidencePath
      ? safeReadJson(args.releaseVerifyEvidencePath, 'POST_CHANGE_RELEASE_VERIFY_EVIDENCE').value
      : null;

    const result = evaluateFreshPostActivationVerification({
      activationExecution,
      observedRegistry: observedRegistryRead.value,
      observedRegistryContent: observedRegistryRead.raw,
      activationChangeContract,
      activationPlan,
      freshCompositeCandidate,
      safetyGuard,
      freshOwnerAuthorityRegistry,
      expectedFreshOwnerAuthorityRegistryHashSha256: args.expectedOwnerAuthorityRegistrySha256,
      signedOwnerDecision,
      releaseVerifyEvidence,
    });
    writeOutput(args.outputPath, result);
    if (result.status === STATUS.HOLD_FRESH_POST_ACTIVATION_VERIFICATION) return 2;
    if (result.status === STATUS.FRESH_ROLLBACK_TRIGGERED_P57_PREBOUND_LEGACY_ONLY) return 3;
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
