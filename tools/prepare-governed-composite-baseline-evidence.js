#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  STATUS,
  verifyGovernedCompositeBaselineEvidence,
} = require('../src/qualification/governed-composite-baseline-evidence-verifier');

const ROOT = path.join(__dirname, '..');
const CURRENT_REGISTRY_PATH = path.join(ROOT, 'config', 'governance', 'canonical-baseline.json');
const MAX_CANDIDATE_BYTES = 2 * 1024 * 1024;
const MAX_ENVIRONMENT_BYTES = 4 * 1024 * 1024;
const MAX_ARTIFACT_BYTES = 512 * 1024 * 1024;

const ARGUMENTS = Object.freeze([
  '--candidate',
  '--artifact',
  '--environment-config',
  '--commit',
  '--verification-id',
  '--verified-by',
  '--verified-at',
  '--output',
]);

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const name = argv[index];
    if (!ARGUMENTS.includes(name)) throw new TypeError('UNKNOWN_ARGUMENT');
    if (Object.prototype.hasOwnProperty.call(result, name)) throw new TypeError('DUPLICATE_ARGUMENT');
    const value = argv[index + 1];
    if (typeof value !== 'string' || value.trim() === '' || value.startsWith('--')) throw new TypeError('ARGUMENT_VALUE_REQUIRED');
    result[name] = value;
    index += 1;
  }
  for (const name of ARGUMENTS) {
    if (!Object.prototype.hasOwnProperty.call(result, name)) throw new TypeError('REQUIRED_ARGUMENT_MISSING');
  }
  return result;
}

function readRegularFile(filePath, maxBytes, code) {
  const stat = fs.lstatSync(filePath);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new TypeError(code);
  if (stat.size > maxBytes) throw new TypeError(`${code}_TOO_LARGE`);
  return fs.readFileSync(filePath);
}

function readJsonFile(filePath, maxBytes, code) {
  const raw = readRegularFile(filePath, maxBytes, code);
  try {
    return JSON.parse(raw.toString('utf8'));
  } catch (_) {
    throw new TypeError(`${code}_INVALID_JSON`);
  }
}

function ensureOutputTarget(filePath) {
  const parent = path.dirname(filePath);
  const parentStat = fs.lstatSync(parent);
  if (!parentStat.isDirectory() || parentStat.isSymbolicLink()) throw new TypeError('OUTPUT_DIRECTORY_INVALID');
  if (fs.existsSync(filePath)) {
    const stat = fs.lstatSync(filePath);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new TypeError('OUTPUT_TARGET_INVALID');
  }
}

function prepareEvidenceFromFiles({
  candidatePath,
  artifactPath,
  environmentConfigPath,
  observedQualifiedSourceCommitSha,
  verificationId,
  verifiedByRef,
  verifiedAt,
} = {}) {
  const currentRegistry = readJsonFile(CURRENT_REGISTRY_PATH, MAX_CANDIDATE_BYTES, 'CURRENT_REGISTRY_FILE');
  const compositeCandidate = readJsonFile(candidatePath, MAX_CANDIDATE_BYTES, 'CANDIDATE_FILE');
  const releaseArtifactBytes = readRegularFile(artifactPath, MAX_ARTIFACT_BYTES, 'RELEASE_ARTIFACT_FILE');
  const environmentConfigBytes = readRegularFile(environmentConfigPath, MAX_ENVIRONMENT_BYTES, 'ENVIRONMENT_CONFIG_FILE');

  return verifyGovernedCompositeBaselineEvidence({
    currentRegistry,
    compositeCandidate,
    observedQualifiedSourceCommitSha,
    releaseArtifactBytes,
    environmentConfigBytes,
    verificationId,
    verifiedByRef,
    verifiedAt,
  });
}

function main(argv = process.argv.slice(2)) {
  try {
    const args = parseArgs(argv);
    ensureOutputTarget(args['--output']);
    const evidence = prepareEvidenceFromFiles({
      candidatePath: args['--candidate'],
      artifactPath: args['--artifact'],
      environmentConfigPath: args['--environment-config'],
      observedQualifiedSourceCommitSha: args['--commit'],
      verificationId: args['--verification-id'],
      verifiedByRef: args['--verified-by'],
      verifiedAt: args['--verified-at'],
    });
    if (evidence.status !== STATUS.COMPOSITE_BASELINE_EVIDENCE_VERIFIED_CANDIDATE_ONLY) {
      process.stderr.write(`P35_COMPOSITE_EVIDENCE_OPERATOR_HOLD:${evidence.blockers.join(',')}\n`);
      return 2;
    }
    fs.writeFileSync(args['--output'], `${JSON.stringify(evidence, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    process.stdout.write('P35_COMPOSITE_EVIDENCE_OPERATOR_RESULT=PASS\n');
    process.stdout.write(`composite_evidence_sha256=${evidence.compositeEvidenceHashSha256}\n`);
    return 0;
  } catch (error) {
    const safeCode = typeof error?.message === 'string' && /^[A-Z0-9_]+$/.test(error.message)
      ? error.message
      : 'OPERATOR_INPUT_OR_IO_ERROR';
    process.stderr.write(`P35_COMPOSITE_EVIDENCE_OPERATOR_FAIL:${safeCode}\n`);
    return 1;
  }
}

if (require.main === module) process.exitCode = main();

module.exports = {
  ARGUMENTS,
  parseArgs,
  prepareEvidenceFromFiles,
  main,
};
