#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const WORKFLOWS_DIR = path.join(ROOT, '.github', 'workflows');

function fail(message) {
  throw new Error(message);
}

function readWorkflow(name) {
  const file = path.join(WORKFLOWS_DIR, name);
  if (!fs.existsSync(file)) fail(`missing workflow: ${name}`);
  return fs.readFileSync(file, 'utf8');
}

function hasTopLevelTrigger(text, trigger) {
  const escaped = trigger.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^  ${escaped}:\\s*$`, 'm').test(text);
}

const workflowFiles = fs.readdirSync(WORKFLOWS_DIR)
  .filter((name) => /\.ya?ml$/i.test(name));

const violations = [];
for (const name of workflowFiles) {
  const text = readWorkflow(name);
  const usesProductionCloudflareSecret = /secrets\.CLOUDFLARE_API_TOKEN/.test(text);
  if (!usesProductionCloudflareSecret) continue;

  if (hasTopLevelTrigger(text, 'pull_request')) {
    violations.push(`${name}: production Cloudflare credential is reachable from pull_request`);
  }
  if (hasTopLevelTrigger(text, 'pull_request_target')) {
    violations.push(`${name}: production Cloudflare credential must not be used for PR-time Cloudflare inspection`);
  }
}

if (violations.length > 0) {
  fail(`Cloudflare production-secret trust-boundary violation(s):\n - ${violations.join('\n - ')}`);
}

const runtimeSync = readWorkflow('cloudflare-access-runtime-sync.yml');
if (!hasTopLevelTrigger(runtimeSync, 'workflow_dispatch')) fail('runtime sync must remain manual-dispatch capable');
if (hasTopLevelTrigger(runtimeSync, 'push')) fail('runtime sync must not auto-run on push to main');
if (!/expected_commit_sha:/.test(runtimeSync)) fail('runtime sync must require an exact authorized commit SHA');
if (!/I_AUTHORIZE_STARTAK_PRODUCTION_MUTATION/.test(runtimeSync)) fail('runtime sync must retain explicit production mutation acknowledgement');
if (!/\[\[ "\$GITHUB_REF" == 'refs\/heads\/main' \]\]/.test(runtimeSync)) fail('runtime sync must be restricted to main');
if (!/\$\{GITHUB_SHA,,\}/.test(runtimeSync) && !/GITHUB_SHA/.test(runtimeSync)) fail('runtime sync must bind authorization to the workflow SHA');

const controlPlane = readWorkflow('cloudflare-control-plane-verify.yml');
if (!hasTopLevelTrigger(controlPlane, 'workflow_dispatch')) fail('control-plane verification must remain manual-dispatch capable');
if (hasTopLevelTrigger(controlPlane, 'push')) fail('control-plane verification must not auto-run on main push/bootstrap merge');
if (!/expected_commit_sha:/.test(controlPlane)) fail('control-plane verification must require an exact expected commit SHA');
if (!/refs\/heads\/main/.test(controlPlane)) fail('control-plane verification must be restricted to main');
if (!/GITHUB_SHA/.test(controlPlane)) fail('control-plane verification must bind to the exact workflow SHA');

const activation = readWorkflow('cloudflare-ai-production-activation.yml');
if (hasTopLevelTrigger(activation, 'pull_request') || hasTopLevelTrigger(activation, 'pull_request_target') || hasTopLevelTrigger(activation, 'push')) {
  fail('AI production activation must remain manual-dispatch only');
}
if (!/I_AUTHORIZE_STARTAK_PRODUCTION_MUTATION/.test(activation)) fail('AI production activation must retain explicit mutation acknowledgement');

console.log(`CLOUDFLARE_PRODUCTION_SECRET_BOUNDARY=PASS -- scanned=${workflowFiles.length}`);
