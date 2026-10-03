'use strict';

const assert = require('assert');
const {
  calculateInvestmentCase,
  STUDY_TYPE,
} = require('../../src/engines');
const {
  validateEngineInputs,
  ValidationError,
} = require('../../src/validation/numeric-safety');
const {
  UI_MODE,
  hydrateUiDeal,
  calculateUiInvestmentState,
  prepareNewUiDealForSave,
} = require('../../src/assumptions/ui-integration-controller');
const { validateSavedDealRecord } = require('../../src/validation/saved-deal-schema');
const buildingGold = require('../characterization/fixtures/RE-GOLD-002-U.json');
const landGold = require('../characterization/fixtures/RE-GOLD-001-U.json');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function approx(actual, expected, tolerance = 1e-8, label = 'value') {
  assert.ok(Number.isFinite(actual), `${label} must be finite; got ${actual}`);
  assert.ok(Number.isFinite(expected), `${label} expected value must be finite; got ${expected}`);
  const scale = Math.max(1, Math.abs(expected));
  assert.ok(Math.abs(actual - expected) <= tolerance * scale, `${label}: expected ${expected}, got ${actual}`);
}

function makeRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function between(rng, min, max) {
  return min + (max - min) * rng();
}

function integer(rng, min, max) {
  return Math.floor(between(rng, min, max + 1));
}

function pick(rng, values) {
  return values[Math.min(values.length - 1, Math.floor(rng() * values.length))];
}

function round(value, digits = 6) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function governedNonFiniteAllowed(root, path) {
  const diagnostic = path.includes('leveredIrrDiagnostics') || path.endsWith('.leveredIRR') || path.endsWith('.leveredMirr')
    ? root.leveredIrrDiagnostics
    : root.irrDiagnostics;
  if (path.endsWith('.irr') || path.endsWith('.mirr') || path.endsWith('.leveredIRR') || path.endsWith('.leveredMirr')) {
    return Boolean(diagnostic && diagnostic.reliability && diagnostic.reliability !== 'RELIABLE' && diagnostic.reasonCode);
  }
  if (path.endsWith('.paybackOnCost')) return root.cumulativePaybackOnCost === null;
  if (path.endsWith('.paybackOnPrice')) return root.cumulativePaybackOnPrice === null;
  if (path.endsWith('.simplePaybackYears')) return root.cumulativeProjectPaybackYears === null;
  if (path.endsWith('.priceToNoiMultiple')) return !(root.NOI > 0);
  if (path.endsWith('.projectCostToNoiMultiple')) return !(root.stabilizedNOI > 0);
  return false;
}

function assertNoUnexpectedNonFinite(value, path = 'result', root = value) {
  if (typeof value === 'number') {
    if (Number.isFinite(value)) return;
    assert.ok(Number.isNaN(value) && governedNonFiniteAllowed(root, path), `${path} unexpected non-finite value ${value}`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoUnexpectedNonFinite(item, `${path}[${index}]`, root));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) assertNoUnexpectedNonFinite(child, `${path}.${key}`, root);
  }
}

function randomizedBuilding(seed) {
  const rng = makeRng(seed);
  const input = { ...clone(buildingGold.input_set) };
  const floorCount = integer(rng, 1, 18);
  const floorAreaEach = round(between(rng, 450, 4200), 2);
  const basementCount = integer(rng, 0, 4);
  const leverageEnabled = rng() > 0.5;
  Object.assign(input, {
    landLength: round(between(rng, 20, 180), 2),
    landWidth: round(between(rng, 20, 150), 2),
    buildingAge: integer(rng, 0, 25),
    basementCount,
    basementAreaEach: basementCount === 0 ? 0 : round(between(rng, 500, 9000), 2),
    parkingAreaPerSpot: round(between(rng, 25, 80), 2),
    floorCount,
    floorAreaEach,
    efficiencyRatio: round(between(rng, 0.55, 0.95), 6),
    netLeasableOverride: 0,
    serviceElevators: integer(rng, 0, 12),
    buildingPrice: round(between(rng, 5_000_000, 650_000_000), 2),
    commissionRate: round(between(rng, 0, 0.05), 6),
    transferFeeRate: round(between(rng, 0, 0.08), 6),
    inspectionCost: round(between(rng, 0, 500_000), 2),
    valuationCost: round(between(rng, 0, 300_000), 2),
    rentPerSqm: round(between(rng, 0, 4500), 2),
    occupancyRate: round(between(rng, 0, 1), 6),
    leaseStatus: pick(rng, ['مؤجر', '3 أشهر', '6 أشهر', '9 أشهر', 'سنة']),
    leaseYears: integer(rng, 1, 20),
    vatRate: round(between(rng, 0, 0.2), 6),
    serviceIncomeRate: round(between(rng, 0, 0.25), 6),
    maintenanceRate: round(between(rng, 0, 0.12), 6),
    insuranceRate: round(between(rng, 0, 0.02), 6),
    managementFeeRate: round(between(rng, 0, 0.08), 6),
    fixedOpexPerSqm: round(between(rng, 0, 250), 2),
    replacementReservePerSqm: round(between(rng, 0, 150), 2),
    opexGrowthRate: round(between(rng, -0.03, 0.08), 6),
    replacementCostGrowthRate: round(between(rng, -0.02, 0.08), 6),
    exitCapRate: round(between(rng, 0.04, 0.14), 6),
    exitTransferFeeRate: round(between(rng, 0, 0.08), 6),
    marketCapRate: round(between(rng, 0.04, 0.14), 6),
    discountRate: round(between(rng, 0.04, 0.2), 6),
    holdPeriod: integer(rng, 1, 15),
    rentGrowthRate: round(between(rng, -0.05, 0.12), 6),
    basementConstructionCostPerSqm: round(between(rng, 1500, 6000), 2),
    floorConstructionCostPerSqm: round(between(rng, 1500, 8000), 2),
    currentLandPricePerSqm: round(between(rng, 1000, 50_000), 2),
    buildingUsefulLife: integer(rng, 10, 60),
    minYieldThreshold: round(between(rng, 0.03, 0.18), 6),
    maxPaybackThreshold: round(between(rng, 4, 30), 6),
    leverageEnabled,
    ltv: leverageEnabled ? round(between(rng, 0, 0.85), 6) : 0,
    loanRate: round(between(rng, 0, 0.15), 6),
    loanTenor: integer(rng, 1, 25),
    minDscrThreshold: round(between(rng, 0.8, 2), 6),
    equityRiskSpread: round(between(rng, 0, 0.08), 6),
  });
  return input;
}

function randomizedLand(seed) {
  const rng = makeRng(seed);
  const input = { ...clone(landGold.input_set) };
  const leverageEnabled = rng() > 0.5;
  Object.assign(input, {
    landLength: round(between(rng, 15, 250), 2),
    landWidth: round(between(rng, 15, 220), 2),
    landPricePerSqm: round(between(rng, 500, 45_000), 2),
    buildableRatio: round(between(rng, 0.1, 0.9), 6),
    officeFloorCount: integer(rng, 1, 25),
    servicesRatioPerFloor: round(between(rng, 0.02, 0.45), 6),
    basementFloorCount: integer(rng, 0, 5),
    constructionCostPerSqm: round(between(rng, 1500, 10_000), 2),
    landCommissionRate: round(between(rng, 0, 0.05), 6),
    landTransferFeeRate: round(between(rng, 0, 0.08), 6),
    engineeringCost: round(between(rng, 0, 4_000_000), 2),
    landValuationCost: round(between(rng, 0, 500_000), 2),
    marketRentPerSqm: round(between(rng, 0, 4000), 2),
    occupancyRate: round(between(rng, 0, 1), 6),
    serviceIncomeRate: round(between(rng, 0, 0.25), 6),
    opexRate: round(between(rng, 0, 0.18), 6),
    managementFeeRate: round(between(rng, 0, 0.08), 6),
    fixedOpexPerSqm: round(between(rng, 0, 250), 2),
    insuranceRateOnReplacementCost: round(between(rng, 0, 0.02), 6),
    replacementReservePerSqm: round(between(rng, 0, 150), 2),
    opexGrowthRate: round(between(rng, -0.03, 0.08), 6),
    replacementCostGrowthRate: round(between(rng, -0.02, 0.08), 6),
    leaseUpMonths: integer(rng, 0, 12),
    marketCapRate: round(between(rng, 0.04, 0.14), 6),
    constructionPeriod: integer(rng, 1, 5),
    rentGrowthRate: round(between(rng, -0.05, 0.12), 6),
    operatingPeriod: integer(rng, 1, 20),
    exitCapRate: round(between(rng, 0.04, 0.14), 6),
    hurdleRate: round(between(rng, 0.04, 0.22), 6),
    exitTransferFeeRate: round(between(rng, 0, 0.08), 6),
    maxPaybackThreshold: round(between(rng, 4, 30), 6),
    leverageEnabled,
    ltv: leverageEnabled ? round(between(rng, 0, 0.85), 6) : 0,
    loanRate: round(between(rng, 0, 0.15), 6),
    loanTenor: integer(rng, 1, 25),
    minDscrThreshold: round(between(rng, 0.8, 2), 6),
    equityRiskSpread: round(between(rng, 0, 0.08), 6),
  });
  return input;
}

function run(studyType, inputs) {
  validateEngineInputs(inputs, { studyType });
  return calculateInvestmentCase({
    studyType,
    inputs,
    leverageEnabled: inputs.leverageEnabled,
  });
}

function verifyBuildingArithmetic(input, result, id) {
  const landArea = input.landLength * input.landWidth;
  const totalFloorArea = input.floorCount * input.floorAreaEach;
  const nla = input.netLeasableOverride > 0 ? input.netLeasableOverride : totalFloorArea * input.efficiencyRatio;
  const commission = input.buildingPrice * input.commissionRate;
  const transfer = input.buildingPrice * input.transferFeeRate;
  const purchaseCost = input.buildingPrice + commission + transfer + input.inspectionCost + input.valuationCost;
  const gross = nla * input.rentPerSqm * input.occupancyRate;
  const service = gross * input.serviceIncomeRate;

  approx(result.landArea, landArea, 1e-9, `${id}.landArea`);
  approx(result.totalFloorArea, totalFloorArea, 1e-9, `${id}.totalFloorArea`);
  approx(result.netLeasableArea, nla, 1e-9, `${id}.netLeasableArea`);
  approx(result.commissionAmount, commission, 1e-9, `${id}.commissionAmount`);
  approx(result.transferFeeAmount, transfer, 1e-9, `${id}.transferFeeAmount`);
  approx(result.totalPurchaseCost, purchaseCost, 1e-9, `${id}.totalPurchaseCost`);
  approx(result.grossRentalIncome, gross, 1e-9, `${id}.grossRentalIncome`);
  approx(result.serviceIncome, service, 1e-9, `${id}.serviceIncome`);
  approx(result.totalAnnualIncome, gross + service, 1e-9, `${id}.totalAnnualIncome`);
  assert.ok(result.NOI <= result.totalAnnualIncome + 1e-6, `${id}.NOI cannot exceed revenue when expenses are non-negative`);
  assert.ok(Array.isArray(result.cashflows) && result.cashflows.length === input.holdPeriod + 1, `${id}.cashflow horizon mismatch`);
  approx(result.cashflows[0], -purchaseCost, 1e-9, `${id}.cashflow0`);
  assert.ok(result.priceBasis && result.priceBasis.version, `${id}.priceBasis missing`);
  assert.ok(result.timingBasis && result.timingBasis.version, `${id}.timingBasis missing`);
}

function verifyLandArithmetic(input, result, id) {
  const landArea = input.landLength * input.landWidth;
  const landMarketValue = landArea * input.landPricePerSqm;
  const floorPlate = landArea * input.buildableRatio;
  const serviceArea = floorPlate * input.servicesRatioPerFloor;
  const nlaPerFloor = floorPlate - serviceArea;
  const totalNla = nlaPerFloor * input.officeFloorCount;
  const totalBuiltArea = floorPlate * input.officeFloorCount + landArea * input.basementFloorCount;
  const constructionCost = totalBuiltArea * input.constructionCostPerSqm;
  const acquisitionCost = landMarketValue
    + landMarketValue * input.landCommissionRate
    + landMarketValue * input.landTransferFeeRate
    + input.engineeringCost
    + input.landValuationCost;
  const totalProjectCost = acquisitionCost + constructionCost;
  const gross = totalNla * input.marketRentPerSqm;
  const actual = gross * input.occupancyRate;
  const serviceIncome = actual * input.serviceIncomeRate;

  approx(result.landArea, landArea, 1e-9, `${id}.landArea`);
  approx(result.landMarketValue, landMarketValue, 1e-9, `${id}.landMarketValue`);
  approx(result.floorPlateArea, floorPlate, 1e-9, `${id}.floorPlateArea`);
  approx(result.serviceAreaPerFloor, serviceArea, 1e-9, `${id}.serviceAreaPerFloor`);
  approx(result.netLeasableAreaPerFloor, nlaPerFloor, 1e-9, `${id}.netLeasableAreaPerFloor`);
  approx(result.totalNetLeasableArea, totalNla, 1e-9, `${id}.totalNetLeasableArea`);
  approx(result.totalBuiltArea, totalBuiltArea, 1e-9, `${id}.totalBuiltArea`);
  approx(result.totalConstructionCost, constructionCost, 1e-9, `${id}.totalConstructionCost`);
  approx(result.totalLandAcquisitionCost, acquisitionCost, 1e-9, `${id}.totalLandAcquisitionCost`);
  approx(result.totalProjectCost, totalProjectCost, 1e-9, `${id}.totalProjectCost`);
  approx(result.grossRentalIncome, gross, 1e-9, `${id}.grossRentalIncome`);
  approx(result.actualRentalIncome, actual, 1e-9, `${id}.actualRentalIncome`);
  approx(result.serviceIncome, serviceIncome, 1e-9, `${id}.serviceIncome`);
  approx(result.totalOperatingRevenue, actual + serviceIncome, 1e-9, `${id}.totalOperatingRevenue`);
  assert.ok(result.stabilizedNOI <= result.totalOperatingRevenue + 1e-6, `${id}.NOI cannot exceed revenue when expenses are non-negative`);
  assert.ok(Array.isArray(result.cashflows), `${id}.cashflows missing`);
  assert.strictEqual(result.cashflows.length, 1 + input.constructionPeriod + input.operatingPeriod, `${id}.cashflow horizon mismatch`);
  approx(result.cashflows[0], -acquisitionCost, 1e-9, `${id}.cashflow0`);
  assert.ok(result.priceBasis && result.priceBasis.version, `${id}.priceBasis missing`);
  assert.ok(result.timingBasis && result.timingBasis.version, `${id}.timingBasis missing`);
}

let randomizedCases = 0;
let deterministicReplays = 0;
let metamorphicChecks = 0;
let validationGuardChecks = 0;
let crossLayerChecks = 0;

for (let seed = 1; seed <= 250; seed += 1) {
  const input = randomizedBuilding(0x410000 + seed);
  const result = run(STUDY_TYPE.EXISTING_BUILDING, input);
  const replay = run(STUDY_TYPE.EXISTING_BUILDING, clone(input));
  assert.deepStrictEqual(result, replay, `C41-BLD-${seed} deterministic replay mismatch`);
  verifyBuildingArithmetic(input, result, `C41-BLD-${seed}`);
  assertNoUnexpectedNonFinite(result, `C41-BLD-${seed}`, result);
  randomizedCases += 1;
  deterministicReplays += 1;
}

for (let seed = 1; seed <= 250; seed += 1) {
  const input = randomizedLand(0x420000 + seed);
  const result = run(STUDY_TYPE.LAND_DEVELOPMENT, input);
  const replay = run(STUDY_TYPE.LAND_DEVELOPMENT, clone(input));
  assert.deepStrictEqual(result, replay, `C41-LND-${seed} deterministic replay mismatch`);
  verifyLandArithmetic(input, result, `C41-LND-${seed}`);
  assertNoUnexpectedNonFinite(result, `C41-LND-${seed}`, result);
  randomizedCases += 1;
  deterministicReplays += 1;
}

for (let seed = 1; seed <= 60; seed += 1) {
  const input = randomizedBuilding(0x430000 + seed);
  input.rentPerSqm = Math.max(100, input.rentPerSqm);
  input.occupancyRate = Math.max(0.2, Math.min(0.9, input.occupancyRate));
  const base = run(STUDY_TYPE.EXISTING_BUILDING, input);

  const rentUpInput = { ...input, rentPerSqm: input.rentPerSqm * 1.1 };
  const rentUp = run(STUDY_TYPE.EXISTING_BUILDING, rentUpInput);
  approx(rentUp.grossRentalIncome, base.grossRentalIncome * 1.1, 1e-8, `C41-META-BLD-${seed}.rent`);
  assert.ok(rentUp.NOI >= base.NOI - 1e-6, `C41-META-BLD-${seed} higher rent must not reduce NOI`);
  if (Number.isFinite(base.npv) && Number.isFinite(rentUp.npv)) assert.ok(rentUp.npv >= base.npv - 1e-6, `C41-META-BLD-${seed} higher rent must not reduce NPV`);
  metamorphicChecks += 3;

  const priceUpInput = { ...input, buildingPrice: input.buildingPrice * 1.1 };
  const priceUp = run(STUDY_TYPE.EXISTING_BUILDING, priceUpInput);
  approx(priceUp.grossRentalIncome, base.grossRentalIncome, 1e-9, `C41-META-BLD-${seed}.priceOperationalIsolation`);
  assert.ok(priceUp.totalPurchaseCost > base.totalPurchaseCost, `C41-META-BLD-${seed} higher price must raise acquisition cost`);
  if (Number.isFinite(base.npv) && Number.isFinite(priceUp.npv)) assert.ok(priceUp.npv <= base.npv + 1e-6, `C41-META-BLD-${seed} higher price must not improve NPV`);
  metamorphicChecks += 3;
}

for (let seed = 1; seed <= 60; seed += 1) {
  const input = randomizedLand(0x440000 + seed);
  input.marketRentPerSqm = Math.max(100, input.marketRentPerSqm);
  input.occupancyRate = Math.max(0.2, Math.min(0.9, input.occupancyRate));
  const base = run(STUDY_TYPE.LAND_DEVELOPMENT, input);

  const rentUpInput = { ...input, marketRentPerSqm: input.marketRentPerSqm * 1.1 };
  const rentUp = run(STUDY_TYPE.LAND_DEVELOPMENT, rentUpInput);
  approx(rentUp.grossRentalIncome, base.grossRentalIncome * 1.1, 1e-8, `C41-META-LND-${seed}.rent`);
  assert.ok(rentUp.stabilizedNOI >= base.stabilizedNOI - 1e-6, `C41-META-LND-${seed} higher rent must not reduce NOI`);
  if (Number.isFinite(base.npv) && Number.isFinite(rentUp.npv)) assert.ok(rentUp.npv >= base.npv - 1e-6, `C41-META-LND-${seed} higher rent must not reduce NPV`);
  metamorphicChecks += 3;

  const costUpInput = { ...input, constructionCostPerSqm: input.constructionCostPerSqm * 1.1 };
  const costUp = run(STUDY_TYPE.LAND_DEVELOPMENT, costUpInput);
  assert.ok(costUp.totalConstructionCost > base.totalConstructionCost, `C41-META-LND-${seed} higher construction cost must raise construction cost`);
  assert.ok(costUp.totalProjectCost > base.totalProjectCost, `C41-META-LND-${seed} higher construction cost must raise project cost`);
  if (Number.isFinite(base.npv) && Number.isFinite(costUp.npv)) assert.ok(costUp.npv <= base.npv + 1e-6, `C41-META-LND-${seed} higher construction cost must not improve NPV`);
  metamorphicChecks += 3;
}

function expectValidationFailure(studyType, baseInput, mutation, label) {
  const candidate = { ...clone(baseInput), ...mutation };
  assert.throws(
    () => calculateInvestmentCase({ studyType, inputs: candidate, leverageEnabled: candidate.leverageEnabled }),
    (error) => error instanceof ValidationError || error.name === 'ValidationError',
    label,
  );
  validationGuardChecks += 1;
}

const validBuilding = randomizedBuilding(0x451234);
const validLand = randomizedLand(0x461234);

expectValidationFailure(STUDY_TYPE.EXISTING_BUILDING, validBuilding, { buildingPrice: NaN }, 'building NaN must fail closed');
expectValidationFailure(STUDY_TYPE.EXISTING_BUILDING, validBuilding, { rentPerSqm: Infinity }, 'building Infinity must fail closed');
expectValidationFailure(STUDY_TYPE.EXISTING_BUILDING, validBuilding, { buildingPrice: 0 }, 'zero building price must fail closed');
expectValidationFailure(STUDY_TYPE.EXISTING_BUILDING, validBuilding, { occupancyRate: 1.0001 }, 'occupancy above 100% must fail closed');
expectValidationFailure(STUDY_TYPE.EXISTING_BUILDING, validBuilding, { ltv: 1.01 }, 'LTV above 100% must fail closed');
expectValidationFailure(STUDY_TYPE.EXISTING_BUILDING, validBuilding, { floorCount: 2.5 }, 'fractional floor count must fail closed');
expectValidationFailure(STUDY_TYPE.EXISTING_BUILDING, validBuilding, { leaseStatus: 'UNKNOWN' }, 'unknown lease status must fail closed');
expectValidationFailure(STUDY_TYPE.EXISTING_BUILDING, validBuilding, { marketCapRate: 0 }, 'zero market cap must fail closed');
expectValidationFailure(STUDY_TYPE.EXISTING_BUILDING, validBuilding, { holdPeriod: 0 }, 'zero hold period must fail closed');
expectValidationFailure(STUDY_TYPE.EXISTING_BUILDING, validBuilding, { netLeasableOverride: validBuilding.floorCount * validBuilding.floorAreaEach + 1 }, 'NLA above floor area must fail closed');
const missingBuilding = clone(validBuilding);
delete missingBuilding.rentPerSqm;
assert.throws(
  () => calculateInvestmentCase({ studyType: STUDY_TYPE.EXISTING_BUILDING, inputs: missingBuilding, leverageEnabled: missingBuilding.leverageEnabled }),
  (error) => error instanceof ValidationError || error.name === 'ValidationError',
  'missing building required field must fail closed',
);
validationGuardChecks += 1;

expectValidationFailure(STUDY_TYPE.LAND_DEVELOPMENT, validLand, { landPricePerSqm: NaN }, 'land NaN must fail closed');
expectValidationFailure(STUDY_TYPE.LAND_DEVELOPMENT, validLand, { constructionCostPerSqm: Infinity }, 'land Infinity must fail closed');
expectValidationFailure(STUDY_TYPE.LAND_DEVELOPMENT, validLand, { servicesRatioPerFloor: 1 }, 'services ratio 100% must fail closed');
expectValidationFailure(STUDY_TYPE.LAND_DEVELOPMENT, validLand, { occupancyRate: -0.01 }, 'negative occupancy must fail closed');
expectValidationFailure(STUDY_TYPE.LAND_DEVELOPMENT, validLand, { buildableRatio: 1.01 }, 'buildable ratio above 100% must fail closed');
expectValidationFailure(STUDY_TYPE.LAND_DEVELOPMENT, validLand, { constructionPeriod: 0 }, 'zero construction period must fail closed');
expectValidationFailure(STUDY_TYPE.LAND_DEVELOPMENT, validLand, { operatingPeriod: 0 }, 'zero operating period must fail closed');
expectValidationFailure(STUDY_TYPE.LAND_DEVELOPMENT, validLand, { exitCapRate: 0 }, 'zero exit cap must fail closed');
expectValidationFailure(STUDY_TYPE.LAND_DEVELOPMENT, validLand, { officeFloorCount: 1.5 }, 'fractional floor count must fail closed');
expectValidationFailure(STUDY_TYPE.LAND_DEVELOPMENT, validLand, { landLength: -1 }, 'negative land length must fail closed');
const missingLand = clone(validLand);
delete missingLand.marketRentPerSqm;
assert.throws(
  () => calculateInvestmentCase({ studyType: STUDY_TYPE.LAND_DEVELOPMENT, inputs: missingLand, leverageEnabled: missingLand.leverageEnabled }),
  (error) => error instanceof ValidationError || error.name === 'ValidationError',
  'missing land required field must fail closed',
);
validationGuardChecks += 1;

function verifySaveHydrateRoundTrip(mode, defaultInputs, id) {
  const sourceInputs = clone(defaultInputs);
  const record = prepareNewUiDealForSave({
    id,
    name: `C41-${id}`,
    mode,
    inputs: sourceInputs,
    savedAt: '2026-10-03T00:00:00.000Z',
  });
  validateSavedDealRecord(record);
  const serialized = JSON.stringify(record);
  const parsed = JSON.parse(serialized);
  validateSavedDealRecord(parsed);
  const hydrated = hydrateUiDeal({ record: parsed, defaultInputs });
  assert.strictEqual(hydrated.mode, mode, `${id}.mode`);
  assert.strictEqual(hydrated.inputs.landLength, sourceInputs.landLength, `${id}.landLength`);
  assert.strictEqual(hydrated.inputs.landWidth, sourceInputs.landWidth, `${id}.landWidth`);
  const uiState = calculateUiInvestmentState({
    mode,
    inputs: hydrated.inputs,
    assumptionModelVersion: hydrated.assumptionModelVersion,
  });
  const direct = calculateInvestmentCase({
    studyType: mode === UI_MODE.BUILDING ? STUDY_TYPE.EXISTING_BUILDING : STUDY_TYPE.LAND_DEVELOPMENT,
    inputs: hydrated.inputs,
    leverageEnabled: Boolean(hydrated.inputs.leverageEnabled),
    assumptionModelVersion: hydrated.assumptionModelVersion,
  });
  assert.deepStrictEqual(uiState.results, direct, `${id} UI/direct engine result divergence`);
  assert.strictEqual(uiState.transactionAuthorized, false, `${id} UI calculation must not authorize transactions`);
  crossLayerChecks += 8;
}

verifySaveHydrateRoundTrip(UI_MODE.BUILDING, buildingGold.input_set, 'BUILDING-ROUNDTRIP');
verifySaveHydrateRoundTrip(UI_MODE.LAND, landGold.input_set, 'LAND-ROUNDTRIP');

const zeroDebtBuilding = { ...randomizedBuilding(0x471234), leverageEnabled: true, ltv: 0 };
const zeroDebtBuildingResult = run(STUDY_TYPE.EXISTING_BUILDING, zeroDebtBuilding);
assert.strictEqual(zeroDebtBuildingResult.loanAmount, 0, 'building zero-debt loan amount');
assert.strictEqual(zeroDebtBuildingResult.debtService, 0, 'building zero-debt debt service');
assert.strictEqual(zeroDebtBuildingResult.dscrMin, null, 'building zero-debt DSCR');
assert.deepStrictEqual(zeroDebtBuildingResult.leveredCashflows, zeroDebtBuildingResult.cashflows, 'building zero-debt cashflow normalization');

const zeroDebtLand = { ...randomizedLand(0x481234), leverageEnabled: true, ltv: 0 };
const zeroDebtLandResult = run(STUDY_TYPE.LAND_DEVELOPMENT, zeroDebtLand);
assert.strictEqual(zeroDebtLandResult.loanAmount, 0, 'land zero-debt loan amount');
assert.strictEqual(zeroDebtLandResult.debtService, 0, 'land zero-debt debt service');
assert.strictEqual(zeroDebtLandResult.dscrMin, null, 'land zero-debt DSCR');
assert.deepStrictEqual(zeroDebtLandResult.leveredCashflows, zeroDebtLandResult.cashflows, 'land zero-debt cashflow normalization');

console.log('C41_FULL_PLATFORM_RELIABILITY_QUALIFICATION=PASS');
console.log(`C41_RANDOMIZED_FINANCIAL_CASES=${randomizedCases}`);
console.log(`C41_DETERMINISTIC_REPLAYS=${deterministicReplays}`);
console.log(`C41_METAMORPHIC_CHECKS=${metamorphicChecks}`);
console.log(`C41_VALIDATION_GUARD_CHECKS=${validationGuardChecks}`);
console.log(`C41_CROSS_LAYER_ROUNDTRIP_CHECKS=${crossLayerChecks}`);
console.log('C41_ZERO_DEBT_NORMALIZATION=PASS');
console.log('C41_INDEPENDENT_ARITHMETIC_RECONCILIATION=PASS');
