'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const workflowPath = path.join(root, '.github/workflows/production-ai-smoke.yml');
const workflow = fs.readFileSync(workflowPath, 'utf8');
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

test('PRODUCTION-AI-SMOKE-CORRELATION-01', () => {
  assert.doesNotMatch(workflow, /\n\s*push:\s*\n/, 'production AI smoke must not race production deployment directly from push');
  assert.match(workflow, /workflow_run:/);
  assert.match(workflow, /Cloudflare Control Plane Verify/);
  assert.match(workflow, /branches:\s*\[main\]/);
});

test('PRODUCTION-AI-SMOKE-CORRELATION-02', () => {
  assert.match(workflow, /EXPECTED_DEPLOYED_SHA:.*workflow_run\.head_sha/);
  assert.match(workflow, /UPSTREAM_CONTROL_PLANE_RUN_ID:.*workflow_run\.id/);
  assert.match(workflow, /UPSTREAM_CONTROL_PLANE_RUN_URL:.*workflow_run\.html_url/);
  assert.match(workflow, /EXACT_DEPLOYMENT_CORRELATED/);
  assert.match(workflow, /DIAGNOSTIC_UNCORRELATED/);
});

test('PRODUCTION-AI-SMOKE-CORRELATION-03', () => {
  assert.match(workflow, /workflow_run\.conclusion == 'success'/);
  assert.match(workflow, /workflow_run\.head_branch.*main/);
  assert.match(workflow, /\^\[0-9a-fA-F\]\{40\}\$/);
});

test('PRODUCTION-AI-SMOKE-CORRELATION-04', () => {
  assert.match(workflow, /Write production AI smoke evidence envelope/);
  assert.match(workflow, /qualifiesAsCommitCorrelatedSmokeEvidence/);
  assert.match(workflow, /deploymentCorrelationEstablished/);
  assert.match(workflow, /expectedDeployedSha/);
  assert.match(workflow, /upstreamControlPlaneRunId/);
  assert.match(workflow, /authority:\{releaseAuthorized:false,mergeAuthorized:false,deploymentAuthorized:false,goLiveAuthorized:false,transactionAuthorized:false\}/);
});

test('PRODUCTION-AI-SMOKE-CORRELATION-05', () => {
  assert.match(workflow, /actions\/upload-artifact@v4/);
  assert.match(workflow, /production-ai-smoke-evidence-/);
  assert.match(workflow, /retention-days:\s*30/);
});

test('PRODUCTION-AI-SMOKE-CORRELATION-06', () => {
  assert.match(workflow, /\/api\/riai\/public-config/);
  assert.match(workflow, /\/api\/riai\/ai-assist/);
  assert.match(workflow, /challenges\\\.cloudflare\\\.com/);
  assert.match(workflow, /This workflow is read-only/);
});

const failed = results.filter((entry) => entry[1] !== 'PASS');
console.log(`PRODUCTION_AI_SMOKE_COMMIT_CORRELATION_RESULT=${failed.length === 0 ? 'PASS' : 'FAIL'} ${results.length - failed.length}/${results.length}`);
if (failed.length > 0) process.exit(1);
