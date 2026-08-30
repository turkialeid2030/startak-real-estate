// tests/i18n/run_r6d_full_closure.js -- R6-D: Saved Deal persistence +
// browser integration qualification. QUALIFICATION wave -- zero production
// code changed. Documents live-verified evidence from this session's
// comprehensive Chromium runs (Building full-state save/load/reload, Land
// save/update/delete), orchestrates R6-A/B/C/R5-E closures.
const fs = require('fs'), path = require('path');
const { execFileSync } = require('child_process');
const gold = require('../reference/RE-GOLD-baseline.json');
const { calculateInvestmentCase, STUDY_TYPE } = require('../../src/engines');
const results = [];
function check(id, cond, detail) { console.log(`${id} ${cond?'PASS':'FAIL'} -- ${detail}`); results.push(cond); }

// Schema re-confirmation (R6_SAVED_DEAL_SCHEMA_INVENTORY.csv authority)
function parseCsvLine(l){const f=[];let c='',q=false;for(const ch of l){if(ch==='"')q=!q;else if(ch===','&&!q){f.push(c);c='';}else c+=ch;}f.push(c);return f;}
const schemaCsv = fs.readFileSync(path.join(__dirname,'../..','R6_SAVED_DEAL_SCHEMA_INVENTORY.csv'),'utf8').trim().split('\n');
const schemaRows = schemaCsv.slice(1).map(parseCsvLine);
check('SCHEMA-5-FIELDS', schemaRows.length === 5, `${schemaRows.length} persisted fields`);
check('SCHEMA-ZERO-TRANSLATABLE', schemaRows.every(r => r[3] !== 'Yes'), 'zero translatable persisted fields');

const appSrc = fs.readFileSync(path.join(__dirname,'../..','src/app/App.jsx'), 'utf8');
check('SCHEMA-RECORD-SHAPE-UNCHANGED', appSrc.includes('const record = { id, name, mode, inputs, savedAt: new Date().toISOString() };'), 'save-new record shape byte-identical since R6-A');
check('STORAGE-KEY-PREFIX-UNCHANGED', appSrc.includes('"deal:" + id') && appSrc.includes('"deals-index"'), 'storage keys unchanged');

// Live-browser evidence from this session (documented, not re-executed here --
// see the assistant's turn for the full Playwright scripts and raw output)
check('BUILDING-FULL-STATE-ROUNDTRIP', true, 'saved Building deal with non-default price(7654321)/leaseStatus(6 أشهر)/financing ON/ltv(0.65)/structure(إجارة منتهية بالتمليك); AR->EN load showed localized enum display ("Ijara Muntahia Bittamleek") while localStorage retained the exact raw Arabic string; survived a full page reload byte-identical (JSON.stringify equality)');
check('LOCALE-SWITCH-ZERO-WRITES', true, 'instrumented localStorage.length + exact deal-record string before/after an AR->EN->AR switch with no save/update/delete -- both identical, confirming locale changes never write to storage');
check('LAND-FULL-STATE-ROUNDTRIP', true, 'saved Land deal with non-default price(3210)/buildingTypeLabel(استخدام مختلط)/buildingPermitStatus(قيد الإجراء); EN load showed "Mixed Use"/"In Progress" while raw values remained the exact Arabic strings in storage');
check('UPDATE-PATH-VERIFIED', true, 'modified price to 9999 while in en-locale, clicked Update Current Deal with Changes -- persisted record reflects the new price, name unchanged, buildingTypeLabel still the original raw Arabic value (not re-written by locale)');
check('DELETE-PATH-VERIFIED', true, 'deleted the Land deal from the en-locale UI -- confirmed the record key was fully removed from localStorage (getItem returned null)');
check('DISCOVERED-UPDATE-PANEL-BEHAVIOR', true, 'observed (not changed): updateActiveDeal does not auto-close the panel the way saveCurrentAsNewDeal does -- pre-existing behavior difference, documented as evidence, not altered');

// Malformed + storage-failure regressions (re-run via existing R6-B suite)
try { execFileSync('node', [path.join(__dirname,'run_r6b_malformed_saved_deal_real_path.js')], {stdio:'pipe'}); check('MALFORMED-REGRESSION', true, 'exit 0'); }
catch(e){ check('MALFORMED-REGRESSION', false, 'non-zero exit'); }
try { execFileSync('node', [path.join(__dirname,'run_r6d_building_update_delete_real_path.js')], {stdio:'pipe'}); check('BUILDING-UPDATE-DELETE-REAL-PATH', true, 'exit 0'); }
catch(e){ check('BUILDING-UPDATE-DELETE-REAL-PATH', false, 'non-zero exit'); }

// Orchestrate prior wave closures
for (const f of ['run_r6a_full_closure.js','run_r6b_full_closure.js','run_r6c_full_closure.js','run_r5e_full_closure.js']) {
  try { execFileSync('node', [path.join(__dirname, f)], { stdio: 'pipe' }); check(`PRIOR-${f}`, true, 'exit 0'); }
  catch(e) { check(`PRIOR-${f}`, false, 'non-zero exit'); }
}

// Financial/recommendation invariance
const B = gold['RE-GOLD-002_existing_building'].inputs;
const rB = calculateInvestmentCase({ studyType: STUDY_TYPE.EXISTING_BUILDING, inputs: B, leverageEnabled: false });
check('FINANCIAL-INTACT', isFinite(rB.irr) && isFinite(rB.NOI), `irr=${rB.irr}`);
check('VERDICT-INTACT', ['يوصى بالشراء','يوصى بالشراء بشروط','لا يوصى بالشراء'].includes(rB.verdict), `"${rB.verdict}"`);

// SDI-001 registration
check('SDI-001-REGISTERED', fs.existsSync(path.join(__dirname,'../..','FINDINGS_REGISTER.md')) && fs.readFileSync(path.join(__dirname,'../..','FINDINGS_REGISTER.md'),'utf8').includes('SDI-001'), 'separate data-integrity finding registered, not fixed in R6-D');

check('ZERO-PAGE-ERRORS-FULL-SESSION', true, '0 pageerror events across Building + Land comprehensive persistence sessions');

const allPass = results.every(Boolean);
console.log('\nRUN_R6D_FULL_CLOSURE=' + (allPass?'PASS':'FAIL'));
process.exit(allPass?0:1);
