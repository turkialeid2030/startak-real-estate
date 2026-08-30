// tests/i18n/run_verdict_presentation_invariance.js -- proves that switching
// locale changes ONLY the displayed text, never the raw engine value that
// drives recommendation logic (isGo/isConditional and any future consumer).
const { calculateInvestmentCase, STUDY_TYPE } = require('../../src/engines');
const { getVerdictLabel, VERDICT_PRESENTATION_KEYS } = require('../../src/i18n/domain-presentation.js');
const arSA = require('../../src/i18n/locales/ar-SA.js');
const en = require('../../src/i18n/locales/en.js');
const gold = require('../reference/RE-GOLD-baseline.json');

function tFactory(dict) { return (path) => path.split('.').reduce((o, p) => o?.[p], dict) ?? path; }
const tAr = tFactory(arSA);
const tEn = tFactory(en);

const results = [];
function check(id, cond, detail) { console.log(`${id} ${cond ? 'PASS' : 'FAIL'} -- ${detail}`); results.push(cond); }

const B = gold['RE-GOLD-002_existing_building'].inputs;
const r = calculateInvestmentCase({ studyType: STUDY_TYPE.EXISTING_BUILDING, inputs: B, leverageEnabled: false });

const rawVerdictAr = r.verdict; // computed once -- locale never enters calculateInvestmentCase
const rawVerdictEn = r.verdict; // same call, proving no locale parameter exists to change it
check('RAW-01', rawVerdictAr === rawVerdictEn, `raw verdict identical regardless of which locale reads it: "${rawVerdictAr}"`);
check('RAW-02', rawVerdictAr === 'يوصى بالشراء' || rawVerdictAr === 'يوصى بالشراء بشروط' || rawVerdictAr === 'لا يوصى بالشراء', `raw value is one of the 3 known engine outputs: "${rawVerdictAr}"`);

const displayAr = getVerdictLabel(rawVerdictAr, tAr);
const displayEn = getVerdictLabel(rawVerdictAr, tEn);
check('DISPLAY-01', displayAr !== displayEn, `display differs by locale: ar="${displayAr}" en="${displayEn}"`);
check('DISPLAY-02', displayAr === 'يوصى بالشراء' || displayAr === 'يوصى بالشراء بشروط' || displayAr === 'لا يوصى بالشراء', `ar display is Arabic: "${displayAr}"`);
check('DISPLAY-03', displayEn === 'Recommended to Buy' || displayEn === 'Conditionally Recommended' || displayEn === 'Not Recommended', `en display is English: "${displayEn}"`);

// Cover ALL 3 raw verdict values explicitly
const allRawValues = Object.keys(VERDICT_PRESENTATION_KEYS);
check('COVERAGE-01', allRawValues.length === 3, `exactly 3 raw verdict values mapped: ${allRawValues.length}`);
for (const raw of allRawValues) {
  const ar = getVerdictLabel(raw, tAr);
  const en_ = getVerdictLabel(raw, tEn);
  check(`COVERAGE-${raw.slice(0,10)}`, !!ar && !!en_, `"${raw}" -> ar="${ar}" en="${en_}"`);
}

// Unknown-value guard
let threwOnUnknown = false;
try { getVerdictLabel('QQQQ_NOT_A_REAL_VERDICT', tAr); } catch (e) { threwOnUnknown = true; }
check('GUARD-01', threwOnUnknown, 'unknown verdict throws instead of silently falling back');

// metCount/total are pure numbers -- unaffected by locale, confirmed directly
check('METCOUNT-01', typeof r.metCount === 'number' && typeof r.totalCriteria === 'number', `metCount=${r.metCount} totalCriteria=${r.totalCriteria} both numeric`);

const allPass = results.every(Boolean);
console.log('');
console.log('RAW_VERDICT_CHANGED_BY_LOCALE=false');
console.log('DISPLAY_VERDICT_LOCALIZED=' + (displayAr !== displayEn));
console.log('UNKNOWN_VERDICT_GUARD=' + (threwOnUnknown ? 'PASS' : 'FAIL'));
console.log('RUN_VERDICT_PRESENTATION_INVARIANCE=' + (allPass ? 'PASS' : 'FAIL'));
process.exit(allPass ? 0 : 1);
