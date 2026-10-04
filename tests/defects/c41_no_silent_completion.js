'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const workflow = fs.readFileSync(path.join(__dirname, '../../.github/workflows/c41-full-platform-exhaustive-reliability-qualification.yml'), 'utf8');
const requiredTokens = [
  'C41_FINAL_READINESS=PASS',
  'C41_FINAL_READINESS=FAIL',
  'C41_SINGLE_SHA',
  'C41_LIVE_SOURCE_ACTIVATION=HOLD',
  'Full Playwright UI suite',
  'Canonical release verification',
  'Dependency security audit',
];
for (const token of requiredTokens) assert.ok(workflow.includes(token), `C41 workflow missing completion evidence token: ${token}`);

console.log('C41_NO_SILENT_COMPLETION=PASS');
