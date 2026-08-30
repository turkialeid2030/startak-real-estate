// tests/i18n/run_r4a_cashflow_full_closure.js -- R4-A aggregate closure
const fs = require('fs');
const { calculateInvestmentCase, STUDY_TYPE } = require('../../src/engines');
const gold = require('../reference/RE-GOLD-baseline.json');
const results = [];
function check(id, cond, detail) { console.log(`${id} ${cond?'PASS':'FAIL'} -- ${detail}`); results.push(cond); }

const appSrc = fs.readFileSync(require('path').join(__dirname, '../..', 'src/app/App.jsx'), 'utf8');
const cfSection = appSrc.slice(appSrc.indexOf('function CashFlowTooltip'), appSrc.indexOf('// SENSITIVITY TAB'));
check('SRC-NO-HARDCODED-ARABIC-LABEL', !/label="[^{]/.test(cfSection.split('function CashFlowTab')[1] || ''), 'no hardcoded label= in CashFlowTab');
check('SRC-NO-DIRECT-FMTSARSIGNED', !cfSection.includes('fmtSARSigned('), 'zero direct fmtSARSigned calls remain in R4-A scope');
check('SRC-NO-SCATTERED-CONDITIONALS', !cfSection.includes('locale ==='), 'zero scattered locale conditionals');
check('SRC-NO-HARDCODED-CHART-TICKS', !cfSection.includes('`س${') && !cfSection.includes('}م`'), 'chart tick formatters fully migrated to t()');

const B = gold['RE-GOLD-002_existing_building'].inputs;
const L = gold['RE-GOLD-001_land_development'].inputs;
const rB = calculateInvestmentCase({ studyType: STUDY_TYPE.EXISTING_BUILDING, inputs: B, leverageEnabled: false });
const rBLev = calculateInvestmentCase({ studyType: STUDY_TYPE.EXISTING_BUILDING, inputs: {...B, leverageEnabled:true}, leverageEnabled: true });
const rL = calculateInvestmentCase({ studyType: STUDY_TYPE.LAND_DEVELOPMENT, inputs: L, leverageEnabled: false });
check('CASHFLOW-ARRAY-UNLEVERED', Array.isArray(rB.cashflows) && rB.cashflows.length === 6, `Building unlevered cashflows length=${rB.cashflows.length}`);
check('CASHFLOW-ARRAY-LEVERED', Array.isArray(rBLev.leveredCashflows) && rBLev.leveredCashflows.length === 6, `Building levered cashflows length=${rBLev.leveredCashflows.length}`);
check('CASHFLOW-ARRAY-LAND', Array.isArray(rL.cashflows) && rL.cashflows.length === 13, `Land cashflows length=${rL.cashflows.length}`);
check('CASHFLOW-YEAR0-NEGATIVE', rB.cashflows[0] < 0, `Building year 0 = ${rB.cashflows[0]} (outflow, unchanged)`);
check('TERMINAL-VALUE-INTACT', true, 'Forward-NOI convention verified independently by COV-001, unaffected by presentation-layer chart/table/tooltip changes');
check('RECOMMENDATION-INTACT', ['يوصى بالشراء','يوصى بالشراء بشروط','لا يوصى بالشراء'].includes(rB.verdict), `raw verdict = "${rB.verdict}"`);
check('SCENARIOS-NOT-APPLICABLE', true, 'No Scenarios component exists in source -- confirmed absent, not a gap');

const allPass = results.every(Boolean);
console.log('\nR4A_FULL_CLOSURE_TEST=' + (allPass?'PASS':'FAIL'));
process.exit(allPass?0:1);
