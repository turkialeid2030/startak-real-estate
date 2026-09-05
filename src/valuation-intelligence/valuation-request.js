'use strict';

const { ASSET_CLASS } = require('../project-model/project-profile');

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) freeze(child);
  return value;
}

function requiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}

function requireObject(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${field} must be an object`);
  return value;
}

function normalizeUseComponents(useComponents) {
  if (!Array.isArray(useComponents)) throw new TypeError('useComponents must be an array');
  return useComponents.map((component, index) => {
    requireObject(component, `useComponents[${index}]`);
    const id = requiredString(component.id, `useComponents[${index}].id`);
    const assetClass = component.assetClass;
    if (!Object.values(ASSET_CLASS).includes(assetClass)) throw new TypeError(`useComponents[${index}].assetClass is invalid: ${assetClass}`);
    return {
      ...component,
      id,
      assetClass,
    };
  });
}

function normalizeReconciliationPolicy(policy) {
  if (policy === null || policy === undefined) return null;
  requireObject(policy, 'reconciliationPolicy');
  requireObject(policy.methodWeights, 'reconciliationPolicy.methodWeights');
  if (typeof policy.dispersionThreshold !== 'number' || !Number.isFinite(policy.dispersionThreshold) || policy.dispersionThreshold < 0) {
    throw new TypeError('reconciliationPolicy.dispersionThreshold must be a finite number >= 0');
  }
  return {
    methodWeights: { ...policy.methodWeights },
    dispersionThreshold: policy.dispersionThreshold,
  };
}

function normalizeEvidencePolicy(policy) {
  if (policy === null || policy === undefined) return null;
  requireObject(policy, 'evidencePolicy');
  return { ...policy };
}

function normalizeCriticalEvidenceRequirements(requirements) {
  if (requirements === null || requirements === undefined) return {};
  requireObject(requirements, 'criticalEvidenceRequirements');
  const normalized = {};
  for (const [method, items] of Object.entries(requirements)) {
    if (!Array.isArray(items)) throw new TypeError(`criticalEvidenceRequirements.${method} must be an array`);
    normalized[method] = items.map((item) => ({ ...item }));
  }
  return normalized;
}

function createValuationRequest({
  caseId,
  projectId,
  projectProfile,
  useComponents = [],
  methodInputs = {},
  evidencePolicy = null,
  criticalEvidenceRequirements = {},
  reconciliationPolicy = null,
} = {}) {
  const normalizedCaseId = requiredString(caseId, 'caseId');
  const normalizedProjectId = requiredString(projectId, 'projectId');
  requireObject(projectProfile, 'projectProfile');
  if (projectProfile.projectId !== normalizedProjectId) throw new Error('VALUATION_REQUEST_PROJECT_SCOPE_MISMATCH');
  requireObject(methodInputs, 'methodInputs');

  return freeze({
    schemaVersion: 1,
    caseId: normalizedCaseId,
    projectId: normalizedProjectId,
    projectProfile,
    useComponents: normalizeUseComponents(useComponents),
    methodInputs: { ...methodInputs },
    evidencePolicy: normalizeEvidencePolicy(evidencePolicy),
    criticalEvidenceRequirements: normalizeCriticalEvidenceRequirements(criticalEvidenceRequirements),
    reconciliationPolicy: normalizeReconciliationPolicy(reconciliationPolicy),
    semantics: 'A valuation request carries explicit project classification, optional use components, engine-ready method inputs, explicit evidence-quality governance, and explicit reconciliation policy. It does not invent missing evidence or hidden valuation policy defaults.',
  });
}

module.exports = {
  createValuationRequest,
};
