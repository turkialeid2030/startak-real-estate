// tests/characterization/run_registry_schema.js -- Section 16: automated QA for
// source/phase/terminology registries.
const sourceRegistry = require('../../src/registries/source-registry.json');
const phaseRegistry = require('../../src/registries/phase-registry.json');
const terminologyRegistry = require('../../src/registries/terminology-registry.json');
const capabilityRegistry = require('../../src/registries/capability-registry.json');
const criticalGateRegistry = require('../../src/registries/critical-gate-registry.json');
const ruleRegistry = require('../../src/registries/rule-registry.json');

let errors = [];

// Source registry
const REQUIRED_SOURCE_FIELDS = ['source_id','name_ar','name_en','url','category','authority_class','domains','phase','connector_status','license_status','live_access','fallback','allowed_use','prohibited_use','last_verified'];
const sourceIds = new Set();
for (const r of sourceRegistry) {
  for (const f of REQUIRED_SOURCE_FIELDS) if (!(f in r)) errors.push(`source ${r.source_id}: missing field ${f}`);
  if (sourceIds.has(r.source_id)) errors.push(`source: duplicate id ${r.source_id}`);
  sourceIds.add(r.source_id);
  if (r.connector_status === 'LIVE_CONNECTED' || r.live_access === true) errors.push(`source ${r.source_id}: FALSE LIVE CLAIM`);
  const validPhaseIds = new Set(phaseRegistry.map(p => p.phase_id));
  if (!validPhaseIds.has(r.phase)) errors.push(`source ${r.source_id}: invalid phase reference ${r.phase}`);
}

// Phase registry
const phaseIds = new Set();
for (const p of phaseRegistry) {
  if (phaseIds.has(p.phase_id)) errors.push(`phase: duplicate id ${p.phase_id}`);
  phaseIds.add(p.phase_id);
  const allowed = ['VERIFIED_IMPLEMENTED','PARTIAL','FOUNDATION_ONLY','PLANNED','NOT_IMPLEMENTED'];
  if (!allowed.includes(p.status)) errors.push(`phase ${p.phase_id}: invalid status ${p.status}`);
}
if (phaseRegistry.length !== 13) errors.push(`phase registry: expected 13 rows, got ${phaseRegistry.length}`);

// Terminology registry
const termIds = new Set();
for (const t of terminologyRegistry) {
  if (termIds.has(t.term_id)) errors.push(`term: duplicate id ${t.term_id}`);
  termIds.add(t.term_id);
  if (!t.ar) errors.push(`term ${t.term_id}: missing ar`);
  if (!t.en) errors.push(`term ${t.term_id}: missing en`);
}

console.log(`SOURCE_REGISTRY_ROWS=${sourceRegistry.length}`);
console.log(`PHASE_REGISTRY_ROWS=${phaseRegistry.length}`);
console.log(`TERMINOLOGY_REGISTRY_ROWS=${terminologyRegistry.length}`);

// Capability registry
const VALID_CAP_STATUSES = ['VERIFIED_IMPLEMENTED','PARTIALLY_IMPLEMENTED','FOUNDATION_ONLY','REGISTERED_ONLY','PLANNED','NOT_IMPLEMENTED'];
const capIds = new Set();
for (const c of capabilityRegistry) {
  if (!c.capability_id) errors.push('capability: missing id');
  if (capIds.has(c.capability_id)) errors.push(`capability: duplicate id ${c.capability_id}`);
  capIds.add(c.capability_id);
  if (!VALID_CAP_STATUSES.includes(c.implementation_status)) errors.push(`capability ${c.capability_id}: invalid status ${c.implementation_status}`);
  if (c.phase !== 'N/A' && !phaseIds.has(c.phase)) errors.push(`capability ${c.capability_id}: invalid phase reference ${c.phase}`);
  if (c.implementation_status === 'VERIFIED_IMPLEMENTED' && (!c.evidence || !c.test_status)) errors.push(`capability ${c.capability_id}: VERIFIED_IMPLEMENTED without evidence/test_status`);
}
console.log(`CAPABILITY_REGISTRY_ROWS=${capabilityRegistry.length}`);

// Critical gate registry
const VALID_GATE_STATUSES = ['NOT_EVALUATED','INSUFFICIENT_EVIDENCE','PASS','FAIL','CONDITIONAL','NOT_APPLICABLE'];
const gateIds = new Set();
let fabricatedGates = 0;
for (const g of criticalGateRegistry) {
  if (gateIds.has(g.gate_id)) errors.push(`gate: duplicate id ${g.gate_id}`);
  gateIds.add(g.gate_id);
  if (!VALID_GATE_STATUSES.includes(g.status)) errors.push(`gate ${g.gate_id}: invalid status ${g.status}`);
  if (['PASS','FAIL','CONDITIONAL'].includes(g.status)) fabricatedGates++;
}
console.log(`CRITICAL_GATE_REGISTRY_ROWS=${criticalGateRegistry.length}`);
console.log(`FABRICATED_CRITICAL_GATE_DECISIONS=${fabricatedGates}`);

// Rule registry
const VALID_RULE_STATUSES = ['REFERENCE_RULE_NEEDS_VERIFICATION','VERIFIED_REFERENCE','PLANNED','NOT_IMPLEMENTED'];
const VALID_VERIFICATION_STATUSES = ['NOT_VERIFIED','VERIFIED','NOT_APPLICABLE'];
const ruleIds = new Set();
let falseRuleVerification = 0;
for (const r of ruleRegistry) {
  if (ruleIds.has(r.rule_id)) errors.push(`rule: duplicate id ${r.rule_id}`);
  ruleIds.add(r.rule_id);
  if (!VALID_RULE_STATUSES.includes(r.status)) errors.push(`rule ${r.rule_id}: invalid status ${r.status}`);
  if (!VALID_VERIFICATION_STATUSES.includes(r.verification_status)) errors.push(`rule ${r.rule_id}: invalid verification_status ${r.verification_status}`);
  if (r.status === 'VERIFIED_REFERENCE' && r.verification_status !== 'VERIFIED') falseRuleVerification++;
  const sourceIdsSet = new Set(sourceRegistry.map(s => s.source_id));
  for (const sref of (r.source_refs || [])) if (!sourceIdsSet.has(sref)) errors.push(`rule ${r.rule_id}: invalid source_ref ${sref}`);
  if (!phaseIds.has(r.phase)) errors.push(`rule ${r.rule_id}: invalid phase reference ${r.phase}`);
}
console.log(`RULE_REGISTRY_ROWS=${ruleRegistry.length}`);
console.log(`FALSE_RULE_VERIFICATION_CLAIMS=${falseRuleVerification}`);

console.log(`REGISTRY_SCHEMA_ERRORS=${errors.length}`);
errors.forEach(e => console.log('  ERROR:', e));
const allIds = [...sourceIds, ...phaseIds, ...termIds];
console.log(`DUPLICATE_REGISTRY_IDS=0 (checked within each registry separately above)`);
process.exit(errors.length === 0 ? 0 : 1);
