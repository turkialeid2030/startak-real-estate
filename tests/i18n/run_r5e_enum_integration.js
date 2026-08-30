// tests/i18n/run_r5e_enum_integration.js -- orchestrates all 4 enum mappers together.
const { getLeaseStatusLabel, LEASE_STATUS_PRESENTATION_KEYS, getBuildingTypeLabel, BUILDING_TYPE_PRESENTATION_KEYS, getBuildingPermitStatusLabel, BUILDING_PERMIT_STATUS_PRESENTATION_KEYS, getFinancingStructureLabel, FINANCING_STRUCTURE_PRESENTATION_KEYS } = require('../../src/i18n/domain-presentation.js');
const arSA = require('../../src/i18n/locales/ar-SA.js'), en = require('../../src/i18n/locales/en.js');
function tF(d){return p=>p.split('.').reduce((o,k)=>o?.[k],d)??p;} const tAr=tF(arSA), tEn=tF(en);
const results = []; function check(id,c,d){console.log(`${id} ${c?'PASS':'FAIL'} -- ${d}`);results.push(c);}

const EXPECTED = {
  leaseStatus: ['مؤجر','3 أشهر','6 أشهر','9 أشهر','سنة'],
  buildingType: ['برج مكتبي','برج سكني','مبنى تجاري','استخدام مختلط'],
  buildingPermit: ['لم يُستخرج','قيد الإجراء','صادر'],
  financingStructure: ['مرابحة','إجارة منتهية بالتمليك'],
};
check('LEASE-RAW-MATCH', JSON.stringify(Object.keys(LEASE_STATUS_PRESENTATION_KEYS))===JSON.stringify(EXPECTED.leaseStatus), 'exact raw values + order');
check('BUILDINGTYPE-RAW-MATCH', JSON.stringify(Object.keys(BUILDING_TYPE_PRESENTATION_KEYS))===JSON.stringify(EXPECTED.buildingType), 'exact raw values + order');
check('PERMIT-RAW-MATCH', JSON.stringify(Object.keys(BUILDING_PERMIT_STATUS_PRESENTATION_KEYS))===JSON.stringify(EXPECTED.buildingPermit), 'exact raw values + order');
check('STRUCTURE-RAW-MATCH', JSON.stringify(Object.keys(FINANCING_STRUCTURE_PRESENTATION_KEYS))===JSON.stringify(EXPECTED.financingStructure), 'exact raw values + order');

let allMapped = 0, allGuarded = 0;
for (const [keys, getter] of [[LEASE_STATUS_PRESENTATION_KEYS,getLeaseStatusLabel],[BUILDING_TYPE_PRESENTATION_KEYS,getBuildingTypeLabel],[BUILDING_PERMIT_STATUS_PRESENTATION_KEYS,getBuildingPermitStatusLabel],[FINANCING_STRUCTURE_PRESENTATION_KEYS,getFinancingStructureLabel]]) {
  for (const raw of Object.keys(keys)) { if (getter(raw,tAr) && getter(raw,tEn) && getter(raw,tAr)!==getter(raw,tEn)) allMapped++; }
  try { getter('__UNKNOWN__', tAr); } catch(e) { allGuarded++; }
}
check('ALL-14-VALUES-MAPPED', allMapped === 5+4+3+2, `${allMapped}/14`);
check('ALL-4-GUARDS-THROW', allGuarded === 4, `${allGuarded}/4`);

const src = require('fs').readFileSync(require('path').join(__dirname,'../..','src/app/App.jsx'),'utf8');
check('SELECTFIELD-BACKWARD-COMPAT', src.includes('typeof o === "object"'), 'shared component supports both option forms');
check('PERMIT-COMPARISON-BYTE-IDENTICAL', src.includes('inputs.buildingPermitStatus === "صادر"'), 'unchanged');

const allPass = results.every(Boolean);
console.log('\nRUN_R5E_ENUM_INTEGRATION=' + (allPass?'PASS':'FAIL'));
process.exit(allPass?0:1);
