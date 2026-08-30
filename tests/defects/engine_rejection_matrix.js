const { calculateInvestmentCase, STUDY_TYPE } = require('../../src/engines');
const { ValidationError } = require('../../src/validation/numeric-safety');
const gold = require(require('../config/paths').getGoldBaselinePath());
const B = gold['RE-GOLD-002_existing_building'].inputs;
const L = gold['RE-GOLD-001_land_development'].inputs;

const cases = [
  ['occupancy=1.5 (building)', STUDY_TYPE.EXISTING_BUILDING, { ...B, occupancyRate: 1.5 }],
  ['occupancy=-0.1 (building)', STUDY_TYPE.EXISTING_BUILDING, { ...B, occupancyRate: -0.1 }],
  ['rentPerSqm=Infinity (building)', STUDY_TYPE.EXISTING_BUILDING, { ...B, rentPerSqm: Infinity }],
  ['buildingPrice=-Infinity (building)', STUDY_TYPE.EXISTING_BUILDING, { ...B, buildingPrice: -Infinity }],
  ['buildingPrice=NaN (building)', STUDY_TYPE.EXISTING_BUILDING, { ...B, buildingPrice: NaN }],
  ['landPricePerSqm=Infinity (land)', STUDY_TYPE.LAND_DEVELOPMENT, { ...L, landPricePerSqm: Infinity }],
  ['ltv=NaN (land)', STUDY_TYPE.LAND_DEVELOPMENT, { ...L, ltv: NaN }],
  ['occupancy=1.0 exactly (building, boundary)', STUDY_TYPE.EXISTING_BUILDING, { ...B, occupancyRate: 1.0 }],
  ['occupancy=0.0 exactly (building, boundary)', STUDY_TYPE.EXISTING_BUILDING, { ...B, occupancyRate: 0.0 }],
  ['all valid (building, control)', STUDY_TYPE.EXISTING_BUILDING, B],
  ['all valid (land, control)', STUDY_TYPE.LAND_DEVELOPMENT, L],
];

let rejected = 0, accepted = 0, wrongBehavior = 0;
for (const [label, studyType, inputs] of cases) {
  let threw = false, isVE = false, errMsg = '';
  try { calculateInvestmentCase({ studyType, inputs, leverageEnabled: false }); }
  catch (e) { threw = true; isVE = e instanceof ValidationError; errMsg = e.message; }
  const shouldReject = /=1\.5|=-0\.1|Infinity|NaN|-Infinity/.test(label) && !/exactly|control/.test(label);
  const correct = shouldReject ? (threw && isVE) : !threw;
  if (threw && isVE) rejected++; else accepted++;
  if (!correct) wrongBehavior++;
  console.log(`${label}: threw=${threw} isValidationError=${isVE} expected_reject=${shouldReject} CORRECT=${correct} ${errMsg ? '('+errMsg.slice(0,60)+')' : ''}`);
}
console.log('');
console.log('ENGINE_REJECTION_CASES_TOTAL=' + cases.length);
console.log('ENGINE_REJECTED=' + rejected);
console.log('ENGINE_ACCEPTED=' + accepted);
console.log('WRONG_BEHAVIOR_COUNT=' + wrongBehavior);
process.exit(wrongBehavior === 0 ? 0 : 1);
