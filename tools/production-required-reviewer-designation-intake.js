#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const MAX_JSON_BYTES = 1024 * 1024;
const READY_STATUS = 'READY_FOR_GITHUB_ENVIRONMENT_CONFIGURATION';

function usage() {
  return [
    'Usage:',
    '  node tools/production-required-reviewer-designation-intake.js \\',
    '    --designation <production-required-reviewer-designation.json> \\',
    '    [--out <normalized-designation.json>]',
    '',
    'Safety:',
    '  This tool validates designation metadata only.',
    '  It does not configure GitHub Environment protection, prove that a reviewer account exists, create approval, expose secrets, deploy, merge, or grant authority.',
  ].join('\n');
}

function parseArgs(argv) {
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) return { help: true };
  const map = { '--designation': 'designation', '--out': 'out' };
  const args = { designation: null, out: null };
  const seen = new Set();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const key = map[token];
    if (!key) throw new Error(`unknown argument: ${token}`);
    if (seen.has(key)) throw new Error(`duplicate argument: ${token}`);
    seen.add(key);
    args[key] = argv[++index] || null;
    if (!args[key]) throw new Error(`missing value for ${token}`);
  }
  if (!args.designation) throw new Error('--designation is required');
  return args;
}

function readBoundedRegularJson(filePath) {
  const resolved = path.resolve(filePath);
  const stat = fs.lstatSync(resolved);
  if (stat.isSymbolicLink()) throw new Error(`symlink input is not allowed: ${resolved}`);
  if (!stat.isFile()) throw new Error(`input must be a regular file: ${resolved}`);
  if (stat.size > MAX_JSON_BYTES) throw new Error(`input exceeds ${MAX_JSON_BYTES} bytes: ${resolved}`);
  return JSON.parse(fs.readFileSync(resolved, 'utf8'));
}

function writePrivateJson(filePath, value) {
  const resolved = path.resolve(filePath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  if (fs.existsSync(resolved) && fs.lstatSync(resolved).isSymbolicLink()) throw new Error(`symlink output is not allowed: ${resolved}`);
  fs.writeFileSync(resolved, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  fs.chmodSync(resolved, 0o600);
}

function containsPlaceholder(value) {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return /^<[^>]+>$/.test(trimmed) || /^(REPLACE_|PLACEHOLDER_|TEMPLATE_)/.test(trimmed);
  }
  if (Array.isArray(value)) return value.some(containsPlaceholder);
  if (value && typeof value === 'object') return Object.values(value).some(containsPlaceholder);
  return false;
}

function nonEmpty(value, field) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} must be a non-empty string`);
  return value.trim();
}

function iso(value, field) {
  const text = nonEmpty(value, field);
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) throw new Error(`${field} must be a valid date/time`);
  return date.toISOString();
}

function validGitHubLogin(login) {
  return /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(login);
}

function prepareDesignationCandidate({ designation } = {}) {
  if (!designation || typeof designation !== 'object' || Array.isArray(designation)) throw new Error('designation must be an object');
  if (containsPlaceholder(designation)) throw new Error('designation contains unresolved template placeholders');
  if (designation.templateOnly === true) throw new Error('templateOnly designation cannot be qualified');

  const environmentName = nonEmpty(designation.environmentName, 'environmentName');
  if (environmentName !== 'production') throw new Error('environmentName must be exactly production');

  const ownerSubjectRef = nonEmpty(designation.ownerSubjectRef, 'ownerSubjectRef');
  const reviewerGitHubLogin = nonEmpty(designation.reviewerGitHubLogin, 'reviewerGitHubLogin');
  if (!validGitHubLogin(reviewerGitHubLogin)) throw new Error('reviewerGitHubLogin is not a valid GitHub login shape');
  const reviewerSubjectRef = nonEmpty(designation.reviewerSubjectRef, 'reviewerSubjectRef');
  const designationEvidenceRef = nonEmpty(designation.designationEvidenceRef, 'designationEvidenceRef');
  const effectiveFrom = iso(designation.effectiveFrom, 'effectiveFrom');

  if (designation.independentFromOwner !== true) throw new Error('independentFromOwner must be true');
  if (designation.requiredReviewerProtectionIntended !== true) throw new Error('requiredReviewerProtectionIntended must be true');
  if (reviewerSubjectRef === ownerSubjectRef) throw new Error('REQUIRED_REVIEWER_MUST_BE_DISTINCT_FROM_OWNER');

  const ownerLogin = ownerSubjectRef.startsWith('github:') ? ownerSubjectRef.slice('github:'.length) : null;
  if (ownerLogin && reviewerGitHubLogin.toLowerCase() === ownerLogin.toLowerCase()) {
    throw new Error('REQUIRED_REVIEWER_GITHUB_LOGIN_MUST_BE_DISTINCT_FROM_OWNER');
  }

  return Object.freeze({
    schemaVersion: 1,
    status: READY_STATUS,
    environmentName,
    ownerSubjectRef,
    reviewerGitHubLogin,
    reviewerSubjectRef,
    designationEvidenceRef,
    effectiveFrom,
    independentFromOwner: true,
    requiredReviewerProtectionIntended: true,
    githubEnvironmentConfigured: false,
    githubAccountExistenceVerified: false,
    administratorEvidencePresent: false,
    approvalCreated: false,
    deploymentAuthorized: false,
    mergeAuthorized: false,
    transactionAuthorized: false,
    commercialGoLiveAuthorized: false,
    authorityEffect: 'NONE',
    semantics: 'This result validates only the proposed Required Reviewer designation metadata. Administrator-side GitHub Environment configuration and non-secret evidence remain mandatory before #327 can close.',
  });
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    console.error(usage());
    process.exit(64);
  }
  if (args.help) {
    console.log(usage());
    return;
  }

  try {
    const result = prepareDesignationCandidate({ designation: readBoundedRegularJson(args.designation) });
    if (args.out) writePrivateJson(args.out, result);
    else process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (result.status !== READY_STATUS) process.exit(2);
  } catch (error) {
    console.error(`PRODUCTION_REQUIRED_REVIEWER_DESIGNATION_INTAKE_ERROR: ${error.message}`);
    process.exit(65);
  }
}

if (require.main === module) main();

module.exports = {
  MAX_JSON_BYTES,
  READY_STATUS,
  usage,
  parseArgs,
  readBoundedRegularJson,
  writePrivateJson,
  containsPlaceholder,
  validGitHubLogin,
  prepareDesignationCandidate,
  main,
};
