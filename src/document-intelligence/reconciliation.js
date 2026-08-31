'use strict';

const {
  RECONCILIATION_STATUS,
  MATERIALITY,
  deepFreeze,
} = require('./contracts');

function normalizedUnit(unit) {
  if (unit === null || unit === undefined || String(unit).trim() === '') return null;
  return String(unit).trim().toLocaleLowerCase('en');
}

function numberEqual(a, b, tolerance = {}) {
  if (typeof a !== 'number' || typeof b !== 'number' || !Number.isFinite(a) || !Number.isFinite(b)) return false;
  const absolute = Number.isFinite(tolerance.absolute) ? Math.max(0, tolerance.absolute) : 0;
  const relative = Number.isFinite(tolerance.relative) ? Math.max(0, tolerance.relative) : 0;
  const delta = Math.abs(a - b);
  if (delta <= absolute) return true;
  const scale = Math.max(Math.abs(a), Math.abs(b), 1);
  return delta <= scale * relative;
}

function valuesEqual(a, b, valueType, tolerance) {
  if (valueType === 'NUMBER') return numberEqual(a, b, tolerance);
  return Object.is(a, b);
}

function assertCaseIsolation(facts, expectedCaseId = null) {
  if (!Array.isArray(facts)) throw new TypeError('facts must be an array');
  const caseIds = new Set();
  for (const fact of facts) {
    if (!fact) continue;
    if (typeof fact.caseId !== 'string' || fact.caseId.trim() === '') {
      throw new TypeError('CASE_ISOLATION_VIOLATION: every evidence fact must carry a caseId');
    }
    caseIds.add(fact.caseId);
  }
  if (caseIds.size > 1) {
    throw new TypeError(`CASE_ISOLATION_VIOLATION: mixed evidence cases are not reconcilable (${[...caseIds].join(', ')})`);
  }
  const discoveredCaseId = caseIds.size === 1 ? [...caseIds][0] : null;
  if (expectedCaseId && discoveredCaseId && discoveredCaseId !== expectedCaseId) {
    throw new TypeError(`CASE_ISOLATION_VIOLATION: expected ${expectedCaseId}, received ${discoveredCaseId}`);
  }
  return expectedCaseId || discoveredCaseId;
}

function evidenceProjection(fact) {
  return {
    caseId: fact.caseId,
    factId: fact.factId,
    documentId: fact.documentId,
    documentHashSha256: fact.documentHashSha256,
    documentType: fact.documentType,
    authorityClass: fact.authorityClass,
    truthStatus: fact.truthStatus,
    verificationStatus: fact.verification && fact.verification.status,
    rawValue: fact.rawValue,
    normalizedValue: fact.normalizedValue,
    valueType: fact.valueType,
    unit: fact.unit,
    sourceLocator: fact.sourceLocator,
    extractionConfidence: fact.extraction && fact.extraction.confidence,
    materiality: fact.materiality,
  };
}

function reconcileKey(key, facts, { numericTolerance = {}, caseId = null } = {}) {
  const isolatedCaseId = assertCaseIsolation(facts, caseId);
  const candidates = facts.filter((fact) => fact && fact.key === key);
  if (candidates.length === 0) {
    return deepFreeze({
      caseId: isolatedCaseId,
      key,
      status: RECONCILIATION_STATUS.MISSING,
      factCount: 0,
      independentSourceCount: 0,
      materiality: MATERIALITY.SUPPORTING,
      consensusValue: null,
      consensusUnit: null,
      evidence: [],
      note: 'No evidence fact exists for this key.',
    });
  }

  const evidence = candidates.map(evidenceProjection);
  const independentSourceCount = new Set(candidates.map((fact) => fact.documentHashSha256)).size;
  const materiality = candidates.some((fact) => fact.materiality === MATERIALITY.MATERIAL)
    ? MATERIALITY.MATERIAL
    : MATERIALITY.SUPPORTING;

  const units = [...new Set(candidates.map((fact) => normalizedUnit(fact.unit)))];
  if (units.length > 1) {
    return deepFreeze({
      caseId: isolatedCaseId,
      key,
      status: RECONCILIATION_STATUS.UNIT_MISMATCH,
      factCount: candidates.length,
      independentSourceCount,
      materiality,
      consensusValue: null,
      consensusUnit: null,
      evidence,
      note: 'Evidence uses different units. No silent unit conversion or winner selection was performed.',
    });
  }

  const valueTypes = [...new Set(candidates.map((fact) => fact.valueType))];
  if (valueTypes.length > 1) {
    return deepFreeze({
      caseId: isolatedCaseId,
      key,
      status: RECONCILIATION_STATUS.CONFLICT,
      factCount: candidates.length,
      independentSourceCount,
      materiality,
      consensusValue: null,
      consensusUnit: units[0] || null,
      evidence,
      note: 'Evidence uses incompatible value types. No winner was selected.',
    });
  }

  if (candidates.length === 1) {
    return deepFreeze({
      caseId: isolatedCaseId,
      key,
      status: RECONCILIATION_STATUS.SINGLE_SOURCE_UNCORROBORATED,
      factCount: 1,
      independentSourceCount: 1,
      materiality,
      consensusValue: candidates[0].normalizedValue,
      consensusUnit: units[0] || null,
      evidence,
      note: 'A single evidence source exists; this is not cross-source corroboration.',
    });
  }

  const reference = candidates[0];
  const allAgree = candidates.slice(1).every((fact) =>
    valuesEqual(reference.normalizedValue, fact.normalizedValue, reference.valueType, numericTolerance)
  );

  if (allAgree) {
    return deepFreeze({
      caseId: isolatedCaseId,
      key,
      status: RECONCILIATION_STATUS.AGREEMENT,
      factCount: candidates.length,
      independentSourceCount,
      materiality,
      consensusValue: reference.normalizedValue,
      consensusUnit: units[0] || null,
      evidence,
      note: independentSourceCount > 1
        ? 'Independent document content agrees within the configured comparison tolerance.'
        : 'Values agree, but the records share identical document content and are not independent corroboration.',
    });
  }

  return deepFreeze({
    caseId: isolatedCaseId,
    key,
    status: RECONCILIATION_STATUS.CONFLICT,
    factCount: candidates.length,
    independentSourceCount,
    materiality,
    consensusValue: null,
    consensusUnit: units[0] || null,
    evidence,
    note: 'Conflicting evidence remains unresolved. No source was silently preferred.',
  });
}

function reconcileEvidenceFacts(facts, { caseId = null, keys, numericToleranceByKey = {} } = {}) {
  const isolatedCaseId = assertCaseIsolation(facts, caseId);
  const targetKeys = Array.isArray(keys) && keys.length
    ? [...new Set(keys)]
    : [...new Set(facts.map((fact) => fact && fact.key).filter(Boolean))];

  return deepFreeze(targetKeys.map((key) => reconcileKey(key, facts, {
    caseId: isolatedCaseId,
    numericTolerance: numericToleranceByKey[key] || {},
  })));
}

module.exports = {
  numberEqual,
  assertCaseIsolation,
  reconcileKey,
  reconcileEvidenceFacts,
};
