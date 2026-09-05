'use strict';

const {
  SAVED_DEAL_VALUATION_MODE,
  validateValuationCaseExtension,
  createExistingBuildingValuationRequest,
  orchestrateValuationStage,
} = require('../valuation-intelligence');
const { createValuationPresentation } = require('./valuation-presentation');

const VALUATION_RUNTIME_MODE = Object.freeze({
  LEGACY_ONLY: SAVED_DEAL_VALUATION_MODE.LEGACY_ONLY,
  VALUATION_V1: SAVED_DEAL_VALUATION_MODE.VALUATION_V1,
});

function requireObject(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${field} must be an object`);
  return value;
}

function requiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}

function evaluateExistingBuildingValuation({
  caseId,
  legacyInput,
  legacyResult,
  valuationCase = null,
} = {}) {
  const normalizedCaseId = requiredString(caseId, 'caseId');
  requireObject(legacyInput, 'legacyInput');
  requireObject(legacyResult, 'legacyResult');

  if (valuationCase === null || valuationCase === undefined) {
    return Object.freeze({
      schemaVersion: 1,
      mode: VALUATION_RUNTIME_MODE.LEGACY_ONLY,
      caseId: normalizedCaseId,
      projectId: null,
      stage: null,
      presentation: null,
      semantics: 'No valuationCase configuration is present. The existing-building legacy calculation remains the only active calculation path; no valuation configuration is inferred or migrated automatically.',
    });
  }

  validateValuationCaseExtension(valuationCase);

  const request = createExistingBuildingValuationRequest({
    caseId: normalizedCaseId,
    projectId: valuationCase.projectId,
    classification: valuationCase.classification,
    legacyInput,
    legacyResult,
    incomePolicy: valuationCase.incomePolicy,
    marketComparableInput: valuationCase.marketComparableInput || null,
    costPolicy: valuationCase.costPolicy || null,
    evidence: valuationCase.evidence || {},
    evidencePolicy: valuationCase.evidencePolicy || null,
    criticalEvidenceRequirements: valuationCase.criticalEvidenceRequirements || {},
    singleMethodPolicy: valuationCase.singleMethodPolicy || null,
    reconciliationPolicy: valuationCase.reconciliationPolicy || null,
  });

  const stage = orchestrateValuationStage(request);
  const presentation = createValuationPresentation(stage);

  return Object.freeze({
    schemaVersion: 1,
    mode: VALUATION_RUNTIME_MODE.VALUATION_V1,
    caseId: normalizedCaseId,
    projectId: valuationCase.projectId,
    stage,
    presentation,
    semantics: 'Valuation V1 is additive to the unchanged existing-building legacy calculation. It consumes the already-computed legacy result through a controlled adapter and does not replace or mutate the canonical legacy engine output.',
  });
}

module.exports = {
  VALUATION_RUNTIME_MODE,
  evaluateExistingBuildingValuation,
};
