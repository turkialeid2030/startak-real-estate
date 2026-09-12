#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
  ACTION,
  STATUS,
  executeSuccessorFreshControlledCanonicalBaselineChange,
} = require('../src/qualification/successor-fresh-controlled-canonical-baseline-activation-executor');
const { stableStringify } = require('../src/qualification/canonical-baseline-registry');

const MAX_JSON_BYTES = 2 * 1024 * 1024;
const PRIVATE_OR_SECRET_ARG_RE = /private[-_]?key|secret[-_]?key|signing[-_]?key/i;
const SHA256_RE = /^[a-f0-9]{64}$/i;

function sha256Text(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}
function sha256Object(value) {
  return sha256Text(stableStringify(value));
}

function parseArgs(argv) {
  const out = { apply: false, confirmMutation: false };
  const seen = new Set();
  const valueArgs = new Map([
    ['--action', 'action'],
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
    ['--execution-id', 'executionId'],
    ['--operator-ref', 'operatorRef'],
    ['--executed-at', 'executedAt'],
    ['--expected-contract-sha256', 'expectedContractHash'],
    ['--expected-prior-registry-sha256', 'expectedPriorRegistryHash'],
    ['--expected-target-registry-sha256', 'expectedTargetRegistryHash'],
    ['--output', 'outputPath'],
  ]);

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (PRIVATE_OR_SECRET_ARG_RE.test(String(arg))) throw new Error(`private or secret signing key argument rejected: ${arg}`);
    if (seen.has(arg)) throw new Error(`duplicate argument: ${arg}`);
    if (arg === '--apply') {
      seen.add(arg);
      out.apply = true;
      continue;
    }
    if (arg === '--confirm-exact-registry-mutation') {
      seen.add(arg);
      out.confirmMutation = true;
      continue;
    }
    const field = valueArgs.get(arg);
    if (!field) throw new Error(`unknown argument: ${arg}`);
    const value = argv[index + 1];
    if (typeof value !== 'string' || value.trim() === '' || value.startsWith('--')) throw new Error(`missing value for ${arg}`);
    seen.add(arg);
    out[field] = value;
    index += 1;
  }

  for (const field of [
    'action', 'registryPath', 'activationContractPath', 'reviewPacketPath', 'reviewerLifecyclePath', 'activationPlanPath',
    'candidatePath', 'shadowPath', 'rehearsalPath', 'safetyGuardPath', 'ownerAuthorityRegistryPath',
    'expectedOwnerAuthorityRegistryHash', 'signedOwnerDecisionPath', 'executionId', 'operatorRef', 'executedAt',
  ]) {
    if (!out[field]) throw new Error(`missing required argument: ${field}`);
  }
  if (!['activate', 'rollback'].includes(out.action)) throw new Error('--action must be activate or rollback');
  if (out.apply && !out.confirmMutation) throw new Error('--apply requires --confirm-exact-registry-mutation');
  if (!out.apply && out.confirmMutation) throw new Error('--confirm-exact-registry-mutation requires --apply');
  if (out.apply) {
    for (const field of ['expectedContractHash', 'expectedPriorRegistryHash', 'expectedTargetRegistryHash']) {
      if (!out[field] || !SHA256_RE.test(out[field])) throw new Error(`--apply requires valid ${field}`);
    }
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

function createAtomicRegistryWriter(registryPath, fsModule = fs) {
  return async ({ expectedPriorRegistryHashSha256, expectedPriorContent, nextRegistryHashSha256, nextContentSha256, nextContent }) => {
    const stat = fsModule.lstatSync(registryPath);
    if (stat.isSymbolicLink()) throw new Error('CANONICAL_REGISTRY_SYMLINK_REJECTED');
    if (!stat.isFile()) throw new Error('CANONICAL_REGISTRY_FILE_REQUIRED');
    const priorContent = fsModule.readFileSync(registryPath, 'utf8');
    let priorRegistry;
    try { priorRegistry = JSON.parse(priorContent); } catch (_) { throw new Error('CANONICAL_REGISTRY_PRIOR_JSON_INVALID'); }
    if (priorContent !== expectedPriorContent) throw new Error('CANONICAL_REGISTRY_PRIOR_CONTENT_MISMATCH');
    if (sha256Object(priorRegistry) !== expectedPriorRegistryHashSha256) throw new Error('CANONICAL_REGISTRY_PRIOR_HASH_MISMATCH');
    if (sha256Text(nextContent) !== nextContentSha256) throw new Error('CANONICAL_REGISTRY_NEXT_CONTENT_HASH_MISMATCH');
    let nextRegistry;
    try { nextRegistry = JSON.parse(nextContent); } catch (_) { throw new Error('CANONICAL_REGISTRY_NEXT_JSON_INVALID'); }
    if (sha256Object(nextRegistry) !== nextRegistryHashSha256) throw new Error('CANONICAL_REGISTRY_NEXT_LOGICAL_HASH_MISMATCH');

    const dir = path.dirname(registryPath);
    const tempPath = path.join(dir, `.${path.basename(registryPath)}.${process.pid}.${Date.now()}.tmp`);
    const priorMode = stat.mode & 0o777;
    let fd = null;
    try {
      fd = fsModule.openSync(tempPath, 'wx', priorMode || 0o600);
      fsModule.writeFileSync(fd, nextContent, 'utf8');
      fsModule.fsyncSync(fd);
      fsModule.closeSync(fd);
      fd = null;
      fsModule.renameSync(tempPath, registryPath);
      try {
        const dirFd = fsModule.openSync(dir, 'r');
        try { fsModule.fsyncSync(dirFd); } finally { fsModule.closeSync(dirFd); }
      } catch (_) {}
      const observedContent = fsModule.readFileSync(registryPath, 'utf8');
      const observedRegistry = JSON.parse(observedContent);
      return Object.freeze({
        applied: true,
        observedContent,
        observedRegistry,
        observedRegistryHashSha256: sha256Object(observedRegistry),
        observedContentSha256: sha256Text(observedContent),
      });
    } finally {
      if (fd !== null) { try { fsModule.closeSync(fd); } catch (_) {} }
      try { if (fsModule.existsSync(tempPath)) fsModule.unlinkSync(tempPath); } catch (_) {}
    }
  };
}

function writeOutput(outputPath, result, fsModule = fs) {
  const text = `${JSON.stringify(result, null, 2)}\n`;
  if (!outputPath) { process.stdout.write(text); return; }
  if (fsModule.existsSync(outputPath)) {
    const stat = fsModule.lstatSync(outputPath);
    if (stat.isSymbolicLink()) throw new Error('OUTPUT_SYMLINK_REJECTED');
    if (!stat.isFile()) throw new Error('OUTPUT_FILE_REQUIRED');
  }
  fsModule.writeFileSync(outputPath, text, { encoding: 'utf8', mode: 0o600, flag: 'w' });
  try { fsModule.chmodSync(outputPath, 0o600); } catch (_) {}
}

async function run(argv = process.argv.slice(2)) {
  try {
    const args = parseArgs(argv);
    const registry = safeReadJson(path.resolve(args.registryPath), 'CANONICAL_REGISTRY');
    const activationChangeContract = safeReadJson(path.resolve(args.activationContractPath), 'P75_ACTIVATION_CONTRACT').value;
    const successorReviewPacket = safeReadJson(path.resolve(args.reviewPacketPath), 'P65_REVIEW_PACKET').value;
    const reviewerLifecycle = safeReadJson(path.resolve(args.reviewerLifecyclePath), 'P67_REVIEWER_LIFECYCLE').value;
    const activationPlan = safeReadJson(path.resolve(args.activationPlanPath), 'P68_ACTIVATION_PLAN').value;
    const successorFreshCompositeCandidate = safeReadJson(path.resolve(args.candidatePath), 'P69_COMPOSITE_CANDIDATE').value;
    const successorFreshShadowEvaluation = safeReadJson(path.resolve(args.shadowPath), 'P71_SHADOW').value;
    const successorFreshRehearsalResult = safeReadJson(path.resolve(args.rehearsalPath), 'P72_REHEARSAL').value;
    const safetyGuard = safeReadJson(path.resolve(args.safetyGuardPath), 'P73_SAFETY_GUARD').value;
    const successorFreshOwnerAuthorityRegistry = safeReadJson(path.resolve(args.ownerAuthorityRegistryPath), 'P74_OWNER_AUTHORITY_REGISTRY').value;
    const signedOwnerDecision = safeReadJson(path.resolve(args.signedOwnerDecisionPath), 'P74_SIGNED_OWNER_DECISION').value;

    if (args.apply) {
      if (activationChangeContract.successorFreshActivationChangeContractHashSha256 !== args.expectedContractHash) throw new Error('EXPECTED_CONTRACT_SHA256_MISMATCH');
      const expectedPrior = args.action === 'activate' ? activationChangeContract.rollbackRegistryHashSha256 : activationChangeContract.proposedRegistryHashSha256;
      const expectedTarget = args.action === 'activate' ? activationChangeContract.proposedRegistryHashSha256 : activationChangeContract.rollbackRegistryHashSha256;
      if (expectedPrior !== args.expectedPriorRegistryHash) throw new Error('EXPECTED_PRIOR_REGISTRY_SHA256_MISMATCH');
      if (expectedTarget !== args.expectedTargetRegistryHash) throw new Error('EXPECTED_TARGET_REGISTRY_SHA256_MISMATCH');
    }

    const result = await executeSuccessorFreshControlledCanonicalBaselineChange({
      action: args.action === 'activate' ? ACTION.ACTIVATE : ACTION.ROLLBACK,
      dryRun: !args.apply,
      currentRegistry: registry.value,
      currentRegistryContent: registry.raw,
      activationChangeContract,
      successorReviewPacket,
      reviewerLifecycle,
      activationPlan,
      successorFreshCompositeCandidate,
      successorFreshShadowEvaluation,
      successorFreshRehearsalResult,
      safetyGuard,
      successorFreshOwnerAuthorityRegistry,
      expectedSuccessorFreshOwnerAuthorityRegistryHashSha256: args.expectedOwnerAuthorityRegistryHash,
      signedOwnerDecision,
      executionId: args.executionId,
      operatorRef: args.operatorRef,
      executedAt: args.executedAt,
      registryWriter: args.apply ? createAtomicRegistryWriter(path.resolve(args.registryPath)) : null,
    });
    writeOutput(args.outputPath ? path.resolve(args.outputPath) : null, result);
    if (result.status === STATUS.HOLD_SUCCESSOR_FRESH_ACTIVATION_EXECUTION) return 2;
    if (result.verified !== true) return 3;
    return 0;
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    return 1;
  }
}

if (require.main === module) run().then((code) => { process.exitCode = code; });

module.exports = {
  parseArgs,
  safeReadJson,
  createAtomicRegistryWriter,
  writeOutput,
  run,
};
