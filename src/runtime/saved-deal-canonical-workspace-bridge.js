'use strict';

const { validateSavedDealRecord } = require('../validation/saved-deal-schema');
const {
  materializeUiAssumptions,
  calculateUiInvestmentState,
  studyTypeForMode,
} = require('../assumptions/ui-integration-controller');
const {
  reconstructHistoricalStandardsEnvironment,
} = require('../standards/saved-deal-standards-snapshot');
const { createCanonicalCaseWorkspace } = require('./canonical-case-workspace');

function assertPlainObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`);
  }
}

function createSavedDealDomainOutputs({ savedDeal, inputs, uiState, projectId, caseId }) {
  const sharedIdentity = { projectId, caseId };
  const hasValuationCase = Object.prototype.hasOwnProperty.call(savedDeal, 'valuationCase');
  const hasStandardsSnapshot = Boolean(savedDeal.standardsSnapshotVersion);

  return {
    assignment: hasStandardsSnapshot
      ? {
          ...sharedIdentity,
          status: 'FOUNDATION_ONLY',
          source: 'SAVED_DEAL_STANDARDS_CONTEXT',
          purpose: savedDeal.valuationStandardsContext.purpose,
          intendedUse: savedDeal.valuationStandardsContext.intendedUse,
          intendedUser: savedDeal.valuationStandardsContext.intendedUser,
        }
      : { ...sharedIdentity, status: 'NOT_EVALUATED' },
    scope: hasStandardsSnapshot
      ? {
          ...sharedIdentity,
          status: 'FOUNDATION_ONLY',
          source: 'SAVED_DEAL_STANDARDS_CONTEXT',
          assetType: savedDeal.valuationStandardsContext.assetType,
          jurisdiction: savedDeal.valuationStandardsContext.jurisdiction,
        }
      : { ...sharedIdentity, status: 'NOT_EVALUATED' },
    assumptions: {
      ...sharedIdentity,
      status: uiState.assumptionOverrideHold ? 'ANALYTICAL_HOLD' : 'IMPLEMENTED',
      source: 'VALIDATED_SAVED_DEAL_INPUTS',
      assumptionModelVersion: uiState.assumptionModelVersion,
      // Only absence of source evidence is recorded; no fabricated approval.
      overrideRegistryPresent: savedDeal.assumptionRegistry != null,
      overrideDocumentationHold: uiState.assumptionOverrideHold,
      items: { ...inputs },
    },
    financialModel: {
      ...sharedIdentity,
      status: uiState.assumptionOverrideHold ? 'ANALYTICAL_HOLD' : 'IMPLEMENTED',
      source: 'CANONICAL_CALCULATION_ENGINE',
      decisionStatus: uiState.results.decisionStatus || null,
      analyticalResultsOnly: uiState.results.analyticalResultsOnly === true,
      unsupportedAssumptionOverride: uiState.assumptionOverrideHold,
      cashflows: Array.isArray(uiState.results.cashflows) ? uiState.results.cashflows.slice() : [],
      irr: uiState.results.irr,
      npv: uiState.results.npv,
      leveredIRR: uiState.results.leveredIRR,
      leveredNPV: uiState.results.leveredNPV,
    },
    // The canonical lifecycle uses "finance" as its qualified section;
    // setting financialModel.status alone is NOT sufficient to keep the
    // lifecycle from treating an unsupported historical override as complete.
    ...(uiState.assumptionOverrideHold ? {
      finance: {
        ...sharedIdentity,
        status: 'ANALYTICAL_HOLD',
        source: 'UNQUALIFIED_HISTORICAL_ASSUMPTION_OVERRIDE',
        decisionStatus: 'INCOMPLETE_INPUTS',
        transactionAuthorized: false,
      },
    } : {}),
    valuation: hasValuationCase
      ? {
          ...sharedIdentity,
          status: 'FOUNDATION_ONLY',
          source: 'SAVED_DEAL_VALUATION_INTELLIGENCE_EXTENSION',
          valuationCase: savedDeal.valuationCase,
        }
      : { ...sharedIdentity, status: 'NOT_EVALUATED' },
    review: { ...sharedIdentity, status: 'NOT_EVALUATED' },
    reporting: { ...sharedIdentity, status: 'NOT_EVALUATED' },
    investmentCommittee: { ...sharedIdentity, status: 'NOT_EVALUATED' },
    governance: hasStandardsSnapshot
      ? {
          ...sharedIdentity,
          status: 'FOUNDATION_ONLY',
          source: 'HISTORICAL_STANDARDS_SNAPSHOT',
          standardsSnapshotVersion: savedDeal.standardsSnapshotVersion,
        }
      : { ...sharedIdentity, status: 'NOT_EVALUATED' },
  };
}

function createCanonicalWorkspaceFromSavedDeal({
  savedDeal,
  workspaceId,
  projectProfile,
  caseId,
  attribution = {},
}) {
  assertPlainObject(savedDeal, 'savedDeal');
  assertPlainObject(projectProfile, 'projectProfile');
  validateSavedDealRecord(savedDeal);

  const projectId = projectProfile.projectId;
  if (typeof projectId !== 'string' || projectId.trim() === '') {
    throw new TypeError('projectProfile.projectId must be a non-empty string');
  }

  const inputs = materializeUiAssumptions(savedDeal.inputs, savedDeal.assumptionModelVersion);
  const uiState = calculateUiInvestmentState({
    mode: savedDeal.mode,
    inputs,
    assumptionModelVersion: savedDeal.assumptionModelVersion,
    // Legacy override provenance must reach the canonical decision gate.
    // Baseline economics must not masquerade as an approved overridden case.
    assumptionRegistry: savedDeal.assumptionRegistry ?? null,
  });

  const standardsContext = savedDeal.standardsSnapshotVersion
    ? reconstructHistoricalStandardsEnvironment(savedDeal)
    : null;

  const domainOutputs = createSavedDealDomainOutputs({
    savedDeal,
    inputs,
    uiState,
    projectId,
    caseId,
  });

  const workspace = createCanonicalCaseWorkspace({
    workspaceId,
    projectId,
    caseId,
    projectProfile,
    studyType: studyTypeForMode(savedDeal.mode),
    inputs,
    engineResult: uiState.results,
    verdict: uiState.results.verdict,
    domainOutputs,
    standardsContext,
    attribution,
  });

  return Object.freeze({
    ...workspace,
    sourceRecord: Object.freeze({
      type: 'SAVED_DEAL',
      id: savedDeal.id || null,
      savedAt: savedDeal.savedAt || null,
      mode: savedDeal.mode,
      assumptionModelVersion: uiState.assumptionModelVersion,
      historicalStandardsSnapshotPresent: Boolean(savedDeal.standardsSnapshotVersion),
      valuationExtensionPresent: Object.prototype.hasOwnProperty.call(savedDeal, 'valuationCase'),
    }),
    boundaries: Object.freeze({
      savedDealStructurallyValidated: true,
      economicInputsValidatedByCanonicalEngine: true,
      canonicalEngineInvocations: 1,
      professionalAssignmentCompleted: false,
      professionalValuationCertified: false,
      investmentDecisionAutomated: false,
      transactionAuthorized: false,
    }),
  });
}

module.exports = {
  createSavedDealDomainOutputs,
  createCanonicalWorkspaceFromSavedDeal,
};
