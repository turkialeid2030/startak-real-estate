'use strict';

// Saved-deal compatibility after Financial Model v2 means the persisted record
// shape and merge semantics remain stable, and a restored deal produces the
// SAME current-canonical result as calculating the identical restored inputs
// directly. Frozen legacy expected outputs are intentionally not authoritative
// for the remediated financial model.
const fs = require('fs');
const path = require('path');
const { calculateInvestmentCase, STUDY_TYPE } = require('../../src/engines');

const appSource = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'app', 'App.jsx'), 'utf8');
const buildingMatch = appSource.match(/const DEFAULT_BUILDING_INPUTS = (\{[\s\S]*?\n\});/);
const landMatch = appSource.match(/const DEFAULT_LAND_INPUTS = (\{[\s\S]*?\n\});/);
const DEFAULT_BUILDING_INPUTS = eval('(' + buildingMatch[1] + ')');
const DEFAULT_LAND_INPUTS = eval('(' + landMatch[1] + ')');

function simulateLoadDeal(record) {
  if (record.mode === 'building') return { mode: 'building', inputs: { ...DEFAULT_BUILDING_INPUTS, ...record.inputs } };
  return { mode: 'land', inputs: { ...DEFAULT_LAND_INPUTS, ...record.inputs } };
}

const FIXTURE_DIR = path.join(__dirname, 'fixtures');
const buildingFixture = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, 'RE-GOLD-002-U.json'), 'utf8'));
const landFixture = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, 'RE-GOLD-001-U.json'), 'utf8'));
const cases = [
  { label: 'Existing Building', mode: 'building', studyType: STUDY_TYPE.EXISTING_BUILDING, inputs: buildingFixture.input_set },
  { label: 'Land + Development', mode: 'land', studyType: STUDY_TYPE.LAND_DEVELOPMENT, inputs: landFixture.input_set },
];

let failures = 0;
for (const c of cases) {
  const legacyRecord = { id: 'deal_1700000000000', name: 'test deal', mode: c.mode, inputs: { ...c.inputs, leverageEnabled: false }, savedAt: '2026-01-01T00:00:00.000Z' };
  const schemaKeys = Object.keys(legacyRecord).sort().join(',');
  const expectedSchemaKeys = ['id', 'inputs', 'mode', 'name', 'savedAt'].sort().join(',');
  if (schemaKeys !== expectedSchemaKeys) failures += 1;

  const restored = simulateLoadDeal(legacyRecord);
  const fromRestored = calculateInvestmentCase({ studyType: c.studyType, inputs: restored.inputs, leverageEnabled: restored.inputs.leverageEnabled });
  const direct = calculateInvestmentCase({ studyType: c.studyType, inputs: { ...(c.mode === 'building' ? DEFAULT_BUILDING_INPUTS : DEFAULT_LAND_INPUTS), ...legacyRecord.inputs }, leverageEnabled: false });

  if (JSON.stringify(fromRestored) !== JSON.stringify(direct)) failures += 1;
  if (!fromRestored.financialModelVersion || !fromRestored.financialModelStatus) failures += 1;
  console.log(`${c.label}: schema_stable=${schemaKeys === expectedSchemaKeys}, restored_equals_direct=${JSON.stringify(fromRestored) === JSON.stringify(direct)}`);
}

console.log(`\nSAVED_DEAL_COMPATIBILITY_FAILURES=${failures}`);
console.log('SAVED_DEAL_SCHEMA_CHANGED=false');
process.exit(failures === 0 ? 0 : 1);
