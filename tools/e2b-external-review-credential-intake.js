#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
  E2B_STATUS,
  createExternalReviewCredentialEvidenceEnvelope,
  verifyExternalEvidenceEnvelopeIntegrity,
} = require('../src/standards/external-review-credential-evidence');

const MAX_JSON_BYTES = 4 * 1024 * 1024;
const MAX_ARTIFACT_BYTES = 128 * 1024 * 1024;

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
    '    [--artifact-root <directory-containing-received-artifacts>] \\',
    '    [--out <e2b-envelope.json>]',
    '',
    'Input shapes:',
    '  --review-evidence accepts an array or {"reviewEvidence":[...]}',
    '  --credential-evidence accepts an array or {"credentialEvidence":[...]}',
    '  When --artifact-root is supplied, every evidence record must contain artifactRelativePath.',
    '  The local-only artifactRelativePath field is stripped before the governed E2B envelope is constructed.',
    '',
    'Artifact byte binding:',
    '  --artifact-root enables strict local byte binding. Each referenced artifact must be a regular non-symlink file under that root,',
    '  must not exceed the bounded artifact size, and its computed SHA-256 must exactly match artifactSha256.',
    '  Supplying artifactRelativePath without --artifact-root is rejected to prevent an unverified path from appearing verified.',
    '',
    'Safety:',
    '  This tool checks E2B structure/completeness through the repository implementation and, when --artifact-root is used, binds declared hashes to local file bytes.',
    '  Local byte binding does not authenticate external documents, verify credentials or reviewer authority/independence, establish legal/professional correctness, create human review substance, sign attestations, activate rules, or grant any release/merge/deployment/transaction authority.',
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
    '--artifact-root': 'artifactRoot',
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
    artifactRoot: null,
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

function isPathInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative !== '' && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative);
}

function resolveArtifactRoot(artifactRoot) {
  const resolved = path.resolve(artifactRoot);
  const stat = fs.lstatSync(resolved);
  if (stat.isSymbolicLink()) throw new Error(`artifact root must not be a symlink: ${resolved}`);
  if (!stat.isDirectory()) throw new Error(`artifact root must be a directory: ${resolved}`);
  return fs.realpathSync(resolved);
}

function resolveBoundedArtifact(artifactRoot, artifactRelativePath, label) {
  if (typeof artifactRelativePath !== 'string' || artifactRelativePath.trim().length === 0) {
    throw new Error(`${label}.artifactRelativePath must be a non-empty relative path when --artifact-root is used`);
  }
  const supplied = artifactRelativePath.trim();
  if (path.isAbsolute(supplied)) throw new Error(`${label}.artifactRelativePath must be relative`);
  const normalized = path.normalize(supplied);
  if (normalized === '.' || normalized === '..' || normalized.startsWith(`..${path.sep}`)) {
    throw new Error(`${label}.artifactRelativePath escapes the artifact root`);
  }

  const rootReal = resolveArtifactRoot(artifactRoot);
  let current = rootReal;
  for (const segment of normalized.split(path.sep)) {
    if (!segment || segment === '.') continue;
    current = path.join(current, segment);
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink()) throw new Error(`${label}.artifactRelativePath contains a symlink component`);
  }

  const candidateReal = fs.realpathSync(path.resolve(rootReal, normalized));
  if (!isPathInside(rootReal, candidateReal)) throw new Error(`${label}.artifactRelativePath resolves outside the artifact root`);
  const stat = fs.lstatSync(candidateReal);
  if (!stat.isFile()) throw new Error(`${label} artifact must be a regular file`);
  if (stat.size > MAX_ARTIFACT_BYTES) throw new Error(`${label} artifact exceeds ${MAX_ARTIFACT_BYTES} bytes`);
  return { filePath: candidateReal, size: stat.size, relativePath: normalized };
}

function sha256RegularFile(filePath, expectedSize) {
  const flags = fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0);
  const fd = fs.openSync(filePath, flags);
  try {
    const before = fs.fstatSync(fd);
    if (!before.isFile()) throw new Error(`artifact must be a regular file: ${filePath}`);
    if (before.size > MAX_ARTIFACT_BYTES) throw new Error(`artifact exceeds ${MAX_ARTIFACT_BYTES} bytes: ${filePath}`);
    if (typeof expectedSize === 'number' && before.size !== expectedSize) throw new Error(`artifact changed before hashing: ${filePath}`);

    const digest = crypto.createHash('sha256');
    const buffer = Buffer.allocUnsafe(64 * 1024);
    let position = 0;
    while (position < before.size) {
      const bytesRead = fs.readSync(fd, buffer, 0, Math.min(buffer.length, before.size - position), position);
      if (bytesRead === 0) throw new Error(`unexpected end of artifact while hashing: ${filePath}`);
      digest.update(buffer.subarray(0, bytesRead));
      position += bytesRead;
    }

    const after = fs.fstatSync(fd);
    if (after.size !== before.size || after.mtimeMs !== before.mtimeMs) throw new Error(`artifact changed while hashing: ${filePath}`);
    return digest.digest('hex');
  } finally {
    fs.closeSync(fd);
  }
}

function bindArtifactBytes(records, { artifactRoot = null, label, idField } = {}) {
  if (!Array.isArray(records)) throw new Error(`${label} must be an array`);
  if (!artifactRoot) {
    if (records.some((record) => typeof record?.artifactRelativePath === 'string' && record.artifactRelativePath.trim())) {
      throw new Error(`${label} contains artifactRelativePath but --artifact-root was not supplied`);
    }
    return records.map(({ artifactRelativePath, ...record }) => record);
  }

  const rootReal = resolveArtifactRoot(artifactRoot);
  return records.map((record, index) => {
    const recordLabel = `${label}[${index}]`;
    if (!record || typeof record !== 'object' || Array.isArray(record)) throw new Error(`${recordLabel} must be an object`);
    const expected = String(record.artifactSha256 || '').trim().toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(expected)) throw new Error(`${recordLabel}.artifactSha256 must be a SHA-256 hex digest before local byte binding`);
    const resolved = resolveBoundedArtifact(rootReal, record.artifactRelativePath, recordLabel);
    const computed = sha256RegularFile(resolved.filePath, resolved.size);
    if (computed !== expected) {
      const recordId = typeof record[idField] === 'string' && record[idField].trim() ? record[idField].trim() : `index-${index}`;
      throw new Error(`${label} artifact hash mismatch for ${recordId}: declared ${expected}, computed ${computed}`);
    }
    const { artifactRelativePath, ...governedRecord } = record;
    return governedRecord;
  });
}

function prepareEnvelope({
  requirements,
  applicabilityPacket,
  reviewEvidence,
  credentialEvidence,
  envelopeId,
  preparedByRef,
  preparedAt,
  artifactRoot = null,
} = {}) {
  for (const [label, value] of [
    ['requirements', requirements],
    ['E2 applicability packet', applicabilityPacket],
    ['review evidence', reviewEvidence],
    ['credential evidence', credentialEvidence],
  ]) {
    if (containsPlaceholder(value)) throw new Error(`${label} contains unresolved template placeholders`);
  }

  const boundReviewEvidence = bindArtifactBytes(reviewEvidence, {
    artifactRoot,
    label: 'review evidence',
    idField: 'evidenceId',
  });
  const boundCredentialEvidence = bindArtifactBytes(credentialEvidence, {
    artifactRoot,
    label: 'credential evidence',
    idField: 'credentialEvidenceId',
  });

  const envelope = createExternalReviewCredentialEvidenceEnvelope({
    envelopeId,
    applicabilityPacket,
    requirements,
    reviewEvidence: boundReviewEvidence,
    credentialEvidence: boundCredentialEvidence,
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
    const reviewEvidence = extractArray(readBoundedRegularJson(args.reviewEvidence), 'reviewEvidence', 'review evidence');
    const credentialEvidence = extractArray(readBoundedRegularJson(args.credentialEvidence), 'credentialEvidence', 'credential evidence');
    const envelope = prepareEnvelope({
      requirements: readBoundedRegularJson(args.requirements),
      applicabilityPacket: readBoundedRegularJson(args.applicability),
      reviewEvidence,
      credentialEvidence,
      envelopeId: args.envelopeId,
      preparedByRef: args.preparedBy,
      preparedAt: args.preparedAt,
      artifactRoot: args.artifactRoot,
    });

    if (args.out) writePrivateJson(args.out, envelope);
    else process.stdout.write(`${JSON.stringify(envelope, null, 2)}\n`);

    if (args.artifactRoot) {
      console.error(`E2B_LOCAL_ARTIFACT_BYTE_BINDING=PASS ${reviewEvidence.length + credentialEvidence.length}/${reviewEvidence.length + credentialEvidence.length}`);
      console.error('E2B_LOCAL_ARTIFACT_BYTE_BINDING_AUTHENTICITY_EFFECT=NONE');
    } else {
      console.error('E2B_LOCAL_ARTIFACT_BYTE_BINDING=NOT_REQUESTED');
    }

    if (envelope.status !== E2B_STATUS.READY_FOR_EXTERNAL_AUTHORITY_VALIDATION) process.exit(2);
  } catch (error) {
    console.error(`E2B_EXTERNAL_REVIEW_INTAKE_ERROR: ${error.message}`);
    process.exit(65);
  }
}

if (require.main === module) main();

module.exports = {
  MAX_JSON_BYTES,
  MAX_ARTIFACT_BYTES,
  usage,
  parseArgs,
  readBoundedRegularJson,
  writePrivateJson,
  containsPlaceholder,
  extractArray,
  isPathInside,
  resolveArtifactRoot,
  resolveBoundedArtifact,
  sha256RegularFile,
  bindArtifactBytes,
  prepareEnvelope,
  main,
};
