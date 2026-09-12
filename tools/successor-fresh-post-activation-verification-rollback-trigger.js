#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  STATUS,
  evaluateSuccessorFreshPostActivationVerification,
} = require('../src/qualification/successor-fresh-post-activation-verification-rollback-trigger');

const MAX_JSON_BYTES = 2 * 1024 * 1024;
const PRIVATE_OR_SECRET_ARG_RE = /private[-_]?key|secret[-_]?key|signing[-_]?key/i;

function parseArgs(argv) {
  const out = {};
  const seen = new Set();
  const valueArgs = new Map([
    ['--activation-execution', 'activationExecutionPath'],
    ['--registry', 'registryPath'],
    ['--activation-contract', 'activationContractPath'],
    ['--review-packet', 'reviewPacketPath'],
    ['--reviewer-lifecycle', 'reviewerLifecyclePath'],
    ['--activation-plan', 'activationPlanPath'],
    ['--candidate', 'candidatePath'],
    ['--shadow', 'shadowPath'],
    ['--rehearsal', 'rehearsalPath'],
    ['--safety-guard', 'safetyGuardPath'],
    ['--owner-authority-registry', 'ownerAuthorityRegistryPath'],
    ['--expected-owner-authority-registry-sha256', 'expectedOwnerAuthorityRegistryHash'],
    ['--signed-owner-decision', 'signedOwnerDecisionPath'],
    ['--release-verify-evidence', 'releaseVerifyEvidencePath'],
    ['--output', 'outputPath'],
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (PRIVATE_OR_SECRET_ARG_RE.test(String(arg))) throw new Error(`private or secret signing key argument rejected: ${arg}`);
    if (seen.has(arg)) throw new Error(`duplicate argument: ${arg}`);
    const field = valueArgs.get(arg);
    if (!field) throw new Error(`unknown argument: ${arg}`);
    const value = argv[index + 1];
    if (typeof value !== 'string' || value.trim() === '' || value.startsWith('--')) throw new Error(`missing value for ${arg}`);
    seen.add(arg);
    out[field] = value;
    index += 1;
  }
  for (const field of [
    'activationExecutionPath', 'registryPath', 'activationContractPath', 'reviewPacketPath', 'reviewerLifecyclePath',
    'activationPlanPath', 'candidatePath', 'shadowPath', 'rehearsalPath', 'safetyGuardPath', 'ownerAuthorityRegistryPath',
    'expectedOwnerAuthorityRegistryHash', 'signedOwnerDecisionPath',
  ]) {
    if (!out[field]) throw new Error(`missing required argument: ${field}`);
  }
  return out;
}

function safeReadJson(filePath, label, fsModule = fs) {
  let stat;
  try { stat = fsModule.lstatSync(filePath); } catch (_) { throw new Error(`${label}_FILE_UNAVAILABLE`); }
  if (stat.isSymbolicLink()) throw new Error(`${label}_SYMLINK_REJECTED`);
  if (!stat.isFile()) throw new Error(`${label}_FILE_REQUIRED`);
  if (stat.size <= 0 || stat.size > MAX_JSON_BYTES) throw new Error(`${label}_FILE_SIZE_INVALID`);
  const raw = fsModule.readFileSync(filePath, 'utf8');
  let value;
  try { value = JSON.parse(raw); } catch (_) { throw new Error(`${label}_JSON_INVALID`); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label}_JSON_OBJECT_REQUIRED`);
  return { value, raw };
}

function writeOutput(outputPath, value, fsModule = fs) {
  const text = `${JSON.stringify(value, null, 2)}\n`;
  if (!outputPath) { process.stdout.write(text); return; }
  if (fsModule.existsSync(outputPath)) {
    const stat = fsModule.lstatSync(outputPath);
    if (stat.isSymbolicLink()) throw new Error('OUTPUT_SYMLINK_REJECTED');
    if (!stat.isFile()) throw new Error('OUTPUT_FILE_REQUIRED');
  }
  fsModule.writeFileSync(outputPath, text, { encoding: 'utf8', mode: 0o600, flag: 'w' });
  try { fsModule.chmodSync(outputPath, 0o600); } catch (_) {}
}

function run(argv = process.argv.slice(2)) {
  try {
    const args = parseArgs(argv);
    const registry = safeReadJson(path.resolve(args.registryPath), 'CANONICAL_REGISTRY');
    const input = {
      activationExecution: safeReadJson(path.resolve(args.activationExecutionPath), 'P78_ACTIVATION_EXECUTION').value,
      observedRegistry: registry.value,
      observedRegistryContent: registry.raw,
      activationChangeContract: safeReadJson(path.resolve(args.activationContractPath), 'P75_ACTIVATION_CONTRACT').value,
      successorReviewPacket: safeReadJson(path.resolve(args.reviewPacketPath), 'P65_REVIEW_PACKET').value,
      reviewerLifecycle: safeReadJson(path.resolve(args.reviewerLifecyclePath), 'P67_REVIEWER_LIFECYCLE').value,
      activationPlan: safeReadJson(path.resolve(args.activationPlanPath), 'P68_ACTIVATION_PLAN').value,
      successorFreshCompositeCandidate: safeReadJson(path.resolve(args.candidatePath), 'P69_COMPOSITE_CANDIDATE').value,
      successorFreshShadowEvaluation: safeReadJson(path.resolve(args.shadowPath), 'P71_SHADOW').value,
      successorFreshRehearsalResult: safeReadJson(path.resolve(args.rehearsalPath), 'P72_REHEARSAL').value,
      safetyGuard: safeReadJson(path.resolve(args.safetyGuardPath), 'P73_SAFETY_GUARD').value,
      successorFreshOwnerAuthorityRegistry: safeReadJson(path.resolve(args.ownerAuthorityRegistryPath), 'P74_OWNER_AUTHORITY_REGISTRY').value,
      expectedSuccessorFreshOwnerAuthorityRegistryHashSha256: args.expectedOwnerAuthorityRegistryHash,
      signedOwnerDecision: safeReadJson(path.resolve(args.signedOwnerDecisionPath), 'P74_SIGNED_OWNER_DECISION').value,
      releaseVerifyEvidence: args.releaseVerifyEvidencePath
        ? safeReadJson(path.resolve(args.releaseVerifyEvidencePath), 'POST_ACTIVATION_RELEASE_VERIFY_EVIDENCE').value
        : null,
    };
    const result = evaluateSuccessorFreshPostActivationVerification(input);
    writeOutput(args.outputPath ? path.resolve(args.outputPath) : null, result);
    if (result.status === STATUS.HOLD_SUCCESSOR_FRESH_POST_ACTIVATION_VERIFICATION) return 2;
    return result.verified === true ? 0 : 3;
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    return 1;
  }
}

if (require.main === module) process.exitCode = run();

module.exports = { parseArgs, safeReadJson, writeOutput, run };
