#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const MAX_JSON_BYTES = 1024 * 1024;
const DESIGNATION_STATUS = 'READY_FOR_GITHUB_ENVIRONMENT_CONFIGURATION';
const READY_STATUS = 'STRUCTURALLY_READY_FOR_327_ADMIN_EVIDENCE_REVIEW';

function usage() {
  return [
    'Usage:',
    '  node tools/production-required-reviewer-evidence-intake.js \\',
    '    --designation-candidate <normalized-designation.json> \\',
    '    --configuration-evidence <configuration-evidence.json> \\',
    '    [--out <qualified-admin-evidence-record.json>]',
    '',
    'Safety:',
    '  This tool checks consistency of supplied non-secret administrator evidence metadata only.',
    '  It cannot read or authenticate GitHub Environment administration, create a Required Reviewer, expose secrets, close #327, merge, deploy, or grant authority.',
  ].join('\n');
}

function parseArgs(argv) {
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) return { help: true };
  const map = {
    '--designation-candidate': 'designationCandidate',
    '--configuration-evidence': 'configurationEvidence',
    '--out': 'out',
  };
  const args = { designationCandidate: null, configurationEvidence: null, out: null };
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
  if (!args.designationCandidate) throw new Error('--designation-candidate is required');
  if (!args.configurationEvidence) throw new Error('--configuration-evidence is required');
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

function prepareAdminEvidenceRecord({ designationCandidate, configurationEvidence } = {}) {
  if (!designationCandidate || typeof designationCandidate !== 'object' || Array.isArray(designationCandidate)) throw new Error('designationCandidate must be an object');
  if (!configurationEvidence || typeof configurationEvidence !== 'object' || Array.isArray(configurationEvidence)) throw new Error('configurationEvidence must be an object');
  if (containsPlaceholder(designationCandidate) || containsPlaceholder(configurationEvidence)) throw new Error('input contains unresolved template placeholders');
  if (configurationEvidence.templateOnly === true) throw new Error('templateOnly configuration evidence cannot be qualified');
  if (designationCandidate.status !== DESIGNATION_STATUS) throw new Error(`designationCandidate.status must be ${DESIGNATION_STATUS}`);

  const environmentName = nonEmpty(configurationEvidence.environmentName, 'configurationEvidence.environmentName');
  if (environmentName !== 'production' || environmentName !== designationCandidate.environmentName) throw new Error('PRODUCTION_ENVIRONMENT_NAME_MISMATCH');

  const reviewerLogin = nonEmpty(configurationEvidence.configuredReviewerGitHubLogin, 'configuredReviewerGitHubLogin');
  const reviewerSubjectRef = nonEmpty(configurationEvidence.configuredReviewerSubjectRef, 'configuredReviewerSubjectRef');
  if (reviewerLogin.toLowerCase() !== String(designationCandidate.reviewerGitHubLogin || '').toLowerCase()) throw new Error('CONFIGURED_REVIEWER_LOGIN_MISMATCH');
  if (reviewerSubjectRef !== designationCandidate.reviewerSubjectRef) throw new Error('CONFIGURED_REVIEWER_SUBJECT_MISMATCH');

  const configurationEvidenceRef = nonEmpty(configurationEvidence.configurationEvidenceRef, 'configurationEvidenceRef');
  const configuredAt = iso(configurationEvidence.configuredAt, 'configuredAt');
  const effectiveFrom = iso(designationCandidate.effectiveFrom, 'designationCandidate.effectiveFrom');
  if (Date.parse(configuredAt) < Date.parse(effectiveFrom)) throw new Error('CONFIGURATION_PRECEDES_DESIGNATION_EFFECTIVE_TIME');

  for (const field of [
    'requiredReviewerEnabled',
    'productionBranchScopeMainOnly',
    'adminBypassDisabled',
    'cloudflareTokenEnvironmentScoped',
    'repositoryLevelCloudflareTokenRemoved',
  ]) {
    if (configurationEvidence[field] !== true) throw new Error(`${field} must be true`);
  }

  return Object.freeze({
    schemaVersion: 1,
    status: READY_STATUS,
    environmentName: 'production',
    reviewerGitHubLogin: reviewerLogin,
    reviewerSubjectRef,
    designationEvidenceRef: designationCandidate.designationEvidenceRef,
    configurationEvidenceRef,
    designatedEffectiveFrom: effectiveFrom,
    configuredAt,
    requiredReviewerEnabled: true,
    productionBranchScopeMainOnly: true,
    adminBypassDisabled: true,
    cloudflareTokenEnvironmentScoped: true,
    repositoryLevelCloudflareTokenRemoved: true,
    githubAdministratorStateAuthenticatedByTool: false,
    screenshotOrUiEvidenceAuthenticatedByTool: false,
    issue327ClosureAuthorized: false,
    deploymentAuthorized: false,
    mergeAuthorized: false,
    transactionAuthorized: false,
    commercialGoLiveAuthorized: false,
    authorityEffect: 'NONE',
    semantics: 'This record proves only internal consistency of supplied designation and administrator-evidence metadata. A human/administrator must verify the actual GitHub Environment evidence before #327 can close.',
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
    const result = prepareAdminEvidenceRecord({
      designationCandidate: readBoundedRegularJson(args.designationCandidate),
      configurationEvidence: readBoundedRegularJson(args.configurationEvidence),
    });
    if (args.out) writePrivateJson(args.out, result);
    else process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (result.status !== READY_STATUS) process.exit(2);
  } catch (error) {
    console.error(`PRODUCTION_REQUIRED_REVIEWER_EVIDENCE_INTAKE_ERROR: ${error.message}`);
    process.exit(65);
  }
}

if (require.main === module) main();

module.exports = {
  MAX_JSON_BYTES,
  DESIGNATION_STATUS,
  READY_STATUS,
  usage,
  parseArgs,
  readBoundedRegularJson,
  writePrivateJson,
  containsPlaceholder,
  prepareAdminEvidenceRecord,
  main,
};
