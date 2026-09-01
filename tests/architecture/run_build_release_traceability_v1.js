'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  FALLBACK_METADATA,
  getBuildMetadata,
  installRuntimeBuildMetadata,
  normalizeMetadata,
} = require('../../src/runtime/build-metadata.js');

let checks = 0;
function check(name, fn) {
  fn();
  checks += 1;
  console.log(`PASS ${name}`);
}

check('unbuilt Node runtime fails closed to unverified-local metadata', () => {
  const meta = getBuildMetadata();
  assert.strictEqual(meta.deploymentVerified, false);
  assert.strictEqual(meta.productionDeploymentAuthorized, false);
  assert.strictEqual(meta.evidenceBoundary, 'BUILD_TRACE_ONLY_NOT_DEPLOYMENT_PROOF');
  assert.ok(meta.appVersion);
});

check('valid commit is normalized and bound without creating deployment proof', () => {
  const commit = 'ABCDEF0123456789ABCDEF0123456789ABCDEF01';
  const meta = normalizeMetadata({
    appVersion: '9.9.9',
    buildId: 'test-build',
    sourceCommit: commit,
    buildEnvironment: 'ci-test',
    deploymentVerified: true,
    productionDeploymentAuthorized: true,
  });
  assert.strictEqual(meta.sourceCommit, commit.toLowerCase());
  assert.strictEqual(meta.sourceCommitBound, true);
  assert.strictEqual(meta.deploymentVerified, false);
  assert.strictEqual(meta.productionDeploymentAuthorized, false);
});

check('invalid source commit fails closed rather than looking verified', () => {
  const meta = normalizeMetadata({ buildId: 'x', sourceCommit: 'main', buildEnvironment: 'test' });
  assert.strictEqual(meta.sourceCommit, null);
  assert.strictEqual(meta.sourceCommitBound, false);
});

check('browser diagnostic aliases are immutable', () => {
  const fakeWindow = {};
  const meta = installRuntimeBuildMetadata(fakeWindow);
  assert.strictEqual(fakeWindow.__STARTAK_RUNTIME_METADATA__, meta);
  assert.strictEqual(fakeWindow.__STARTAK_BUILD_ID__, meta.buildId);
  const buildIdDescriptor = Object.getOwnPropertyDescriptor(fakeWindow, '__STARTAK_BUILD_ID__');
  const metaDescriptor = Object.getOwnPropertyDescriptor(fakeWindow, '__STARTAK_RUNTIME_METADATA__');
  assert.strictEqual(buildIdDescriptor.writable, false);
  assert.strictEqual(buildIdDescriptor.configurable, false);
  assert.strictEqual(metaDescriptor.writable, false);
  assert.strictEqual(Object.isFrozen(fakeWindow.__STARTAK_RUNTIME_METADATA__), true);
});

check('observability reads internal build metadata rather than mutable window build id', () => {
  const source = fs.readFileSync(path.join(__dirname, '../../src/observability/report-runtime-error.js'), 'utf8');
  assert.ok(source.includes("getBuildMetadata"));
  assert.ok(!source.includes('window.__STARTAK_BUILD_ID__'));
  assert.ok(source.includes('release: build.buildId'));
});

check('Vite emits a release manifest and compile-time metadata define', () => {
  const source = fs.readFileSync(path.join(__dirname, '../../vite.config.js'), 'utf8');
  assert.ok(source.includes('release-manifest.json'));
  assert.ok(source.includes('__STARTAK_BUILD_METADATA__'));
  assert.ok(source.includes('GITHUB_SHA'));
  assert.ok(source.includes('CF_PAGES_COMMIT_SHA'));
});

check('fallback metadata never asserts deployment or production authorization', () => {
  assert.strictEqual(FALLBACK_METADATA.deploymentVerified, false);
  assert.strictEqual(FALLBACK_METADATA.productionDeploymentAuthorized, false);
  assert.strictEqual(FALLBACK_METADATA.sourceCommitBound, false);
});

console.log(`BUILD_RELEASE_TRACEABILITY_V1=PASS checks=${checks}`);
