const nav = require('../../src/registries/navigation-registry.json');
const terminology = require('../../src/registries/terminology-registry.json');
const phases = require('../../src/registries/phase-registry.json');
const capabilities = require('../../src/registries/capability-registry.json');
const termIds = new Set(terminology.map(t=>t.term_id));
const phaseIds = new Set(phases.map(p=>p.phase_id));
const capIds = new Set(capabilities.map(c=>c.capability_id));
let dup=0, invPhase=0, invCap=0, missingKey=0, falseImpl=0;
const ids = new Set();
for (const n of nav) {
  if (ids.has(n.nav_id)) dup++; ids.add(n.nav_id);
  if (!phaseIds.has(n.phase)) invPhase++;
  if (n.capability_id && !capIds.has(n.capability_id)) invCap++;
  if (!termIds.has(n.translation_key)) missingKey++;
  if (n.implementation_status === 'VERIFIED_IMPLEMENTED') {
    const cap = capabilities.find(c=>c.capability_id===n.capability_id);
    if (!cap || cap.implementation_status !== 'VERIFIED_IMPLEMENTED') falseImpl++;
  }
}
console.log(`NAVIGATION_ITEMS=${nav.length}`);
console.log(`DUPLICATE_NAV_IDS=${dup}`);
console.log(`INVALID_NAV_PHASE_REFERENCES=${invPhase}`);
console.log(`INVALID_NAV_CAPABILITY_REFERENCES=${invCap}`);
console.log(`MISSING_NAV_TRANSLATION_KEYS=${missingKey}`);
console.log(`FALSE_NAV_IMPLEMENTATION_CLAIMS=${falseImpl}`);
const fakePages = nav.filter(n=>['MAPS','DECISION_ROOM','PORTFOLIO'].includes(n.translation_key) && n.implementation_status==='VERIFIED_IMPLEMENTED').length;
console.log(`FAKE_FUNCTIONAL_PAGES=${fakePages}`);
process.exit(dup===0&&invPhase===0&&invCap===0&&missingKey===0&&falseImpl===0&&fakePages===0?0:1);
