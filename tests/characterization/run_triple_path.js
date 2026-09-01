'use strict';

// Post-Wave-A triple-path contract:
// 1) frozen legacy source remains executable for historical evidence;
// 2) direct remediated engine and production entrypoint must be identical;
// 3) legacy and v2 are expected to diverge because the financial baseline was
//    intentionally corrected rather than preserved.
const fs = require('fs');
const path = require('path');
const { loadCurrentEngines } = require('../load_engines');
const { calculateInvestmentCase, STUDY_TYPE } = require('../../src/engines');
const { calcExistingBuilding } = require('../../src/engines/valuation/existing-building');
const { calcLandDevelopment } = require('../../src/engines/valuation/land-development');

const FIXTURE_DIR = path.join(__dirname, 'fixtures');
const legacy = loadCurrentEngines();
const direct = { building: calcExistingBuilding, land: calcLandDevelopment };
const legacyCalc = { building: legacy.calcExistingBuilding, land: legacy.calcLandDevelopment };
const studyTypeMap = { building: STUDY_TYPE.EXISTING_BUILDING, land: STUDY_TYPE.LAND_DEVELOPMENT };
const fixtureFiles = ['RE-GOLD-001-U', 'RE-GOLD-001-L', 'RE-GOLD-002-U', 'RE-GOLD-002-L'];

let productionVsDirectMismatches = 0;
let legacyVsV2DifferentFixtures = 0;

for (const fid of fixtureFiles) {
  const fixture = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, fid + '.json'), 'utf8'));
  const legacyResult = legacyCalc[fixture.study_type](fixture.input_set);
  const directV2 = direct[fixture.study_type](fixture.input_set);
  const productionV2 = calculateInvestmentCase({
    studyType: studyTypeMap[fixture.study_type],
    inputs: fixture.input_set,
    leverageEnabled: fixture.input_set.leverageEnabled,
  });

  const directJson = JSON.stringify(directV2);
  const productionJson = JSON.stringify(productionV2);
  if (directJson !== productionJson) productionVsDirectMismatches += 1;
  if (JSON.stringify(legacyResult) !== directJson) legacyVsV2DifferentFixtures += 1;

  const versionOk = fixture.study_type === 'building'
    ? /^BUILDING_WAVE_A_/.test(productionV2.financialModelVersion)
    : /^LAND_WAVE_A_/.test(productionV2.financialModelVersion);
  if (!versionOk) productionVsDirectMismatches += 1;
  console.log(`${fid}: production_vs_direct=${directJson === productionJson ? 'MATCH' : 'DIFF'} legacy_vs_v2=${JSON.stringify(legacyResult) === directJson ? 'MATCH' : 'INTENTIONAL_DIFF'}`);
}

console.log(`\nPRODUCTION_V2_VS_DIRECT_V2_MISMATCHES=${productionVsDirectMismatches}`);
console.log(`LEGACY_VS_V2_DIFFERENT_FIXTURES=${legacyVsV2DifferentFixtures}`);
process.exit(productionVsDirectMismatches === 0 && legacyVsV2DifferentFixtures > 0 ? 0 : 1);
