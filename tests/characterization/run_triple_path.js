// tests/characterization/run_triple_path.js -- Section 12: Legacy vs Gold, Modular
// (via the production entrypoint) vs Gold, Legacy vs Modular -- all three, all 4 fixtures.
const fs = require('fs');
const path = require('path');
const { loadCurrentEngines } = require('../load_engines');
const { calculateInvestmentCase, STUDY_TYPE } = require('../../src/engines');

const FIXTURE_DIR = path.join(__dirname, 'fixtures');
const legacy = loadCurrentEngines();
const legacyCalc = { land: legacy.calcLandDevelopment, building: legacy.calcExistingBuilding };
const studyTypeMap = { land: STUDY_TYPE.LAND_DEVELOPMENT, building: STUDY_TYPE.EXISTING_BUILDING };

function compare(expected, actual, prefix, out) {
  let n = 0;
  for (const key of Object.keys(expected)) {
    n++;
    const ev = expected[key], av = actual[key];
    if (Array.isArray(ev)) {
      if (!Array.isArray(av) || ev.length !== av.length) { out.push(`${prefix}${key}: array shape`); continue; }
      for (let i = 0; i < ev.length; i++) if (ev[i] !== av[i]) out.push(`${prefix}${key}[${i}]`);
    } else if (ev !== av) out.push(`${prefix}${key}: expected=${ev} actual=${av}`);
  }
  return n;
}

const fixtureFiles = ['RE-GOLD-001-U', 'RE-GOLD-001-L', 'RE-GOLD-002-U', 'RE-GOLD-002-L'];
let legacyVsGold = 0, modularVsGold = 0, legacyVsModular = 0, totalFields = 0;

for (const fid of fixtureFiles) {
  const fixture = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, fid + '.json'), 'utf8'));
  const legacyResult = legacyCalc[fixture.study_type](fixture.input_set);
  const modularResult = calculateInvestmentCase({ studyType: studyTypeMap[fixture.study_type], inputs: fixture.input_set, leverageEnabled: fixture.input_set.leverageEnabled });

  const m1 = [], m2 = [], m3 = [];
  const n = compare(fixture.expected_outputs, legacyResult, `${fid}.legacy.`, m1);
  compare(fixture.expected_outputs, modularResult, `${fid}.modular.`, m2);
  compare(legacyResult, modularResult, `${fid}.legacyVsModular.`, m3);

  totalFields += n; legacyVsGold += m1.length; modularVsGold += m2.length; legacyVsModular += m3.length;
  console.log(`${fid}: legacyVsGold=${m1.length} modularVsGold=${m2.length} legacyVsModular=${m3.length}`);
}

console.log('');
console.log(`TOTAL_COMPARED_FIELDS=${totalFields}`);
console.log(`LEGACY_VS_GOLD_MISMATCHES=${legacyVsGold}`);
console.log(`MODULAR_VS_GOLD_MISMATCHES=${modularVsGold}`);
console.log(`LEGACY_VS_MODULAR_MISMATCHES=${legacyVsModular}`);
// POST-DEF-001-FIX NOTE: legacyVsGold and legacyVsModular are now EXPECTED to
// differ for Land Development's 6 exitValue-derived fields (cashflows, irr,
// npv, leveredCashflows, leveredIRR, leveredNPV) -- this is the deliberate,
// decided outcome of DEF-001 remediation (Land Development standardized on
// Convention A to match Existing Building). The canonical modular engine
// (src/engines/) is the one that must match the (updated) Golden fixtures --
// modularVsGold=0 is the real pass condition. legacy (the frozen, never-
// touched original source) intentionally still reflects the pre-fix
// behavior and is expected to diverge for these specific fields. See
// DECISION-DEF-001/ for the full rationale.
// POST-DEF-001-FINAL-DECISION (D6): both studies now use Forward NOI Cap, so
// legacy and modular are expected to match exactly again (D4's temporary
// divergence was reverted) -- log the actual state, not a fixed assumption.
if (legacyVsGold === 0) {
  console.log(`LEGACY_VS_GOLD_STATUS=MATCH (both studies on Forward NOI Cap post-D6 -- no deliberate divergence currently in effect, see DECISION-DEF-001/)`);
} else {
  console.log(`LEGACY_VS_GOLD_STATUS=DIVERGENT (${legacyVsGold} mismatches) -- unexpected; investigate before treating as a DEF-001-related divergence`);
}
process.exit(modularVsGold === 0 ? 0 : 1);
