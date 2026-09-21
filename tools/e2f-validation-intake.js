#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
  E2F_STATUS,
  createValidationSigningPayload,
  createExternalConformanceProductionValidationPacket,
  verifyExternalConformanceProductionValidationPacketIntegrity,
} = require('../src/standards/external-conformance-production-validation');

const MAX_JSON_BYTES = 4 * 1024 * 1024;
const SIGNING_REQUEST_STATUS = 'READY_FOR_EXTERNAL_HUMAN_RSA_SHA256_SIGNATURE';

function usage() {
  return [
    'Usage:',
    '  node tools/e2f-validation-intake.js signing-request \\',
    '    --policy <e2f-policy.json> \\',
    '    --validation <unsigned-validation.json> \\',
    '    [--out <signing-request.json>]',
    '',
    '  node tools/e2f-validation-intake.js packet \\',
    '    --policy <e2f-policy.json> \\',
    '    --upstream <qualified-e2e-packet.json> \\',
    '    --release <release-candidate.json> \\',
    '    --registry <e2f-verifier-registry.json> \\',
    '    --expected-registry-sha <sha256> \\',
    '    --validations <signed-validations.json> \\',
    '    --packet-id <validation-packet-id> \\',
    '    --prepared-by <actor-ref> \\',
    '    --prepared-at <iso-8601> \\',
    '    [--out <e2f-packet.json>]',
    '',
    'Safety:',
    '  signing-request emits only canonical bytes for external human signing; it never accepts a private key or signs.',
    '  packet mode verifies supplied signed validations through the repository E2F implementation.',
    '  Template placeholders are rejected. No result, signature, release, merge, deployment, transaction authority, or Go-Live is inferred.',
  ].join('\n');
}

function parseArgs(argv) {
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) return { help: true };
  const mode = argv[0];
  if (!['signing-request', 'packet'].includes(mode)) throw new Error(`unknown mode: ${mode}`);
  const map = {
    '--policy': 'policy',
    '--validation': 'validation',
    '--upstream': 'upstream',
    '--release': 'release',
    '--registry': 'registry',
    '--expected-registry-sha': 'expectedRegistrySha',
    '--validations': 'validations',
    '--packet-id': 'packetId',
    '--prepared-by': 'preparedBy',
    '--prepared-at': 'preparedAt',
    '--out': 'out',
  };
  const args = {
    mode,
    policy: null,
    validation: null,
    upstream: null,
    release: null,
    registry: null,
    expectedRegistrySha: null,
    validations: null,
    packetId: null,
    preparedBy: null,
    preparedAt: null,
    out: null,
  };
  const seen = new Set();
  for (let index = 1; index < argv.length; index += 1) {
    const token = argv[index];
    const key = map[token];
    if (!key) throw new Error(`unknown argument: ${token}`);
    if (seen.has(key)) throw new Error(`duplicate argument: ${token}`);
    seen.add(key);
    args[key] = argv[++index] || null;
    if (!args[key]) throw new Error(`missing value for ${token}`);
  }
  if (!args.policy) throw new Error('--policy is required');
  if (mode === 'signing-request') {
    if (!args.validation) throw new Error('--validation is required in signing-request mode');
    for (const key of ['upstream', 'release', 'registry', 'expectedRegistrySha', 'validations', 'packetId', 'preparedBy', 'preparedAt']) {
      if (args[key]) throw new Error(`${key} is not allowed in signing-request mode`);
    }
  } else {
    for (const [key, flag] of [
      ['upstream', '--upstream'],
      ['release', '--release'],
      ['registry', '--registry'],
      ['expectedRegistrySha', '--expected-registry-sha'],
      ['validations', '--validations'],
      ['packetId', '--packet-id'],
      ['preparedBy', '--prepared-by'],
      ['preparedAt', '--prepared-at'],
    ]) {
      if (!args[key]) throw new Error(`${flag} is required in packet mode`);
    }
    if (args.validation) throw new Error('validation is not allowed in packet mode');
    if (!/^[a-f0-9]{64}$/i.test(args.expectedRegistrySha)) throw new Error('--expected-registry-sha must be a 64-character SHA-256 digest');
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

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
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

function sha256Utf8(value) {
  return crypto.createHash('sha256').update(Buffer.from(value, 'utf8')).digest('hex');
}

function prepareValidationSigningRequest({ policy, validation } = {}) {
  if (!validation || typeof validation !== 'object' || Array.isArray(validation)) throw new Error('validation must be an object');
  if (containsPlaceholder(validation)) throw new Error('validation contains unresolved template placeholders');
  if (typeof validation.signatureBase64 === 'string' && validation.signatureBase64.trim()) {
    throw new Error('signing-request mode requires an unsigned validation; signatureBase64 must be absent or empty');
  }

  const payload = createValidationSigningPayload(validation, policy);
  const signingBytesUtf8 = stableStringify(payload);
  return Object.freeze({
    schemaVersion: 1,
    status: SIGNING_REQUEST_STATUS,
    validationId: payload.validationId,
    validationType: payload.validationType,
    signatureAlgorithm: payload.signatureAlgorithm,
    payload,
    signingBytesUtf8,
    signingPayloadBase64: Buffer.from(signingBytesUtf8, 'utf8').toString('base64'),
    signingPayloadHashSha256: sha256Utf8(signingBytesUtf8),
    privateKeyAccepted: false,
    signingPerformed: false,
    authorityEffect: 'NONE',
  });
}

function extractValidations(value) {
  const list = Array.isArray(value) ? value : value?.validations;
  if (!Array.isArray(list)) throw new Error('validations input must be a JSON array or object containing validations');
  if (containsPlaceholder(list)) throw new Error('validations input contains unresolved template placeholders');
  return list;
}

function prepareValidationPacket({
  policy,
  upstreamEvidencePacket,
  releaseCandidate,
  trustedVerifierRegistry,
  expectedTrustedRegistryHashSha256,
  validations,
  validationPacketId,
  preparedByRef,
  preparedAt,
} = {}) {
  if (containsPlaceholder(upstreamEvidencePacket)) throw new Error('upstream E2E packet contains unresolved template placeholders');
  if (containsPlaceholder(releaseCandidate)) throw new Error('release candidate input contains unresolved template placeholders');
  if (containsPlaceholder(trustedVerifierRegistry)) throw new Error('verifier registry contains unresolved template placeholders');
  if (containsPlaceholder(validations)) throw new Error('validations contain unresolved template placeholders');

  const packet = createExternalConformanceProductionValidationPacket({
    validationPacketId,
    upstreamEvidencePacket,
    policy,
    releaseCandidate,
    trustedVerifierRegistry,
    expectedTrustedRegistryHashSha256,
    validations,
    preparedByRef,
    preparedAt,
  });
  if (packet.validationPacketHashSha256 && !verifyExternalConformanceProductionValidationPacketIntegrity(packet)) {
    throw new Error('repository E2F packet integrity verification failed after construction');
  }
  return packet;
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
    const policy = readBoundedRegularJson(args.policy);
    let result;
    if (args.mode === 'signing-request') {
      result = prepareValidationSigningRequest({ policy, validation: readBoundedRegularJson(args.validation) });
    } else {
      result = prepareValidationPacket({
        policy,
        upstreamEvidencePacket: readBoundedRegularJson(args.upstream),
        releaseCandidate: readBoundedRegularJson(args.release),
        trustedVerifierRegistry: readBoundedRegularJson(args.registry),
        expectedTrustedRegistryHashSha256: args.expectedRegistrySha,
        validations: extractValidations(readBoundedRegularJson(args.validations)),
        validationPacketId: args.packetId,
        preparedByRef: args.preparedBy,
        preparedAt: args.preparedAt,
      });
    }

    if (args.out) writePrivateJson(args.out, result);
    else process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);

    const ready = args.mode === 'signing-request'
      ? result.status === SIGNING_REQUEST_STATUS
      : result.status === E2F_STATUS.EXTERNAL_CONFORMANCE_AND_PRODUCTION_VALIDATION_COMPLETE_PENDING_RELEASE_AUTHORITY;
    if (!ready) process.exit(2);
  } catch (error) {
    console.error(`E2F_VALIDATION_INTAKE_ERROR: ${error.message}`);
    process.exit(65);
  }
}

if (require.main === module) main();

module.exports = {
  MAX_JSON_BYTES,
  SIGNING_REQUEST_STATUS,
  usage,
  parseArgs,
  readBoundedRegularJson,
  writePrivateJson,
  stableStringify,
  containsPlaceholder,
  sha256Utf8,
  prepareValidationSigningRequest,
  extractValidations,
  prepareValidationPacket,
  main,
};
