#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  STATUS,
  prepareReadinessVerifierRegistryIntake,
} = require('../src/qualification/readiness-verifier-registry-intake-package');

const MAX_JSON_BYTES = 2 * 1024 * 1024;

function usage() {
  return [
    'Usage:',
    '  node tools/readiness-verifier-registry-intake-package.js --registry <registry.json> [--out <result.json>]',
    '',
    'Purpose:',
    '  Validate a proposed E2I production-readiness verifier registry, verify coverage/diversity,',
    '  and emit the deterministic registry SHA-256 that must be pinned out of band.',
    '',
    'Safety:',
    '  This tool accepts public verifier material only. It does not establish trust, sign evidence,',
    '  pin the trust root, authorize release/deployment/go-live, or perform network/deployment actions.',
  ].join('\n');
}

function parseArgs(argv) {
  const args = { registry: null, out: null };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--help' || token === '-h') return { help: true };
    if (token === '--registry') {
      args.registry = argv[++index] || null;
      continue;
    }
    if (token === '--out') {
      args.out = argv[++index] || null;
      continue;
    }
    throw new Error(`unknown argument: ${token}`);
  }
  if (!args.registry) throw new Error('--registry is required');
  return args;
}

function readBoundedRegularJson(filePath) {
  const resolved = path.resolve(filePath);
  const lst = fs.lstatSync(resolved);
  if (lst.isSymbolicLink()) throw new Error(`symlink input is not allowed: ${resolved}`);
  if (!lst.isFile()) throw new Error(`input must be a regular file: ${resolved}`);
  if (lst.size > MAX_JSON_BYTES) throw new Error(`input exceeds ${MAX_JSON_BYTES} bytes: ${resolved}`);
  const raw = fs.readFileSync(resolved, 'utf8');
  return JSON.parse(raw);
}

function writePrivateJson(filePath, value) {
  const resolved = path.resolve(filePath);
  const parent = path.dirname(resolved);
  fs.mkdirSync(parent, { recursive: true });
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

  let registry;
  try {
    registry = readBoundedRegularJson(args.registry);
  } catch (error) {
    console.error(`READINESS_VERIFIER_REGISTRY_INPUT_ERROR: ${error.message}`);
    process.exit(65);
  }

  const result = prepareReadinessVerifierRegistryIntake({ registry });
  if (args.out) writePrivateJson(args.out, result);
  else process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);

  if (result.status !== STATUS.READY_FOR_OUT_OF_BAND_TRUST_ROOT_PINNING) process.exit(2);
}

if (require.main === module) main();

module.exports = {
  MAX_JSON_BYTES,
  parseArgs,
  readBoundedRegularJson,
  writePrivateJson,
  main,
};
