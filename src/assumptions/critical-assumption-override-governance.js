'use strict';

const {
  ASSUMPTION_MODEL_VERSION,
  V2_CANONICAL_ASSUMPTIONS,
  buildAssumptionModelDisclosure,
} = require('./assumption-model');

const CRITICAL_ASSUMPTION_OVERRIDE_GOVERNANCE_VERSION = 'CRITICAL_ASSUMPTION_OVERRIDE_GOVERNANCE_V1';
const CRITICAL_ASSUMPTION_APPROVAL_STATUS = Object.freeze({
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
});
const V2_CRITICAL_ASSUMPTION_KEYS = Object.freeze(Object.keys(V2_CANONICAL_ASSUMPTIONS));

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function parseDateString(value) {
  const text = cleanString(value);
  if (!text) return null;
  const parsed = new Date(text);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function validDateString(value) {
  return parseDateString(value) !== null;
}

function resolveAsOf(value) {
  if (value === undefined || value === null) return new Date();
  const parsed = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    throw new TypeError('asOf must be a valid date');
  }
  return parsed;
}

function percentDelta(baselineValue, overrideValue) {
  if (baselineValue === 0) return null;
  return (overrideValue - baselineValue) / Math.abs(baselineValue);
}

function emptyGovernance(modelVersion, status = 'NO_OVERRIDES') {
  return deepFreeze({
    version: CRITICAL_ASSUMPTION_OVERRIDE_GOVERNANCE_VERSION,
    modelVersion: modelVersion || ASSUMPTION_MODEL_VERSION.LEGACY,
    status,
    decisionReady: true,
    hasCriticalOverrides: false,
    hasIncompleteCriticalOverrides: false,
    resolvedOverrides: {},
    overrides: [],
    blockers: [],
    notice_ar: null,
    notice_en: null,
  });
}

function buildCriticalAssumptionOverrideGovernance({ assumptionRegistry, assumptionModelVersion, asOf } = {}) {
  const modelVersion = assumptionModelVersion || ASSUMPTION_MODEL_VERSION.LEGACY;
  if (modelVersion !== ASSUMPTION_MODEL_VERSION.V2) {
    return emptyGovernance(modelVersion, 'NOT_APPLICABLE');
  }
  if (assumptionRegistry === undefined || assumptionRegistry === null) {
    return emptyGovernance(modelVersion);
  }
  if (!Array.isArray(assumptionRegistry)) {
    return deepFreeze({
      ...emptyGovernance(modelVersion, 'INCOMPLETE_DOCUMENTATION'),
      decisionReady: false,
      hasIncompleteCriticalOverrides: true,
      blockers: ['ASSUMPTION_REGISTRY_ARRAY_REQUIRED'],
      notice_ar: 'بيانات حوكمة الافتراضات غير صالحة؛ النتائج التحليلية ليست جاهزة للقرار.',
      notice_en: 'Assumption-governance data is invalid; analytical results are not decision-ready.',
    });
  }

  const candidatesById = new Map();
  for (const item of assumptionRegistry) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const id = cleanString(item.id);
    if (!V2_CRITICAL_ASSUMPTION_KEYS.includes(id) || item.override !== true) continue;
    if (!candidatesById.has(id)) candidatesById.set(id, []);
    candidatesById.get(id).push(item);
  }

  if (candidatesById.size === 0) return emptyGovernance(modelVersion);

  const asOfDate = resolveAsOf(asOf);
  const overrides = [];
  const resolvedOverrides = {};
  const blockers = [];

  for (const id of V2_CRITICAL_ASSUMPTION_KEYS) {
    const records = candidatesById.get(id) || [];
    if (!records.length) continue;

    if (records.length > 1) {
      const code = `DUPLICATE_CRITICAL_OVERRIDE:${id}`;
      blockers.push(code);
      overrides.push({
        id,
        baselineValue: V2_CANONICAL_ASSUMPTIONS[id],
        overrideValue: null,
        absoluteDelta: null,
        percentDelta: null,
        documentationComplete: false,
        blockers: [code],
        provenance: null,
      });
      continue;
    }

    const item = records[0];
    const itemBlockers = [];
    const numericValueValid = typeof item.value === 'number' && Number.isFinite(item.value);
    if (!numericValueValid) itemBlockers.push(`CRITICAL_OVERRIDE_NUMERIC_VALUE_REQUIRED:${id}`);

    const sourceType = cleanString(item.sourceType);
    const sourceReference = cleanString(item.sourceReference);
    const sourceDate = cleanString(item.sourceDate);
    const reason = cleanString(item.overrideReason);
    const approver = cleanString(item.approver);
    const approvalReference = cleanString(item.approvalReference);
    const approvedAt = cleanString(item.approvedAt);
    const approvalStatus = cleanString(item.approvalStatus);
    const expiresAt = cleanString(item.expiresAt);

    const parsedSourceDate = parseDateString(sourceDate);
    const parsedApprovedAt = parseDateString(approvedAt);
    const parsedExpiresAt = expiresAt ? parseDateString(expiresAt) : null;

    if (!sourceType || !sourceReference || !parsedSourceDate) {
      itemBlockers.push(`CRITICAL_OVERRIDE_SOURCE_EVIDENCE_REQUIRED:${id}`);
    } else if (parsedSourceDate.getTime() > asOfDate.getTime()) {
      itemBlockers.push(`CRITICAL_OVERRIDE_SOURCE_DATE_IN_FUTURE:${id}`);
    }
    if (!reason) itemBlockers.push(`CRITICAL_OVERRIDE_REASON_REQUIRED:${id}`);
    if (!approver) itemBlockers.push(`CRITICAL_OVERRIDE_APPROVER_REQUIRED:${id}`);
    if (!approvalReference) itemBlockers.push(`CRITICAL_OVERRIDE_APPROVAL_REFERENCE_REQUIRED:${id}`);
    if (!parsedApprovedAt) {
      itemBlockers.push(`CRITICAL_OVERRIDE_APPROVAL_DATE_REQUIRED:${id}`);
    } else if (parsedApprovedAt.getTime() > asOfDate.getTime()) {
      itemBlockers.push(`CRITICAL_OVERRIDE_APPROVAL_DATE_IN_FUTURE:${id}`);
    }
    if (approvalStatus !== CRITICAL_ASSUMPTION_APPROVAL_STATUS.APPROVED) {
      itemBlockers.push(`CRITICAL_OVERRIDE_APPROVAL_STATUS_REQUIRED:${id}`);
    }
    if (expiresAt && !parsedExpiresAt) {
      itemBlockers.push(`CRITICAL_OVERRIDE_EXPIRY_DATE_INVALID:${id}`);
    } else if (parsedExpiresAt && parsedExpiresAt.getTime() < asOfDate.getTime()) {
      itemBlockers.push(`CRITICAL_OVERRIDE_EXPIRED:${id}`);
    }

    const baselineValue = V2_CANONICAL_ASSUMPTIONS[id];
    if (numericValueValid) resolvedOverrides[id] = item.value;

    const detail = {
      id,
      baselineValue,
      overrideValue: numericValueValid ? item.value : null,
      absoluteDelta: numericValueValid ? item.value - baselineValue : null,
      percentDelta: numericValueValid ? percentDelta(baselineValue, item.value) : null,
      documentationComplete: itemBlockers.length === 0,
      blockers: itemBlockers,
      provenance: {
        sourceType: sourceType || null,
        sourceReference: sourceReference || null,
        sourceDate: parsedSourceDate ? parsedSourceDate.toISOString() : null,
        reason: reason || null,
        approver: approver || null,
        approvalReference: approvalReference || null,
        approvedAt: parsedApprovedAt ? parsedApprovedAt.toISOString() : null,
        approvalStatus: approvalStatus || null,
      },
    };
    overrides.push(detail);
    blockers.push(...itemBlockers);
  }

  const hasIncompleteCriticalOverrides = blockers.length > 0;
  return deepFreeze({
    version: CRITICAL_ASSUMPTION_OVERRIDE_GOVERNANCE_VERSION,
    modelVersion,
    status: hasIncompleteCriticalOverrides ? 'INCOMPLETE_DOCUMENTATION' : 'READY',
    decisionReady: !hasIncompleteCriticalOverrides,
    hasCriticalOverrides: overrides.length > 0,
    hasIncompleteCriticalOverrides,
    resolvedOverrides,
    overrides,
    blockers,
    notice_ar: hasIncompleteCriticalOverrides
      ? 'تجاوز افتراض حرج غير مكتمل التوثيق أو غير صالح زمنياً؛ النتائج التحليلية تبقى ظاهرة لكنها غير جاهزة للقرار.'
      : null,
    notice_en: hasIncompleteCriticalOverrides
      ? 'A critical assumption override has incomplete or temporally invalid evidence; analytical results remain visible but are not decision-ready.'
      : null,
  });
}

function applyCriticalAssumptionOverrideDecisionGovernance({ engineResult, governance } = {}) {
  if (!engineResult || typeof engineResult !== 'object' || Array.isArray(engineResult)) {
    throw new TypeError('engineResult must be an object');
  }
  const governed = governance || emptyGovernance(ASSUMPTION_MODEL_VERSION.LEGACY, 'NOT_EVALUATED');
  const modelVersion = governed.modelVersion || engineResult.assumptionModelVersion || ASSUMPTION_MODEL_VERSION.LEGACY;
  const base = {
    ...engineResult,
    assumptionModelDisclosure: buildAssumptionModelDisclosure(modelVersion, {
      criticalAssumptionOverrideGovernance: governed,
    }),
    criticalAssumptionOverrideGovernance: governed,
  };

  if (!governed.hasIncompleteCriticalOverrides) return base;

  const priorIncompleteInputs = Array.isArray(engineResult.incompleteInputs) ? engineResult.incompleteInputs : [];
  return {
    ...base,
    analyticalResultsOnly: true,
    decisionStatus: 'INCOMPLETE_INPUTS',
    verdict: 'INCOMPLETE_INPUTS',
    incompleteInputs: [...new Set([...priorIncompleteInputs, 'criticalAssumptionOverrideDocumentation'])],
    decisionBlockers: [...new Set([...(engineResult.decisionBlockers || []), ...governed.blockers])],
    metCount: null,
    totalCriteria: null,
    criteriaDetail: null,
    failedHardGates: [],
    failedSoftCriteria: null,
  };
}

module.exports = {
  CRITICAL_ASSUMPTION_OVERRIDE_GOVERNANCE_VERSION,
  CRITICAL_ASSUMPTION_APPROVAL_STATUS,
  V2_CRITICAL_ASSUMPTION_KEYS,
  buildCriticalAssumptionOverrideGovernance,
  applyCriticalAssumptionOverrideDecisionGovernance,
};
