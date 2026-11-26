'use strict';
const assert=require('node:assert/strict');
const {detailedReplacementCost,reconcileValuationMethods}=require('../../src/market/value-reconciliation-audit');

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

// An explicit rent and its valuation-percentage calculation must agree.
const common={marketValueSar:10000000,costValueSar:10000000,baseValueSar:10000000,annualRentPctOfValue:5};
const inconsistent=reconcileValuationMethods({...common,annualRentFromValueSar:750000});
assert.equal(inconsistent.status,'RECONCILIATION_HOLD');
assert.equal(inconsistent.metrics.valuePercentageAnnualRentSar,750000);
assert.equal(inconsistent.metrics.recomputedValuePercentageAnnualRentSar,500000);
assert.equal(inconsistent.metrics.valuePercentageAnnualRentErrorSar,250000);
assert.ok(inconsistent.issues.includes('VALUE_PERCENTAGE_ANNUAL_RENT_ARITHMETIC_MISMATCH'));
assert.equal(inconsistent.automaticPrimaryValueSar,null);
const consistent=reconcileValuationMethods({...common,annualRentFromValueSar:500000});
assert.equal(consistent.status,'REVIEW_REQUIRED');
assert.equal(consistent.metrics.valuePercentageAnnualRentErrorSar,0);
assert.ok(!consistent.issues.includes('VALUE_PERCENTAGE_ANNUAL_RENT_ARITHMETIC_MISMATCH'));
const negativeDifference=reconcileValuationMethods({...common,annualRentFromValueSar:499000});
assert.equal(negativeDifference.status,'RECONCILIATION_HOLD');
assert.equal(negativeDifference.metrics.valuePercentageAnnualRentErrorSar,-1000);
const zeroRate=reconcileValuationMethods({...common,annualRentPctOfValue:0,annualRentFromValueSar:1});
assert.equal(zeroRate.status,'RECONCILIATION_HOLD');
assert.equal(zeroRate.metrics.recomputedValuePercentageAnnualRentSar,0);
const rounded=reconcileValuationMethods({...common,baseValueSar:1000.12,annualRentPctOfValue:3,annualRentFromValueSar:30});
assert.ok(!rounded.issues.includes('VALUE_PERCENTAGE_ANNUAL_RENT_ARITHMETIC_MISMATCH'));
assert.equal(rounded.status,'REVIEW_REQUIRED');
const arabicRent=reconcileValuationMethods({...common,annualRentFromValueSar:'٥٠٠٬٠٠٠'});
assert.equal(arabicRent.metrics.valuePercentageAnnualRentErrorSar,0);
assert.equal(arabicRent.status,'REVIEW_REQUIRED');
// A zero percentage-derived rent is not a missing observation.
const zeroVsMarket=reconcileValuationMethods({...common,annualRentPctOfValue:0,rentableArea:1000,marketRentPerSqmYear:500});
assert.equal(zeroVsMarket.metrics.valuePercentageAnnualRentSar,0);
assert.equal(zeroVsMarket.metrics.comparableMarketAnnualRentSar,500000);
assert.equal(zeroVsMarket.metrics.annualRentGapSar,-500000);
assert.equal(zeroVsMarket.metrics.annualRentGapPctOfComparable,-100);
assert.ok(zeroVsMarket.issues.includes('RENT_METHODOLOGY_GAP_REQUIRES_RECONCILIATION'));
assert.equal(zeroVsMarket.certified,false);
assert.equal(zeroVsMarket.automaticPrimaryValueSar,null);
// A displayed rounded value must not be used as a calculation denominator.
const small=reconcileValuationMethods({...common,rentableArea:0.001,marketRentPerSqmYear:1,annualRentFromValueSar:0.001,baseValueSar:undefined,annualRentPctOfValue:undefined});
assert.equal(small.metrics.comparableMarketAnnualRentSar,0);
assert.equal(small.metrics.annualRentGapPctOfComparable,0);
assert.ok(!small.issues.includes('RENT_METHODOLOGY_GAP_REQUIRES_RECONCILIATION'));
const smallConflict=reconcileValuationMethods({...common,rentableArea:0.001,marketRentPerSqmYear:1,annualRentFromValueSar:0.002,baseValueSar:undefined,annualRentPctOfValue:undefined});
assert.equal(smallConflict.metrics.annualRentGapPctOfComparable,100);
assert.ok(smallConflict.issues.includes('RENT_METHODOLOGY_GAP_REQUIRES_RECONCILIATION'));
// The final rounding step must not bypass the same monetary ceiling
// that applies to intermediate replacement-cost calculations.
const costInput={landArea:1e15,landPricePerSqm:1,components:[{area:1,ratePerSqm:1}],depreciationPct:100};
for(const step of [999901,999902,999906]){
 assert.ok(Math.round(1e15/step)*step>1e15);
 const out=detailedReplacementCost({...costInput,finalRoundingStep:step});
 assert.equal(out.status,'INCOMPLETE');
 assert.equal(out.valueSar,null);
 assert.deepEqual(out.issues,['COST_TOTAL_OUT_OF_RANGE']);
 assert.equal(out.certified,false);
}
const exactLimit=detailedReplacementCost({...costInput,finalRoundingStep:1000});
assert.equal(exactLimit.status,'ILLUSTRATIVE_UNVERIFIED');
assert.equal(exactLimit.valueSar,1e15);
assert.equal(exactLimit.certified,false);
const belowLimit=detailedReplacementCost({...costInput,landArea:999999999000000,finalRoundingStep:999901});
assert.equal(belowLimit.status,'ILLUSTRATIVE_UNVERIFIED');
assert.ok(belowLimit.valueSar<=1e15);
const ordinary=detailedReplacementCost({landArea:1000,landPricePerSqm:1250,components:[{area:500,ratePerSqm:2000}],feeRatesPct:{professional:10},depreciationPct:20,finalRoundingStep:1000});
assert.equal(ordinary.status,'ILLUSTRATIVE_UNVERIFIED');
assert.equal(ordinary.valueSar,2130000);
assert.equal(ordinary.unroundedValueSar,2130000);
assert.equal(ordinary.certified,false);
console.log('REPLACEMENT_COST_ROUNDING_BOUNDARY=PASS checks=24 synthetic_only=true certified=false');
console.log('VALUATION_RECONCILIATION_ARITHMETIC_BOUNDARY=PASS synthetic_only=true certified=false');
