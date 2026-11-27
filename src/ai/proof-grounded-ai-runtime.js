'use strict';

const {
  STATUS,
  evaluateProviderReadiness,
  validateGroundedProviderResponse,
  executeGovernedProviderGateway,
} = require('./governed-live-provider-gateway');

const {isPlainJson}=require('../validation/plain-json-boundary');
const HASH_RE = /^[a-f0-9]{64}$/i;
const freeze = (value) => {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
};

function groundingSourceBindingBlockers(request, groundingManifest) {
  const validObject=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
  if (!validObject(request)||!validObject(groundingManifest)||!isPlainJson(request)||!isPlainJson(groundingManifest)||
      !Array.isArray(groundingManifest.items)||!Array.isArray(request.retrievalItems)||
      !Array.isArray(request.deterministicOutputHashesSha256)||
      request.retrievalItems.some(i=>!validObject(i)||typeof i.evidenceHashSha256!=='string'||!HASH_RE.test(i.evidenceHashSha256))||
      request.deterministicOutputHashesSha256.some(h=>typeof h!=='string'||!HASH_RE.test(h))||
      groundingManifest.items.some(i=>!validObject(i)||typeof i.itemId!=='string'))
    return ['C23_INTEGRITY_GROUNDING_SOURCE_BINDING_INPUT'];
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
    status: blockers.some((b) => b.startsWith('C23_INTEGRITY_')) ? STATUS.HOLD_INTEGRITY : result.status.startsWith('HOLD_') ? result.status : STATUS.HOLD_EVIDENCE,
    providerInvocationReady: false,
    groundedDraftReviewReady: false,
    blockers: [...new Set([...(result.blockers || []), ...blockers])].sort(),
    draft: null,
    claims: null,
    providerCalled: result.providerCalled === true,
    providerResponse: null,
  });
}

// Read only own data descriptors. A getter or inherited request cannot
// participate in a proof check. Capture once before any adapter invocation.
function snapshotProofPacket(input,includeResponse=false,includeAdapter=false){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('PROOF_INPUT_INVALID');
 const packet={};
 for(const key of ['modelProfile','request','groundingManifest','providerAuthorization','invocation','asOf',...(includeResponse?['providerResponse']:[])]){
  const d=Object.getOwnPropertyDescriptor(input,key);
  if(!d||!Object.hasOwn(d,'value')||!isPlainJson(d.value))throw Error('PROOF_INPUT_INVALID');
  packet[key]=structuredClone(d.value);
 }
 if(includeAdapter){const d=Object.getOwnPropertyDescriptor(input,'adapter');if(d&&!Object.hasOwn(d,'value'))throw Error('PROOF_INPUT_INVALID');packet.adapter=d?.value;}
 return packet;
}
function malformedProof(){return Object.freeze({status:STATUS.HOLD_INTEGRITY,providerInvocationReady:false,groundedDraftReviewReady:false,blockers:Object.freeze(['C23_INTEGRITY_PROOF_PACKET_SNAPSHOT']),providerCalled:false,providerResponse:null,draft:null,claims:null,productionDeploymentAuthorized:false,publicAiAuthorized:false,transactionAuthorized:false,approvalAuthorized:false,commercialGoLive:'HOLD'});}
function evaluateProofGroundedProviderReadiness(input = {}) {
  try{input=snapshotProofPacket(input);}catch{return malformedProof();}
  const bindings = groundingSourceBindingBlockers(input.request, input.groundingManifest);
  return withSourceBinding(evaluateProviderReadiness(input), bindings);
}

function validateProofGroundedProviderResponse(input = {}) {
  try{input=snapshotProofPacket(input,true);}catch{return malformedProof();}
  const bindings = groundingSourceBindingBlockers(input.request, input.groundingManifest);
  return withSourceBinding(validateGroundedProviderResponse(input), bindings);
}

async function executeProofGroundedProviderGateway(input = {}) {
  try{input=snapshotProofPacket(input,false,true);}catch{return malformedProof();}
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
