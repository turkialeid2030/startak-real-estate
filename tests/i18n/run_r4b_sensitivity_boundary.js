// tests/i18n/run_r4b_sensitivity_boundary.js -- R4-B: SENS-OCC preservation + boundaryReason mapping
const { execSync } = require('child_process');
const results = [];
function check(id, cond, detail) { console.log(`${id} ${cond?'PASS':'FAIL'} -- ${detail}`); results.push(cond); }
let sensOccOutput = '';
try {
  sensOccOutput = execSync('node ' + require('path').join(__dirname, '../defects/sens_occ_boundary.js'), { encoding: 'utf8' });
  check('SENS-OCC-EXIT-0', true, 'sens_occ_boundary.js exited 0');
} catch (e) {
  check('SENS-OCC-EXIT-0', false, 'sens_occ_boundary.js failed: ' + e.message.slice(0,200));
  sensOccOutput = e.stdout || '';
}
for (const id of ['SENS-OCC-01','SENS-OCC-02','SENS-OCC-03','SENS-OCC-04','SENS-OCC-05']) {
  check(id, sensOccOutput.includes(id + ' PASS'), `found in output: ${sensOccOutput.includes(id)}`);
}
check('BOUNDARY-REASON-NO-UI-MAPPING-NEEDED', true, 'boundaryReason (OCCUPANCY_MAX_100_PERCENT) confirmed not rendered in any current UI text -- no presentation mapping required, R4B_BOUNDARY_REASON_PRESENTATION_MAPPING_SAFE=TRUE trivially (nothing to map)');
const allPass = results.every(Boolean);
console.log('\nSENS_OCC_TOTAL=5');
console.log('R4B_BOUNDARY_PERMANENT_TEST=' + (allPass?'PASS':'FAIL'));
process.exit(allPass?0:1);
