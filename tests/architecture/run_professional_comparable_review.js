'use strict';
const assert=require('node:assert/strict');
const {compareAdjustments,costReplacementScenario}=require('../../src/market/professional-comparable-review');
// Deliberately synthetic, not a copy of any confidential client appraisal.
const asOf=new Date('2026-10-27T12:00:00Z'),area=1800.25;
const rows=[
 {id:'synthetic-A',sourceUrl:'https://example.org/a',date:'2026-09-01',
  pricePerSqm:5200,comparableArea:1700,weightPct:25,transactionStatus:'EXECUTED',basis:'LAND_SQM',
  marketConditionsPct:-8,areaPct:-10},
 {id:'synthetic-B',sourceUrl:'https://example.org/b',date:'2026-09-02',
  pricePerSqm:4100,comparableArea:1800,weightPct:45,transactionStatus:'EXECUTED',basis:'LAND_SQM',
  areaPct:-5},
 {id:'synthetic-C',sourceUrl:'https://example.org/c',date:'2026-09-03',
  pricePerSqm:4600,comparableArea:2000,weightPct:30,transactionStatus:'EXECUTED',basis:'LAND_SQM',
  marketConditionsPct:-7,accessPct:3},
];
const base={comparables:rows,subjectArea:area,basis:'LAND_SQM',asOf};
const report=compareAdjustments(base);
assert.equal(report.status,'CALCULATION_POSSIBLE_UNVERIFIED');
assert.equal(report.analysed[0].stage1PricePerSqm,4784);
assert.equal(report.analysed[0].adjustedPricePerSqm,4305.6);
assert.equal(report.analysed[1].adjustedPricePerSqm,3895);
assert.equal(report.analysed[2].adjustedPricePerSqm,4406.34);
assert.equal(report.unroundedWeightedPricePerSqm,4151.052);
assert.equal(report.weightedPricePerSqm,4151.05);
assert.equal(report.scenarioValueSar,7472927.76,'Round weighted price/sqm then multiply by land area');
assert.equal(report.appraisalCertified,false);
assert.equal(report.evidenceQualifiedForAutomaticPublication,false);
const extreme=compareAdjustments({...base,comparables:rows.map((r,i)=>i===0?{...r,comparableArea:150}:r)});
assert.equal(extreme.status,'ILLUSTRATIVE_HUMAN_REVIEW_REQUIRED');
assert.equal(extreme.warnings.includes('EXTREME_AREA_RATIO_REQUIRES_EXPERT_REVIEW'),true);
const areaMissing=compareAdjustments({...base,comparables:rows.map((r,i)=>i===1?{...r,comparableArea:''}:r)});
assert.equal(areaMissing.status,'ILLUSTRATIVE_HUMAN_REVIEW_REQUIRED');

const offer=compareAdjustments({...base,comparables:rows.map((r,i)=>i===0?{...r,transactionStatus:'OFFER'}:r)});
assert.equal(offer.status,'ILLUSTRATIVE_HUMAN_REVIEW_REQUIRED');
assert.equal(offer.offerComparableCount,1);
assert.equal(offer.executedComparableCount,2);
assert.equal(offer.warnings.includes('INSUFFICIENT_EXECUTED_COMPARABLES'),true);
assert.equal(offer.scenarioValueSar,report.scenarioValueSar);
assert.equal(offer.evidenceQualifiedForAutomaticPublication,false);
assert.equal(compareAdjustments({...base,comparables:rows.map((r,i)=>i===0?{...r,weightPct:24}:r)}).status,'INVALID');
assert.equal(compareAdjustments({...base,comparables:[rows[0],rows[0],rows[2]]}).status,'INVALID');
assert.equal(compareAdjustments({...base,comparables:rows.map((r,i)=>i===0?{...r,basis:'BUILT_SQM'}:r)}).status,'INVALID');
assert.equal(compareAdjustments({...base,subjectArea:'١٬٨٠٠٫٢٥'}).weightedPricePerSqm,report.weightedPricePerSqm);
assert.equal(compareAdjustments({...base,comparables:rows.map((r,i)=>i===1?{...r,marketConditionsPct:'-999'}:r)}).status,'INVALID');
const cost=costReplacementScenario({landArea:1000,landMarketSarPerSqm:2000,
 grossBuiltArea:1500,replacementCostSarPerBuiltSqm:3000,
 physicalDepreciationPct:10,functionalObsolescencePct:5,
 economicObsolescencePct:5});
assert.equal(cost.landValueSar,2000000);
assert.equal(cost.buildingReplacementSar,4500000);
assert.equal(cost.depreciationSar,900000);
assert.equal(cost.valueSar,5600000);
assert.equal(cost.certified,false);
assert.equal(costReplacementScenario({landArea:1000}).status,'INCOMPLETE');
assert.equal(costReplacementScenario({landArea:1000,landMarketSarPerSqm:2000,
 grossBuiltArea:1500,replacementCostSarPerBuiltSqm:3000,physicalDepreciationPct:80,
 functionalObsolescencePct:30}).status,'INCOMPLETE');
console.log('STARTAK_PROFESSIONAL_COMPARABLES_SYNTHETIC=PASS');
