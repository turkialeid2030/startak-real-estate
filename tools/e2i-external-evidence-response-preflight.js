#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { preflightExternalEvidenceResponses } = require('../src/qualification/e2i-external-evidence-response-preflight');

const MAX_BYTES = 2 * 1024 * 1024;

function fail(message) {
  process.stderr.write(`E2I_EXTERNAL_EVIDENCE_RESPONSE_PREFLIGHT_ERROR=${message}\n`);
  process.exit(2);
}

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function readJsonFile(filePath, label) {
  if (!filePath) fail(`${label}_PATH_REQUIRED`);
  const stat = fs.lstatSync(filePath);
  if (stat.isSymbolicLink()) fail(`${label}_SYMLINK_REJECTED`);
  if (!stat.isFile()) fail(`${label}_MUST_BE_REGULAR_FILE`);
  if (stat.size > MAX_BYTES) fail(`${label}_TOO_LARGE`);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function containsForbiddenSecretMaterial(value, trail = 'input') {
  if (!value || typeof value !== 'object') return null;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      const hit = containsForbiddenSecretMaterial(value[i], `${trail}[${i}]`);
      if (hit) return hit;
    }
    return null;
  }
  for (const [key, child] of Object.entries(value)) {
    if (/(^|_)(private.?key|secret|password|token|credential)(_|$)/i.test(key)) return `${trail}.${key}`;
    const hit = containsForbiddenSecretMaterial(child, `${trail}.${key}`);
    if (hit) return hit;
  }
  return null;
}

function writeOutput(outputPath, value) {
  const serialized = `${JSON.stringify(value, null, 2)}\n`;
  if (!outputPath) {
    process.stdout.write(serialized);
    return;
  }
  const parent = path.dirname(outputPath);
  fs.mkdirSync(parent, { recursive: true });
  fs.writeFileSync(outputPath, serialized, { mode: 0o600 });
  fs.chmodSync(outputPath, 0o600);
}

try {
  const policy = readJsonFile(argValue('--policy'), 'POLICY');
  const readinessVerifierRegistry = readJsonFile(argValue('--registry'), 'REGISTRY');
  const expectedReleaseBinding = readJsonFile(argValue('--release-binding'), 'RELEASE_BINDING');
  const readinessEvidence = readJsonFile(argValue('--evidence'), 'EVIDENCE');
  const expectedReadinessVerifierRegistryHashSha256 = argValue('--expected-registry-sha256');
  const intakePreparedAt = argValue('--intake-prepared-at');
  const output = argValue('--output');

  for (const [label, value] of [
    ['REGISTRY', readinessVerifierRegistry],
    ['RELEASE_BINDING', expectedReleaseBinding],
    ['EVIDENCE', readinessEvidence],
  ]) {
    const forbidden = containsForbiddenSecretMaterial(value, label.toLowerCase());
    if (forbidden) fail(`FORBIDDEN_SECRET_MATERIAL:${forbidden}`);
  }

  const result = preflightExternalEvidenceResponses({
    policy,
    readinessVerifierRegistry,
    expectedReadinessVerifierRegistryHashSha256,
    expectedReleaseBinding,
    readinessEvidence,
    intakePreparedAt,
  });
  writeOutput(output, result);
  process.stderr.write(`E2I_EXTERNAL_EVIDENCE_RESPONSE_PREFLIGHT_STATUS=${result.status}\n`);
} catch (error) {
  fail(error && error.message ? error.message : String(error));
}
