'use strict';

const crypto = require('crypto');
const { computeNPV } = require('./index');
const { analyzeIRR, IRR_RELIABILITY } = require('./irr-diagnostics');
const { buildMonthlyDebtPlan, classifyFinancingModel } = require('./monthly-debt');
const {
  DSCR_NUMERATOR_BASIS,
  INVESTMENT_FINANCING_INPUT_STATUS,
  verifyInvestmentFinancingMetricsInputIntegrity,
} = require('../../investment/investment-financing-input');

const INVESTMENT_FINANCING_MODEL_VERSION = 'INVESTMENT_FINANCING_METRICS_1.0';
const INVESTMENT_FINANCING_RESULT_STATUS = Object.freeze({
  INVESTMENT_FINANCING_METRICS_READY: 'INVESTMENT_FINANCING_METRICS_READY',
  REVIEW_REQUIRED: 'REVIEW_REQUIRED',
  INVALID_INPUT_PACKET: 'INVALID_INPUT_PACKET',
  INVALID_ECONOMIC_CASE: 'INVALID_ECONOMIC_CASE',
});

function stableClone(value) {
  if (Array.isArray(value)) return value.map(stableClone);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((out, key) => { out[key] = stableClone(value[key]); return out; }, {});
}
function sha256(value) { return crypto.createHash('sha256').update(JSON.stringify(stableClone(value))).digest('hex'); }
function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
function finite(value) { return typeof value === 'number' && Number.isFinite(value); }
function ratio(numerator, denominator) {
  if (!finite(numerator) || !finite(denominator) || denominator <= 0) return null;
  const result = numerator / denominator;
  return Number.isFinite(result) ? result : null;
}
function minimum(values) {
  const filtered = values.filter(Number.isFinite);
  return filtered.length ? Math.min(...filtered) : null;
}
function irrDisclosure(cashflows, rates) {
  const diagnostics = analyzeIRR(cashflows, { financeRate: rates.mirrFinanceRate, reinvestRate: rates.mirrReinvestmentRate });
  return {
    irr: Number.isFinite(diagnostics.irr) ? diagnostics.irr : null,
    mirr: Number.isFinite(diagnostics.mirr) ? diagnostics.mirr : null,
    signChanges: diagnostics.signChanges,
    multipleRootRisk: diagnostics.multipleRootRisk,
    reliability: diagnostics.reliability,
    presentationMetric: diagnostics.presentationMetric,
    reasonCode: diagnostics.reasonCode,
  };
}
function equityMultiple(cashflows) {
  let distributions = 0;
  let contributions = 0;
  for (const value of cashflows) {
    if (!finite(value)) return null;
    if (value > 0) distributions += value;
    else if (value < 0) contributions += -value;
  }
  return contributions > 0 ? distributions / contributions : null;
}
function fail(status, blockers, packet = null) {
  return deepFreeze({
    schemaVersion: 1,
    modelVersion: INVESTMENT_FINANCING_MODEL_VERSION,
    status,
    blockers,
    caseId: packet?.caseId || null,
    propertyRef: packet?.propertyRef || null,
    valuationDate: packet?.valuationDate || null,
    inputPacketHashSha256: packet?.investmentFinancingMetricsInputHashSha256 || null,
    professionalDcfValueIndicationSar: packet?.professionalDcfValueIndicationSar ?? null,
    unleveredMetrics: null,
    debtMetrics: null,
    equityMetrics: null,
    automaticDebtSizing: false,
    lenderApprovalEstablished: false,
    creditDecisionMade: false,
    valuationChangedByFinancing: false,
    finalValuationConclusionEstablished: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
  });
}

function calculateInvestmentFinancingMetrics(packet) {
  if (!packet || typeof packet !== 'object'
      || packet.status !== INVESTMENT_FINANCING_INPUT_STATUS.READY_FOR_CANONICAL_INVESTMENT_FINANCING_METRICS
      || packet.readyForCanonicalInvestmentFinancingMetrics !== true
      || !verifyInvestmentFinancingMetricsInputIntegrity(packet)) {
    return fail(INVESTMENT_FINANCING_RESULT_STATUS.INVALID_INPUT_PACKET, ['INVESTMENT_FINANCING_INPUT_NOT_READY_OR_INTEGRITY_FAILED'], packet);
  }

  const investmentBasisSar = packet.investmentBasisInput.amountSar;
  if (!finite(investmentBasisSar) || investmentBasisSar <= 0) return fail(INVESTMENT_FINANCING_RESULT_STATUS.INVALID_ECONOMIC_CASE, ['INVESTMENT_BASIS_INVALID'], packet);
  if (!Array.isArray(packet.operatingPropertyCashFlows) || packet.operatingPropertyCashFlows.length === 0) return fail(INVESTMENT_FINANCING_RESULT_STATUS.INVALID_ECONOMIC_CASE, ['OPERATING_PROPERTY_CASH_FLOWS_REQUIRED'], packet);
  if (!finite(packet.netTerminalValueSar)) return fail(INVESTMENT_FINANCING_RESULT_STATUS.INVALID_ECONOMIC_CASE, ['NET_TERMINAL_VALUE_INVALID'], packet);

  const rates = packet.returnAnalysisRateInput;
  if (![rates.npvDiscountRate, rates.mirrFinanceRate, rates.mirrReinvestmentRate].every((value) => finite(value) && value >= 0 && value <= 1)) {
    return fail(INVESTMENT_FINANCING_RESULT_STATUS.INVALID_ECONOMIC_CASE, ['RETURN_ANALYSIS_RATES_INVALID'], packet);
  }

  const futureUnleveredCashFlows = [];
  const propertyCashFlowTrace = [];
  for (let i = 0; i < packet.operatingPropertyCashFlows.length; i += 1) {
    const period = packet.operatingPropertyCashFlows[i];
    if (!period || period.periodIndex !== i + 1 || !finite(period.selectedNoiSar) || !finite(period.unleveredPropertyCashFlowSar)) {
      return fail(INVESTMENT_FINANCING_RESULT_STATUS.INVALID_ECONOMIC_CASE, [`PROPERTY_CASH_FLOW_PERIOD_INVALID:${period?.periodId || i + 1}`], packet);
    }
    let totalUnleveredCashFlowSar = period.unleveredPropertyCashFlowSar;
    const terminalProceedsSar = i === packet.operatingPropertyCashFlows.length - 1 ? packet.netTerminalValueSar : 0;
    totalUnleveredCashFlowSar += terminalProceedsSar;
    if (!finite(totalUnleveredCashFlowSar)) return fail(INVESTMENT_FINANCING_RESULT_STATUS.INVALID_ECONOMIC_CASE, [`TOTAL_UNLEVERED_CASH_FLOW_NON_FINITE:${period.periodId}`], packet);
    futureUnleveredCashFlows.push(totalUnleveredCashFlowSar);
    propertyCashFlowTrace.push({
      periodId: period.periodId,
      periodIndex: period.periodIndex,
      professionalNoiSar: period.selectedNoiSar,
      unleveredPropertyCashFlowBeforeTerminalSar: period.unleveredPropertyCashFlowSar,
      terminalProceedsSar,
      totalUnleveredCashFlowSar,
    });
  }

  const unleveredCashflows = [-investmentBasisSar, ...futureUnleveredCashFlows];
  let unleveredNpv;
  try { unleveredNpv = computeNPV(rates.npvDiscountRate, unleveredCashflows); } catch (_) {
    return fail(INVESTMENT_FINANCING_RESULT_STATUS.INVALID_ECONOMIC_CASE, ['UNLEVERED_NPV_CALCULATION_FAILED'], packet);
  }
  const unleveredIrr = irrDisclosure(unleveredCashflows, rates);
  const yieldOnCost = ratio(packet.stabilizedProfessionalNoiSar, investmentBasisSar);
  const unlevered = {
    investmentBasisType: packet.investmentBasisInput.type,
    investmentBasisSar,
    npvDiscountRate: rates.npvDiscountRate,
    cashflows: unleveredCashflows,
    cashFlowTrace: propertyCashFlowTrace,
    npvSar: unleveredNpv,
    irr: unleveredIrr.irr,
    mirr: unleveredIrr.mirr,
    irrDiagnostics: unleveredIrr,
    yieldOnCost,
    professionalDcfValueIndicationSar: packet.professionalDcfValueIndicationSar,
    professionalDcfValueUsedAsInvestmentBasisAutomatically: false,
  };

  let debtMetrics = null;
  let equityCashflows = [...unleveredCashflows];
  let initialEquitySar = investmentBasisSar;
  const reviewFlags = [];
  if (packet.professionalDcfStatus === 'REVIEW_REQUIRED') reviewFlags.push('PROFESSIONAL_DCF_METHOD_INDICATION_REVIEW_REQUIRED');
  if (unleveredIrr.reliability === IRR_RELIABILITY.MULTIPLE_ROOT_RISK) reviewFlags.push('UNLEVERED_IRR_MULTIPLE_ROOT_RISK');
  if (unleveredIrr.reliability !== IRR_RELIABILITY.RELIABLE) reviewFlags.push(`UNLEVERED_IRR_${unleveredIrr.reliability}`);

  if (packet.financingEnabled) {
    const terms = packet.debtTermsInput;
    const collateral = packet.collateralValueBasisInput;
    if (!terms || !collateral) return fail(INVESTMENT_FINANCING_RESULT_STATUS.INVALID_ECONOMIC_CASE, ['FINANCING_INPUTS_MISSING'], packet);
    let debtPlan;
    try {
      debtPlan = buildMonthlyDebtPlan(terms.principalSar, terms.annualRate, terms.tenorYears, {
        gracePeriodMonths: terms.gracePeriodMonths,
        graceType: terms.graceType,
        balloonPct: terms.balloonPct,
      });
    } catch (_) {
      return fail(INVESTMENT_FINANCING_RESULT_STATUS.INVALID_ECONOMIC_CASE, ['DEBT_PLAN_CALCULATION_FAILED'], packet);
    }
    const financingClassification = classifyFinancingModel(terms.financingModelLabel);
    const holdPeriods = packet.operatingPropertyCashFlows.length;
    const annualDebtTrace = [];
    const dscrValues = [];
    const icrValues = [];
    for (let i = 0; i < holdPeriods; i += 1) {
      const property = packet.operatingPropertyCashFlows[i];
      const row = debtPlan.annualSchedule[i] || null;
      const debtServiceSar = row ? row.payment : 0;
      const interestExpenseSar = row ? row.interest : 0;
      const principalPaidSar = row ? row.principal + row.balloon : 0;
      const endingLoanBalanceSar = row ? row.balance : 0;
      const dscrNumeratorSar = packet.dscrNumeratorBasis === DSCR_NUMERATOR_BASIS.PROFESSIONAL_NOI
        ? property.selectedNoiSar
        : property.unleveredPropertyCashFlowSar;
      const dscr = debtServiceSar > 0 ? ratio(dscrNumeratorSar, debtServiceSar) : null;
      const icr = interestExpenseSar > 0 ? ratio(property.selectedNoiSar, interestExpenseSar) : null;
      if (dscr !== null) dscrValues.push(dscr);
      if (icr !== null) icrValues.push(icr);
      annualDebtTrace.push({
        periodId: property.periodId,
        periodIndex: property.periodIndex,
        professionalNoiSar: property.selectedNoiSar,
        unleveredPropertyCashFlowSar: property.unleveredPropertyCashFlowSar,
        dscrNumeratorBasis: packet.dscrNumeratorBasis,
        dscrNumeratorSar,
        debtServiceSar,
        interestExpenseSar,
        principalPaidSar,
        endingLoanBalanceSar,
        dscr,
        icr,
      });
    }

    const finalScheduleRow = holdPeriods <= debtPlan.annualSchedule.length ? debtPlan.annualSchedule[holdPeriods - 1] : null;
    const remainingLoanBalanceAtExitSar = finalScheduleRow ? finalScheduleRow.balance : 0;
    const ltv = ratio(terms.principalSar, collateral.amountSar);
    const ltc = ratio(terms.principalSar, investmentBasisSar);
    const debtYield = ratio(packet.stabilizedProfessionalNoiSar, terms.principalSar);
    const minimumDscr = minimum(dscrValues);
    const minimumIcr = minimum(icrValues);
    initialEquitySar = investmentBasisSar + terms.financingFeesSar - terms.principalSar;
    if (!finite(initialEquitySar) || initialEquitySar < 0) return fail(INVESTMENT_FINANCING_RESULT_STATUS.INVALID_ECONOMIC_CASE, ['INITIAL_EQUITY_INVALID'], packet);

    const futureEquityCashFlows = [];
    for (let i = 0; i < holdPeriods; i += 1) {
      const property = packet.operatingPropertyCashFlows[i];
      const debtRow = annualDebtTrace[i];
      let equityCashFlowSar = property.unleveredPropertyCashFlowSar - debtRow.debtServiceSar;
      if (i === holdPeriods - 1) equityCashFlowSar += packet.netTerminalValueSar - remainingLoanBalanceAtExitSar;
      if (!finite(equityCashFlowSar)) return fail(INVESTMENT_FINANCING_RESULT_STATUS.INVALID_ECONOMIC_CASE, [`EQUITY_CASH_FLOW_NON_FINITE:${property.periodId}`], packet);
      futureEquityCashFlows.push(equityCashFlowSar);
    }
    equityCashflows = [-initialEquitySar, ...futureEquityCashFlows];

    debtMetrics = {
      debtId: terms.debtId,
      financingModelLabel: terms.financingModelLabel,
      financingClassification,
      principalSar: terms.principalSar,
      annualRate: terms.annualRate,
      tenorYears: terms.tenorYears,
      financingFeesSar: terms.financingFeesSar,
      gracePeriodMonths: terms.gracePeriodMonths,
      graceType: terms.graceType,
      balloonPct: terms.balloonPct,
      collateralValueBasisType: collateral.type,
      collateralValueBasisSar: collateral.amountSar,
      ltv,
      ltc,
      ltcBasisType: packet.investmentBasisInput.type,
      debtYield,
      debtYieldNumerator: 'STABILIZED_PROFESSIONAL_NOI',
      minimumDscr,
      dscrNumeratorBasis: packet.dscrNumeratorBasis,
      minimumIcr,
      remainingLoanBalanceAtExitSar,
      annualDebtTrace,
      automaticDebtSizing: false,
      lenderApprovalEstablished: false,
      creditDecisionMade: false,
    };

    if (ltv !== null && ltv > 1) reviewFlags.push('LTV_ABOVE_100_PERCENT_REVIEW_REQUIRED');
    if (ltc !== null && ltc > 1) reviewFlags.push('LTC_ABOVE_100_PERCENT_REVIEW_REQUIRED');
    if (minimumDscr !== null && minimumDscr < 1) reviewFlags.push('DSCR_BELOW_1X_REVIEW_REQUIRED');
    if (minimumIcr !== null && minimumIcr < 1) reviewFlags.push('ICR_BELOW_1X_REVIEW_REQUIRED');
    if (initialEquitySar === 0) reviewFlags.push('ZERO_INITIAL_EQUITY_REVIEW_REQUIRED');
  }

  let equityNpv;
  try { equityNpv = computeNPV(rates.npvDiscountRate, equityCashflows); } catch (_) {
    return fail(INVESTMENT_FINANCING_RESULT_STATUS.INVALID_ECONOMIC_CASE, ['EQUITY_NPV_CALCULATION_FAILED'], packet);
  }
  const equityIrr = irrDisclosure(equityCashflows, rates);
  const equity = {
    allEquityCase: !packet.financingEnabled,
    initialEquitySar,
    cashflows: equityCashflows,
    npvSar: equityNpv,
    irr: equityIrr.irr,
    mirr: equityIrr.mirr,
    irrDiagnostics: equityIrr,
    equityMultiple: equityMultiple(equityCashflows),
  };
  if (equityIrr.reliability === IRR_RELIABILITY.MULTIPLE_ROOT_RISK) reviewFlags.push('EQUITY_IRR_MULTIPLE_ROOT_RISK');
  if (equityIrr.reliability !== IRR_RELIABILITY.RELIABLE) reviewFlags.push(`EQUITY_IRR_${equityIrr.reliability}`);

  const core = {
    schemaVersion: 1,
    modelVersion: INVESTMENT_FINANCING_MODEL_VERSION,
    caseId: packet.caseId,
    propertyRef: packet.propertyRef,
    valuationDate: packet.valuationDate,
    inputPacketHashSha256: packet.investmentFinancingMetricsInputHashSha256,
    professionalDcfCalculationHashSha256: packet.professionalDcfCalculationHashSha256,
    professionalDcfValueIndicationSar: packet.professionalDcfValueIndicationSar,
    professionalNoiCalculationHashSha256: packet.professionalNoiCalculationHashSha256,
    financingEnabled: packet.financingEnabled,
    unleveredMetrics: unlevered,
    debtMetrics,
    equityMetrics: equity,
  };
  return deepFreeze({
    ...core,
    calculationHashSha256: sha256(core),
    status: reviewFlags.length ? INVESTMENT_FINANCING_RESULT_STATUS.REVIEW_REQUIRED : INVESTMENT_FINANCING_RESULT_STATUS.INVESTMENT_FINANCING_METRICS_READY,
    blockers: [],
    reviewFlags: [...new Set(reviewFlags)],
    professionalValuationLayerSeparated: true,
    automaticDebtSizing: false,
    lenderApprovalEstablished: false,
    creditDecisionMade: false,
    valuationChangedByFinancing: false,
    finalValuationConclusionEstablished: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
    semantics: 'The canonical investment/financing metrics engine computes return, debt and equity analytics from explicit investment, DCF/NOI and financing inputs. It does not alter the professional DCF value indication, size debt, approve credit, establish regulated advice, certify a valuation or authorize a transaction. Financing-model classification remains an analytical proxy unless supported by executed lender documentation.',
  });
}

module.exports = {
  INVESTMENT_FINANCING_MODEL_VERSION,
  INVESTMENT_FINANCING_RESULT_STATUS,
  calculateInvestmentFinancingMetrics,
};
