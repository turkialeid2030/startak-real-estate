'use strict';

const assert=require('assert');
const {runDeterministicStressTest,STRESS_STATUS}=require('../../src/valuation-intelligence/stress-testing');
const {runGovernedMonteCarlo,MONTE_CARLO_STATUS}=require('../../src/valuation-intelligence/monte-carlo-risk');
const {evaluateHighestAndBestUse,HBU_STATUS}=require('../../src/valuation-intelligence/hbu-land-bid');
const {evaluatePortfolioDecision,PORTFOLIO_STATUS}=require('../../src/valuation-intelligence/portfolio-decision-cockpit');
const {solveDatedXirr,DATED_RETURNS_STATUS,xnpv}=require('../../src/valuation-intelligence/dated-returns');
const {validateGoldenCorpus,GOLDEN_STATUS}=require('../../src/valuation-intelligence/golden-validation');

// 1) Deterministic base / conservative / severe scenario simulation.
const operatingBase={noiSar:8000000,valueSar:100000000,effectiveRevenueSar:12000000,opexSar:4000000,annualDebtServiceSar:4000000,capRate:.08};
const stress=runDeterministicStressTest({
  base:operatingBase,
  scenarios:[
    {id:'OPTIMISTIC',rentShock:.05,occupancyShock:.02,opexShock:0,capRateShock:-.005,debtServiceShock:0},
    {id:'CONSERVATIVE',rentShock:-.08,occupancyShock:-.05,opexShock:.08,capRateShock:.01,debtServiceShock:.10},
    {id:'SEVERE',rentShock:-.20,occupancyShock:-.15,opexShock:.20,capRateShock:.02,debtServiceShock:.20}
  ],
  thresholds:{maxValueDecline:.25,minDscr:1.25}
});
assert.strictEqual(stress.status,STRESS_STATUS.REVIEW_REQUIRED);
assert.strictEqual(stress.results.length,3);
const optimistic=stress.results.find(x=>x.id==='OPTIMISTIC');
const conservative=stress.results.find(x=>x.id==='CONSERVATIVE');
const severe=stress.results.find(x=>x.id==='SEVERE');
assert.ok(optimistic.stressedValueSar>operatingBase.valueSar);
assert.ok(conservative.valueDecline>.25);
assert.ok(severe.valueDecline>conservative.valueDecline);
assert.ok(severe.dscr<1.25);
assert.ok(severe.breached.includes('MAX_VALUE_DECLINE'));
assert.ok(severe.breached.includes('MIN_DSCR'));

// 2) Seeded Monte Carlo simulation must be reproducible and use exact annual-period IRR.
const monteCarloInput={
  seed:2030,
  iterations:2000,
  base:{initialInvestmentSar:100000000,baseNoiSar:8000000,horizonYears:5,annualDebtServiceSar:4000000},
  distributions:{
    noiGrowth:{type:'triangular',min:-.03,mode:.02,max:.05},
    exitCapRate:{type:'triangular',min:.07,mode:.085,max:.105},
    discountRate:{type:'triangular',min:.08,mode:.10,max:.14}
  },
  thresholds:{hurdleIrr:.08,minDscr:1.25,maxProbabilityNpvNegative:.40,maxProbabilityIrrBelowHurdle:.60,maxProbabilityDscrBreach:.40}
};
const mc1=runGovernedMonteCarlo(monteCarloInput);
const mc2=runGovernedMonteCarlo(monteCarloInput);
assert.notStrictEqual(mc1.status,MONTE_CARLO_STATUS.HOLD);
assert.deepStrictEqual(mc1.summary,mc2.summary);
assert.strictEqual(mc1.summary.irr.method,'EXACT_PERIODIC_IRR');
assert.ok(mc1.summary.npvSar.p05<=mc1.summary.npvSar.p50&&mc1.summary.npvSar.p50<=mc1.summary.npvSar.p95);
assert.ok(mc1.summary.irr.p05<=mc1.summary.irr.p50&&mc1.summary.irr.p50<=mc1.summary.irr.p95);
for(const probability of [mc1.summary.npvSar.probabilityNegative,mc1.summary.irr.probabilityBelowHurdle,mc1.summary.dscr.probabilityBelowMinimum]) assert.ok(probability>=0&&probability<=1);

// 3) HBU / residual land bid simulation across mutually exclusive alternatives.
const hbu=evaluateHighestAndBestUse({
  landAreaSqm:20000,
  requiredDeveloperMarginRate:.20,
  acquisitionCostsRate:.05,
  evidenceComplete:true,
  alternatives:[
    {id:'RESIDENTIAL',legallyPermissible:true,physicallyPossible:true,grossDevelopmentValueSar:150000000,hardCostsSar:70000000,softCostsSar:12000000,financeCostsSar:8000000,contingencySar:4000000,sellingCostsSar:5000000},
    {id:'MIXED_USE',legallyPermissible:true,physicallyPossible:true,grossDevelopmentValueSar:180000000,hardCostsSar:85000000,softCostsSar:15000000,financeCostsSar:9000000,contingencySar:5000000,sellingCostsSar:6000000},
    {id:'LOGISTICS',legallyPermissible:true,physicallyPossible:true,grossDevelopmentValueSar:120000000,hardCostsSar:65000000,softCostsSar:10000000,financeCostsSar:5000000,contingencySar:3000000,sellingCostsSar:4000000}
  ]
});
assert.ok([HBU_STATUS.QUALIFIED,HBU_STATUS.REVIEW_REQUIRED].includes(hbu.status));
assert.strictEqual(hbu.selected.id,'MIXED_USE');
assert.ok(hbu.selected.maximumLandBidSar>0);
assert.ok(hbu.selected.bidPerSqmSar>1000);
assert.strictEqual(hbu.transactionAuthorized,false);
assert.strictEqual(hbu.humanDecisionRequired,true);

// 4) Portfolio simulation: diversified case passes; concentration case escalates.
const portfolioAssets=[
  {id:'OFFICE_RUH',valueSar:40000000,noiSar:3200000,annualDebtServiceSar:1600000,city:'Riyadh',assetType:'OFFICE'},
  {id:'LOGISTICS_JED',valueSar:30000000,noiSar:2400000,annualDebtServiceSar:1200000,city:'Jeddah',assetType:'LOGISTICS'},
  {id:'RESIDENTIAL_RUH',valueSar:30000000,noiSar:2100000,annualDebtServiceSar:1100000,city:'Riyadh',assetType:'RESIDENTIAL'}
];
const portfolio=evaluatePortfolioDecision({assets:portfolioAssets,limits:{maxSingleAssetWeight:.45,maxCityWeight:.75,maxAssetTypeWeight:.50,minPortfolioDscr:1.50}});
assert.strictEqual(portfolio.status,PORTFOLIO_STATUS.QUALIFIED);
assert.strictEqual(portfolio.metrics.totalValueSar,100000000);
assert.ok(portfolio.metrics.portfolioDscr>1.5);
assert.strictEqual(portfolio.transactionAuthorized,false);
const concentrated=evaluatePortfolioDecision({assets:portfolioAssets.map(a=>({...a,city:'Riyadh'})),limits:{maxSingleAssetWeight:.45,maxCityWeight:.75,maxAssetTypeWeight:.50,minPortfolioDscr:1.50}});
assert.strictEqual(concentrated.status,PORTFOLIO_STATUS.REVIEW_REQUIRED);
assert.ok(concentrated.warnings.includes('CITY_CONCENTRATION_BREACH'));

// 5) Exact dated return simulation with irregular cash flows and fail-closed ambiguity.
const datedCashflows=[
  {date:'2026-01-01',amount:-100000000},
  {date:'2026-10-01',amount:5000000},
  {date:'2027-12-31',amount:8500000},
  {date:'2029-06-30',amount:9500000},
  {date:'2030-12-31',amount:115000000}
];
const dated=solveDatedXirr({cashflows:datedCashflows});
assert.strictEqual(dated.status,DATED_RETURNS_STATUS.QUALIFIED);
assert.ok(Number.isFinite(dated.xirr));
assert.ok(Math.abs(xnpv(dated.xirr,datedCashflows))<.1);
const ambiguous=solveDatedXirr({cashflows:[{date:'2026-01-01',amount:-100},{date:'2027-01-01',amount:230},{date:'2028-01-01',amount:-132}]});
assert.strictEqual(ambiguous.status,DATED_RETURNS_STATUS.HOLD);

// 6) Independent golden-case comparison: within-tolerance set passes; outlier escalates.
const golden=validateGoldenCorpus({cases:[
  {id:'G1',assetType:'OFFICE',sourceRef:'independent-valuation-office',independentValueSar:100000000,modelValueSar:102000000},
  {id:'G2',assetType:'LOGISTICS',sourceRef:'independent-valuation-logistics',independentValueSar:75000000,modelValueSar:73000000},
  {id:'G3',assetType:'RESIDENTIAL',sourceRef:'independent-valuation-residential',independentValueSar:50000000,modelValueSar:51500000}
],tolerancePct:.05});
assert.strictEqual(golden.status,GOLDEN_STATUS.PASS);
const goldenOutlier=validateGoldenCorpus({cases:[{id:'G4',sourceRef:'independent-valuation-outlier',independentValueSar:100000000,modelValueSar:115000000}],tolerancePct:.05});
assert.strictEqual(goldenOutlier.status,GOLDEN_STATUS.REVIEW_REQUIRED);

console.log('financial_integrity_final_simulation: PASS');
