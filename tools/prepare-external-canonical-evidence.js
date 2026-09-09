#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  OPERATOR_STATUS,
  prepareExternalCanonicalEvidence,
} = require('../src/qualification/external-canonical-evidence-operator');

const MAX_CONTEXT_BYTES = 64 * 1024;
const ALLOWED_CONTEXT_KEYS = new Set([
  'evidenceId',
  'upstreamCloseoutPacketHashSha256',
  'releaseCandidateId',
  'sourceCommitSha',
  'artifactSha256',
  'environmentRef',
  'environmentConfigSha256',
  'verifierId',
  'sourceRef',
  'evidenceArtifactSha256',
  'verifiedAt',
  'expiresAt',
  'scopeRef',
]);

function usage() {
  return 'Usage: node tools/prepare-external-canonical-evidence.js --source <canonical-file> --context <context.json> [--output <result.json>]';
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!['--source', '--context', '--output'].includes(key)) throw new TypeError(`UNKNOWN_ARGUMENT:${key}`);
    const value = argv[i + 1];
    if (typeof value !== 'string' || value.startsWith('--')) throw new TypeError(`MISSING_ARGUMENT_VALUE:${key}`);
    out[key.slice(2)] = value;
    i += 1;
  }
  if (!out.source || !out.context) throw new TypeError('SOURCE_AND_CONTEXT_REQUIRED');
  return out;
}

function readContext(filePath) {
  const stat = fs.statSync(filePath);
  if (!stat.isFile()) throw new TypeError('CONTEXT_PATH_MUST_BE_FILE');
  if (stat.size > MAX_CONTEXT_BYTES) throw new TypeError('CONTEXT_FILE_TOO_LARGE');
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new TypeError('CONTEXT_MUST_BE_OBJECT');
  for (const key of Object.keys(parsed)) {
    if (!ALLOWED_CONTEXT_KEYS.has(key)) throw new TypeError(`CONTEXT_FIELD_NOT_ALLOWED:${key}`);
  }
  return parsed;
}

function writeResult(result, outputPath) {
  const text = `${JSON.stringify(result, null, 2)}\n`;
  if (!outputPath) {
    process.stdout.write(text);
    return;
  }
  const resolved = path.resolve(outputPath);
  fs.writeFileSync(resolved, text, { encoding: 'utf8', mode: 0o600 });
  process.stdout.write(`${JSON.stringify({ status: result.status, outputWritten: true })}\n`);
}

function main(argv = process.argv.slice(2)) {
  try {
    const args = parseArgs(argv);
    const context = readContext(args.context);
    const result = prepareExternalCanonicalEvidence({ sourcePath: args.source, context });
    writeResult(result, args.output);
    return result.status === OPERATOR_STATUS.READY_FOR_EXTERNAL_READINESS_VERIFIER_SIGNATURE ? 0 : 2;
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ status: 'ERROR', errorCode: String(error?.message || 'UNKNOWN_ERROR') })}\n`);
    process.stderr.write(`${usage()}\n`);
    return 1;
  }
}

if (require.main === module) process.exit(main());

module.exports = {
  MAX_CONTEXT_BYTES,
  ALLOWED_CONTEXT_KEYS,
  parseArgs,
  readContext,
  main,
};
