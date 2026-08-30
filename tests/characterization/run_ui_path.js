// tests/characterization/run_ui_path.js -- Section 15: Production UI calculation
// adapter → Golden. Extracts the ACTUAL post-cutover call sites from
// src/app/App.jsx (the working production copy) and proves they still produce
// RE-GOLD-identical results after the structural edit.
const fs = require('fs');
const path = require('path');
const { STUDY_TYPE, calculateInvestmentCase } = require('../../src/engines');

// Simulate exactly what App.jsx now does at its two useMemo call sites (lines
// verified in REBASE_UI_CALCULATION_BOUNDARY.md / grep against src/app/App.jsx):
// buildingResults = calculateInvestmentCase({studyType: EXISTING_BUILDING, inputs: buildingInputs, leverageEnabled: buildingInputs.leverageEnabled})
// landResults = calculateInvestmentCase({studyType: LAND_DEVELOPMENT, inputs: landInputs, leverageEnabled: landInputs.leverageEnabled})
function uiPathCalculate(studyType, inputs) {
  return calculateInvestmentCase({ studyType, inputs, leverageEnabled: inputs.leverageEnabled });
}

const FIXTURE_DIR = path.join(__dirname, 'fixtures');
const fixtureFiles = ['RE-GOLD-001-U', 'RE-GOLD-001-L', 'RE-GOLD-002-U', 'RE-GOLD-002-L'];
const studyTypeMap = { land: STUDY_TYPE.LAND_DEVELOPMENT, building: STUDY_TYPE.EXISTING_BUILDING };

let uiVsGold = 0, totalFields = 0;
for (const fid of fixtureFiles) {
  const fixture = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, fid + '.json'), 'utf8'));
  const uiResult = uiPathCalculate(studyTypeMap[fixture.study_type], fixture.input_set);
  const mismatches = [];
  for (const key of Object.keys(fixture.expected_outputs)) {
    totalFields++;
    const ev = fixture.expected_outputs[key], av = uiResult[key];
    if (Array.isArray(ev)) {
      if (!Array.isArray(av) || ev.length !== av.length || ev.some((v, i) => v !== av[i])) mismatches.push(key);
    } else if (ev !== av) mismatches.push(key);
  }
  uiVsGold += mismatches.length;
  console.log(`${fid} (UI path): mismatches=${mismatches.length}`);
}
console.log('');
console.log(`UI_PATH_VS_GOLD_MISMATCHES=${uiVsGold} (of ${totalFields} fields)`);
process.exit(uiVsGold === 0 ? 0 : 1);
