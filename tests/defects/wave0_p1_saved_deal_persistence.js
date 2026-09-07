'use strict';

const {
  prepareNewUiDealForSave,
  prepareUpdatedUiDealForSave,
} = require('../../src/assumptions/ui-integration-controller');
const { ASSUMPTION_MODEL_VERSION } = require('../../src/assumptions/assumption-model');
const gold = require('../reference/RE-GOLD-baseline.json');

const checks = [];
function check(id, condition, detail) {
  console.log(`${id} ${condition ? 'PASS' : 'FAIL'} -- ${detail}`);
  checks.push(Boolean(condition));
}

const building = gold['RE-GOLD-002_existing_building'].inputs;
const land = gold['RE-GOLD-001_land_development'].inputs;
let mutations = 0;

function persistNew(record) {
  const validated = prepareNewUiDealForSave(record);
  mutations += 1;
  return validated;
}

function persistUpdate(record) {
  const validated = prepareUpdatedUiDealForSave(record, ASSUMPTION_MODEL_VERSION.V2);
  mutations += 1;
  return validated;
}

const validNew = persistNew({
  id: 'p1-valid-new',
  name: 'Valid building',
  mode: 'building',
  inputs: { ...building },
  savedAt: '2026-09-06T18:00:00.000Z',
});
check('VALID-NEW-PERSISTS', mutations === 1 && validNew.assumptionModelVersion === ASSUMPTION_MODEL_VERSION.V2, `mutations=${mutations}`);

const beforeInvalidNew = mutations;
let invalidNewBlocked = false;
try {
  persistNew({
    id: 'p1-invalid-new',
    name: 'Invalid building',
    mode: 'building',
    inputs: { ...building, occupancyRate: 2 },
    savedAt: '2026-09-06T18:01:00.000Z',
  });
} catch (error) {
  invalidNewBlocked = error?.name === 'ValidationError';
}
check('INVALID-EDITOR-NEW-NO-MUTATION', invalidNewBlocked && mutations === beforeInvalidNew, `mutations=${mutations}`);

const beforeIncompleteLand = mutations;
const incompleteLand = { ...land };
delete incompleteLand.landPricePerSqm;
let incompleteLandBlocked = false;
try {
  persistNew({
    id: 'p1-incomplete-land',
    name: 'Incomplete land',
    mode: 'land',
    inputs: incompleteLand,
    savedAt: '2026-09-06T18:02:00.000Z',
  });
} catch (error) {
  incompleteLandBlocked = error?.name === 'ValidationError' || error?.failureCode === 'SAVED_DEAL_SEMANTIC_INCOMPLETE';
}
check('INCOMPLETE-LAND-NO-MUTATION', incompleteLandBlocked && mutations === beforeIncompleteLand, `mutations=${mutations}`);

const validUpdated = persistUpdate({
  id: 'p1-valid-new',
  name: 'Valid building',
  mode: 'building',
  inputs: { ...building, buildingPrice: building.buildingPrice + 1000000 },
  savedAt: '2026-09-06T18:03:00.000Z',
});
check('VALID-CORRECTION-PERSISTS', mutations === beforeIncompleteLand + 1 && validUpdated.inputs.buildingPrice === building.buildingPrice + 1000000, `mutations=${mutations}`);

const beforeInvalidUpdate = mutations;
let invalidUpdateBlocked = false;
try {
  persistUpdate({
    id: 'p1-valid-new',
    name: 'Valid building',
    mode: 'building',
    inputs: { ...building, buildingPrice: 0 },
    savedAt: '2026-09-06T18:04:00.000Z',
  });
} catch (error) {
  invalidUpdateBlocked = error?.name === 'ValidationError';
}
check('INVALID-UPDATE-NO-MUTATION', invalidUpdateBlocked && mutations === beforeInvalidUpdate, `mutations=${mutations}`);

const beforeBadTimestamp = mutations;
let badTimestampBlocked = false;
try {
  persistNew({
    id: 'p1-bad-time',
    name: 'Bad time',
    mode: 'building',
    inputs: { ...building },
    savedAt: '09/06/2026 18:05',
  });
} catch (error) {
  badTimestampBlocked = error?.failureCode === 'SAVED_DEAL_TIMESTAMP_INVALID';
}
check('BAD-SAVEDAT-NO-MUTATION', badTimestampBlocked && mutations === beforeBadTimestamp, `mutations=${mutations}`);

check('TRANSACTION-AUTHORIZATION-NOT-CREATED', validNew.transactionAuthorized !== true && validUpdated.transactionAuthorized !== true, 'save preparation never authorizes a transaction');

const pass = checks.every(Boolean);
console.log(`\nWAVE0_P1_SAVED_DEAL_PERSISTENCE=${pass ? 'PASS' : 'FAIL'}`);
process.exit(pass ? 0 : 1);