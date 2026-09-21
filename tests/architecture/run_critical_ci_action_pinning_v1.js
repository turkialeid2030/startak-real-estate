#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');

const pins = {
  checkout: 'actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1',
  setupNode: 'actions/setup-node@820762786026740c76f36085b0efc47a31fe5020',
  uploadArtifact: 'actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a',
};

const workflows = {
  release: read('.github/workflows/release-verify.yml'),
  comprehensive: read('.github/workflows/comprehensive-verify.yml'),
  deep: read('.github/workflows/deep-platform-verify.yml'),
  trusted: read('.github/workflows/trusted-main-production-governance.yml'),
};

for (const [name, workflow] of Object.entries(workflows)) {
  assert.ok(workflow.includes(pins.checkout), `${name}: checkout must use the approved immutable SHA`);
  assert.ok(!/actions\/checkout@v\d+/i.test(workflow), `${name}: mutable checkout major tag is forbidden`);
}

for (const name of ['release', 'comprehensive', 'deep']) {
  const workflow = workflows[name];
  assert.ok(workflow.includes(pins.setupNode), `${name}: setup-node must use the approved immutable SHA`);
  assert.ok(!/actions\/setup-node@v\d+/i.test(workflow), `${name}: mutable setup-node major tag is forbidden`);
  assert.ok(/uses:\s*actions\/checkout@[a-f0-9]{40}[\s\S]*?with:\s*\n\s+persist-credentials:\s*false/.test(workflow), `${name}: checkout credentials must not persist`);
}

for (const name of ['comprehensive', 'deep']) {
  const workflow = workflows[name];
  assert.ok(workflow.includes(pins.uploadArtifact), `${name}: upload-artifact must use the approved immutable SHA`);
  assert.ok(!/actions\/upload-artifact@v\d+/i.test(workflow), `${name}: mutable upload-artifact major tag is forbidden`);
}

assert.ok(/uses:\s*actions\/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1[\s\S]*?persist-credentials:\s*false/.test(workflows.trusted), 'trusted: immutable verifier checkout must keep persist-credentials false');
assert.ok(workflows.trusted.includes('TRUSTED_VERIFIER_COMMIT_SHA: 952c1d33ae2e86887cd13a8186d39ad10dea0113'), 'trusted: trusted verifier commit pin must remain unchanged');
assert.ok(workflows.trusted.includes("if: steps.mode.outputs.mode != 'internal'"), 'trusted: fail-closed production re-entry condition must remain intact');
assert.ok(workflows.trusted.includes('STARTAK_E2E_PACKET_B64'), 'trusted: E2E production evidence boundary must remain intact');
assert.ok(workflows.trusted.includes('STARTAK_E2F_PACKET_B64'), 'trusted: E2F production evidence boundary must remain intact');
assert.ok(workflows.trusted.includes('STARTAK_E2G_PACKET_B64'), 'trusted: E2G production evidence boundary must remain intact');

console.log('CRITICAL_CI_ACTION_PINNING=PASS');
console.log(`CHECKOUT_PIN=${pins.checkout.split('@')[1]}`);
console.log(`SETUP_NODE_PIN=${pins.setupNode.split('@')[1]}`);
console.log(`UPLOAD_ARTIFACT_PIN=${pins.uploadArtifact.split('@')[1]}`);
