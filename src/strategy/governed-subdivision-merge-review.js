'use strict';

const crypto = require('crypto');

const CAPABILITY = 'C18_GOVERNED_SUBDIVISION_MERGE_REVIEW_INTELLIGENCE_V1';
const POLICY_VERSION = 'C18_SUBDIVISION_MERGE_REVIEW_POLICY_V1';

const REVIEW_STATUS = Object.freeze({
  READY_FOR_PROFESSIONAL_SUBDIVISION_MERGE_REVIEW: 'READY_FOR_PROFESSIONAL_SUBDIVISION_MERGE_REVIEW',
  HOLD_EVIDENCE: 'HOLD_EVIDENCE',
  HOLD_INTEGRITY: 'HOLD_INTEGRITY',
  HOLD_POLICY: 'HOLD_POLICY',
  HOLD_CONTEXT: 'HOLD_CONTEXT',
  HOLD_WINDOW: 'HOLD_WINDOW',
  HOLD_AREA_RECONCILIATION: 'HOLD_AREA_RECONCILIATION',
});

const OPERATION_TYPE = Object.freeze({
  SUBDIVISION_REVIEW: 'SUBDIVISION_REVIEW',
  MERGE_REVIEW: 'MERGE_REVIEW',
  BOUNDARY_ADJUSTMENT_REVIEW: 'BOUNDARY_ADJUSTMENT_REVIEW',
});

const EVIDENCE_CLASS = Object.freeze({
  TITLE_AND_PARCEL_IDENTITY: 'TITLE_AND_PARCEL_IDENTITY',
  SURVEY_AND_AREA: 'SURVEY_AND_AREA',
  URBAN_CODE_AND_PLOT_FEASIBILITY: 'URBAN_CODE_AND_PLOT_FEASIBILITY',
  ACCESS_AND_SERVICES: 'ACCESS_AND_SERVICES',
  MUNICIPAL_OR_CADASTRAL_REQUIREMENTS: 'MUNICIPAL_OR_CADASTRAL_REQUIREMENTS',
  EXTERNAL_PROFESSIONAL_INSTRUCTION: 'EXTERNAL_PROFESSIONAL_INSTRUCTION',
});

const EVIDENCE_STATE = Object.freeze({
  SATISFIED: 'SATISFIED',
  UNRESOLVED: 'UNRESOLVED',
  NOT_REQUIRED: 'NOT_REQUIRED',
});

const HASH_RE = /^[a-f0-9]{64}$/i;
const nonEmpty = (v) => typeof v === 'string' && v.trim().length > 0;
const clean = (v) => nonEmpty(v) ? v.trim() : '';
const finitePositive = (v) => typeof v === 'number' && Number.isFinite(v) && v > 0;
const finiteNN = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const positiveInt = (v) => Number.isInteger(v) && v > 0;

function iso(value, field) {
  if (!nonEmpty(value) || !Number.isFinite(Date.parse(value))) throw new TypeError(`${field} must be a valid date/time`);
  return new Date(value).toISOString();
}
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((out, key) => { out[key] = stable(value[key]); return out; }, {});
}
function sha256(value) {
  try { return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex'); }
  catch (_) { return null; }
}
function without(value, fields) { const out = { ...value }; fields.forEach((f) => delete out[f]); return out; }
function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze); return Object.freeze(value);
}
function uniqueStrings(values, field) {
  if (!Array.isArray(values)) throw new TypeError(`${field} must be an array`);
  const out = values.map(clean);
  if (out.some((v) => !v)) throw new TypeError(`${field} contains an invalid value`);
  if (new Set(out).size !== out.length) throw new TypeError(`${field} contains duplicate values`);
  return [...out].sort();
}
function exactSet(left, right) {
  return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((v, i) => v === right[i]);
}
function statusFor(blockers) {
  if (blockers.some((b) => b.startsWith('C18_INTEGRITY_') || b.startsWith('C18_AUTHORITY_INJECTION'))) return REVIEW_STATUS.HOLD_INTEGRITY;
  if (blockers.some((b) => b.startsWith('C18_POLICY_'))) return REVIEW_STATUS.HOLD_POLICY;
  if (blockers.some((b) => b.startsWith('C18_CONTEXT_'))) return REVIEW_STATUS.HOLD_CONTEXT;
  if (blockers.some((b) => b.startsWith('C18_WINDOW_'))) return REVIEW_STATUS.HOLD_WINDOW;
  if (blockers.some((b) => b.startsWith('C18_AREA_'))) return REVIEW_STATUS.HOLD_AREA_RECONCILIATION;
  return REVIEW_STATUS.HOLD_EVIDENCE;
}

function computeEvidenceHash(r) {
  return r && typeof r === 'object' && !Array.isArray(r) ? sha256(without(r, ['evidenceHashSha256'])) : null;
}
function verifyEvidenceIntegrity(r) {
  return !!r && HASH_RE.test(clean(r.evidenceHashSha256)) && computeEvidenceHash(r) === clean(r.evidenceHashSha256).toLowerCase();
}
function createGovernedParcelOperationEvidence(x = {}) {
  ['evidenceId','caseId','propertyRef','parcelRef','sourceCapability','sourceRecordId','sourceStatus','sourceReference','reviewedByRef','reviewEvidenceRef'].forEach((f) => {
    if (!nonEmpty(x[f])) throw new TypeError(`${f} must be a non-empty string`);
  });
  if (!Object.values(EVIDENCE_CLASS).includes(x.evidenceClass)) throw new TypeError('C18_EVIDENCE_CLASS_UNSUPPORTED');
  if (!Object.values(EVIDENCE_STATE).includes(x.evidenceState)) throw new TypeError('C18_EVIDENCE_STATE_UNSUPPORTED');
  if (!HASH_RE.test(clean(x.sourceRecordHashSha256))) throw new TypeError('C18_SOURCE_RECORD_HASH_REQUIRED');
  if (x.evidenceState === EVIDENCE_STATE.UNRESOLVED && !nonEmpty(x.unresolvedReasonRef)) throw new TypeError('C18_UNRESOLVED_REASON_REQUIRED');
  if (x.evidenceState === EVIDENCE_STATE.NOT_REQUIRED && !nonEmpty(x.notRequiredRationaleRef)) throw new TypeError('C18_NOT_REQUIRED_RATIONALE_REQUIRED');
  if (x.evidenceClass === EVIDENCE_CLASS.SURVEY_AND_AREA && !finitePositive(x.surveyedAreaSqm)) throw new TypeError('C18_SURVEY_AREA_REQUIRED');
  if (x.evidenceClass !== EVIDENCE_CLASS.SURVEY_AND_AREA && x.surveyedAreaSqm != null) throw new TypeError('C18_SURVEY_AREA_ONLY_ON_SURVEY_EVIDENCE');
  const reviewedAt = iso(x.reviewedAt, 'reviewedAt');
  const validUntil = iso(x.validUntil, 'validUntil');
  if (Date.parse(validUntil) < Date.parse(reviewedAt)) throw new TypeError('C18_EVIDENCE_VALIDITY_INVALID');
  const core = {
    schemaVersion: 1,
    evidenceId: x.evidenceId.trim(),
    caseId: x.caseId.trim(),
    propertyRef: x.propertyRef.trim(),
    parcelRef: x.parcelRef.trim(),
    evidenceClass: x.evidenceClass,
    evidenceState: x.evidenceState,
    sourceCapability: x.sourceCapability.trim(),
    sourceRecordId: x.sourceRecordId.trim(),
    sourceRecordHashSha256: x.sourceRecordHashSha256.trim().toLowerCase(),
    sourceStatus: x.sourceStatus.trim(),
    sourceReference: x.sourceReference.trim(),
    surveyedAreaSqm: x.evidenceClass === EVIDENCE_CLASS.SURVEY_AND_AREA ? x.surveyedAreaSqm : null,
    reviewedByRef: x.reviewedByRef.trim(),
    reviewEvidenceRef: x.reviewEvidenceRef.trim(),
    reviewedAt,
    validUntil,
    unresolvedReasonRef: x.evidenceState === EVIDENCE_STATE.UNRESOLVED ? x.unresolvedReasonRef.trim() : null,
    notRequiredRationaleRef: x.evidenceState === EVIDENCE_STATE.NOT_REQUIRED ? x.notRequiredRationaleRef.trim() : null,
    ownershipDeterminedBySoftware: false,
    geometryInferredBySoftware: false,
    adjacencyInferredBySoftware: false,
    feasibilityDeterminedBySoftware: false,
  };
  return freeze({ ...core, evidenceHashSha256: sha256(core) });
}

function normalizeParcelBindings(bindings) {
  if (!Array.isArray(bindings) || !bindings.length) throw new TypeError('C18_PARCEL_BINDINGS_REQUIRED');
  const seen = new Set();
  const out = bindings.map((b) => {
    if (!b || typeof b !== 'object' || Array.isArray(b)) throw new TypeError('C18_PARCEL_BINDING_OBJECT_REQUIRED');
    const parcelRef = clean(b.parcelRef);
    if (!parcelRef) throw new TypeError('C18_PARCEL_REF_REQUIRED');
    if (seen.has(parcelRef)) throw new TypeError(`C18_DUPLICATE_PARCEL_REF:${parcelRef}`);
    seen.add(parcelRef);
    if (!HASH_RE.test(clean(b.titleEvidenceHashSha256))) throw new TypeError(`C18_TITLE_EVIDENCE_HASH_REQUIRED:${parcelRef}`);
    if (!HASH_RE.test(clean(b.surveyEvidenceHashSha256))) throw new TypeError(`C18_SURVEY_EVIDENCE_HASH_REQUIRED:${parcelRef}`);
    if (!finitePositive(b.surveyedAreaSqm)) throw new TypeError(`C18_PARCEL_AREA_INVALID:${parcelRef}`);
    return freeze({
      parcelRef,
      titleEvidenceHashSha256: b.titleEvidenceHashSha256.trim().toLowerCase(),
      surveyEvidenceHashSha256: b.surveyEvidenceHashSha256.trim().toLowerCase(),
      surveyedAreaSqm: b.surveyedAreaSqm,
    });
  });
  return out.sort((a, b) => a.parcelRef.localeCompare(b.parcelRef));
}

function computeProposalHash(r) {
  return r && typeof r === 'object' && !Array.isArray(r) ? sha256(without(r, ['proposalHashSha256'])) : null;
}
function verifyProposalIntegrity(r) {
  return !!r && HASH_RE.test(clean(r.proposalHashSha256)) && computeProposalHash(r) === clean(r.proposalHashSha256).toLowerCase();
}
function createGovernedSubdivisionMergeProposal(x = {}) {
  ['proposalId','caseId','propertyRef','rationaleRef','authoredByRef','reviewedByRef','reviewEvidenceRef'].forEach((f) => {
    if (!nonEmpty(x[f])) throw new TypeError(`${f} must be a non-empty string`);
  });
  if (!Object.values(OPERATION_TYPE).includes(x.operationType)) throw new TypeError('C18_OPERATION_TYPE_UNSUPPORTED');
  if (!positiveInt(x.proposedOutputParcelCount)) throw new TypeError('C18_OUTPUT_PARCEL_COUNT_INVALID');
  const parcelBindings = normalizeParcelBindings(x.parcelBindings);
  const evidenceHashesSha256 = uniqueStrings(x.evidenceHashesSha256 || [], 'evidenceHashesSha256');
  if (!evidenceHashesSha256.length || evidenceHashesSha256.some((h) => !HASH_RE.test(h))) throw new TypeError('C18_PROPOSAL_EVIDENCE_HASHES_REQUIRED');
  const proposedTotalAreaSqm = x.proposedTotalAreaSqm == null ? null : x.proposedTotalAreaSqm;
  const areaToleranceSqm = x.areaToleranceSqm == null ? null : x.areaToleranceSqm;
  if (proposedTotalAreaSqm != null && !finitePositive(proposedTotalAreaSqm)) throw new TypeError('C18_PROPOSED_TOTAL_AREA_INVALID');
  if (areaToleranceSqm != null && !finiteNN(areaToleranceSqm)) throw new TypeError('C18_AREA_TOLERANCE_INVALID');
  if ((proposedTotalAreaSqm == null) !== (areaToleranceSqm == null)) throw new TypeError('C18_AREA_RECONCILIATION_PAIR_REQUIRED');
  const reviewedAt = iso(x.reviewedAt, 'reviewedAt');
  const validUntil = iso(x.validUntil, 'validUntil');
  if (Date.parse(validUntil) < Date.parse(reviewedAt)) throw new TypeError('C18_PROPOSAL_VALIDITY_INVALID');
  const core = {
    schemaVersion: 1,
    proposalId: x.proposalId.trim(),
    caseId: x.caseId.trim(),
    propertyRef: x.propertyRef.trim(),
    operationType: x.operationType,
    parcelBindings,
    proposedOutputParcelCount: x.proposedOutputParcelCount,
    proposedTotalAreaSqm,
    areaToleranceSqm,
    evidenceHashesSha256,
    rationaleRef: x.rationaleRef.trim(),
    authoredByRef: x.authoredByRef.trim(),
    reviewedByRef: x.reviewedByRef.trim(),
    reviewEvidenceRef: x.reviewEvidenceRef.trim(),
    reviewedAt,
    validUntil,
    feasibilityDeterminedBySoftware: false,
    legalConclusionBySoftware: false,
    cadastralMutationAuthorized: false,
    registryFilingAuthorized: false,
    municipalFilingAuthorized: false,
    transactionAuthorized: false,
  };
  return freeze({ ...core, proposalHashSha256: sha256(core) });
}

function normalizeRequiredMap(map, allowedOperations, allowedClasses) {
  if (!map || typeof map !== 'object' || Array.isArray(map)) throw new TypeError('requiredEvidenceClassesByOperation must be an object');
  const keys = Object.keys(map).sort();
  if (keys.some((k) => !Object.values(OPERATION_TYPE).includes(k))) throw new TypeError('C18_POLICY_REQUIRED_MAP_OPERATION_UNSUPPORTED');
  for (const operation of allowedOperations) {
    if (!Object.prototype.hasOwnProperty.call(map, operation)) throw new TypeError(`C18_POLICY_REQUIRED_MAP_MISSING:${operation}`);
  }
  const out = {};
  for (const operation of keys) {
    const classes = uniqueStrings(map[operation], `requiredEvidenceClassesByOperation.${operation}`);
    if (!classes.length) throw new TypeError(`C18_POLICY_REQUIRED_CLASSES_EMPTY:${operation}`);
    if (classes.some((c) => !Object.values(EVIDENCE_CLASS).includes(c))) throw new TypeError(`C18_POLICY_REQUIRED_CLASS_UNSUPPORTED:${operation}`);
    if (classes.some((c) => !allowedClasses.includes(c))) throw new TypeError(`C18_POLICY_REQUIRED_CLASS_NOT_ALLOWED:${operation}`);
    if (!classes.includes(EVIDENCE_CLASS.TITLE_AND_PARCEL_IDENTITY) || !classes.includes(EVIDENCE_CLASS.SURVEY_AND_AREA)) {
      throw new TypeError(`C18_POLICY_TITLE_SURVEY_HARD_GATES_REQUIRED:${operation}`);
    }
    out[operation] = classes;
  }
  return out;
}

function computePolicyHash(r) {
  return r && typeof r === 'object' && !Array.isArray(r) ? sha256(without(r, ['policyHashSha256'])) : null;
}
function verifyPolicyIntegrity(r) {
  return !!r && HASH_RE.test(clean(r.policyHashSha256)) && computePolicyHash(r) === clean(r.policyHashSha256).toLowerCase();
}
function createGovernedSubdivisionMergeReviewPolicy(x = {}) {
  ['policyId','caseId','propertyRef','reviewedByRef','reviewEvidenceRef'].forEach((f) => {
    if (!nonEmpty(x[f])) throw new TypeError(`${f} must be a non-empty string`);
  });
  const allowedOperationTypes = uniqueStrings(x.allowedOperationTypes || [], 'allowedOperationTypes');
  const allowedEvidenceClasses = uniqueStrings(x.allowedEvidenceClasses || [], 'allowedEvidenceClasses');
  if (!allowedOperationTypes.length || allowedOperationTypes.some((v) => !Object.values(OPERATION_TYPE).includes(v))) throw new TypeError('C18_POLICY_ALLOWED_OPERATIONS_INVALID');
  if (!allowedEvidenceClasses.length || allowedEvidenceClasses.some((v) => !Object.values(EVIDENCE_CLASS).includes(v))) throw new TypeError('C18_POLICY_ALLOWED_EVIDENCE_INVALID');
  const requiredEvidenceClassesByOperation = normalizeRequiredMap(x.requiredEvidenceClassesByOperation, allowedOperationTypes, allowedEvidenceClasses);
  const evidenceHashesSha256 = uniqueStrings(x.evidenceHashesSha256 || [], 'evidenceHashesSha256');
  const proposalHashesSha256 = uniqueStrings(x.proposalHashesSha256 || [], 'proposalHashesSha256');
  if (!evidenceHashesSha256.length || evidenceHashesSha256.some((h) => !HASH_RE.test(h))) throw new TypeError('C18_POLICY_EVIDENCE_BINDINGS_REQUIRED');
  if (!proposalHashesSha256.length || proposalHashesSha256.some((h) => !HASH_RE.test(h))) throw new TypeError('C18_POLICY_PROPOSAL_BINDINGS_REQUIRED');
  const reviewedAt = iso(x.reviewedAt, 'reviewedAt');
  const validUntil = iso(x.validUntil, 'validUntil');
  if (Date.parse(validUntil) < Date.parse(reviewedAt)) throw new TypeError('C18_POLICY_VALIDITY_INVALID');
  const core = {
    version: POLICY_VERSION,
    policyId: x.policyId.trim(),
    caseId: x.caseId.trim(),
    propertyRef: x.propertyRef.trim(),
    allowedOperationTypes,
    allowedEvidenceClasses,
    requiredEvidenceClassesByOperation,
    evidenceHashesSha256,
    proposalHashesSha256,
    reviewedByRef: x.reviewedByRef.trim(),
    reviewEvidenceRef: x.reviewEvidenceRef.trim(),
    reviewedAt,
    validUntil,
    feasibilityAuthority: false,
    filingAuthority: false,
    approvalAuthority: false,
  };
  return freeze({ ...core, policyHashSha256: sha256(core) });
}

const FALSE_ONLY_FIELDS = Object.freeze([
  'transactionAuthorized','approvalAuthorized','productionAuthorized','publicAiAuthorized','canonicalBaselineActivationAuthorized',
  'feasibilityDeterminedBySoftware','legalConclusionBySoftware','ownershipDeterminedBySoftware','geometryInferredBySoftware',
  'adjacencyInferredBySoftware','cadastralMutationAuthorized','registryFilingAuthorized','municipalFilingAuthorized',
  'zoningDeterminedBySoftware','entitlementDeterminedBySoftware','buildabilityDeterminedBySoftware','valuationCalculated',
  'residualLandValueCalculated','npvCalculated','irrCalculated','feasibilityAuthority','filingAuthority','approvalAuthority',
]);
function authorityInjection(record) {
  if (!record || typeof record !== 'object') return false;
  if (FALSE_ONLY_FIELDS.some((field) => Object.prototype.hasOwnProperty.call(record, field) && record[field] !== false)) return true;
  if (Object.prototype.hasOwnProperty.call(record, 'commercialGoLive') && record.commercialGoLive !== 'HOLD') return true;
  return false;
}

function evaluateGovernedSubdivisionMergeReview(input = {}) {
  const evidence = Array.isArray(input.evidence) ? input.evidence : [];
  const proposals = Array.isArray(input.proposals) ? input.proposals : [];
  const policy = input.reviewPolicy;
  const asOf = iso(input.asOf, 'asOf');
  const blockers = [];
  const riskFlags = [];

  if (!policy || !verifyPolicyIntegrity(policy)) blockers.push('C18_INTEGRITY_POLICY');
  if (authorityInjection(policy)) blockers.push('C18_AUTHORITY_INJECTION:POLICY');

  const evidenceIds = new Set();
  const evidenceHashes = [];
  for (const e of evidence) {
    const id = clean(e && e.evidenceId) || 'UNKNOWN';
    if (!verifyEvidenceIntegrity(e)) blockers.push(`C18_INTEGRITY_EVIDENCE:${id}`);
    if (authorityInjection(e)) blockers.push(`C18_AUTHORITY_INJECTION:EVIDENCE:${id}`);
    if (evidenceIds.has(id)) blockers.push(`C18_INTEGRITY_DUPLICATE_EVIDENCE_ID:${id}`); else evidenceIds.add(id);
    if (HASH_RE.test(clean(e && e.evidenceHashSha256))) evidenceHashes.push(clean(e.evidenceHashSha256).toLowerCase());
  }
  if (new Set(evidenceHashes).size !== evidenceHashes.length) blockers.push('C18_INTEGRITY_DUPLICATE_EVIDENCE_HASH');

  const proposalIds = new Set();
  const proposalHashes = [];
  for (const p of proposals) {
    const id = clean(p && p.proposalId) || 'UNKNOWN';
    if (!verifyProposalIntegrity(p)) blockers.push(`C18_INTEGRITY_PROPOSAL:${id}`);
    if (authorityInjection(p)) blockers.push(`C18_AUTHORITY_INJECTION:PROPOSAL:${id}`);
    if (proposalIds.has(id)) blockers.push(`C18_INTEGRITY_DUPLICATE_PROPOSAL_ID:${id}`); else proposalIds.add(id);
    if (HASH_RE.test(clean(p && p.proposalHashSha256))) proposalHashes.push(clean(p.proposalHashSha256).toLowerCase());
  }
  if (new Set(proposalHashes).size !== proposalHashes.length) blockers.push('C18_INTEGRITY_DUPLICATE_PROPOSAL_HASH');

  if (policy && verifyPolicyIntegrity(policy)) {
    if (!exactSet(policy.evidenceHashesSha256, [...evidenceHashes].sort())) blockers.push('C18_POLICY_EVIDENCE_BINDING_MISMATCH');
    if (!exactSet(policy.proposalHashesSha256, [...proposalHashes].sort())) blockers.push('C18_POLICY_PROPOSAL_BINDING_MISMATCH');
    if (Date.parse(policy.reviewedAt) > Date.parse(asOf)) blockers.push('C18_POLICY_REVIEWED_IN_FUTURE');
    if (Date.parse(policy.validUntil) < Date.parse(asOf)) blockers.push('C18_POLICY_EXPIRED');

    for (const e of evidence) {
      if (!e || typeof e !== 'object') continue;
      if (e.caseId !== policy.caseId || e.propertyRef !== policy.propertyRef) blockers.push(`C18_CONTEXT_EVIDENCE:${clean(e.evidenceId) || 'UNKNOWN'}`);
      if (!policy.allowedEvidenceClasses.includes(e.evidenceClass)) blockers.push(`C18_POLICY_EVIDENCE_CLASS_NOT_ALLOWED:${clean(e.evidenceId) || 'UNKNOWN'}`);
      if (Date.parse(e.reviewedAt) > Date.parse(asOf)) blockers.push(`C18_WINDOW_EVIDENCE_FUTURE:${clean(e.evidenceId) || 'UNKNOWN'}`);
      if (Date.parse(e.validUntil) < Date.parse(asOf)) blockers.push(`C18_WINDOW_EVIDENCE_STALE:${clean(e.evidenceId) || 'UNKNOWN'}`);
    }

    const byHash = new Map(evidence.map((e) => [clean(e && e.evidenceHashSha256).toLowerCase(), e]));
    for (const proposal of proposals) {
      if (!proposal || typeof proposal !== 'object') continue;
      const proposalId = clean(proposal.proposalId) || 'UNKNOWN';
      if (proposal.caseId !== policy.caseId || proposal.propertyRef !== policy.propertyRef) blockers.push(`C18_CONTEXT_PROPOSAL:${proposalId}`);
      if (!policy.allowedOperationTypes.includes(proposal.operationType)) blockers.push(`C18_POLICY_OPERATION_NOT_ALLOWED:${proposalId}`);
      if (Date.parse(proposal.reviewedAt) > Date.parse(asOf)) blockers.push(`C18_WINDOW_PROPOSAL_FUTURE:${proposalId}`);
      if (Date.parse(proposal.validUntil) < Date.parse(asOf)) blockers.push(`C18_WINDOW_PROPOSAL_STALE:${proposalId}`);

      const requiredClasses = policy.requiredEvidenceClassesByOperation[proposal.operationType] || [];
      const bound = [];
      for (const hash of proposal.evidenceHashesSha256 || []) {
        const e = byHash.get(clean(hash).toLowerCase());
        if (!e) blockers.push(`C18_EVIDENCE_PROPOSAL_REFERENCE_MISSING:${proposalId}:${hash}`); else bound.push(e);
      }

      for (const parcel of proposal.parcelBindings || []) {
        const title = byHash.get(clean(parcel.titleEvidenceHashSha256).toLowerCase());
        const survey = byHash.get(clean(parcel.surveyEvidenceHashSha256).toLowerCase());
        if (!title) blockers.push(`C18_EVIDENCE_TITLE_BINDING_MISSING:${proposalId}:${parcel.parcelRef}`);
        else {
          if (title.evidenceClass !== EVIDENCE_CLASS.TITLE_AND_PARCEL_IDENTITY) blockers.push(`C18_EVIDENCE_TITLE_CLASS_MISMATCH:${proposalId}:${parcel.parcelRef}`);
          if (title.parcelRef !== parcel.parcelRef) blockers.push(`C18_CONTEXT_TITLE_PARCEL_MISMATCH:${proposalId}:${parcel.parcelRef}`);
          if (!proposal.evidenceHashesSha256.includes(title.evidenceHashSha256)) blockers.push(`C18_EVIDENCE_TITLE_NOT_BOUND_TO_PROPOSAL:${proposalId}:${parcel.parcelRef}`);
          if (title.evidenceState !== EVIDENCE_STATE.SATISFIED) blockers.push(`C18_EVIDENCE_TITLE_NOT_SATISFIED:${proposalId}:${parcel.parcelRef}`);
        }
        if (!survey) blockers.push(`C18_EVIDENCE_SURVEY_BINDING_MISSING:${proposalId}:${parcel.parcelRef}`);
        else {
          if (survey.evidenceClass !== EVIDENCE_CLASS.SURVEY_AND_AREA) blockers.push(`C18_EVIDENCE_SURVEY_CLASS_MISMATCH:${proposalId}:${parcel.parcelRef}`);
          if (survey.parcelRef !== parcel.parcelRef) blockers.push(`C18_CONTEXT_SURVEY_PARCEL_MISMATCH:${proposalId}:${parcel.parcelRef}`);
          if (!proposal.evidenceHashesSha256.includes(survey.evidenceHashSha256)) blockers.push(`C18_EVIDENCE_SURVEY_NOT_BOUND_TO_PROPOSAL:${proposalId}:${parcel.parcelRef}`);
          if (survey.evidenceState !== EVIDENCE_STATE.SATISFIED) blockers.push(`C18_EVIDENCE_SURVEY_NOT_SATISFIED:${proposalId}:${parcel.parcelRef}`);
          if (survey.surveyedAreaSqm !== parcel.surveyedAreaSqm) blockers.push(`C18_AREA_SURVEY_BINDING_MISMATCH:${proposalId}:${parcel.parcelRef}`);
        }
        for (const requiredClass of requiredClasses) {
          const candidates = bound.filter((e) => e.parcelRef === parcel.parcelRef && e.evidenceClass === requiredClass);
          if (!candidates.length) blockers.push(`C18_EVIDENCE_REQUIRED_CLASS_MISSING:${proposalId}:${parcel.parcelRef}:${requiredClass}`);
          else if (!candidates.some((e) => e.evidenceState === EVIDENCE_STATE.SATISFIED)) blockers.push(`C18_EVIDENCE_REQUIRED_CLASS_NOT_SATISFIED:${proposalId}:${parcel.parcelRef}:${requiredClass}`);
        }
      }

      if (proposal.proposedTotalAreaSqm != null) {
        const inputAreaSqm = (proposal.parcelBindings || []).reduce((sum, p) => sum + p.surveyedAreaSqm, 0);
        const areaDeltaSqm = Math.abs(inputAreaSqm - proposal.proposedTotalAreaSqm);
        if (areaDeltaSqm > proposal.areaToleranceSqm) blockers.push(`C18_AREA_RECONCILIATION_OUTSIDE_TOLERANCE:${proposalId}`);
        else if (areaDeltaSqm > 0) riskFlags.push(`C18_AREA_RECONCILIATION_WITHIN_EXTERNAL_TOLERANCE:${proposalId}`);
      }
    }
  }

  const uniqueBlockers = [...new Set(blockers)].sort();
  const uniqueRiskFlags = [...new Set(riskFlags)].sort();
  const ready = uniqueBlockers.length === 0;
  const review = ready ? [...proposals].sort((a, b) => a.proposalId.localeCompare(b.proposalId)).map((p) => {
    const inputAreaSqm = p.parcelBindings.reduce((sum, parcel) => sum + parcel.surveyedAreaSqm, 0);
    return freeze({
      proposalId: p.proposalId,
      operationType: p.operationType,
      inputParcelCount: p.parcelBindings.length,
      proposedOutputParcelCount: p.proposedOutputParcelCount,
      inputSurveyedAreaSqm: inputAreaSqm,
      proposedTotalAreaSqm: p.proposedTotalAreaSqm,
      areaToleranceSqm: p.areaToleranceSqm,
      absoluteAreaDeltaSqm: p.proposedTotalAreaSqm == null ? null : Math.abs(inputAreaSqm - p.proposedTotalAreaSqm),
      feasibilityDeterminedBySoftware: false,
      recommendation: null,
    });
  }) : null;

  return freeze({
    capability: CAPABILITY,
    policyVersion: POLICY_VERSION,
    status: ready ? REVIEW_STATUS.READY_FOR_PROFESSIONAL_SUBDIVISION_MERGE_REVIEW : statusFor(uniqueBlockers),
    professionalSubdivisionMergeReviewReady: ready,
    asOf,
    blockers: uniqueBlockers,
    riskFlags: uniqueRiskFlags,
    review,
    recommendation: null,
    transactionAuthorized: false,
    approvalAuthorized: false,
    productionAuthorized: false,
    publicAiAuthorized: false,
    commercialGoLive: 'HOLD',
    canonicalBaselineActivationAuthorized: false,
    feasibilityDeterminedBySoftware: false,
    ownershipDeterminedBySoftware: false,
    geometryInferredBySoftware: false,
    adjacencyInferredBySoftware: false,
    zoningDeterminedBySoftware: false,
    entitlementDeterminedBySoftware: false,
    buildabilityDeterminedBySoftware: false,
    legalConclusionBySoftware: false,
    cadastralMutationAuthorized: false,
    registryFilingAuthorized: false,
    municipalFilingAuthorized: false,
    valuationCalculated: false,
    residualLandValueCalculated: false,
    npvCalculated: false,
    irrCalculated: false,
  });
}

module.exports = Object.freeze({
  CAPABILITY,
  POLICY_VERSION,
  REVIEW_STATUS,
  OPERATION_TYPE,
  EVIDENCE_CLASS,
  EVIDENCE_STATE,
  createGovernedParcelOperationEvidence,
  computeEvidenceHash,
  verifyEvidenceIntegrity,
  createGovernedSubdivisionMergeProposal,
  computeProposalHash,
  verifyProposalIntegrity,
  createGovernedSubdivisionMergeReviewPolicy,
  computePolicyHash,
  verifyPolicyIntegrity,
  evaluateGovernedSubdivisionMergeReview,
});
