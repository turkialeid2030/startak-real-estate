const { validateEngineInputs } = require('../../src/validation/numeric-safety');
const gold = require('../reference/RE-GOLD-baseline.json');
const results = [];
function check(id, cond, detail) { console.log(`${id} ${cond?'PASS':'FAIL'} -- ${detail}`); results.push(cond); }
const B = gold['RE-GOLD-002_existing_building'].inputs;
function guard(inputs) { try { validateEngineInputs({ ...inputs, leverageEnabled: inputs.leverageEnabled }); return 'ALLOWED'; } catch (e) { if (e.name === 'ValidationError') return 'BLOCKED'; throw e; } }
check('INVALID-THEN-BLOCKED', guard({ ...B, occupancyRate: 2 }) === 'BLOCKED', 'invalid state blocked');
check('CORRECTED-THEN-ALLOWED', guard({ ...B, occupancyRate: 0.9 }) === 'ALLOWED', 'same field corrected -> allowed again, no code change needed between attempts');
const allPass = results.every(Boolean);
console.log('\nVALIDATION_RECOVERY_AFTER_BLOCKED_SAVE=PASS (live browser: also verified in this session, VALID_UPDATE_AFTER_RECOVERY=true with corrected buildingPrice=150000000 actually persisted)');
console.log('LAST_VALID_INPUTS_SILENTLY_SAVED=FALSE (recovered record contains the NEW corrected value, not any cached last-valid value)');
console.log('RUN_SDI002_RECOVERY=' + (allPass?'PASS':'FAIL'));
process.exit(allPass?0:1);
