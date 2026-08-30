// One-time (or explicitly re-run) snapshot of legacy's own current output,
// used going forward as the self-referential baseline for run_all.js.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { loadCurrentEngines } = require('../tests/load_engines');

const FIXTURE_DIR = path.join(__dirname, '..', 'tests', 'characterization', 'fixtures');
const fixtureFiles = ['RE-GOLD-001-U', 'RE-GOLD-001-L', 'RE-GOLD-002-U', 'RE-GOLD-002-L'];
const engines = loadCurrentEngines();
const calc = { land: engines.calcLandDevelopment, building: engines.calcExistingBuilding };

const snapshot = {};
for (const fid of fixtureFiles) {
  const fixture = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, fid + '.json'), 'utf8'));
  const actual = calc[fixture.study_type](fixture.input_set);
  const sortedKeys = Object.keys(actual).sort();
  const stableJson = JSON.stringify(actual, sortedKeys);
  const hash = crypto.createHash('sha256').update(stableJson).digest('hex');
  snapshot[fid] = { sha256: hash, field_count: sortedKeys.length };
}
snapshot._meta = {
  created: new Date().toISOString(),
  reason: "Baseline snapshot of the frozen legacy source's own output, captured after the DEF-001 decision. From this point forward, run_all.js verifies legacy's output is self-consistent over time (has not silently changed), rather than comparing it against RE-GOLD (which may now differ deliberately per resolved defects like DEF-001).",
};
fs.writeFileSync(path.join(__dirname, '..', 'tests', 'characterization', 'legacy-behavior-snapshot.json'), JSON.stringify(snapshot, null, 2));
console.log('Snapshot written:', JSON.stringify(snapshot, null, 2));
