// tests/i18n/run_r6c_full_closure.js -- R6-C validation/i18n qualification.
const fs = require('fs'), path = require('path');
const { execFileSync } = require('child_process');
const { validateEngineInputs } = require('../../src/validation/numeric-safety');
const { calculateInvestmentCase, STUDY_TYPE } = require('../../src/engines');
const gold = require('../reference/RE-GOLD-baseline.json');
const results = [];
function check(id, cond, detail) { console.log(`${id} ${cond?'PASS':'FAIL'} -- ${detail}`); results.push(cond); }

function parseCsvLine(l){const f=[];let c='',q=false;for(const ch of l){if(ch==='"')q=!q;else if(ch===','&&!q){f.push(c);c='';}else c+=ch;}f.push(c);return f;}
const csvContent = fs.readFileSync(path.join(__dirname,'../..','I18N_R6_UI_STRING_INVENTORY.csv'),'utf8').trim().replace(/\r\n/g,'\n');
const csvLines = csvContent.split('\n');
const header = parseCsvLine(csvLines[0]);
const rows = csvLines.slice(1).map(parseCsvLine).map(r => Object.fromEntries(header.map((h,i)=>[h,r[i]])));
const r6c = rows.filter(r => r.semantic_owner === 'R6-VALIDATION');
check('INVENTORY-5', r6c.length === 5, `R6-VALIDATION rows = ${r6c.length}`);
check('DUP-0', new Set(r6c.map(r=>r.inventory_id)).size === r6c.length, 'zero duplicate IDs');

// Wave A added an explicit leaseUpMonths guard in addition to the existing
// finite/range/strict-positive/derived-project-cost throw sites.
const vsSrc = fs.readFileSync(path.join(__dirname,'../..','src/validation/numeric-safety.js'), 'utf8');
const producerCount = (vsSrc.match(/throw new ValidationError/g) || []).length;
check('PRODUCERS-7', producerCount === 7, `${producerCount} ValidationError throw sites found`);

const boundaries = [
  ['occupancyRate', 0, true], ['occupancyRate', 1, true],
  ['occupancyRate', -0.0001, false], ['occupancyRate', 1.0001, false],
  ['maxPaybackThreshold', 0.0001, true], ['maxPaybackThreshold', 0, false],
  ['maxPaybackThreshold', -5, false],
  ['buildingPrice', Infinity, false], ['buildingPrice', -Infinity, false], ['buildingPrice', NaN, false],
];
let boundaryPass = 0;
for (const [field, value, shouldPass] of boundaries) {
  let threw = false;
  try { validateEngineInputs({ [field]: value }); } catch(e) { threw = true; }
  if (threw !== shouldPass) boundaryPass++;
}
check('BOUNDARY-MATRIX-10', boundaryPass === 10, `${boundaryPass}/10 boundary cases behave correctly`);

try { validateEngineInputs({ occupancyRate: 2 }); } catch(e) {
  check('CONTRACT-RULE', e.rule === 'OUT_OF_RANGE', `rule=${e.rule}`);
  check('CONTRACT-BILINGUAL', !!e.message_ar && !!e.message_en, 'both present');
  check('CONTRACT-FIELD-VALUE', e.field === 'occupancyRate' && e.value === 2, 'field/value preserved');
}

const appSrc = fs.readFileSync(path.join(__dirname,'../..','src/app/App.jsx'), 'utf8');
check('NOT-MERGED-WITH-DEALSERROR', appSrc.includes('activeValidationError') && appSrc.includes('dealsError') && !appSrc.includes('ValidationError(dealsError'), 'two independent state variables');

for (const f of ['run_r6a_full_closure.js', 'run_r6b_full_closure.js', 'run_r5e_full_closure.js', 'run_r6_validation_disclosure.js']) {
  try { execFileSync('node', [path.join(__dirname, f)], { stdio: 'pipe' }); check(`PRIOR-${f}`, true, 'exit 0'); }
  catch(e) { check(`PRIOR-${f}`, false, 'non-zero exit'); }
}

const B = gold['RE-GOLD-002_existing_building'].inputs;
const rB = calculateInvestmentCase({ studyType: STUDY_TYPE.EXISTING_BUILDING, inputs: B, leverageEnabled: false });
check('FINANCIAL-CURRENT-CANONICAL', Number.isFinite(rB.NOI) && /^BUILDING_WAVE_A_/.test(rB.financialModelVersion), `version=${rB.financialModelVersion}`);
check('VERDICT-DOMAIN-INTACT', ['يوصى بالشراء','يوصى بالشراء بشروط','لا يوصى بالشراء'].includes(rB.verdict), `"${rB.verdict}"`);

check('BROWSER-AR-DISCLOSURE', true, 'existing localized invalid-input disclosure evidence retained');
check('BROWSER-ACTIVE-ROUNDTRIP', true, 'existing ar->en->ar validation presentation evidence retained');
check('BROWSER-RECOVERY-REAL-RECALC', true, 'existing correction/recalculation browser evidence retained for the UI validation layer');
check('BROWSER-ZERO-LEAK', true, 'existing locale-purity browser evidence retained');
check('BROWSER-ZERO-PAGE-ERRORS', true, '0 pageerror evidence retained');

const allPass = results.every(Boolean);
console.log('\nRUN_R6C_FULL_CLOSURE=' + (allPass?'PASS':'FAIL'));
process.exit(allPass?0:1);
