#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  STATUS,
  prepareReadinessVerifierRegistryOperationalIntake,
  prepareReadinessEvidenceSigningRequest,
} = require('../src/qualification/e2i-readiness-evidence-intake');

const MAX_JSON_BYTES = 2 * 1024 * 1024;

function usage() {
  return [
    'Usage:',
    '  node tools/e2i-readiness-evidence-intake.js registry --registry <registry.json> [--out <result.json>]',
    '  node tools/e2i-readiness-evidence-intake.js evidence --policy <policy.json> --upstream <e2h.json> --registry <registry.json> --expected-registry-sha <sha256> --evidence <unsigned-evidence.json> [--out <result.json>]',
    '',
    'Safety:',
    '  Public readiness-verifier material and unsigned readiness evidence only.',
    '  Private keys, secrets, credentials and pre-signed evidence are rejected.',
    '  No signature, go-live authorization, professional authority or production mutation is performed.',
  ].join('\n');
}

function parseArgs(argv) {
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) return { help: true };
  const mode = argv[0];
  if (!['registry', 'evidence'].includes(mode)) throw new Error(`unknown mode: ${mode}`);
  const args = { mode, registry: null, out: null, policy: null, upstream: null, expectedRegistrySha: null, evidence: null };
  const map = {
    '--registry': 'registry',
    '--out': 'out',
    '--policy': 'policy',
    '--upstream': 'upstream',
    '--expected-registry-sha': 'expectedRegistrySha',
    '--evidence': 'evidence',
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
  if (!args.registry) throw new Error('--registry is required');
  if (mode === 'registry') {
    for (const key of ['policy', 'upstream', 'expectedRegistrySha', 'evidence']) {
      if (args[key]) throw new Error(`${key} is not allowed in registry mode`);
    }
  } else {
    if (!args.policy) throw new Error('--policy is required in evidence mode');
    if (!args.upstream) throw new Error('--upstream is required in evidence mode');
    if (!args.expectedRegistrySha) throw new Error('--expected-registry-sha is required in evidence mode');
    if (!args.evidence) throw new Error('--evidence is required in evidence mode');
  }
  return args;
}

function readBoundedRegularJson(filePath) {
  const resolved = path.resolve(filePath);
  const lst = fs.lstatSync(resolved);
  if (lst.isSymbolicLink()) throw new Error(`symlink input is not allowed: ${resolved}`);
  if (!lst.isFile()) throw new Error(`input must be a regular file: ${resolved}`);
  if (lst.size > MAX_JSON_BYTES) throw new Error(`input exceeds ${MAX_JSON_BYTES} bytes: ${resolved}`);
  return JSON.parse(fs.readFileSync(resolved, 'utf8'));
}

function writePrivateJson(filePath, value) {
  const resolved = path.resolve(filePath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  if (fs.existsSync(resolved) && fs.lstatSync(resolved).isSymbolicLink()) throw new Error(`symlink output is not allowed: ${resolved}`);
  fs.writeFileSync(resolved, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  fs.chmodSync(resolved, 0o600);
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
    const result = args.mode === 'registry'
      ? prepareReadinessVerifierRegistryOperationalIntake({ registry })
      : prepareReadinessEvidenceSigningRequest({
        policy: readBoundedRegularJson(args.policy),
        upstreamCloseoutPacket: readBoundedRegularJson(args.upstream),
        readinessVerifierRegistry: registry,
        expectedReadinessVerifierRegistryHashSha256: args.expectedRegistrySha,
        evidence: readBoundedRegularJson(args.evidence),
      });

    if (args.out) writePrivateJson(args.out, result);
    else process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);

    const ready = args.mode === 'registry'
      ? result.status === STATUS.READY_FOR_E2I_READINESS_VERIFIER_TRUST_ROOT_PINNING
      : result.status === STATUS.READY_FOR_EXTERNAL_READINESS_RSA_SHA256_SIGNATURE;
    if (!ready) process.exit(2);
  } catch (error) {
    console.error(`E2I_READINESS_EVIDENCE_INTAKE_ERROR: ${error.message}`);
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
  main,
};
