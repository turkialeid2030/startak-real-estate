'use strict';

const { deepFreeze } = require('./contracts');
const { assessOperatingUnderwritingReadiness } = require('./readiness');
const { calculateOperatingMetrics } = require('./operating-metrics');
const { calculatePropertyCosts } = require('./property-costs');

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
    capabilityStatus: 'PROPERTY_COSTS_V1',
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
    financialCalculationExecuted: false,
    investmentDecision: null,
    legalConclusion: null,
    transactionAuthorized: false,
    semantics: 'No operating case is loaded. This projection does not calculate NOI, value, returns, make an investment decision, provide a legal conclusion, or authorize a transaction.',
  });
}

function createResidentialIncomeAcquisitionViewModel(operatingCase = null) {
  if (operatingCase == null) return createEmptyResidentialIncomeAcquisitionViewModel();

  const readiness = assessOperatingUnderwritingReadiness(operatingCase);
  const operatingMetrics = calculateOperatingMetrics(operatingCase);
  const propertyCosts = calculatePropertyCosts(operatingCase, operatingMetrics);
  return deepFreeze({
    schemaVersion: 1,
    capability: 'RESIDENTIAL_INCOME_ACQUISITION_INTELLIGENCE',
    capabilityStatus: 'PROPERTY_COSTS_V1',
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
    financialCalculationExecuted: false,
    investmentDecision: null,
    legalConclusion: null,
    transactionAuthorized: false,
    semantics: readiness.semantics,
  });
}

module.exports = {
  RESIDENTIAL_INCOME_ACQUISITION_API_STATUS,
  createEmptyResidentialIncomeAcquisitionViewModel,
  createResidentialIncomeAcquisitionViewModel,
};
