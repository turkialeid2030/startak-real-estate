'use strict';

const assert = require('assert');
const manifest = require('../../governance/wave14-specialized-qualification-manifest.json');

let checks = 0;
const check = (value, message) => { assert.ok(value, message); checks += 1; };
const eq = (actual, expected, message) => { assert.strictEqual(actual, expected, message); checks += 1; };
const SHA40 = /^[a-f0-9]{40}$/;
const unique = (values) => new Set(values).size === values.length;

eq(manifest.schemaVersion, 1, 'schema version');
eq(manifest.program, 'STARTAK Real Estate', 'program identity');
eq(manifest.wave, '14', 'wave identity');
eq(manifest.scope, 'HOTELS_LEISURE_HERITAGE_AND_SPECIALIZED_ASSETS', 'scope identity');
check(SHA40.test(manifest.mainBaselineSha), 'main baseline is full SHA');
eq(manifest.qualificationMode, 'STACKED_DRAFT_NON_PRODUCTION', 'non-production qualification mode');

check(Array.isArray(manifest.components), 'components exist');
eq(manifest.components.length, 7, 'seven Wave 14 sub-waves pinned');
const expectedWaves = ['14A', '14B', '14C', '14D', '14E', '14F', '14G'];
const expectedPrs = [155, 156, 157, 158, 159, 160, 161];
const expectedRegressions = [266, 267, 268, 269, 270, 271, 272];
const expectedReleaseRuns = [532, 533, 534, 535, 536, 537, 538];
const expectedChecks = [42, 42, 47, 40, 44, 42, 44];

eq(JSON.stringify(manifest.components.map((c) => c.wave)), JSON.stringify(expectedWaves), 'wave sequence pinned');
eq(JSON.stringify(manifest.components.map((c) => c.pr)), JSON.stringify(expectedPrs), 'PR sequence pinned');
eq(JSON.stringify(manifest.components.map((c) => c.regressionTotal)), JSON.stringify(expectedRegressions), 'regression progression pinned');
eq(JSON.stringify(manifest.components.map((c) => c.releaseVerifyRun)), JSON.stringify(expectedReleaseRuns), 'release runs pinned');
eq(JSON.stringify(manifest.components.map((c) => c.dedicatedChecks)), JSON.stringify(expectedChecks), 'dedicated check counts pinned');
check(unique(manifest.components.map((c) => c.headSha)), 'qualified heads unique');
check(unique(manifest.components.map((c) => c.qualificationMarker)), 'qualification markers unique');

for (const component of manifest.components) {
  check(SHA40.test(component.headSha), `${component.wave} full head SHA`);
  check(component.headSha !== manifest.mainBaselineSha, `${component.wave} distinct from main baseline`);
  check(typeof component.title === 'string' && component.title.length > 0, `${component.wave} title exists`);
  check(component.qualificationMarker.endsWith('=PASS'), `${component.wave} marker passed`);
  check(Number.isInteger(component.dedicatedChecks) && component.dedicatedChecks > 0, `${component.wave} dedicated checks positive`);
  eq(component.releaseVerifyResult, 'PASS', `${component.wave} release verify passed`);
  eq(component.draft, true, `${component.wave} draft`);
  eq(component.merged, false, `${component.wave} not merged`);
  eq(component.productionDeployed, false, `${component.wave} not production deployed`);
}

for (let i = 1; i < manifest.components.length; i += 1) {
  eq(manifest.components[i].regressionTotal, manifest.components[i - 1].regressionTotal + 1, `regression discovery increment ${manifest.components[i - 1].wave}->${manifest.components[i].wave}`);
  eq(manifest.components[i].pr, manifest.components[i - 1].pr + 1, `PR sequence increment ${manifest.components[i - 1].wave}->${manifest.components[i].wave}`);
}

for (const [key, value] of Object.entries(manifest.safetyBoundary)) eq(value, false, `safety boundary ${key} false`);

eq(manifest.transition.wave14EngineeringArchitectureQualified, true, 'Wave 14 engineering architecture qualified');
eq(manifest.transition.nextWave, '15', 'next wave 15');
eq(manifest.transition.nextScope, 'REPORTING_REVIEW_AND_STANDARDS_QA', 'next scope pinned');
eq(manifest.transition.requiresSeparateWave15Qualification, true, 'Wave 15 independent qualification required');

console.log(`WAVE_14H_SPECIALIZED_CLOSEOUT=PASS checks=${checks}`);
