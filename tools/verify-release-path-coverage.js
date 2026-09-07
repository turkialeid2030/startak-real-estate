#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'governance', 'release-path-manifest.json'), 'utf8'));

function normalize(value) {
  return String(value || '').trim().replace(/\\/g, '/').replace(/^\.\//, '');
}

function parseInjectedChangedFiles() {
  const raw = process.env.RELEASE_CHANGED_FILES;
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('[')) {
    const parsed = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) throw new Error('RELEASE_CHANGED_FILES JSON must be an array');
    return parsed.map(normalize).filter(Boolean);
  }
  return trimmed.split(/[\n,]/).map(normalize).filter(Boolean);
}

function gitChangedFiles() {
  const injected = parseInjectedChangedFiles();
  if (injected) return { files: injected, source: 'RELEASE_CHANGED_FILES' };

  const baseRef = normalize(process.env.GITHUB_BASE_REF);
  const eventName = normalize(process.env.GITHUB_EVENT_NAME);
  const candidates = [];
  if (baseRef) candidates.push(['diff', '--name-only', `origin/${baseRef}...HEAD`]);
  if (eventName === 'push') candidates.push(['diff', '--name-only', 'HEAD^..HEAD']);
  candidates.push(['diff', '--name-only', 'HEAD^..HEAD']);

  for (const args of candidates) {
    try {
      const out = execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      const files = out.split(/\r?\n/).map(normalize).filter(Boolean);
      return { files, source: `git ${args.join(' ')}` };
    } catch (_) {
      // Try the next deterministic candidate. CI remains fail-closed below.
    }
  }

  if (String(process.env.CI || '').toLowerCase() === 'true') {
    throw new Error('Unable to determine changed files in CI; release path coverage fails closed');
  }
  return { files: [], source: 'NO_DIFF_AVAILABLE_LOCAL' };
}

function deploymentRuleFor(file) {
  if (manifest.deploymentExactPaths && Object.prototype.hasOwnProperty.call(manifest.deploymentExactPaths, file)) {
    return { kind: 'deployment-exact', validation: manifest.deploymentExactPaths[file] };
  }
  for (const rule of manifest.deploymentRules || []) {
    if (file.startsWith(rule.prefix)) return { kind: 'deployment-prefix', validation: rule.validation, prefix: rule.prefix };
  }
  return null;
}

function isKnownNonDeployment(file) {
  if ((manifest.nonDeploymentExactPaths || []).includes(file)) return true;
  if ((manifest.nonDeploymentPrefixes || []).some((prefix) => file.startsWith(prefix))) return true;
  if (!file.includes('/')) {
    const ext = path.extname(file).toLowerCase();
    if ((manifest.rootDocumentationExtensions || []).includes(ext)) return true;
  }
  return false;
}

function validateManifest() {
  if (manifest.schemaVersion !== 1) throw new Error('release path manifest schemaVersion must be 1');
  if (manifest.transactionAuthorized !== false) throw new Error('release path manifest must preserve transactionAuthorized=false');
  const required = new Set(manifest.requiredReleaseStages || []);
  for (const stage of ['TEST_DISCOVERY_AND_REGRESSION', 'PRODUCTION_BUILD', 'VERIFY_PACKAGE', 'SECRETS_SCAN', 'RELEASE_PATH_COVERAGE']) {
    if (!required.has(stage)) throw new Error(`required release stage missing from manifest: ${stage}`);
  }
  for (const rule of manifest.deploymentRules || []) {
    if (!rule.prefix || !Array.isArray(rule.validation) || rule.validation.length === 0) {
      throw new Error(`invalid deployment rule: ${JSON.stringify(rule)}`);
    }
  }
}

validateManifest();
const { files, source } = gitChangedFiles();
const unknown = [];
const deployment = [];
const nonDeployment = [];

for (const file of files) {
  const rule = deploymentRuleFor(file);
  if (rule) {
    if (!Array.isArray(rule.validation) || rule.validation.length === 0) {
      throw new Error(`deployment path lacks release validation mapping: ${file}`);
    }
    deployment.push({ file, validation: rule.validation });
    continue;
  }
  if (isKnownNonDeployment(file)) {
    nonDeployment.push(file);
    continue;
  }
  unknown.push(file);
}

console.log(`RELEASE_PATH_DIFF_SOURCE=${source}`);
console.log(`RELEASE_PATH_CHANGED_FILES=${files.length}`);
console.log(`RELEASE_PATH_DEPLOYMENT_FILES=${deployment.length}`);
console.log(`RELEASE_PATH_NON_DEPLOYMENT_FILES=${nonDeployment.length}`);
for (const entry of deployment) {
  console.log(`RELEASE_PATH_VALIDATED=${entry.file} stages=${entry.validation.join('|')}`);
}

if (unknown.length > 0) {
  for (const file of unknown) console.error(`RELEASE_PATH_UNKNOWN=${file}`);
  console.error(`RELEASE_PATH_COVERAGE=FAIL unknown=${unknown.length}`);
  process.exit(1);
}

console.log('RELEASE_PATH_COVERAGE=PASS');
console.log('TRANSACTION_AUTHORIZED=false');
