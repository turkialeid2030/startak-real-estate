const { execFileSync } = require('child_process');
const path = require('path');
const results = []; function check(id,c,d){console.log(`${id} ${c?'PASS':'FAIL'} -- ${d}`);results.push(c);}
for (const f of ['run_r6b_malformed_saved_deal_real_path.js','run_r6d_building_update_delete_real_path.js']) {
  try { execFileSync('node',[path.join(__dirname,f)],{stdio:'pipe'}); check(f,true,'exit 0'); }
  catch(e){ check(f,false,'non-zero exit'); }
}
const allPass = results.every(Boolean);
console.log('\nRUN_R6E_PERSISTENCE_INTEGRATION=' + (allPass?'PASS':'FAIL'));
process.exit(allPass?0:1);
