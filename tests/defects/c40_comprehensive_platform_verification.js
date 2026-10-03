'use strict';

const assert = require('assert');
const { calculateInvestmentCase, STUDY_TYPE, VACANCY_MONTHS_MAP } = require('../../src/engines');
const { C40_PROPERTY_SIMULATION_MATRIX } = require('../fixtures/c40_property_simulation_matrix');

function approx(actual, expected, tolerance = 1e-8, label = 'value') {
  const scale = Math.max(1, Math.abs(expected));
  assert.ok(Math.abs(actual - expected) <= tolerance * scale, `${label}: expected ${expected}, got ${actual}`);
}

function assertFiniteTree(value, path = 'result') {
  if (typeof value === 'number') {
    assert.ok(Number.isFinite(value), `${path} must be finite, got ${value}`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertFiniteTree(item, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) assertFiniteTree(child, `${path}.${key}`);
  }
}

function stable(value) {
  return JSON.parse(JSON.stringify(value));
}

function runScenario(scenario) {
  return calculateInvestmentCase({
    studyType: scenario.studyType,
    inputs: { ...scenario.inputs },
    leverageEnabled: scenario.leverageEnabled,
  });
}

let buildingCount = 0;
let landCount = 0;
let zeroIncomeCount = 0;
let leveragedCount = 0;

for (const scenario of C40_PROPERTY_SIMULATION_MATRIX) {
  const result = runScenario(scenario);
  const rerun = runScenario(scenario);

  assert.deepStrictEqual(stable(result), stable(rerun), `${scenario.id} must be deterministic`);
  assertFiniteTree(result, scenario.id);
  assert.ok(Array.isArray(result.cashflows), `${scenario.id} must expose cashflows`);
  assert.ok(result.cashflows.length >= 2, `${scenario.id} must expose a usable cashflow horizon`);
  assert.ok(result.priceBasis && result.priceBasis.version, `${scenario.id} must expose price-basis governance`);
  assert.ok(result.timingBasis && result.timingBasis.version, `${scenario.id} must expose timing-basis governance`);

  if (scenario.studyType === STUDY_TYPE.EXISTING_BUILDING) {
    buildingCount += 1;
    const i = scenario.inputs;
    approx(result.landArea, i.landLength * i.landWidth, 1e-10, `${scenario.id}.landArea`);
    approx(result.totalFloorArea, i.floorCount * i.floorAreaEach, 1e-10, `${scenario.id}.totalFloorArea`);
    const expectedNla = i.netLeasableOverride > 0 ? i.netLeasableOverride : result.totalFloorArea * i.efficiencyRatio;
    approx(result.netLeasableArea, expectedNla, 1e-10, `${scenario.id}.netLeasableArea`);

    // Existing-building Wave A defines grossRentalIncome as stabilized occupied
    // rent (NLA x rent x occupancy). Lease-status vacancy is a separate one-time
    // lease-up factor used only for first-year economics. Keep those concepts
    // explicit so C40 does not regress to double-counting or omitting vacancy.
    const expectedStabilizedGrossRentalIncome = result.netLeasableArea * i.rentPerSqm * i.occupancyRate;
    approx(result.grossRentalIncome, expectedStabilizedGrossRentalIncome, 1e-10, `${scenario.id}.grossRentalIncome`);
    approx(result.stabilizedGrossRentalIncome, expectedStabilizedGrossRentalIncome, 1e-10, `${scenario.id}.stabilizedGrossRentalIncome`);

    const expectedVacancyMonths = VACANCY_MONTHS_MAP[i.leaseStatus] ?? 0;
    const expectedInitialLeaseUpFactor = Math.min(1, Math.max(0, 1 - Math.max(0, expectedVacancyMonths) / 12));
    assert.strictEqual(result.vacancyMonths, expectedVacancyMonths, `${scenario.id}.vacancyMonths`);
    approx(result.initialLeaseUpFactor, expectedInitialLeaseUpFactor, 1e-10, `${scenario.id}.initialLeaseUpFactor`);

    const expectedFirstYearRentalIncome = expectedStabilizedGrossRentalIncome * expectedInitialLeaseUpFactor;
    const expectedStabilizedServiceIncome = expectedStabilizedGrossRentalIncome * i.serviceIncomeRate;
    const expectedFirstYearServiceIncome = expectedFirstYearRentalIncome * i.serviceIncomeRate;
    approx(result.vacancyDeduction, expectedStabilizedGrossRentalIncome - expectedFirstYearRentalIncome, 1e-10, `${scenario.id}.vacancyDeduction`);
    approx(result.rentalIncomeAfterVacancy, expectedFirstYearRentalIncome, 1e-10, `${scenario.id}.rentalIncomeAfterVacancy`);
    approx(result.serviceIncome, expectedStabilizedServiceIncome, 1e-10, `${scenario.id}.serviceIncome`);
    approx(result.firstYearServiceIncome, expectedFirstYearServiceIncome, 1e-10, `${scenario.id}.firstYearServiceIncome`);
    approx(result.totalAnnualIncome, expectedStabilizedGrossRentalIncome + expectedStabilizedServiceIncome, 1e-10, `${scenario.id}.totalAnnualIncome`);
    approx(result.firstYearTotalAnnualIncome, expectedFirstYearRentalIncome + expectedFirstYearServiceIncome, 1e-10, `${scenario.id}.firstYearTotalAnnualIncome`);

    assert.strictEqual(result.costApproachAccreditedValuation, false, `${scenario.id} must not claim accredited valuation`);
    assert.strictEqual(result.costApproachMarketValueDetermined, false, `${scenario.id} cost approach must not claim market value`);
    assert.strictEqual(result.totalAppraisedValueLegacyAlias, true, `${scenario.id} legacy alias disclosure must remain explicit`);
  } else {
    landCount += 1;
    const i = scenario.inputs;
    approx(result.landArea, i.landLength * i.landWidth, 1e-10, `${scenario.id}.landArea`);
    approx(result.floorPlateArea, result.landArea * i.buildableRatio, 1e-10, `${scenario.id}.floorPlateArea`);
    approx(result.serviceAreaPerFloor, result.floorPlateArea * i.servicesRatioPerFloor, 1e-10, `${scenario.id}.serviceAreaPerFloor`);
    approx(result.netLeasableAreaPerFloor, result.floorPlateArea - result.serviceAreaPerFloor, 1e-10, `${scenario.id}.netLeasableAreaPerFloor`);
    approx(result.totalNetLeasableArea, result.netLeasableAreaPerFloor * i.officeFloorCount, 1e-10, `${scenario.id}.totalNetLeasableArea`);
    approx(result.grossRentalIncome, result.totalNetLeasableArea * i.marketRentPerSqm, 1e-10, `${scenario.id}.grossRentalIncome`);
    approx(result.actualRentalIncome, result.grossRentalIncome * i.occupancyRate, 1e-10, `${scenario.id}.actualRentalIncome`);
    approx(result.serviceIncome, result.actualRentalIncome * i.serviceIncomeRate, 1e-10, `${scenario.id}.serviceIncome`);
    approx(result.totalOperatingRevenue, result.actualRentalIncome + result.serviceIncome, 1e-10, `${scenario.id}.totalOperatingRevenue`);
  }

  if (scenario.expectedIncomeMode === 'ZERO') {
    zeroIncomeCount += 1;
    if (scenario.studyType === STUDY_TYPE.EXISTING_BUILDING) {
      assert.strictEqual(result.grossRentalIncome, 0, `${scenario.id} must keep gross rent at zero`);
      assert.strictEqual(result.rentalIncomeAfterVacancy, 0, `${scenario.id} must keep post-vacancy rent at zero`);
      assert.strictEqual(result.serviceIncome, 0, `${scenario.id} must not manufacture service income`);
      assert.strictEqual(result.totalAnnualIncome, 0, `${scenario.id} must keep annual income at zero`);
    } else {
      assert.strictEqual(result.grossRentalIncome, 0, `${scenario.id} must keep gross rent at zero`);
      assert.strictEqual(result.actualRentalIncome, 0, `${scenario.id} must keep actual rent at zero`);
      assert.strictEqual(result.serviceIncome, 0, `${scenario.id} must not manufacture service income`);
      assert.strictEqual(result.totalOperatingRevenue, 0, `${scenario.id} must keep operating revenue at zero`);
    }
  }

  if (scenario.expectedLeverageMode === 'LEVERED') {
    leveragedCount += 1;
    assert.ok(result.loanAmount > 0, `${scenario.id} leveraged case must have debt`);
    assert.ok(result.debtService > 0, `${scenario.id} leveraged case must have debt service`);
    assert.ok(Array.isArray(result.leveredCashflows), `${scenario.id} leveraged case must expose levered cashflows`);
  }

  if (scenario.expectedLeverageMode === 'ZERO_DEBT_NORMALIZED') {
    leveragedCount += 1;
    assert.strictEqual(result.loanAmount, 0, `${scenario.id} zero-debt request must normalize loan amount to zero`);
    assert.strictEqual(result.debtService, 0, `${scenario.id} zero-debt request must normalize debt service to zero`);
    assert.strictEqual(result.dscrMin, null, `${scenario.id} zero-debt request must not manufacture DSCR`);
    assert.deepStrictEqual(result.leveredCashflows, result.cashflows, `${scenario.id} zero-debt levered cashflows must equal unlevered cashflows`);
    approx(result.leveredNPV, result.npv, 1e-10, `${scenario.id}.zeroDebtLeveredNPV`);
  }
}

assert.throws(
  () => calculateInvestmentCase({ studyType: 'WAREHOUSE', inputs: {}, leverageEnabled: false }),
  /unknown studyType/,
  'unsupported standalone property types must fail closed instead of silently mapping to an engine',
);

const canonicalBuilding = C40_PROPERTY_SIMULATION_MATRIX.find((item) => item.studyType === STUDY_TYPE.EXISTING_BUILDING);
assert(canonicalBuilding, 'building scenario required');
assert.throws(
  () => calculateInvestmentCase({
    studyType: STUDY_TYPE.EXISTING_BUILDING,
    inputs: { ...canonicalBuilding.inputs, buildingPrice: Number.NaN },
    leverageEnabled: false,
  }),
  /finite|number|buildingPrice/i,
  'NaN input must fail closed',
);
assert.throws(
  () => calculateInvestmentCase({
    studyType: STUDY_TYPE.EXISTING_BUILDING,
    inputs: { ...canonicalBuilding.inputs, occupancyRate: 1.01 },
    leverageEnabled: false,
  }),
  /occupancyRate|range|between/i,
  'invalid percentage must fail closed',
);

assert.strictEqual(C40_PROPERTY_SIMULATION_MATRIX.length, 13, 'C40 scenario matrix must stay explicit and reviewable');
assert.ok(buildingCount >= 8, 'existing-building archetype coverage must remain broad');
assert.ok(landCount >= 5, 'land-development archetype coverage must remain broad');
assert.strictEqual(zeroIncomeCount, 2, 'both valuation families must include zero-income simulation');

console.log('C40_COMPREHENSIVE_PLATFORM_VERIFICATION=PASS');
console.log(`C40_PROPERTY_SCENARIO_COUNT=${C40_PROPERTY_SIMULATION_MATRIX.length}`);
console.log(`C40_EXISTING_BUILDING_SCENARIO_COUNT=${buildingCount}`);
console.log(`C40_LAND_DEVELOPMENT_SCENARIO_COUNT=${landCount}`);
console.log(`C40_ZERO_INCOME_SCENARIO_COUNT=${zeroIncomeCount}`);
console.log(`C40_LEVERAGE_SEMANTICS_SCENARIO_COUNT=${leveragedCount}`);
console.log('C40_COST_APPROACH_AUTHORITY_SEPARATION=PASS');
console.log('C40_NONFINITE_AND_RANGE_GUARDS=PASS');
