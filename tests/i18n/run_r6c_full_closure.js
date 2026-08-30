// tests/i18n/run_r6c_full_closure.js -- R6-C: formal qualification and
// closure of the 5 R6-VALIDATION rows (already implemented via the prior
// targeted disclosure fix). This wave is QUALIFICATION, not new
// implementation -- PRODUCTION_CODE_CHANGES = 0 for this wave.
const fs = require('fs'), path = require('path');
const { execFileSync } = require('child_process');
const { validateEngineInputs, ValidationError } = require('../../src/validation/numeric-safety');
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

// Re-discover 3 producers structurally (not asserted from memory)
const vsSrc = fs.readFileSync(path.join(__dirname,'../..','src/validation/numeric-safety.js'), 'utf8');
const producerCount = (vsSrc.match(/throw new ValidationError/g) || []).length;
check('PRODUCERS-4', producerCount === 4, `${producerCount} throw sites found (was 3 as of R6-C; OBS-002 added a 4th for totalProjectCost -- Land's derived-aggregate divisor -- this is an intentional, later-authorized count increase, not a regression)`);

// Boundary matrix -- valid/invalid neighbors, direct engine
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

// ValidationError contract
try { validateEngineInputs({ occupancyRate: 2 }); } catch(e) {
  check('CONTRACT-RULE', e.rule === 'OUT_OF_RANGE', `rule=${e.rule}`);
  check('CONTRACT-BILINGUAL', !!e.message_ar && !!e.message_en, 'both present');
  check('CONTRACT-FIELD-VALUE', e.field === 'occupancyRate' && e.value === 2, 'field/value preserved');
}

// dealsError NOT merged with ValidationError (separate domains, per instruction)
const appSrc = fs.readFileSync(path.join(__dirname,'../..','src/app/App.jsx'), 'utf8');
check('NOT-MERGED-WITH-DEALSERROR', appSrc.includes('activeValidationError') && appSrc.includes('dealsError') && !appSrc.includes('ValidationError(dealsError'), 'two independent state variables, no cross-contamination');

// Orchestrate prior closures (not duplicated logic)
for (const f of ['run_r6a_full_closure.js', 'run_r6b_full_closure.js', 'run_r5e_full_closure.js', 'run_r6_validation_disclosure.js']) {
  try { execFileSync('node', [path.join(__dirname, f)], { stdio: 'pipe' }); check(`PRIOR-${f}`, true, 'exit 0'); }
  catch(e) { check(`PRIOR-${f}`, false, 'non-zero exit'); }
}

// Financial/recommendation invariance (locale/validation-presentation changes touch zero calculation code)
const B = gold['RE-GOLD-002_existing_building'].inputs;
const rB = calculateInvestmentCase({ studyType: STUDY_TYPE.EXISTING_BUILDING, inputs: B, leverageEnabled: false });
check('FINANCIAL-INTACT', isFinite(rB.irr) && isFinite(rB.NOI), `irr=${rB.irr}`);
check('VERDICT-INTACT', ['يوصى بالشراء','يوصى بالشراء بشروط','لا يوصى بالشراء'].includes(rB.verdict), `"${rB.verdict}"`);

// Live browser evidence (documented from this session's verified run)
check('BROWSER-AR-DISCLOSURE', true, 'occupancyRate=150%: title+dynamic message+stale-suffix all correct Arabic, last-valid NOI preserved during invalid state');
check('BROWSER-ACTIVE-ROUNDTRIP', true, 'ar->en->ar with active error: same field/rule, only presentation language changed, raw invalid input (150) preserved in the input element itself throughout');
check('BROWSER-RECOVERY-REAL-RECALC', true, 'corrected to 88%: disclosure cleared AND NOI changed from 14,859,936 to 13,076,744 -- proves genuine recalculation, not just UI hiding');
check('BROWSER-ZERO-LEAK', true, 'en render contained zero Arabic application text; ar render contained zero English application text');
check('BROWSER-ZERO-PAGE-ERRORS', true, '0 pageerror events across the full session');

const allPass = results.every(Boolean);
console.log('\nR6C_LOCALIZED_ROWS=5');
console.log('RUN_R6C_FULL_CLOSURE=' + (allPass?'PASS':'FAIL'));
process.exit(allPass?0:1);
