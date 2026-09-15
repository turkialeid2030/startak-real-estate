#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  STATUS,
  prepareCanonicalBaselineActivationAuthorization,
  verifyCanonicalBaselineActivationAuthorization,
} = require('../src/qualification/canonical-baseline-activation-authorization-operator');

const MAX_JSON_BYTES = 1024 * 1024;
const MODES = new Set(['prepare', 'verify']);
const ALLOWED_FLAGS = new Set([
  '--contract',
  '--authority-registry',
  '--expected-authority-registry-sha256',
  '--decision',
  '--attestation',
  '--output',
]);

function usage() {
  return [
    'Usage:',
    '  node tools/canonical-baseline-activation-authorization.js prepare --contract <p39.json> --authority-registry <registry.json> --expected-authority-registry-sha256 <sha256> --decision <decision.json> [--output <package.json>]',
    '  node tools/canonical-baseline-activation-authorization.js verify --contract <p39.json> --authority-registry <registry.json> --expected-authority-registry-sha256 <sha256> --attestation <signed-attestation.json> [--output <result.json>]',
    '',
    'Private signing keys are intentionally unsupported. Sign the prepare-mode signing bytes outside the repository.',
  ].join('\n');
}

function parseArgs(argv) {
  if (!Array.isArray(argv) || argv.length === 0) throw new Error('mode is required');
  const mode = argv[0];
  if (!MODES.has(mode)) throw new Error('mode must be prepare or verify');
  const values = {};
  for (let i = 1; i < argv.length; i += 2) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (!ALLOWED_FLAGS.has(flag)) throw new Error(`unknown argument: ${flag}`);
    if (typeof value !== 'string' || value.startsWith('--')) throw new Error(`missing value for ${flag}`);
    if (Object.prototype.hasOwnProperty.call(values, flag)) throw new Error(`duplicate argument: ${flag}`);
    values[flag] = value;
  }
  if (!values['--contract']) throw new Error('--contract is required');
  if (!values['--authority-registry']) throw new Error('--authority-registry is required');
  if (!values['--expected-authority-registry-sha256']) throw new Error('--expected-authority-registry-sha256 is required');
  if (mode === 'prepare') {
    if (!values['--decision']) throw new Error('--decision is required in prepare mode');
    if (values['--attestation']) throw new Error('--attestation is not allowed in prepare mode');
  } else {
    if (!values['--attestation']) throw new Error('--attestation is required in verify mode');
    if (values['--decision']) throw new Error('--decision is not allowed in verify mode');
  }
  return { mode, values };
}

function readJsonFile(filePath, label, fsModule = fs) {
  if (typeof filePath !== 'string' || filePath.trim() === '') throw new Error(`${label} path is required`);
  let stat;
  try {
    stat = fsModule.lstatSync(filePath);
  } catch (_) {
    throw new Error(`${label} file unavailable`);
  }
  if (stat.isSymbolicLink()) throw new Error(`${label} symlink rejected`);
  if (!stat.isFile()) throw new Error(`${label} must be a file`);
  if (stat.size > MAX_JSON_BYTES) throw new Error(`${label} file too large`);
  try {
    return JSON.parse(fsModule.readFileSync(filePath, 'utf8'));
  } catch (_) {
    throw new Error(`${label} JSON invalid`);
  }
}

function writeJsonOutput(outputPath, value, fsModule = fs) {
  const text = `${JSON.stringify(value, null, 2)}\n`;
  if (!outputPath) {
    process.stdout.write(text);
    return;
  }
  const dir = path.dirname(outputPath);
  if (!fsModule.existsSync(dir)) throw new Error('output directory does not exist');
  if (fsModule.existsSync(outputPath)) {
    const stat = fsModule.lstatSync(outputPath);
    if (stat.isSymbolicLink()) throw new Error('output symlink rejected');
    if (!stat.isFile()) throw new Error('output path must be a regular file');
  }
  fsModule.writeFileSync(outputPath, text, { encoding: 'utf8', mode: 0o600 });
  try { fsModule.chmodSync(outputPath, 0o600); } catch (_) { /* best effort on non-POSIX hosts */ }
}

function run(argv = process.argv.slice(2)) {
  let parsed;
  try {
    parsed = parseArgs(argv);
    const { mode, values } = parsed;
    const contract = readJsonFile(values['--contract'], 'contract');
    const activationAuthorityRegistry = readJsonFile(values['--authority-registry'], 'authority registry');
    const expectedActivationAuthorityRegistryHashSha256 = values['--expected-authority-registry-sha256'];
    const input = {
      contract,
      activationAuthorityRegistry,
      expectedActivationAuthorityRegistryHashSha256,
    };

    const result = mode === 'prepare'
      ? prepareCanonicalBaselineActivationAuthorization({
        ...input,
        decision: readJsonFile(values['--decision'], 'decision'),
      })
      : verifyCanonicalBaselineActivationAuthorization({
        ...input,
        attestation: readJsonFile(values['--attestation'], 'attestation'),
      });

    writeJsonOutput(values['--output'], result);
    if (mode === 'prepare') return result.status === STATUS.READY_FOR_EXTERNAL_OWNER_SIGNATURE ? 0 : 2;
    return result.status === STATUS.VERIFIED_SIGNED_OWNER_ACTIVATION_AUTHORIZATION ? 0 : 2;
  } catch (error) {
    process.stderr.write(`activation authorization operator error: ${error.message}\n`);
    process.stderr.write(`${usage()}\n`);
    return 1;
  }
}

if (require.main === module) process.exit(run());

module.exports = {
  MAX_JSON_BYTES,
  parseArgs,
  readJsonFile,
  writeJsonOutput,
  run,
};
