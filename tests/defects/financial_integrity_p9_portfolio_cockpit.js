'use strict';
const assert=require('assert');
const {evaluatePortfolioDecision,PORTFOLIO_STATUS}=require('../../src/valuation-intelligence/portfolio-decision-cockpit');

const assets=[
 {id:'A',valueSar:6000000,noiSar:500000,annualDebtServiceSar:250000,city:'Riyadh',assetType:'OFFICE'},
 {id:'B',valueSar:4000000,noiSar:360000,annualDebtServiceSar:180000,city:'Jeddah',assetType:'LOGISTICS'}
];
const limits={maxSingleAssetWeight:.7,maxCityWeight:.7,maxAssetTypeWeight:.7,minPortfolioDscr:1.5};

const qualified=evaluatePortfolioDecision({assets,limits});
assert.strictEqual(qualified.status,PORTFOLIO_STATUS.QUALIFIED);
assert.strictEqual(qualified.metrics.totalValueSar,10000000);
assert.strictEqual(qualified.metrics.totalNoiSar,860000);
assert.strictEqual(qualified.metrics.totalDebtServiceSar,430000);
assert.ok(Math.abs(qualified.metrics.portfolioDscr-2)<1e-12);
assert.strictEqual(qualified.metrics.debtServiceCoverageScope,'PORTFOLIO_AGGREGATE');
assert.strictEqual(qualified.transactionAuthorized,false);
assert.strictEqual(qualified.humanDecisionRequired,true);

const concentration=evaluatePortfolioDecision({assets,limits:{...limits,maxSingleAssetWeight:.5}});
assert.strictEqual(concentration.status,PORTFOLIO_STATUS.REVIEW_REQUIRED);
assert.ok(concentration.warnings.includes('SINGLE_ASSET_CONCENTRATION_BREACH'));

const city=evaluatePortfolioDecision({assets:[assets[0],{...assets[1],city:'Riyadh'}],limits});
assert.strictEqual(city.status,PORTFOLIO_STATUS.REVIEW_REQUIRED);
assert.ok(city.warnings.includes('CITY_CONCENTRATION_BREACH'));

const type=evaluatePortfolioDecision({assets:[assets[0],{...assets[1],assetType:'OFFICE'}],limits});
assert.strictEqual(type.status,PORTFOLIO_STATUS.REVIEW_REQUIRED);
assert.ok(type.warnings.includes('ASSET_TYPE_CONCENTRATION_BREACH'));

const dscr=evaluatePortfolioDecision({assets:[{...assets[0],annualDebtServiceSar:500000},{...assets[1],annualDebtServiceSar:400000}],limits});
assert.strictEqual(dscr.status,PORTFOLIO_STATUS.REVIEW_REQUIRED);
assert.ok(dscr.warnings.includes('PORTFOLIO_DSCR_BREACH'));

assert.strictEqual(evaluatePortfolioDecision({assets:[],limits}).status,PORTFOLIO_STATUS.HOLD);
assert.strictEqual(evaluatePortfolioDecision({assets,limits:{...limits,maxSingleAssetWeight:1.1}}).status,PORTFOLIO_STATUS.HOLD);
assert.strictEqual(evaluatePortfolioDecision({assets:[assets[0],{...assets[1],id:'A'}],limits}).status,PORTFOLIO_STATUS.HOLD);
assert.strictEqual(evaluatePortfolioDecision({assets:[assets[0],{...assets[1],id:' A '}],limits}).status,PORTFOLIO_STATUS.HOLD);
assert.strictEqual(evaluatePortfolioDecision({assets:[{...assets[0],annualDebtServiceSar:-1}],limits}).status,PORTFOLIO_STATUS.HOLD);
assert.strictEqual(evaluatePortfolioDecision({assets:[{...assets[0],city:'   '}],limits}).status,PORTFOLIO_STATUS.HOLD);
assert.strictEqual(evaluatePortfolioDecision({assets:[{...assets[0],assetType:'   '}],limits}).status,PORTFOLIO_STATUS.HOLD);

// Special property names must remain safe classifications rather than mutating object prototypes.
const safeKeys=evaluatePortfolioDecision({assets:[{...assets[0],city:'__proto__',assetType:'constructor'}],limits});
assert.ok([PORTFOLIO_STATUS.QUALIFIED,PORTFOLIO_STATUS.REVIEW_REQUIRED].includes(safeKeys.status));
assert.strictEqual(safeKeys.metrics.cityWeights.__proto__,Object.prototype);
assert.strictEqual(safeKeys.metrics.cityWeights['__proto__'],undefined);
assert.strictEqual(safeKeys.metrics.assetTypeWeights.constructor,1);

console.log('financial_integrity_p9_portfolio_cockpit: PASS');
