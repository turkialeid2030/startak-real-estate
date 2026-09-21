#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  E2I_STATUS,
  createProductionEvidenceGoLiveReadinessPacket,
} = require('../src/standards/production-evidence-go-live-readiness');

const MAX_JSON_BYTES = 2 * 1024 * 1024;

function usage() {
  return [
    'Usage:',
    '  node tools/e2i-production-readiness-aggregate.js \\',
    '    --packet-id <READINESS_PACKET_ID> \\',
    '    --policy <e2i-policy.json> \\',
    '    --upstream <genuine-e2h-closeout.json> \\',
    '    --registry <readiness-verifier-registry.json> \\',
    '    --expected-registry-sha256 <independently-pinned-sha256> \\',
    '    --evidence <signed-evidence-set.json> \\',
    '    --prepared-by <PREPARER_REF> \\',
    '    --prepared-at <ISO8601_TIME> [--output <e2i-readiness-packet.json>]',
    '',
    'Safety:',
    '  This tool aggregates already-signed E2I readiness evidence only.',
    '  It does not create external evidence, signatures, trust, release authority, professional authority, transactions or production mutations.',
    '  Private keys, secrets, credentials, tokens, passwords and template-only inputs are rejected.',
  ].join('\n');
}

function parseArgs(argv) {
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) return { help: true };
  const args = {
    packetId: null,
    policy: null,
    upstream: null,
    registry: null,
    expectedRegistrySha256: null,
    evidence: null,
    preparedBy: null,
    preparedAt: null,
    output: null,
  };
  const map = {
    '--packet-id': 'packetId',
    '--policy': 'policy',
    '--upstream': 'upstream',
    '--registry': 'registry',
    '--expected-registry-sha256': 'expectedRegistrySha256',
    '--evidence': 'evidence',
    '--prepared-by': 'preparedBy',
    '--prepared-at': 'preparedAt',
    '--output': 'output',
  };
  const seen = new Set();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const key = map[token];
    if (!key) throw new Error(`unknown argument: ${token}`);
    if (seen.has(key)) throw new Error(`duplicate argument: ${token}`);
    seen.add(key);
    const value = argv[++index];
    if (!value) throw new Error(`missing value for ${token}`);
    args[key] = value;
  }
  for (const key of ['packetId', 'policy', 'upstream', 'registry', 'expectedRegistrySha256', 'evidence', 'preparedBy', 'preparedAt']) {
    if (!args[key]) throw new Error(`${key} is required`);
  }
  return args;
}

function readBoundedRegularJson(filePath, label) {
  const resolved = path.resolve(filePath);
  const stat = fs.lstatSync(resolved);
  if (stat.isSymbolicLink()) throw new Error(`${label}_SYMLINK_REJECTED:${resolved}`);
  if (!stat.isFile()) throw new Error(`${label}_MUST_BE_REGULAR_FILE:${resolved}`);
  if (stat.size > MAX_JSON_BYTES) throw new Error(`${label}_TOO_LARGE:${resolved}`);
  return JSON.parse(fs.readFileSync(resolved, 'utf8'));
}

function findForbiddenSecretMaterial(value, trail = 'input') {
  if (!value || typeof value !== 'object') return null;
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const hit = findForbiddenSecretMaterial(value[index], `${trail}[${index}]`);
      if (hit) return hit;
    }
    return null;
  }
  for (const [key, child] of Object.entries(value)) {
    if (/(private.?key|secret|password|token|credential)/i.test(key)) return `${trail}.${key}`;
    const hit = findForbiddenSecretMaterial(child, `${trail}.${key}`);
    if (hit) return hit;
  }
  return null;
}

function findTemplateOnly(value, trail = 'input') {
  if (!value || typeof value !== 'object') return null;
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const hit = findTemplateOnly(value[index], `${trail}[${index}]`);
      if (hit) return hit;
    }
    return null;
  }
  if (value.templateOnly === true) return `${trail}.templateOnly`;
  for (const [key, child] of Object.entries(value)) {
    const hit = findTemplateOnly(child, `${trail}.${key}`);
    if (hit) return hit;
  }
  return null;
}

function writePrivateJson(filePath, value) {
  const serialized = `${JSON.stringify(value, null, 2)}\n`;
  if (!filePath) {
    process.stdout.write(serialized);
    return;
  }
  const resolved = path.resolve(filePath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  if (fs.existsSync(resolved) && fs.lstatSync(resolved).isSymbolicLink()) {
    throw new Error(`OUTPUT_SYMLINK_REJECTED:${resolved}`);
  }
  fs.writeFileSync(resolved, serialized, { encoding: 'utf8', mode: 0o600 });
  fs.chmodSync(resolved, 0o600);
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`E2I_PRODUCTION_READINESS_AGGREGATE_ERROR=${error.message}\n`);
    process.stderr.write(`${usage()}\n`);
    process.exit(64);
  }
  if (args.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }

  try {
    const inputs = {
      policy: readBoundedRegularJson(args.policy, 'POLICY'),
      upstream: readBoundedRegularJson(args.upstream, 'UPSTREAM'),
      registry: readBoundedRegularJson(args.registry, 'REGISTRY'),
      evidence: readBoundedRegularJson(args.evidence, 'EVIDENCE'),
    };

    for (const [label, value] of Object.entries(inputs)) {
      const forbidden = findForbiddenSecretMaterial(value, label);
      if (forbidden) throw new Error(`FORBIDDEN_SECRET_MATERIAL:${forbidden}`);
      const templateOnly = findTemplateOnly(value, label);
      if (templateOnly) throw new Error(`TEMPLATE_ONLY_INPUT_REJECTED:${templateOnly}`);
    }

    const result = createProductionEvidenceGoLiveReadinessPacket({
      readinessPacketId: args.packetId,
      upstreamCloseoutPacket: inputs.upstream,
      policy: inputs.policy,
      readinessVerifierRegistry: inputs.registry,
      expectedReadinessVerifierRegistryHashSha256: args.expectedRegistrySha256,
      readinessEvidence: inputs.evidence,
      preparedByRef: args.preparedBy,
      preparedAt: args.preparedAt,
    });

    writePrivateJson(args.output, result);
    process.stderr.write(`E2I_PRODUCTION_READINESS_AGGREGATE_STATUS=${result.status}\n`);

    if (result.status !== E2I_STATUS.GO_LIVE_READY_FOR_UNLICENSED_DECISION_SUPPORT) process.exit(2);
  } catch (error) {
    process.stderr.write(`E2I_PRODUCTION_READINESS_AGGREGATE_ERROR=${error && error.message ? error.message : String(error)}\n`);
    process.exit(65);
  }
}

if (require.main === module) main();

module.exports = {
  MAX_JSON_BYTES,
  usage,
  parseArgs,
  readBoundedRegularJson,
  findForbiddenSecretMaterial,
  findTemplateOnly,
  writePrivateJson,
  main,
};
