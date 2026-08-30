const { execFileSync } = require('child_process');
const path = require('path');
const results = [];
function check(id, cond, detail) { console.log(`${id} ${cond?'PASS':'FAIL'} -- ${detail}`); results.push(cond); }
for (const f of ['run_sdi001_schema_validation.js', 'run_sdi002_invalid_save_block.js', 'run_sdi002_invalid_update_block.js', 'run_sdi002_recovery.js', 'run_sdi002_real_browser_path.js']) {
  try { execFileSync('node', [path.join(__dirname, f)], { stdio: 'pipe' }); check(f, true, 'exit 0'); }
  catch (e) { check(f, false, 'non-zero exit'); }
}
const allPass = results.every(Boolean);
console.log('\nRUN_SDI002_FULL_CLOSURE=' + (allPass?'PASS':'FAIL'));
process.exit(allPass?0:1);
