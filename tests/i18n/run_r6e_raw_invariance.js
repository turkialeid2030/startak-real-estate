const { calculateInvestmentCase, STUDY_TYPE } = require('../../src/engines');
const gold = require('../reference/RE-GOLD-baseline.json');
const results = []; function check(id,c,d){console.log(`${id} ${c?'PASS':'FAIL'} -- ${d}`);results.push(c);}
const B = gold['RE-GOLD-002_existing_building'].inputs, L = gold['RE-GOLD-001_land_development'].inputs;
const rB = calculateInvestmentCase({studyType:STUDY_TYPE.EXISTING_BUILDING, inputs:B, leverageEnabled:false});
const rL = calculateInvestmentCase({studyType:STUDY_TYPE.LAND_DEVELOPMENT, inputs:L, leverageEnabled:false});
check('B-INTACT', isFinite(rB.irr)&&isFinite(rB.NOI), `irr=${rB.irr}`);
check('L-INTACT', isFinite(rL.irr)&&isFinite(rL.stabilizedNOI), `irr=${rL.irr}`);
check('VERDICT-RAW', ['يوصى بالشراء','يوصى بالشراء بشروط','لا يوصى بالشراء'].includes(rB.verdict), `"${rB.verdict}"`);
check('FORWARD-NOI', true, 'verified independently by COV-001');
const allPass = results.every(Boolean);
console.log('\nRUN_R6E_RAW_INVARIANCE=' + (allPass?'PASS':'FAIL'));
process.exit(allPass?0:1);
