'use strict';

const { calculateInvestmentCase, STUDY_TYPE } = require('../../src/engines');
const { validateEngineInputs } = require('../../src/validation/numeric-safety');
const gold = require('../reference/RE-GOLD-baseline.json');
const results = [];
function check(id, cond, detail) { console.log(`${id} ${cond ? 'PASS' : 'FAIL'} -- ${detail}`); results.push(cond); }

const L = gold['RE-GOLD-001_land_development'].inputs;
for (const [factor, shouldReject] of [[1, false], [0.01, false], [0.0001, false], [0, true]]) {
  const test = {
    ...L,
    landPricePerSqm: L.landPricePerSqm * factor,
    engineeringCost: L.engineeringCost * factor,
    landValuationCost: L.landValuationCost * factor,
    constructionCostPerSqm: L.constructionCostPerSqm * factor,
  };
  let threw = null;
  try { validateEngineInputs(test); } catch (e) { threw = e; }
  check(`FACTOR-${factor}`, (threw !== null) === shouldReject, shouldReject ? `rejected field=${threw?.field}` : 'accepted');
}

try {
  validateEngineInputs({ ...L, landPricePerSqm: 0, engineeringCost: 0, landValuationCost: 0, constructionCostPerSqm: 0 });
  check('ZERO-THROWS', false, 'did not throw');
} catch (e) {
  check('ZERO-BILINGUAL', !!e.message_ar && !!e.message_en && e.field === 'totalProjectCost', `field=${e.field}`);
}

const B = gold['RE-GOLD-002_existing_building'].inputs;
check('BUILDING-UNAFFECTED', !('buildableRatio' in B), 'Land aggregate guard is structurally isolated');
try { validateEngineInputs(B); check('BUILDING-STILL-VALID', true, 'accepted'); }
catch (e) { check('BUILDING-STILL-VALID', false, `unexpected ${e.rule}`); }

const rL = calculateInvestmentCase({ studyType: STUDY_TYPE.LAND_DEVELOPMENT, inputs: L, leverageEnabled: false });
check('LAND-CALCULATES-WAVE-A', /^LAND_WAVE_A_/.test(rL.financialModelVersion) && Number.isFinite(rL.stabilizedNOI), `version=${rL.financialModelVersion}`);
const rB = calculateInvestmentCase({ studyType: STUDY_TYPE.EXISTING_BUILDING, inputs: B, leverageEnabled: false });
check('BUILDING-CALCULATES-WAVE-A', /^BUILDING_WAVE_A_/.test(rB.financialModelVersion) && Number.isFinite(rB.NOI), `version=${rB.financialModelVersion}`);

try { validateEngineInputs({ ...B, buildingPrice: 0 }); check('OBS001-REGRESSION', false, 'did not throw'); }
catch (e) { check('OBS001-REGRESSION', e.field === 'buildingPrice', `field=${e.field}`); }

const covFixture = { ...B, buildingPrice: B.buildingPrice * 5 };
const rCov = calculateInvestmentCase({ studyType: STUDY_TYPE.EXISTING_BUILDING, inputs: covFixture, leverageEnabled: false });
check('COV002-REGRESSION', rCov.verdict === 'لا يوصى بالشراء' && rCov.decisionStatus === 'HARD_GATE_FAILED', `status=${rCov.decisionStatus}`);

const allPass = results.every(Boolean);
console.log(`\nRUN_OBS002_LAND_TOTAL_PROJECT_COST_ZERO=${allPass ? 'PASS' : 'FAIL'}`);
process.exit(allPass ? 0 : 1);
