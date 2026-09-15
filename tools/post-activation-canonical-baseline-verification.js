#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  STATUS,
  evaluatePostActivationCanonicalBaselineVerification,
} = require('../src/qualification/post-activation-canonical-baseline-verification');

const MAX_JSON_BYTES = 1024 * 1024;
const PRIVATE_KEY_ARG_RE = /private[-_]?key|signing[-_]?key|secret[-_]?key/i;

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (PRIVATE_KEY_ARG_RE.test(arg)) throw new Error('private signing key argument rejected');
    if (!arg.startsWith('--')) throw new Error(`unexpected argument: ${arg}`);
    const key = arg.slice(2);
    const allowed = new Set([
      'activation-execution',
      'observed-registry',
      'contract',
      'authority-registry',
      'expected-authority-registry-sha256',
      'attestation',
      'release-verify-evidence',
      'output',
    ]);
    if (!allowed.has(key)) throw new Error(`unknown argument: --${key}`);
    if (i + 1 >= argv.length || argv[i + 1].startsWith('--')) throw new Error(`missing value for --${key}`);
    out[key] = argv[++i];
  }
  for (const required of [
    'activation-execution',
    'observed-registry',
    'contract',
    'authority-registry',
    'expected-authority-registry-sha256',
    'attestation',
  ]) {
    if (!out[required]) throw new Error(`--${required} is required`);
  }
  return out;
}

function readJsonSafe(filePath) {
  const stat = fs.lstatSync(filePath);
  if (stat.isSymbolicLink()) throw new Error('symlink input rejected');
  if (!stat.isFile()) throw new Error('input must be a regular file');
  if (stat.size > MAX_JSON_BYTES) throw new Error('input JSON exceeds size limit');
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJsonSafe(filePath, value) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  try { fs.chmodSync(filePath, 0o600); } catch (_) { /* platform may not support chmod */ }
}

function run(argv = process.argv.slice(2)) {
  try {
    const args = parseArgs(argv);
    const result = evaluatePostActivationCanonicalBaselineVerification({
      activationExecution: readJsonSafe(args['activation-execution']),
      observedRegistry: readJsonSafe(args['observed-registry']),
      contract: readJsonSafe(args.contract),
      activationAuthorityRegistry: readJsonSafe(args['authority-registry']),
      expectedActivationAuthorityRegistryHashSha256: args['expected-authority-registry-sha256'],
      activationAttestation: readJsonSafe(args.attestation),
      releaseVerifyEvidence: args['release-verify-evidence'] ? readJsonSafe(args['release-verify-evidence']) : null,
    });
    if (args.output) writeJsonSafe(args.output, result);
    else process.stdout.write(`${JSON.stringify(result)}\n`);

    if (result.status === STATUS.POST_ACTIVATION_RELEASE_VERIFY_EVIDENCE_CONSISTENT_GOVERNANCE_BLOCKED) return 0;
    if (result.status === STATUS.ROLLBACK_TRIGGERED_PREBOUND_LEGACY_ONLY) return 2;
    return 1;
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    return 1;
  }
}

if (require.main === module) process.exitCode = run();

module.exports = { parseArgs, readJsonSafe, run };
