"use strict";
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { calculateInvestmentCase, STUDY_TYPE } = require('../../src/engines');
const {
  ZAKAT_INPUT_SOURCE,
  ZAKAT_LAYER_STATUS,
  validateUserEnteredZakatCase,
  buildUserEnteredZakatLayer,
} = require('../../src/zakat/user-entered-zakat');
const { validateSavedDealRecord } = require('../../src/validation/saved-deal-schema');
const ar = require('../../src/i18n/locales/ar-SA');
const en = require('../../src/i18n/locales/en');

let checks = 0;
const ok = (condition, message) => { assert.ok(condition, message); checks += 1; };
const eq = (actual, expected, message) => { assert.deepStrictEqual(actual, expected, message); checks += 1; };
const fixtureDir = path.join(__dirname, '..', 'characterization', 'fixtures');
const fixtureNames = ['RE-GOLD-001-U.json', 'RE-GOLD-001-L.json', 'RE-GOLD-002-U.json', 'RE-GOLD-002-L.json'];

for (const name of fixtureNames) {
  const fixture = JSON.parse(fs.readFileSync(path.join(fixtureDir, name), 'utf8'));
  const inputs = JSON.parse(JSON.stringify(fixture.input_set));
  const studyType = fixture.study_type === 'building' ? STUDY_TYPE.EXISTING_BUILDING : STUDY_TYPE.LAND_DEVELOPMENT;
  const result = calculateInvestmentCase({
    studyType,
    inputs,
    leverageEnabled: inputs.leverageEnabled,
    assumptionModelVersion: fixture.study_type === 'building' ? 'V2' : undefined,
  });
  const beforeBytes = JSON.stringify(result);
  const layer = buildUserEnteredZakatLayer({
    mode: fixture.study_type,
    cashflowsBeforeZakat: result.cashflows,
    zakatCase: null,
    constructionYears: result.constructionYears || 0,
    operatingYears: result.operatingYears || Math.max(0, result.cashflows.length - 1),
    discountRate: fixture.study_type === 'building' ? inputs.discountRate : inputs.hurdleRate,
    returnsReady: fixture.study_type !== 'building' || result.exitDependentAnalyticsReady !== false,
  });
  eq(JSON.stringify(result), beforeBytes, `${name}: layer must not change one byte of engine output`);
  eq(layer.status, ZAKAT_LAYER_STATUS.NOT_PROVIDED, `${name}: no Zakat case means NOT_PROVIDED`);
  eq(layer.cashflowsAfterZakat, null, `${name}: no after-Zakat cash flow without an entered amount`);
  eq(layer.annualZakatAmount, null, `${name}: no implicit zero`);
}

// Existing-building fixture: demonstrate that the separate layer does not touch NOI.
// Use the fixture's established legacy engine contract; no new market assumption is introduced.
const buildingFixture = JSON.parse(fs.readFileSync(path.join(fixtureDir, 'RE-GOLD-002-U.json'), 'utf8'));
const buildingInputs = JSON.parse(JSON.stringify(buildingFixture.input_set));
const buildingResult = calculateInvestmentCase({
  studyType: STUDY_TYPE.EXISTING_BUILDING,
  inputs: buildingInputs,
  leverageEnabled: buildingInputs.leverageEnabled,
});
const noiBefore = buildingResult.NOI;
const enteredCase = { annualAmount: 100000, source: ZAKAT_INPUT_SOURCE.ACCOUNTANT };
const buildingLayer = buildUserEnteredZakatLayer({
  mode: 'building',
  cashflowsBeforeZakat: buildingResult.cashflows,
  zakatCase: enteredCase,
  operatingYears: buildingResult.cashflows.length - 1,
  discountRate: buildingInputs.discountRate,
});
eq(buildingResult.NOI, noiBefore, 'Entered Zakat must never alter NOI');
eq(buildingLayer.cashflowsAfterZakat[0], buildingResult.cashflows[0], 'Acquisition flow stays unchanged');
eq(buildingLayer.cashflowsAfterZakat[1], buildingResult.cashflows[1] - enteredCase.annualAmount, 'Annual entered amount applies only after NOI in operating cash flow');
ok(Number.isFinite(buildingLayer.afterZakatIRR), 'Complete entered case produces an after-entered-Zakat IRR');
ok(Number.isFinite(buildingLayer.afterZakatNPV), 'Complete entered case produces an after-entered-Zakat NPV');
eq(buildingLayer.platformCalculated, false, 'Platform explicitly declares statutory Zakat was not calculated');

assert.throws(
  () => validateUserEnteredZakatCase({ annualAmount: 100000, source: null }),
  (error) => error && error.code === 'ZAKAT_SOURCE_REQUIRED',
  'Source is mandatory when amount is supplied',
);
checks += 1;

assert.throws(
  () => validateSavedDealRecord({ mode: 'building', inputs: buildingInputs, savedAt: '2026-09-06T00:00:00.000Z', zakatCase: { annualAmount: 100000, source: null } }),
  (error) => error && error.reasonCode === 'INVALID_ZAKAT_CASE',
);
checks += 1;

const landFixture = JSON.parse(fs.readFileSync(path.join(fixtureDir, 'RE-GOLD-001-U.json'), 'utf8'));
const landInputs = JSON.parse(JSON.stringify(landFixture.input_set));
const landResult = calculateInvestmentCase({ studyType: STUDY_TYPE.LAND_DEVELOPMENT, inputs: landInputs, leverageEnabled: landInputs.leverageEnabled });
const landCase = { annualAmount: 50000, source: ZAKAT_INPUT_SOURCE.ZAKAT_ADVISER };
const landLayer = buildUserEnteredZakatLayer({
  mode: 'land', cashflowsBeforeZakat: landResult.cashflows, zakatCase: landCase,
  constructionYears: landResult.constructionYears, operatingYears: landResult.operatingYears, discountRate: landInputs.hurdleRate,
});
for (let i = 0; i <= landResult.constructionYears; i += 1) {
  eq(landLayer.cashflowsAfterZakat[i], landResult.cashflows[i], `Land pre-operation period ${i} unchanged`);
}
eq(landLayer.cashflowsAfterZakat[landResult.constructionYears + 1], landResult.cashflows[landResult.constructionYears + 1] - landCase.annualAmount, 'Land Zakat begins only after construction');
ok(Number.isFinite(landLayer.afterZakatIRR), 'Land after-entered-Zakat IRR is available');
ok(Number.isFinite(landLayer.afterZakatNPV), 'Land after-entered-Zakat NPV is available');

function flattenKeys(obj, prefix = '') {
  return Object.keys(obj).flatMap((key) => {
    const next = prefix ? `${prefix}.${key}` : key;
    return obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key]) ? flattenKeys(obj[key], next) : [next];
  }).sort();
}
eq(flattenKeys(ar.zakat), flattenKeys(en.zakat), 'Arabic/English Zakat translation key parity');
ok(!Object.keys(buildingLayer).some((key) => /rate|percent|base/i.test(key)), 'No rate/percentage/Zakat-base conversion surface exists');
console.log(`WAVE_B2_USER_ENTERED_ZAKAT_LAYER=PASS checks=${checks}`);