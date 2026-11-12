'use strict';

const crypto = require('crypto');

const CAPABILITY = 'C24_INTEGRATED_CASE_PROPERTY_ORCHESTRATION_V1';
const POLICY_VERSION = 'C24_CASE_ORCHESTRATION_POLICY_V1';

const STAGE_STATUS = Object.freeze({
  READY: 'READY',
  HOLD: 'HOLD',
  NOT_EVALUATED: 'NOT_EVALUATED',
});

const OVERALL_STATUS = Object.freeze({
  READY_FOR_HUMAN_CASE_REVIEW: 'READY_FOR_HUMAN_CASE_REVIEW',
  HOLD: 'HOLD',
  NOT_EVALUATED: 'NOT_EVALUATED',
});

const STAGE_ID = Object.freeze({
  SOURCE_ACQUISITION_PROVENANCE: 'SOURCE_ACQUISITION_PROVENANCE',
  GEOSPATIAL_EVIDENCE: 'GEOSPATIAL_EVIDENCE',
  MARKET_COMPARABLES: 'MARKET_COMPARABLES',
  VALUATION_RECONCILIATION: 'VALUATION_RECONCILIATION',
  CORRELATED_SCENARIO_RISK: 'CORRELATED_SCENARIO_RISK',
  TITLE_SURVEY_PROPERTY: 'TITLE_SURVEY_PROPERTY',
  URBAN_CODE_PLOT: 'URBAN_CODE_PLOT',
  MARKET_LIQUIDITY: 'MARKET_LIQUIDITY',
  INCOME_ASSET: 'INCOME_ASSET',
  REGULATORY_CARRY_COST: 'REGULATORY_CARRY_COST',
  ENCUMBRANCE_CLOSING: 'ENCUMBRANCE_CLOSING',
  FINANCING: 'FINANCING',
  RENTAL_REGULATION: 'RENTAL_REGULATION',
  AUCTION_ACQUISITION: 'AUCTION_ACQUISITION',
  RAW_LAND_OPTIONALITY: 'RAW_LAND_OPTIONALITY',
  SUBDIVISION_MERGE: 'SUBDIVISION_MERGE',
  POLICY_SHOCK: 'POLICY_SHOCK',
  URBAN_GROWTH_ACCESSIBILITY: 'URBAN_GROWTH_ACCESSIBILITY',
  LISTING_AMENITY: 'LISTING_AMENITY',
  GENERATIVE_INTELLIGENCE: 'GENERATIVE_INTELLIGENCE',
  AI_PROVIDER_GATEWAY: 'AI_PROVIDER_GATEWAY',
});

const AI_STAGE_IDS = Object.freeze([STAGE_ID.GENERATIVE_INTELLIGENCE, STAGE_ID.AI_PROVIDER_GATEWAY]);
const HASH_RE = /^[a-f0-9]{64}$/i;
const nonEmpty = (v) => typeof v === 'string' && v.trim().length > 0;
const clean = (v) => nonEmpty(v) ? v.trim() : '';

function iso(value, field) {
  if (!nonEmpty(value) || !Number.isFinite(Date.parse(value))) throw new TypeError(`${field} must be a valid date/time`);
  return new Date(value).toISOString();
}
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((out, key) => { out[key] = stable(value[key]); return out; }, {});
}
function sha256(value) { return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex'); }
function without(value, fields) { const out = { ...value }; fields.forEach((f) => delete out[f]); return out; }
function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze); return Object.freeze(value);
}
function uniqueStrings(values, field) {
  if (!Array.isArray(values)) throw new TypeError(`${field} must be an array`);
  const out = values.map(clean);
  if (out.some((v) => !v)) throw new TypeError(`${field} contains invalid value`);
  if (new Set(out).size !== out.length) throw new TypeError(`${field} contains duplicate values`);
  return [...out].sort();
}
function hash(value, field) {
  const v = clean(value).toLowerCase();
  if (!HASH_RE.test(v)) throw new TypeError(`${field} must be SHA-256`);
  return v;
}
function integrity(record, hashField) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return false;
  const h = clean(record[hashField]).toLowerCase();
  return HASH_RE.test(h) && sha256(without(record, [hashField])) === h;
}
function scopeRef(value) { return nonEmpty(value) ? value.trim() : null; }

function createStagePacket(x = {}) {
  ['stageId','caseId','propertyRef','capabilityRef'].forEach((f) => { if (!nonEmpty(x[f])) throw new TypeError(`${f} must be a non-empty string`); });
  if (!Object.values(STAGE_ID).includes(x.stageId)) throw new TypeError('C24_STAGE_ID_UNSUPPORTED');
  if (!Object.values(STAGE_STATUS).includes(x.status)) throw new TypeError('C24_STAGE_STATUS_UNSUPPORTED');
  const inputHashSha256 = hash(x.inputHashSha256, 'inputHashSha256');
  const outputHashSha256 = hash(x.outputHashSha256, 'outputHashSha256');
  const lineageHashesSha256 = uniqueStrings(x.lineageHashesSha256 || [], 'lineageHashesSha256');
  if (!lineageHashesSha256.length || lineageHashesSha256.some((h) => !HASH_RE.test(h))) throw new TypeError('C24_LINEAGE_HASHES_REQUIRED');
  const blockers = uniqueStrings(x.blockers || [], 'blockers');
  const riskFlags = uniqueStrings(x.riskFlags || [], 'riskFlags');
  if (x.status === STAGE_STATUS.READY && blockers.length) throw new TypeError('C24_READY_STAGE_CANNOT_HAVE_BLOCKERS');
  if (x.status !== STAGE_STATUS.READY && !blockers.length) throw new TypeError('C24_NON_READY_STAGE_REQUIRES_REASON');
  if (x.transactionAuthorized !== false || x.approvalAuthorized !== false || x.publicAiAuthorized !== false || x.autonomousActionExecuted !== false) throw new TypeError('C24_STAGE_AUTHORITY_MUST_BE_FALSE');
  const evaluatedAt = iso(x.evaluatedAt, 'evaluatedAt');
  const validUntil = iso(x.validUntil, 'validUntil');
  if (Date.parse(validUntil) < Date.parse(evaluatedAt)) throw new TypeError('C24_STAGE_VALIDITY_INVALID');
  const core = {
    schemaVersion: 1,
    stageId: x.stageId,
    caseId: x.caseId.trim(),
    propertyRef: x.propertyRef.trim(),
    marketScopeRef: scopeRef(x.marketScopeRef),
    capabilityRef: x.capabilityRef.trim(),
    status: x.status,
    inputHashSha256,
    outputHashSha256,
    lineageHashesSha256,
    blockers,
    riskFlags,
    evaluatedAt,
    validUntil,
    transactionAuthorized: false,
    approvalAuthorized: false,
    publicAiAuthorized: false,
    autonomousActionExecuted: false,
  };
  return freeze({ ...core, stagePacketHashSha256: sha256(core) });
}
function verifyStagePacket(r) { return integrity(r, 'stagePacketHashSha256'); }

function normalizeCapabilityBindings(requiredStageIds, optionalStageIds, bindings) {
  if (!bindings || typeof bindings !== 'object' || Array.isArray(bindings)) throw new TypeError('C24_CAPABILITY_BINDINGS_REQUIRED');
  const allowed = new Set([...requiredStageIds, ...optionalStageIds]);
  const out = {};
  for (const stageId of allowed) {
    const refs = uniqueStrings(bindings[stageId] || [], `allowedCapabilityRefsByStage.${stageId}`);
    if (!refs.length) throw new TypeError(`C24_CAPABILITY_BINDING_REQUIRED:${stageId}`);
    out[stageId] = refs;
  }
  for (const key of Object.keys(bindings)) if (!allowed.has(key)) throw new TypeError(`C24_CAPABILITY_BINDING_UNKNOWN_STAGE:${key}`);
  return out;
}

function createOrchestrationPolicy(x = {}) {
  ['policyId','reviewedByRef','reviewEvidenceRef'].forEach((f) => { if (!nonEmpty(x[f])) throw new TypeError(`${f} must be a non-empty string`); });
  const requiredStageIds = uniqueStrings(x.requiredStageIds || [], 'requiredStageIds');
  const optionalStageIds = uniqueStrings(x.optionalStageIds || [], 'optionalStageIds');
  if (!requiredStageIds.length) throw new TypeError('C24_REQUIRED_STAGES_REQUIRED');
  const stageValues = new Set(Object.values(STAGE_ID));
  if (requiredStageIds.some((s) => !stageValues.has(s)) || optionalStageIds.some((s) => !stageValues.has(s))) throw new TypeError('C24_POLICY_STAGE_UNSUPPORTED');
  if (requiredStageIds.some((s) => optionalStageIds.includes(s))) throw new TypeError('C24_POLICY_REQUIRED_OPTIONAL_OVERLAP');
  const allowedCapabilityRefsByStage = normalizeCapabilityBindings(requiredStageIds, optionalStageIds, x.allowedCapabilityRefsByStage);
  const reviewedAt = iso(x.reviewedAt, 'reviewedAt');
  const validUntil = iso(x.validUntil, 'validUntil');
  if (Date.parse(validUntil) < Date.parse(reviewedAt)) throw new TypeError('C24_POLICY_VALIDITY_INVALID');
  const core = {
    version: POLICY_VERSION,
    policyId: x.policyId.trim(),
    requiredStageIds,
    optionalStageIds,
    allowedCapabilityRefsByStage,
    reviewedByRef: x.reviewedByRef.trim(),
    reviewEvidenceRef: x.reviewEvidenceRef.trim(),
    reviewedAt,
    validUntil,
    hardGatePrecedence: ['HOLD','NOT_EVALUATED','READY_FOR_HUMAN_CASE_REVIEW'],
    aiMayOverrideDeterministicState: false,
    transactionAuthorized: false,
    approvalAuthorized: false,
    publicAiAuthorized: false,
    productionDeploymentAuthorized: false,
  };
  return freeze({ ...core, policyHashSha256: sha256(core) });
}
function verifyOrchestrationPolicy(r) { return integrity(r, 'policyHashSha256'); }

function evaluateCaseOrchestration(input = {}) {
  ['executionId','caseId','propertyRef'].forEach((f) => { if (!nonEmpty(input[f])) throw new TypeError(`${f} must be a non-empty string`); });
  const asOf = iso(input.asOf, 'asOf');
  const policy = input.policy;
  const packets = Array.isArray(input.stagePackets) ? input.stagePackets : [];
  const blockers = [];
  const riskFlags = [];

  if (!verifyOrchestrationPolicy(policy)) blockers.push('C24_INTEGRITY_POLICY');
  if (!packets.length) blockers.push('C24_EVIDENCE_NO_STAGE_PACKETS');

  const byStage = new Map();
  for (const packet of packets) {
    if (!verifyStagePacket(packet)) { blockers.push('C24_INTEGRITY_STAGE_PACKET'); continue; }
    if (byStage.has(packet.stageId)) { blockers.push(`C24_INTEGRITY_DUPLICATE_STAGE:${packet.stageId}`); continue; }
    byStage.set(packet.stageId, packet);
    if (packet.caseId !== input.caseId.trim() || packet.propertyRef !== input.propertyRef.trim() || packet.marketScopeRef !== scopeRef(input.marketScopeRef)) blockers.push(`C24_CONTEXT_STAGE_MISMATCH:${packet.stageId}`);
    if (Date.parse(packet.evaluatedAt) > Date.parse(asOf)) blockers.push(`C24_WINDOW_STAGE_FUTURE:${packet.stageId}`);
    if (Date.parse(packet.validUntil) < Date.parse(asOf)) blockers.push(`C24_WINDOW_STAGE_STALE:${packet.stageId}`);
    packet.riskFlags.forEach((r) => riskFlags.push(`${packet.stageId}:${r}`));
    if (packet.transactionAuthorized !== false || packet.approvalAuthorized !== false || packet.publicAiAuthorized !== false || packet.autonomousActionExecuted !== false) blockers.push(`C24_AUTHORITY_INJECTION:${packet.stageId}`);
  }

  if (verifyOrchestrationPolicy(policy)) {
    if (Date.parse(policy.reviewedAt) > Date.parse(asOf)) blockers.push('C24_WINDOW_POLICY_FUTURE');
    if (Date.parse(policy.validUntil) < Date.parse(asOf)) blockers.push('C24_WINDOW_POLICY_STALE');
    const allowedStages = new Set([...policy.requiredStageIds, ...policy.optionalStageIds]);
    for (const [stageId, packet] of byStage) {
      if (!allowedStages.has(stageId)) blockers.push(`C24_POLICY_UNDECLARED_STAGE:${stageId}`);
      else if (!policy.allowedCapabilityRefsByStage[stageId].includes(packet.capabilityRef)) blockers.push(`C24_POLICY_CAPABILITY_NOT_ALLOWED:${stageId}:${packet.capabilityRef}`);
    }
    for (const stageId of policy.requiredStageIds) if (!byStage.has(stageId)) blockers.push(`C24_EVIDENCE_REQUIRED_STAGE_MISSING:${stageId}`);
  }

  const structuralBlockers = [...new Set(blockers)].sort();
  let status;
  const requiredPackets = verifyOrchestrationPolicy(policy) ? policy.requiredStageIds.map((id) => byStage.get(id)).filter(Boolean) : [];
  if (structuralBlockers.length || requiredPackets.some((p) => p.status === STAGE_STATUS.HOLD)) status = OVERALL_STATUS.HOLD;
  else if (requiredPackets.some((p) => p.status === STAGE_STATUS.NOT_EVALUATED)) status = OVERALL_STATUS.NOT_EVALUATED;
  else status = OVERALL_STATUS.READY_FOR_HUMAN_CASE_REVIEW;

  const stageSummary = [...byStage.values()].sort((a,b) => a.stageId.localeCompare(b.stageId)).map((p) => ({
    stageId: p.stageId,
    capabilityRef: p.capabilityRef,
    status: p.status,
    blockers: p.blockers,
    stagePacketHashSha256: p.stagePacketHashSha256,
    outputHashSha256: p.outputHashSha256,
  }));
  const stageBlockers = requiredPackets.filter((p) => p.status !== STAGE_STATUS.READY).flatMap((p) => p.blockers.map((b) => `${p.stageId}:${b}`));
  const allBlockers = [...new Set([...structuralBlockers, ...stageBlockers])].sort();
  const inputFingerprintCore = {
    caseId: input.caseId.trim(), propertyRef: input.propertyRef.trim(), marketScopeRef: scopeRef(input.marketScopeRef), asOf,
    policyHashSha256: verifyOrchestrationPolicy(policy) ? policy.policyHashSha256 : null,
    stagePacketHashesSha256: stageSummary.map((s) => s.stagePacketHashSha256),
  };
  const inputFingerprintSha256 = sha256(inputFingerprintCore);
  const auditLineage = [...byStage.values()].sort((a,b) => a.stageId.localeCompare(b.stageId)).map((p) => freeze({
    stageId: p.stageId, capabilityRef: p.capabilityRef, inputHashSha256: p.inputHashSha256, outputHashSha256: p.outputHashSha256,
    lineageHashesSha256: p.lineageHashesSha256, stagePacketHashSha256: p.stagePacketHashSha256,
  }));
  const resultCore = {
    capability: CAPABILITY,
    policyVersion: POLICY_VERSION,
    executionId: input.executionId.trim(),
    caseId: input.caseId.trim(),
    propertyRef: input.propertyRef.trim(),
    marketScopeRef: scopeRef(input.marketScopeRef),
    asOf,
    status,
    blockers: allBlockers,
    riskFlags: [...new Set(riskFlags)].sort(),
    stageSummary,
    inputFingerprintSha256,
    auditLineage,
    humanCaseReviewReady: status === OVERALL_STATUS.READY_FOR_HUMAN_CASE_REVIEW,
    aiOverrideApplied: false,
    transactionAuthorized: false,
    approvalAuthorized: false,
    publicAiAuthorized: false,
    autonomousActionExecuted: false,
    productionDeploymentAuthorized: false,
    commercialGoLive: 'HOLD',
  };
  return freeze({ ...resultCore, resultHashSha256: sha256(resultCore) });
}

function assessReplay(previousResult, nextResult) {
  if (!previousResult || !nextResult || !nonEmpty(previousResult.executionId) || !nonEmpty(nextResult.executionId)) return freeze({ status: 'INVALID', conflict: true, reason: 'C24_REPLAY_RESULT_REQUIRED' });
  if (previousResult.executionId !== nextResult.executionId) return freeze({ status: 'DISTINCT_EXECUTION', conflict: false, reason: null });
  if (previousResult.inputFingerprintSha256 !== nextResult.inputFingerprintSha256) return freeze({ status: 'CONFLICT', conflict: true, reason: 'C24_REPLAY_EXECUTION_ID_INPUT_CONFLICT' });
  if (previousResult.resultHashSha256 !== nextResult.resultHashSha256) return freeze({ status: 'CONFLICT', conflict: true, reason: 'C24_REPLAY_NONDETERMINISTIC_RESULT' });
  return freeze({ status: 'IDEMPOTENT_REPLAY', conflict: false, reason: null });
}

module.exports = Object.freeze({
  CAPABILITY, POLICY_VERSION, STAGE_STATUS, OVERALL_STATUS, STAGE_ID, AI_STAGE_IDS,
  createStagePacket, verifyStagePacket,
  createOrchestrationPolicy, verifyOrchestrationPolicy,
  evaluateCaseOrchestration, assessReplay,
});
