'use strict';

const crypto = require('crypto');
const {strictCalendarDateMs} = require('../validation/strict-calendar-instant');

const ASSUMPTION_SUPPORT_STATUS = Object.freeze({
  SUPPORTED: 'SUPPORTED',
  STALE: 'STALE',
  UNSUPPORTED: 'UNSUPPORTED',
  INVALID: 'INVALID',
});

const ASSUMPTION_GATE_STATUS = Object.freeze({
  PASS: 'PASS',
  REVIEW: 'REVIEW',
  HOLD: 'HOLD',
});

const CONFIDENCE = Object.freeze({
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
  UNSUPPORTED: 'UNSUPPORTED',
});

function stableClone(value) {
  if (Array.isArray(value)) return value.map(stableClone);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((out, key) => {
    out[key] = stableClone(value[key]);
    return out;
  }, {});
}

function hash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stableClone(value))).digest('hex');
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function toDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

// Critical override evidence must never be silently repaired by Date coercion.
function strictEvidenceDate(value) {
  const ms = typeof value === 'string' ? strictCalendarDateMs(value.trim()) : NaN;
  return Number.isFinite(ms) ? new Date(ms) : null;
}

function normalizeAssumption(raw, options = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return deepFreeze({ status: ASSUMPTION_SUPPORT_STATUS.INVALID, blockers: ['ASSUMPTION_OBJECT_REQUIRED'] });
  }

  const critical = raw.critical === true;
  const criticalOverride = critical && raw.override === true;
  const dateParser = criticalOverride ? strictEvidenceDate : toDate;
  const reference = options.asOf ?? new Date();
  const asOf = criticalOverride
    ? (reference instanceof Date ? toDate(reference) : strictEvidenceDate(reference))
    : toDate(options.asOf || new Date());
  const sourceDate = dateParser(raw.sourceDate);
  const expiresAt = dateParser(raw.expiresAt);
  const expirySupplied = raw.expiresAt !== undefined && raw.expiresAt !== null
    && (typeof raw.expiresAt !== 'string' || raw.expiresAt.trim() !== '');
  const evidenceCount = Number.isInteger(raw.evidenceCount) && raw.evidenceCount >= 0 ? raw.evidenceCount : 0;
  const confidence = Object.values(CONFIDENCE).includes(raw.confidence) ? raw.confidence : CONFIDENCE.UNSUPPORTED;
  const sourceReference = typeof raw.sourceReference === 'string' ? raw.sourceReference.trim() : '';
  const sourceType = typeof raw.sourceType === 'string' ? raw.sourceType.trim() : '';
  const approver = typeof raw.approver === 'string' ? raw.approver.trim() : '';
  const approvalReference = typeof raw.approvalReference === 'string' ? raw.approvalReference.trim() : '';
  const approvalStatus = typeof raw.approvalStatus === 'string' ? raw.approvalStatus.trim() : '';
  const approvedAt = dateParser(raw.approvedAt);
  const owner = typeof raw.owner === 'string' ? raw.owner.trim() : '';
  const reviewer = typeof raw.reviewer === 'string' ? raw.reviewer.trim() : '';
  const id = typeof raw.id === 'string' ? raw.id.trim() : '';

  const blockers = [];
  if (!id) blockers.push('ASSUMPTION_ID_REQUIRED');
  if (!isFiniteNumber(raw.value) && typeof raw.value !== 'string' && typeof raw.value !== 'boolean') blockers.push('ASSUMPTION_VALUE_REQUIRED');
  if (!sourceReference || !sourceType || !sourceDate) blockers.push('SOURCE_EVIDENCE_REQUIRED');
  if (!owner) blockers.push('ASSUMPTION_OWNER_REQUIRED');
  if (raw.override === true && (!raw.overrideReason || !String(raw.overrideReason).trim())) blockers.push('OVERRIDE_REASON_REQUIRED');

  // P25-compatible fail-closed review boundary for a *critical override*.
  // A user's claim of approval is not independent attestation; even a complete
  // registry entry remains REVIEW, never an automatic decision authorization.
  // Unrelated assumptions and noncritical overrides preserve their old contract.
  if (criticalOverride) {
    if (!isFiniteNumber(raw.value)) blockers.push('CRITICAL_OVERRIDE_NUMERIC_VALUE_REQUIRED');
    if (!asOf) blockers.push('CRITICAL_OVERRIDE_AS_OF_DATE_INVALID');
    if (sourceDate && asOf && sourceDate.getTime() > asOf.getTime()) blockers.push('CRITICAL_OVERRIDE_SOURCE_DATE_IN_FUTURE');
    if (expirySupplied && !expiresAt) blockers.push('CRITICAL_OVERRIDE_EXPIRY_DATE_INVALID');
    if (!approver) blockers.push('CRITICAL_OVERRIDE_APPROVER_REQUIRED');
    if (!approvalReference) blockers.push('CRITICAL_OVERRIDE_APPROVAL_REFERENCE_REQUIRED');
    if (!approvedAt) blockers.push('CRITICAL_OVERRIDE_APPROVAL_DATE_REQUIRED');
    else if (asOf && approvedAt.getTime() > asOf.getTime()) blockers.push('CRITICAL_OVERRIDE_APPROVAL_DATE_IN_FUTURE');
    if (sourceDate && approvedAt && approvedAt.getTime() < sourceDate.getTime()) blockers.push('CRITICAL_OVERRIDE_APPROVAL_PRECEDES_SOURCE');
    if (expiresAt && approvedAt && expiresAt.getTime() < approvedAt.getTime()) blockers.push('CRITICAL_OVERRIDE_EXPIRY_PRECEDES_APPROVAL');
    if (approvalStatus !== 'APPROVED') blockers.push('CRITICAL_OVERRIDE_APPROVAL_STATUS_REQUIRED');
  }

  let status = ASSUMPTION_SUPPORT_STATUS.SUPPORTED;
  if (blockers.length) status = ASSUMPTION_SUPPORT_STATUS.UNSUPPORTED;
  else if (expiresAt && asOf && expiresAt.getTime() < asOf.getTime()) status = ASSUMPTION_SUPPORT_STATUS.STALE;
  // Preserve the established stale diagnostic when a separate chronology or
  // provenance blocker takes precedence in the primary support status.
  if (criticalOverride && status === ASSUMPTION_SUPPORT_STATUS.UNSUPPORTED
      && expiresAt && asOf && expiresAt.getTime() < asOf.getTime()) {
    blockers.push(`CRITICAL_ASSUMPTION_STALE:${id || 'UNKNOWN'}`);
  }

  const normalized = {
    id,
    label: raw.label || id,
    value: raw.value,
    unit: raw.unit || null,
    critical,
    sourceType: sourceType || null,
    sourceReference: sourceReference || null,
    sourceDate: sourceDate ? sourceDate.toISOString() : null,
    geography: raw.geography || null,
    assetType: raw.assetType || null,
    evidenceCount,
    confidence,
    owner: owner || null,
    reviewer: reviewer || null,
    expiresAt: expiresAt ? expiresAt.toISOString() : null,
    override: raw.override === true,
    overrideReason: raw.override === true ? String(raw.overrideReason || '').trim() || null : null,
    ...(criticalOverride ? {
      approver: approver || null,
      approvalReference: approvalReference || null,
      approvedAt: approvedAt ? approvedAt.toISOString() : null,
      approvalStatus: approvalStatus || null,
    } : {}),
    status,
    blockers,
  };
  return deepFreeze({ ...normalized, assumptionHashSha256: hash(normalized) });
}

function evaluateAssumptionRegistry(assumptions, options = {}) {
  if (!Array.isArray(assumptions)) {
    return deepFreeze({
      status: ASSUMPTION_GATE_STATUS.HOLD,
      assumptions: [],
      blockers: ['ASSUMPTION_REGISTRY_ARRAY_REQUIRED'],
      warnings: [],
      registryHashSha256: hash([]),
    });
  }

  const normalized = assumptions.map((item) => normalizeAssumption(item, options));
  const ids = new Set();
  const blockers = [];
  const warnings = [];

  for (const item of normalized) {
    if (item.id && ids.has(item.id)) blockers.push(`DUPLICATE_ASSUMPTION_ID:${item.id}`);
    if (item.id) ids.add(item.id);

    if (item.critical && item.status !== ASSUMPTION_SUPPORT_STATUS.SUPPORTED) {
      blockers.push(`CRITICAL_ASSUMPTION_${item.status}:${item.id || 'UNKNOWN'}`);
    } else if (item.status !== ASSUMPTION_SUPPORT_STATUS.SUPPORTED) {
      warnings.push(`ASSUMPTION_${item.status}:${item.id || 'UNKNOWN'}`);
    }

    if (item.confidence === CONFIDENCE.LOW && item.critical) warnings.push(`CRITICAL_ASSUMPTION_LOW_CONFIDENCE:${item.id}`);
    if (item.override) warnings.push(`ASSUMPTION_OVERRIDE_ACTIVE:${item.id}`);
  }

  const status = blockers.length
    ? ASSUMPTION_GATE_STATUS.HOLD
    : warnings.length
      ? ASSUMPTION_GATE_STATUS.REVIEW
      : ASSUMPTION_GATE_STATUS.PASS;

  const core = { status, assumptions: normalized, blockers, warnings };
  return deepFreeze({ ...core, registryHashSha256: hash(core) });
}

module.exports = {
  ASSUMPTION_SUPPORT_STATUS,
  ASSUMPTION_GATE_STATUS,
  CONFIDENCE,
  normalizeAssumption,
  evaluateAssumptionRegistry,
};
