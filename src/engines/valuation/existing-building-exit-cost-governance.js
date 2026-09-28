'use strict';

const { computeNPV, computeIRR, analyzeIRR } = require('../financial');
const { tierVerdict } = require('../recommendation');
const {
  EXIT_TRANSACTION_COST_SOURCE,
  resolveExitTransactionCostRate,
} = require('./exit-transaction-cost-resolver');

function updateCashflowTerminal(cashflows, oldNetTerminal, newNetTerminal) {
  if (!Array.isArray(cashflows) || cashflows.length < 2) return cashflows;
  const out = [...cashflows];
  const last = out.length - 1;
  const oldTerminal = Number.isFinite(oldNetTerminal) ? oldNetTerminal : 0;
  out[last] = out[last] - oldTerminal + newNetTerminal;
  return out;
}

function rebuildDecision(result, inputs, irr, npv, leveredNpv) {
  const criteria = (result.criteriaDetail || []).map((item) => {
    if (item.code === 'IRR_MEETS_HURDLE') {
      return { ...item, met: Number.isFinite(irr) && irr >= inputs.discountRate };
    }
    if (item.code === 'NPV_NON_NEGATIVE') {
      return { ...item, met: Number.isFinite(npv) && npv >= 0 };
    }
    if (item.code === 'LEVERED_NPV_NON_NEGATIVE') {
      return { ...item, met: Number.isFinite(leveredNpv) && leveredNpv >= 0 };
    }
    return { ...item };
  });
  return tierVerdict(criteria);
}

function holdExitDependentAnalytics(result, resolution) {
  const incompleteInputs = Array.from(new Set([
    ...(Array.isArray(result.incompleteInputs) ? result.incompleteInputs : []),
    'exitTransferFeeRate',
  ]));
  const operatingOnlyCashflows = Array.isArray(result.operatingNoiCashflows)
    ? [-result.totalPurchaseCost, ...result.operatingNoiCashflows]
    : result.cashflows;

  return {
    ...result,
    financialModelStatus: 'INCOMPLETE_INPUTS',
    exitTransactionCostSource: resolution.status,
    exitTransactionCostRate: null,
    exitTransactionCostRequiresVisibleDisclosure: true,
    statutoryExitTaxpayerDetermined: false,
    exitDependentAnalyticsReady: false,
    incompleteInputs,
    cashflowsIncludeTerminalValue: false,
    cashflows: operatingOnlyCashflows,
    terminalNetSaleProceeds: null,
    irr: null,
    npv: null,
    irrDiagnostics: null,
    irrReliability: null,
    irrMultipleRootRisk: null,
    irrSignChanges: null,
    mirr: null,
    leveredCashflows: null,
    leveredIRR: null,
    leveredNPV: null,
    leveredIrrDiagnostics: null,
    leveredMirr: null,
    leveredIrrReliability: null,
    c3: null,
    c6: null,
    c7: null,
    criteriaDetail: [],
    metCount: 0,
    totalCriteria: 0,
    verdict: 'INCOMPLETE_INPUTS',
    decisionStatus: 'INCOMPLETE_INPUTS',
    failedHardGates: [],
    failedSoftCriteria: [],
  };
}

/**
 * Apply a dedicated seller-borne exit transaction-cost assumption to the
 * existing-building result without changing acquisition economics.
 *
 * The underlying Wave-A engine historically reuses transferFeeRate at exit.
 * This governed post-processing layer preserves that behavior for LEGACY deals,
 * but V2 requires an explicit exitTransferFeeRate. It recalculates only the
 * exit-dependent cash flows/returns/decision gates. Acquisition cost remains
 * based exclusively on transferFeeRate.
 */
function applyExistingBuildingExitCostGovernance({ inputs, engineResult, assumptionModelVersion }) {
  if (!engineResult || typeof engineResult !== 'object') throw new TypeError('engineResult is required');
  const resolution = resolveExitTransactionCostRate(inputs, { assumptionModelVersion });

  if (resolution.status === EXIT_TRANSACTION_COST_SOURCE.MISSING_REQUIRED) {
    return holdExitDependentAnalytics(engineResult, resolution);
  }

  // If exit-cap governance is already incomplete, preserve its hold while still
  // publishing exit-cost provenance metadata.
  if (engineResult.decisionStatus === 'INCOMPLETE_INPUTS') {
    return {
      ...engineResult,
      exitTransactionCostSource: resolution.status,
      exitTransactionCostRate: resolution.value,
      exitTransactionCostRequiresVisibleDisclosure: resolution.requiresVisibleDisclosure,
      statutoryExitTaxpayerDetermined: false,
    };
  }

  const terminalSaleValue = Number(engineResult.terminalSaleValue);
  const newNetTerminal = Number.isFinite(terminalSaleValue)
    ? terminalSaleValue * (1 - resolution.value)
    : engineResult.terminalNetSaleProceeds;
  const oldNetTerminal = engineResult.terminalNetSaleProceeds;
  const cashflows = updateCashflowTerminal(engineResult.cashflows, oldNetTerminal, newNetTerminal);
  const irr = computeIRR(cashflows);
  const npv = computeNPV(inputs.discountRate, cashflows);
  const irrDiagnostics = analyzeIRR(cashflows, {
    financeRate: inputs.discountRate,
    reinvestRate: inputs.discountRate,
  });

  // Wave-B financing will recalculate levered economics later when leverage is
  // active. Updating the Wave-A compatibility fields here keeps the unlevered
  // path internally coherent and avoids stale legacy disclosures.
  let leveredCashflows = engineResult.leveredCashflows;
  let leveredIRR = engineResult.leveredIRR;
  let leveredNPV = engineResult.leveredNPV;
  let leveredIrrDiagnostics = engineResult.leveredIrrDiagnostics;
  if (Array.isArray(leveredCashflows)) {
    leveredCashflows = updateCashflowTerminal(leveredCashflows, oldNetTerminal, newNetTerminal);
    leveredIRR = computeIRR(leveredCashflows);
    leveredNPV = computeNPV(engineResult.equityDiscountRate, leveredCashflows);
    leveredIrrDiagnostics = analyzeIRR(leveredCashflows, {
      financeRate: engineResult.equityDiscountRate,
      reinvestRate: engineResult.equityDiscountRate,
    });
  }

  const verdictResult = rebuildDecision(engineResult, inputs, irr, npv, leveredNPV);

  return {
    ...engineResult,
    exitTransactionCostSource: resolution.status,
    exitTransactionCostRate: resolution.value,
    exitTransactionCostRequiresVisibleDisclosure: resolution.requiresVisibleDisclosure,
    statutoryExitTaxpayerDetermined: false,
    terminalNetSaleProceeds: newNetTerminal,
    cashflows,
    irr,
    npv,
    irrDiagnostics,
    irrReliability: irrDiagnostics.reliability,
    irrMultipleRootRisk: irrDiagnostics.multipleRootRisk,
    irrSignChanges: irrDiagnostics.signChanges,
    mirr: irrDiagnostics.mirr,
    leveredCashflows,
    leveredIRR,
    leveredNPV,
    leveredIrrDiagnostics,
    leveredMirr: leveredIrrDiagnostics ? leveredIrrDiagnostics.mirr : null,
    leveredIrrReliability: leveredIrrDiagnostics ? leveredIrrDiagnostics.reliability : null,
    c3: Number.isFinite(irr) && irr >= inputs.discountRate,
    c6: Number.isFinite(npv) && npv >= 0,
    c7: inputs.leverageEnabled ? Number.isFinite(leveredNPV) && leveredNPV >= 0 : null,
    criteriaDetail: verdictResult.criteria,
    metCount: verdictResult.met,
    totalCriteria: verdictResult.total,
    verdict: verdictResult.verdict,
    decisionStatus: verdictResult.decisionStatus,
    failedHardGates: verdictResult.failedHardGates,
    failedSoftCriteria: verdictResult.failedSoftCriteria,
  };
}

module.exports = {
  applyExistingBuildingExitCostGovernance,
  updateCashflowTerminal,
};
