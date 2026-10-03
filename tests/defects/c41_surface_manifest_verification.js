'use strict';

const assert = require('assert');
const { C41_SURFACE_MANIFEST, C41_SURFACE_MATRIX_COUNT } = require('../fixtures/c41_surface_manifest');

assert.strictEqual(C41_SURFACE_MANIFEST.applicationModel, 'SINGLE_PAGE_MODE_TAB_MATRIX');
assert.deepStrictEqual(C41_SURFACE_MANIFEST.modes, ['building', 'land']);
assert.deepStrictEqual(C41_SURFACE_MANIFEST.tabs, ['dashboard', 'cashflow', 'sensitivity']);
assert.deepStrictEqual(C41_SURFACE_MANIFEST.locales, ['ar-SA', 'en']);
assert.strictEqual(C41_SURFACE_MANIFEST.viewports.length, 2);
assert.strictEqual(C41_SURFACE_MATRIX_COUNT, 24);
assert.ok(C41_SURFACE_MANIFEST.interactionClasses.length >= 15);

console.log('C41_SURFACE_MANIFEST=PASS');
console.log(`C41_SURFACE_MATRIX_COUNT=${C41_SURFACE_MATRIX_COUNT}`);
console.log(`C41_INTERACTION_CLASS_COUNT=${C41_SURFACE_MANIFEST.interactionClasses.length}`);
