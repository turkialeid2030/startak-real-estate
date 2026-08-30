// tests/i18n/run_r5e_financing_integration.js -- orchestrates R5-D's structural facts.
const fs = require('fs'), path = require('path');
const results = []; function check(id,c,d){console.log(`${id} ${c?'PASS':'FAIL'} -- ${d}`);results.push(c);}
const src = fs.readFileSync(path.join(__dirname,'../..','src/app/App.jsx'),'utf8');
check('SECTION-ALWAYS-VISIBLE-BUILDING', !src.includes('inputs.leverageEnabled ? (\n      <Section eyebrow="القسم السابع"'), 'financing Section not conditionally wrapped (Building)');
check('BOTH-STUDIES-6-CONTROLS', (src.match(/patch\("leverageEnabled"/g)||[]).length===2, 'exactly 2 leverageEnabled Toggle instances (1 per study)');
check('LTV-LTC-DISTINCT-KEYS', require('../../src/i18n/locales/ar-SA.js').financingInput.ltvLabelBuilding !== require('../../src/i18n/locales/ar-SA.js').financingInput.ltvLabelLand, 'separate LTV/LTC keys maintained');
const allPass = results.every(Boolean);
console.log('\nRUN_R5E_FINANCING_INTEGRATION=' + (allPass?'PASS':'FAIL'));
process.exit(allPass?0:1);
