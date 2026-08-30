// tests/i18n/run_r5e_input_source_purity.js -- whole-panel hardcoded-text scan.
const fs = require('fs'), path = require('path');
const results = []; function check(id,c,d){console.log(`${id} ${c?'PASS':'FAIL'} -- ${d}`);results.push(c);}
const src = fs.readFileSync(path.join(__dirname,'../..','src/app/App.jsx'),'utf8');
const buildingPanel = src.split('function BuildingInputPanel')[1].split('function LandInputPanel')[0];
const landPanel = src.split('function LandInputPanel')[1].split('function ModeSwitch')[0];
for (const [name, panel] of [['BUILDING', buildingPanel], ['LAND', landPanel]]) {
  const hc = (panel.match(/(?:label|note|warnText)="[^"]*[\u0600-\u06FF][^"]*"/g) || []).length;
  check(`${name}-ZERO-HARDCODED-ARABIC`, hc===0, `${hc} remaining`);
}
const allPass = results.every(Boolean);
console.log('\nRUN_R5E_INPUT_SOURCE_PURITY=' + (allPass?'PASS':'FAIL'));
process.exit(allPass?0:1);
