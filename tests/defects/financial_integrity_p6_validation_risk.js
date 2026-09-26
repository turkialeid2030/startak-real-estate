'use strict';
const assert=require('assert');
const {runDeterministicStressTest,STRESS_STATUS}=require('../../src/valuation-intelligence/stress-testing');
const {validateGoldenCorpus,GOLDEN_STATUS}=require('../../src/valuation-intelligence/golden-validation');

const stress=runDeterministicStressTest({base:{noiSar:800000,valueSar:10000000,effectiveRevenueSar:1120000,opexSar:320000,annualDebtServiceSar:500000,capRate:.08},scenarios:[{id:'BASE_STRESS',rentShock:-.1,occupancyShock:-.05,opexShock:.1,capRateShock:.01,debtServiceShock:.1}],thresholds:{maxValueDecline:.25,minDscr:1.25}});
assert.strictEqual(stress.status,STRESS_STATUS.REVIEW_REQUIRED);
assert.ok(stress.results[0].valueDecline>0);
assert.ok(stress.results[0].breached.length>0);
assert.strictEqual(runDeterministicStressTest({}).status,STRESS_STATUS.HOLD);

const goldenPass=validateGoldenCorpus({cases:[{id:'CASE1',assetType:'INCOME',sourceRef:'independent-report-1',independentValueSar:10000000,modelValueSar:10200000}],tolerancePct:.05});
assert.strictEqual(goldenPass.status,GOLDEN_STATUS.PASS);
const goldenReview=validateGoldenCorpus({cases:[{id:'CASE2',sourceRef:'independent-report-2',independentValueSar:10000000,modelValueSar:12000000}],tolerancePct:.05});
assert.strictEqual(goldenReview.status,GOLDEN_STATUS.REVIEW_REQUIRED);
assert.strictEqual(validateGoldenCorpus({cases:[],tolerancePct:.05}).status,GOLDEN_STATUS.HOLD);
console.log('financial_integrity_p6_validation_risk: PASS');
