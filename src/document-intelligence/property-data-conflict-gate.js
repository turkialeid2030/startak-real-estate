'use strict';

const {
  RECONCILIATION_STATUS,
  MATERIALITY,
  deepFreeze,
} = require('./contracts');
const { reconcileEvidenceFacts, assertCaseIsolation } = require('./reconciliation');
const { EVIDENCE_SOURCE_ROLE,assessProfessionalEvidenceAdmissibility,ADMISSIBILITY_TARGET,ADMISSIBILITY_STATUS } = require('./professional-evidence-chain');

const PROPERTY_DATA_GATE_STATUS = Object.freeze({
  CLEAR: 'CLEAR',
  MATERIAL_PROPERTY_DATA_CONFLICT: 'MATERIAL_PROPERTY_DATA_CONFLICT',
  HOLD_INSUFFICIENT_EVIDENCE: 'HOLD_INSUFFICIENT_EVIDENCE',
});

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function assertEvidenceRecords(records, caseId) {
  if (!Array.isArray(records)||records.length>5000) throw new TypeError('evidenceRecords must be a bounded array');
  const facts = [];
  for (const record of records) {
    if (!record || typeof record !== 'object' || !record.fact) throw new TypeError('each evidence record must contain fact');
    if (!Object.values(EVIDENCE_SOURCE_ROLE).includes(record.sourceRole)) throw new TypeError(`invalid sourceRole: ${record.sourceRole}`);
    if (record.caseId !== caseId || record.fact.caseId !== caseId) {
      throw new TypeError('CASE_ISOLATION_VIOLATION: property evidence record belongs to another case');
    }
    facts.push(record.fact);
  }
  assertCaseIsolation(facts, caseId);
  return facts;
}

function sourceRolesForKey(records, key) {
  return [...new Set(records.filter((record) => record.fact?.key === key).map((record) => record.sourceRole))];
}

function evaluateMaterialPropertyDataConflicts({
  caseId,
  evidenceRecords,
  materialKeys,
  numericToleranceByKey = {},
  minimumIndependentSourceRoles = 1,
} = {}) {
  if (!nonEmpty(caseId)) throw new TypeError('caseId is required');
  if (!Array.isArray(materialKeys) || materialKeys.length === 0 || materialKeys.some((key) => !nonEmpty(key))) {
    throw new TypeError('materialKeys must be a non-empty array of semantic property-data keys');
  }
  if (!Number.isInteger(minimumIndependentSourceRoles) || minimumIndependentSourceRoles < 1) {
    throw new TypeError('minimumIndependentSourceRoles must be a positive integer');
  }

  const facts = assertEvidenceRecords(evidenceRecords, caseId);
  const uniqueMaterialKeys = [...new Set(materialKeys.map((key) => key.trim()))];
  const reconciliations = reconcileEvidenceFacts(facts, {
    caseId,
    keys: uniqueMaterialKeys,
    numericToleranceByKey,
  });

  const conflicts = [];
  const missingEvidence = [];
  const checks = reconciliations.map((result) => {
    const relevant=evidenceRecords.filter(record=>record.fact.key===result.key);
    const admitted=relevant.filter(record=>assessProfessionalEvidenceAdmissibility({record,target:ADMISSIBILITY_TARGET.ENGINE_INPUT}).status===ADMISSIBILITY_STATUS.READY);
    const roles = sourceRolesForKey(admitted, result.key);
    const independentContentCount=new Set(admitted.map(r=>r.fact.documentHashSha256.toLowerCase())).size;
    const independentReferenceCount=new Set(admitted.map(r=>r.sourceReference)).size;
    const crossRoleCollision=admitted.some((r,i)=>admitted.slice(i+1).some(s=>r.sourceRole!==s.sourceRole&&
      (r.fact.documentHashSha256.toLowerCase()===s.fact.documentHashSha256.toLowerCase()||r.sourceReference===s.sourceReference)));
    const material = result.materiality === MATERIALITY.MATERIAL || uniqueMaterialKeys.includes(result.key);
    const conflicting = result.status === RECONCILIATION_STATUS.CONFLICT
      || result.status === RECONCILIATION_STATUS.UNIT_MISMATCH;

    if (material && conflicting) {
      conflicts.push({
        key: result.key,
        reconciliationStatus: result.status,
        sourceRoles: roles,
        code: 'MATERIAL_PROPERTY_DATA_CONFLICT',
      });
    }

    const insufficient = result.status === RECONCILIATION_STATUS.MISSING
      || roles.length < minimumIndependentSourceRoles
      || independentContentCount<minimumIndependentSourceRoles||independentReferenceCount<minimumIndependentSourceRoles
      ||crossRoleCollision||admitted.length!==relevant.length;
    if (material && insufficient) {
      missingEvidence.push({
        key: result.key,
        reconciliationStatus: result.status,
        sourceRoles: roles,
        code: 'MATERIAL_PROPERTY_DATA_EVIDENCE_INSUFFICIENT',
      });
    }

    return {
      key: result.key,
      reconciliationStatus: result.status,
      material,
      sourceRoles: roles,
      sourceRoleCount: roles.length,
      independentContentCount,independentReferenceCount,crossRoleCollision,
      unqualifiedRecordCount:relevant.length-admitted.length,
      conflict: material && conflicting,
      evidenceInsufficient: material && insufficient,
    };
  });

  let status = PROPERTY_DATA_GATE_STATUS.CLEAR;
  if (conflicts.length) status = PROPERTY_DATA_GATE_STATUS.MATERIAL_PROPERTY_DATA_CONFLICT;
  else if (missingEvidence.length) status = PROPERTY_DATA_GATE_STATUS.HOLD_INSUFFICIENT_EVIDENCE;

  return deepFreeze({
    schemaVersion: 1,
    caseId,
    status,
    checks,
    conflicts,
    missingEvidence,
    reconciliations,
    professionalValuationProgressionAllowed: status === PROPERTY_DATA_GATE_STATUS.CLEAR,
    readyForProfessionalReport: status === PROPERTY_DATA_GATE_STATUS.CLEAR,
    financialEngineAdoptionAllowed: status === PROPERTY_DATA_GATE_STATUS.CLEAR,
    transactionAuthorized: false,
    certifiedValuationEstablished: false,
    independentlyAuthenticatedSources:false,
    semantics: status === PROPERTY_DATA_GATE_STATUS.MATERIAL_PROPERTY_DATA_CONFLICT
      ? 'Material property data conflicts across submitted evidence remain unresolved. No source winner is selected automatically; professional valuation progression and engine adoption are blocked until accountable human reconciliation resolves the conflict.'
      : 'This gate evaluates caller-declared material property data across evidence source roles. CLEAR is an evidence-consistency state only and does not establish title validity, legal opinion, licensed valuation status, or transaction authority.',
  });
}

module.exports = {
  PROPERTY_DATA_GATE_STATUS,
  evaluateMaterialPropertyDataConflicts,
};
