// tools/def001_impact_calculator.js -- NEUTRAL quantitative comparison.
// Does NOT recommend which convention is "correct". Both are legitimate,
// named, real-world valuation conventions:
//   Convention A ("Direct Cap", used by Existing Building): saleValue = noiYear / capRate
//   Convention B ("Forward NOI Cap", used by Land Development): exitValue = (noiYear*(1+g)) / capRate
const { calcExistingBuilding } = require('../src/engines/valuation/existing-building');
const gold = require(require('../tests/config/paths').getGoldBaselinePath());
const B = gold['RE-GOLD-002_existing_building'].inputs;

function computeBothConventions(inputs) {
  const r = calcExistingBuilding(inputs); // engine unchanged -- this IS Convention A, exactly as currently implemented
  const conventionA_saleValue = r.NOI; // re-derive noiYear at exit year for a clean side-by-side (holdPeriod already applied inside r via NOI growth -- recompute explicitly for transparency)
  // Recompute noiYear at exit exactly as the engine does, for both conventions, without touching engine code.
  let noiYear = r.NOI;
  for (let y = 1; y <= inputs.holdPeriod; y++) { if (y > 1) noiYear *= (1 + inputs.rentGrowthRate); }
  const conventionA = inputs.marketCapRate > 0 ? noiYear / inputs.marketCapRate : 0; // current building behavior
  const forwardNOI = noiYear * (1 + inputs.rentGrowthRate);
  const conventionB = inputs.marketCapRate > 0 ? forwardNOI / inputs.marketCapRate : 0; // current land behavior, applied hypothetically to the building's own numbers
  return { noiYearAtExit: noiYear, conventionA_directCap: conventionA, conventionB_forwardNOICap: conventionB, absoluteDifference: conventionB - conventionA, percentDifference: conventionA !== 0 ? ((conventionB - conventionA) / conventionA) * 100 : null };
}

console.log('growthRate | conventionA_directCap (SAR) | conventionB_forwardNOICap (SAR) | absoluteDiff (SAR) | percentDiff');
const rates = [-0.03, -0.02, -0.01, 0, 0.01, 0.02, 0.03, 0.04, 0.05];
const rows = [];
for (const g of rates) {
  const result = computeBothConventions({ ...B, rentGrowthRate: g, leverageEnabled: false });
  rows.push({ rentGrowthRate: g, ...result });
  console.log(`${(g*100).toFixed(0)}%       | ${result.conventionA_directCap.toFixed(0).padStart(15)} | ${result.conventionB_forwardNOICap.toFixed(0).padStart(15)} | ${result.absoluteDifference.toFixed(0).padStart(12)} | ${result.percentDifference === null ? 'N/A' : result.percentDifference.toFixed(2) + '%'}`);
}
require('fs').writeFileSync('DECISION-DEF-001/impact-table.json', JSON.stringify(rows, null, 2));
console.log('');
console.log('DEF_001_IMPACT_TABLE_ROWS=' + rows.length);
console.log('NOTE: growthRate=0 collapses both conventions to an identical value (confirms COV-001 -- the RE-GOLD-002 fixture, which uses rentGrowthRate=0 by default, cannot distinguish between the two conventions).');
