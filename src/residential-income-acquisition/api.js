'use strict';

const { deepFreeze } = require('./contracts');
const { assessOperatingUnderwritingReadiness } = require('./readiness');
const { calculateOperatingMetrics } = require('./operating-metrics');
const { calculatePropertyCosts } = require('./property-costs');
const { calculateIncomeAnalysis } = require('./income-analysis');
const { calculateAcquisitionBasis } = require('./acquisition-basis');
const { calculateReverseUnderwriting } = require('./reverse-underwriting');
const { calculateExitStrategyComparison } = require('./exit-strategy');
const { calculateStrategicAssetIntelligence } = require('./strategic-asset-intelligence');

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
    exitScenarioCount: (operatingCase.exitScenarios || []).length,
    locationFactorCount: operatingCase.strategicAssetProfile ? operatingCase.strategicAssetProfile.locationFactors.length : 0,
    upsideCatalystCount: operatingCase.strategicAssetProfile ? operatingCase.strategicAssetProfile.upsideCatalysts.length : 0,
    subdivisionCheckCount: operatingCase.strategicAssetProfile ? operatingCase.strategicAssetProfile.subdivisionChecks.length : 0,
    operatingInputCount: operatingCase.additionalOperatingInputs.length,
    evidenceLineageCount: operatingCase.evidenceLineage.length,
  });
}

function createEmptyResidentialIncomeAcquisitionViewModel() {
  return deepFreeze({
    schemaVersion: 1,
    capability: 'RESIDENTIAL_INCOME_ACQUISITION_INTELLIGENCE',
    capabilityStatus: 'STRATEGIC_ASSET_INTELLIGENCE_V1',
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
    exitStrategyComparison: null,
    strategicAssetIntelligence: null,
    financialCalculationExecuted: false,
    stabilizedNoiCalculated: false,
    acquisitionBasisCalculated: false,
    reverseUnderwritingCalculated: false,
    exitStrategyComparisonCalculated: false,
    strategicAssetIntelligenceCalculated: false,
    investmentDecision: null,
    legalConclusion: null,
    transactionAuthorized: false,
    semantics: 'No operating case is loaded. This projection does not calculate NOI, analytical price limits, exit-scenario comparisons, strategic asset scores, returns, make an investment decision, provide a legal conclusion, or authorize a transaction.',
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
  const exitStrategyComparison = calculateExitStrategyComparison(operatingCase, incomeAnalysis, acquisitionBasis, readiness);
  const strategicAssetIntelligence = calculateStrategicAssetIntelligence(operatingCase);
  return deepFreeze({
    schemaVersion: 1,
    capability: 'RESIDENTIAL_INCOME_ACQUISITION_INTELLIGENCE',
    capabilityStatus: 'STRATEGIC_ASSET_INTELLIGENCE_V1',
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
    exitStrategyComparison,
    strategicAssetIntelligence,
    financialCalculationExecuted: incomeAnalysis.financialCalculationExecuted || acquisitionBasis.financialCalculationExecuted,
    stabilizedNoiCalculated: incomeAnalysis.stabilizedNoiCalculated,
    acquisitionBasisCalculated: acquisitionBasis.acquisitionBasisCalculated,
    reverseUnderwritingCalculated: reverseUnderwriting.reverseUnderwritingCalculated,
    exitStrategyComparisonCalculated: exitStrategyComparison.exitStrategyComparisonCalculated,
    strategicAssetIntelligenceCalculated: strategicAssetIntelligence.strategicAssetIntelligenceCalculated,
    investmentDecision: null,
    legalConclusion: null,
    transactionAuthorized: false,
    semantics: 'Operating readiness, unit/lease metrics, property costs, evidence-gated income analysis, acquisition-basis reconciliation, explicit-policy reverse underwriting, evidence-gated exit-scenario comparison, and evidence-linked strategic asset intelligence. Scores, rankings, catalysts, and price limits remain non-binding and are not certified valuations, forecasts, approvals, legal conclusions, investment recommendations, financing approvals, or transaction authorizations.',
  });
}

module.exports = {
  RESIDENTIAL_INCOME_ACQUISITION_API_STATUS,
  createEmptyResidentialIncomeAcquisitionViewModel,
  createResidentialIncomeAcquisitionViewModel,
};
