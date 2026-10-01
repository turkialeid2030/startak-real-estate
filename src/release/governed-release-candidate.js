'use strict';

const crypto = require('crypto');

const GIT_SHA_RE = /^[a-f0-9]{40}$/;
const SHA256_RE = /^[a-f0-9]{64}$/;

const DECISION = Object.freeze({ GO: 'GO', HOLD: 'HOLD', NO_GO: 'NO_GO' });
const QUALIFICATION_STATUS = Object.freeze({ PASS: 'PASS', FAIL: 'FAIL', NOT_EVALUATED: 'NOT_EVALUATED' });
const EXTERNAL_STATUS = Object.freeze({ SUPPLIED_VERIFIED: 'SUPPLIED_VERIFIED', NOT_SUPPLIED: 'NOT_SUPPLIED', REJECTED: 'REJECTED' });

const REQUIRED_UPSTREAM_STAGES = Object.freeze([
  'C22_GENERATIVE_ORCHESTRATION',
  'C23_AI_PROVIDER_GATEWAY',
  'C24_CASE_ORCHESTRATION',
  'C25_SOURCE_READINESS',
  'C26_OPERATOR_WORKSPACE',
  'C27_OBSERVABILITY',
  'C28_INTEGRATION_QUALIFICATION',
  'C29_SHADOW_SIMULATION',
  'C26_INTEGRATED_REVIEW_UI_CLOSURE',
]);

const REQUIRED_TECHNICAL_GATES = Object.freeze([
  'C29_SHADOW_SIMULATION',
  'C26_INTEGRATED_REVIEW_UI',
  'C28_COMPREHENSIVE_INTEGRATION',
  'C23_AI_PROOF_GROUNDING',
  'PRODUCTION_BUILD',
  'PACKAGE_VERIFICATION',
  'DEPENDENCY_AUDIT',
  'CANONICAL_RELEASE_VERIFY',
  'REPOSITORY_RELEASE_VERIFY',
]);

const REQUIRED_EXTERNAL_EVIDENCE = Object.freeze([
  'SECURITY_REVIEW_AUTHORIZATION',
  'PRIVACY_REVIEW_AUTHORIZATION',
  'AI_PROVIDER_PRODUCTION_AUTHORIZATION',
  'SOURCE_RIGHTS_AUTHORIZATION',
  'UAT_HUMAN_APPROVAL',
  'HISTORICAL_REPLAY_EVIDENCE',
  'ROLLBACK_OPERATIONAL_VERIFICATION',
  'LEGAL_REGULATORY_APPROVAL',
]);

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') return Object.keys(value).sort().reduce((out, key) => { out[key] = canonicalize(value[key]); return out; }, {});
  return value;
}
function stableJson(value) { return JSON.stringify(canonicalize(value)); }
function sha256(value) { return crypto.createHash('sha256').update(typeof value === 'string' ? value : stableJson(value)).digest('hex'); }
function requireText(value, code) { if (typeof value !== 'string' || value.trim() === '') throw new Error(code); return value.trim(); }
function requireGitSha(value, code) { if (typeof value !== 'string' || !GIT_SHA_RE.test(value)) throw new Error(code); return value; }
function requireSha256(value, code) { if (typeof value !== 'string' || !SHA256_RE.test(value)) throw new Error(code); return value; }
function requireIso(value, code) { const v = requireText(value, code); if (Number.isNaN(Date.parse(v))) throw new Error(code); return new Date(v).toISOString(); }
function unique(values) { return new Set(values).size === values.length; }
function hashRecord(record, field) { const copy = { ...record }; delete copy[field]; return sha256(copy); }

function upstreamMaterial(input) {
  return {
    stageId: input.stageId,
    gitSha: input.gitSha,
    status: input.status,
    verificationRef: input.verificationRef || null,
    verificationEvidenceHashSha256: input.verificationEvidenceHashSha256 || null,
    reasonCode: input.reasonCode || null,
  };
}
function createUpstreamQualification(input) {
  if (!input || typeof input !== 'object') throw new Error('C30_UPSTREAM_REQUIRED');
  if (!REQUIRED_UPSTREAM_STAGES.includes(input.stageId)) throw new Error('C30_UPSTREAM_STAGE_UNKNOWN');
  if (!Object.values(QUALIFICATION_STATUS).includes(input.status)) throw new Error('C30_UPSTREAM_STATUS_UNKNOWN');
  const material = upstreamMaterial({
    stageId: input.stageId,
    gitSha: requireGitSha(input.gitSha, 'C30_UPSTREAM_GIT_SHA_INVALID'),
    status: input.status,
    verificationRef: input.status === QUALIFICATION_STATUS.NOT_EVALUATED ? null : requireText(input.verificationRef, 'C30_UPSTREAM_VERIFICATION_REF_REQUIRED'),
    verificationEvidenceHashSha256: input.status === QUALIFICATION_STATUS.NOT_EVALUATED ? null : requireSha256(input.verificationEvidenceHashSha256, 'C30_UPSTREAM_EVIDENCE_HASH_INVALID'),
    reasonCode: input.status === QUALIFICATION_STATUS.PASS ? null : requireText(input.reasonCode, 'C30_UPSTREAM_REASON_REQUIRED'),
  });
  if (input.status === QUALIFICATION_STATUS.NOT_EVALUATED && (input.verificationRef || input.verificationEvidenceHashSha256)) throw new Error('C30_NOT_EVALUATED_MUST_NOT_FABRICATE_EVIDENCE');
  return Object.freeze({ ...material, qualificationHashSha256: sha256(material) });
}
function verifyUpstreamQualification(record) {
  return !!record && SHA256_RE.test(record.qualificationHashSha256 || '') && hashRecord(record, 'qualificationHashSha256') === record.qualificationHashSha256;
}

function technicalMaterial(input) {
  return {
    gateId: input.gateId,
    candidateHeadSha: input.candidateHeadSha,
    status: input.status,
    evidenceRef: input.evidenceRef || null,
    evidenceHashSha256: input.evidenceHashSha256 || null,
    verifiedAt: input.verifiedAt || null,
    reasonCode: input.reasonCode || null,
  };
}
function createTechnicalGateEvidence(input) {
  if (!input || typeof input !== 'object') throw new Error('C30_TECHNICAL_GATE_REQUIRED');
  if (!REQUIRED_TECHNICAL_GATES.includes(input.gateId)) throw new Error('C30_TECHNICAL_GATE_UNKNOWN');
  if (!Object.values(QUALIFICATION_STATUS).includes(input.status)) throw new Error('C30_TECHNICAL_STATUS_UNKNOWN');
  const hasEvidence = input.status !== QUALIFICATION_STATUS.NOT_EVALUATED;
  const material = technicalMaterial({
    gateId: input.gateId,
    candidateHeadSha: requireGitSha(input.candidateHeadSha, 'C30_CANDIDATE_HEAD_INVALID'),
    status: input.status,
    evidenceRef: hasEvidence ? requireText(input.evidenceRef, 'C30_TECHNICAL_EVIDENCE_REF_REQUIRED') : null,
    evidenceHashSha256: hasEvidence ? requireSha256(input.evidenceHashSha256, 'C30_TECHNICAL_EVIDENCE_HASH_INVALID') : null,
    verifiedAt: hasEvidence ? requireIso(input.verifiedAt, 'C30_TECHNICAL_VERIFIED_AT_INVALID') : null,
    reasonCode: input.status === QUALIFICATION_STATUS.PASS ? null : requireText(input.reasonCode, 'C30_TECHNICAL_REASON_REQUIRED'),
  });
  if (!hasEvidence && (input.evidenceRef || input.evidenceHashSha256 || input.verifiedAt)) throw new Error('C30_NOT_EVALUATED_MUST_NOT_FABRICATE_EVIDENCE');
  return Object.freeze({ ...material, technicalGateHashSha256: sha256(material) });
}
function verifyTechnicalGateEvidence(record) {
  return !!record && SHA256_RE.test(record.technicalGateHashSha256 || '') && hashRecord(record, 'technicalGateHashSha256') === record.technicalGateHashSha256;
}

function externalMaterial(input) {
  return {
    evidenceId: input.evidenceId,
    candidateHeadSha: input.candidateHeadSha,
    status: input.status,
    evidenceRef: input.evidenceRef || null,
    evidenceHashSha256: input.evidenceHashSha256 || null,
    verifiedByRef: input.verifiedByRef || null,
    verifiedAt: input.verifiedAt || null,
    validUntil: input.validUntil || null,
    reasonCode: input.reasonCode || null,
  };
}
function createExternalEvidenceItem(input) {
  if (!input || typeof input !== 'object') throw new Error('C30_EXTERNAL_EVIDENCE_REQUIRED');
  if (!REQUIRED_EXTERNAL_EVIDENCE.includes(input.evidenceId)) throw new Error('C30_EXTERNAL_EVIDENCE_ID_UNKNOWN');
  if (!Object.values(EXTERNAL_STATUS).includes(input.status)) throw new Error('C30_EXTERNAL_STATUS_UNKNOWN');
  const supplied = input.status !== EXTERNAL_STATUS.NOT_SUPPLIED;
  const material = externalMaterial({
    evidenceId: input.evidenceId,
    candidateHeadSha: requireGitSha(input.candidateHeadSha, 'C30_CANDIDATE_HEAD_INVALID'),
    status: input.status,
    evidenceRef: supplied ? requireText(input.evidenceRef, 'C30_EXTERNAL_EVIDENCE_REF_REQUIRED') : null,
    evidenceHashSha256: supplied ? requireSha256(input.evidenceHashSha256, 'C30_EXTERNAL_EVIDENCE_HASH_INVALID') : null,
    verifiedByRef: supplied ? requireText(input.verifiedByRef, 'C30_EXTERNAL_VERIFIER_REQUIRED') : null,
    verifiedAt: supplied ? requireIso(input.verifiedAt, 'C30_EXTERNAL_VERIFIED_AT_INVALID') : null,
    validUntil: supplied && input.validUntil ? requireIso(input.validUntil, 'C30_EXTERNAL_VALID_UNTIL_INVALID') : null,
    reasonCode: input.status === EXTERNAL_STATUS.SUPPLIED_VERIFIED ? null : requireText(input.reasonCode, 'C30_EXTERNAL_REASON_REQUIRED'),
  });
  if (!supplied && (input.evidenceRef || input.evidenceHashSha256 || input.verifiedByRef || input.verifiedAt || input.validUntil)) throw new Error('C30_NOT_SUPPLIED_MUST_NOT_FABRICATE_EVIDENCE');
  if (material.validUntil && Date.parse(material.validUntil) <= Date.parse(material.verifiedAt)) throw new Error('C30_EXTERNAL_VALIDITY_WINDOW_INVALID');
  return Object.freeze({ ...material, externalEvidenceHashSha256: sha256(material) });
}
function verifyExternalEvidenceItem(record) {
  return !!record && SHA256_RE.test(record.externalEvidenceHashSha256 || '') && hashRecord(record, 'externalEvidenceHashSha256') === record.externalEvidenceHashSha256;
}

function addBlocker(blockers, source, id, state, decisionEffect, reasonCode) {
  blockers.push({ source, id, state, decisionEffect, reasonCode });
}
function evaluateCollectionIntegrity(records, idField, requiredIds, verifyFn, label, candidateHeadSha, frozenAt, blockers, notEvaluated) {
  if (!Array.isArray(records)) records = [];
  const ids = records.map((r) => r?.[idField]).filter(Boolean);
  if (!unique(ids)) addBlocker(blockers, label, 'DUPLICATE_RECORD', 'INTEGRITY_FAILURE', DECISION.NO_GO, `C30_${label}_DUPLICATE`);
  for (const required of requiredIds) {
    const matches = records.filter((r) => r?.[idField] === required);
    if (matches.length === 0) {
      addBlocker(blockers, label, required, 'MISSING', DECISION.HOLD, `C30_${label}_REQUIRED_MISSING`);
      notEvaluated.push({ source: label, id: required, state: 'MISSING', reasonCode: `C30_${label}_REQUIRED_MISSING` });
    }
  }
  for (const record of records) {
    const id = record?.[idField] || 'UNKNOWN';
    if (!verifyFn(record)) {
      addBlocker(blockers, label, id, 'INTEGRITY_FAILURE', DECISION.NO_GO, `C30_${label}_INTEGRITY_FAILED`);
      continue;
    }
    if (record.candidateHeadSha && record.candidateHeadSha !== candidateHeadSha) addBlocker(blockers, label, id, 'HEAD_MISMATCH', DECISION.NO_GO, `C30_${label}_HEAD_MISMATCH`);
    if (record.verifiedAt && Date.parse(record.verifiedAt) > Date.parse(frozenAt)) addBlocker(blockers, label, id, 'FUTURE_EVIDENCE', DECISION.NO_GO, `C30_${label}_FUTURE_EVIDENCE`);
    if (record.validUntil && Date.parse(record.validUntil) < Date.parse(frozenAt)) addBlocker(blockers, label, id, 'EXPIRED', DECISION.HOLD, `C30_${label}_EXPIRED`);
  }
}

function buildReleaseCandidatePack(input) {
  if (!input || typeof input !== 'object') throw new Error('C30_RELEASE_CANDIDATE_INPUT_REQUIRED');
  const releaseCandidateId = requireText(input.releaseCandidateId, 'C30_RELEASE_CANDIDATE_ID_REQUIRED');
  const candidateHeadSha = requireGitSha(input.candidateHeadSha, 'C30_CANDIDATE_HEAD_INVALID');
  const frozenAt = requireIso(input.frozenAt, 'C30_FROZEN_AT_INVALID');
  const upstreamQualifications = Array.isArray(input.upstreamQualifications) ? input.upstreamQualifications : [];
  const technicalGates = Array.isArray(input.technicalGates) ? input.technicalGates : [];
  const externalEvidence = Array.isArray(input.externalEvidence) ? input.externalEvidence : [];
  const blockers = [];
  const notEvaluatedRegister = [];

  evaluateCollectionIntegrity(upstreamQualifications, 'stageId', REQUIRED_UPSTREAM_STAGES, verifyUpstreamQualification, 'UPSTREAM', candidateHeadSha, frozenAt, blockers, notEvaluatedRegister);
  evaluateCollectionIntegrity(technicalGates, 'gateId', REQUIRED_TECHNICAL_GATES, verifyTechnicalGateEvidence, 'TECHNICAL', candidateHeadSha, frozenAt, blockers, notEvaluatedRegister);
  evaluateCollectionIntegrity(externalEvidence, 'evidenceId', REQUIRED_EXTERNAL_EVIDENCE, verifyExternalEvidenceItem, 'EXTERNAL', candidateHeadSha, frozenAt, blockers, notEvaluatedRegister);

  for (const record of upstreamQualifications) {
    if (!verifyUpstreamQualification(record)) continue;
    if (record.status === QUALIFICATION_STATUS.FAIL) addBlocker(blockers, 'UPSTREAM', record.stageId, 'FAIL', DECISION.NO_GO, record.reasonCode || 'C30_UPSTREAM_FAILED');
    if (record.status === QUALIFICATION_STATUS.NOT_EVALUATED) {
      addBlocker(blockers, 'UPSTREAM', record.stageId, 'NOT_EVALUATED', DECISION.HOLD, record.reasonCode || 'C30_UPSTREAM_NOT_EVALUATED');
      notEvaluatedRegister.push({ source: 'UPSTREAM', id: record.stageId, state: 'NOT_EVALUATED', reasonCode: record.reasonCode });
    }
  }
  for (const record of technicalGates) {
    if (!verifyTechnicalGateEvidence(record)) continue;
    if (record.status === QUALIFICATION_STATUS.FAIL) addBlocker(blockers, 'TECHNICAL', record.gateId, 'FAIL', DECISION.NO_GO, record.reasonCode || 'C30_TECHNICAL_FAILED');
    if (record.status === QUALIFICATION_STATUS.NOT_EVALUATED) {
      addBlocker(blockers, 'TECHNICAL', record.gateId, 'NOT_EVALUATED', DECISION.HOLD, record.reasonCode || 'C30_TECHNICAL_NOT_EVALUATED');
      notEvaluatedRegister.push({ source: 'TECHNICAL', id: record.gateId, state: 'NOT_EVALUATED', reasonCode: record.reasonCode });
    }
  }
  for (const record of externalEvidence) {
    if (!verifyExternalEvidenceItem(record)) continue;
    if (record.status === EXTERNAL_STATUS.REJECTED) addBlocker(blockers, 'EXTERNAL', record.evidenceId, 'REJECTED', DECISION.NO_GO, record.reasonCode || 'C30_EXTERNAL_REJECTED');
    if (record.status === EXTERNAL_STATUS.NOT_SUPPLIED) {
      addBlocker(blockers, 'EXTERNAL', record.evidenceId, 'NOT_SUPPLIED', DECISION.HOLD, record.reasonCode || 'C30_EXTERNAL_NOT_SUPPLIED');
      notEvaluatedRegister.push({ source: 'EXTERNAL', id: record.evidenceId, state: 'NOT_SUPPLIED', reasonCode: record.reasonCode });
    }
  }

  for (const item of input.declaredBlockers || []) {
    if (!item || typeof item !== 'object') throw new Error('C30_DECLARED_BLOCKER_INVALID');
    const decisionEffect = item.decisionEffect === DECISION.NO_GO ? DECISION.NO_GO : DECISION.HOLD;
    addBlocker(blockers, 'DECLARED', requireText(item.blockerId, 'C30_BLOCKER_ID_REQUIRED'), 'OPEN', decisionEffect, requireText(item.reasonCode, 'C30_BLOCKER_REASON_REQUIRED'));
  }

  const uniqueBlockers = [];
  const blockerSeen = new Set();
  for (const blocker of blockers) {
    const key = stableJson(blocker);
    if (!blockerSeen.has(key)) { blockerSeen.add(key); uniqueBlockers.push(blocker); }
  }
  uniqueBlockers.sort((a, b) => `${a.source}:${a.id}:${a.reasonCode}`.localeCompare(`${b.source}:${b.id}:${b.reasonCode}`));

  const uniqueNotEvaluated = [];
  const neSeen = new Set();
  for (const item of notEvaluatedRegister) {
    const key = stableJson(item);
    if (!neSeen.has(key)) { neSeen.add(key); uniqueNotEvaluated.push(item); }
  }
  uniqueNotEvaluated.sort((a, b) => `${a.source}:${a.id}`.localeCompare(`${b.source}:${b.id}`));

  let decision = DECISION.GO;
  if (uniqueBlockers.some((b) => b.decisionEffect === DECISION.NO_GO)) decision = DECISION.NO_GO;
  else if (uniqueBlockers.length > 0) decision = DECISION.HOLD;

  const dependencyChainManifest = upstreamQualifications.map((r) => ({ stageId: r.stageId, gitSha: r.gitSha, status: r.status, qualificationHashSha256: r.qualificationHashSha256 || null }));
  const dependencyChainManifestHashSha256 = sha256(dependencyChainManifest);
  const material = {
    schemaVersion: 1,
    releaseCandidateId,
    candidateHeadSha,
    frozenAt,
    decision,
    dependencyChainManifest,
    dependencyChainManifestHashSha256,
    technicalGateHashesSha256: technicalGates.map((r) => r.technicalGateHashSha256 || null),
    externalEvidenceHashesSha256: externalEvidence.map((r) => r.externalEvidenceHashSha256 || null),
    blockerRegister: uniqueBlockers,
    notEvaluatedRegister: uniqueNotEvaluated,
    releaseCandidateFrozen: true,
    mergeHold: true,
    deploy: 'NO',
    commercialGoLive: 'HOLD',
    transactionAuthorized: false,
    approvalAuthorized: false,
    publicAiAuthorized: false,
    productionDeploymentAuthorized: false,
    canonicalBaselineActivationAuthorized: false,
    activationAuthorized: false,
  };
  return Object.freeze({ ...material, releaseCandidatePackHashSha256: sha256(material) });
}

module.exports = Object.freeze({
  DECISION,
  QUALIFICATION_STATUS,
  EXTERNAL_STATUS,
  REQUIRED_UPSTREAM_STAGES,
  REQUIRED_TECHNICAL_GATES,
  REQUIRED_EXTERNAL_EVIDENCE,
  createUpstreamQualification,
  createTechnicalGateEvidence,
  createExternalEvidenceItem,
  buildReleaseCandidatePack,
});
