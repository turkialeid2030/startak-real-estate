'use strict';

const { deepFreeze } = require('./contracts');

function canonicalize(value) {
  if (value === null || value === undefined) return value === undefined ? null : value;
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value !== 'object') return value;
  return Object.keys(value)
    .sort()
    .reduce((acc, key) => {
      acc[key] = canonicalize(value[key]);
      return acc;
    }, {});
}

function canonicalStringify(value) {
  return JSON.stringify(canonicalize(value));
}

function sortSemanticSet(values) {
  return [...values]
    .map(canonicalize)
    .sort((a, b) => canonicalStringify(a).localeCompare(canonicalStringify(b)));
}

function buildSnapshotSemanticPayload({
  routerVersion,
  routerInputHash,
  standardRefs = [],
  ruleRefs = [],
  activationApprovalRefs = [],
  valuationDate = null,
  reportDate = null,
  engagementDate = null,
}) {
  if (typeof routerVersion !== 'string' || routerVersion.trim() === '') throw new TypeError('routerVersion is required');
  if (routerInputHash !== null && (typeof routerInputHash !== 'string' || routerInputHash.trim() === '')) {
    throw new TypeError('routerInputHash must be null or a non-empty string');
  }
  if (![standardRefs, ruleRefs, activationApprovalRefs].every(Array.isArray)) {
    throw new TypeError('standardRefs, ruleRefs and activationApprovalRefs must be arrays');
  }

  return canonicalize({
    schemaVersion: 1,
    routerVersion,
    routerInputHash,
    standardRefs: sortSemanticSet(standardRefs),
    ruleRefs: sortSemanticSet(ruleRefs),
    activationApprovalRefs: sortSemanticSet(activationApprovalRefs),
    valuationDate,
    reportDate,
    engagementDate,
  });
}

function assertSha256Hex(value, field) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/i.test(value)) {
    throw new TypeError(`${field} must be a 64-character SHA-256 hex digest`);
  }
}

function computeSnapshotHash(payload, hashFn) {
  if (typeof hashFn !== 'function') throw new TypeError('hashFn is required');
  const digest = hashFn(canonicalStringify(payload));
  assertSha256Hex(digest, 'snapshotHash');
  return digest.toLowerCase();
}

function createStandardsSnapshot({
  standardsSnapshotId,
  snapshotVersion,
  createdAt,
  hashFn,
  ...semanticFields
}) {
  if (typeof standardsSnapshotId !== 'string' || standardsSnapshotId.trim() === '') {
    throw new TypeError('standardsSnapshotId is required');
  }
  if (typeof snapshotVersion !== 'string' || snapshotVersion.trim() === '') throw new TypeError('snapshotVersion is required');
  const created = new Date(createdAt || Date.now());
  if (Number.isNaN(created.getTime())) throw new TypeError('createdAt must be a valid date/time');

  const semanticPayload = buildSnapshotSemanticPayload(semanticFields);
  const snapshotHash = computeSnapshotHash(semanticPayload, hashFn);

  return deepFreeze({
    schemaVersion: 1,
    standardsSnapshotId,
    snapshotVersion,
    snapshotHash,
    createdAt: created.toISOString(),
    ...semanticPayload,
  });
}

function verifyStandardsSnapshot(snapshot, hashFn) {
  if (!snapshot || typeof snapshot !== 'object') throw new TypeError('snapshot is required');
  assertSha256Hex(snapshot.snapshotHash, 'snapshot.snapshotHash');
  const semanticPayload = buildSnapshotSemanticPayload(snapshot);
  const computedHash = computeSnapshotHash(semanticPayload, hashFn);
  return deepFreeze({
    valid: computedHash === snapshot.snapshotHash.toLowerCase(),
    expectedHash: snapshot.snapshotHash.toLowerCase(),
    computedHash,
  });
}

module.exports = {
  canonicalize,
  canonicalStringify,
  sortSemanticSet,
  buildSnapshotSemanticPayload,
  computeSnapshotHash,
  createStandardsSnapshot,
  verifyStandardsSnapshot,
};