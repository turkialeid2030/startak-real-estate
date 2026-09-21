#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  E2D_STATUS,
  createSubstantiveReviewActivationProposal,
  verifySubstantiveReviewActivationProposalIntegrity,
} = require('../src/standards/substantive-review-activation-proposal');

const MAX_JSON_BYTES = 4 * 1024 * 1024;

function usage() {
  return [
    'Usage:',
    '  node tools/e2d-substantive-review-activation-intake.js \\',
    '    --policy <e2d-policy.json> \\',
    '    --applicability <qualified-e2-applicability-packet.json> \\',
    '    --evidence-envelope <qualified-e2b-evidence-envelope.json> \\',
    '    --authority-validation <qualified-e2c-authority-validation.json> \\',
    '    --mappings <activation-mappings.json> \\',
    '    --proposal-id <proposal-id> \\',
    '    --prepared-by <actor-ref> \\',
    '    --prepared-at <iso-8601> \\',
    '    [--out <e2d-proposal.json>]',
    '',
    'Input shape:',
    '  --mappings accepts a JSON array or {"activationMappings":[...]}',
    '',
    'Safety:',
    '  This tool only validates supplied E2/E2B/E2C evidence and activation mappings through the repository E2D implementation.',
    '  It does not create human review evidence, credential evidence, authority attestations, mapping evidence, signatures, rule activation, release, merge, deployment, transaction authority, or Go-Live.',
    '  Unresolved template placeholders are rejected. Production readiness requires genuine external inputs; synthetic fixtures are test-only.',
  ].join('\n');
}

function parseArgs(argv) {
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) return { help: true };
  const map = {
    '--policy': 'policy',
    '--applicability': 'applicability',
    '--evidence-envelope': 'evidenceEnvelope',
    '--authority-validation': 'authorityValidation',
    '--mappings': 'mappings',
    '--proposal-id': 'proposalId',
    '--prepared-by': 'preparedBy',
    '--prepared-at': 'preparedAt',
    '--out': 'out',
  };
  const args = {
    policy: null,
    applicability: null,
    evidenceEnvelope: null,
    authorityValidation: null,
    mappings: null,
    proposalId: null,
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
  for (const key of ['policy', 'applicability', 'evidenceEnvelope', 'authorityValidation', 'mappings', 'proposalId', 'preparedBy', 'preparedAt']) {
    if (!args[key]) {
      const flag = Object.entries(map).find(([, value]) => value === key)?.[0] || key;
      throw new Error(`${flag} is required`);
    }
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

function extractMappings(value) {
  const list = Array.isArray(value) ? value : value?.activationMappings;
  if (!Array.isArray(list)) throw new Error('mappings input must be a JSON array or object containing activationMappings');
  if (containsPlaceholder(list)) throw new Error('mappings input contains unresolved template placeholders');
  return list;
}

function prepareProposal({
  policy,
  applicabilityPacket,
  externalEvidenceEnvelope,
  authorityValidationPacket,
  activationMappings,
  proposalId,
  preparedByRef,
  preparedAt,
} = {}) {
  for (const [label, value] of [
    ['policy', policy],
    ['E2 applicability packet', applicabilityPacket],
    ['E2B evidence envelope', externalEvidenceEnvelope],
    ['E2C authority validation packet', authorityValidationPacket],
    ['activation mappings', activationMappings],
  ]) {
    if (containsPlaceholder(value)) throw new Error(`${label} contains unresolved template placeholders`);
  }

  const packet = createSubstantiveReviewActivationProposal({
    proposalId,
    applicabilityPacket,
    externalEvidenceEnvelope,
    authorityValidationPacket,
    policy,
    activationMappings,
    preparedByRef,
    preparedAt,
  });

  if (packet.proposalPacketHashSha256 && !verifySubstantiveReviewActivationProposalIntegrity(packet)) {
    throw new Error('repository E2D proposal integrity verification failed after construction');
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
    const applicabilityPacket = readBoundedRegularJson(args.applicability);
    const externalEvidenceEnvelope = readBoundedRegularJson(args.evidenceEnvelope);
    const authorityValidationPacket = readBoundedRegularJson(args.authorityValidation);
    const activationMappings = extractMappings(readBoundedRegularJson(args.mappings));
    const packet = prepareProposal({
      policy,
      applicabilityPacket,
      externalEvidenceEnvelope,
      authorityValidationPacket,
      activationMappings,
      proposalId: args.proposalId,
      preparedByRef: args.preparedBy,
      preparedAt: args.preparedAt,
    });

    if (args.out) writePrivateJson(args.out, packet);
    else process.stdout.write(`${JSON.stringify(packet, null, 2)}\n`);

    if (packet.status !== E2D_STATUS.ACTIVATION_PROPOSAL_READY_FOR_IMPLEMENTATION_GOVERNANCE) process.exit(2);
  } catch (error) {
    console.error(`E2D_ACTIVATION_INTAKE_ERROR: ${error.message}`);
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
  extractMappings,
  prepareProposal,
  main,
};
