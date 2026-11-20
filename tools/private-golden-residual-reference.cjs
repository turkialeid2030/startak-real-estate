'use strict';
// Private fixture *arithmetic* verifier only: no licensed property data in repo.
// Never present this result as independent Saudi market evidence or STARTAK
// engine parity. Commercial scenarioLand[] origins are NOT reconstructed here.
const finite = (value, label) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error('PRIVATE_RESIDUAL_INVALID_' + label);
  }
  return value;
};
const nonnegative = (value, label) => {
  const v = finite(value, label);
  if (v < 0) throw new Error('PRIVATE_RESIDUAL_NEGATIVE_' + label);
  return v;
};
const percent = (value, label) => {
  const v = finite(value, label);
  if (v < 0 || v > 100) throw new Error('PRIVATE_RESIDUAL_PERCENT_' + label);
  return v / 100;
};
const positive = (value, label) => {
  const v = finite(value, label);
  if (v <= 0) throw new Error('PRIVATE_RESIDUAL_POSITIVE_' + label);
  return v;
};
const check = (actual, expected, label) => {
  if (!Number.isFinite(actual) || !Number.isFinite(expected)
    || !Object.is(actual, expected)) {
    throw new Error('PRIVATE_RESIDUAL_EXPECTED_MISMATCH_' + label);
  }
};
function hotel(row) {
  if (!Array.isArray(row.seasons) || !row.seasons.length
    || !Array.isArray(row.roomTypes) || !row.roomTypes.length) {
    throw new Error('PRIVATE_RESIDUAL_HOTEL_INPUTS');
  }
  const grossIncome = row.roomTypes.reduce((sum, room) => {
    const count = nonnegative(room.count, 'ROOM_COUNT');
    if (!Array.isArray(room.adr) || room.adr.length !== row.seasons.length) {
      throw new Error('PRIVATE_RESIDUAL_HOTEL_ADR_LENGTH');
    }
    return sum + count * row.seasons.reduce((revenue, season, index) => (
      revenue + nonnegative(season.days, 'SEASON_DAYS')
        * percent(season.occPct, 'SEASON_OCC')
        * nonnegative(room.adr[index], 'ADR')
    ), 0);
  }, 0);
  const noi = grossIncome * (1 - percent(row.opexPct, 'HOTEL_OPEX'));
  const gdv = Math.round(noi / percent(row.capRatePct, 'HOTEL_CAP'));
  if (!Number.isFinite(gdv)) throw new Error('PRIVATE_RESIDUAL_HOTEL_CAP_INVALID');
  const scenario = row.scenario || {};
  const devCost = nonnegative(scenario.dev, 'HOTEL_DEV');
  const otherPct = percent(scenario.othPct, 'HOTEL_OTHER_COST');
  const discount = percent(row.discountPct, 'HOTEL_DISCOUNT');
  const period = nonnegative(row.periodYears, 'HOTEL_PERIOD');
  const presentValue = Math.round((gdv - devCost * (1 + otherPct)) / Math.pow(1 + discount, period));
  const residualRate = Math.round(presentValue / positive(row.residualArea, 'HOTEL_AREA')
    / positive(row.roundStep, 'HOTEL_ROUND_STEP')) * row.roundStep;
  const expected = row.expected || {};
  for (const [key, actual] of Object.entries({grossIncome, noi, gdv, presentValue, residualRate})) {
    if (Object.hasOwn(expected, key)) check(actual, expected[key], key);
  }
  for (const key of ['grossIncome', 'gdv', 'presentValue', 'residualRate']) {
    if (!Object.hasOwn(expected, key)) throw new Error('PRIVATE_RESIDUAL_HOTEL_EXPECTED_MISSING_' + key);
  }
  return {kind:'HOTEL_RESIDUAL', fullyIndependentScenarioArithmetic:true};
}
function units(row) {
  if (!Array.isArray(row.units) || !row.units.length) {
    throw new Error('PRIVATE_RESIDUAL_UNITS_MISSING');
  }
  const grossIncome = row.units.reduce((sum, unit) => (
    sum + nonnegative(unit.count, 'UNIT_COUNT')
      * nonnegative(unit.annualRent, 'UNIT_RENT')
      * percent(unit.occPct, 'UNIT_OCC')
  ), 0);
  const noi = grossIncome * (1 - percent(row.opexPct, 'UNIT_OPEX'));
  const incomeValue = Math.round(noi / percent(row.capRatePct, 'UNIT_CAP'));
  const expected = row.expected || {};
  for (const [key, actual] of Object.entries({grossIncome, noi, incomeValue})) {
    if (!Object.hasOwn(expected, key)) throw new Error('PRIVATE_RESIDUAL_UNITS_EXPECTED_MISSING_' + key);
    check(actual, expected[key], key);
  }
  return {kind:'UNIT_INCOME', fullyIndependentScenarioArithmetic:true};
}
function commercial(row) {
  const scenarios = row.scenarios;
  const expected = row.expected || {};
  // Intentional limitation: expected.scenarioLand is a source value, NOT
  // derived here from gdv, development, marketing, contingency and profit.
  if (!Array.isArray(scenarios) || !scenarios.length
    || !Array.isArray(expected.scenarioLand)
    || scenarios.length !== expected.scenarioLand.length) {
    throw new Error('PRIVATE_RESIDUAL_COMM_SCENARIOS');
  }
  let totalWeight = 0;
  const weighted = scenarios.reduce((sum, row, i) => {
    const weight = percent(row.weightPct, 'COMM_WEIGHT');
    totalWeight += weight;
    return sum + finite(expected.scenarioLand[i], 'COMM_EXPECTED_SCENARIO_LAND') * weight;
  }, 0);
  if (Math.abs(totalWeight-1) > 1e-8) throw new Error('PRIVATE_RESIDUAL_COMM_WEIGHTS');
  const presentValue = Math.round(weighted / Math.pow(
    1 + percent(row.discountPct, 'COMM_DISCOUNT'), nonnegative(row.periodYears, 'COMM_PERIOD'),
  ));
  const residualRate = Math.round(presentValue / positive(row.residualArea, 'COMM_AREA')
    / positive(row.roundStep, 'COMM_ROUND_STEP')) * row.roundStep;
  const marketWeight = percent(row.marketWeightPct, 'COMM_MARKET_WEIGHT');
  const adoptedLandRate = residualRate * (1 - marketWeight)
    + nonnegative(row.marketLandRate, 'COMM_MARKET_RATE') * marketWeight;
  check(presentValue, expected.presentValue, 'COMM_PRESENT_VALUE');
  check(residualRate, expected.residualRate, 'COMM_RESIDUAL_RATE');
  check(adoptedLandRate, expected.adoptedLandRate, 'COMM_ADOPTED_LAND_RATE');
  return {kind:'COMMERCIAL_RESIDUAL_DOWNSTREAM_ONLY', fullyIndependentScenarioArithmetic:false};
}
function verifyResidualCases(fixture) {
  if (!fixture || !Array.isArray(fixture.residualCases) || fixture.residualCases.length !== 4) {
    throw new Error('PRIVATE_RESIDUAL_COUNT_NOT_FOUR');
  }
  const ids = new Set();
  let hotels = 0, incomes = 0, commercials = 0;
  for (const row of fixture.residualCases) {
    if (typeof row.id !== 'string' || !row.id.trim() || ids.has(row.id)) {
      throw new Error('PRIVATE_RESIDUAL_ID_INVALID');
    }
    ids.add(row.id);
    if (Array.isArray(row.roomTypes)) {hotel(row);hotels++;}
    else if (Array.isArray(row.units)) {units(row);incomes++;}
    else if (Array.isArray(row.scenarios)) {commercial(row);commercials++;}
    else throw new Error('PRIVATE_RESIDUAL_KIND_UNSUPPORTED');
  }
  if (hotels !== 2 || incomes !== 1 || commercials !== 1) {
    throw new Error('PRIVATE_RESIDUAL_KIND_DISTRIBUTION_INVALID');
  }
  return Object.freeze({
    cases:4, hotelCases:2, unitIncomeCases:1, commercialDownstreamOnlyCases:1,
    sourceBytesVerified:false, startakEngineParityVerified:false,
    independentMarketEvidenceVerified:false,
  });
}
module.exports = {verifyResidualCases};
