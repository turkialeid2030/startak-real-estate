'use strict';

const { validateSavedDealRecord } = require('../../src/validation/saved-deal-schema');
const { legacySavedDealToInvestmentCase } = require('../../src/migrations/legacy-saved-deal-adapter');
const { calculateInvestmentCase, STUDY_TYPE } = require('../../src/engines');
const gold = require('../reference/RE-GOLD-baseline.json');
const results = [];
function check(id, cond, detail) { console.log(`${id} ${cond?'PASS':'FAIL'} -- ${detail}`); results.push(cond); }

const malformed = [
  ['null', null], ['array', [1,2,3]], ['string', 'x'], ['number', 42],
  ['missing-mode', { inputs: {} }], ['unknown-mode', { mode: 'xyz', inputs: {} }],
  ['missing-inputs', { mode: 'building' }], ['inputs-null', { mode: 'building', inputs: null }],
  ['inputs-array', { mode: 'building', inputs: [] }], ['inputs-primitive', { mode: 'land', inputs: 5 }],
  ['id-wrong-type', { mode: 'building', inputs: {}, id: 123 }],
  ['name-wrong-type', { mode: 'building', inputs: {}, name: [] }],
];
let rejectedCount = 0;
for (const [label, val] of malformed) {
  let threw = false, reasonCode = null;
  try { validateSavedDealRecord(val); } catch(e) { threw = true; reasonCode = e.reasonCode; }
  check(`MALFORMED-${label}`, threw && !!reasonCode, `rejected, reasonCode=${reasonCode}`);
  if (threw) rejectedCount++;
}
check('ALL-12-MALFORMED-REJECTED', rejectedCount === 12, `${rejectedCount}/12`);

const validRecord = { id: 'd1', name: 'Test', mode: 'building', inputs: { buildingPrice: 140000000 }, savedAt: '2026-01-01' };
const beforeJSON = JSON.stringify(validRecord);
const returned = validateSavedDealRecord(validRecord);
check('NON-DESTRUCTIVE', JSON.stringify(validRecord) === beforeJSON && returned === validRecord, 'same object reference, unchanged content');

try { validateSavedDealRecord(null); } catch(e) {
  check('NO-STACK-IN-MESSAGE', !e.message.includes('at ') && !e.message.includes('.js:'), 'no stack/path leakage');
  check('SAFE-REASON-CODE', typeof e.reasonCode === 'string' && !e.reasonCode.includes('/'), 'safe reason code');
}

const B = gold['RE-GOLD-002_existing_building'].inputs;
const L = gold['RE-GOLD-001_land_development'].inputs;
const validBuildingRecord = { id: 'b1', name: 'Building', mode: 'building', inputs: B, savedAt: '2026-01-01' };
const validLandRecord = { id: 'l1', name: 'Land', mode: 'land', inputs: L, savedAt: '2026-01-01' };
check('VALID-BUILDING-PASSES', (() => { try { validateSavedDealRecord(validBuildingRecord); return true; } catch(e) { return false; } })(), 'valid Building record accepted');
check('VALID-LAND-PASSES', (() => { try { validateSavedDealRecord(validLandRecord); return true; } catch(e) { return false; } })(), 'valid Land record accepted');

const rB = calculateInvestmentCase({ studyType: STUDY_TYPE.EXISTING_BUILDING, inputs: B, leverageEnabled: false });
check('VALID-BUILDING-CALC-WAVE-A', /^BUILDING_WAVE_A_/.test(rB.financialModelVersion) && Number.isFinite(rB.NOI), `version=${rB.financialModelVersion}`);

const investmentCase = legacySavedDealToInvestmentCase(validBuildingRecord);
check('LEGACY-ADAPTER-STILL-WORKS', investmentCase.caseId === 'b1' && Object.is(investmentCase.financialModel.irr, rB.irr), 'legacy saved-deal adapter consumes current canonical engine');

const { validateEngineInputs } = require('../../src/validation/numeric-safety');
let obs001Rejects = false;
try { validateEngineInputs({ ...B, buildingPrice: 0 }); } catch(e) { obs001Rejects = e.rule === 'STRICTLY_POSITIVE_REQUIRED'; }
check('OBS001-REGRESSION', obs001Rejects, 'buildingPrice=0 still rejected');

const covFixture = { ...B, buildingPrice: B.buildingPrice * 5 };
const rCov = calculateInvestmentCase({ studyType: STUDY_TYPE.EXISTING_BUILDING, inputs: covFixture, leverageEnabled: false });
check('COV002-REGRESSION', rCov.verdict === 'لا يوصى بالشراء' && rCov.decisionStatus === 'HARD_GATE_FAILED', `status=${rCov.decisionStatus}`);

const allPass = results.every(Boolean);
console.log('\nRUN_SDI001_SCHEMA_VALIDATION=' + (allPass?'PASS':'FAIL'));
process.exit(allPass?0:1);
