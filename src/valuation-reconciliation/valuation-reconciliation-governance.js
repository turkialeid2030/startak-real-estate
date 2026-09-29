'use strict';

const crypto = require('crypto');
const {
  C3_VALUATION_RECONCILIATION_SCHEMA_VERSION,
  VALUATION_APPROACH_FAMILY,
  VALUATION_VALUE_SCOPE,
  RECONCILIATION_GATE_STATUS,
  RECONCILIATION_CONFIDENCE_CLASS,
  RECOGNIZED_METHOD_MODELS_BY_VERSION,
} = require('../contracts/valuation-reconciliation');
const {
  GEOSPATIAL_GATE_STATUS,
} = require('../contracts/geospatial-evidence');
const {
  MARKET_GATE_STATUS,
} = require('../contracts/market-evidence');
const {
  evaluateGeospatialEvidenceBundle,
} = require('../geospatial/geospatial-evidence-governance');
const {
  evaluateMarketEvidenceBundle,
} = require('../market/market-evidence-governance');

const C3_VALUATION_RECONCILIATION_GOVERNANCE_VERSION = 'C3_VALUATION_RECONCILIATION_GOVERNANCE_V1';
const APPROACH_FAMILIES = Object.freeze(Object.values(VALUATION_APPROACH_FAMILY));
const VALUE_SCOPES = Object.freeze(Object.values(VALUATION_VALUE_SCOPE));
const HASH_RE = /^[a-f0-9]{64}$/i;

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanStringArray(value, name) {
  if (!Array.isArray(value)) throw new TypeError(`${name} must be an array`);
  const cleaned = value.map(cleanString);
  if (cleaned.some((item) => !item)) throw new TypeError(`${name} must contain only non-empty strings`);
  return [...new Set(cleaned)];
}

function toTimestamp(value) {
  const text = cleanString(value);
  if (!text) return null;
  const ms = new Date(text).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function isPositiveFinite(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function isJsonSafe(value, seen = new Set()) {
  if (value === null) return true;
  if (typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) return false;
  seen.add(value);
  const valid = Array.isArray(value)
    ? value.every((item) => isJsonSafe(item, seen))
    : Object.keys(value).every((key) => isJsonSafe(value[key], seen));
  seen.delete(value);
  return valid;
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((acc, key) => {
      acc[key] = canonicalize(value[key]);
      return acc;
    }, Object.create(null));
  }
  return value;
}

function sha256(value) {
  if (!isJsonSafe(value)) return null;
  try {
    return crypto.createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
  } catch (_) {
    return null;
  }
}

function unique(values) {
  return [...new Set(values)];
}

function validatePolicy(policyId, registry) {
  const blockers = [];
  const id = cleanString(policyId);
  const registryValid = registry && typeof registry === 'object' && !Array.isArray(registry);
  if (!registryValid) blockers.push('C3_RECONCILIATION_POLICY_REGISTRY_REQUIRED');
  if (!id) blockers.push('C3_RECONCILIATION_POLICY_ID_REQUIRED');
  const policy = registryValid && id && Object.prototype.hasOwnProperty.call(registry, id) ? registry[id] : null;
  if (id && !policy) blockers.push(`C3_RECONCILIATION_POLICY_NOT_GOVERNED:${id}`);
  if (!policy || typeof policy !== 'object' || Array.isArray(policy)) {
    if (policy) blockers.push(`C3_RECONCILIATION_POLICY_INVALID:${id}`);
    return { policyId: id || null, policy: null, blockers };
  }

  const valuationScope = cleanString(policy.valuationScope);
  if (!VALUE_SCOPES.includes(valuationScope)) blockers.push(`C3_POLICY_VALUATION_SCOPE_INVALID:${valuationScope || 'MISSING'}`);

  const allowedModelVersions = Array.isArray(policy.allowedModelVersions)
    ? unique(policy.allowedModelVersions.map(cleanString).filter(Boolean))
    : [];
  if (!allowedModelVersions.length) blockers.push('C3_POLICY_ALLOWED_MODELS_REQUIRED');
  for (const modelVersion of allowedModelVersions) {
    const model = RECOGNIZED_METHOD_MODELS_BY_VERSION[modelVersion];
    if (!model) blockers.push(`C3_POLICY_MODEL_UNSUPPORTED:${modelVersion}`);
    else if (valuationScope && model.valueScope !== valuationScope) blockers.push(`C3_POLICY_MODEL_SCOPE_MISMATCH:${modelVersion}:${model.valueScope}/${valuationScope}`);
  }

  const requiredApproachFamilies = Array.isArray(policy.requiredApproachFamilies)
    ? unique(policy.requiredApproachFamilies.map(cleanString).filter(Boolean))
    : [];
  for (const family of requiredApproachFamilies) {
    if (!APPROACH_FAMILIES.includes(family)) blockers.push(`C3_POLICY_APPROACH_UNSUPPORTED:${family}`);
  }

  const minimumMethodIndications = policy.minimumMethodIndications;
  if (!Number.isInteger(minimumMethodIndications) || minimumMethodIndications < 1) blockers.push('C3_POLICY_MINIMUM_METHODS_INVALID');

  const minimumDistinctApproachFamilies = policy.minimumDistinctApproachFamilies;
  if (!Number.isInteger(minimumDistinctApproachFamilies)
      || minimumDistinctApproachFamilies < 1
      || minimumDistinctApproachFamilies > APPROACH_FAMILIES.length) {
    blockers.push('C3_POLICY_MINIMUM_APPROACH_FAMILIES_INVALID');
  }

  const maxSingleIndicationWeight = policy.maxSingleIndicationWeight;
  if (!(typeof maxSingleIndicationWeight === 'number' && Number.isFinite(maxSingleIndicationWeight)
      && maxSingleIndicationWeight > 0 && maxSingleIndicationWeight <= 1)) {
    blockers.push('C3_POLICY_MAX_SINGLE_INDICATION_WEIGHT_INVALID');
  }

  const maxSingleApproachWeight = policy.maxSingleApproachWeight;
  if (!(typeof maxSingleApproachWeight === 'number' && Number.isFinite(maxSingleApproachWeight)
      && maxSingleApproachWeight > 0 && maxSingleApproachWeight <= 1)) {
    blockers.push('C3_POLICY_MAX_SINGLE_APPROACH_WEIGHT_INVALID');
  }

  const maxSpreadRatio = policy.maxSpreadRatio;
  if (!(typeof maxSpreadRatio === 'number' && Number.isFinite(maxSpreadRatio) && maxSpreadRatio >= 0)) {
    blockers.push('C3_POLICY_MAX_SPREAD_RATIO_INVALID');
  }

  const thresholds = policy.confidenceSpreadThresholds;
  const highMax = thresholds && thresholds.highMax;
  const moderateMax = thresholds && thresholds.moderateMax;
  if (!(typeof highMax === 'number' && Number.isFinite(highMax) && highMax >= 0
      && typeof moderateMax === 'number' && Number.isFinite(moderateMax) && moderateMax >= highMax
      && typeof maxSpreadRatio === 'number' && Number.isFinite(maxSpreadRatio) && moderateMax <= maxSpreadRatio)) {
    blockers.push('C3_POLICY_CONFIDENCE_THRESHOLDS_INVALID');
  }

  if (policy.requireAllEligibleIndicationsWeighted !== true && policy.requireAllEligibleIndicationsWeighted !== false) {
    blockers.push('C3_POLICY_REQUIRE_ALL_ELIGIBLE_FLAG_REQUIRED');
  }

  return {
    policyId: id || null,
    policy: Object.freeze({
      valuationScope: VALUE_SCOPES.includes(valuationScope) ? valuationScope : null,
      allowedModelVersions: Object.freeze(allowedModelVersions),
      requiredApproachFamilies: Object.freeze(requiredApproachFamilies),
      minimumMethodIndications,
      minimumDistinctApproachFamilies,
      maxSingleIndicationWeight,
      maxSingleApproachWeight,
      maxSpreadRatio,
      confidenceSpreadThresholds: Object.freeze({ highMax, moderateMax }),
      requireAllEligibleIndicationsWeighted: policy.requireAllEligibleIndicationsWeighted === true,
    }),
    blockers,
  };
}

function evaluateMarketContextBinding(binding, {
  propertyRef,
  marketInput,
  valuationDateMs,
  asOfMs,
  trustedMarketContextBinderIds,
}) {
  const blockers = [];
  if (!binding || typeof binding !== 'object' || Array.isArray(binding)) {
    return { blockers: ['C3_MARKET_CONTEXT_BINDING_REQUIRED'], normalized: null };
  }

  const bindingId = cleanString(binding.bindingId);
  const boundPropertyRef = cleanString(binding.propertyRef);
  const marketContextId = cleanString(binding.marketContextId);
  const geographyKey = cleanString(binding.geographyKey);
  const assetType = cleanString(binding.assetType);
  const boundBy = cleanString(binding.boundBy);
  const bindingReference = cleanString(binding.bindingReference);
  const boundAtMs = toTimestamp(binding.boundAt);

  if (!bindingId) blockers.push('C3_MARKET_CONTEXT_BINDING_ID_REQUIRED');
  if (boundPropertyRef !== propertyRef) blockers.push('C3_MARKET_CONTEXT_PROPERTY_MISMATCH');
  if (!marketContextId || marketContextId !== cleanString(marketInput.marketContextId)) blockers.push('C3_MARKET_CONTEXT_ID_MISMATCH');
  if (!geographyKey || geographyKey !== cleanString(marketInput.geographyKey)) blockers.push('C3_MARKET_CONTEXT_GEOGRAPHY_MISMATCH');
  if (!assetType || assetType !== cleanString(marketInput.assetType)) blockers.push('C3_MARKET_CONTEXT_ASSET_TYPE_MISMATCH');
  if (!boundBy) blockers.push('C3_MARKET_CONTEXT_BINDER_REQUIRED');
  else if (!trustedMarketContextBinderIds.includes(boundBy)) blockers.push(`C3_MARKET_CONTEXT_BINDER_UNTRUSTED:${boundBy}`);
  if (!bindingReference) blockers.push('C3_MARKET_CONTEXT_BINDING_REFERENCE_REQUIRED');
  if (boundAtMs === null) blockers.push('C3_MARKET_CONTEXT_BOUND_AT_REQUIRED');
  else {
    if (boundAtMs > asOfMs) blockers.push('C3_MARKET_CONTEXT_BOUND_AT_FUTURE');
    if (valuationDateMs !== null && boundAtMs < valuationDateMs) blockers.push('C3_MARKET_CONTEXT_BOUND_BEFORE_VALUATION_DATE');
  }

  return {
    blockers,
    normalized: Object.freeze({
      bindingId: bindingId || null,
      propertyRef: boundPropertyRef || null,
      marketContextId: marketContextId || null,
      geographyKey: geographyKey || null,
      assetType: assetType || null,
      boundBy: boundBy || null,
      bindingReference: bindingReference || null,
      boundAt: boundAtMs === null ? null : new Date(boundAtMs).toISOString(),
    }),
  };
}

function evaluateMethodIndication(item, {
  propertyRef,
  valuationDate,
  valuationDateMs,
  valuationScope,
  asOfMs,
  trustedMethodVerifierIds,
  allowedModelVersions,
}) {
  const blockers = [];
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    return { eligible: false, blockers: ['C3_METHOD_INDICATION_OBJECT_REQUIRED'], normalized: null };
  }

  const id = cleanString(item.id);
  const verifiedBy = cleanString(item.verifiedBy);
  const verificationReference = cleanString(item.verificationReference);
  const verifiedAtMs = toTimestamp(item.verifiedAt);
  const sourceResult = item.sourceResult;
  if (!id) blockers.push('C3_METHOD_INDICATION_ID_REQUIRED');
  if (!sourceResult || typeof sourceResult !== 'object' || Array.isArray(sourceResult)) blockers.push(`C3_METHOD_SOURCE_RESULT_REQUIRED:${id || 'UNKNOWN'}`);

  const modelVersion = cleanString(sourceResult && sourceResult.modelVersion);
  const model = RECOGNIZED_METHOD_MODELS_BY_VERSION[modelVersion] || null;
  if (!model) blockers.push(`C3_METHOD_MODEL_UNSUPPORTED:${modelVersion || 'MISSING'}`);
  else {
    if (!allowedModelVersions.includes(modelVersion)) blockers.push(`C3_METHOD_MODEL_NOT_ALLOWED_BY_POLICY:${modelVersion}`);
    if (model.valueScope !== valuationScope) blockers.push(`C3_METHOD_VALUE_SCOPE_MISMATCH:${id || 'UNKNOWN'}:${model.valueScope}/${valuationScope || 'MISSING'}`);
  }

  const sourceStatus = cleanString(sourceResult && sourceResult.status);
  if (model && !model.acceptedStatuses.includes(sourceStatus)) blockers.push(`C3_METHOD_STATUS_NOT_RECONCILABLE:${modelVersion}:${sourceStatus || 'MISSING'}`);

  const sourcePropertyRef = cleanString(sourceResult && sourceResult.propertyRef);
  if (!sourcePropertyRef) blockers.push(`C3_METHOD_PROPERTY_REF_REQUIRED:${id || 'UNKNOWN'}`);
  else if (sourcePropertyRef !== propertyRef) blockers.push(`C3_METHOD_PROPERTY_REF_MISMATCH:${id || 'UNKNOWN'}`);

  const sourceValuationDate = cleanString(sourceResult && sourceResult.valuationDate);
  if (!sourceValuationDate) blockers.push(`C3_METHOD_VALUATION_DATE_REQUIRED:${id || 'UNKNOWN'}`);
  else if (sourceValuationDate !== valuationDate) blockers.push(`C3_METHOD_VALUATION_DATE_MISMATCH:${id || 'UNKNOWN'}`);

  const calculationHashSha256 = cleanString(sourceResult && sourceResult.calculationHashSha256);
  if (!HASH_RE.test(calculationHashSha256)) blockers.push(`C3_METHOD_CALCULATION_HASH_REQUIRED:${id || 'UNKNOWN'}`);

  if (sourceResult && sourceResult.finalValuationConclusionEstablished !== false) blockers.push(`C3_UPSTREAM_FINAL_VALUATION_FLAG_INVALID:${id || 'UNKNOWN'}`);
  if (sourceResult && sourceResult.certifiedValuationEstablished !== false) blockers.push(`C3_UPSTREAM_CERTIFICATION_FLAG_INVALID:${id || 'UNKNOWN'}`);
  if (sourceResult && sourceResult.transactionAuthorized !== false) blockers.push(`C3_UPSTREAM_TRANSACTION_AUTHORITY_INVALID:${id || 'UNKNOWN'}`);

  if (!verifiedBy) blockers.push(`C3_METHOD_VERIFIER_REQUIRED:${id || 'UNKNOWN'}`);
  else if (!trustedMethodVerifierIds.includes(verifiedBy)) blockers.push(`C3_METHOD_VERIFIER_UNTRUSTED:${id || 'UNKNOWN'}`);
  if (!verificationReference) blockers.push(`C3_METHOD_VERIFICATION_REFERENCE_REQUIRED:${id || 'UNKNOWN'}`);
  if (verifiedAtMs === null) blockers.push(`C3_METHOD_VERIFIED_AT_REQUIRED:${id || 'UNKNOWN'}`);
  else {
    if (verifiedAtMs > asOfMs) blockers.push(`C3_METHOD_VERIFIED_AT_FUTURE:${id || 'UNKNOWN'}`);
    if (valuationDateMs !== null && verifiedAtMs < valuationDateMs) blockers.push(`C3_METHOD_VERIFIED_BEFORE_VALUATION_DATE:${id || 'UNKNOWN'}`);
  }

  const valueSar = model && sourceResult ? sourceResult[model.valueField] : null;
  if (!isPositiveFinite(valueSar)) blockers.push(`C3_METHOD_VALUE_INVALID:${id || 'UNKNOWN'}`);

  if (model && cleanString(sourceResult && sourceResult[model.indicationTypeField]) !== model.expectedIndicationType) {
    blockers.push(`C3_METHOD_INDICATION_TYPE_MISMATCH:${id || 'UNKNOWN'}`);
  }

  const sourceResultHashSha256 = sha256(sourceResult);
  if (!sourceResultHashSha256) blockers.push(`C3_METHOD_SOURCE_RESULT_NOT_JSON_SAFE:${id || 'UNKNOWN'}`);

  return {
    eligible: blockers.length === 0,
    blockers,
    normalized: Object.freeze({
      id: id || null,
      approachFamily: model ? model.approachFamily : null,
      valueScope: model ? model.valueScope : null,
      modelVersion: modelVersion || null,
      sourceStatus: sourceStatus || null,
      propertyRef: sourcePropertyRef || null,
      valuationDate: sourceValuationDate || null,
      valueSar: isPositiveFinite(valueSar) ? valueSar : null,
      calculationHashSha256: calculationHashSha256 || null,
      sourceResultHashSha256,
      verifiedBy: verifiedBy || null,
      verificationReference: verificationReference || null,
      verifiedAt: verifiedAtMs === null ? null : new Date(verifiedAtMs).toISOString(),
      blockers: Object.freeze([...blockers]),
    }),
  };
}

function evaluateInstruction(instruction, {
  asOfMs,
  valuationDateMs,
  trustedReconcilerIds,
  eligibleIndications,
  policy,
}) {
  const blockers = [];
  if (!instruction || typeof instruction !== 'object' || Array.isArray(instruction)) {
    return { blockers: ['C3_RECONCILIATION_INSTRUCTION_REQUIRED'], normalized: null, weighted: [] };
  }

  const instructionId = cleanString(instruction.instructionId);
  const rationale = cleanString(instruction.rationale);
  const reconciledBy = cleanString(instruction.reconciledBy);
  const reconciliationReference = cleanString(instruction.reconciliationReference);
  const reconciledAtMs = toTimestamp(instruction.reconciledAt);
  const weights = instruction.weightsByIndicationId;

  if (!instructionId) blockers.push('C3_RECONCILIATION_INSTRUCTION_ID_REQUIRED');
  if (!rationale) blockers.push('C3_RECONCILIATION_RATIONALE_REQUIRED');
  if (!reconciledBy) blockers.push('C3_RECONCILER_REQUIRED');
  else if (!trustedReconcilerIds.includes(reconciledBy)) blockers.push(`C3_RECONCILER_UNTRUSTED:${reconciledBy}`);
  if (!reconciliationReference) blockers.push('C3_RECONCILIATION_REFERENCE_REQUIRED');
  if (reconciledAtMs === null) blockers.push('C3_RECONCILED_AT_REQUIRED');
  else {
    if (reconciledAtMs > asOfMs) blockers.push('C3_RECONCILED_AT_FUTURE');
    if (valuationDateMs !== null && reconciledAtMs < valuationDateMs) blockers.push('C3_RECONCILED_BEFORE_VALUATION_DATE');
  }

  if (!weights || typeof weights !== 'object' || Array.isArray(weights)) {
    blockers.push('C3_RECONCILIATION_WEIGHTS_MAP_REQUIRED');
    return { blockers, normalized: null, weighted: [] };
  }

  const eligibleById = new Map(eligibleIndications.map((item) => [item.id, item]));
  const weightEntries = Object.entries(weights);
  const weighted = [];
  let weightSum = 0;

  for (const [rawId, weight] of weightEntries) {
    const indicationId = cleanString(rawId);
    if (!indicationId || !eligibleById.has(indicationId)) {
      blockers.push(`C3_RECONCILIATION_WEIGHT_TARGET_INELIGIBLE:${indicationId || 'MISSING'}`);
      continue;
    }
    if (!(typeof weight === 'number' && Number.isFinite(weight) && weight > 0 && weight <= 1)) {
      blockers.push(`C3_RECONCILIATION_WEIGHT_INVALID:${indicationId}`);
      continue;
    }
    if (weight > policy.maxSingleIndicationWeight + 1e-12) {
      blockers.push(`C3_RECONCILIATION_WEIGHT_EXCEEDS_POLICY:${indicationId}`);
    }
    weightSum += weight;
    weighted.push({ indication: eligibleById.get(indicationId), weight });
  }

  if (Math.abs(weightSum - 1) > 1e-9) blockers.push(`C3_RECONCILIATION_WEIGHTS_SUM_INVALID:${weightSum}`);

  if (policy.requireAllEligibleIndicationsWeighted) {
    for (const item of eligibleIndications) {
      if (!Object.prototype.hasOwnProperty.call(weights, item.id)) blockers.push(`C3_ELIGIBLE_INDICATION_NOT_WEIGHTED:${item.id}`);
    }
  }

  const approachWeight = new Map();
  for (const item of weighted) {
    approachWeight.set(item.indication.approachFamily, (approachWeight.get(item.indication.approachFamily) || 0) + item.weight);
  }
  for (const [family, weight] of approachWeight.entries()) {
    if (weight > policy.maxSingleApproachWeight + 1e-12) blockers.push(`C3_APPROACH_WEIGHT_EXCEEDS_POLICY:${family}`);
  }
  for (const requiredFamily of policy.requiredApproachFamilies) {
    if (!approachWeight.has(requiredFamily)) blockers.push(`C3_REQUIRED_APPROACH_NOT_WEIGHTED:${requiredFamily}`);
  }

  return {
    blockers,
    weighted,
    normalized: Object.freeze({
      instructionId: instructionId || null,
      rationale: rationale || null,
      reconciledBy: reconciledBy || null,
      reconciliationReference: reconciliationReference || null,
      reconciledAt: reconciledAtMs === null ? null : new Date(reconciledAtMs).toISOString(),
      weightsByIndicationId: Object.freeze(Object.fromEntries(weightEntries)),
      approachWeights: Object.freeze(Object.fromEntries(approachWeight.entries())),
    }),
  };
}

function classifyConfidence(spreadRatio, thresholds) {
  if (!Number.isFinite(spreadRatio)) return RECONCILIATION_CONFIDENCE_CLASS.NOT_ESTABLISHED;
  if (spreadRatio <= thresholds.highMax) return RECONCILIATION_CONFIDENCE_CLASS.HIGH;
  if (spreadRatio <= thresholds.moderateMax) return RECONCILIATION_CONFIDENCE_CLASS.MODERATE;
  return RECONCILIATION_CONFIDENCE_CLASS.LOW;
}

function evaluateValuationReconciliation({
  propertyRef,
  valuationDate,
  valuationScope,
  asOf = new Date(),
  geospatialEvidence,
  marketEvidence,
  marketContextBinding,
  trustedMarketContextBinderIds = [],
  methodIndications,
  trustedMethodVerifierIds = [],
  trustedReconcilerIds = [],
  reconciliationPolicyId,
  governedReconciliationPolicies = {},
  reconciliationInstruction,
} = {}) {
  const property = cleanString(propertyRef);
  const valuationDateText = cleanString(valuationDate);
  const scope = cleanString(valuationScope);
  const valuationDateMs = toTimestamp(valuationDateText);
  const asOfMs = new Date(asOf).getTime();
  if (!Number.isFinite(asOfMs)) throw new TypeError('asOf must be a valid date');

  const blockers = [];
  const warnings = [];
  if (!property) blockers.push('C3_PROPERTY_REF_REQUIRED');
  if (valuationDateMs === null) blockers.push('C3_VALUATION_DATE_REQUIRED');
  else if (valuationDateMs > asOfMs) blockers.push('C3_VALUATION_DATE_FUTURE');
  if (!VALUE_SCOPES.includes(scope)) blockers.push(`C3_VALUATION_SCOPE_INVALID:${scope || 'MISSING'}`);

  const methodVerifiers = cleanStringArray(trustedMethodVerifierIds, 'trustedMethodVerifierIds');
  const reconcilers = cleanStringArray(trustedReconcilerIds, 'trustedReconcilerIds');
  const marketContextBinders = cleanStringArray(trustedMarketContextBinderIds, 'trustedMarketContextBinderIds');
  const policyEvaluation = validatePolicy(reconciliationPolicyId, governedReconciliationPolicies);
  blockers.push(...policyEvaluation.blockers);
  const policy = policyEvaluation.policy;
  if (policy && scope && policy.valuationScope !== scope) blockers.push(`C3_POLICY_VALUATION_SCOPE_MISMATCH:${policy.valuationScope}/${scope}`);

  const c1Input = geospatialEvidence && typeof geospatialEvidence === 'object' && !Array.isArray(geospatialEvidence)
    ? geospatialEvidence
    : {};
  if (!geospatialEvidence || typeof geospatialEvidence !== 'object' || Array.isArray(geospatialEvidence)) blockers.push('C3_C1_INPUT_REQUIRED');
  if (cleanString(c1Input.subjectId) !== property) blockers.push('C3_C1_SUBJECT_PROPERTY_BINDING_REQUIRED');
  let c1Evaluation;
  try {
    c1Evaluation = evaluateGeospatialEvidenceBundle({ ...c1Input, asOf: new Date(asOfMs) });
  } catch (error) {
    blockers.push(`C3_C1_EVALUATION_ERROR:${error.message}`);
    c1Evaluation = null;
  }
  if (!c1Evaluation || c1Evaluation.status !== GEOSPATIAL_GATE_STATUS.READY || c1Evaluation.decisionReady !== true) {
    blockers.push('C3_C1_EVIDENCE_NOT_READY');
  }

  const c2Input = marketEvidence && typeof marketEvidence === 'object' && !Array.isArray(marketEvidence)
    ? marketEvidence
    : {};
  if (!marketEvidence || typeof marketEvidence !== 'object' || Array.isArray(marketEvidence)) blockers.push('C3_C2_INPUT_REQUIRED');
  let c2Evaluation;
  try {
    c2Evaluation = evaluateMarketEvidenceBundle({ ...c2Input, asOf: new Date(asOfMs) });
  } catch (error) {
    blockers.push(`C3_C2_EVALUATION_ERROR:${error.message}`);
    c2Evaluation = null;
  }
  if (!c2Evaluation || c2Evaluation.status !== MARKET_GATE_STATUS.READY || c2Evaluation.decisionReady !== true) {
    blockers.push('C3_C2_EVIDENCE_NOT_READY');
  }

  const contextBindingEvaluation = evaluateMarketContextBinding(marketContextBinding, {
    propertyRef: property,
    marketInput: c2Input,
    valuationDateMs,
    asOfMs,
    trustedMarketContextBinderIds: marketContextBinders,
  });
  blockers.push(...contextBindingEvaluation.blockers);

  if (!Array.isArray(methodIndications)) blockers.push('C3_METHOD_INDICATIONS_ARRAY_REQUIRED');
  const rawMethods = Array.isArray(methodIndications) ? methodIndications : [];
  const methodFindings = rawMethods.map((item) => evaluateMethodIndication(item, {
    propertyRef: property,
    valuationDate: valuationDateText,
    valuationDateMs,
    valuationScope: scope,
    asOfMs,
    trustedMethodVerifierIds: methodVerifiers,
    allowedModelVersions: policy ? policy.allowedModelVersions : [],
  }));

  const seenIds = new Set();
  const seenCalculationHashes = new Set();
  const eligible = [];
  for (const finding of methodFindings) {
    if (finding.normalized && finding.normalized.id) {
      if (seenIds.has(finding.normalized.id)) blockers.push(`C3_DUPLICATE_METHOD_INDICATION_ID:${finding.normalized.id}`);
      seenIds.add(finding.normalized.id);
    }
    blockers.push(...finding.blockers);
    if (finding.eligible && finding.normalized) {
      const calcHash = finding.normalized.calculationHashSha256;
      if (seenCalculationHashes.has(calcHash)) {
        blockers.push(`C3_DUPLICATE_METHOD_CALCULATION:${calcHash}`);
      } else {
        seenCalculationHashes.add(calcHash);
        eligible.push(finding.normalized);
      }
    }
  }

  if (policy) {
    if (eligible.length < policy.minimumMethodIndications) blockers.push(`C3_MINIMUM_METHODS_NOT_MET:${eligible.length}/${policy.minimumMethodIndications}`);
    const families = unique(eligible.map((item) => item.approachFamily));
    if (families.length < policy.minimumDistinctApproachFamilies) blockers.push(`C3_MINIMUM_APPROACH_FAMILIES_NOT_MET:${families.length}/${policy.minimumDistinctApproachFamilies}`);
    for (const family of policy.requiredApproachFamilies) {
      if (!families.includes(family)) blockers.push(`C3_REQUIRED_APPROACH_MISSING:${family}`);
    }
  }

  const instructionEvaluation = policy
    ? evaluateInstruction(reconciliationInstruction, {
      asOfMs,
      valuationDateMs,
      trustedReconcilerIds: reconcilers,
      eligibleIndications: eligible,
      policy,
    })
    : { blockers: ['C3_RECONCILIATION_POLICY_REQUIRED_BEFORE_INSTRUCTION'], normalized: null, weighted: [] };
  blockers.push(...instructionEvaluation.blockers);

  let candidateWeightedValueSar = null;
  let analyticalRangeLowSar = null;
  let analyticalRangeHighSar = null;
  let spreadRatio = null;
  let analyticalConfidenceClass = RECONCILIATION_CONFIDENCE_CLASS.NOT_ESTABLISHED;
  let weightedTrace = [];

  if (instructionEvaluation.weighted.length > 0) {
    candidateWeightedValueSar = 0;
    const values = [];
    weightedTrace = instructionEvaluation.weighted.map(({ indication, weight }) => {
      const contributionSar = indication.valueSar * weight;
      candidateWeightedValueSar += contributionSar;
      values.push(indication.valueSar);
      return Object.freeze({
        indicationId: indication.id,
        approachFamily: indication.approachFamily,
        valueScope: indication.valueScope,
        modelVersion: indication.modelVersion,
        valueSar: indication.valueSar,
        weight,
        contributionSar,
        calculationHashSha256: indication.calculationHashSha256,
      });
    });
    if (!Number.isFinite(candidateWeightedValueSar) || candidateWeightedValueSar <= 0) {
      blockers.push('C3_WEIGHTED_VALUE_INVALID');
      candidateWeightedValueSar = null;
    } else {
      analyticalRangeLowSar = Math.min(...values);
      analyticalRangeHighSar = Math.max(...values);
      spreadRatio = (analyticalRangeHighSar - analyticalRangeLowSar) / candidateWeightedValueSar;
      if (!Number.isFinite(spreadRatio) || spreadRatio < 0) blockers.push('C3_SPREAD_RATIO_INVALID');
      else if (policy && spreadRatio > policy.maxSpreadRatio + 1e-12) blockers.push(`C3_APPROACH_DIVERGENCE_EXCEEDS_POLICY:${spreadRatio}`);
      if (policy) analyticalConfidenceClass = classifyConfidence(spreadRatio, policy.confidenceSpreadThresholds);
    }
  }

  const evidenceBlockers = blockers.filter((code) => (
    code.startsWith('C3_C1_')
    || code.startsWith('C3_C2_')
    || code.startsWith('C3_MARKET_CONTEXT_')
  ));
  const uniqueBlockers = unique(blockers);
  const status = uniqueBlockers.length === 0
    ? RECONCILIATION_GATE_STATUS.READY
    : evidenceBlockers.length > 0
      ? RECONCILIATION_GATE_STATUS.HOLD_EVIDENCE
      : RECONCILIATION_GATE_STATUS.HOLD_RECONCILIATION;

  const decisionReady = status === RECONCILIATION_GATE_STATUS.READY;
  const methodFamilies = unique(eligible.map((item) => item.approachFamily));
  const requiredFamilies = policy ? policy.requiredApproachFamilies : [];
  const requiredFamilyCoverageRatio = requiredFamilies.length
    ? requiredFamilies.filter((family) => methodFamilies.includes(family)).length / requiredFamilies.length
    : null;

  const resultCore = {
    version: C3_VALUATION_RECONCILIATION_GOVERNANCE_VERSION,
    schemaVersion: C3_VALUATION_RECONCILIATION_SCHEMA_VERSION,
    propertyRef: property || null,
    valuationDate: valuationDateMs === null ? null : new Date(valuationDateMs).toISOString(),
    valuationScope: VALUE_SCOPES.includes(scope) ? scope : null,
    asOf: new Date(asOfMs).toISOString(),
    status,
    decisionReady,
    reconciliationPolicyId: policyEvaluation.policyId,
    dependencyStatus: {
      c1: c1Evaluation ? c1Evaluation.status : null,
      c2: c2Evaluation ? c2Evaluation.status : null,
    },
    marketContextBinding: contextBindingEvaluation.normalized,
    methodCoverage: {
      eligibleMethodCount: eligible.length,
      eligibleApproachFamilies: methodFamilies,
      requiredApproachFamilies: requiredFamilies,
      requiredFamilyCoverageRatio,
    },
    eligibleMethodIndications: eligible,
    reconciliationInstruction: instructionEvaluation.normalized,
    weightedTrace,
    candidateWeightedValueSar,
    analyticalRangeLowSar,
    analyticalRangeHighSar,
    spreadRatio,
    analyticalConfidenceClass: decisionReady ? analyticalConfidenceClass : RECONCILIATION_CONFIDENCE_CLASS.NOT_ESTABLISHED,
    analyticalValueIndicationSar: decisionReady ? candidateWeightedValueSar : null,
    blockers: uniqueBlockers,
    warnings: unique(warnings),
  };

  return deepFreeze({
    ...resultCore,
    resultHashSha256: sha256(resultCore),
    c1ReevaluatedInternally: true,
    c2ReevaluatedInternally: true,
    marketContextBindingRequired: true,
    valuationScopeEnforced: true,
    professionalReconciliationInstructionUsed: !!instructionEvaluation.normalized,
    automaticMethodSelection: false,
    automaticReconciliationWeightsGenerated: false,
    statisticalConfidenceClaimed: false,
    finalValuationConclusionEstablished: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
    publicAiAuthorized: false,
    semantics: 'C3 re-evaluates C1 geospatial and C2 market evidence dependencies, requires an explicit property-to-market-context binding, enforces common valuation scope across method indications, validates recognized upstream method results, and performs deterministic arithmetic only over an explicit professionally reviewed reconciliation instruction governed by an external policy registry. The output is an analytical reconciliation indication/range, not a licensed or certified valuation opinion, statistical confidence statement, transaction approval or production authority.',
  });
}

module.exports = {
  C3_VALUATION_RECONCILIATION_GOVERNANCE_VERSION,
  evaluateValuationReconciliation,
};
