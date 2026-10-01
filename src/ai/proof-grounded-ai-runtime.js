'use strict';

const {
  STATUS,
  evaluateProviderReadiness,
  validateGroundedProviderResponse,
  executeGovernedProviderGateway,
} = require('./governed-live-provider-gateway');

const HASH_RE = /^[a-f0-9]{64}$/i;
const freeze = (value) => {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
};

function groundingSourceBindingBlockers(request, groundingManifest) {
  if (!request || !groundingManifest || !Array.isArray(groundingManifest.items)) return ['C23_INTEGRITY_GROUNDING_SOURCE_BINDING_INPUT'];
  const evidence = new Set((request.retrievalItems || []).map((i) => String(i.evidenceHashSha256 || '').toLowerCase()).filter((h) => HASH_RE.test(h)));
  const deterministic = new Set((request.deterministicOutputHashesSha256 || []).map((h) => String(h).toLowerCase()).filter((h) => HASH_RE.test(h)));
  const blockers = [];
  for (const item of groundingManifest.items) {
    if (item.evidenceHashSha256 && !evidence.has(String(item.evidenceHashSha256).toLowerCase())) blockers.push(`C23_EVIDENCE_SOURCE_NOT_BOUND_TO_REQUEST:${item.itemId}`);
    if (item.deterministicOutputHashSha256 && !deterministic.has(String(item.deterministicOutputHashSha256).toLowerCase())) blockers.push(`C23_EVIDENCE_DETERMINISTIC_SOURCE_NOT_BOUND_TO_REQUEST:${item.itemId}`);
  }
  return [...new Set(blockers)].sort();
}

function withSourceBinding(result, blockers) {
  if (!blockers.length) return result;
  return freeze({
    ...result,
    status: blockers.some((b) => b.startsWith('C23_INTEGRITY_')) ? STATUS.HOLD_INTEGRITY : STATUS.HOLD_EVIDENCE,
    providerInvocationReady: false,
    groundedDraftReviewReady: false,
    blockers: [...new Set([...(result.blockers || []), ...blockers])].sort(),
    draft: null,
    claims: null,
    providerCalled: result.providerCalled === true,
    providerResponse: null,
  });
}

function evaluateProofGroundedProviderReadiness(input = {}) {
  const bindings = groundingSourceBindingBlockers(input.request, input.groundingManifest);
  return withSourceBinding(evaluateProviderReadiness(input), bindings);
}

function validateProofGroundedProviderResponse(input = {}) {
  const bindings = groundingSourceBindingBlockers(input.request, input.groundingManifest);
  return withSourceBinding(validateGroundedProviderResponse(input), bindings);
}

async function executeProofGroundedProviderGateway(input = {}) {
  const bindingBlockers = groundingSourceBindingBlockers(input.request, input.groundingManifest);
  if (bindingBlockers.length) {
    const readiness = evaluateProviderReadiness(input);
    return withSourceBinding({ ...readiness, providerCalled: false, providerResponse: null }, bindingBlockers);
  }
  return executeGovernedProviderGateway(input);
}

module.exports = Object.freeze({
  groundingSourceBindingBlockers,
  evaluateProofGroundedProviderReadiness,
  validateProofGroundedProviderResponse,
  executeProofGroundedProviderGateway,
});
