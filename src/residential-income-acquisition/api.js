'use strict';

const { deepFreeze } = require('./contracts');
const { assessOperatingUnderwritingReadiness } = require('./readiness');
const { calculateOperatingMetrics } = require('./operating-metrics');
const { calculatePropertyCosts } = require('./property-costs');
const { calculateIncomeAnalysis } = require('./income-analysis');
const { calculateAcquisitionBasis } = require('./acquisition-basis');
const { calculateReverseUnderwriting } = require('./reverse-underwriting');

const RESIDENTIAL_INCOME_ACQUISITION_API_STATUS = Object.freeze({
  NOT_LOADED: 'NOT_LOADED',
  CASE_LOADED: 'CASE_LOADED',
});

function summarizeOperatingCase(operatingCase) {
  return deepFreeze({
    propertyInterestCount: operatingCase.propertyInterest ? 1 : 0,
    propertyCount: operatingCase.property ? 1 : 0,
    buildingCount: operatingCase.buildings.length,
    unitCount: operatingCase.units.length,
    leaseCount: operatingCase.leases.length,
    tenantCount: operatingCase.tenants.length,
    operatingExpenseCount: operatingCase.operatingExpenses.length,
    capexItemCount: operatingCase.capexItems.length,
    operatingInputCount: operatingCase.additionalOperatingInputs.length,
    evidenceLineageCount: operatingCase.evidenceLineage.length,
  });
}

function createEmptyResidentialIncomeAcquisitionViewModel() {
  return deepFreeze({
    schemaVersion: 1,
    capability: 'RESIDENTIAL_INCOME_ACQUISITION_INTELLIGENCE',
    capabilityStatus: 'REVERSE_UNDERWRITING_V2',
    apiStatus: RESIDENTIAL_INCOME_ACQUISITION_API_STATUS.NOT_LOADED,
    caseId: null,
    asOfDate: null,
    readinessStatus: null,
    summary: null,
    blockers: [],
    evidenceGaps: [],
    dueDiligence: [],
    assumptions: [],
    warnings: [],
    lineage: null,
    operatingMetrics: null,
    propertyCosts: null,
    incomeAnalysis: null,
    acquisitionBasis: null,
    reverseUnderwriting: null,
    financialCalculationExecuted: false,
    stabilizedNoiCalculated: false,
    acquisitionBasisCalculated: false,
    reverseUnderwritingCalculated: false,
    investmentDecision: null,
    legalConclusion: null,
    transactionAuthorized: false,
    semantics: 'No operating case is loaded. This projection does not calculate NOI, analytical price limits, returns, make an investment decision, provide a legal conclusion, or authorize a transaction.',
  });
}

function createResidentialIncomeAcquisitionViewModel(operatingCase = null) {
  if (operatingCase == null) return createEmptyResidentialIncomeAcquisitionViewModel();

  const readiness = assessOperatingUnderwritingReadiness(operatingCase);
  const operatingMetrics = calculateOperatingMetrics(operatingCase);
  const propertyCosts = calculatePropertyCosts(operatingCase, operatingMetrics);
  const incomeAnalysis = calculateIncomeAnalysis(operatingCase, operatingMetrics, propertyCosts, readiness);
  const acquisitionBasis = calculateAcquisitionBasis(operatingCase, propertyCosts, readiness);
  const reverseUnderwriting = calculateReverseUnderwriting(operatingCase, incomeAnalysis, acquisitionBasis, readiness);
  return deepFreeze({
    schemaVersion: 1,
    capability: 'RESIDENTIAL_INCOME_ACQUISITION_INTELLIGENCE',
    capabilityStatus: 'REVERSE_UNDERWRITING_V2',
    apiStatus: RESIDENTIAL_INCOME_ACQUISITION_API_STATUS.CASE_LOADED,
    caseId: operatingCase.caseId,
    asOfDate: operatingCase.asOfDate,
    readinessStatus: readiness.status,
    summary: summarizeOperatingCase(operatingCase),
    blockers: readiness.blockers,
    evidenceGaps: readiness.evidenceGaps,
    dueDiligence: readiness.dueDiligence,
    assumptions: readiness.assumptions,
    warnings: readiness.warnings,
    lineage: readiness.lineage,
    operatingMetrics,
    propertyCosts,
    incomeAnalysis,
    acquisitionBasis,
    reverseUnderwriting,
    financialCalculationExecuted: incomeAnalysis.financialCalculationExecuted || acquisitionBasis.financialCalculationExecuted,
    stabilizedNoiCalculated: incomeAnalysis.stabilizedNoiCalculated,
    acquisitionBasisCalculated: acquisitionBasis.acquisitionBasisCalculated,
    reverseUnderwritingCalculated: reverseUnderwriting.reverseUnderwritingCalculated,
    investmentDecision: null,
    legalConclusion: null,
    transactionAuthorized: false,
    semantics: 'Operating readiness, unit/lease metrics, property costs, evidence-gated income analysis, acquisition-basis reconciliation, and explicit-policy reverse underwriting. Any analytical price limit remains non-binding and is not a certified valuation, legal conclusion, investment recommendation, financing approval, or transaction authorization.',
  });
}

module.exports = {
  RESIDENTIAL_INCOME_ACQUISITION_API_STATUS,
  createEmptyResidentialIncomeAcquisitionViewModel,
  createResidentialIncomeAcquisitionViewModel,
};
