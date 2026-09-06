'use strict';

const ASSUMPTION_MODEL_VERSION = Object.freeze({
  LEGACY: 'LEGACY',
  V2: 'V2',
});

const V2_APPROVED_ASSUMPTIONS = Object.freeze({
  maintenanceRate: 0.05,
  managementFeeRate: 0.035,
  fixedOpexPerSqm: 40,
  replacementReservePerSqm: 20,
  opexGrowthRate: 0.02,
});

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

function applyAssumptionModel(inputs, version) {
  if (!inputs || typeof inputs !== 'object' || Array.isArray(inputs)) {
    throw new TypeError('inputs must be an object');
  }
  const normalizedVersion = normalizeAssumptionModelVersion(version);
  if (normalizedVersion === ASSUMPTION_MODEL_VERSION.LEGACY) return { ...inputs };
  return {
    ...inputs,
    ...V2_APPROVED_ASSUMPTIONS,
  };
}

function buildAssumptionModelDisclosure(version) {
  const normalizedVersion = normalizeAssumptionModelVersion(version);
  if (normalizedVersion === ASSUMPTION_MODEL_VERSION.V2) {
    return Object.freeze({
      version: normalizedVersion,
      label_ar: 'إصدار الافتراضات V2',
      label_en: 'Assumption Model V2',
      legacyCompatibility: false,
      userApprovedAssumptions: true,
    });
  }
  return Object.freeze({
    version: normalizedVersion,
    label_ar: 'إصدار الافتراضات القديم (توافق)',
    label_en: 'Legacy Assumption Model (Compatibility)',
    legacyCompatibility: true,
    userApprovedAssumptions: false,
  });
}

module.exports = {
  ASSUMPTION_MODEL_VERSION,
  V2_APPROVED_ASSUMPTIONS,
  V2_ASSUMPTION_LABELS,
  normalizeAssumptionModelVersion,
  applyAssumptionModel,
  buildAssumptionModelDisclosure,
};
