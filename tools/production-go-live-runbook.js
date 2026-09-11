#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  STATUS,
  preparePinnedE2gDecisionSigningRequest,
  preparePinnedE2hAttestationSigningRequest,
  preparePinnedE2iEvidenceSigningRequest,
  evaluateProductionGoLiveRunbook,
} = require('../src/qualification/production-go-live-runbook');

const MAX_JSON_BYTES = 4 * 1024 * 1024;

function usage() {
  return [
    'Usage:',
    '  node tools/production-go-live-runbook.js status [stage packet/pin options] [--out <result.json>]',
    '  node tools/production-go-live-runbook.js e2g --policy <policy.json> --upstream <e2f.json> --upstream-pin <sha256> --registry <registry.json> --registry-pin <sha256> --decision <unsigned.json> [--out <result.json>]',
    '  node tools/production-go-live-runbook.js e2h --policy <policy.json> --upstream <e2g.json> --upstream-pin <sha256> --registry <registry.json> --registry-pin <sha256> --attestation <unsigned.json> [--out <result.json>]',
    '  node tools/production-go-live-runbook.js e2i --policy <policy.json> --upstream <e2h.json> --upstream-pin <sha256> --registry <registry.json> --registry-pin <sha256> --evidence <unsigned.json> [--out <result.json>]',
    '',
    'Status options:',
    '  --e2f <packet.json> --e2f-pin <sha256>',
    '  --e2g <packet.json> --e2g-pin <sha256>',
    '  --e2h <packet.json> --e2h-pin <sha256>',
    '  --e2i <packet.json> --e2i-pin <sha256>',
    '',
    'Safety:',
    '  Read-only orchestration only. Every supplied stage packet requires an independently supplied pinned packet hash.',
    '  The tool never merges, deploys, dispatches workflows, calls Cloudflare, signs evidence, activates standards, authorizes go-live, or authorizes transactions.',
  ].join('\n');
}

function parseArgs(argv) {
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) return { help: true };
  const mode = argv[0];
  if (!['status', 'e2g', 'e2h', 'e2i'].includes(mode)) throw new Error(`unknown mode: ${mode}`);
  const args = { mode, out: null };
  const allowedByMode = {
    status: new Set(['--out', '--e2f', '--e2f-pin', '--e2g', '--e2g-pin', '--e2h', '--e2h-pin', '--e2i', '--e2i-pin']),
    e2g: new Set(['--out', '--policy', '--upstream', '--upstream-pin', '--registry', '--registry-pin', '--decision']),
    e2h: new Set(['--out', '--policy', '--upstream', '--upstream-pin', '--registry', '--registry-pin', '--attestation']),
    e2i: new Set(['--out', '--policy', '--upstream', '--upstream-pin', '--registry', '--registry-pin', '--evidence']),
  };
  const keyMap = {
    '--out': 'out', '--e2f': 'e2f', '--e2f-pin': 'e2fPin', '--e2g': 'e2g', '--e2g-pin': 'e2gPin',
    '--e2h': 'e2h', '--e2h-pin': 'e2hPin', '--e2i': 'e2i', '--e2i-pin': 'e2iPin',
    '--policy': 'policy', '--upstream': 'upstream', '--upstream-pin': 'upstreamPin', '--registry': 'registry',
    '--registry-pin': 'registryPin', '--decision': 'decision', '--attestation': 'attestation', '--evidence': 'evidence',
  };
  const seen = new Set();
  for (let index = 1; index < argv.length; index += 1) {
    const token = argv[index];
    if (!allowedByMode[mode].has(token)) throw new Error(`argument not allowed in ${mode} mode: ${token}`);
    const key = keyMap[token];
    if (seen.has(key)) throw new Error(`duplicate argument: ${token}`);
    seen.add(key);
    args[key] = argv[++index] || null;
    if (!args[key]) throw new Error(`missing value for ${token}`);
  }
  if (mode !== 'status') {
    for (const key of ['policy', 'upstream', 'upstreamPin', 'registry', 'registryPin']) {
      if (!args[key]) throw new Error(`${key} is required in ${mode} mode`);
    }
    if (mode === 'e2g' && !args.decision) throw new Error('decision is required in e2g mode');
    if (mode === 'e2h' && !args.attestation) throw new Error('attestation is required in e2h mode');
    if (mode === 'e2i' && !args.evidence) throw new Error('evidence is required in e2i mode');
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

function readOptionalJson(filePath) {
  return filePath ? readBoundedRegularJson(filePath) : null;
}

function execute(args) {
  if (args.mode === 'status') {
    return evaluateProductionGoLiveRunbook({
      e2fValidationPacket: readOptionalJson(args.e2f),
      expectedE2fValidationPacketHashSha256: args.e2fPin || null,
      e2gDecisionPacket: readOptionalJson(args.e2g),
      expectedE2gDecisionPacketHashSha256: args.e2gPin || null,
      e2hCloseoutPacket: readOptionalJson(args.e2h),
      expectedE2hCloseoutPacketHashSha256: args.e2hPin || null,
      e2iReadinessPacket: readOptionalJson(args.e2i),
      expectedE2iReadinessPacketHashSha256: args.e2iPin || null,
    });
  }

  const policy = readBoundedRegularJson(args.policy);
  const upstream = readBoundedRegularJson(args.upstream);
  const registry = readBoundedRegularJson(args.registry);
  if (args.mode === 'e2g') {
    return preparePinnedE2gDecisionSigningRequest({
      expectedUpstreamValidationPacketHashSha256: args.upstreamPin,
      upstreamValidationPacket: upstream,
      policy,
      releaseAuthorityRegistry: registry,
      expectedReleaseAuthorityRegistryHashSha256: args.registryPin,
      decision: readBoundedRegularJson(args.decision),
    });
  }
  if (args.mode === 'e2h') {
    return preparePinnedE2hAttestationSigningRequest({
      expectedUpstreamDecisionPacketHashSha256: args.upstreamPin,
      upstreamDecisionPacket: upstream,
      policy,
      executionAttestorRegistry: registry,
      expectedExecutionAttestorRegistryHashSha256: args.registryPin,
      attestation: readBoundedRegularJson(args.attestation),
    });
  }
  return preparePinnedE2iEvidenceSigningRequest({
    expectedUpstreamCloseoutPacketHashSha256: args.upstreamPin,
    upstreamCloseoutPacket: upstream,
    policy,
    readinessVerifierRegistry: registry,
    expectedReadinessVerifierRegistryHashSha256: args.registryPin,
    evidence: readBoundedRegularJson(args.evidence),
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
    const result = execute(args);
    if (args.out) writePrivateJson(args.out, result);
    else process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (result.status === STATUS.HOLD_PRODUCTION_CHAIN_PROVENANCE_PIN
      || result.status === STATUS.HOLD_PRODUCTION_CHAIN_INTEGRITY
      || result.status === STATUS.HOLD_PRODUCTION_CHAIN_STAGE_GAP
      || result.status === STATUS.HOLD_RELEASE_CANDIDATE_DRIFT) process.exit(2);
  } catch (error) {
    console.error(`PRODUCTION_GO_LIVE_RUNBOOK_ERROR: ${error.message}`);
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
  execute,
  main,
};
