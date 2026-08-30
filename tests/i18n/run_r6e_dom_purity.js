const arSA = require('../../src/i18n/locales/ar-SA.js'), en = require('../../src/i18n/locales/en.js');
const results = []; function check(id,c,d){console.log(`${id} ${c?'PASS':'FAIL'} -- ${d}`);results.push(c);}
for (const section of ['savedDeals','validationDisclosure']) {
  const ak=Object.keys(arSA[section]), ek=Object.keys(en[section]);
  check(`PARITY-${section}`, JSON.stringify(ak.sort())===JSON.stringify(ek.sort()), `ar=${ak.length} en=${ek.length}`);
  check(`NO-BLANK-${section}`, Object.values(arSA[section]).every(v=>typeof v!=='string'||v.trim()) && Object.values(en[section]).every(v=>typeof v!=='string'||v.trim()), 'zero blank values');
}
const allPass = results.every(Boolean);
console.log('\nRUN_R6E_DOM_PURITY=' + (allPass?'PASS':'FAIL'));
process.exit(allPass?0:1);
