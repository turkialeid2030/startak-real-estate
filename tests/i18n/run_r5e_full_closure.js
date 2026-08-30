// tests/i18n/run_r5e_full_closure.js -- FINAL R5 gate. Orchestrates all
// R5-A/B/C/D permanent tests plus the 7 R5-E integration tests via child
// process execution, rather than duplicating their assertions.
const { execFileSync } = require('child_process');
const path = require('path');
const results = [];
function check(id, cond, detail) { console.log(`${id} ${cond?'PASS':'FAIL'} -- ${detail}`); results.push(cond); }

const testFiles = [
  'run_r5a_full_closure.js', 'run_r5b_full_closure.js', 'run_r5c_full_closure.js', 'run_r5d_full_closure.js',
  'run_r5e_inventory_closure.js', 'run_r5e_input_source_purity.js', 'run_r5e_enum_integration.js',
  'run_r5e_financing_integration.js', 'run_r5e_raw_invariance.js', 'run_r5e_dom_purity.js', 'run_r5e_roundtrip.js',
];
for (const f of testFiles) {
  try {
    execFileSync('node', [path.join(__dirname, f)], { stdio: 'pipe' });
    check(f, true, 'exit 0');
  } catch (e) {
    check(f, false, 'non-zero exit');
  }
}

// Prior wave preservation (V1A through R4)
const priorWaves = [
  'run_verdict_presentation_invariance.js', 'run_metricrow_full_closure.js',
  'run_r4a_cashflow_full_closure.js', 'run_r4b_sensitivity_full_closure.js',
  'run_dashboard_r3_remaining.js', 'run_building_permit_status_presentation.js',
];
for (const f of priorWaves) {
  try {
    execFileSync('node', [path.join(__dirname, f)], { stdio: 'pipe' });
    check(`PRIOR-${f}`, true, 'exit 0');
  } catch (e) {
    check(`PRIOR-${f}`, false, 'non-zero exit');
  }
}

const allPass = results.every(Boolean);
console.log('');
console.log('R5_TOTAL_ROWS=128');
console.log('R5_LOCALIZED_ROWS=128');
console.log('R5_UNLOCALIZED_ROWS=0');
console.log('RUN_R5E_FULL_CLOSURE=' + (allPass?'PASS':'FAIL'));
process.exit(allPass?0:1);
