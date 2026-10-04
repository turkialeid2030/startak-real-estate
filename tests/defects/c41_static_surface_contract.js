'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { C41_SURFACE_MANIFEST, C41_SURFACE_MATRIX_COUNT } = require('../fixtures/c41_surface_manifest');

const appPath = path.join(__dirname, '../../src/app/App.jsx');
const source = fs.readFileSync(appPath, 'utf8');

for (const mode of C41_SURFACE_MANIFEST.modes) {
  assert.ok(source.includes(`key: \"${mode}\"`) || source.includes(`key: '${mode}'`), `Mode ${mode} missing from production UI`);
}
for (const tab of C41_SURFACE_MANIFEST.tabs) {
  assert.ok(source.includes(`key: \"${tab}\"`) || source.includes(`key: '${tab}'`), `Tab ${tab} missing from production UI`);
}

assert.ok(source.includes('<ValuationIntelligencePanel'), 'Valuation Intelligence panel not wired');
assert.ok(source.includes('<ResidentialIncomeAcquisitionPanel'), 'Residential Income Acquisition panel not wired');
assert.ok(source.includes('<ZakatInputSection'), 'Zakat input layer not wired');
assert.ok(source.includes('<DealsPanel'), 'Saved Deals panel not wired');
assert.ok(source.includes('setLocale('), 'Locale toggle not wired');
assert.ok(source.includes('saveCurrentAsNewDeal'), 'Save flow not wired');
assert.ok(source.includes('updateActiveDeal'), 'Update flow not wired');
assert.ok(source.includes('deleteDeal'), 'Delete flow not wired');
assert.ok(source.includes('exportBackup'), 'Backup export flow not wired');
assert.ok(source.includes('importBackup'), 'Backup import flow not wired');
assert.ok(source.includes('resetCurrent'), 'Reset flow not wired');

const buttonCount = (source.match(/<button\b/g) || []).length;
const inputCount = (source.match(/<input\b/g) || []).length;
const selectCount = (source.match(/<select\b/g) || []).length;
const svgCount = (source.match(/<svg\b/g) || []).length;

assert.ok(buttonCount >= 10, `Unexpectedly small button surface: ${buttonCount}`);
assert.ok(inputCount >= 3, `Unexpectedly small input surface: ${inputCount}`);
assert.ok(selectCount >= 1, `Unexpectedly small select surface: ${selectCount}`);
assert.ok(svgCount >= 1, `Unexpectedly small SVG surface: ${svgCount}`);

console.log('C41_STATIC_SURFACE_CONTRACT=PASS');
console.log(`C41_SURFACE_MATRIX_COUNT=${C41_SURFACE_MATRIX_COUNT}`);
console.log(`C41_APP_BUTTON_DECLARATIONS=${buttonCount}`);
console.log(`C41_APP_INPUT_DECLARATIONS=${inputCount}`);
console.log(`C41_APP_SELECT_DECLARATIONS=${selectCount}`);
console.log(`C41_APP_SVG_DECLARATIONS=${svgCount}`);
