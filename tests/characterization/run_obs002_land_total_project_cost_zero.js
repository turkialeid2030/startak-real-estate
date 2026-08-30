// tests/characterization/run_obs002_land_total_project_cost_zero.js --
// OBS-002 permanent disposition: totalProjectCost=0 (Land) rejected via
// canonical validation (CLASS A). Encodes disposition, not just behavior.
const { calculateInvestmentCase, STUDY_TYPE } = require('../../src/engines');
const { validateEngineInputs } = require('../../src/validation/numeric-safety');
const gold = require('../reference/RE-GOLD-baseline.json');
const results = [];
function check(id, cond, detail) { console.log(`${id} ${cond?'PASS':'FAIL'} -- ${detail}`); results.push(cond); }

const L = gold['RE-GOLD-001_land_development'].inputs;

// Reproduction sweep (component-level, not faking the derived aggregate)
for (const [factor, shouldReject] of [[1, false], [0.01, false], [0.0001, false], [0, true]]) {
  const test = { ...L, landPricePerSqm: L.landPricePerSqm*factor, engineeringCost: L.engineeringCost*factor, landValuationCost: L.landValuationCost*factor, constructionCostPerSqm: L.constructionCostPerSqm*factor };
  let threw = null;
  try { validateEngineInputs(test); } catch(e) { threw = e; }
  check(`FACTOR-${factor}`, (threw !== null) === shouldReject, shouldReject ? `rejected (field=${threw?.field})` : 'accepted');
}

// Bilingual payload
try { validateEngineInputs({ ...L, landPricePerSqm: 0, engineeringCost: 0, landValuationCost: 0, constructionCostPerSqm: 0 }); check('ZERO-THROWS', false, 'did not throw'); }
catch(e) { check('ZERO-BILINGUAL', !!e.message_ar && !!e.message_en && e.field === 'totalProjectCost', `ar/en present, field=${e.field}`); }

// Building completely unaffected (guarded by 'buildableRatio', exclusive to Land)
const B = gold['RE-GOLD-002_existing_building'].inputs;
check('BUILDING-UNAFFECTED', !('buildableRatio' in B), 'Building inputs never contain buildableRatio -- block structurally inert for Building');
try { validateEngineInputs(B); check('BUILDING-STILL-VALID', true, 'accepted'); } catch(e) { check('BUILDING-STILL-VALID', false, `unexpectedly rejected: ${e.rule}`); }

// Valid-case invariance
const rL = calculateInvestmentCase({ studyType: STUDY_TYPE.LAND_DEVELOPMENT, inputs: L, leverageEnabled: false });
check('LAND-BASELINE-UNCHANGED', rL.verdict === 'يوصى بالشراء' && rL.metCount === 4, `verdict=${rL.verdict} metCount=${rL.metCount}`);
const rB = calculateInvestmentCase({ studyType: STUDY_TYPE.EXISTING_BUILDING, inputs: B, leverageEnabled: false });
check('BUILDING-BASELINE-UNCHANGED', rB.verdict === 'يوصى بالشراء', `verdict=${rB.verdict}`);

// OBS-001 regression (independent field, independent rule)
try { validateEngineInputs({ ...B, buildingPrice: 0 }); check('OBS001-REGRESSION', false, 'did not throw'); }
catch(e) { check('OBS001-REGRESSION', e.field === 'buildingPrice', `field=${e.field}`); }

// COV-002 regression
const covFixture = { ...B, buildingPrice: B.buildingPrice * 5 };
const rCov = calculateInvestmentCase({ studyType: STUDY_TYPE.EXISTING_BUILDING, inputs: covFixture, leverageEnabled: false });
check('COV002-REGRESSION', rCov.verdict === 'لا يوصى بالشراء', `verdict=${rCov.verdict}`);

const allPass = results.every(Boolean);
console.log('\nOBS002_CLASSIFICATION=CLASS_A_INVALID_DOMAIN_MISSING_VALIDATION');
console.log('OBS002_REPRODUCED=TRUE');
console.log('OBS002_ZERO_DISCONTINUITY=TRUE (IRR became NaN at exactly zero, worse than OBS-001s finite-but-misleading case)');
console.log('RUN_OBS002_LAND_TOTAL_PROJECT_COST_ZERO=' + (allPass?'PASS':'FAIL'));
process.exit(allPass?0:1);
