#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  STATUS,
  createSuccessorFreshIndependentReviewHandoff,
} = require('../src/qualification/successor-fresh-independent-review-handoff');

const MAX_JSON_BYTES = 1024 * 1024;
const VALUE_ARGS = new Set(['--p64', '--reviewer-designation', '--review-request-id', '--requested-at', '--output']);

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (/private[-_]?key|secret[-_]?key/i.test(key)) throw new Error('private or secret signing key argument rejected');
    if (!VALUE_ARGS.has(key)) throw new Error(`unknown argument: ${key}`);
    if (out[key] !== undefined) throw new Error(`duplicate argument: ${key}`);
    const value = argv[++i];
    if (!value || value.startsWith('--')) throw new Error(`missing value for ${key}`);
    out[key] = value;
  }
  return out;
}
function requiredArg(args, name) {
  const value = args[name];
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`required argument missing: ${name}`);
  return value;
}
function readBoundedRegularJson(filePath, label) {
  const resolved = path.resolve(filePath);
  const stat = fs.lstatSync(resolved);
  if (stat.isSymbolicLink()) throw new Error(`${label} must not be a symlink`);
  if (!stat.isFile()) throw new Error(`${label} must be a regular file`);
  if (stat.size > MAX_JSON_BYTES) throw new Error(`${label} exceeds maximum size`);
  let value;
  try { value = JSON.parse(fs.readFileSync(resolved, 'utf8')); } catch (error) { throw new Error(`${label} invalid JSON: ${error.message}`); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must contain a JSON object`);
  return value;
}
function writePrivateJson(filePath, value) {
  const resolved = path.resolve(filePath);
  const parent = path.dirname(resolved);
  if (!fs.existsSync(parent)) fs.mkdirSync(parent, { recursive: true });
  const parentStat = fs.lstatSync(parent);
  if (!parentStat.isDirectory() || parentStat.isSymbolicLink()) throw new Error('output parent must be a real directory');
  if (fs.existsSync(resolved) && fs.lstatSync(resolved).isSymbolicLink()) throw new Error('output must not be a symlink');
  fs.writeFileSync(resolved, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  try { fs.chmodSync(resolved, 0o600); } catch (_) { /* platform may not support chmod */ }
}
function run(argv = process.argv.slice(2)) {
  try {
    const args = parseArgs(argv);
    const result = createSuccessorFreshIndependentReviewHandoff({
      p64: readBoundedRegularJson(requiredArg(args, '--p64'), 'P64 result'),
      reviewerDesignation: readBoundedRegularJson(requiredArg(args, '--reviewer-designation'), 'reviewer designation'),
      reviewRequestId: requiredArg(args, '--review-request-id'),
      requestedAt: requiredArg(args, '--requested-at'),
    });
    if (args['--output']) writePrivateJson(args['--output'], result);
    else process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return result.status === STATUS.SUCCESSOR_FRESH_REVIEW_PACKET_READY_NOT_APPROVED ? 0 : 1;
  } catch (error) {
    process.stderr.write(`P65 configuration error: ${error.message}\n`);
    return 1;
  }
}
if (require.main === module) process.exitCode = run();
module.exports = { MAX_JSON_BYTES, parseArgs, readBoundedRegularJson, run };
