#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  STATUS,
  prepareReleaseAuthorityRegistryIntake,
  prepareReleaseDecisionSigningRequest,
} = require('../src/qualification/e2g-release-authority-decision-intake');

const MAX_JSON_BYTES = 2 * 1024 * 1024;

function usage() {
  return [
    'Usage:',
    '  node tools/e2g-release-authority-decision-intake.js registry --registry <registry.json> [--out <result.json>]',
    '  node tools/e2g-release-authority-decision-intake.js decision --policy <policy.json> --upstream <e2f.json> --registry <registry.json> --expected-registry-sha <sha256> --decision <unsigned-decision.json> [--out <result.json>]',
    '',
    'Safety:',
    '  Accepts public authority material and unsigned decision payloads only.',
    '  Private keys, secrets, credentials and pre-signed decisions are rejected.',
    '  This tool does not sign, authorize, merge, deploy, activate, or access production.',
  ].join('\n');
}

function parseArgs(argv) {
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) return { help: true };
  const mode = argv[0];
  if (!['registry', 'decision'].includes(mode)) throw new Error(`unknown mode: ${mode}`);
  const args = { mode, registry: null, out: null, policy: null, upstream: null, expectedRegistrySha: null, decision: null };
  const seen = new Set();
  for (let index = 1; index < argv.length; index += 1) {
    const token = argv[index];
    const map = {
      '--registry': 'registry',
      '--out': 'out',
      '--policy': 'policy',
      '--upstream': 'upstream',
      '--expected-registry-sha': 'expectedRegistrySha',
      '--decision': 'decision',
    };
    const key = map[token];
    if (!key) throw new Error(`unknown argument: ${token}`);
    if (seen.has(key)) throw new Error(`duplicate argument: ${token}`);
    seen.add(key);
    args[key] = argv[++index] || null;
    if (!args[key]) throw new Error(`missing value for ${token}`);
  }
  if (!args.registry) throw new Error('--registry is required');
  if (mode === 'registry') {
    for (const key of ['policy', 'upstream', 'expectedRegistrySha', 'decision']) {
      if (args[key]) throw new Error(`${key} is not allowed in registry mode`);
    }
  } else {
    if (!args.policy) throw new Error('--policy is required in decision mode');
    if (!args.upstream) throw new Error('--upstream is required in decision mode');
    if (!args.expectedRegistrySha) throw new Error('--expected-registry-sha is required in decision mode');
    if (!args.decision) throw new Error('--decision is required in decision mode');
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
  const parent = path.dirname(resolved);
  fs.mkdirSync(parent, { recursive: true });
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
    let result;
    if (args.mode === 'registry') {
      result = prepareReleaseAuthorityRegistryIntake({ registry });
    } else {
      result = prepareReleaseDecisionSigningRequest({
        policy: readBoundedRegularJson(args.policy),
        upstreamValidationPacket: readBoundedRegularJson(args.upstream),
        releaseAuthorityRegistry: registry,
        expectedReleaseAuthorityRegistryHashSha256: args.expectedRegistrySha,
        decision: readBoundedRegularJson(args.decision),
      });
    }

    if (args.out) writePrivateJson(args.out, result);
    else process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);

    const ready = args.mode === 'registry'
      ? result.status === STATUS.READY_FOR_E2G_RELEASE_AUTHORITY_TRUST_ROOT_PINNING
      : result.status === STATUS.READY_FOR_EXTERNAL_HUMAN_RSA_SHA256_SIGNATURE;
    if (!ready) process.exit(2);
  } catch (error) {
    console.error(`E2G_RELEASE_AUTHORITY_INTAKE_ERROR: ${error.message}`);
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
