'use strict';
const assert=require('assert');
const {runDeterministicStressTest,STRESS_STATUS}=require('../../src/valuation-intelligence/stress-testing');
const {validateGoldenCorpus,GOLDEN_STATUS}=require('../../src/valuation-intelligence/golden-validation');

const base={noiSar:800000,valueSar:10000000,effectiveRevenueSar:1120000,opexSar:320000,annualDebtServiceSar:500000,capRate:.08};
const thresholds={maxValueDecline:.25,minDscr:1.25};
const stress=runDeterministicStressTest({base,scenarios:[
 {id:'MILD',rentShock:-.02,occupancyShock:-.01,opexShock:.02,capRateShock:.002,debtServiceShock:0},
 {id:'DOWNSIDE',rentShock:-.10,occupancyShock:-.05,opexShock:.10,capRateShock:.01,debtServiceShock:.10},
 {id:'SEVERE',rentShock:-.25,occupancyShock:-.15,opexShock:.20,capRateShock:.02,debtServiceShock:.20}
],thresholds});
assert.strictEqual(stress.status,STRESS_STATUS.REVIEW_REQUIRED);
assert.strictEqual(stress.results.length,3);
assert.ok(stress.results[1].valueDecline>stress.results[0].valueDecline);
assert.ok(stress.results[2].valueDecline>stress.results[1].valueDecline);
assert.ok(stress.results[2].breached.length>0);
assert.strictEqual(runDeterministicStressTest({}).status,STRESS_STATUS.HOLD);
assert.strictEqual(runDeterministicStressTest({base:{...base,annualDebtServiceSar:-1},scenarios:[{id:'X'}],thresholds}).status,STRESS_STATUS.HOLD);
assert.strictEqual(runDeterministicStressTest({base,scenarios:[{id:'BAD',rentShock:-1}],thresholds}).status,STRESS_STATUS.HOLD);
assert.strictEqual(runDeterministicStressTest({base,scenarios:[{id:'BAD_CAP',capRateShock:-.09}],thresholds}).status,STRESS_STATUS.HOLD);
assert.strictEqual(runDeterministicStressTest({base,scenarios:[{id:'X'}],thresholds:{...thresholds,maxValueDecline:1.1}}).status,STRESS_STATUS.HOLD);

const goldenPass=validateGoldenCorpus({cases:[
 {id:'CASE1',assetType:'INCOME',sourceRef:'independent-report-1',independentValueSar:10000000,modelValueSar:10200000},
 {id:'CASE2',assetType:'LOGISTICS',sourceRef:'independent-report-2',independentValueSar:20000000,modelValueSar:19400000}
],tolerancePct:.05});
assert.strictEqual(goldenPass.status,GOLDEN_STATUS.PASS);
const goldenReview=validateGoldenCorpus({cases:[{id:'CASE3',sourceRef:'independent-report-3',independentValueSar:10000000,modelValueSar:12000000}],tolerancePct:.05});
assert.strictEqual(goldenReview.status,GOLDEN_STATUS.REVIEW_REQUIRED);
assert.strictEqual(validateGoldenCorpus({cases:[],tolerancePct:.05}).status,GOLDEN_STATUS.HOLD);
assert.strictEqual(validateGoldenCorpus({cases:[{id:'CASE4',sourceRef:' ',independentValueSar:1,modelValueSar:1}],tolerancePct:.05}).status,GOLDEN_STATUS.HOLD);
assert.strictEqual(validateGoldenCorpus({cases:[{id:'DUP',sourceRef:'a',independentValueSar:1,modelValueSar:1},{id:'DUP',sourceRef:'b',independentValueSar:1,modelValueSar:1}],tolerancePct:.05}).status,GOLDEN_STATUS.HOLD);
assert.strictEqual(validateGoldenCorpus({cases:[{id:'CASE5',sourceRef:'a',independentValueSar:1,modelValueSar:1}],tolerancePct:1.1}).status,GOLDEN_STATUS.HOLD);
console.log('financial_integrity_p6_validation_risk: PASS');
