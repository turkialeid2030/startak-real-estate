'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadCurrentEngines } = require('../load_engines');

const ROOT = path.join(__dirname, '..', '..');
const EVIDENCE_DIR = path.join(ROOT, 'runtime-evidence', 'deep-platform');
fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

const seedInput = Number(process.env.TEST_SEED || 20260901) >>> 0;
let state = seedInput || 1;
function rnd() {
  state = (1664525 * state + 1013904223) >>> 0;
  return state / 0x100000000;
}
function between(min, max) { return min + (max - min) * rnd(); }
function approx(a, b, rel = 1e-8, abs = 1e-6) {
  return Math.abs(a - b) <= Math.max(abs, rel * Math.max(1, Math.abs(a), Math.abs(b)));
}
function finiteTree(value, label) {
  if (Array.isArray(value)) {
    value.forEach((v, i) => finiteTree(v, `${label}[${i}]`));
    return;
  }
  if (value && typeof value === 'object') {
    Object.entries(value).forEach(([k, v]) => finiteTree(v, `${label}.${k}`));
    return;
  }
  if (typeof value === 'number') assert(Number.isFinite(value), `${label} must be finite`);
}

const fixturesDir = path.join(__dirname, '..', 'characterization', 'fixtures');
const landBase = JSON.parse(fs.readFileSync(path.join(fixturesDir, 'RE-GOLD-001-U.json'), 'utf8')).input_set;
const buildingBase = JSON.parse(fs.readFileSync(path.join(fixturesDir, 'RE-GOLD-002-U.json'), 'utf8')).input_set;
const { calcLandDevelopment, calcExistingBuilding } = loadCurrentEngines();

const results = [];
function record(name, fn) {
  try {
    fn();
    results.push({ name, status: 'PASS' });
  } catch (error) {
    results.push({ name, status: 'FAIL', error: error.message });
    throw error;
  }
}

for (let i = 0; i < 40; i++) {
  const input = {
    ...landBase,
    landLength: between(18, 120),
    landWidth: between(20, 120),
    landPricePerSqm: between(2500, 35000),
    buildableRatio: between(0.35, 0.85),
    officeFloorCount: 2 + Math.floor(rnd() * 18),
    servicesRatioPerFloor: between(0.05, 0.28),
    basementFloorCount: Math.floor(rnd() * 5),
    constructionCostPerSqm: between(2500, 9500),
    marketRentPerSqm: between(500, 3200),
    occupancyRate: between(0.55, 1),
    serviceIncomeRate: between(0, 0.2),
    opexRate: between(0.03, 0.25),
    marketCapRate: between(0.045, 0.12),
    constructionPeriod: 1 + Math.floor(rnd() * 4),
    operatingPeriod: 3 + Math.floor(rnd() * 13),
    rentGrowthRate: between(-0.02, 0.07),
    exitCapRate: between(0.05, 0.13),
    hurdleRate: between(0.06, 0.2),
  };

  record(`land_random_${i}`, () => {
    const a = calcLandDevelopment(input);
    const b = calcLandDevelopment({ ...input });
    finiteTree(a, `land[${i}]`);
    assert.deepStrictEqual(a, b, 'land engine must be deterministic for identical inputs');
    assert(approx(a.landArea, input.landLength * input.landWidth));
    assert(approx(a.floorPlateArea, a.landArea * input.buildableRatio));
    assert(approx(a.totalNetLeasableArea, a.netLeasableAreaPerFloor * input.officeFloorCount));
    assert(approx(a.grossRentalIncome, a.totalNetLeasableArea * input.marketRentPerSqm));
    assert(approx(a.actualRentalIncome, a.grossRentalIncome * input.occupancyRate));
    assert(approx(a.serviceIncome, a.actualRentalIncome * input.serviceIncomeRate));
    assert(approx(a.totalOperatingRevenue, a.actualRentalIncome + a.serviceIncome));
    assert(approx(a.operatingExpenses, a.totalOperatingRevenue * input.opexRate));
    assert(approx(a.stabilizedNOI, a.totalOperatingRevenue - a.operatingExpenses));
    assert(approx(a.marketValueAfterCompletion, a.stabilizedNOI / input.marketCapRate, 1e-7));
    assert.strictEqual(a.cashflows.length, input.constructionPeriod + input.operatingPeriod + 1);

    const higherRent = calcLandDevelopment({ ...input, marketRentPerSqm: input.marketRentPerSqm * 1.1 });
    assert(higherRent.stabilizedNOI >= a.stabilizedNOI, 'higher rent must not reduce stabilized NOI');
    assert(higherRent.marketValueAfterCompletion >= a.marketValueAfterCompletion, 'higher rent must not reduce income-cap value');

    const lowerOccupancy = calcLandDevelopment({ ...input, occupancyRate: Math.max(0.3, input.occupancyRate - 0.1) });
    assert(lowerOccupancy.stabilizedNOI <= a.stabilizedNOI, 'lower occupancy must not increase stabilized NOI');

    const higherLandPrice = calcLandDevelopment({ ...input, landPricePerSqm: input.landPricePerSqm * 1.1 });
    assert(higherLandPrice.totalProjectCost >= a.totalProjectCost, 'higher land price must not reduce project cost');
  });
}

for (let i = 0; i < 40; i++) {
  const input = {
    ...buildingBase,
    landLength: between(25, 160),
    landWidth: between(20, 120),
    basementCount: Math.floor(rnd() * 5),
    basementAreaEach: between(500, 12000),
    parkingAreaPerSpot: between(25, 75),
    floorCount: 1 + Math.floor(rnd() * 14),
    floorAreaEach: between(400, 7000),
    efficiencyRatio: between(0.55, 0.95),
    netLeasableOverride: null,
    buildingPrice: between(10000000, 500000000),
    rentPerSqm: between(400, 3500),
    occupancyRate: between(0.5, 1),
    serviceIncomeRate: between(0, 0.2),
    maintenanceRate: between(0.02, 0.18),
    insuranceRate: between(0.001, 0.02),
    marketCapRate: between(0.045, 0.12),
    discountRate: between(0.05, 0.18),
    holdPeriod: 3 + Math.floor(rnd() * 13),
    rentGrowthRate: between(-0.02, 0.07),
  };

  record(`building_random_${i}`, () => {
    const a = calcExistingBuilding(input);
    const b = calcExistingBuilding({ ...input });
    finiteTree(a, `building[${i}]`);
    assert.deepStrictEqual(a, b, 'building engine must be deterministic for identical inputs');
    assert(approx(a.landArea, input.landLength * input.landWidth));
    assert(approx(a.totalFloorArea, input.floorCount * input.floorAreaEach));
    assert(approx(a.netLeasableArea, a.totalFloorArea * input.efficiencyRatio));
    assert(approx(a.grossRentalIncome, a.netLeasableArea * input.rentPerSqm));
    assert(approx(a.rentalIncomeAfterVacancy, a.grossRentalIncome * input.occupancyRate));
    assert(approx(a.serviceIncome, a.rentalIncomeAfterVacancy * input.serviceIncomeRate));
    assert(approx(a.marketValueByIncomeCap, a.NOI / input.marketCapRate, 1e-7));
    assert.strictEqual(a.cashflows.length, input.holdPeriod + 1);

    const higherRent = calcExistingBuilding({ ...input, rentPerSqm: input.rentPerSqm * 1.1 });
    assert(higherRent.NOI >= a.NOI, 'higher rent must not reduce NOI');
    assert(higherRent.marketValueByIncomeCap >= a.marketValueByIncomeCap, 'higher rent must not reduce income-cap value');

    const lowerOccupancy = calcExistingBuilding({ ...input, occupancyRate: Math.max(0.3, input.occupancyRate - 0.1) });
    assert(lowerOccupancy.NOI <= a.NOI, 'lower occupancy must not increase NOI');

    const higherPrice = calcExistingBuilding({ ...input, buildingPrice: input.buildingPrice * 1.1 });
    assert(higherPrice.totalPurchaseCost >= a.totalPurchaseCost, 'higher purchase price must not reduce total purchase cost');
    assert(higherPrice.netYieldOnCost <= a.netYieldOnCost + 1e-12, 'higher purchase price must not improve yield on cost');
  });
}

const summary = {
  schemaVersion: 1,
  seed: seedInput,
  randomLandCases: 40,
  randomBuildingCases: 40,
  assertions: results.length,
  passed: results.filter((r) => r.status === 'PASS').length,
  failed: results.filter((r) => r.status === 'FAIL').length,
  dimensions: ['determinism', 'finite-results', 'accounting-identities', 'monotonicity', 'cashflow-shape', 'randomized-boundary-coverage'],
  results,
};
fs.writeFileSync(path.join(EVIDENCE_DIR, `financial-metamorphic-${seedInput}.json`), JSON.stringify(summary, null, 2));
console.log(`FINANCIAL_METAMORPHIC_STRESS_V1=PASS seed=${seedInput} cases=${results.length}`);
