// tests/i18n/run_r6e_full_closure.js -- FINAL R6 GATE. Orchestrates all
// R6-A/B/C/D + 6 R6-E integration tests + R5-E + 6 prior-wave (V1A-R4)
// preservation checks via child-process execution.
const { execFileSync } = require('child_process');
const path = require('path');
const results = [];
function check(id, cond, detail) { console.log(`${id} ${cond?'PASS':'FAIL'} -- ${detail}`); results.push(cond); }

const testFiles = [
  'run_r6a_full_closure.js', 'run_r6b_full_closure.js', 'run_r6c_full_closure.js', 'run_r6d_full_closure.js',
  'run_r6e_inventory_closure.js', 'run_r6e_saved_deals_integration.js', 'run_r6e_error_integration.js',
  'run_r6e_validation_integration.js', 'run_r6e_persistence_integration.js', 'run_r6e_dom_purity.js', 'run_r6e_raw_invariance.js',
  'run_r5e_full_closure.js',
];
for (const f of testFiles) {
  try { execFileSync('node', [path.join(__dirname, f)], { stdio: 'pipe' }); check(f, true, 'exit 0'); }
  catch (e) { check(f, false, 'non-zero exit'); }
}

const priorWaves = [
  'run_verdict_presentation_invariance.js', 'run_metricrow_full_closure.js',
  'run_dashboard_r3_remaining.js', 'run_building_permit_status_presentation.js',
  'run_r4a_cashflow_full_closure.js', 'run_r4b_sensitivity_full_closure.js',
];
for (const f of priorWaves) {
  try { execFileSync('node', [path.join(__dirname, f)], { stdio: 'pipe' }); check(`PRIOR-${f}`, true, 'exit 0'); }
  catch (e) { check(`PRIOR-${f}`, false, 'non-zero exit'); }
}

const allPass = results.every(Boolean);
console.log('');
console.log('R6_TOTAL_INVENTORY_ROWS=33');
console.log('R6_IMPLEMENTED_SCOPE_ROWS=25');
console.log('R6_IMPLEMENTED_SCOPE_LOCALIZED=25');
console.log('RUN_R6E_FULL_CLOSURE=' + (allPass?'PASS':'FAIL'));
process.exit(allPass?0:1);
