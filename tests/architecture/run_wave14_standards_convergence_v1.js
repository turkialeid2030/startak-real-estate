'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const manifest = require('../../governance/wave14-standards-convergence.json');
const standards = require('../../src/standards');
const valuationAssignment = require('../../src/valuation-assignment');

let checks = 0;
function check(fn) { fn(); checks += 1; }
function exists(relativePath) { return fs.existsSync(path.join(ROOT, relativePath)); }

const EXPECTED_WAVE14_HEAD = 'c5907bd0f6fae60397fcc20ba0e204b152c77f55';
const EXPECTED_STANDARDS_HEAD = '35e8c38033ac2c85026724748577ffb4c8f57649';
const REQUIRED_WAVE14_MARKERS = [
  'governance/wave14-specialized-qualification-manifest.json',
  'tests/architecture/run_wave14h_specialized_closeout.js',
  'docs/WAVE_14H_SPECIALIZED_CLOSEOUT.md',
  '.github/workflows/specialized-closeout-verify.yml',
];

check(() => assert.strictEqual(manifest.manifestVersion, '1.0.0'));
check(() => assert.strictEqual(manifest.status, 'CONVERGENCE_CANDIDATE'));
check(() => assert.strictEqual(manifest.wave14Head, EXPECTED_WAVE14_HEAD));
check(() => assert.strictEqual(manifest.standardsHead, EXPECTED_STANDARDS_HEAD));
check(() => assert.deepStrictEqual(manifest.sourcePullRequests, [162, 167]));
check(() => assert.strictEqual(manifest.overlayStrategy, 'EXACT_BLOB_OVERLAY_ON_QUALIFIED_WAVE14H'));
check(() => assert.strictEqual(manifest.changedPathConflictAssessment, 'NO_OVERLAPPING_CHANGED_PATHS_OBSERVED'));
check(() => assert.strictEqual(manifest.overlayFileCount, 20));
check(() => assert.strictEqual(manifest.overlayFiles.length, 20));
check(() => assert.strictEqual(new Set(manifest.overlayFiles).size, manifest.overlayFiles.length));

for (const file of manifest.overlayFiles) {
  check(() => assert.ok(exists(file), `Missing standards convergence overlay file: ${file}`));
}
for (const file of REQUIRED_WAVE14_MARKERS) {
  check(() => assert.ok(exists(file), `Missing Wave 14H qualification marker: ${file}`));
}

check(() => assert.strictEqual(manifest.standardsBoundary, 'NON_ENFORCING_LIBRARY_ONLY'));
check(() => assert.strictEqual(manifest.operatingMode, 'UNLICENSED_DECISION_SUPPORT'));
check(() => assert.strictEqual(manifest.productionWiring, false));
check(() => assert.strictEqual(manifest.namedStandardsActivated, false));
check(() => assert.strictEqual(manifest.professionalValuationAuthorized, false));
check(() => assert.strictEqual(manifest.certifiedValuationAuthorized, false));
check(() => assert.strictEqual(manifest.legalOpinionEstablished, false));
check(() => assert.strictEqual(manifest.transactionAuthorized, false));
check(() => assert.strictEqual(manifest.mergeAuthorized, false));
check(() => assert.strictEqual(manifest.deployAuthorized, false));
check(() => assert.strictEqual(manifest.qualificationRequired, true));

check(() => assert.strictEqual(typeof standards.createInitialNonEnforcingRegistry, 'function'));
check(() => assert.strictEqual(typeof standards.routeStandards, 'function'));
check(() => assert.strictEqual(typeof standards.createStandardsSnapshot, 'function'));
check(() => assert.strictEqual(typeof standards.createStandardLifecycle, 'function'));
const registry = standards.createInitialNonEnforcingRegistry('2026-09-08');
check(() => assert.strictEqual(registry.mode, 'NON_ENFORCING_LIBRARY_ONLY'));
check(() => assert.deepStrictEqual(registry.standards, []));
check(() => assert.deepStrictEqual(registry.rules, []));
check(() => assert.strictEqual(registry.legalApprovalEstablished, false));
check(() => assert.strictEqual(registry.professionalAuthorizationEstablished, false));
check(() => assert.strictEqual(registry.transactionAuthorized, false));

check(() => assert.strictEqual(typeof valuationAssignment.createProfessionalAssignment, 'function'));
check(() => assert.strictEqual(typeof valuationAssignment.transitionAssignment, 'function'));

console.log(`WAVE_14_STANDARDS_CONVERGENCE=PASS checks=${checks}`);
