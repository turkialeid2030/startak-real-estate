#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  createIndependentReviewSigningPayload,
  stableStringify,
} = require('../src/qualification/canonical-rebaseline-review-attestation');

function parse(argv) {
  const allowed = new Set(['--packet', '--attestation', '--output']);
  const out = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!allowed.has(key) || typeof value !== 'string' || value.startsWith('--')) throw new Error(`INVALID_ARGUMENT:${key || '<missing>'}`);
    out[key] = value;
  }
  if (!out['--packet']) throw new Error('MISSING_ARGUMENT:--packet');
  if (!out['--attestation']) throw new Error('MISSING_ARGUMENT:--attestation');
  return out;
}

function readJson(p) {
  const value = JSON.parse(fs.readFileSync(path.resolve(p), 'utf8'));
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('JSON_OBJECT_REQUIRED');
  return value;
}

try {
  const args = parse(process.argv.slice(2));
  const packet = readJson(args['--packet']);
  const attestation = readJson(args['--attestation']);
  if (Object.prototype.hasOwnProperty.call(attestation, 'privateKey') || Object.prototype.hasOwnProperty.call(attestation, 'privateKeyPem')) {
    throw new Error('PRIVATE_KEY_MUST_REMAIN_OUTSIDE_REPOSITORY_TOOLING');
  }
  const payload = createIndependentReviewSigningPayload({ packet, attestation });
  const signingBytesUtf8 = stableStringify(payload);
  const output = `${JSON.stringify({ payload, signingBytesUtf8 }, null, 2)}\n`;
  if (args['--output']) fs.writeFileSync(path.resolve(args['--output']), output, { encoding: 'utf8', mode: 0o600 });
  else process.stdout.write(output);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
