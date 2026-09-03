'use strict';

const { deepFreeze } = require('./contracts');
const { assessOperatingUnderwritingReadiness } = require('./readiness');
const { calculateOperatingMetrics } = require('./operating-metrics');
const { calculatePropertyCosts } = require('./property-costs');
const { calculateIncomeAnalysis } = require('./income-analysis');
const { calculateAcquisitionBasis } = require('./acquisition-basis');
const { calculateReverseUnderwriting } = require('./reverse-underwriting');
const { calculateExitStrategyComparison } = require('./exit-strategy');
const { calculateLifecycleLocationUpsideIntelligence } = require('./lifecycle-location-upside');
const {
  SUBDIVISION_ASSESSMENT_STATUS,
  calculateSubdivisionDueDiligenceGate,
} = require('./subdivision-gate');
const {
  DECISION_LAYER_STATUS,
  calculateAcquisitionAnalyticalScore,
  buildScenarioIntegration,
  buildInvestmentCommitteePack,
} = require('./decision-layer');

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
    rentCollectionCount: (operatingCase.rentCollections || []).length,
    tenantCount: operatingCase.tenants.length,
    operatingExpenseCount: operatingCase.operatingExpenses.length,
    capexItemCount: operatingCase.capexItems.length,
    exitScenarioCount: (operatingCase.exitScenarios || []).length,
    operatingInputCount: operatingCase.additionalOperatingInputs.length,
    evidenceLineageCount: operatingCase.evidenceLineage.length,
  });
}

function createEmptyResidentialIncomeAcquisitionViewModel() {
  return deepFreeze({
    schemaVersion: 1,
    capability: 'RESIDENTIAL_INCOME_ACQUISITION_INTELLIGENCE',
    capabilityStatus: 'EXIT_STRATEGY_COMPARISON_V1',
    intelligenceExtensionStatus: 'LIFECYCLE_LOCATION_UPSIDE_AND_IC_V1',
    subdivisionExtensionStatus: 'SUBDIVISION_DUE_DILIGENCE_GATE_V1',
    strategicEvidenceExtensionStatus: 'STRATEGIC_EVIDENCE_GOVERNANCE_V1',
    collectionsExtensionStatus: 'RENT_ROLL_COLLECTIONS_RECONCILIATION_V1',
    apiStatus: RESIDENTIAL_INCOME_ACQUISITION_API_STATUS.NOT_LOADED,
    caseId: null,
    operatingCase: null,
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
    lifecycleLocationUpside: null,
    subdivisionGate: null,
    scenarioIntegration: null,
    acquisitionAnalyticalScore: null,
    investmentCommitteePack: null,
    financialCalculationExecuted: false,
    stabilizedNoiCalculated: false,
    acquisitionBasisCalculated: false,
    reverseUnderwritingCalculated: false,
    exitStrategyComparisonCalculated: false,
    lifecycleLocationUpsideCalculated: false,
    subdivisionGateCalculated: false,
    strategicEvidenceGovernanceCalculated: false,
    acquisitionAnalyticalScoreCalculated: false,
    investmentDecision: null,
    legalConclusion: null,
    transactionAuthorized: false,
    semantics: 'No operating case is loaded. This projection does not calculate NOI, analytical price limits, exit-scenario comparisons, lifecycle/location/upside intelligence, subdivision eligibility, acquisition analytical scores, returns, make an investment decision, provide a legal conclusion, or authorize a transaction.',
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
  const subdivisionGate = calculateSubdivisionDueDiligenceGate(operatingCase);
  const lifecycleLocationUpside = calculateLifecycleLocationUpsideIntelligence(operatingCase, { subdivisionGate });
  const scenarioIntegration = buildScenarioIntegration({
    exitStrategyComparison,
    intelligenceBundle: lifecycleLocationUpside,
  });
  const acquisitionAnalyticalScore = calculateAcquisitionAnalyticalScore({
    operatingMetrics,
    propertyCosts,
    reverseUnderwriting,
    exitStrategyComparison,
    intelligenceBundle: lifecycleLocationUpside,
  });
  const investmentCommitteePack = buildInvestmentCommitteePack({
    operatingCase,
    readiness,
    operatingMetrics,
    propertyCosts,
    incomeAnalysis,
    acquisitionBasis,
    reverseUnderwriting,
    exitStrategyComparison,
    intelligenceBundle: lifecycleLocationUpside,
    scenarioIntegration,
    acquisitionScore: acquisitionAnalyticalScore,
  });
  return deepFreeze({
    schemaVersion: 1,
    capability: 'RESIDENTIAL_INCOME_ACQUISITION_INTELLIGENCE',
    capabilityStatus: 'EXIT_STRATEGY_COMPARISON_V1',
    intelligenceExtensionStatus: 'LIFECYCLE_LOCATION_UPSIDE_AND_IC_V1',
    subdivisionExtensionStatus: 'SUBDIVISION_DUE_DILIGENCE_GATE_V1',
    strategicEvidenceExtensionStatus: 'STRATEGIC_EVIDENCE_GOVERNANCE_V1',
    collectionsExtensionStatus: 'RENT_ROLL_COLLECTIONS_RECONCILIATION_V1',
    apiStatus: RESIDENTIAL_INCOME_ACQUISITION_API_STATUS.CASE_LOADED,
    caseId: operatingCase.caseId,
    operatingCase,
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
    lifecycleLocationUpside,
    subdivisionGate,
    scenarioIntegration,
    acquisitionAnalyticalScore,
    investmentCommitteePack,
    financialCalculationExecuted: incomeAnalysis.financialCalculationExecuted || acquisitionBasis.financialCalculationExecuted,
    stabilizedNoiCalculated: incomeAnalysis.stabilizedNoiCalculated,
    acquisitionBasisCalculated: acquisitionBasis.acquisitionBasisCalculated,
    reverseUnderwritingCalculated: reverseUnderwriting.reverseUnderwritingCalculated,
    exitStrategyComparisonCalculated: exitStrategyComparison.exitStrategyComparisonCalculated,
    lifecycleLocationUpsideCalculated: lifecycleLocationUpside.status !== 'NOT_CALCULABLE',
    subdivisionGateCalculated: subdivisionGate.status !== SUBDIVISION_ASSESSMENT_STATUS.NOT_ASSESSED,
    strategicEvidenceGovernanceCalculated: lifecycleLocationUpside.evidenceGovernance.status !== 'NOT_ASSESSED',
    acquisitionAnalyticalScoreCalculated: acquisitionAnalyticalScore.status !== DECISION_LAYER_STATUS.NOT_CALCULABLE,
    investmentDecision: null,
    legalConclusion: null,
    transactionAuthorized: false,
    semantics: 'Operating readiness, unit/lease metrics, property costs, evidence-gated income analysis, acquisition-basis reconciliation, explicit-policy reverse underwriting, evidence-gated exit-scenario comparison, lifecycle/location/forward-attraction/upside intelligence, an eleven-check fail-closed subdivision due-diligence gate, scenario-attribution review, a deterministic non-binding acquisition analytical score, and an investment-committee data pack. Subdivision eligibility permits scenario testing only and is not authority approval. Contextual signals are not automatically financialized and no output is a certified valuation, legal conclusion, regulated investment recommendation, financing approval, or transaction authorization.',
  });
}

module.exports = {
  RESIDENTIAL_INCOME_ACQUISITION_API_STATUS,
  createEmptyResidentialIncomeAcquisitionViewModel,
  createResidentialIncomeAcquisitionViewModel,
};
