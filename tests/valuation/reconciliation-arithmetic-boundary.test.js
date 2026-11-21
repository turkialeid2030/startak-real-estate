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

// An explicitly supplied but malformed market value must not be silently
// omitted while other method indications create a soft REVIEW_REQUIRED.
const malformedMethod=reconcileValuationMethods({
 marketValueSar:'not-a-price',costValueSar:10000000,
 incomeValueSar:10000000,sourceStatus:'VERIFIED_INDEPENDENTLY',
});
assert.equal(malformedMethod.status,'RECONCILIATION_HOLD');
assert.ok(malformedMethod.issues.includes('METHOD_VALUE_INVALID_market'));
assert.equal(malformedMethod.methodsSar.market,undefined);
assert.equal(malformedMethod.certified,false);

// Grouping must not alter financial facts by erasing arbitrary punctuation.
for(const invalid of ['1,2','1 2','1,00,000','١٬٢','١ ٢']){
 const out=reconcileValuationMethods({
  marketValueSar:invalid,costValueSar:10000000,incomeValueSar:10000000,
  sourceStatus:'VERIFIED_INDEPENDENTLY',
 });
 assert.equal(out.status,'RECONCILIATION_HOLD');
 assert.ok(out.issues.includes('METHOD_VALUE_INVALID_market'));
 assert.equal(out.methodsSar.market,undefined);
}
const arabicFormatted=reconcileValuationMethods({
 marketValueSar:'١٠٬٠٠٠٬٠٠٠',costValueSar:'١٠٬٠٠٠٬٠٠٠',
 annualNoiSar:'٨٠٠٬٠٠٠',capitalizationRatePct:'٨',
});
assert.equal(arabicFormatted.methodsSar.income,10000000);
assert.equal(arabicFormatted.methodsSar.market,10000000);
assert.ok(!arabicFormatted.issues.includes('CAPITALIZED_INCOME_VALUE_INVALID_OR_OUT_OF_RANGE'));

// Do not let malformed optional financial fields silently disappear while
// market and cost indications produce a non-HOLD result.
for(const [field,value,reason] of [
 ['annualNoiSar','1,2','ANNUAL_NOI_INVALID'],
 ['capitalizationRatePct','8,5','CAPITALIZATION_RATE_INVALID'],
 ['rentableArea','1 000','RENTABLE_AREA_INVALID'],
 ['marketRentPerSqmYear','1,2','MARKET_RENT_PER_SQM_INVALID'],
 ['annualRentFromValueSar','1,2','ANNUAL_RENT_FROM_VALUE_INVALID'],
 ['annualRentPctOfValue','2,5','ANNUAL_RENT_PERCENTAGE_INVALID'],
 ['baseValueSar','1,2','BASE_VALUE_FOR_RENT_INVALID'],
 ['operatingExpenseRatio','3,5','OPERATING_EXPENSE_RATIO_INVALID'],
 ['fullBuildingArea','1 000','FULL_BUILDING_AREA_INVALID'],
]){
 const out=reconcileValuationMethods({
  marketValueSar:10000000,costValueSar:10000000,
  [field]:value,sourceStatus:'VERIFIED_INDEPENDENTLY',
 });
 assert.equal(out.status,'RECONCILIATION_HOLD',field);
 assert.ok(out.issues.includes(reason),field+':'+out.issues.join(','));
}
const noSilentFallback=reconcileValuationMethods({
 marketValueSar:10000000,costValueSar:10000000,
 annualRentFromValueSar:'1,2',baseValueSar:10000000,
 annualRentPctOfValue:5,rentableArea:1000,marketRentPerSqmYear:500,
});
assert.equal(noSilentFallback.status,'RECONCILIATION_HOLD');
assert.equal(noSilentFallback.metrics.valuePercentageAnnualRentSar,undefined);
assert.ok(noSilentFallback.issues.includes('ANNUAL_RENT_FROM_VALUE_INVALID'));
const blankCanUseFallback=reconcileValuationMethods({
 marketValueSar:10000000,costValueSar:10000000,
 annualRentFromValueSar:'',baseValueSar:10000000,
 annualRentPctOfValue:5,
});
assert.equal(blankCanUseFallback.metrics.valuePercentageAnnualRentSar,500000);
assert.equal(blankCanUseFallback.status,'REVIEW_REQUIRED');

console.log('VALUATION_RECONCILIATION_ARITHMETIC_BOUNDARY=PASS synthetic_only=true certified=false');
