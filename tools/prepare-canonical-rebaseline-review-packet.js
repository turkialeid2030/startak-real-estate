#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  createCanonicalRebaselineIndependentReviewPacket,
} = require('../src/qualification/canonical-rebaseline-independent-review');

function usage() {
  console.error('Usage: node tools/prepare-canonical-rebaseline-review-packet.js --proposal <proposal.json> --owner-decision <owner.json> --request-id <id> --requested-at <iso> [--output <packet.json>]');
}

function parseArgs(argv) {
  const allowed = new Set(['--proposal', '--owner-decision', '--request-id', '--requested-at', '--output']);
  const out = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!allowed.has(key) || typeof value !== 'string' || value.startsWith('--')) throw new Error(`INVALID_ARGUMENT:${key || '<missing>'}`);
    out[key] = value;
  }
  for (const key of ['--proposal', '--owner-decision', '--request-id', '--requested-at']) {
    if (!out[key]) throw new Error(`MISSING_ARGUMENT:${key}`);
  }
  return out;
}

function readJson(filePath, label) {
  const absolute = path.resolve(filePath);
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(absolute, 'utf8'));
  } catch (error) {
    throw new Error(`${label}_READ_FAILED`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error(`${label}_MUST_BE_OBJECT`);
  return parsed;
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    usage();
    console.error(error.message);
    process.exit(2);
  }

  let result;
  try {
    result = createCanonicalRebaselineIndependentReviewPacket({
      proposal: readJson(args['--proposal'], 'PROPOSAL'),
      ownerDecision: readJson(args['--owner-decision'], 'OWNER_DECISION'),
      reviewRequestId: args['--request-id'],
      requestedAt: args['--requested-at'],
    });
  } catch (error) {
    console.error('REVIEW_PACKET_PREPARATION_FAILED');
    process.exit(1);
  }

  const serialized = `${JSON.stringify(result, null, 2)}\n`;
  if (args['--output']) {
    const outputPath = path.resolve(args['--output']);
    fs.writeFileSync(outputPath, serialized, { encoding: 'utf8', mode: 0o600 });
  } else {
    process.stdout.write(serialized);
  }

  if (result.status !== 'READY_FOR_INDEPENDENT_REVIEW') process.exitCode = 1;
}

main();
