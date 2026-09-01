#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CORE = path.join(ROOT, 'runtime-evidence', 'e2e', 'core-e2e-result.json');
const FULL = path.join(ROOT, 'runtime-evidence', 'e2e', 'e2e-results.json');

function readJson(file, label) {
  if (!fs.existsSync(file)) throw new Error(`${label}_EVIDENCE_MISSING: ${file}`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function requirePass(obj, keys, label) {
  const failures = [];
  for (const key of keys) {
    if (obj[key] !== 'PASS') failures.push(`${key}=${JSON.stringify(obj[key])}`);
  }
  if (failures.length) throw new Error(`${label}_FAILURES: ${failures.join(', ')}`);
}

function requireZero(obj, keys, label) {
  const failures = [];
  for (const key of keys) {
    if (Number(obj[key] || 0) !== 0) failures.push(`${key}=${JSON.stringify(obj[key])}`);
  }
  if (failures.length) throw new Error(`${label}_ERROR_COUNTS: ${failures.join(', ')}`);
}

const core = readJson(CORE, 'CORE_E2E');
const full = readJson(FULL, 'FULL_E2E');

requirePass(core, [
  'E2E-00-HTTP',
  'E2E-01-BOOT',
  'E2E-02-BUILDING',
  'E2E-03-LAND',
  'E2E-04-FINANCING',
  'E2E-05-SAVED-DEALS',
  'E2E-06-RESET',
], 'CORE_E2E');
requireZero(core, ['PAGE_ERRORS', 'FATAL_CONSOLE_ERRORS', 'CORE_RUNTIME_NETWORK_FAILURES'], 'CORE_E2E');

requirePass(full, [
  'PRODUCTION_PREVIEW_BOOT',
  'PLAYWRIGHT_BROWSER_LAUNCH',
  'BROWSER_APP_BOOT',
  'AR_SA_RUNTIME',
  'EXISTING_BUILDING_E2E',
  'LAND_DEVELOPMENT_E2E',
  'CASH_FLOW_RUNTIME_FLOW',
  'SENSITIVITY_RUNTIME_FLOW',
  'RECOMMENDATION_RUNTIME_FLOW',
  'RESPONSIVE_SMOKE_TEST',
  'MOBILE_SMOKE',
  'TABLET_SMOKE',
  'DESKTOP_SMOKE',
], 'FULL_E2E');
requireZero(full, ['FATAL_CONSOLE_ERRORS', 'PAGE_ERRORS', 'TAILWIND_EXTERNAL_REQUESTS'], 'FULL_E2E');

if (full.FATAL_ERROR) throw new Error(`FULL_E2E_FATAL_ERROR: ${full.FATAL_ERROR}`);
if (core.fatal_error) throw new Error(`CORE_E2E_FATAL_ERROR: ${core.fatal_error}`);

console.log('COMPREHENSIVE_E2E_QUALIFICATION: PASS');
console.log(JSON.stringify({
  coreChecks: 7,
  fullChecks: 13,
  errorCountersChecked: 6,
  transactionAuthorized: false,
}, null, 2));
