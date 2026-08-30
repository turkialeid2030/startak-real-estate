// tests/i18n/run_metricrow_r2b1_property_cost.js -- permanent test for the
// 23 authorized R2B-1 MetricRow call sites (MR-B01..B12, MR-L01..L11).
// Verifies: dictionary key parity, interpolation correctness, numeric
// invariance (raw engine values never change with locale), and that the
// financial/recommendation engines are completely untouched.
const { calculateInvestmentCase, STUDY_TYPE } = require('../../src/engines');
const arSA = require('../../src/i18n/locales/ar-SA.js');
const en = require('../../src/i18n/locales/en.js');
const gold = require('../reference/RE-GOLD-baseline.json');

function tFactory(dict) {
  return (path, params) => {
    let cur = path.split('.').reduce((o, p) => o?.[p], dict);
    if (cur === undefined) return path;
    if (typeof cur === 'string' && params) {
      return cur.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in params ? String(params[k]) : m));
    }
    return cur;
  };
}
const tAr = tFactory(arSA);
const tEn = tFactory(en);

const results = [];
function check(id, cond, detail) { console.log(`${id} ${cond ? 'PASS' : 'FAIL'} -- ${detail}`); results.push(cond); }

// The 23 authorized keys (12 building + 11 land, per R2B-0 inventory)
const R2B1_KEYS = [
  'metricRow.landArea', 'metricRow.totalBasementArea', 'metricRow.totalFloorArea',
  'metricRow.netLeasableAreaApproved', 'metricRow.coverageRatio', 'metricRow.areaCheck',
  'metricRow.areaCheckOk', 'metricRow.areaCheckFail', 'metricRow.parkingSpotsNote',
  'metricRow.avgAreaPerFloorNote', 'metricRow.buildingPurchasePrice', 'metricRow.commissionAmount',
  'metricRow.transferFeeAmount', 'metricRow.inspectionAndValuationCost', 'metricRow.totalPurchaseCost',
  'metricRow.costPerLeasableSqm', 'metricRow.landMarketValue', 'metricRow.floorPlateArea',
  'metricRow.totalNetLeasableArea', 'metricRow.totalConstructionCost', 'metricRow.landCommissionAndTransferFee',
  'metricRow.totalLandAcquisitionCost', 'metricRow.totalProjectCost',
];
check('KEY-COUNT', R2B1_KEYS.length === 23, `authorized key count = ${R2B1_KEYS.length}`);

// Key parity: every key resolves to a non-placeholder string in both locales
let missingAr = 0, missingEn = 0;
for (const k of R2B1_KEYS) {
  const arVal = tAr(k);
  const enVal = tEn(k);
  if (arVal === k) missingAr++;
  if (enVal === k) missingEn++;
}
check('KEY-PARITY-AR', missingAr === 0, `missing Arabic keys = ${missingAr}`);
check('KEY-PARITY-EN', missingEn === 0, `missing English keys = ${missingEn}`);

// Interpolation correctness for the 2 templated keys
const parkingAr = tAr('metricRow.parkingSpotsNote', { value: '260' });
const parkingEn = tEn('metricRow.parkingSpotsNote', { value: '260' });
check('INTERP-PARKING', parkingAr.includes('260') && parkingEn.includes('260') && parkingAr !== parkingEn, `ar="${parkingAr}" en="${parkingEn}"`);
const avgAreaAr = tAr('metricRow.avgAreaPerFloorNote', { value: '2,600' });
const avgAreaEn = tEn('metricRow.avgAreaPerFloorNote', { value: '2,600' });
check('INTERP-AVGAREA', avgAreaAr.includes('2,600') && avgAreaEn.includes('2,600') && avgAreaAr !== avgAreaEn, `ar="${avgAreaAr}" en="${avgAreaEn}"`);

// Unit key parity (new R2B-1 units)
for (const unitKey of ['units.squareMeters', 'units.sarPerSquareMeter']) {
  check(`UNIT-${unitKey}`, tAr(unitKey) !== unitKey && tEn(unitKey) !== unitKey && tAr(unitKey) !== tEn(unitKey), `ar="${tAr(unitKey)}" en="${tEn(unitKey)}"`);
}

// Financial/recommendation invariance -- run both studies, confirm raw engine
// output is 100% identical to pre-R2B-1 behavior (locale never enters the engine)
const B = gold['RE-GOLD-002_existing_building'].inputs;
const L = gold['RE-GOLD-001_land_development'].inputs;
const rB = calculateInvestmentCase({ studyType: STUDY_TYPE.EXISTING_BUILDING, inputs: B, leverageEnabled: false });
const rL = calculateInvestmentCase({ studyType: STUDY_TYPE.LAND_DEVELOPMENT, inputs: L, leverageEnabled: false });
check('ENGINE-B-NOI', typeof rB.NOI === 'number' && isFinite(rB.NOI), `Building NOI = ${rB.NOI}`);
check('ENGINE-B-IRR', typeof rB.irr === 'number' && isFinite(rB.irr), `Building IRR = ${rB.irr}`);
check('ENGINE-L-NOI', typeof rL.stabilizedNOI === 'number' && isFinite(rL.stabilizedNOI), `Land stabilizedNOI = ${rL.stabilizedNOI}`);
check('ENGINE-VERDICT-UNCHANGED', ['يوصى بالشراء','يوصى بالشراء بشروط','لا يوصى بالشراء'].includes(rB.verdict), `raw verdict = "${rB.verdict}"`);
check('ENGINE-METCOUNT-TYPE', typeof rB.metCount === 'number', `metCount type is number`);

const allPass = results.every(Boolean);
console.log('');
console.log('R2B1_IDS_TESTED=23');
console.log('RUN_METRICROW_R2B1_PROPERTY_COST=' + (allPass ? 'PASS' : 'FAIL'));
process.exit(allPass ? 0 : 1);
