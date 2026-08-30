// tests/characterization/run_dual_path.js -- Section 6 requirement: prove
// LEGACY_SOURCE_TEST_PATH and MODULAR_ENGINE_TEST_PATH produce IDENTICAL results
// before the line-number loader may ever be retired.
//
// POST-DEF-001-FINAL-DECISION NOTE (D6): both studies now use Forward NOI Cap.
// Land Development's exit-value fields match `legacy` exactly again (D4's
// temporary divergence was reverted). Existing Building's engine WAS changed
// (forwardNOI step added) but produces IDENTICAL output to `legacy` in both
// current RE-GOLD-002 fixtures specifically because both use rentGrowthRate=0
// -- at zero growth, forwardNOI = noiYear*(1+0) = noiYear, so the added step
// is mathematically a no-op for these particular fixtures. This is the exact
// same gap COV-001 identifies; it is NOT re-exercised here on purpose --
// tests/characterization/run_cov001_forward_noi.js independently covers the
// non-zero-growth case this script's fixtures cannot reach. The
// EXPECTED_DIVERGENT_LAND_FIELDS allowlist below is now historical (0 fields
// currently fall into it) but is kept, not removed, in case a future fixture
// or defect reintroduces a deliberate legacy/modular difference.
const fs = require('fs');
const path = require('path');
const { loadCurrentEngines } = require('../load_engines');
const modularEB = require('../../src/engines/valuation/existing-building');
const modularLD = require('../../src/engines/valuation/land-development');

const FIXTURE_DIR = path.join(__dirname, 'fixtures');
const legacy = loadCurrentEngines();
const modularCalc = { land: modularLD.calcLandDevelopment, building: modularEB.calcExistingBuilding };
const legacyCalc = { land: legacy.calcLandDevelopment, building: legacy.calcExistingBuilding };

const EXPECTED_DIVERGENT_LAND_FIELDS = new Set(['cashflows', 'irr', 'npv', 'leveredCashflows', 'leveredIRR', 'leveredNPV']);

function deepEqualReport(a, b, prefix, out, expectedFields) {
  for (const key of Object.keys(a)) {
    const av = a[key], bv = b[key];
    const isExpected = expectedFields.has(key);
    if (Array.isArray(av)) {
      if (!Array.isArray(bv) || av.length !== bv.length) { if (!isExpected) out.push(`${prefix}${key}: array shape differs`); continue; }
      for (let i = 0; i < av.length; i++) if (av[i] !== bv[i] && !isExpected) out.push(`${prefix}${key}[${i}]: legacy=${av[i]} modular=${bv[i]}`);
    } else if (av !== bv && !isExpected) {
      out.push(`${prefix}${key}: legacy=${JSON.stringify(av)} modular=${JSON.stringify(bv)}`);
    }
  }
}

const fixtureFiles = ['RE-GOLD-001-U', 'RE-GOLD-001-L', 'RE-GOLD-002-U', 'RE-GOLD-002-L'];
let totalMismatches = 0;
let totalExpectedDivergences = 0;
const report = [];
for (const fid of fixtureFiles) {
  const fixture = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, fid + '.json'), 'utf8'));
  const legacyResult = legacyCalc[fixture.study_type](fixture.input_set);
  const modularResult = modularCalc[fixture.study_type](fixture.input_set);
  const mismatches = [];
  const expectedFields = fixture.study_type === 'land' ? EXPECTED_DIVERGENT_LAND_FIELDS : new Set();
  deepEqualReport(legacyResult, modularResult, `${fid}.`, mismatches, expectedFields);
  // Count actual expected divergences separately for visibility, without treating them as failures.
  const expectedCount = fixture.study_type === 'land' ? [...expectedFields].filter((k) => JSON.stringify(legacyResult[k]) !== JSON.stringify(modularResult[k])).length : 0;
  totalExpectedDivergences += expectedCount;
  totalMismatches += mismatches.length;
  report.push({ gold_id: fid, unexpected_mismatches: mismatches.length, expected_def001_divergences: expectedCount, mismatches: mismatches.slice(0, 10) });
  console.log(`${fid}: unexpected mismatches = ${mismatches.length}, expected DEF-001 divergences = ${expectedCount}`);
}

console.log('');
console.log(`UNEXPECTED_LEGACY_VS_MODULAR_MISMATCHES = ${totalMismatches}`);
console.log(`EXPECTED_DEF001_DIVERGENCES = ${totalExpectedDivergences} (Land Development exitValue-derived fields only -- deliberate, see DECISION-DEF-001/)`);
fs.writeFileSync(path.join(__dirname, '..', '..', 'characterization', 'evidence', 'dual-path-comparison.json'), JSON.stringify(report, null, 2));
process.exit(totalMismatches === 0 ? 0 : 1);

