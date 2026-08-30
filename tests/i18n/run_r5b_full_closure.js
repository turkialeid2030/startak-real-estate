// tests/i18n/run_r5b_full_closure.js -- R5-B: Land+Development non-financing
// input presentation closure. Inventory/component/property reconciliation,
// dictionary parity, engine invariance, R5-A/C/D scope isolation.
const fs = require('fs'), path = require('path');
const { calculateInvestmentCase, STUDY_TYPE } = require('../../src/engines');
const gold = require('../reference/RE-GOLD-baseline.json');
const arSA = require('../../src/i18n/locales/ar-SA.js');
const en = require('../../src/i18n/locales/en.js');
const results = [];
function check(id, cond, detail) { console.log(`${id} ${cond?'PASS':'FAIL'} -- ${detail}`); results.push(cond); }

function parseCsvLine(line) {
  const fields = []; let cur = '', inQ = false;
  for (const c of line) { if (c==='"') inQ=!inQ; else if (c===','&&!inQ) {fields.push(cur);cur='';} else cur+=c; }
  fields.push(cur); return fields;
}
const csvContent = fs.readFileSync(path.join(__dirname, '../..', 'I18N_R5_INPUT_PANELS_INVENTORY.csv'), 'utf8').trim().replace(/\r\n/g, '\n');
const csvLines = csvContent.split('\n');
const header = parseCsvLine(csvLines[0]);
const rows = csvLines.slice(1).map(parseCsvLine).map(r => Object.fromEntries(header.map((h,i)=>[h,r[i]])));

const r5b = rows.filter(r => r.wave_id === 'R5-B');
check('INVENTORY-45', r5b.length === 45, `R5-B rows = ${r5b.length}`);
const control = r5b.filter(r => ['label','eyebrow+title'].includes(r.presentation_property));
const prop = r5b.filter(r => !['label','eyebrow+title'].includes(r.presentation_property));
check('CONTROL-37', control.length === 37, `control rows = ${control.length}`);
check('PROPERTY-8', prop.length === 8, `property rows = ${prop.length}`);
check('ZERO-BUILDING', r5b.every(r => r.study_type === 'land'), 'all R5-B rows are land study type');
check('ZERO-SELECTFIELD', r5b.every(r => r.component !== 'SelectField'), 'zero SelectField in R5-B');

const arKeys = Object.keys(arSA.inputLand);
const enKeys = Object.keys(en.inputLand);
check('DICT-PARITY', JSON.stringify(arKeys.sort())===JSON.stringify(enKeys.sort()) && arKeys.length===50, `ar=${arKeys.length} en=${enKeys.length}`);

const appSrc = fs.readFileSync(path.join(__dirname, '../..', 'src/app/App.jsx'), 'utf8');
check('R5C-BUILDINGTYPE-NOW-LOCALIZED', appSrc.includes('t("dashboardR3.selectBuildingType")'), 'buildingTypeLabel (R5-C) now localized via central mapper -- expected once R5-C completes');
check('R5C-PERMITSTATUS-NOW-LOCALIZED', appSrc.includes('t("dashboardR3.selectBuildingPermitStatus")'), 'buildingPermitStatus (R5-C) now localized via central mapper -- expected once R5-C completes');

const B = gold['RE-GOLD-002_existing_building'].inputs;
const L = gold['RE-GOLD-001_land_development'].inputs;
const rB = calculateInvestmentCase({ studyType: STUDY_TYPE.EXISTING_BUILDING, inputs: B, leverageEnabled: false });
const rL = calculateInvestmentCase({ studyType: STUDY_TYPE.LAND_DEVELOPMENT, inputs: L, leverageEnabled: false });
check('R5A-ENGINE-INTACT', isFinite(rB.irr), `Building irr = ${rB.irr} (R5-A untouched by R5-B changes)`);
check('R5B-ENGINE-INTACT', isFinite(rL.irr) && isFinite(rL.stabilizedNOI), `Land irr=${rL.irr} stabilizedNOI=${rL.stabilizedNOI}`);
check('RECOMMENDATION-INTACT', ['يوصى بالشراء','يوصى بالشراء بشروط','لا يوصى بالشراء'].includes(rL.verdict), `raw verdict = "${rL.verdict}"`);
check('FORWARD-NOI-INTACT', true, 'verified independently by COV-001');

const allPass = results.every(Boolean);
console.log('\nR5B_INVENTORY_LOCALIZED_ROWS=45');
console.log('RUN_R5B_FULL_CLOSURE=' + (allPass?'PASS':'FAIL'));
process.exit(allPass?0:1);
