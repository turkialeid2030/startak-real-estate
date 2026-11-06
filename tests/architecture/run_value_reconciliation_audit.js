'use strict';
const assert=require('node:assert/strict');
const {detailedReplacementCost,reconcileValuationMethods}=require('../../src/market/value-reconciliation-audit');
// Synthetic scenario only: not a reproduction of confidential appraisal values.
const cost=detailedReplacementCost({
 landArea:1000,landPricePerSqm:3000,
 components:[{area:2000,ratePerSqm:2000},{area:1000,ratePerSqm:1500}],
 feeRatesPct:{professional:10,facility:5},effectiveAgeYears:15,buildingLifeYears:40,
 finalRoundingStep:1000,
});
assert.equal(cost.directBuildingCostSar,5500000);
assert.equal(cost.extraCostsSar,825000);
assert.equal(cost.grossBuildingBeforeDepreciationSar,6325000);
assert.equal(cost.depreciationPct,37.5);
assert.equal(cost.depreciationSar,2371875);
assert.equal(cost.netBuildingValueSar,3953125);
assert.equal(cost.unroundedValueSar,6953125);
assert.equal(cost.valueSar,6953000);
assert.equal(cost.certified,false);
assert.equal(detailedReplacementCost({landArea:1000}).status,'INCOMPLETE');
const reconciliation=reconcileValuationMethods({
 marketValueSar:7000000,costValueSar:6953000,
 annualNoiSar:420000,capitalizationRatePct:7,
 marketRentPerSqmYear:250,rentableArea:2000,
 baseValueSar:7000000,annualRentPctOfValue:8,
 operatingExpenseRatio:0,fullBuildingArea:3000,
});
assert.equal(reconciliation.methodsSar.income,6000000);
assert.equal(reconciliation.metrics.comparableMarketAnnualRentSar,500000);
assert.equal(reconciliation.metrics.valuePercentageAnnualRentSar,560000);
assert.equal(reconciliation.metrics.annualRentGapSar,60000);
assert.equal(reconciliation.metrics.annualRentGapPctOfComparable,12);
assert.equal(reconciliation.metrics.rentableEfficiencyPct,66.67);
assert.equal(reconciliation.issues.includes('RENT_METHODOLOGY_GAP_REQUIRES_RECONCILIATION'),true);
assert.equal(reconciliation.issues.includes('ZERO_OPEX_NEEDS_TRIPLE_NET_LEASE_EVIDENCE'),true);
assert.equal(reconciliation.issues.includes('SOURCE_EVIDENCE_NOT_INDEPENDENTLY_VERIFIED'),true);
assert.equal(reconciliation.automaticPrimaryValueSar,null);
const big=reconcileValuationMethods({marketValueSar:10000000,incomeValueSar:7000000,
 sourceStatus:'VERIFIED_INDEPENDENTLY'});
assert.equal(big.status,'RECONCILIATION_HOLD');
assert.equal(big.issues.includes('MATERIAL_VALUATION_METHOD_GAP_20PCT'),true);
const self=reconcileValuationMethods({marketValueSar:1000});
assert.equal(self.status,'INSUFFICIENT_METHODS');
const mismatch=reconcileValuationMethods({marketValueSar:10000000,incomeValueSar:9999999,
 annualNoiSar:100000,capitalizationRatePct:10});
assert.equal(mismatch.issues.includes('CAPITALIZED_INCOME_ARITHMETIC_MISMATCH'),true);
const invalid=reconcileValuationMethods({marketValueSar:10000000,
 incomeValueSar:11000000,rentableArea:6000,fullBuildingArea:4000});
assert.equal(invalid.issues.includes('NLA_EXCEEDS_GFA'),true);
console.log('STARTAK_MULTIMETHOD_VALUE_AND_RENT_AUDIT=PASS');
