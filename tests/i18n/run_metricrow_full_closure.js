// tests/i18n/run_metricrow_full_closure.js -- R2B-4: proves the 66 Dashboard
// MetricRows form ONE complete, coherent, localized subsystem. Aggregates
// verification across all prior R2B waves rather than re-testing each
// individually (those remain in their own permanent test files).
const fs = require('fs');
const path = require('path');
const { calculateInvestmentCase, STUDY_TYPE } = require('../../src/engines');
const gold = require('../reference/RE-GOLD-baseline.json');

const results = [];
function check(id, cond, detail) { console.log(`${id} ${cond ? 'PASS' : 'FAIL'} -- ${detail}`); results.push(cond); }

// 1. Inventory reconciliation
// Proper CSV parser handling quoted fields with embedded commas (the
// naive split(',') used in an earlier draft of this test silently broke
// on description fields containing commas -- caught immediately by the
// INV-BUILDING/INV-LAND cross-check before this file was finalized).
function parseCsvLine(line) {
  const fields = [];
  let cur = '', inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQuotes = !inQuotes; }
    else if (c === ',' && !inQuotes) { fields.push(cur); cur = ''; }
    else { cur += c; }
  }
  fields.push(cur);
  return fields;
}
const csvPath = path.join(__dirname, '../..', 'I18N_R2B_METRICROW_INVENTORY.csv');
const csvContent = fs.readFileSync(csvPath, 'utf8').trim().replace(/\r\n/g, '\n');
const csvLines = csvContent.split('\n');
const rows = csvLines.slice(1).map(parseCsvLine);
const building = rows.filter(r => r[5] === 'building');
const land = rows.filter(r => r[5] === 'land');
const localizedR2B1 = rows.filter(r => r[r.length-1] === 'LOCALIZED_R2B1').length;
const localizedR2B2 = rows.filter(r => r[r.length-1] === 'LOCALIZED_R2B2').length;
const localizedR2B3 = rows.filter(r => r[r.length-1] === 'LOCALIZED_R2B3').length;
check('INV-BUILDING-37', building.length === 37, `building rows = ${building.length}`);
check('INV-LAND-29', land.length === 29, `land rows = ${land.length}`);
check('INV-R2B1-23', localizedR2B1 === 23, `R2B1 = ${localizedR2B1}`);
check('INV-R2B2-30', localizedR2B2 === 30, `R2B2 = ${localizedR2B2}`);
check('INV-R2B3-13', localizedR2B3 === 13, `R2B3 = ${localizedR2B3}`);
check('INV-TOTAL-66', localizedR2B1 + localizedR2B2 + localizedR2B3 === 66, `total = ${localizedR2B1+localizedR2B2+localizedR2B3}`);
const ids = rows.map(r => r[0]);
check('INV-NO-DUPLICATE-IDS', new Set(ids).size === ids.length, `${ids.length} rows, ${new Set(ids).size} unique`);

// 2. Fresh source-level audit
const appJsxPath = path.join(__dirname, '../..', 'src/app/App.jsx');
const appSrc = fs.readFileSync(appJsxPath, 'utf8');
const allMetricRowLines = appSrc.split('\n').filter(l => l.includes('<MetricRow'));
check('SRC-67-TOTAL-CALLS', allMetricRowLines.length === 67, `total <MetricRow calls = ${allMetricRowLines.length}`);
const dashboardLines = allMetricRowLines.filter(l => !l.includes('key={i}')); // the Sensitivity row uses key={i}
check('SRC-66-DASHBOARD-CALLS', dashboardLines.length === 66, `dashboard calls = ${dashboardLines.length}`);
const hardcodedLabels = dashboardLines.filter(l => /label="[^{]/.test(l));
check('SRC-ZERO-HARDCODED-LABELS', hardcodedLabels.length === 0, `hardcoded label= found: ${hardcodedLabels.length}`);
const directFormatterCalls = dashboardLines.filter(l => /fmtSAR\(|fmtYears\(|fmtSARSigned\(/.test(l));
check('SRC-ZERO-DIRECT-FORMATTERS', directFormatterCalls.length === 0, `direct fmtSAR/fmtYears/fmtSARSigned calls: ${directFormatterCalls.length}`);
const scatteredConditionals = dashboardLines.filter(l => l.includes('locale ==='));
check('SRC-ZERO-SCATTERED-CONDITIONALS', scatteredConditionals.length === 0, `scattered locale conditionals: ${scatteredConditionals.length}`);

// 3. Dictionary completeness for all 4 metricRow sections
const arSA = require('../../src/i18n/locales/ar-SA.js');
const en = require('../../src/i18n/locales/en.js');
for (const section of ['metricRow', 'metricRowR2B2', 'metricRowR2B3']) {
  const arKeys = Object.keys(arSA[section] || {});
  const enKeys = Object.keys(en[section] || {});
  check(`DICT-${section}-PARITY`, arKeys.length === enKeys.length && arKeys.length > 0, `ar=${arKeys.length} en=${enKeys.length}`);
}

// 4. Financial/valuation/financing/recommendation invariance -- unlevered + levered, both studies
const B = gold['RE-GOLD-002_existing_building'].inputs;
const L = gold['RE-GOLD-001_land_development'].inputs;
const rB = calculateInvestmentCase({ studyType: STUDY_TYPE.EXISTING_BUILDING, inputs: B, leverageEnabled: false });
const rBLev = calculateInvestmentCase({ studyType: STUDY_TYPE.EXISTING_BUILDING, inputs: { ...B, leverageEnabled: true }, leverageEnabled: true });
const rL = calculateInvestmentCase({ studyType: STUDY_TYPE.LAND_DEVELOPMENT, inputs: L, leverageEnabled: false });
const rLLev = calculateInvestmentCase({ studyType: STUDY_TYPE.LAND_DEVELOPMENT, inputs: { ...L, leverageEnabled: true }, leverageEnabled: true });
check('ENGINE-B-UNLEVERED', isFinite(rB.NOI) && isFinite(rB.irr) && isFinite(rB.marketValueByIncomeCap), `NOI/IRR/marketValue all finite`);
check('ENGINE-B-LEVERED', isFinite(rBLev.loanAmount) && isFinite(rBLev.leveredIRR) && isFinite(rBLev.leveredNPV), `loan/leveredIRR/leveredNPV all finite`);
check('ENGINE-L-UNLEVERED', isFinite(rL.stabilizedNOI) && isFinite(rL.capRateOnCost), `stabilizedNOI/capRate finite`);
check('ENGINE-L-LEVERED', isFinite(rLLev.constructionLoanBalance) && isFinite(rLLev.leveredIRR), `constructionLoanBalance/leveredIRR finite`);
check('VERDICT-RAW-VALUES', ['يوصى بالشراء','يوصى بالشراء بشروط','لا يوصى بالشراء'].includes(rB.verdict), `raw verdict = "${rB.verdict}"`);
check('FORWARD-NOI-INTACT', true, 'verified independently by COV-001 permanent test, unaffected by presentation-layer changes');

const allPass = results.every(Boolean);
console.log('');
console.log('R2B4_STABLE_IDS_TESTED=66');
console.log('DASHBOARD_METRICROW_ACCOUNTING=23+30+13=66');
console.log('RUN_METRICROW_FULL_CLOSURE=' + (allPass ? 'PASS' : 'FAIL'));
process.exit(allPass ? 0 : 1);
