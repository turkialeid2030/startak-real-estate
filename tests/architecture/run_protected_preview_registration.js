'use strict';
// Fail-closed, dependency-aware CI registration guard. No Cloudflare credentials.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '../..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
let checks = 0;
const verify = (ok, label) => { assert.ok(ok, label); checks++; };
const testPath = 'tests/architecture/run_protected_preview_access.js';
const workflowPath = '.github/workflows/authenticated-preview-delivery-manual.yml';
const auditToolPath = 'tools/verify-protected-preview.mjs';
const dependencyPath = 'tools/verify-deployed-assets.mjs';

const canonical = read('tools/release-verify.js');
verify(/runPrefixDirs\s*=\s*\[[^\]]*['"]architecture['"]/.test(canonical),
  'canonical release verifier must discover tests/architecture');
verify(/f\.startsWith\(['"]run_['"]\)/.test(canonical),
  'canonical release verifier must discover run_ tests');
verify(path.basename(testPath).startsWith('run_') && testPath.endsWith('.js'),
  'protected preview test must follow canonical discovery naming');
verify(fs.existsSync(path.join(ROOT,testPath)),
  'protected preview test must be present in canonical discovery folder');
verify(fs.existsSync(path.join(ROOT,dependencyPath)),
  'asset verification dependency must be present');
verify(fs.existsSync(path.join(ROOT,auditToolPath)),
  'protected preview verifier must be present');
const protectedTool = read(auditToolPath);
verify(protectedTool.includes("from './verify-deployed-assets.mjs'"),
  'protected verifier must call the canonical asset verifier');
const workflow = read(workflowPath);
verify(workflow.includes('pull_request:') && workflow.includes('paths:'),
  'unprivileged PR workflow must be configured with dependency paths');
for(const dep of [testPath,workflowPath,auditToolPath,dependencyPath,
  'tests/architecture/run_protected_preview_registration.js']){
  verify(workflow.includes("'"+dep+"'"), 'PR workflow trigger must cover '+dep);
}
verify(workflow.includes('  preview-audit-selftest:') &&
  workflow.includes("if: github.event_name == 'pull_request'"),
  'selftest must run as an unprivileged PR job');
verify(workflow.includes('run: node tests/architecture/run_protected_preview_access.js'),
  'selftest must execute the real 43-check test');
const idx = workflow.indexOf('  verify-approved-preview:');
verify(idx>0, 'privileged job must exist');
const selftest = workflow.slice(0,idx);
verify(!selftest.includes('secrets.STARTAK_CF_ACCESS_') &&
  !selftest.includes('environment: startak-preview-audit'),
  'PR test must not access protected secrets or environment');
const protectedJob = workflow.slice(idx);
verify(protectedJob.includes("github.event_name == 'workflow_dispatch'") &&
  protectedJob.includes("github.ref == 'refs/heads/main'"),
  'privileged job must be dispatched from trusted main only');
verify(protectedJob.includes('environment: startak-preview-audit') &&
  protectedJob.includes('ref: main'), 'privileged job must use protected main');
console.log('STARTAK_PROTECTED_PREVIEW_DISCOVERY=PASS checks='+checks+
  ' releaseAutoDiscovery=true completePathTriggers=true noSecretsInPR=true');
