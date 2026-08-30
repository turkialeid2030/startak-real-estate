// tests/i18n/run_r5e_dom_purity.js -- orchestrates dictionary parity across all R5 sections.
const arSA = require('../../src/i18n/locales/ar-SA.js'), en = require('../../src/i18n/locales/en.js');
const results = []; function check(id,c,d){console.log(`${id} ${c?'PASS':'FAIL'} -- ${d}`);results.push(c);}
for (const section of ['inputBuilding','inputLand','financingInput']) {
  const arKeys = Object.keys(arSA[section]||{}), enKeys = Object.keys(en[section]||{});
  check(`PARITY-${section}`, JSON.stringify(arKeys.sort())===JSON.stringify(enKeys.sort()) && arKeys.length>0, `ar=${arKeys.length} en=${enKeys.length}`);
  const blankAr = Object.values(arSA[section]||{}).filter(v=>typeof v==='string'&&v.trim()==='').length;
  const blankEn = Object.values(en[section]||{}).filter(v=>typeof v==='string'&&v.trim()==='').length;
  check(`NO-BLANK-${section}`, blankAr===0 && blankEn===0, `blankAr=${blankAr} blankEn=${blankEn}`);
}
for (const enumSection of ['leaseStatus','buildingType','buildingPermitStatus']) {
  const arKeys = Object.keys(arSA.dashboardR3[enumSection]), enKeys = Object.keys(en.dashboardR3[enumSection]);
  check(`ENUM-PARITY-${enumSection}`, JSON.stringify(arKeys.sort())===JSON.stringify(enKeys.sort()), `ar=${arKeys.length} en=${enKeys.length}`);
}
const structAr = Object.keys(arSA.financingInput.structure), structEn = Object.keys(en.financingInput.structure);
check('ENUM-PARITY-financingStructure', JSON.stringify(structAr.sort())===JSON.stringify(structEn.sort()), `ar=${structAr.length} en=${structEn.length}`);
const allPass = results.every(Boolean);
console.log('\nRUN_R5E_DOM_PURITY=' + (allPass?'PASS':'FAIL'));
process.exit(allPass?0:1);
