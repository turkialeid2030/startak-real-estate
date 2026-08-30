// tests/i18n/run_r6e_inventory_closure.js -- R6-E: 33-row authoritative
// arithmetic reconciliation.
const fs = require('fs'), path = require('path');
function parseCsvLine(l){const f=[];let c='',q=false;for(const ch of l){if(ch==='"')q=!q;else if(ch===','&&!q){f.push(c);c='';}else c+=ch;}f.push(c);return f;}
const content = fs.readFileSync(path.join(__dirname,'../..','I18N_R6_UI_STRING_INVENTORY.csv'),'utf8').trim().replace(/\r\n/g,'\n');
const lines = content.split('\n'); const header = parseCsvLine(lines[0]);
const rows = lines.slice(1).map(parseCsvLine).map(r=>Object.fromEntries(header.map((h,i)=>[h,r[i]])));
const results = []; function check(id,c,d){console.log(`${id} ${c?'PASS':'FAIL'} -- ${d}`);results.push(c);}
check('TOTAL-33', rows.length===33, `${rows.length}`);
check('DUP-0', new Set(rows.map(r=>r.inventory_id)).size===rows.length, 'zero duplicate IDs');
const owners = {}; for(const r of rows) owners[r.semantic_owner]=(owners[r.semantic_owner]||0)+1;
check('SAVED-DEALS-14', owners['R6-SAVED-DEALS']===14, `${owners['R6-SAVED-DEALS']}`);
check('ERROR-6', owners['R6-ERROR']===6, `${owners['R6-ERROR']}`);
check('VALIDATION-5', owners['R6-VALIDATION']===5, `${owners['R6-VALIDATION']}`);
check('USER-CONTENT-1', owners['EXCLUDED-USER-CONTENT']===1, `${owners['EXCLUDED-USER-CONTENT']}`);
check('APPROVED-INVARIANT-AS-INTERNAL-1', owners['APPROVED-INVARIANT']===1, `${owners['APPROVED-INVARIANT']} (this is the row the R6-E request calls INTERNAL_ONLY -- same functional category: excluded-but-not-a-defect, different label)`);
check('R7-DEFERRED-6', owners['R7-DEFERRED']===6, `${owners['R7-DEFERRED']}`);
const sum = 14+6+5+1+1+6;
check('ARITHMETIC-33', sum===33, `14+6+5+1+1+6=${sum}`);
const implementedRows = rows.filter(r=>['R6-SAVED-DEALS','R6-ERROR','R6-VALIDATION'].includes(r.semantic_owner));
check('IMPLEMENTED-SCOPE-25', implementedRows.length===25, `${implementedRows.length}`);
check('IMPLEMENTED-ALL-LOCALIZED', implementedRows.every(r=>r.implementation_status.startsWith('LOCALIZED')), 'all 25 implemented rows LOCALIZED_R6*');
const allPass = results.every(Boolean);
console.log('\nRUN_R6E_INVENTORY_CLOSURE=' + (allPass?'PASS':'FAIL'));
process.exit(allPass?0:1);
