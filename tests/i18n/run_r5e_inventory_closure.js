// tests/i18n/run_r5e_inventory_closure.js -- orchestrates: reads master CSV once, proves 128/128.
const fs = require('fs'), path = require('path');
function parseCsvLine(l){const f=[];let c='',q=false;for(const ch of l){if(ch==='"')q=!q;else if(ch===','&&!q){f.push(c);c='';}else c+=ch;}f.push(c);return f;}
const content = fs.readFileSync(path.join(__dirname,'../..','I18N_R5_INPUT_PANELS_INVENTORY.csv'),'utf8').trim().replace(/\r\n/g,'\n');
const lines = content.split('\n'); const header = parseCsvLine(lines[0]);
const rows = lines.slice(1).map(parseCsvLine).map(r=>Object.fromEntries(header.map((h,i)=>[h,r[i]])));
const results = []; function check(id,c,d){console.log(`${id} ${c?'PASS':'FAIL'} -- ${d}`);results.push(c);}
check('TOTAL-128', rows.length===128, `${rows.length}`);
check('DUP-0', new Set(rows.map(r=>r.id)).size===rows.length, 'zero duplicate IDs');
const waveCounts = {}; for(const r of rows) waveCounts[r.wave_id]=(waveCounts[r.wave_id]||0)+1;
check('WAVE-A-55', waveCounts['R5-A']===55, `${waveCounts['R5-A']}`);
check('WAVE-B-45', waveCounts['R5-B']===45, `${waveCounts['R5-B']}`);
check('WAVE-C-7', waveCounts['R5-C']===7, `${waveCounts['R5-C']}`);
check('WAVE-D-21', waveCounts['R5-D']===21, `${waveCounts['R5-D']}`);
check('ALL-LOCALIZED', rows.every(r=>r.implementation_status.startsWith('LOCALIZED')), 'all 128 rows LOCALIZED_R5*');
check('UNASSIGNED-0', rows.every(r=>['R5-A','R5-B','R5-C','R5-D'].includes(r.wave_id)), 'zero unassigned wave_id');
const allPass = results.every(Boolean);
console.log('\nRUN_R5E_INVENTORY_CLOSURE=' + (allPass?'PASS':'FAIL'));
process.exit(allPass?0:1);
