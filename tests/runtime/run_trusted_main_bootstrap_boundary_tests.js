'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const workflowsDir = path.join(root, '.github', 'workflows');

function read(name) {
  return fs.readFileSync(path.join(workflowsDir, name), 'utf8');
}

function hasTopLevelTrigger(text, trigger) {
  const escaped = trigger.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^  ${escaped}:\\s*$`, 'm').test(text);
}

function hasProductionEnvironmentBinding(text) {
  return /^    environment:\s*production\s*$/m.test(text);
}

const access = read('cloudflare-access-runtime-sync.yml');
const control = read('cloudflare-control-plane-verify.yml');
const releaseGovernance = read('release-governance-verify.yml');
const trusted = read('trusted-main-production-governance.yml');

for (const name of fs.readdirSync(workflowsDir).filter((x) => /\.ya?ml$/i.test(x))) {
  const text = read(name);
  if (!/secrets\.CLOUDFLARE_API_TOKEN/.test(text)) continue;
  assert.ok(!hasTopLevelTrigger(text, 'pull_request'), `${name} must not expose CLOUDFLARE_API_TOKEN to pull_request`);
  assert.ok(!hasTopLevelTrigger(text, 'pull_request_target'), `${name} must not expose CLOUDFLARE_API_TOKEN to pull_request_target`);
  assert.ok(!hasTopLevelTrigger(text, 'push'), `${name} must not expose CLOUDFLARE_API_TOKEN to automatic push execution`);
  assert.ok(hasProductionEnvironmentBinding(text), `${name} must bind every CLOUDFLARE_API_TOKEN-bearing job to the protected production environment`);
}

assert.ok(hasTopLevelTrigger(access, 'workflow_dispatch'));
assert.ok(!hasTopLevelTrigger(access, 'push'));
assert.match(access, /I_AUTHORIZE_STARTAK_PRODUCTION_MUTATION/);
assert.match(access, /refs\/heads\/main/);
assert.match(access, /expected_commit_sha:/);

assert.ok(hasTopLevelTrigger(control, 'workflow_dispatch'));
assert.ok(!hasTopLevelTrigger(control, 'push'));
assert.match(control, /refs\/heads\/main/);
assert.match(control, /expected_commit_sha:/);

assert.ok(hasTopLevelTrigger(releaseGovernance, 'workflow_run'));
assert.ok(!hasTopLevelTrigger(releaseGovernance, 'workflow_dispatch'));
assert.ok(!hasTopLevelTrigger(releaseGovernance, 'pull_request'));
assert.ok(!hasTopLevelTrigger(releaseGovernance, 'pull_request_target'));
assert.ok(!hasTopLevelTrigger(releaseGovernance, 'push'));
assert.match(releaseGovernance, /workflows: \['Post-Release Production Verify'\]/);
const cfRefs = releaseGovernance.match(/secrets\.CLOUDFLARE_API_TOKEN/g) || [];
assert.strictEqual(cfRefs.length, 1, 'release governance must scope Cloudflare token to one step');

assert.ok(hasTopLevelTrigger(trusted, 'pull_request_target'));
assert.ok(!hasTopLevelTrigger(trusted, 'pull_request'));
assert.ok(!hasTopLevelTrigger(trusted, 'push'));
assert.match(trusted, /TRUSTED_VERIFIER_COMMIT_SHA: 952c1d33ae2e86887cd13a8186d39ad10dea0113/);
assert.match(trusted, /ref: \$\{\{ env\.TRUSTED_VERIFIER_COMMIT_SHA \}\}/);
assert.match(trusted, /path: \.trusted-verifier/);
assert.match(trusted, /persist-credentials: false/);
assert.match(trusted, /working-directory: \.trusted-verifier/);
assert.match(trusted, /STARTAK_EXPECTED_RELEASE_SOURCE_COMMIT_SHA: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/);
assert.doesNotMatch(trusted, /ref: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/);
assert.match(trusted, /HEAD_REPO/);
assert.match(trusted, /BASE_REPO/);
assert.match(trusted, /BASE_REF/);

const requiredGovernanceSecrets = [
  'STARTAK_E2E_PACKET_B64',
  'STARTAK_E2E_PACKET_PIN_SHA256',
  'STARTAK_E2F_PACKET_B64',
  'STARTAK_E2F_PACKET_PIN_SHA256',
  'STARTAK_E2F_VERIFIER_REGISTRY_B64',
  'STARTAK_E2F_VERIFIER_REGISTRY_PIN_SHA256',
  'STARTAK_E2G_PACKET_B64',
  'STARTAK_E2G_PACKET_PIN_SHA256',
  'STARTAK_E2G_RELEASE_AUTHORITY_REGISTRY_B64',
  'STARTAK_E2G_RELEASE_AUTHORITY_REGISTRY_PIN_SHA256',
];

for (const secret of requiredGovernanceSecrets) {
  const escaped = secret.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  assert.match(
    trusted,
    new RegExp(`${escaped}: \\$\\{\\{ secrets\\.${escaped} \\$\\}\\}`),
    `trusted main governance must consume protected secret ${secret}`,
  );
}

console.log('TRUSTED_MAIN_BOOTSTRAP_BOUNDARY=PASS');
