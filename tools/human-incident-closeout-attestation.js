#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  STATUS,
  prepareHumanIncidentCloseoutAttestation,
  verifyHumanIncidentCloseoutAttestation,
} = require('../src/qualification/human-incident-closeout-attestation');

const MAX_JSON_BYTES = 256 * 1024;
const PRIVATE_KEY_ARG_RE = /private[-_]?key|secret[-_]?key|signing[-_]?key/i;

function parseArgs(argv) {
  const args = {};
  const allowed = new Set([
    '--mode', '--p44', '--authority-registry', '--expected-authority-registry-sha256',
    '--decision', '--attestation', '--output',
  ]);
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    if (PRIVATE_KEY_ARG_RE.test(key || '')) throw new Error('private signing key argument rejected');
    if (!allowed.has(key)) throw new Error(`unknown argument: ${key || '<missing>'}`);
    const value = argv[index + 1];
    if (typeof value !== 'string' || value.startsWith('--')) throw new Error(`missing value for ${key}`);
    if (args[key]) throw new Error(`duplicate argument: ${key}`);
    args[key] = value;
  }
  const mode = String(args['--mode'] || '').toLowerCase();
  if (!['prepare', 'verify'].includes(mode)) throw new Error('--mode must be prepare or verify');
  for (const key of ['--p44', '--authority-registry', '--expected-authority-registry-sha256']) {
    if (!args[key]) throw new Error(`${key} is required`);
  }
  if (mode === 'prepare' && !args['--decision']) throw new Error('--decision is required in prepare mode');
  if (mode === 'verify' && !args['--attestation']) throw new Error('--attestation is required in verify mode');
  return { mode, ...args };
}

function readRegularJson(filePath, label) {
  const resolved = path.resolve(filePath);
  const stat = fs.lstatSync(resolved);
  if (stat.isSymbolicLink()) throw new Error(`${label} must not be a symlink`);
  if (!stat.isFile()) throw new Error(`${label} must be a regular file`);
  if (stat.size > MAX_JSON_BYTES) throw new Error(`${label} exceeds ${MAX_JSON_BYTES} bytes`);
  const raw = fs.readFileSync(resolved, 'utf8');
  return JSON.parse(raw);
}

function writeOutput(filePath, value) {
  const body = `${JSON.stringify(value, null, 2)}\n`;
  if (!filePath) {
    process.stdout.write(body);
    return;
  }
  const resolved = path.resolve(filePath);
  if (fs.existsSync(resolved) && fs.lstatSync(resolved).isSymbolicLink()) throw new Error('output must not be a symlink');
  fs.writeFileSync(resolved, body, { mode: 0o600 });
  try { fs.chmodSync(resolved, 0o600); } catch (_) { /* best effort on non-POSIX filesystems */ }
}

function exitCode(result) {
  if (!result || result.verified !== true) return 2;
  if (result.status === STATUS.READY_FOR_EXTERNAL_INCIDENT_CLOSEOUT_SIGNATURE) return 0;
  if (result.status === STATUS.INCIDENT_CLOSED_REACTIVATION_REQUIRES_NEW_GOVERNANCE_CYCLE) return 0;
  if (result.status === STATUS.INCIDENT_REMAINS_OPEN_BY_HUMAN_DECISION) return 0;
  return 2;
}

function run(argv = process.argv.slice(2)) {
  let parsed;
  try {
    parsed = parseArgs(argv);
    const p44 = readRegularJson(parsed['--p44'], 'p44');
    const closeoutAuthorityRegistry = readRegularJson(parsed['--authority-registry'], 'authority registry');
    const common = {
      p44,
      closeoutAuthorityRegistry,
      expectedCloseoutAuthorityRegistryHashSha256: parsed['--expected-authority-registry-sha256'],
    };
    const result = parsed.mode === 'prepare'
      ? prepareHumanIncidentCloseoutAttestation({ ...common, decision: readRegularJson(parsed['--decision'], 'decision') })
      : verifyHumanIncidentCloseoutAttestation({ ...common, attestation: readRegularJson(parsed['--attestation'], 'attestation') });
    writeOutput(parsed['--output'], result);
    return exitCode(result);
  } catch (error) {
    process.stderr.write(`human incident closeout operator failed: ${error.message}\n`);
    return 1;
  }
}

if (require.main === module) process.exitCode = run();

module.exports = { parseArgs, readRegularJson, exitCode, run };
