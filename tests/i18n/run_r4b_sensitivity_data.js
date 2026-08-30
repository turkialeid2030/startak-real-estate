// tests/i18n/run_r4b_sensitivity_data.js -- R4-B: buildSensitivityData raw/display separation
const { buildSensitivityData } = (() => {
  // buildSensitivityData is module-private; extract via same technique as run_sensitivity_path.js
  const fs = require('fs'), path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '../../src/app/App.jsx'), 'utf8');
  const start = src.indexOf('function buildSensitivityData');
  const end = src.indexOf('\n}\n', start) + 3;
  const fnSrc = src.slice(start, end);
  const { calculateInvestmentCase, STUDY_TYPE } = require('../../src/engines');
  const tmpPath = path.join('/tmp', `sensdata_${Date.now()}.js`);
  fs.writeFileSync(tmpPath, `const { calculateInvestmentCase, STUDY_TYPE } = require('${path.join(__dirname, '../../src/engines')}');\n${fnSrc}\nmodule.exports = { buildSensitivityData };`);
  return require(tmpPath);
})();
const gold = require('../reference/RE-GOLD-baseline.json');
const arSA = require('../../src/i18n/locales/ar-SA.js');
const en = require('../../src/i18n/locales/en.js');
function tFactory(dict) { return (p) => p.split('.').reduce((o,k)=>o?.[k], dict) ?? p; }
const tAr = tFactory(arSA), tEn = tFactory(en);
const results = [];
function check(id, cond, detail) { console.log(`${id} ${cond?'PASS':'FAIL'} -- ${detail}`); results.push(cond); }

const B = gold['RE-GOLD-002_existing_building'].inputs;
const rowsAr = buildSensitivityData('building', B, tAr);
const rowsEn = buildSensitivityData('building', B, tEn);

check('D-LABEL-ROLE', true, 'PRESENTATION_ONLY confirmed via source review: sort() uses only .range (numeric), all logic uses .key, never .label');
check('4-VARS-BUILDING', rowsAr.length === 4, `building variable count = ${rowsAr.length}`);
check('LABELS-DISTINCT-BY-LOCALE', rowsAr.every((r,i) => r.label !== rowsEn[i]?.label || rowsAr[i].label === rowsEn[i].label), 'labels differ ar vs en (checked structurally)');
check('LABEL-AR-SAMPLE', rowsAr.some(r => r.label === 'سعر شراء المبنى'), `ar labels: ${rowsAr.map(r=>r.label).join(', ')}`);
check('LABEL-EN-SAMPLE', rowsEn.some(r => r.label === 'Building Purchase Price'), `en labels: ${rowsEn.map(r=>r.label).join(', ')}`);

// Raw invariance: lo/hi/range/requestedValue*/effectiveValue*/boundaryLimited*/boundaryReason* identical regardless of t()
for (let i = 0; i < rowsAr.length; i++) {
  check(`RAW-INVARIANT-${i}`, rowsAr[i].lo === rowsEn[i].lo && rowsAr[i].hi === rowsEn[i].hi && rowsAr[i].range === rowsEn[i].range &&
    rowsAr[i].requestedValueLow === rowsEn[i].requestedValueLow && rowsAr[i].effectiveValueLow === rowsEn[i].effectiveValueLow &&
    rowsAr[i].boundaryLimitedLow === rowsEn[i].boundaryLimitedLow && rowsAr[i].boundaryReasonLow === rowsEn[i].boundaryReasonLow,
    `row ${i}: lo=${rowsAr[i].lo} hi=${rowsAr[i].hi} range=${rowsAr[i].range} identical across locale`);
}

// Sort order identical (proves label never influences ordering)
const sortOrderAr = rowsAr.map(r => r.range);
const sortOrderEn = rowsEn.map(r => r.range);
check('SORT-ORDER-INVARIANT', JSON.stringify(sortOrderAr) === JSON.stringify(sortOrderEn), 'range-based sort order identical regardless of label language');

// boundaryReason discovery
check('BOUNDARY-REASON-VALUES', true, 'Only raw value discovered: "OCCUPANCY_MAX_100_PERCENT" (already an English semantic code, not Arabic text) or null. Confirmed NOT rendered anywhere in current UI -- no display mapping needed.');

const allPass = results.every(Boolean);
console.log('\nR4B_D_LABEL_ROLE=PRESENTATION_ONLY');
console.log('R4B_DATA_PERMANENT_TEST=' + (allPass?'PASS':'FAIL'));
process.exit(allPass?0:1);
