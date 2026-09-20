#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  E2E_STATUS,
  createRuleImplementationConformanceEvidencePacket,
  verifyRuleImplementationConformanceEvidencePacketIntegrity,
} = require('../src/standards/rule-implementation-conformance-evidence');

const MAX_JSON_BYTES = 4 * 1024 * 1024;

function usage() {
  return [
    'Usage:',
    '  node tools/e2e-rule-implementation-conformance-intake.js \\',
    '    --policy <e2e-policy.json> \\',
    '    --upstream <qualified-e2d-proposal.json> \\',
    '    --implementation <implementation-evidence.json> \\',
    '    --conformance <independent-conformance-evidence.json> \\',
    '    --packet-id <evidence-packet-id> \\',
    '    --prepared-by <actor-ref> \\',
    '    --prepared-at <iso-8601> \\',
    '    [--expected-source-sha <40-hex>] \\',
    '    [--out <packet.json>]',
    '',
    'Input shape:',
    '  --implementation accepts a JSON array or {"implementationEvidence":[...]}',
    '  --conformance accepts a JSON array or {"conformanceEvidence":[...]}',
    '',
    'Safety:',
    '  This tool only normalizes and validates supplied evidence through the repository E2E implementation.',
    '  It does not create substantive-review evidence, implementation evidence, independent conformance evidence, signatures, authority, merge, deployment, or Go-Live.',
    '  Template placeholders are rejected. A READY result is structural/governance evidence readiness only.',
  ].join('\n');
}

function parseArgs(argv) {
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) return { help: true };
  const map = {
    '--policy': 'policy',
    '--upstream': 'upstream',
    '--implementation': 'implementation',
    '--conformance': 'conformance',
    '--packet-id': 'packetId',
    '--prepared-by': 'preparedBy',
    '--prepared-at': 'preparedAt',
    '--expected-source-sha': 'expectedSourceSha',
    '--out': 'out',
  };
  const args = {
    policy: null,
    upstream: null,
    implementation: null,
    conformance: null,
    packetId: null,
    preparedBy: null,
    preparedAt: null,
    expectedSourceSha: null,
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
  for (const key of ['policy', 'upstream', 'implementation', 'conformance', 'packetId', 'preparedBy', 'preparedAt']) {
    if (!args[key]) throw new Error(`--${key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)} is required`);
  }
  if (args.expectedSourceSha && !/^[a-f0-9]{40}$/i.test(args.expectedSourceSha)) {
    throw new Error('--expected-source-sha must be a 40-character commit SHA');
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
  if (!Array.isArray(list)) throw new Error(`${label} must be a JSON array or object containing ${key}`);
  if (containsPlaceholder(list)) throw new Error(`${label} contains unresolved template placeholders`);
  return list;
}

function preparePacket({
  policy,
  upstreamProposal,
  implementationEvidence,
  conformanceEvidence,
  evidencePacketId,
  preparedByRef,
  preparedAt,
  expectedSourceSha = null,
} = {}) {
  if (containsPlaceholder(upstreamProposal)) throw new Error('upstream E2D proposal contains unresolved template placeholders');
  if (containsPlaceholder(implementationEvidence)) throw new Error('implementation evidence contains unresolved template placeholders');
  if (containsPlaceholder(conformanceEvidence)) throw new Error('conformance evidence contains unresolved template placeholders');

  if (expectedSourceSha) {
    const expected = expectedSourceSha.toLowerCase();
    for (const record of implementationEvidence) {
      if (String(record?.sourceCommitSha || '').toLowerCase() !== expected) {
        throw new Error(`implementation sourceCommitSha mismatch for ${record?.implementationId || 'unknown-record'}`);
      }
    }
  }

  const packet = createRuleImplementationConformanceEvidencePacket({
    evidencePacketId,
    activationProposalPacket: upstreamProposal,
    policy,
    implementationEvidence,
    conformanceEvidence,
    preparedByRef,
    preparedAt,
  });

  if (packet.evidencePacketHashSha256 && !verifyRuleImplementationConformanceEvidencePacketIntegrity(packet)) {
    throw new Error('repository E2E packet integrity verification failed after construction');
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
    const upstreamProposal = readBoundedRegularJson(args.upstream);
    const implementationEvidence = extractArray(readBoundedRegularJson(args.implementation), 'implementationEvidence', 'implementation input');
    const conformanceEvidence = extractArray(readBoundedRegularJson(args.conformance), 'conformanceEvidence', 'conformance input');
    const packet = preparePacket({
      policy,
      upstreamProposal,
      implementationEvidence,
      conformanceEvidence,
      evidencePacketId: args.packetId,
      preparedByRef: args.preparedBy,
      preparedAt: args.preparedAt,
      expectedSourceSha: args.expectedSourceSha,
    });

    if (args.out) writePrivateJson(args.out, packet);
    else process.stdout.write(`${JSON.stringify(packet, null, 2)}\n`);

    if (packet.status !== E2E_STATUS.RULE_IMPLEMENTATION_EVIDENCE_READY_FOR_EXTERNAL_CONFORMANCE_VALIDATION) process.exit(2);
  } catch (error) {
    console.error(`E2E_EVIDENCE_INTAKE_ERROR: ${error.message}`);
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
  preparePacket,
  main,
};
