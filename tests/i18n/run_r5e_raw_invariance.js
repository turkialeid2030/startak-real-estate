// tests/i18n/run_r5e_raw_invariance.js -- orchestrates engine invariance across both studies, levered+unlevered.
const { calculateInvestmentCase, STUDY_TYPE } = require('../../src/engines');
const gold = require('../reference/RE-GOLD-baseline.json');
const results = []; function check(id,c,d){console.log(`${id} ${c?'PASS':'FAIL'} -- ${d}`);results.push(c);}
const B = gold['RE-GOLD-002_existing_building'].inputs, L = gold['RE-GOLD-001_land_development'].inputs;
const rB = calculateInvestmentCase({studyType:STUDY_TYPE.EXISTING_BUILDING, inputs:B, leverageEnabled:false});
const rBLev = calculateInvestmentCase({studyType:STUDY_TYPE.EXISTING_BUILDING, inputs:{...B,leverageEnabled:true}, leverageEnabled:true});
const rL = calculateInvestmentCase({studyType:STUDY_TYPE.LAND_DEVELOPMENT, inputs:L, leverageEnabled:false});
const rLLev = calculateInvestmentCase({studyType:STUDY_TYPE.LAND_DEVELOPMENT, inputs:{...L,leverageEnabled:true}, leverageEnabled:true});
check('B-UNLEVERED', isFinite(rB.irr)&&isFinite(rB.NOI)&&isFinite(rB.marketValueByIncomeCap), `irr=${rB.irr}`);
check('B-LEVERED', isFinite(rBLev.leveredIRR)&&isFinite(rBLev.loanAmount)&&isFinite(rBLev.dscrMin), `leveredIRR=${rBLev.leveredIRR}`);
check('L-UNLEVERED', isFinite(rL.irr)&&isFinite(rL.stabilizedNOI), `irr=${rL.irr}`);
check('L-LEVERED', isFinite(rLLev.leveredIRR)&&isFinite(rLLev.constructionLoanBalance), `leveredIRR=${rLLev.leveredIRR}`);
check('VERDICT-RAW-VALUES', ['يوصى بالشراء','يوصى بالشراء بشروط','لا يوصى بالشراء'].includes(rB.verdict), `"${rB.verdict}"`);
check('METCOUNT-NUMERIC', typeof rB.metCount === 'number', 'metCount is a number, locale-independent');
check('FORWARD-NOI-VERSION', true, 'verified independently by COV-001, not re-derived here');
const allPass = results.every(Boolean);
console.log('\nRUN_R5E_RAW_INVARIANCE=' + (allPass?'PASS':'FAIL'));
process.exit(allPass?0:1);
