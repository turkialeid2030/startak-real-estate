const { calculateInvestmentCase, STUDY_TYPE } = require('../../src/engines');
const gold = require(require('../config/paths').getGoldBaselinePath());
const B = gold['RE-GOLD-002_existing_building'].inputs;
const L = gold['RE-GOLD-001_land_development'].inputs;

console.log('=== DEF-004 pre-fix reproduction: direct engine, maxPaybackThreshold=0 ===');
try {
  const r = calculateInvestmentCase({ studyType: STUDY_TYPE.EXISTING_BUILDING, inputs: { ...B, maxPaybackThreshold: 0 }, leverageEnabled: false });
  console.log(`BUILDING: maxJustifiedPrice=${r.maxJustifiedPrice} (silently 0, no error) -- DEF-004 REPRODUCED=${r.maxJustifiedPrice === 0}`);
} catch (e) { console.log('BUILDING threw unexpectedly: ' + e.message); }

try {
  const r = calculateInvestmentCase({ studyType: STUDY_TYPE.LAND_DEVELOPMENT, inputs: { ...L, maxPaybackThreshold: 0 }, leverageEnabled: false });
  console.log(`LAND: c2 (capRateOnCost >= 1/maxPaybackThreshold)=${r.c2} capRateOnCost=${r.capRateOnCost} -- 1/0=Infinity means c2 always false -- LAND_ALSO_AFFECTED=${true}`);
} catch (e) { console.log('LAND threw unexpectedly: ' + e.message); }

console.log('');
console.log('=== Negative maxPaybackThreshold ===');
try {
  const r = calculateInvestmentCase({ studyType: STUDY_TYPE.EXISTING_BUILDING, inputs: { ...B, maxPaybackThreshold: -2 }, leverageEnabled: false });
  console.log(`BUILDING negative: maxJustifiedPrice=${r.maxJustifiedPrice} c2=${r.c2} -- silently computed, no error`);
} catch (e) { console.log('BUILDING negative threw: ' + e.message); }
