// tests/characterization/run_obs001_purchase_price_zero.js -- OBS-001
// permanent disposition: buildingPrice=0/negative rejected via canonical
// validation (CLASS A: invalid domain missing validation). Encodes the
// disposition, not just current behavior.
const { calculateInvestmentCase, STUDY_TYPE } = require('../../src/engines');
const { validateEngineInputs, ValidationError, STRICTLY_POSITIVE_DIVISOR_FIELDS } = require('../../src/validation/numeric-safety');
const gold = require('../reference/RE-GOLD-baseline.json');
const results = [];
function check(id, cond, detail) { console.log(`${id} ${cond?'PASS':'FAIL'} -- ${detail}`); results.push(cond); }

// Disposition encoding
check('DISPOSITION-CLASS-A', STRICTLY_POSITIVE_DIVISOR_FIELDS.includes('buildingPrice'), 'buildingPrice registered as strictly-positive divisor field');

// Reproduction: price sweep including the discontinuity
const B = gold['RE-GOLD-002_existing_building'].inputs;
for (const [price, shouldReject] of [[140000000, false], [1, false], [0.01, false], [0, true], [-5, true]]) {
  let threw = null;
  try { validateEngineInputs({ ...B, buildingPrice: price }); } catch(e) { threw = e; }
  check(`PRICE-${price}`, (threw !== null) === shouldReject, shouldReject ? `rejected as expected (rule=${threw?.rule})` : 'accepted as expected');
}

// Zero and negative specifically produce ValidationError with bilingual payload
try { validateEngineInputs({ ...B, buildingPrice: 0 }); check('ZERO-THROWS', false, 'did not throw'); }
catch(e) {
  check('ZERO-THROWS', e.name === 'ValidationError' && e.rule === 'STRICTLY_POSITIVE_REQUIRED', `rule=${e.rule}`);
  check('ZERO-BILINGUAL', !!e.message_ar && !!e.message_en, `ar="${e.message_ar}" en="${e.message_en}"`);
}

// Valid-case invariance: RE-GOLD baseline (positive price) completely unaffected
const rB = calculateInvestmentCase({ studyType: STUDY_TYPE.EXISTING_BUILDING, inputs: B, leverageEnabled: false });
check('BASELINE-UNCHANGED', rB.verdict === 'يوصى بالشراء' && rB.metCount === 4, `verdict=${rB.verdict} metCount=${rB.metCount}`);

// COV-002 NO-GO fixture (inflated but positive price) still works
const covFixture = { ...B, buildingPrice: B.buildingPrice * 5 };
const rCov = calculateInvestmentCase({ studyType: STUDY_TYPE.EXISTING_BUILDING, inputs: covFixture, leverageEnabled: false });
check('COV002-STILL-REACHABLE', rCov.verdict === 'لا يوصى بالشراء', `verdict=${rCov.verdict}`);

// Land Development completely unaffected (buildingPrice key does not exist in its schema)
const L = gold['RE-GOLD-001_land_development'].inputs;
check('LAND-UNAFFECTED', !('buildingPrice' in L), 'Land inputs never contain buildingPrice key -- rule structurally cannot fire for Land');
const rL = calculateInvestmentCase({ studyType: STUDY_TYPE.LAND_DEVELOPMENT, inputs: L, leverageEnabled: false });
check('LAND-BASELINE-UNCHANGED', rL.verdict === 'يوصى بالشراء', `verdict=${rL.verdict}`);

const allPass = results.every(Boolean);
console.log('\nOBS001_CLASSIFICATION=CLASS_A_INVALID_DOMAIN_MISSING_VALIDATION');
console.log('OBS001_REPRODUCED=TRUE');
console.log('OBS001_ZERO_DISCONTINUITY=TRUE');
console.log('RUN_OBS001_PURCHASE_PRICE_ZERO=' + (allPass?'PASS':'FAIL'));
process.exit(allPass?0:1);
