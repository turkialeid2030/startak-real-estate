'use strict';

const ASSUMPTION_MODEL_VERSION = Object.freeze({
  LEGACY: 'LEGACY',
  V2: 'V2',
});

// P25: these are canonical analytical baseline assumptions for V2. They are
// not, by their presence in code, evidence of user/committee approval.
const V2_CANONICAL_ASSUMPTIONS = Object.freeze({
  maintenanceRate: 0.05,
  managementFeeRate: 0.035,
  fixedOpexPerSqm: 40,
  replacementReservePerSqm: 20,
  opexGrowthRate: 0.02,
});

// Backward-compatible export only. The historical symbol name must not be read
// as approval evidence. New code should use V2_CANONICAL_ASSUMPTIONS.
const V2_APPROVED_ASSUMPTIONS = V2_CANONICAL_ASSUMPTIONS;

// P25 hardening: use a Symbol capability instead of a string property so a
// serialized/raw deal payload cannot forge the internal override transport key.
// Only in-process governed code holding this Symbol can attach resolved values.
const INTERNAL_CRITICAL_OVERRIDE_KEY = Symbol('p25CriticalAssumptionOverrides');

const V2_ASSUMPTION_LABELS = Object.freeze({
  maintenanceRate: Object.freeze({
    ar: 'صيانة وتشغيل وأمن ونظافة',
    en: 'Maintenance, Operations, Security & Cleaning',
  }),
  managementFeeRate: Object.freeze({
    ar: 'رسوم الإدارة',
    en: 'Management Fee',
  }),
  fixedOpexPerSqm: Object.freeze({
    ar: 'المصروف التشغيلي الثابت لكل متر مربع سنوياً',
    en: 'Annual Fixed OPEX per Square Meter',
  }),
  replacementReservePerSqm: Object.freeze({
    ar: 'احتياطي الإحلال لكل متر مربع سنوياً',
    en: 'Annual Replacement Reserve per Square Meter',
  }),
  opexGrowthRate: Object.freeze({
    ar: 'معدل النمو السنوي للمصروف التشغيلي الثابت واحتياطي الإحلال',
    en: 'Annual Fixed OPEX & Replacement Reserve Growth Rate',
  }),
});

function normalizeAssumptionModelVersion(value) {
  if (value === undefined || value === null || value === '') return ASSUMPTION_MODEL_VERSION.LEGACY;
  if (Object.values(ASSUMPTION_MODEL_VERSION).includes(value)) return value;
  const error = new Error(`Unsupported assumption model version: ${value}`);
  error.code = 'UNKNOWN_ASSUMPTION_MODEL_VERSION';
  throw error;
}

function applyAssumptionModel(inputs, version, context = {}) {
  if (!inputs || typeof inputs !== 'object' || Array.isArray(inputs)) {
    throw new TypeError('inputs must be an object');
  }
  const normalizedVersion = normalizeAssumptionModelVersion(version);
  const {
    [INTERNAL_CRITICAL_OVERRIDE_KEY]: embeddedCriticalOverrides,
    ...economicInputs
  } = inputs;
  if (normalizedVersion === ASSUMPTION_MODEL_VERSION.LEGACY) return { ...economicInputs };

  const contextualOverrides = context && context.criticalOverrides && typeof context.criticalOverrides === 'object'
    ? context.criticalOverrides
    : null;
  const requestedOverrides = contextualOverrides
    || (embeddedCriticalOverrides && typeof embeddedCriticalOverrides === 'object' && !Array.isArray(embeddedCriticalOverrides)
      ? embeddedCriticalOverrides
      : {});
  const criticalOverrides = {};
  for (const key of Object.keys(V2_CANONICAL_ASSUMPTIONS)) {
    if (Object.prototype.hasOwnProperty.call(requestedOverrides, key)
        && typeof requestedOverrides[key] === 'number'
        && Number.isFinite(requestedOverrides[key])) {
      criticalOverrides[key] = requestedOverrides[key];
    }
  }

  return {
    ...economicInputs,
    ...V2_CANONICAL_ASSUMPTIONS,
    ...criticalOverrides,
  };
}

function buildAssumptionModelDisclosure(version, context = {}) {
  const normalizedVersion = normalizeAssumptionModelVersion(version);
  if (normalizedVersion === ASSUMPTION_MODEL_VERSION.V2) {
    const governance = context && context.criticalAssumptionOverrideGovernance;
    const hasCriticalOverrides = governance && governance.hasCriticalOverrides === true;
    const documentationComplete = hasCriticalOverrides && governance.hasIncompleteCriticalOverrides !== true;
    return Object.freeze({
      version: normalizedVersion,
      label_ar: 'إصدار الافتراضات V2',
      label_en: 'Assumption Model V2',
      legacyCompatibility: false,
      // Deprecated compatibility field. A code default is not approval evidence.
      userApprovedAssumptions: false,
      canonicalBaselineIsApprovalEvidence: false,
      criticalOverridesPresent: hasCriticalOverrides,
      criticalOverridesDocumentationComplete: hasCriticalOverrides ? documentationComplete : null,
      criticalOverrideApprovalEvidenceStatus: !hasCriticalOverrides
        ? 'NOT_APPLICABLE'
        : (documentationComplete ? 'EXPLICIT_EVIDENCE_PRESENT' : 'INCOMPLETE'),
    });
  }
  return Object.freeze({
    version: normalizedVersion,
    label_ar: 'إصدار الافتراضات القديم (توافق)',
    label_en: 'Legacy Assumption Model (Compatibility)',
    legacyCompatibility: true,
    userApprovedAssumptions: false,
    canonicalBaselineIsApprovalEvidence: false,
    criticalOverridesPresent: false,
    criticalOverridesDocumentationComplete: null,
    criticalOverrideApprovalEvidenceStatus: 'NOT_APPLICABLE',
  });
}

module.exports = {
  ASSUMPTION_MODEL_VERSION,
  V2_CANONICAL_ASSUMPTIONS,
  V2_APPROVED_ASSUMPTIONS,
  V2_ASSUMPTION_LABELS,
  INTERNAL_CRITICAL_OVERRIDE_KEY,
  normalizeAssumptionModelVersion,
  applyAssumptionModel,
  buildAssumptionModelDisclosure,
};
