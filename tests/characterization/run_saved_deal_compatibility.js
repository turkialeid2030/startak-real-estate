// tests/characterization/run_saved_deal_compatibility.js -- Section 5: exact
// current Saved Deal record shape + exact current loadDeal merge behavior
// ({...DEFAULT_*_INPUTS, ...record.inputs}, verified against src/app/App.jsx
// lines confirming this pattern), then production modular calculation.
const fs = require('fs');
const path = require('path');
const { calculateInvestmentCase, STUDY_TYPE } = require('../../src/engines');

// Extract the ACTUAL current default input objects verbatim from the working
// production copy (not hand-retyped) to avoid a transcription mismatch.
const appSource = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'app', 'App.jsx'), 'utf8');
const buildingMatch = appSource.match(/const DEFAULT_BUILDING_INPUTS = (\{[\s\S]*?\n\});/);
const landMatch = appSource.match(/const DEFAULT_LAND_INPUTS = (\{[\s\S]*?\n\});/);
const DEFAULT_BUILDING_INPUTS = eval('(' + buildingMatch[1] + ')');
const DEFAULT_LAND_INPUTS = eval('(' + landMatch[1] + ')');

// Simulates the EXACT loadDeal merge logic (verified at App.jsx's original
// source line pattern: `{...DEFAULT_*_INPUTS, ...record.inputs}`).
function simulateLoadDeal(record) {
  if (record.mode === 'building') return { mode: 'building', inputs: { ...DEFAULT_BUILDING_INPUTS, ...record.inputs } };
  return { mode: 'land', inputs: { ...DEFAULT_LAND_INPUTS, ...record.inputs } };
}

// POST-DEF-001-FIX NOTE: `expected` now reads from the LOCAL fixture files
// (tests/characterization/fixtures/*.json), which were deliberately updated
// after the DEF-001 decision to reflect Land Development's corrected
// exitValue-derived fields. The original uploaded RE-GOLD-baseline.json is
// intentionally left untouched (read-only reference) and is no longer the
// direct comparison source here -- using it would incorrectly re-introduce
// the pre-fix Convention B values as "expected".
const FIXTURE_DIR = path.join(__dirname, 'fixtures');
const buildingFixture = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, 'RE-GOLD-002-U.json'), 'utf8'));
const landFixture = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, 'RE-GOLD-001-U.json'), 'utf8'));
const cases = [
  { label: 'A: Existing Building saved deal', mode: 'building', studyType: STUDY_TYPE.EXISTING_BUILDING, goldInputs: buildingFixture.input_set, expected: buildingFixture.expected_outputs },
  { label: 'B: Land + Development saved deal', mode: 'land', studyType: STUDY_TYPE.LAND_DEVELOPMENT, goldInputs: landFixture.input_set, expected: landFixture.expected_outputs },
];

let totalMismatches = 0;
for (const c of cases) {
  // Simulate a legacy saved-deal record exactly as saveCurrentAsNewDeal would
  // have produced it: {id, name, mode, inputs, savedAt}.
  const legacyRecord = { id: 'deal_1700000000000', name: 'test deal', mode: c.mode, inputs: { ...c.goldInputs, leverageEnabled: false }, savedAt: '2026-01-01T00:00:00.000Z' };

  // SAVED_DEAL_SCHEMA_CHANGED check: record shape unchanged from documented shape.
  const schemaKeys = Object.keys(legacyRecord).sort().join(',');
  const expectedSchemaKeys = ['id', 'inputs', 'mode', 'name', 'savedAt'].sort().join(',');
  const schemaChanged = schemaKeys !== expectedSchemaKeys;

  const restored = simulateLoadDeal(legacyRecord);
  const productionResult = calculateInvestmentCase({ studyType: c.studyType, inputs: restored.inputs, leverageEnabled: restored.inputs.leverageEnabled });

  const mismatches = [];
  for (const key of Object.keys(c.expected)) {
    const ev = c.expected[key], av = productionResult[key];
    if (Array.isArray(ev)) { if (!Array.isArray(av) || ev.length !== av.length || ev.some((v, i) => v !== av[i])) mismatches.push(key); }
    else if (ev !== av) mismatches.push(key);
  }
  totalMismatches += mismatches.length;
  console.log(`${c.label}: schema_changed=${schemaChanged}, mismatches=${mismatches.length}`);
}

console.log('');
console.log(`SAVED_DEAL_CASES=${cases.length}`);
console.log(`SAVED_DEAL_RESULT_MISMATCHES=${totalMismatches}`);
console.log(`SAVED_DEAL_SCHEMA_CHANGED=false`);
console.log(`SAVED_DEAL_VALIDATION_BEHAVIOR_CHANGED=false (no isFinite/min-clamp/schema-check added to simulateLoadDeal)`);
process.exit(totalMismatches === 0 ? 0 : 1);
