'use strict';

// COV-001 post-Wave-A: terminal value must capitalize forward STABILIZED NOI,
// not first-year lease-up NOI and not a mechanically grown prior NOI. The test
// independently reconstructs the forward stabilized year from input economics.
const { calculateInvestmentCase, STUDY_TYPE } = require('../../src/engines');
const gold = require(require('../config/paths').getGoldBaselinePath());

const B = gold['RE-GOLD-002_existing_building'].inputs;
const inputs = { ...B, rentGrowthRate: 0.03, holdPeriod: 5, leverageEnabled: false };
const result = calculateInvestmentCase({ studyType: STUDY_TYPE.EXISTING_BUILDING, inputs, leverageEnabled: false });

const forwardIndex = inputs.holdPeriod;
const forwardRental = result.netLeasableArea * inputs.rentPerSqm * inputs.occupancyRate * Math.pow(1 + inputs.rentGrowthRate, forwardIndex);
const forwardService = forwardRental * inputs.serviceIncomeRate;
const forwardRevenue = forwardRental + forwardService;
const variableRate = Number.isFinite(inputs.variableOpexRate) ? inputs.variableOpexRate : inputs.maintenanceRate;
const managementRate = Number.isFinite(inputs.managementFeeRate) ? inputs.managementFeeRate : 0;
const fixedPerSqm = Number.isFinite(inputs.fixedOpexPerSqm) ? inputs.fixedOpexPerSqm : 0;
const reservePerSqm = Number.isFinite(inputs.replacementReservePerSqm) ? inputs.replacementReservePerSqm : 0;
const opexGrowth = Number.isFinite(inputs.opexGrowthRate) ? inputs.opexGrowthRate : 0;
const replacementGrowth = Number.isFinite(inputs.replacementCostGrowthRate) ? inputs.replacementCostGrowthRate : 0;
const insuranceRate = Number.isFinite(inputs.insuranceRateOnReplacementCost) ? inputs.insuranceRateOnReplacementCost : inputs.insuranceRate;
const fixedExpense = result.netLeasableArea * fixedPerSqm * Math.pow(1 + opexGrowth, forwardIndex);
const variableExpense = forwardRevenue * variableRate;
const managementFee = forwardRevenue * managementRate;
const insurance = result.totalReplacementConstructionValue * Math.pow(1 + replacementGrowth, forwardIndex) * insuranceRate;
const reserve = result.netLeasableArea * reservePerSqm * Math.pow(1 + opexGrowth, forwardIndex);
const forwardStabilizedNOI = forwardRevenue - fixedExpense - variableExpense - managementFee - insurance - reserve;
const expectedSaleValue = forwardStabilizedNOI / result.exitCapRate;

const results = [];
function check(id, cond, detail) { results.push(cond); console.log(`${id}: ${cond ? 'PASS' : 'FAIL'} -- ${detail}`); }
check('COV-001-POSITIVE-GROWTH', inputs.rentGrowthRate > 0, `rentGrowthRate=${inputs.rentGrowthRate}`);
check('COV-001-HOLDING-PERIOD-GT-1', inputs.holdPeriod > 1, `holdPeriod=${inputs.holdPeriod}`);
check('COV-001-INDEPENDENT-EXIT-CAP', result.exitCapRate > 0, `exitCapRate=${result.exitCapRate}`);
check('COV-001-FORWARD-STABILIZED-NOI', Math.abs(result.terminalSaleValue - expectedSaleValue) < 1,
  `terminal=${result.terminalSaleValue.toFixed(2)} expected=${expectedSaleValue.toFixed(2)}`);
const finalFlow = result.cashflows[result.cashflows.length - 1];
const finalNoi = result.operatingNoiCashflows[result.operatingNoiCashflows.length - 1];
check('COV-001-FINAL-CASHFLOW-DECOMPOSITION', Math.abs(finalFlow - finalNoi - result.terminalNetSaleProceeds) < 1e-6,
  'final cash flow = final operating NOI + net terminal proceeds');

const allPass = results.every(Boolean);
console.log(`\nCOV_001_WAVE_A_TEST=${allPass ? 'PASS' : 'FAIL'}`);
process.exit(allPass ? 0 : 1);
