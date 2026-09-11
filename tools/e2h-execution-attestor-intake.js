#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  STATUS,
  prepareExecutionAttestorRegistryIntake,
  prepareExecutionAttestationSigningRequest,
} = require('../src/qualification/e2h-execution-attestor-intake');

const MAX_JSON_BYTES = 2 * 1024 * 1024;

function usage() {
  return [
    'Usage:',
    '  node tools/e2h-execution-attestor-intake.js registry --registry <registry.json> [--out <result.json>]',
    '  node tools/e2h-execution-attestor-intake.js attestation --policy <policy.json> --upstream <e2g.json> --registry <registry.json> --expected-registry-sha <sha256> --attestation <unsigned-attestation.json> [--out <result.json>]',
    '',
    'Safety: public attestor material and unsigned attestation payloads only; no signing, merge, deployment or production mutation.',
  ].join('\n');
}

function parseArgs(argv) {
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) return { help: true };
  const mode = argv[0];
  if (!['registry', 'attestation'].includes(mode)) throw new Error(`unknown mode: ${mode}`);
  const args = { mode, registry: null, out: null, policy: null, upstream: null, expectedRegistrySha: null, attestation: null };
  const map = { '--registry': 'registry', '--out': 'out', '--policy': 'policy', '--upstream': 'upstream', '--expected-registry-sha': 'expectedRegistrySha', '--attestation': 'attestation' };
  const seen = new Set();
  for (let i = 1; i < argv.length; i += 1) {
    const token = argv[i];
    const key = map[token];
    if (!key) throw new Error(`unknown argument: ${token}`);
    if (seen.has(key)) throw new Error(`duplicate argument: ${token}`);
    seen.add(key);
    args[key] = argv[++i] || null;
    if (!args[key]) throw new Error(`missing value for ${token}`);
  }
  if (!args.registry) throw new Error('--registry is required');
  if (mode === 'registry') {
    for (const key of ['policy', 'upstream', 'expectedRegistrySha', 'attestation']) if (args[key]) throw new Error(`${key} is not allowed in registry mode`);
  } else {
    if (!args.policy) throw new Error('--policy is required in attestation mode');
    if (!args.upstream) throw new Error('--upstream is required in attestation mode');
    if (!args.expectedRegistrySha) throw new Error('--expected-registry-sha is required in attestation mode');
    if (!args.attestation) throw new Error('--attestation is required in attestation mode');
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
  try { args = parseArgs(process.argv.slice(2)); } catch (error) {
    console.error(error.message); console.error(usage()); process.exit(64);
  }
  if (args.help) { console.log(usage()); return; }
  try {
    const registry = readBoundedRegularJson(args.registry);
    const result = args.mode === 'registry'
      ? prepareExecutionAttestorRegistryIntake({ registry })
      : prepareExecutionAttestationSigningRequest({
        policy: readBoundedRegularJson(args.policy),
        upstreamDecisionPacket: readBoundedRegularJson(args.upstream),
        executionAttestorRegistry: registry,
        expectedExecutionAttestorRegistryHashSha256: args.expectedRegistrySha,
        attestation: readBoundedRegularJson(args.attestation),
      });
    if (args.out) writePrivateJson(args.out, result); else process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    const ready = args.mode === 'registry'
      ? result.status === STATUS.READY_FOR_E2H_EXECUTION_ATTESTOR_TRUST_ROOT_PINNING
      : result.status === STATUS.READY_FOR_EXTERNAL_EXECUTION_RSA_SHA256_SIGNATURE;
    if (!ready) process.exit(2);
  } catch (error) {
    console.error(`E2H_EXECUTION_ATTESTOR_INTAKE_ERROR: ${error.message}`); process.exit(65);
  }
}

if (require.main === module) main();
module.exports = { MAX_JSON_BYTES, usage, parseArgs, readBoundedRegularJson, writePrivateJson, main };
