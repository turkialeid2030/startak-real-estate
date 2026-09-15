'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { calculateInvestmentCase, STUDY_TYPE } = require('../../src/engines');

const FIXTURE_DIR = path.join(__dirname, '..', 'characterization', 'fixtures');

function loadBuildingFixture(id) {
  return JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, `${id}.json`), 'utf8'));
}

function assertSavedInputsMatchExplicitTopLevel(id) {
  const fixture = loadBuildingFixture(id);
  const savedInputs = JSON.parse(JSON.stringify(fixture.input_set));
  const before = JSON.parse(JSON.stringify(savedInputs));

  const fromSavedInputsOnly = calculateInvestmentCase({
    studyType: STUDY_TYPE.EXISTING_BUILDING,
    inputs: savedInputs,
  });
  const fromExplicitTopLevel = calculateInvestmentCase({
    studyType: STUDY_TYPE.EXISTING_BUILDING,
    inputs: savedInputs,
    leverageEnabled: savedInputs.leverageEnabled,
  });

  assert.deepStrictEqual(
    fromSavedInputsOnly,
    fromExplicitTopLevel,
    `${id}: saved inputs without top-level leverageEnabled must be exactly equivalent to an explicit matching top-level value`,
  );
  assert.deepStrictEqual(savedInputs, before, `${id}: engine entrypoint must not mutate saved inputs`);

  console.log(`WAVE_A_${id}_SAVED_INPUT_EQUIVALENCE=PASS leverageEnabled=${savedInputs.leverageEnabled}`);
}

assertSavedInputsMatchExplicitTopLevel('RE-GOLD-002-U');
assertSavedInputsMatchExplicitTopLevel('RE-GOLD-002-L');

// An explicitly supplied top-level value remains an intentional override.
const unleveredFixture = loadBuildingFixture('RE-GOLD-002-U');
const nestedTrueInputs = { ...unleveredFixture.input_set, leverageEnabled: true };
const explicitTrue = calculateInvestmentCase({
  studyType: STUDY_TYPE.EXISTING_BUILDING,
  inputs: unleveredFixture.input_set,
  leverageEnabled: true,
});
const nestedTrue = calculateInvestmentCase({
  studyType: STUDY_TYPE.EXISTING_BUILDING,
  inputs: nestedTrueInputs,
});
assert.deepStrictEqual(explicitTrue, nestedTrue, 'explicit top-level true must override nested false');
console.log('WAVE_A_EXPLICIT_TOP_LEVEL_OVERRIDE=PASS false->true');

console.log('WAVE_A_ENGINE_ENTRYPOINT_REGRESSION=PASS');
