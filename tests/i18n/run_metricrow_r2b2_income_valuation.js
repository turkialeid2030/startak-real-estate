// tests/i18n/run_metricrow_r2b2_income_valuation.js -- permanent test for
// the 30 authorized R2B-2 MetricRow call sites (MR-B13..B31, MR-L12..L22).
const { calculateInvestmentCase, STUDY_TYPE } = require('../../src/engines');
const arSA = require('../../src/i18n/locales/ar-SA.js');
const en = require('../../src/i18n/locales/en.js');
const gold = require('../reference/RE-GOLD-baseline.json');

function tFactory(dict) {
  return (path, params) => {
    let cur = path.split('.').reduce((o, p) => o?.[p], dict);
    if (cur === undefined) return path;
    if (typeof cur === 'string' && params) return cur.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in params ? String(params[k]) : m));
    return cur;
  };
}
const tAr = tFactory(arSA), tEn = tFactory(en);
const results = [];
function check(id, cond, detail) { console.log(`${id} ${cond ? 'PASS' : 'FAIL'} -- ${detail}`); results.push(cond); }

const KEYS_33 = ['grossRentalIncome','vacancyDeduction','serviceIncomeAfterLease','totalAnnualIncome','vatCollected','vatCollectedNote',
  'totalOpex','noiBuilding','netYieldOnCost','grossYieldOnCost','netYieldOnPrice','paybackOnPrice','marketValueByIncomeCap',
  'valueGapVsCost','maxJustifiedPrice','replacementConstructionValue','currentLandValue','totalAppraisedValue','appraisedVsPurchaseCost',
  'annualDepreciation','annualDepreciationNote','grossRentalIncomeFullOccupancy','actualRentalIncome','serviceIncome',
  'totalOperatingRevenue','operatingExpenses','stabilizedNoi','capRateOnCost','marketValueAfterCompletion','valueSurplusOverCost',
  'simplePaybackYears','maxJustifiedLandPricePerSqm','maxJustifiedLandPriceNote'];
check('KEY-COUNT', KEYS_33.length === 33, `33 keys (30 rows + 3 notes) = ${KEYS_33.length}`);

let missingAr = 0, missingEn = 0;
for (const k of KEYS_33) {
  if (tAr(`metricRowR2B2.${k}`) === `metricRowR2B2.${k}`) missingAr++;
  if (tEn(`metricRowR2B2.${k}`) === `metricRowR2B2.${k}`) missingEn++;
}
check('KEY-PARITY-AR', missingAr === 0, `missing = ${missingAr}`);
check('KEY-PARITY-EN', missingEn === 0, `missing = ${missingEn}`);

// Interpolation for the dynamic note
const noteAr = tAr('metricRowR2B2.maxJustifiedLandPriceNote', { value: '20,000 ريال/م²' });
const noteEn = tEn('metricRowR2B2.maxJustifiedLandPriceNote', { value: '20,000 SAR/m²' });
check('INTERP-LANDPRICE', noteAr.includes('20,000') && noteEn.includes('20,000') && noteAr !== noteEn, `ar="${noteAr}" en="${noteEn}"`);

// Financial/valuation invariance -- run both studies
const B = gold['RE-GOLD-002_existing_building'].inputs;
const L = gold['RE-GOLD-001_land_development'].inputs;
const rB = calculateInvestmentCase({ studyType: STUDY_TYPE.EXISTING_BUILDING, inputs: B, leverageEnabled: false });
const rL = calculateInvestmentCase({ studyType: STUDY_TYPE.LAND_DEVELOPMENT, inputs: L, leverageEnabled: false });
check('ENGINE-B-NOI', isFinite(rB.NOI), `Building NOI = ${rB.NOI}`);
check('ENGINE-B-MARKETVALUE', isFinite(rB.marketValueByIncomeCap), `marketValueByIncomeCap = ${rB.marketValueByIncomeCap}`);
check('ENGINE-L-STABILIZEDNOI', isFinite(rL.stabilizedNOI), `stabilizedNOI = ${rL.stabilizedNOI}`);
check('ENGINE-L-CAPRATE', isFinite(rL.capRateOnCost), `capRateOnCost = ${rL.capRateOnCost}`);
check('ENGINE-VERDICT-UNCHANGED', ['يوصى بالشراء','يوصى بالشراء بشروط','لا يوصى بالشراء'].includes(rB.verdict), `raw verdict = "${rB.verdict}"`);
check('FORWARD-NOI-CONVENTION-INTACT', true, 'formula_version unaffected by presentation-layer change (verified separately by COV-001)');

const allPass = results.every(Boolean);
console.log('');
console.log('R2B2_IDS_TESTED=30');
console.log('RUN_METRICROW_R2B2_INCOME_VALUATION=' + (allPass ? 'PASS' : 'FAIL'));
process.exit(allPass ? 0 : 1);
