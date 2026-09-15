'use strict';

const assert = require('assert');
const manifest = require('../../governance/wave13-commercial-qualification-manifest.json');

let checks = 0;
const check = (value, message) => { assert.ok(value, message); checks += 1; };
const eq = (actual, expected, message) => { assert.strictEqual(actual, expected, message); checks += 1; };

const SHA40 = /^[a-f0-9]{40}$/;

function unique(values) { return new Set(values).size === values.length; }

// Manifest identity and release mode.
eq(manifest.schemaVersion, 1, 'schema version');
eq(manifest.program, 'STARTAK Real Estate', 'program identity');
eq(manifest.wave, '13', 'wave identity');
eq(manifest.scope, 'COMMERCIAL_REAL_ESTATE_SPECIALIZATION', 'scope identity');
check(SHA40.test(manifest.mainBaselineSha), 'main baseline is a full commit SHA');
eq(manifest.qualificationMode, 'STACKED_DRAFT_NON_PRODUCTION', 'qualification mode is non-production');

// Exact qualified component set and sequence.
check(Array.isArray(manifest.components), 'components array exists');
eq(manifest.components.length, 4, 'four Wave 13 sub-waves pinned');
const expectedWaves = ['13A', '13B', '13C', '13D'];
const expectedPrs = [150, 151, 152, 153];
const expectedRegressions = [261, 262, 263, 264];
const expectedReleaseRuns = [525, 527, 529, 530];

eq(JSON.stringify(manifest.components.map((c) => c.wave)), JSON.stringify(expectedWaves), 'wave order pinned');
eq(JSON.stringify(manifest.components.map((c) => c.pr)), JSON.stringify(expectedPrs), 'PR sequence pinned');
eq(JSON.stringify(manifest.components.map((c) => c.regressionTotal)), JSON.stringify(expectedRegressions), 'regression progression pinned');
eq(JSON.stringify(manifest.components.map((c) => c.releaseVerifyRun)), JSON.stringify(expectedReleaseRuns), 'release verification runs pinned');
check(unique(manifest.components.map((c) => c.headSha)), 'qualified heads are unique');
check(unique(manifest.components.map((c) => c.qualificationMarker)), 'qualification markers are unique');

for (const component of manifest.components) {
  check(SHA40.test(component.headSha), `${component.wave} head is a full SHA`);
  check(component.headSha !== manifest.mainBaselineSha, `${component.wave} is not main baseline`);
  check(typeof component.title === 'string' && component.title.length > 0, `${component.wave} title exists`);
  check(typeof component.qualificationMarker === 'string' && component.qualificationMarker.endsWith('=PASS'), `${component.wave} qualification marker pinned`);
  check(Number.isInteger(component.dedicatedChecks) && component.dedicatedChecks > 0, `${component.wave} dedicated checks positive`);
  eq(component.releaseVerifyResult, 'PASS', `${component.wave} release verify passed`);
  eq(component.draft, true, `${component.wave} remains draft`);
  eq(component.merged, false, `${component.wave} not merged`);
  eq(component.productionDeployed, false, `${component.wave} not production deployed`);
}

// Regression totals must be strictly increasing by one across the qualified sequence.
for (let i = 1; i < manifest.components.length; i += 1) {
  eq(manifest.components[i].regressionTotal, manifest.components[i - 1].regressionTotal + 1, `regression discovery increment ${manifest.components[i - 1].wave}->${manifest.components[i].wave}`);
}

// Safety boundaries are all fail-closed / non-authorizing.
for (const [key, value] of Object.entries(manifest.safetyBoundary)) {
  eq(value, false, `safety boundary ${key} remains false`);
}

// Transition declaration closes Wave 13 engineering architecture only; it does not qualify Wave 14.
eq(manifest.transition.wave13EngineeringArchitectureQualified, true, 'Wave 13 engineering architecture qualified');
eq(manifest.transition.nextWave, '14', 'next wave is 14');
eq(manifest.transition.nextScope, 'HOTELS_LEISURE_AND_SPECIALIZED_ASSETS', 'next scope pinned');
eq(manifest.transition.requiresSeparateWave14Qualification, true, 'Wave 14 requires independent qualification');

console.log(`WAVE_13E_COMMERCIAL_CLOSEOUT=PASS checks=${checks}`);
