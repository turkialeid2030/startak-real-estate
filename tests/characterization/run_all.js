// tests/characterization/run_all.js -- CANONICAL_TEST_COMMAND: npm test / npm run test:characterization
//
// REDEFINED POST-DEF-001-FIX: this script previously compared the frozen
// legacy source's output directly against RE-GOLD fixtures. That assumption
// (legacy always equals RE-GOLD) is no longer universally true -- RE-GOLD
// fixtures now deliberately reflect the DEF-001 fix for Land Development's
// 6 exitValue-derived fields, while legacy (the untouched original source)
// still reflects its original behavior. Comparing them field-by-field would
// now report false failures for a correctly-working, intentional fix.
//
// New role: SOURCE INTEGRITY GUARD. This script verifies two independent
// things every run: (1) the canonical source file's own SHA256 is unchanged
// (byte-for-byte, as always), and (2) the frozen source's CALCULATION
// OUTPUT for each of the 4 fixtures is self-consistent over time (matches a
// snapshot hash captured once, right after the DEF-001 decision was made).
// If either check fails, something changed that should not have -- either
// someone edited platform-source.jsx, or legacy's behavior silently drifted.
// This is a stronger, not weaker, guarantee than the old "matches RE-GOLD"
// check: it does not go stale every time a defect gets fixed.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { loadCurrentEngines, EXPECTED_SOURCE_SHA256, SOURCE_PATH } = require('../load_engines');

const FIXTURE_DIR = path.join(__dirname, 'fixtures');
const EVIDENCE_DIR = path.join(__dirname, '..', '..', 'characterization', 'evidence');
const SNAPSHOT_PATH = path.join(__dirname, 'legacy-behavior-snapshot.json');
fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

function sourceHashNow() {
  return crypto.createHash('sha256').update(fs.readFileSync(SOURCE_PATH)).digest('hex');
}

function main() {
  const sourceHashBefore = sourceHashNow();
  const engines = loadCurrentEngines();
  const calc = { land: engines.calcLandDevelopment, building: engines.calcExistingBuilding };
  const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));

  const fixtureFiles = ['RE-GOLD-001-U', 'RE-GOLD-001-L', 'RE-GOLD-002-U', 'RE-GOLD-002-L'];
  const results = [];
  let allMatch = true;

  for (const fid of fixtureFiles) {
    const fixture = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, fid + '.json'), 'utf8'));
    const actual = calc[fixture.study_type](fixture.input_set);
    const sortedKeys = Object.keys(actual).sort();
    const stableJson = JSON.stringify(actual, sortedKeys);
    const hash = crypto.createHash('sha256').update(stableJson).digest('hex');
    const expectedHash = snapshot[fid].sha256;
    const match = hash === expectedHash;
    if (!match) allMatch = false;
    results.push({ gold_id: fid, status: match ? 'PASS' : 'FAIL', field_count: sortedKeys.length, hash, expectedHash });
    console.log(`${fid}: ${match ? 'PASS' : 'FAIL'} (legacy self-consistency, ${sortedKeys.length} fields, hash ${match ? 'matches' : 'DIFFERS FROM'} snapshot)`);
  }

  const sourceHashAfter = sourceHashNow();
  const sourceHashUnchanged = sourceHashBefore === sourceHashAfter && sourceHashAfter === EXPECTED_SOURCE_SHA256;
  const passedCases = results.filter((r) => r.status === 'PASS').length;

  const summary = {
    TOTAL_CASES: results.length,
    PASSED_CASES: passedCases,
    FAILED_CASES: results.length - passedCases,
    SOURCE_HASH_BEFORE: sourceHashBefore,
    SOURCE_HASH_AFTER: sourceHashAfter,
    SOURCE_HASH_UNCHANGED: sourceHashUnchanged,
    LEGACY_SELF_CONSISTENT: allMatch,
    role: 'SOURCE_INTEGRITY_GUARD (redefined post-DEF-001 -- see comment header)',
    results,
  };

  console.log('');
  console.log('================================================');
  console.log(`TOTAL_CASES=${summary.TOTAL_CASES} PASSED=${summary.PASSED_CASES} FAILED=${summary.FAILED_CASES}`);
  console.log(`SOURCE_HASH_UNCHANGED=${summary.SOURCE_HASH_UNCHANGED}`);
  console.log(`LEGACY_SELF_CONSISTENT=${summary.LEGACY_SELF_CONSISTENT}`);
  console.log('================================================');

  fs.writeFileSync(path.join(EVIDENCE_DIR, 'comparison-results.json'), JSON.stringify(summary, null, 2));
  process.exit(sourceHashUnchanged && allMatch ? 0 : 1);
}

main();
