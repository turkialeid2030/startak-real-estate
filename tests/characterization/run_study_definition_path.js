'use strict';

const fs = require('fs');
const path = require('path');
const { ExistingBuildingStudyDefinition } = require('../../src/modules/studies/existing-building');
const { LandDevelopmentStudyDefinition } = require('../../src/modules/studies/land-development');
const { calculateInvestmentCase, STUDY_TYPE } = require('../../src/engines');

const FIXTURE_DIR = path.join(__dirname, 'fixtures');
const defs = { building: ExistingBuildingStudyDefinition, land: LandDevelopmentStudyDefinition };
const studyTypes = { building: STUDY_TYPE.EXISTING_BUILDING, land: STUDY_TYPE.LAND_DEVELOPMENT };
const fixtureFiles = ['RE-GOLD-001-U', 'RE-GOLD-001-L', 'RE-GOLD-002-U', 'RE-GOLD-002-L'];
let mismatches = 0;

function sameValue(a, b) {
  if (Number.isNaN(a) && Number.isNaN(b)) return true;
  return JSON.stringify(a) === JSON.stringify(b);
}

for (const fid of fixtureFiles) {
  const fixture = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, fid + '.json'), 'utf8'));
  const result = defs[fixture.study_type].calculate(fixture.input_set);
  const canonical = calculateInvestmentCase({
    studyType: studyTypes[fixture.study_type],
    inputs: fixture.input_set,
    leverageEnabled: fixture.input_set.leverageEnabled,
  });
  const keys = new Set([...Object.keys(result), ...Object.keys(canonical)]);
  const m = [...keys].filter((key) => !sameValue(result[key], canonical[key]));
  mismatches += m.length;
  console.log(`${fid} (StudyDefinition vs current canonical): mismatches=${m.length}`);
}
console.log(`\nSTUDY_DEFINITION_CURRENT_CANONICAL_MISMATCHES=${mismatches}`);
process.exit(mismatches === 0 ? 0 : 1);
