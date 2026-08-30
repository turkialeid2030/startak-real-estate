const { calculateInvestmentCase, STUDY_TYPE } = require('../../src/engines');
const gold = require(require('../config/paths').getGoldBaselinePath());
const B = gold['RE-GOLD-002_existing_building'].inputs;

let allPass = true;
function check(id, cond, detail) { console.log(`${id} ${cond ? 'REPRODUCED' : 'NOT_REPRODUCED'} -- ${detail}`); if (!cond) allPass = false; }

// DEF-002 reproduction
try {
  const r150 = calculateInvestmentCase({ studyType: STUDY_TYPE.EXISTING_BUILDING, inputs: { ...B, occupancyRate: 1.5 }, leverageEnabled: false });
  check('DEF-002', Number.isFinite(r150.grossRentalIncome) && r150.verdict === 'يوصى بالشراء', `occupancy=150% silently accepted, verdict=${r150.verdict}`);
} catch (e) { check('DEF-002', false, 'unexpectedly threw: ' + e.message); }

// DEF-003 reproduction
try {
  const rInf = calculateInvestmentCase({ studyType: STUDY_TYPE.EXISTING_BUILDING, inputs: { ...B, rentPerSqm: Infinity }, leverageEnabled: false });
  const nanFields = Object.entries(rInf).filter(([k, v]) => typeof v === 'number' && !Number.isFinite(v)).length;
  check('DEF-003', nanFields > 0 && typeof rInf.verdict === 'string', `Infinity silently propagated into ${nanFields} fields, verdict still rendered: "${rInf.verdict}"`);
} catch (e) { check('DEF-003', false, 'unexpectedly threw: ' + e.message); }

console.log('');
console.log('DEF_002_PRE_FIX_REPRODUCED=' + allPass);
console.log('DEF_003_PRE_FIX_REPRODUCED=' + allPass);
process.exit(0);
