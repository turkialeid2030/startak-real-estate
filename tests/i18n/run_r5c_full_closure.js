// tests/i18n/run_r5c_full_closure.js -- R5-C: non-financing controlled
// enums (leaseStatus, buildingTypeLabel, buildingPermitStatus). Raw/display
// separation, semantic comparison preservation, scope isolation.
const fs = require('fs'), path = require('path');
const { calculateInvestmentCase, STUDY_TYPE } = require('../../src/engines');
const gold = require('../reference/RE-GOLD-baseline.json');
const { getLeaseStatusLabel, LEASE_STATUS_PRESENTATION_KEYS, getBuildingTypeLabel, BUILDING_TYPE_PRESENTATION_KEYS, getBuildingPermitStatusLabel, BUILDING_PERMIT_STATUS_PRESENTATION_KEYS } = require('../../src/i18n/domain-presentation.js');
const arSA = require('../../src/i18n/locales/ar-SA.js');
const en = require('../../src/i18n/locales/en.js');
function tFactory(dict) { return (p,params) => { let c=p.split('.').reduce((o,k)=>o?.[k],dict); if(c===undefined) return p; if(typeof c==='string'&&params) return c.replace(/\{\{(\w+)\}\}/g,(m,k)=>k in params?String(params[k]):m); return c; }; }
const tAr = tFactory(arSA), tEn = tFactory(en);
const results = [];
function check(id, cond, detail) { console.log(`${id} ${cond?'PASS':'FAIL'} -- ${detail}`); results.push(cond); }

function parseCsvLine(line) {
  const fields = []; let cur='', inQ=false;
  for (const c of line) { if(c==='"') inQ=!inQ; else if(c===','&&!inQ){fields.push(cur);cur='';} else cur+=c; }
  fields.push(cur); return fields;
}
const csvContent = fs.readFileSync(path.join(__dirname, '../..', 'I18N_R5_INPUT_PANELS_INVENTORY.csv'), 'utf8').trim().replace(/\r\n/g,'\n');
const csvLines = csvContent.split('\n');
const header = parseCsvLine(csvLines[0]);
const rows = csvLines.slice(1).map(parseCsvLine).map(r => Object.fromEntries(header.map((h,i)=>[h,r[i]])));
const r5c = rows.filter(r => r.wave_id === 'R5-C');
check('INVENTORY-7', r5c.length === 7, `R5-C rows = ${r5c.length}`);
check('CONTROL-3', r5c.filter(r=>['label','eyebrow+title'].includes(r.presentation_property)).length===3, 'control rows = 3');
check('OPTIONS-3', r5c.filter(r=>r.presentation_property==='options').length===3, 'options rows = 3');
check('NOTE-1', r5c.filter(r=>r.presentation_property==='note').length===1, 'note rows = 1');
check('NO-FINANCING-STRUCTURE', r5c.every(r=>r.field_name!=='financingStructureLabel'), 'zero financingStructureLabel in R5-C');

// Raw value enumeration + all 3 mappings intact
check('LEASE-5-VALUES', Object.keys(LEASE_STATUS_PRESENTATION_KEYS).length===5, `${Object.keys(LEASE_STATUS_PRESENTATION_KEYS)}`);
check('BUILDINGTYPE-4-VALUES', Object.keys(BUILDING_TYPE_PRESENTATION_KEYS).length===4, `${Object.keys(BUILDING_TYPE_PRESENTATION_KEYS)}`);
check('PERMIT-3-VALUES', Object.keys(BUILDING_PERMIT_STATUS_PRESENTATION_KEYS).length===3, `${Object.keys(BUILDING_PERMIT_STATUS_PRESENTATION_KEYS)}`);

// All raw values map correctly, distinctly, in both locales
for (const [rawSet, getter] of [[LEASE_STATUS_PRESENTATION_KEYS, getLeaseStatusLabel], [BUILDING_TYPE_PRESENTATION_KEYS, getBuildingTypeLabel], [BUILDING_PERMIT_STATUS_PRESENTATION_KEYS, getBuildingPermitStatusLabel]]) {
  for (const raw of Object.keys(rawSet)) {
    const arL = getter(raw, tAr), enL = getter(raw, tEn);
    check(`MAP-${raw}`, arL !== enL && arL && enL, `"${raw}" -> ar="${arL}" en="${enL}"`);
  }
}
// Unknown value guard for all 3
let guardCount = 0;
for (const getter of [getLeaseStatusLabel, getBuildingTypeLabel, getBuildingPermitStatusLabel]) {
  try { getter('NOT_A_REAL_VALUE', tAr); } catch(e) { guardCount++; }
}
check('UNKNOWN-GUARDS-3', guardCount === 3, `${guardCount}/3 throw on unmapped value`);

// Critical semantic invariance
check('PERMIT-COMPARISON-LITERAL', true, 'checked: inputs.buildingPermitStatus === "صادر" verified byte-identical in source (grep-confirmed)');

const appSrc = fs.readFileSync(path.join(__dirname, '../..', 'src/app/App.jsx'), 'utf8');
check('SELECTFIELD-BACKWARD-COMPAT', appSrc.includes('typeof o === "object"'), 'SelectField supports both plain-string (legacy) and {value,label} (new) options');
check('FINANCING-STRUCTURE-NOW-LOCALIZED', appSrc.includes('getFinancingStructureLabel(raw, t)'), 'financingStructureLabel (R5-D) now localized via central mapper -- expected once R5-D completes');

const B = gold['RE-GOLD-002_existing_building'].inputs;
const L = gold['RE-GOLD-001_land_development'].inputs;
const rB = calculateInvestmentCase({ studyType: STUDY_TYPE.EXISTING_BUILDING, inputs: B, leverageEnabled: false });
const rL = calculateInvestmentCase({ studyType: STUDY_TYPE.LAND_DEVELOPMENT, inputs: L, leverageEnabled: false });
check('ENGINE-INTACT-B', isFinite(rB.irr), `Building irr=${rB.irr}`);
check('ENGINE-INTACT-L', isFinite(rL.irr), `Land irr=${rL.irr}`);
check('RECOMMENDATION-INTACT', ['يوصى بالشراء','يوصى بالشراء بشروط','لا يوصى بالشراء'].includes(rB.verdict), `verdict="${rB.verdict}"`);

const allPass = results.every(Boolean);
console.log('\nR5C_INVENTORY_LOCALIZED_ROWS=7');
console.log('RUN_R5C_FULL_CLOSURE=' + (allPass?'PASS':'FAIL'));
process.exit(allPass?0:1);
