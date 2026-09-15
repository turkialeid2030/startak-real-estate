'use strict';

const {
  deepFreeze,
  normalizeStandardRecord,
  normalizeStandardRule,
} = require('./contracts');
const {
  canonicalize,
  canonicalStringify,
  verifyStandardsSnapshot,
} = require('./snapshot');
const { routeStandards } = require('./purpose-router');

const REPLAY_STATUS = Object.freeze({
  REPRODUCIBLE: 'REPRODUCIBLE',
  DRIFT_DETECTED: 'DRIFT_DETECTED',
  HOLD_INTEGRITY_FAILURE: 'HOLD_INTEGRITY_FAILURE',
});

function assertNonEmptyString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`);
}

function assertSha256Hex(value, field) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/i.test(value)) {
    throw new TypeError(`${field} must be a 64-character SHA-256 hex digest`);
  }
}

function normalizeTimestamp(value, field) {
  const date = new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) throw new TypeError(`${field} must be a valid date/time`);
  return date.toISOString();
}

function hashCanonical(value, hashFn, field = 'hash') {
  if (typeof hashFn !== 'function') throw new TypeError('hashFn is required');
  const digest = hashFn(canonicalStringify(value));
  assertSha256Hex(digest, field);
  return digest.toLowerCase();
}

function normalizeRouteResultForReplay(routeResult) {
  if (!routeResult || typeof routeResult !== 'object') throw new TypeError('routeResult is required');
  return canonicalize({
    schemaVersion: routeResult.schemaVersion,
    routerVersion: routeResult.routerVersion,
    routerInputHash: routeResult.routerInputHash ?? null,
    productionIntegration: routeResult.productionIntegration,
    applicableStandardIds: [...(routeResult.applicableStandardIds || [])].sort(),
    applicableRuleIds: [...(routeResult.applicableRuleIds || [])].sort(),
    excludedRuleIds: [...(routeResult.excludedRuleIds || [])].sort(),
    excludedRules: [...(routeResult.excludedRules || [])],
    conflictRecords: [...(routeResult.conflictRecords || [])],
    requiredReviews: [...(routeResult.requiredReviews || [])].sort(),
    blockingCodes: [...(routeResult.blockingCodes || [])].sort(),
    transactionAuthorized: Boolean(routeResult.transactionAuthorized),
  });
}

function buildReplaySemanticPayload({
  packageId,
  caseId,
  engagementId,
  assignmentScopeVersion,
  standardsSnapshot,
  standards,
  rules,
  context,
  conflicts,
  routeResult,
  codeArtifactRef,
}) {
  return canonicalize({
    schemaVersion: 1,
    packageId,
    caseId,
    engagementId,
    assignmentScopeVersion,
    standardsSnapshot,
    standards,
    rules,
    context,
    conflicts,
    routeResult: normalizeRouteResultForReplay(routeResult),
    codeArtifactRef,
  });
}

function createStandardsReplayPackage({
  packageId,
  caseId,
  engagementId,
  assignmentScopeVersion,
  standardsSnapshot,
  standards = [],
  rules = [],
  context,
  conflicts = [],
  codeArtifactRef,
  createdAt,
  createdBy,
  hashFn,
} = {}) {
  for (const [value, field] of [
    [packageId, 'packageId'],
    [caseId, 'caseId'],
    [engagementId, 'engagementId'],
    [assignmentScopeVersion, 'assignmentScopeVersion'],
    [codeArtifactRef, 'codeArtifactRef'],
    [createdBy, 'createdBy'],
  ]) assertNonEmptyString(value, field);
  if (!standardsSnapshot || typeof standardsSnapshot !== 'object') throw new TypeError('standardsSnapshot is required');
  if (!Array.isArray(standards) || !Array.isArray(rules) || !Array.isArray(conflicts)) {
    throw new TypeError('standards, rules and conflicts must be arrays');
  }
  if (!context || typeof context !== 'object' || Array.isArray(context)) throw new TypeError('context is required');

  const snapshotVerification = verifyStandardsSnapshot(standardsSnapshot, hashFn);
  if (!snapshotVerification.valid) {
    const error = new Error('STANDARDS_SNAPSHOT_INTEGRITY_FAILURE');
    error.code = 'STANDARDS_SNAPSHOT_INTEGRITY_FAILURE';
    throw error;
  }

  const normalizedStandards = standards.map(normalizeStandardRecord);
  const normalizedRules = rules.map(normalizeStandardRule);
  const routed = routeStandards({
    context,
    standards: normalizedStandards,
    rules: normalizedRules,
    conflicts,
    routerInputHash: standardsSnapshot.routerInputHash ?? null,
  });

  if (routed.routerVersion !== standardsSnapshot.routerVersion) {
    const error = new Error('STANDARDS_SNAPSHOT_ROUTER_VERSION_MISMATCH');
    error.code = 'STANDARDS_SNAPSHOT_ROUTER_VERSION_MISMATCH';
    throw error;
  }

  const semanticPayload = buildReplaySemanticPayload({
    packageId,
    caseId,
    engagementId,
    assignmentScopeVersion,
    standardsSnapshot,
    standards: normalizedStandards,
    rules: normalizedRules,
    context,
    conflicts,
    routeResult: routed,
    codeArtifactRef,
  });
  const packageHash = hashCanonical(semanticPayload, hashFn, 'packageHash');

  return deepFreeze({
    ...semanticPayload,
    packageHash,
    createdAt: normalizeTimestamp(createdAt, 'createdAt'),
    createdBy,
    replayPolicy: 'STORED_FACTS_RULES_CONTEXT_ONLY_NO_CURRENT_REGISTRY_FALLBACK',
    exactRuntimeReconstructionRequiresCodeArtifact: true,
    productionIntegration: 'NON_ENFORCING_HISTORY_LIBRARY_ONLY',
    professionalAuthorizationEstablished: false,
    legalApprovalEstablished: false,
    transactionAuthorized: false,
  });
}

function verifyStandardsReplayPackage(replayPackage, hashFn) {
  if (!replayPackage || typeof replayPackage !== 'object') throw new TypeError('replayPackage is required');
  assertSha256Hex(replayPackage.packageHash, 'replayPackage.packageHash');

  const snapshotVerification = verifyStandardsSnapshot(replayPackage.standardsSnapshot, hashFn);
  const semanticPayload = buildReplaySemanticPayload(replayPackage);
  const computedPackageHash = hashCanonical(semanticPayload, hashFn, 'computedPackageHash');

  return deepFreeze({
    valid: snapshotVerification.valid && computedPackageHash === replayPackage.packageHash.toLowerCase(),
    snapshotValid: snapshotVerification.valid,
    packageHashValid: computedPackageHash === replayPackage.packageHash.toLowerCase(),
    expectedPackageHash: replayPackage.packageHash.toLowerCase(),
    computedPackageHash,
    transactionAuthorized: false,
  });
}

function replayHistoricalStandardsPackage(replayPackage, { hashFn, routeFn = routeStandards } = {}) {
  if (typeof routeFn !== 'function') throw new TypeError('routeFn must be a function');
  const integrity = verifyStandardsReplayPackage(replayPackage, hashFn);
  if (!integrity.valid) {
    return deepFreeze({
      status: REPLAY_STATUS.HOLD_INTEGRITY_FAILURE,
      integrity,
      routeMatchesStoredResult: false,
      currentRegistryConsulted: false,
      transactionAuthorized: false,
    });
  }

  const replayedRoute = routeFn({
    context: replayPackage.context,
    standards: replayPackage.standards,
    rules: replayPackage.rules,
    conflicts: replayPackage.conflicts,
    routerInputHash: replayPackage.standardsSnapshot.routerInputHash ?? null,
  });
  const stored = normalizeRouteResultForReplay(replayPackage.routeResult);
  const replayed = normalizeRouteResultForReplay(replayedRoute);
  const routeMatchesStoredResult = canonicalStringify(stored) === canonicalStringify(replayed);

  return deepFreeze({
    status: routeMatchesStoredResult ? REPLAY_STATUS.REPRODUCIBLE : REPLAY_STATUS.DRIFT_DETECTED,
    integrity,
    routeMatchesStoredResult,
    storedRouteResult: stored,
    replayedRouteResult: replayed,
    codeArtifactRef: replayPackage.codeArtifactRef,
    exactRuntimeReconstructionRequiresCodeArtifact: true,
    currentRegistryConsulted: false,
    transactionAuthorized: false,
  });
}

function createHistoricalStandardsLedger({ ledgerId, caseId, createdAt, createdBy } = {}) {
  assertNonEmptyString(ledgerId, 'ledgerId');
  assertNonEmptyString(caseId, 'caseId');
  assertNonEmptyString(createdBy, 'createdBy');
  return deepFreeze({
    schemaVersion: 1,
    ledgerId,
    caseId,
    createdAt: normalizeTimestamp(createdAt, 'createdAt'),
    createdBy,
    entries: [],
    headHash: null,
    appendOnly: true,
    transactionAuthorized: false,
  });
}

function buildLedgerEntryPayload({ ledgerId, caseId, sequence, replayPackage, previousEntryHash, persistedAt, persistedBy }) {
  return canonicalize({
    schemaVersion: 1,
    ledgerId,
    caseId,
    sequence,
    packageId: replayPackage.packageId,
    packageHash: replayPackage.packageHash,
    standardsSnapshotId: replayPackage.standardsSnapshot.standardsSnapshotId,
    standardsSnapshotHash: replayPackage.standardsSnapshot.snapshotHash,
    codeArtifactRef: replayPackage.codeArtifactRef,
    previousEntryHash,
    persistedAt,
    persistedBy,
  });
}

function appendHistoricalStandardsPackage(ledger, replayPackage, { persistedAt, persistedBy, hashFn } = {}) {
  if (!ledger || typeof ledger !== 'object') throw new TypeError('ledger is required');
  assertNonEmptyString(persistedBy, 'persistedBy');
  const integrity = verifyStandardsReplayPackage(replayPackage, hashFn);
  if (!integrity.valid) {
    const error = new Error('STANDARDS_REPLAY_PACKAGE_INTEGRITY_FAILURE');
    error.code = 'STANDARDS_REPLAY_PACKAGE_INTEGRITY_FAILURE';
    throw error;
  }
  if (replayPackage.caseId !== ledger.caseId) {
    const error = new Error('STANDARDS_HISTORY_CASE_ISOLATION_VIOLATION');
    error.code = 'STANDARDS_HISTORY_CASE_ISOLATION_VIOLATION';
    throw error;
  }
  if (ledger.entries.some((entry) => entry.packageId === replayPackage.packageId)) {
    const error = new Error('DUPLICATE_STANDARDS_REPLAY_PACKAGE');
    error.code = 'DUPLICATE_STANDARDS_REPLAY_PACKAGE';
    throw error;
  }

  const timestamp = normalizeTimestamp(persistedAt, 'persistedAt');
  const payload = buildLedgerEntryPayload({
    ledgerId: ledger.ledgerId,
    caseId: ledger.caseId,
    sequence: ledger.entries.length + 1,
    replayPackage,
    previousEntryHash: ledger.headHash,
    persistedAt: timestamp,
    persistedBy,
  });
  const entryHash = hashCanonical(payload, hashFn, 'entryHash');
  const entry = deepFreeze({ ...payload, entryHash, transactionAuthorized: false });

  return deepFreeze({
    ...ledger,
    entries: [...ledger.entries, entry],
    headHash: entryHash,
    transactionAuthorized: false,
  });
}

function verifyHistoricalStandardsLedger(ledger, hashFn) {
  if (!ledger || typeof ledger !== 'object') throw new TypeError('ledger is required');
  let expectedPrevious = null;
  const issues = [];

  for (let index = 0; index < (ledger.entries || []).length; index++) {
    const entry = ledger.entries[index];
    const expectedSequence = index + 1;
    if (entry.sequence !== expectedSequence) issues.push(`SEQUENCE_MISMATCH:${expectedSequence}`);
    if (entry.previousEntryHash !== expectedPrevious) issues.push(`PREVIOUS_HASH_MISMATCH:${expectedSequence}`);
    const payload = canonicalize({
      schemaVersion: entry.schemaVersion,
      ledgerId: entry.ledgerId,
      caseId: entry.caseId,
      sequence: entry.sequence,
      packageId: entry.packageId,
      packageHash: entry.packageHash,
      standardsSnapshotId: entry.standardsSnapshotId,
      standardsSnapshotHash: entry.standardsSnapshotHash,
      codeArtifactRef: entry.codeArtifactRef,
      previousEntryHash: entry.previousEntryHash,
      persistedAt: entry.persistedAt,
      persistedBy: entry.persistedBy,
    });
    const computed = hashCanonical(payload, hashFn, 'computedEntryHash');
    if (computed !== entry.entryHash) issues.push(`ENTRY_HASH_MISMATCH:${expectedSequence}`);
    expectedPrevious = entry.entryHash;
  }

  if ((ledger.headHash || null) !== expectedPrevious) issues.push('LEDGER_HEAD_HASH_MISMATCH');
  return deepFreeze({
    valid: issues.length === 0,
    issues,
    entryCount: (ledger.entries || []).length,
    computedHeadHash: expectedPrevious,
    transactionAuthorized: false,
  });
}

module.exports = {
  REPLAY_STATUS,
  normalizeRouteResultForReplay,
  createStandardsReplayPackage,
  verifyStandardsReplayPackage,
  replayHistoricalStandardsPackage,
  createHistoricalStandardsLedger,
  appendHistoricalStandardsPackage,
  verifyHistoricalStandardsLedger,
};
