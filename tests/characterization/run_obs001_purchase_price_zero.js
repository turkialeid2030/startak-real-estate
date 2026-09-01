'use strict';

const { calculateInvestmentCase, STUDY_TYPE } = require('../../src/engines');
const { validateEngineInputs, STRICTLY_POSITIVE_DIVISOR_FIELDS } = require('../../src/validation/numeric-safety');
const gold = require('../reference/RE-GOLD-baseline.json');
const results = [];
function check(id, cond, detail) { console.log(`${id} ${cond ? 'PASS' : 'FAIL'} -- ${detail}`); results.push(cond); }

check('DISPOSITION-CLASS-A', STRICTLY_POSITIVE_DIVISOR_FIELDS.includes('buildingPrice'), 'buildingPrice remains strictly positive');
const B = gold['RE-GOLD-002_existing_building'].inputs;
for (const [price, shouldReject] of [[140000000, false], [1, false], [0.01, false], [0, true], [-5, true]]) {
  let threw = null;
  try { validateEngineInputs({ ...B, buildingPrice: price }); } catch (e) { threw = e; }
  check(`PRICE-${price}`, (threw !== null) === shouldReject, shouldReject ? `rejected rule=${threw?.rule}` : 'accepted');
}

try { validateEngineInputs({ ...B, buildingPrice: 0 }); check('ZERO-THROWS', false, 'did not throw'); }
catch (e) {
  check('ZERO-THROWS', e.name === 'ValidationError' && e.rule === 'STRICTLY_POSITIVE_REQUIRED', `rule=${e.rule}`);
  check('ZERO-BILINGUAL', !!e.message_ar && !!e.message_en, 'bilingual payload present');
}

const rB = calculateInvestmentCase({ studyType: STUDY_TYPE.EXISTING_BUILDING, inputs: B, leverageEnabled: false });
check('BASELINE-CALCULATES-WAVE-A', /^BUILDING_WAVE_A_/.test(rB.financialModelVersion) && Number.isFinite(rB.NOI),
  `version=${rB.financialModelVersion} verdict=${rB.verdict}`);

const covFixture = { ...B, buildingPrice: B.buildingPrice * 5 };
const rCov = calculateInvestmentCase({ studyType: STUDY_TYPE.EXISTING_BUILDING, inputs: covFixture, leverageEnabled: false });
check('COV002-STILL-REACHABLE', rCov.verdict === 'لا يوصى بالشراء' && rCov.decisionStatus === 'HARD_GATE_FAILED',
  `verdict=${rCov.verdict} status=${rCov.decisionStatus}`);

const L = gold['RE-GOLD-001_land_development'].inputs;
check('LAND-UNAFFECTED-BY-BUILDINGPRICE-RULE', !('buildingPrice' in L), 'Land schema has no buildingPrice');
const rL = calculateInvestmentCase({ studyType: STUDY_TYPE.LAND_DEVELOPMENT, inputs: L, leverageEnabled: false });
check('LAND-CALCULATES-WAVE-A', /^LAND_WAVE_A_/.test(rL.financialModelVersion) && Number.isFinite(rL.stabilizedNOI), `version=${rL.financialModelVersion}`);

const allPass = results.every(Boolean);
console.log(`\nRUN_OBS001_PURCHASE_PRICE_ZERO=${allPass ? 'PASS' : 'FAIL'}`);
process.exit(allPass ? 0 : 1);
