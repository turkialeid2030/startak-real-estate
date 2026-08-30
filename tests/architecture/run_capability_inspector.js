const { getCapabilityView, isCurrentlyUsable } = require('../../src/components/CapabilityInspector');
const registry = require('../../src/registries/capability-registry.json');

const cases = [
  { id: 'CAP-FINANCIAL-ENGINE', expectedStatus: 'VERIFIED_IMPLEMENTED' },
  { id: 'CAP-INVESTMENT-CASE', expectedStatus: 'FOUNDATION_ONLY' },
  { id: 'CAP-GEO', expectedStatus: 'NOT_IMPLEMENTED' },
];

let mismatches = 0, availabilityFabrications = 0;
for (const c of cases) {
  const registryRecord = registry.find((r) => r.capability_id === c.id);
  const view = getCapabilityView(c.id);
  const statusMatch = view.implementation_status === registryRecord.implementation_status;
  if (view.implementation_status !== c.expectedStatus) mismatches++;
  if (!statusMatch) mismatches++;
  // FALSE_INSPECTOR_AVAILABILITY_CLAIMS: a NOT_IMPLEMENTED/FOUNDATION_ONLY capability must never report usable=true
  if (view.implementation_status !== 'VERIFIED_IMPLEMENTED' && isCurrentlyUsable(c.id)) availabilityFabrications++;
  console.log(`${c.id}: registry=${registryRecord.implementation_status} inspector=${view.implementation_status} match=${statusMatch} usable=${isCurrentlyUsable(c.id)}`);
}

console.log('');
console.log(`CAPABILITY_INSPECTOR_CASES=${cases.length}`);
console.log(`CAPABILITY_STATUS_MISMATCHES=${mismatches}`);
console.log(`FALSE_INSPECTOR_AVAILABILITY_CLAIMS=${availabilityFabrications}`);
process.exit(mismatches === 0 && availabilityFabrications === 0 ? 0 : 1);
