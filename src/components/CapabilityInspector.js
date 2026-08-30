// src/components/CapabilityInspector.js -- data-model + minimal presentation
// logic for the Capability Inspector foundation. Does NOT calculate or infer
// status -- every field is read DIRECTLY from capability-registry.json.
const CAPABILITY_REGISTRY = require('../registries/capability-registry.json');

const REQUIRED_FIELDS = ['capability_id','name_ar','name_en','phase','module','requirement_refs','implementation_status','evidence','test_status','limitations'];

/**
 * Returns the exact registry record for a capability, unmodified.
 * NO status conversion of any kind (e.g. FOUNDATION_ONLY is never
 * rewritten to "PASS" or "AVAILABLE" here).
 */
function getCapabilityView(capabilityId) {
  const record = CAPABILITY_REGISTRY.find((c) => c.capability_id === capabilityId);
  if (!record) return null;
  const view = {};
  for (const f of REQUIRED_FIELDS) view[f] = record[f];
  return view; // status field is copied verbatim -- no transformation function exists anywhere in this file
}

function listAllCapabilities() {
  return CAPABILITY_REGISTRY.map((c) => getCapabilityView(c.capability_id));
}

/**
 * Presentation-only helper: whether the capability should currently be
 * usable by an end user. This does NOT alter the displayed status string --
 * it exists only to gate a UI affordance (e.g. show/hide a "try it" button),
 * and is derived from, never overrides, the registry's own status field.
 */
function isCurrentlyUsable(capabilityId) {
  const view = getCapabilityView(capabilityId);
  return view ? view.implementation_status === 'VERIFIED_IMPLEMENTED' : false;
}

module.exports = { getCapabilityView, listAllCapabilities, isCurrentlyUsable, REQUIRED_FIELDS };
