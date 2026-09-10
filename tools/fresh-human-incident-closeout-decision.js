'use strict';

const fs = require('fs');
const path = require('path');
const {
  prepareFreshIncidentCloseoutSigningPackage,
  verifyFreshHumanIncidentCloseoutDecision,
} = require('../src/qualification/fresh-human-incident-closeout-decision');

const MAX_JSON_BYTES = 2 * 1024 * 1024;
const ALLOWED = new Set(['--mode', '--p62', '--decision', '--authority-registry', '--expected-authority-registry-hash', '--output']);
const PRIVATE_RE = /private[-_]?key|secret[-_]?key/i;

function parseArgs(argv) {
  const args = {};
  const seen = new Set();
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (PRIVATE_RE.test(key)) throw new TypeError('private or secret signing key argument rejected');
    if (!ALLOWED.has(key)) throw new TypeError(`unknown argument: ${key}`);
    if (seen.has(key)) throw new TypeError(`duplicate argument: ${key}`);
    seen.add(key);
    const value = argv[i + 1];
    if (value == null || value.startsWith('--')) throw new TypeError(`missing value for ${key}`);
    if (PRIVATE_RE.test(value) && key !== '--output') throw new TypeError('private or secret signing key argument rejected');
    args[key.slice(2)] = value;
    i += 1;
  }
  const mode = (args.mode || 'verify').toLowerCase();
  if (!['prepare', 'verify'].includes(mode)) throw new TypeError('--mode must be prepare or verify');
  if (!args.p62) throw new TypeError('--p62 is required');
  if (!args.decision) throw new TypeError('--decision is required');
  if (mode === 'verify' && !args['authority-registry']) throw new TypeError('--authority-registry is required for verify');
  if (mode === 'verify' && !args['expected-authority-registry-hash']) throw new TypeError('--expected-authority-registry-hash is required for verify');
  return { mode, p62Path: args.p62, decisionPath: args.decision, authorityRegistryPath: args['authority-registry'] || null, expectedAuthorityRegistryHash: args['expected-authority-registry-hash'] || null, outputPath: args.output || null };
}

function safeReadJson(filePath, label) {
  const resolved = path.resolve(filePath);
  const stat = fs.lstatSync(resolved);
  if (stat.isSymbolicLink()) throw new TypeError(`${label} must not be a symlink`);
  if (!stat.isFile()) throw new TypeError(`${label} must be a regular file`);
  if (stat.size > MAX_JSON_BYTES) throw new TypeError(`${label} exceeds ${MAX_JSON_BYTES} bytes`);
  let parsed;
  try { parsed = JSON.parse(fs.readFileSync(resolved, 'utf8')); } catch (error) { throw new TypeError(`${label} invalid JSON: ${error.message}`); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new TypeError(`${label} must contain a JSON object`);
  return parsed;
}

function safeWriteJson(filePath, value) {
  const resolved = path.resolve(filePath);
  const parent = path.dirname(resolved);
  fs.mkdirSync(parent, { recursive: true });
  if (fs.existsSync(resolved) && fs.lstatSync(resolved).isSymbolicLink()) throw new TypeError('output must not be a symlink');
  fs.writeFileSync(resolved, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  fs.chmodSync(resolved, 0o600);
}

function run(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const p62 = safeReadJson(args.p62Path, 'p62');
  const decision = safeReadJson(args.decisionPath, 'decision');
  let result;
  if (args.mode === 'prepare') {
    result = prepareFreshIncidentCloseoutSigningPackage({ p62, decision });
  } else {
    const incidentAuthorityRegistry = safeReadJson(args.authorityRegistryPath, 'authority registry');
    result = verifyFreshHumanIncidentCloseoutDecision({
      p62,
      incidentAuthorityRegistry,
      expectedIncidentAuthorityRegistryHashSha256: args.expectedAuthorityRegistryHash,
      signedDecision: decision,
    });
  }
  if (args.outputPath) safeWriteJson(args.outputPath, result);
  else process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return result;
}

if (require.main === module) {
  try {
    const result = run();
    if (result.verified !== true) process.exitCode = 1;
  } catch (error) {
    process.stderr.write(`fresh-human-incident-closeout-decision: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { MAX_JSON_BYTES, parseArgs, safeReadJson, safeWriteJson, run };
