'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const postReleasePath = path.join(root, '.github/workflows/post-release-production-verify.yml');
const releaseGovernancePath = path.join(root, '.github/workflows/release-governance-verify.yml');

const postRelease = fs.readFileSync(postReleasePath, 'utf8');
const releaseGovernance = fs.readFileSync(releaseGovernancePath, 'utf8');

const results = [];
function test(id, fn) {
  try {
    fn();
    results.push([id, 'PASS']);
    console.log(`${id} PASS`);
  } catch (error) {
    results.push([id, `FAIL: ${error.message}`]);
    console.log(`${id} FAIL: ${error.message}`);
  }
}

test('RELEASE-CHAIN-PROVENANCE-01', () => {
  assert.match(postRelease, /workflows: \['Cloudflare Control Plane Verify'\]/);
  assert.match(postRelease, /UPSTREAM_CONTROL_PLANE_EVENT:/);
  assert.match(postRelease, /UPSTREAM_CONTROL_PLANE_BRANCH:/);
  assert.match(postRelease, /UPSTREAM_CONTROL_PLANE_RUN_ID:/);
  assert.match(postRelease, /UPSTREAM_CONTROL_PLANE_RUN_URL:/);
  assert.match(postRelease, /Verify upstream control-plane provenance/);
  assert.match(postRelease, /push\|workflow_dispatch/);
  assert.match(postRelease, /COMMIT_CORRELATED_FROM_CONTROL_PLANE/);
});

test('RELEASE-CHAIN-PROVENANCE-02', () => {
  assert.match(postRelease, /Mark direct runs diagnostic only/);
  assert.match(postRelease, /DIAGNOSTIC_UNCORRELATED/);
  assert.match(postRelease, /qualifiesAsCommitCorrelatedProductionEvidence: false/);
  assert.match(postRelease, /productionMutationAuthorized: false/);
  assert.match(postRelease, /transactionAuthorized: false/);
});

test('RELEASE-CHAIN-PROVENANCE-03', () => {
  assert.match(releaseGovernance, /workflows: \['Post-Release Production Verify'\]/);
  assert.match(releaseGovernance, /UPSTREAM_POST_RELEASE_EVENT:/);
  assert.match(releaseGovernance, /UPSTREAM_POST_RELEASE_BRANCH:/);
  assert.match(releaseGovernance, /UPSTREAM_POST_RELEASE_RUN_ID:/);
  assert.match(releaseGovernance, /UPSTREAM_POST_RELEASE_RUN_URL:/);
  assert.match(releaseGovernance, /Verify upstream post-release provenance/);
  assert.match(releaseGovernance, /UPSTREAM_POST_RELEASE_EVENT.*workflow_run/);
  assert.match(releaseGovernance, /COMMIT_CORRELATED_POST_RELEASE_CHAIN/);
});

test('RELEASE-CHAIN-PROVENANCE-04', () => {
  assert.match(releaseGovernance, /exactShaChainEstablished/);
  assert.match(releaseGovernance, /qualifiesAsCommitCorrelatedReleaseEvidence/);
  assert.match(releaseGovernance, /health\?\.result === 'PASS'/);
  assert.match(releaseGovernance, /rollback\?\.result === 'PASS'/);
});

test('RELEASE-CHAIN-PROVENANCE-05', () => {
  assert.match(releaseGovernance, /Mark direct runs diagnostic only/);
  assert.match(releaseGovernance, /DIAGNOSTIC_UNCORRELATED/);
  assert.match(releaseGovernance, /qualifiesAsCommitCorrelatedReleaseEvidence: false/);
  assert.match(releaseGovernance, /releaseAuthorized: false/);
  assert.match(releaseGovernance, /deploymentAuthorized: false/);
  assert.match(releaseGovernance, /transactionAuthorized: false/);
});

test('RELEASE-CHAIN-PROVENANCE-06', () => {
  assert.match(postRelease, /\^\[a-f0-9\]\{40\}\$/);
  assert.match(releaseGovernance, /\^\[a-f0-9\]\{40\}\$/);
  assert.match(postRelease, /UPSTREAM_CONTROL_PLANE_BRANCH.*main/);
  assert.match(releaseGovernance, /UPSTREAM_POST_RELEASE_BRANCH.*main/);
});

const failed = results.filter((entry) => entry[1] !== 'PASS');
console.log(`RELEASE_CHAIN_PROVENANCE_HARDENING_RESULT=${failed.length === 0 ? 'PASS' : 'FAIL'} ${results.length - failed.length}/${results.length}`);
if (failed.length > 0) process.exit(1);
