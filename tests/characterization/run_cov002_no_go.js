'use strict';

const { calculateInvestmentCase, STUDY_TYPE } = require('../../src/engines');
const { validateEngineInputs } = require('../../src/validation/numeric-safety');
const gold = require('../reference/RE-GOLD-baseline.json');
const results = [];
function check(id, cond, detail) { console.log(`${id} ${cond ? 'PASS' : 'FAIL'} -- ${detail}`); results.push(cond); }

const { tierVerdict } = require('../../src/engines/recommendation');
check('CANONICAL-PATH-SINGLE', typeof tierVerdict === 'function', 'single tierVerdict function');

const B = { ...gold['RE-GOLD-002_existing_building'].inputs };
B.buildingPrice *= 5;
let buildingValidationThrew = false;
try { validateEngineInputs(B); } catch (e) { buildingValidationThrew = true; }
check('BUILDING-VALID-DOMAIN', !buildingValidationThrew, 'inflated positive price remains a valid numeric domain');
const rB = calculateInvestmentCase({ studyType: STUDY_TYPE.EXISTING_BUILDING, inputs: B, leverageEnabled: false });
check('BUILDING-NOGO-REACHABLE', rB.verdict === 'لا يوصى بالشراء', `verdict=${rB.verdict}`);
check('BUILDING-HARD-GATE-EVIDENCE', rB.decisionStatus === 'HARD_GATE_FAILED' && rB.failedHardGates.length > 0,
  `decisionStatus=${rB.decisionStatus} hard=${rB.failedHardGates.join('|')}`);
check('BUILDING-FINITE-CORE', Number.isFinite(rB.NOI) && Number.isFinite(rB.marketValueByIncomeCap), `NOI=${rB.NOI}`);

const L = { ...gold['RE-GOLD-001_land_development'].inputs };
L.landPricePerSqm *= 5;
let landValidationThrew = false;
try { validateEngineInputs(L); } catch (e) { landValidationThrew = true; }
check('LAND-VALID-DOMAIN', !landValidationThrew, 'inflated positive land price remains a valid numeric domain');
const rL = calculateInvestmentCase({ studyType: STUDY_TYPE.LAND_DEVELOPMENT, inputs: L, leverageEnabled: false });
check('LAND-NOGO-REACHABLE', rL.verdict === 'لا يوصى بالشراء', `verdict=${rL.verdict}`);
check('LAND-HARD-GATE-EVIDENCE', rL.decisionStatus === 'HARD_GATE_FAILED' && rL.failedHardGates.length > 0,
  `decisionStatus=${rL.decisionStatus} hard=${rL.failedHardGates.join('|')}`);
check('LAND-FINITE-CORE', Number.isFinite(rL.stabilizedNOI) && Number.isFinite(rL.marketValueAfterCompletion), `NOI=${rL.stabilizedNOI}`);

const rBBase = calculateInvestmentCase({ studyType: STUDY_TYPE.EXISTING_BUILDING, inputs: gold['RE-GOLD-002_existing_building'].inputs, leverageEnabled: false });
const rLBase = calculateInvestmentCase({ studyType: STUDY_TYPE.LAND_DEVELOPMENT, inputs: gold['RE-GOLD-001_land_development'].inputs, leverageEnabled: false });
check('BASELINES-MIGRATED-TO-V2', /^BUILDING_WAVE_A_/.test(rBBase.financialModelVersion) && /^LAND_WAVE_A_/.test(rLBase.financialModelVersion),
  `${rBBase.financialModelVersion}, ${rLBase.financialModelVersion}`);

let bDet = true, lDet = true;
for (let i = 0; i < 10; i += 1) {
  const b = calculateInvestmentCase({ studyType: STUDY_TYPE.EXISTING_BUILDING, inputs: B, leverageEnabled: false });
  const l = calculateInvestmentCase({ studyType: STUDY_TYPE.LAND_DEVELOPMENT, inputs: L, leverageEnabled: false });
  if (JSON.stringify(b) !== JSON.stringify(rB)) bDet = false;
  if (JSON.stringify(l) !== JSON.stringify(rL)) lDet = false;
}
check('BUILDING-DETERMINISTIC', bDet, '10/10 repetitions identical');
check('LAND-DETERMINISTIC', lDet, '10/10 repetitions identical');

const allPass = results.every(Boolean);
console.log(`\nRUN_COV002_NO_GO=${allPass ? 'PASS' : 'FAIL'}`);
process.exit(allPass ? 0 : 1);
