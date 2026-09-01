'use strict';

// The UI adapter must produce the same result as the current canonical engine.
// RE-GOLD expected outputs remain a frozen legacy reference and are not used as
// the authority after Financial Model v2 remediation.
const fs = require('fs');
const path = require('path');
const { STUDY_TYPE, calculateInvestmentCase } = require('../../src/engines');

function uiPathCalculate(studyType, inputs) {
  return calculateInvestmentCase({ studyType, inputs, leverageEnabled: inputs.leverageEnabled });
}

const FIXTURE_DIR = path.join(__dirname, 'fixtures');
const fixtureFiles = ['RE-GOLD-001-U', 'RE-GOLD-001-L', 'RE-GOLD-002-U', 'RE-GOLD-002-L'];
const studyTypeMap = { land: STUDY_TYPE.LAND_DEVELOPMENT, building: STUDY_TYPE.EXISTING_BUILDING };

let mismatches = 0;
function sameValue(a, b) {
  if (Number.isNaN(a) && Number.isNaN(b)) return true;
  return JSON.stringify(a) === JSON.stringify(b);
}

for (const fid of fixtureFiles) {
  const fixture = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, fid + '.json'), 'utf8'));
  const studyType = studyTypeMap[fixture.study_type];
  const uiResult = uiPathCalculate(studyType, fixture.input_set);
  const canonical = calculateInvestmentCase({ studyType, inputs: fixture.input_set, leverageEnabled: fixture.input_set.leverageEnabled });
  const keys = new Set([...Object.keys(uiResult), ...Object.keys(canonical)]);
  const m = [...keys].filter((key) => !sameValue(uiResult[key], canonical[key]));
  mismatches += m.length;
  console.log(`${fid} (UI adapter vs current canonical): mismatches=${m.length}`);
}
console.log(`\nUI_PATH_CURRENT_CANONICAL_MISMATCHES=${mismatches}`);
process.exit(mismatches === 0 ? 0 : 1);
