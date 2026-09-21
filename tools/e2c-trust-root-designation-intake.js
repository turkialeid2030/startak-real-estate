#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  normalizeTrustedVerifierRegistry,
} = require('../src/standards/external-authority-validation');

const MAX_JSON_BYTES = 4 * 1024 * 1024;
const READY_STATUS = 'READY_FOR_INDEPENDENT_OUT_OF_BAND_PINNING';

function usage() {
  return [
    'Usage:',
    '  node tools/e2c-trust-root-designation-intake.js \\',
    '    --registry <externally-governed-verifier-registry.json> \\',
    '    [--reviewer-subjects <reviewer-subjects.json>] \\',
    '    [--out <normalized-registry-candidate.json>]',
    '',
    'Input shapes:',
    '  --reviewer-subjects accepts a JSON array or {"reviewerSubjects":[...]}',
    '',
    'Safety:',
    '  This tool normalizes and validates PUBLIC E2C trust-root material only.',
    '  It rejects unresolved placeholders and optionally rejects direct verifier/reviewer subject collisions.',
    '  It does not create the independent out-of-band pin, accept private keys, sign attestations, validate external evidence, activate rules, or grant release/merge/deployment/transaction/Go-Live authority.',
  ].join('\n');
}

function parseArgs(argv) {
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) return { help: true };
  const map = {
    '--registry': 'registry',
    '--reviewer-subjects': 'reviewerSubjects',
    '--out': 'out',
  };
  const args = { registry: null, reviewerSubjects: null, out: null };
  const seen = new Set();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const key = map[token];
    if (!key) throw new Error(`unknown argument: ${token}`);
    if (seen.has(key)) throw new Error(`duplicate argument: ${token}`);
    seen.add(key);
    args[key] = argv[++index] || null;
    if (!args[key]) throw new Error(`missing value for ${token}`);
  }
  if (!args.registry) throw new Error('--registry is required');
  return args;
}

function readBoundedRegularJson(filePath) {
  const resolved = path.resolve(filePath);
  const stat = fs.lstatSync(resolved);
  if (stat.isSymbolicLink()) throw new Error(`symlink input is not allowed: ${resolved}`);
  if (!stat.isFile()) throw new Error(`input must be a regular file: ${resolved}`);
  if (stat.size > MAX_JSON_BYTES) throw new Error(`input exceeds ${MAX_JSON_BYTES} bytes: ${resolved}`);
  return JSON.parse(fs.readFileSync(resolved, 'utf8'));
}

function writePrivateJson(filePath, value) {
  const resolved = path.resolve(filePath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  if (fs.existsSync(resolved) && fs.lstatSync(resolved).isSymbolicLink()) throw new Error(`symlink output is not allowed: ${resolved}`);
  fs.writeFileSync(resolved, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  fs.chmodSync(resolved, 0o600);
}

function containsPlaceholder(value) {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return /^<[^>]+>$/.test(trimmed) || /^(REPLACE_|PLACEHOLDER_|TEMPLATE_)/.test(trimmed);
  }
  if (Array.isArray(value)) return value.some(containsPlaceholder);
  if (value && typeof value === 'object') return Object.values(value).some(containsPlaceholder);
  return false;
}

function extractReviewerSubjects(value) {
  if (value == null) return [];
  const list = Array.isArray(value) ? value : value?.reviewerSubjects;
  if (!Array.isArray(list)) throw new Error('reviewer-subjects input must be a JSON array or object containing reviewerSubjects');
  const normalized = list.map((subject, index) => {
    if (typeof subject !== 'string' || !subject.trim()) throw new Error(`reviewerSubjects[${index}] must be a non-empty string`);
    return subject.trim();
  });
  return [...new Set(normalized)];
}

function prepareTrustRootCandidate({ registry, reviewerSubjects = [] } = {}) {
  if (!registry || typeof registry !== 'object' || Array.isArray(registry)) throw new Error('registry must be an object');
  if (containsPlaceholder(registry)) throw new Error('registry contains unresolved template placeholders');
  if (containsPlaceholder(reviewerSubjects)) throw new Error('reviewer subjects contain unresolved template placeholders');

  const normalizedRegistry = normalizeTrustedVerifierRegistry(registry);
  const reviewerSet = new Set(extractReviewerSubjects(reviewerSubjects));
  const collisions = normalizedRegistry.verifiers
    .filter((verifier) => reviewerSet.has(verifier.verifierSubjectRef))
    .map((verifier) => verifier.verifierSubjectRef);
  if (collisions.length) {
    throw new Error(`E2C_VERIFIER_SELF_VALIDATION_RISK:${[...new Set(collisions)].join(',')}`);
  }

  return Object.freeze({
    schemaVersion: 1,
    status: READY_STATUS,
    registry: normalizedRegistry,
    registryHashSha256: normalizedRegistry.registryHashSha256,
    reviewerSubjectsChecked: Object.freeze([...reviewerSet]),
    selfValidationCollisionDetected: false,
    independentOutOfBandPinPresent: false,
    privateKeyAccepted: false,
    privateKeyRequired: false,
    signingPerformed: false,
    authorityEffect: 'NONE',
    semantics: 'Repository normalization proves only that the public E2C verifier registry is structurally valid and content-addressed. A genuine independent out-of-band pin and genuine external RSA-SHA256 attestations remain mandatory before E2C can qualify.',
  });
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    console.error(usage());
    process.exit(64);
  }
  if (args.help) {
    console.log(usage());
    return;
  }

  try {
    const registry = readBoundedRegularJson(args.registry);
    const reviewerSubjects = args.reviewerSubjects ? extractReviewerSubjects(readBoundedRegularJson(args.reviewerSubjects)) : [];
    const result = prepareTrustRootCandidate({ registry, reviewerSubjects });
    if (args.out) writePrivateJson(args.out, result);
    else process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (result.status !== READY_STATUS) process.exit(2);
  } catch (error) {
    console.error(`E2C_TRUST_ROOT_DESIGNATION_INTAKE_ERROR: ${error.message}`);
    process.exit(65);
  }
}

if (require.main === module) main();

module.exports = {
  MAX_JSON_BYTES,
  READY_STATUS,
  usage,
  parseArgs,
  readBoundedRegularJson,
  writePrivateJson,
  containsPlaceholder,
  extractReviewerSubjects,
  prepareTrustRootCandidate,
  main,
};
