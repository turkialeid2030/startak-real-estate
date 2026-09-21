#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  E2B_STATUS,
  createExternalReviewCredentialEvidenceEnvelope,
  verifyExternalEvidenceEnvelopeIntegrity,
} = require('../src/standards/external-review-credential-evidence');

const MAX_JSON_BYTES = 4 * 1024 * 1024;

function usage() {
  return [
    'Usage:',
    '  node tools/e2b-external-review-credential-intake.js \\',
    '    --requirements <e2b-requirements.json> \\',
    '    --applicability <qualified-e2-packet.json> \\',
    '    --review-evidence <review-evidence.json> \\',
    '    --credential-evidence <credential-evidence.json> \\',
    '    --envelope-id <envelope-id> \\',
    '    --prepared-by <actor-ref> \\',
    '    --prepared-at <iso-8601> \\',
    '    [--out <e2b-envelope.json>]',
    '',
    'Input shapes:',
    '  --review-evidence accepts an array or {"reviewEvidence":[...]}',
    '  --credential-evidence accepts an array or {"credentialEvidence":[...]}',
    '',
    'Safety:',
    '  This tool checks E2B structure/completeness through the repository implementation only.',
    '  It does not authenticate external documents, verify credentials or reviewer authority, create human review substance, sign attestations, activate rules, or grant any release/merge/deployment/transaction authority.',
    '  Unresolved template placeholders are rejected.',
  ].join('\n');
}

function parseArgs(argv) {
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) return { help: true };
  const map = {
    '--requirements': 'requirements',
    '--applicability': 'applicability',
    '--review-evidence': 'reviewEvidence',
    '--credential-evidence': 'credentialEvidence',
    '--envelope-id': 'envelopeId',
    '--prepared-by': 'preparedBy',
    '--prepared-at': 'preparedAt',
    '--out': 'out',
  };
  const args = {
    requirements: null,
    applicability: null,
    reviewEvidence: null,
    credentialEvidence: null,
    envelopeId: null,
    preparedBy: null,
    preparedAt: null,
    out: null,
  };
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
  for (const [key, flag] of [
    ['requirements', '--requirements'],
    ['applicability', '--applicability'],
    ['reviewEvidence', '--review-evidence'],
    ['credentialEvidence', '--credential-evidence'],
    ['envelopeId', '--envelope-id'],
    ['preparedBy', '--prepared-by'],
    ['preparedAt', '--prepared-at'],
  ]) {
    if (!args[key]) throw new Error(`${flag} is required`);
  }
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

function extractArray(value, key, label) {
  const list = Array.isArray(value) ? value : value?.[key];
  if (!Array.isArray(list)) throw new Error(`${label} input must be a JSON array or object containing ${key}`);
  if (containsPlaceholder(list)) throw new Error(`${label} input contains unresolved template placeholders`);
  return list;
}

function prepareEnvelope({
  requirements,
  applicabilityPacket,
  reviewEvidence,
  credentialEvidence,
  envelopeId,
  preparedByRef,
  preparedAt,
} = {}) {
  for (const [label, value] of [
    ['requirements', requirements],
    ['E2 applicability packet', applicabilityPacket],
    ['review evidence', reviewEvidence],
    ['credential evidence', credentialEvidence],
  ]) {
    if (containsPlaceholder(value)) throw new Error(`${label} contains unresolved template placeholders`);
  }

  const envelope = createExternalReviewCredentialEvidenceEnvelope({
    envelopeId,
    applicabilityPacket,
    requirements,
    reviewEvidence,
    credentialEvidence,
    preparedByRef,
    preparedAt,
  });
  if (envelope.envelopeHashSha256 && !verifyExternalEvidenceEnvelopeIntegrity(envelope)) {
    throw new Error('repository E2B envelope integrity verification failed after construction');
  }
  return envelope;
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
    const envelope = prepareEnvelope({
      requirements: readBoundedRegularJson(args.requirements),
      applicabilityPacket: readBoundedRegularJson(args.applicability),
      reviewEvidence: extractArray(readBoundedRegularJson(args.reviewEvidence), 'reviewEvidence', 'review evidence'),
      credentialEvidence: extractArray(readBoundedRegularJson(args.credentialEvidence), 'credentialEvidence', 'credential evidence'),
      envelopeId: args.envelopeId,
      preparedByRef: args.preparedBy,
      preparedAt: args.preparedAt,
    });

    if (args.out) writePrivateJson(args.out, envelope);
    else process.stdout.write(`${JSON.stringify(envelope, null, 2)}\n`);

    if (envelope.status !== E2B_STATUS.READY_FOR_EXTERNAL_AUTHORITY_VALIDATION) process.exit(2);
  } catch (error) {
    console.error(`E2B_EXTERNAL_REVIEW_INTAKE_ERROR: ${error.message}`);
    process.exit(65);
  }
}

if (require.main === module) main();

module.exports = {
  MAX_JSON_BYTES,
  usage,
  parseArgs,
  readBoundedRegularJson,
  writePrivateJson,
  containsPlaceholder,
  extractArray,
  prepareEnvelope,
  main,
};
