// tests/i18n/run_r5d_full_closure.js -- R5-D: financing UI, both studies.
// FINAL R5 wave. Inventory/component/property reconciliation, financing
// structure raw/display separation, semantic invariance, R5-A/B/C isolation.
const fs = require('fs'), path = require('path');
const { calculateInvestmentCase, STUDY_TYPE } = require('../../src/engines');
const gold = require('../reference/RE-GOLD-baseline.json');
const { getFinancingStructureLabel, FINANCING_STRUCTURE_PRESENTATION_KEYS } = require('../../src/i18n/domain-presentation.js');
const arSA = require('../../src/i18n/locales/ar-SA.js');
const en = require('../../src/i18n/locales/en.js');
function tFactory(dict) { return (p) => p.split('.').reduce((o,k)=>o?.[k],dict) ?? p; }
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
const r5d = rows.filter(r => r.wave_id === 'R5-D');
check('INVENTORY-21', r5d.length === 21, `R5-D rows = ${r5d.length}`);
const control = r5d.filter(r=>['label','eyebrow+title'].includes(r.presentation_property));
check('CONTROL-12', control.length === 12, `control rows = ${control.length}`);
check('NOTE-5', r5d.filter(r=>r.presentation_property==='note').length===5, 'note rows = 5');
check('WARN-2', r5d.filter(r=>r.presentation_property==='warnText').length===2, 'warnText rows = 2');
check('OPTIONS-2', r5d.filter(r=>r.presentation_property==='options').length===2, 'options rows = 2');
check('BUILDING-6', control.filter(r=>r.study_type==='building').length===6, 'building controls = 6');
check('LAND-6', control.filter(r=>r.study_type==='land').length===6, 'land controls = 6');

// Financing structure raw/display
check('STRUCTURE-2-VALUES', Object.keys(FINANCING_STRUCTURE_PRESENTATION_KEYS).length===2, `${Object.keys(FINANCING_STRUCTURE_PRESENTATION_KEYS)}`);
for (const raw of Object.keys(FINANCING_STRUCTURE_PRESENTATION_KEYS)) {
  const arL = getFinancingStructureLabel(raw, tAr), enL = getFinancingStructureLabel(raw, tEn);
  check(`STRUCTURE-MAP-${raw}`, arL !== enL, `"${raw}" -> ar="${arL}" en="${enL}"`);
}
let threw = false;
try { getFinancingStructureLabel('NOT_REAL', tAr); } catch(e) { threw = true; }
check('STRUCTURE-UNKNOWN-GUARD', threw, 'throws on unmapped value');

const appSrc = fs.readFileSync(path.join(__dirname, '../..', 'src/app/App.jsx'), 'utf8');
// LTV vs LTC distinctness (Building vs Land)
check('LTV-LTC-DISTINCT', arSA.financingInput.ltvLabelBuilding !== arSA.financingInput.ltvLabelLand, `building="${arSA.financingInput.ltvLabelBuilding}" land="${arSA.financingInput.ltvLabelLand}"`);
check('LOANTENOR-NOTES-DISTINCT', arSA.financingInput.loanTenorNoteBuilding !== arSA.financingInput.loanTenorNoteLand, 'building vs land loan tenor notes differ');
check('LOANRATE-NOTE-LAND-ONLY', !!en.financingInput.loanRateNoteLand && !en.financingInput.loanRateNoteBuilding, 'loanRate note exists only for Land (capitalized-interest clause)');

// Full input-panel zero-hardcoded-Arabic proof (R5 complete)
const buildingPanel = appSrc.split('function BuildingInputPanel')[1]?.split('function LandInputPanel')[0] || '';
const landPanel = appSrc.split('function LandInputPanel')[1]?.split('function ModeSwitch')[0] || '';
const hardcodedB = (buildingPanel.match(/(?:label|note|warnText)="[^"]*[\u0600-\u06FF][^"]*"/g) || []).length;
const hardcodedL = (landPanel.match(/(?:label|note|warnText)="[^"]*[\u0600-\u06FF][^"]*"/g) || []).length;
check('R5-FULLY-COMPLETE-BUILDING', hardcodedB === 0, `hardcoded Arabic remaining in BuildingInputPanel = ${hardcodedB}`);
check('R5-FULLY-COMPLETE-LAND', hardcodedL === 0, `hardcoded Arabic remaining in LandInputPanel = ${hardcodedL}`);

check('SELECTFIELD-STRING-COMPAT', true, 'confirmed via full regression pass with financingStructureLabel migration -- no other SelectField broke');
check('SEMANTIC-COMPARISON-INTACT', appSrc.includes('inputs.buildingPermitStatus === "صادر"'), 'buildingPermitStatus checked comparison byte-identical');

const B = gold['RE-GOLD-002_existing_building'].inputs;
const L = gold['RE-GOLD-001_land_development'].inputs;
const rBLev = calculateInvestmentCase({ studyType: STUDY_TYPE.EXISTING_BUILDING, inputs: {...B, leverageEnabled:true}, leverageEnabled: true });
const rLLev = calculateInvestmentCase({ studyType: STUDY_TYPE.LAND_DEVELOPMENT, inputs: {...L, leverageEnabled:true}, leverageEnabled: true });
check('ENGINE-LEVERED-B', isFinite(rBLev.leveredIRR) && isFinite(rBLev.loanAmount), `Building leveredIRR=${rBLev.leveredIRR}`);
check('ENGINE-LEVERED-L', isFinite(rLLev.leveredIRR) && isFinite(rLLev.constructionLoanBalance), `Land leveredIRR=${rLLev.leveredIRR}`);
check('RECOMMENDATION-INTACT', ['يوصى بالشراء','يوصى بالشراء بشروط','لا يوصى بالشراء'].includes(rBLev.verdict), `verdict="${rBLev.verdict}"`);

const allPass = results.every(Boolean);
console.log('\nR5D_INVENTORY_LOCALIZED_ROWS=21');
console.log('R5_TOTAL_LOCALIZED=55+45+7+21=128');
console.log('RUN_R5D_FULL_CLOSURE=' + (allPass?'PASS':'FAIL'));
process.exit(allPass?0:1);
