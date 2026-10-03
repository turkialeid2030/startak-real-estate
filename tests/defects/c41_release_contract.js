'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const requiredFiles = [
  'tests/defects/c41_full_platform_reliability_qualification.js',
  'tests/e2e/c41_full_surface_matrix.spec.js',
  'tests/fixtures/c41_surface_manifest.js',
  '.github/workflows/c41-full-platform-exhaustive-reliability-qualification.yml',
  'C41_QUALIFICATION_SCOPE.md',
];

for (const relative of requiredFiles) {
  assert.ok(fs.existsSync(path.join(__dirname, '../..', relative)), `C41 required qualification asset missing: ${relative}`);
}

console.log('C41_RELEASE_CONTRACT=PASS');
console.log(`C41_REQUIRED_QUALIFICATION_ASSETS=${requiredFiles.length}`);
