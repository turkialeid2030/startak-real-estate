'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, '../../src/app/App.jsx');
const source = fs.readFileSync(appPath, 'utf8');

// P1-07 source-level regression guard. App must consume the governed cutover
// boundary and must not use the historical sample constants as fresh New Deal
// initialization, validation fallback, reset, or legacy hydration defaults.
assert.ok(source.includes("require('../decision-governance/app-workspace-cutover')"), 'App must import the governed workspace cutover boundary');
assert.ok(source.includes('createAppNewWorkspace'), 'App must create blank New Deal workspaces');
assert.ok(source.includes('createAppDemoWorkspace'), 'App must load Demo through an explicit Demo workspace');
assert.ok(source.includes('legacyHydrationDefaults'), 'App must use explicit legacy hydration defaults');
assert.ok(source.includes('evaluateAppCalculationReadiness'), 'App must gate financial calculation on workspace readiness');

const forbiddenPatterns = [
  /defaultInputs:\s*DEFAULT_BUILDING_INPUTS/g,
  /defaultInputs:\s*DEFAULT_LAND_INPUTS/g,
  /const fallback = createUiWorkspace\([\s\S]*?DEFAULT_BUILDING_INPUTS/g,
  /const fallback = createUiWorkspace\([\s\S]*?DEFAULT_LAND_INPUTS/g,
];
for (const pattern of forbiddenPatterns) {
  assert.strictEqual(pattern.test(source), false, `Forbidden demo-as-New-Deal fallback remains: ${pattern}`);
}

console.log('APP_CUTOVER_SOURCE_CONTRACT_TESTS=PASS');
