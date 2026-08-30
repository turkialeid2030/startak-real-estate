// Re-implements the bounded-occupancy scenario-generation logic verbatim
// (extracted from App.jsx) as a standalone unit test target.
function boundedOccupancyValue(key, requestedValue) {
  if (key !== "occupancyRate") return { effectiveValue: requestedValue, boundaryLimited: false, boundaryReason: null };
  const effectiveValue = Math.min(1, Math.max(0, requestedValue));
  const boundaryLimited = effectiveValue !== requestedValue;
  return { effectiveValue, boundaryLimited, boundaryReason: boundaryLimited ? "OCCUPANCY_MAX_100_PERCENT" : null };
}

const { calculateInvestmentCase, STUDY_TYPE } = require('../../src/engines');
const { ValidationError } = require('../../src/validation/numeric-safety');
const gold = require(require('../config/paths').getGoldBaselinePath());
const B = gold['RE-GOLD-002_existing_building'].inputs;

let allPass = true;
function check(id, cond, detail) { console.log(`${id} ${cond ? 'PASS' : 'FAIL'} -- ${detail}`); if (!cond) allPass = false; }

// SENS-OCC-01: base=.90, factor=1.10 -> requested=.99, effective=.99, boundaryLimited=false
{
  const r = boundedOccupancyValue('occupancyRate', 0.90 * 1.10);
  check('SENS-OCC-01', Math.abs(r.effectiveValue - 0.99) < 1e-9 && r.boundaryLimited === false,
    `effective=${r.effectiveValue} boundaryLimited=${r.boundaryLimited}`);
}

// SENS-OCC-02: base=1.00, factor=1.10 -> requested=1.10, effective=1.00, boundaryLimited=true
{
  const requested = 1.00 * 1.10;
  const r = boundedOccupancyValue('occupancyRate', requested);
  check('SENS-OCC-02', Math.abs(requested - 1.10) < 1e-9 && r.effectiveValue === 1.00 && r.boundaryLimited === true && r.boundaryReason === 'OCCUPANCY_MAX_100_PERCENT',
    `requested=${requested} effective=${r.effectiveValue} boundaryLimited=${r.boundaryLimited} reason=${r.boundaryReason}`);
}

// SENS-OCC-03: base=.05, severe downside (factor=0.9 -> .045, still >=0; test explicit <0 case with a smaller factor to actually cross zero)
{
  const r1 = boundedOccupancyValue('occupancyRate', 0.05 * 0.9); // .045, does not cross 0 -- document this explicitly
  console.log(`  (0.05 * 0.9 = ${(0.05*0.9).toFixed(4)} does not actually go below 0 with the real ±10% factor -- testing the boundary function directly with a value that DOES cross 0 instead)`);
  const r2 = boundedOccupancyValue('occupancyRate', -0.01); // direct negative to prove the floor works
  check('SENS-OCC-03', r2.effectiveValue === 0 && r2.boundaryLimited === true,
    `effective=${r2.effectiveValue} boundaryLimited=${r2.boundaryLimited} (floor-bound proven directly)`);
}

// SENS-OCC-04: engine direct occupancy=1.10 -> REJECT
{
  let threw = false, isValidationError = false;
  try { calculateInvestmentCase({ studyType: STUDY_TYPE.EXISTING_BUILDING, inputs: { ...B, occupancyRate: 1.10 }, leverageEnabled: false }); }
  catch (e) { threw = true; isValidationError = e instanceof ValidationError; }
  check('SENS-OCC-04', threw && isValidationError, `threw=${threw} isValidationError=${isValidationError}`);
}

// SENS-OCC-05: engine direct occupancy=-.01 -> REJECT
{
  let threw = false, isValidationError = false;
  try { calculateInvestmentCase({ studyType: STUDY_TYPE.EXISTING_BUILDING, inputs: { ...B, occupancyRate: -0.01 }, leverageEnabled: false }); }
  catch (e) { threw = true; isValidationError = e instanceof ValidationError; }
  check('SENS-OCC-05', threw && isValidationError, `threw=${threw} isValidationError=${isValidationError}`);
}

console.log('');
console.log('SENSITIVITY_BOUNDARY_LIMITING=' + (allPass ? 'PASS' : 'FAIL'));
process.exit(allPass ? 0 : 1);
