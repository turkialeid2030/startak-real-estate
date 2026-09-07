'use strict';

const assert = require('assert');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const manifest = require('../../governance/release-path-manifest.json');

const ROOT = path.join(__dirname, '..', '..');
const verifier = path.join(ROOT, 'tools', 'verify-release-path-coverage.js');
const secretScanner = path.join(ROOT, 'tests', 'security', 'run_secrets_scan_ci.mjs');

function runCoverage(files) {
  return spawnSync(process.execPath, [verifier], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, RELEASE_CHANGED_FILES: JSON.stringify(files), CI: 'true' },
  });
}

assert.strictEqual(manifest.schemaVersion, 1);
assert.strictEqual(manifest.transactionAuthorized, false);
assert.ok((manifest.requiredReleaseStages || []).includes('SECRETS_SCAN'));
assert.ok((manifest.requiredReleaseStages || []).includes('RELEASE_PATH_COVERAGE'));

const knownRuntime = runCoverage(['src/app/App.jsx', 'functions/api/riai/ai-assist.js']);
assert.strictEqual(knownRuntime.status, 0, knownRuntime.stderr || knownRuntime.stdout);
assert.match(knownRuntime.stdout, /RELEASE_PATH_COVERAGE=PASS/);
console.log('P1-RELEASE-KNOWN-RUNTIME=PASS');

const knownNonRuntime = runCoverage(['docs/engineering-note.md', 'governance/DEFECT_REGISTER.md']);
assert.strictEqual(knownNonRuntime.status, 0, knownNonRuntime.stderr || knownNonRuntime.stdout);
assert.match(knownNonRuntime.stdout, /RELEASE_PATH_COVERAGE=PASS/);
console.log('P1-RELEASE-KNOWN-NONRUNTIME=PASS');

const unknownDeploymentCandidate = runCoverage(['serverless.yml']);
assert.notStrictEqual(unknownDeploymentCandidate.status, 0, 'unknown top-level deployment-affecting path must fail closed');
assert.match(`${unknownDeploymentCandidate.stdout}\n${unknownDeploymentCandidate.stderr}`, /RELEASE_PATH_UNKNOWN=serverless\.yml/);
assert.match(`${unknownDeploymentCandidate.stdout}\n${unknownDeploymentCandidate.stderr}`, /RELEASE_PATH_COVERAGE=FAIL/);
console.log('P1-RELEASE-UNKNOWN-PATH-FAIL-CLOSED=PASS');

const scannerOutput = execFileSync(process.execPath, [secretScanner], { cwd: ROOT, encoding: 'utf8' });
assert.match(scannerOutput, /SECRETS_SCAN_RESULT=PASS findings=0/);
console.log('P1-SECRETS-SCAN-DIRECT=PASS');

const source = require('fs').readFileSync(path.join(ROOT, '.github', 'CODEOWNERS'), 'utf8');
for (const requiredPath of ['/functions/', '/src/validation/', '/.github/workflows/', '/tests/security/']) {
  assert.ok(source.includes(requiredPath), `CODEOWNERS missing ${requiredPath}`);
}
console.log('P1-CODEOWNERS-GOVERNED-PATHS=PASS');
console.log('TRANSACTION_AUTHORIZED=false');
console.log('WAVE0_P1_RELEASE_GOVERNANCE=PASS');
