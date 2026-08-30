const fs = require('fs'), path = require('path');
const results = []; function check(id,c,d){console.log(`${id} ${c?'PASS':'FAIL'} -- ${d}`);results.push(c);}
const appSrc = fs.readFileSync(path.join(__dirname,'../..','src/app/App.jsx'),'utf8');
check('DEFAULT-NAME-LITERAL-UNCHANGED', appSrc.includes('name: existing ? existing.name : "صفقة"'), 'persisted default literal unchanged');
check('DISPLAY-FN-USED', appSrc.includes('getDealDisplayName(d, t)'), 'presentation wrapper still in use');
check('BUILTIN-IDS-LOCALE-NEUTRAL', appSrc.includes('onLoadBuiltIn("building")') && appSrc.includes('onLoadBuiltIn("land")'), 'fixed English literals regardless of UI locale');
const allPass = results.every(Boolean);
console.log('\nRUN_R6E_SAVED_DEALS_INTEGRATION=' + (allPass?'PASS':'FAIL'));
process.exit(allPass?0:1);
