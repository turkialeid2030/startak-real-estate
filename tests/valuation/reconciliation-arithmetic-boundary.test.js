'use strict';
const assert=require('node:assert/strict');
const {reconcileValuationMethods}=require('../../src/market/value-reconciliation-audit');

const healthy=reconcileValuationMethods({
 marketValueSar:10000000,costValueSar:10000000,
 annualNoiSar:800000,capitalizationRatePct:8,
 rentableArea:1000,marketRentPerSqmYear:1200,
 annualRentFromValueSar:1200000,operatingExpenseRatio:0.2,
 fullBuildingArea:1500,sourceStatus:'VERIFIED_INDEPENDENTLY',
});
assert.equal(healthy.methodsSar.income,10000000);
assert.equal(healthy.metrics.impliedIncomeValueSar,10000000);
assert.equal(healthy.metrics.comparableMarketAnnualRentSar,1200000);
assert.equal(healthy.status,'REVIEW_REQUIRED');
assert.equal(healthy.certified,false);
assert.equal(healthy.automaticPrimaryValueSar,null);

const overflowIncome=reconcileValuationMethods({
 marketValueSar:10000000,costValueSar:10000000,
 annualNoiSar:1e15,capitalizationRatePct:0.000001,
 sourceStatus:'VERIFIED_INDEPENDENTLY',
});
assert.equal(overflowIncome.status,'RECONCILIATION_HOLD');
assert.ok(overflowIncome.issues.includes('CAPITALIZED_INCOME_VALUE_INVALID_OR_OUT_OF_RANGE'));
assert.equal(overflowIncome.metrics.impliedIncomeValueSar,undefined);
assert.equal(overflowIncome.methodsSar.income,undefined);

const zeroIncome=reconcileValuationMethods({
 marketValueSar:10000000,costValueSar:10000000,
 annualNoiSar:0,capitalizationRatePct:8,
});
assert.equal(zeroIncome.status,'RECONCILIATION_HOLD');
assert.ok(zeroIncome.issues.includes('CAPITALIZED_INCOME_VALUE_INVALID_OR_OUT_OF_RANGE'));
assert.equal(zeroIncome.methodsSar.income,undefined);

const excessComparableAnnualRent=reconcileValuationMethods({
 marketValueSar:10000000,costValueSar:10000000,
 rentableArea:1e15,marketRentPerSqmYear:1e15,
});
assert.equal(excessComparableAnnualRent.status,'RECONCILIATION_HOLD');
assert.ok(excessComparableAnnualRent.issues.includes('MARKET_ANNUAL_RENT_OUT_OF_RANGE'));
assert.equal(excessComparableAnnualRent.metrics.comparableMarketAnnualRentSar,undefined);

const excessImpliedRentRate=reconcileValuationMethods({
 marketValueSar:10000000,costValueSar:10000000,
 annualRentFromValueSar:1e15,rentableArea:0.0001,
});
assert.equal(excessImpliedRentRate.status,'RECONCILIATION_HOLD');
assert.ok(excessImpliedRentRate.issues.includes('IMPLIED_RENT_RATE_OUT_OF_RANGE'));
assert.equal(excessImpliedRentRate.metrics.impliedRentSarPerSqmYear,undefined);

console.log('VALUATION_RECONCILIATION_ARITHMETIC_BOUNDARY=PASS synthetic_only=true certified=false');
