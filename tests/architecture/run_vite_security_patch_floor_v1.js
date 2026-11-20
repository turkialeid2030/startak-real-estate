'use strict';
/**
 * SECURITY-HARDENING-V1: regression against GHSA-p4f5-76q4-ffq7.
 * This protects the tracked Vite 8.2.x dependency, not any externally hosted
 * dev server or the still-unpatched GHSA-fc5q-39xc-vjpf in picomatch.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
function parsedVersion(s) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(s));
  assert.ok(m, 'SEMVER_THREE_NUMBERS_REQUIRED');
  return m.slice(1).map(Number);
}
function atLeast(actual, minimum) {
  const a = parsedVersion(actual), b = parsedVersion(minimum);
  for(let i=0;i<3;i++) {if(a[i]>b[i])return true; if(a[i]<b[i])return false;}
  return true;
}
assert.equal(pkg.devDependencies.vite, '8.2.6', 'EXACT_VITE_8_2_PATCH_PIN_REQUIRED');
assert.equal(lock.packages[''].devDependencies.vite, pkg.devDependencies.vite);
assert.equal(lock.packages['node_modules/vite'].version, pkg.devDependencies.vite);
assert.ok(atLeast(lock.packages['node_modules/rolldown'].version, '1.2.17'),
  'GHSA_VITE_ROLLDOWN_PATCH_FLOOR_NOT_MET');
assert.ok(!/\s--host(?:\s|=|$)/.test(pkg.scripts.dev), 'DEV_SERVER_MUST_NOT_BIND_NETWORK');
assert.ok(!/\s--host(?:\s|=|$)/.test(pkg.scripts['dev:bundled']), 'BUNDLED_DEV_MUST_NOT_BIND_NETWORK');
// A published npm advisory for picomatch <=4.0.7 remains open; do not
// collapse this separate vulnerability into Vite patch success.
console.log('VITE_8_2_6_SECURITY_PATCH_FLOOR=PASS');
console.log('PICOMATCH_GHSA_FC5Q_39XC_VJPF_WITHDRAWN_2026_11_18_REVIEW_HISTORICAL_CVE_SEPARATELY');
