#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  createExternalProductionReadinessEvidenceAcquisitionBundle,
} = require('../src/qualification/external-production-readiness-evidence-package');

const MAX_JSON_BYTES = 2 * 1024 * 1024;
const FORBIDDEN_KEY_RE = /^(privateKey|privateSigningKey|secret|secretKey|signingKey|password|clientSecret|apiKey)$/i;

function fail(message) {
  console.error(`EXTERNAL_PRODUCTION_READINESS_EVIDENCE_ACQUISITION_ERROR=${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) fail(`unexpected argument: ${token}`);
    const key = token.slice(2);
    if (!['input', 'output'].includes(key)) fail(`unsupported option: --${key}`);
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) fail(`missing value for --${key}`);
    args[key] = value;
    i += 1;
  }
  if (!args.input) fail('--input is required');
  return args;
}

function assertRegularInput(filePath) {
  let stat;
  try {
    stat = fs.lstatSync(filePath);
  } catch (error) {
    fail(`cannot stat input: ${error.message}`);
  }
  if (stat.isSymbolicLink()) fail('input symlinks are not allowed');
  if (!stat.isFile()) fail('input must be a regular file');
  if (stat.size > MAX_JSON_BYTES) fail(`input exceeds ${MAX_JSON_BYTES} bytes`);
}

function assertNoForbiddenMaterial(value, at = '$') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoForbiddenMaterial(item, `${at}[${index}]`));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEY_RE.test(key)) fail(`private/secret signing material is prohibited at ${at}.${key}`);
    assertNoForbiddenMaterial(child, `${at}.${key}`);
  }
}

function readJson(filePath) {
  assertRegularInput(filePath);
  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    fail(`cannot read input: ${error.message}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    fail(`invalid JSON: ${error.message}`);
  }
  assertNoForbiddenMaterial(parsed);
  return parsed;
}

function writeSecureJson(filePath, value) {
  const resolved = path.resolve(filePath);
  const parent = path.dirname(resolved);
  if (!fs.existsSync(parent)) fail(`output directory does not exist: ${parent}`);
  if (fs.existsSync(resolved)) {
    const stat = fs.lstatSync(resolved);
    if (stat.isSymbolicLink()) fail('output symlinks are not allowed');
    if (!stat.isFile()) fail('output path must be a regular file');
  }
  const body = `${JSON.stringify(value, null, 2)}\n`;
  fs.writeFileSync(resolved, body, { encoding: 'utf8', mode: 0o600 });
  try { fs.chmodSync(resolved, 0o600); } catch (error) { fail(`cannot enforce output mode 0600: ${error.message}`); }
}

(function main() {
  const args = parseArgs(process.argv);
  const input = readJson(path.resolve(args.input));
  let bundle;
  try {
    bundle = createExternalProductionReadinessEvidenceAcquisitionBundle(input);
  } catch (error) {
    fail(error && error.message ? error.message : String(error));
  }

  if (args.output) writeSecureJson(args.output, bundle);
  else process.stdout.write(`${JSON.stringify(bundle, null, 2)}\n`);

  console.error(`EXTERNAL_PRODUCTION_READINESS_EVIDENCE_ACQUISITION_STATUS=${bundle.status}`);
  console.error(`EXTERNAL_PRODUCTION_READINESS_EVIDENCE_PREPARED=${bundle.preparedEvidenceTypes.length}`);
  console.error(`EXTERNAL_PRODUCTION_READINESS_EVIDENCE_MISSING=${bundle.missingEvidenceTypes.length}`);
  console.error('E2I_ACCEPTANCE_PENDING=true');
  console.error('RELEASE_AUTHORIZED=false MERGE_AUTHORIZED=false DEPLOYMENT_AUTHORIZED=false GO_LIVE_AUTHORIZED=false TRANSACTION_AUTHORIZED=false');
})();
