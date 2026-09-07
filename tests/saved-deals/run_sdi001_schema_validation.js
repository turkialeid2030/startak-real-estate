'use strict';

const {
  validateSavedDealRecord,
  SAVED_DEAL_FAILURE_CODE,
} = require('../../src/validation/saved-deal-schema');
const { legacySavedDealToInvestmentCase } = require('../../src/migrations/legacy-saved-deal-adapter');
const { calculateInvestmentCase, STUDY_TYPE } = require('../../src/engines');
const gold = require('../reference/RE-GOLD-baseline.json');
const results = [];
function check(id, cond, detail) { console.log(`${id} ${cond?'PASS':'FAIL'} -- ${detail}`); results.push(cond); }
function rejection(record) {
  try { validateSavedDealRecord(record); return null; }
  catch (error) { return error; }
}

const malformed = [
  ['null', null], ['array', [1,2,3]], ['string', 'x'], ['number', 42],
  ['missing-mode', { inputs: {}, savedAt: '2026-01-01' }], ['unknown-mode', { mode: 'xyz', inputs: {}, savedAt: '2026-01-01' }],
  ['missing-inputs', { mode: 'building', savedAt: '2026-01-01' }], ['inputs-null', { mode: 'building', inputs: null, savedAt: '2026-01-01' }],
  ['inputs-array', { mode: 'building', inputs: [], savedAt: '2026-01-01' }], ['inputs-primitive', { mode: 'land', inputs: 5, savedAt: '2026-01-01' }],
  ['id-wrong-type', { mode: 'building', inputs: {}, id: 123, savedAt: '2026-01-01' }],
  ['name-wrong-type', { mode: 'building', inputs: {}, name: [], savedAt: '2026-01-01' }],
];
let rejectedCount = 0;
for (const [label, val] of malformed) {
  const error = rejection(val);
  check(`MALFORMED-${label}`, Boolean(error && error.reasonCode && error.failureCode), `rejected, reasonCode=${error?.reasonCode}, failureCode=${error?.failureCode}`);
  if (error) rejectedCount++;
}
check('ALL-12-MALFORMED-REJECTED', rejectedCount === 12, `${rejectedCount}/12`);

const B = gold['RE-GOLD-002_existing_building'].inputs;
const L = gold['RE-GOLD-001_land_development'].inputs;
const validRecord = { id: 'd1', name: 'Test', mode: 'building', inputs: { ...B }, savedAt: '2026-01-01' };
const beforeJSON = JSON.stringify(validRecord);
const returned = validateSavedDealRecord(validRecord);
check('NON-DESTRUCTIVE', JSON.stringify(validRecord) === beforeJSON && returned === validRecord, 'same object reference, unchanged content');

try { validateSavedDealRecord(null); } catch(e) {
  check('NO-STACK-IN-MESSAGE', !e.message.includes('at ') && !e.message.includes('.js:'), 'no stack/path leakage');
  check('SAFE-FAILURE-CODE', e.failureCode === SAVED_DEAL_FAILURE_CODE.SCHEMA_INVALID, `failureCode=${e.failureCode}`);
}

const validBuildingRecord = { id: 'b1', name: 'Building', mode: 'building', inputs: { ...B }, savedAt: '2026-01-01T00:00:00.000Z' };
const validLandRecord = { id: 'l1', name: 'Land', mode: 'land', inputs: { ...L }, savedAt: '2026-01-01' };
check('VALID-BUILDING-PASSES', !rejection(validBuildingRecord), 'valid Building record accepted');
check('VALID-LAND-PASSES', !rejection(validLandRecord), 'valid Land record accepted');

const missingBuilding = { ...validBuildingRecord, inputs: { ...B } };
delete missingBuilding.inputs.buildingPrice;
const missingBuildingError = rejection(missingBuilding);
check('MISSING-BUILDING-FIELD-FAILS', missingBuildingError?.failureCode === SAVED_DEAL_FAILURE_CODE.SEMANTIC_INCOMPLETE, `failureCode=${missingBuildingError?.failureCode}`);

const missingLand = { ...validLandRecord, inputs: { ...L } };
delete missingLand.inputs.landPricePerSqm;
const missingLandError = rejection(missingLand);
check('MISSING-LAND-FIELD-FAILS', missingLandError?.failureCode === SAVED_DEAL_FAILURE_CODE.SEMANTIC_INCOMPLETE, `failureCode=${missingLandError?.failureCode}`);

const missingTimestamp = { ...validBuildingRecord };
delete missingTimestamp.savedAt;
const missingTimestampError = rejection(missingTimestamp);
check('MISSING-SAVEDAT-FAILS', missingTimestampError?.failureCode === SAVED_DEAL_FAILURE_CODE.TIMESTAMP_INVALID, `failureCode=${missingTimestampError?.failureCode}`);

const malformedTimestampError = rejection({ ...validBuildingRecord, savedAt: '01/01/2026 00:00' });
check('MALFORMED-SAVEDAT-FAILS', malformedTimestampError?.failureCode === SAVED_DEAL_FAILURE_CODE.TIMESTAMP_INVALID, `failureCode=${malformedTimestampError?.failureCode}`);

const unsupportedVersionError = rejection({ ...validBuildingRecord, assumptionModelVersion: 'V999' });
check('UNSUPPORTED-VERSION-FAILS', unsupportedVersionError?.failureCode === SAVED_DEAL_FAILURE_CODE.VERSION_UNSUPPORTED, `failureCode=${unsupportedVersionError?.failureCode}`);

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
console.log('\nSAVED_DEAL_SCHEMA_INVALID=' + SAVED_DEAL_FAILURE_CODE.SCHEMA_INVALID);
console.log('SAVED_DEAL_SEMANTIC_INCOMPLETE=' + SAVED_DEAL_FAILURE_CODE.SEMANTIC_INCOMPLETE);
console.log('SAVED_DEAL_TIMESTAMP_INVALID=' + SAVED_DEAL_FAILURE_CODE.TIMESTAMP_INVALID);
console.log('SAVED_DEAL_VERSION_UNSUPPORTED=' + SAVED_DEAL_FAILURE_CODE.VERSION_UNSUPPORTED);
console.log('RUN_SDI001_SCHEMA_VALIDATION=' + (allPass?'PASS':'FAIL'));
process.exit(allPass?0:1);