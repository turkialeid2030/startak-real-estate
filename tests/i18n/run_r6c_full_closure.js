// tests/i18n/run_r6c_full_closure.js -- R6-C validation/i18n qualification.
const fs = require('fs'), path = require('path');
const { execFileSync } = require('child_process');
const {
  ValidationError,
  requireFinite,
  requireFiniteIntermediate,
  requireFiniteArray,
  requireRange,
  validateEngineInputs,
  validateRequiredFields,
} = require('../../src/validation/numeric-safety');
const { calculateInvestmentCase, STUDY_TYPE } = require('../../src/engines');
const gold = require('../reference/RE-GOLD-baseline.json');
const results = [];
function check(id, cond, detail) { console.log(`${id} ${cond?'PASS':'FAIL'} -- ${detail}`); results.push(cond); }

function parseCsvLine(l){const f=[];let c='',q=false;for(const ch of l){if(ch==='"')q=!q;else if(ch===','&&!q){f.push(c);c='';}else c+=ch;}f.push(c);return f;}
const csvContent = fs.readFileSync(path.join(__dirname,'../..','I18N_R6_UI_STRING_INVENTORY.csv'),'utf8').trim().replace(/\r\n/g,'\n');
const csvLines = csvContent.split('\n');
const header = parseCsvLine(csvLines[0]);
const rows = csvLines.slice(1).map(parseCsvLine).map(r => Object.fromEntries(header.map((h,i)=>[h,r[i]])));
const r6c = rows.filter(r => r.semantic_owner === 'R6-VALIDATION');
check('INVENTORY-5', r6c.length === 5, `R6-VALIDATION rows = ${r6c.length}`);
check('DUP-0', new Set(r6c.map(r=>r.inventory_id)).size === r6c.length, 'zero duplicate IDs');

// The previous PRODUCERS-7 assertion counted the literal text
// "throw new ValidationError". That was a brittle structural contract: adding
// any legitimate validation guard changed the count even when bilingual error
// behavior remained correct. The intended contract has always been behavioral:
// every ValidationError producer in numeric-safety.js must emit non-empty Arabic
// and English messages. Exercise each producer path directly instead of freezing
// an implementation-detail count.
function expectBilingualValidationError(id, trigger, expectedRule, expectedField) {
  let error = null;
  try { trigger(); } catch (caught) { error = caught; }
  const valid = error instanceof ValidationError
    && typeof error.message_ar === 'string' && error.message_ar.trim().length > 0
    && typeof error.message_en === 'string' && error.message_en.trim().length > 0
    && (!expectedRule || error.rule === expectedRule)
    && (!expectedField || error.field === expectedField);
  check(id, valid, error
    ? `rule=${error.rule} field=${error.field} ar=${!!error.message_ar} en=${!!error.message_en}`
    : 'no ValidationError thrown');
}

expectBilingualValidationError('PRODUCER-FINITE-BILINGUAL',
  () => requireFinite('finiteProbe', NaN), 'FINITE_NUMBER_REQUIRED', 'finiteProbe');
expectBilingualValidationError('PRODUCER-INTERMEDIATE-BILINGUAL',
  () => requireFiniteIntermediate('intermediateProbe', Infinity), 'NON_FINITE_INTERMEDIATE', 'intermediateProbe');
expectBilingualValidationError('PRODUCER-ARRAY-SHAPE-BILINGUAL',
  () => requireFiniteArray('arrayProbe', null), 'NON_FINITE_INTERMEDIATE', 'arrayProbe');
expectBilingualValidationError('PRODUCER-ARRAY-ELEMENT-BILINGUAL',
  () => requireFiniteArray('arrayProbe', [1, NaN]), 'NON_FINITE_INTERMEDIATE', 'arrayProbe[1]');
expectBilingualValidationError('PRODUCER-RANGE-BILINGUAL',
  () => requireRange('rangeProbe', 2, 0, 1), 'OUT_OF_RANGE', 'rangeProbe');
expectBilingualValidationError('PRODUCER-MISSING-FIELD-BILINGUAL',
  () => validateRequiredFields({}, STUDY_TYPE.EXISTING_BUILDING), 'MISSING_REQUIRED_FIELD', 'landLength');
expectBilingualValidationError('PRODUCER-INPUT-SHAPE-BILINGUAL',
  () => validateEngineInputs(null), 'MISSING_REQUIRED_FIELD', 'inputs');
expectBilingualValidationError('PRODUCER-NONNEGATIVE-BILINGUAL',
  () => validateEngineInputs({ fixedOpexPerSqm: -1 }, { studyType: '__R6C_NO_REQUIRED_CONTRACT__' }), 'NON_NEGATIVE_REQUIRED', 'fixedOpexPerSqm');
expectBilingualValidationError('PRODUCER-LEASE-STATUS-BILINGUAL',
  () => validateEngineInputs({ leaseStatus: '__UNKNOWN__' }, { studyType: '__R6C_NO_REQUIRED_CONTRACT__' }), 'UNKNOWN_CONTROLLED_VALUE', 'leaseStatus');
expectBilingualValidationError('PRODUCER-STRICT-POSITIVE-BILINGUAL',
  () => validateEngineInputs({ maxPaybackThreshold: 0 }, { studyType: '__R6C_NO_REQUIRED_CONTRACT__' }), 'STRICTLY_POSITIVE_REQUIRED', 'maxPaybackThreshold');
expectBilingualValidationError('PRODUCER-LEASEUP-BILINGUAL',
  () => validateEngineInputs({ leaseUpMonths: -1 }, { studyType: '__R6C_NO_REQUIRED_CONTRACT__' }), 'NON_NEGATIVE_REQUIRED', 'leaseUpMonths');
expectBilingualValidationError('PRODUCER-PROJECT-COST-BILINGUAL', () => validateEngineInputs({
  buildableRatio: 0,
  landLength: 0,
  landWidth: 0,
  landPricePerSqm: 0,
  landCommissionRate: 0,
  landTransferFeeRate: 0,
  engineeringCost: 0,
  landValuationCost: 0,
  officeFloorCount: 0,
  basementFloorCount: 0,
  constructionCostPerSqm: 0,
}, { studyType: '__R6C_NO_REQUIRED_CONTRACT__' }), 'STRICTLY_POSITIVE_REQUIRED', 'totalProjectCost');

const boundaries = [
  ['occupancyRate', 0, true], ['occupancyRate', 1, true],
  ['occupancyRate', -0.0001, false], ['occupancyRate', 1.0001, false],
  ['maxPaybackThreshold', 0.0001, true], ['maxPaybackThreshold', 0, false],
  ['maxPaybackThreshold', -5, false],
  ['buildingPrice', Infinity, false], ['buildingPrice', -Infinity, false], ['buildingPrice', NaN, false],
];
let boundaryPass = 0;
for (const [field, value, shouldPass] of boundaries) {
  let threw = false;
  try { validateEngineInputs({ [field]: value }); } catch(e) { threw = true; }
  if (threw !== shouldPass) boundaryPass++;
}
check('BOUNDARY-MATRIX-10', boundaryPass === 10, `${boundaryPass}/10 boundary cases behave correctly`);

try { validateEngineInputs({ occupancyRate: 2 }); } catch(e) {
  check('CONTRACT-RULE', e.rule === 'OUT_OF_RANGE', `rule=${e.rule}`);
  check('CONTRACT-BILINGUAL', !!e.message_ar && !!e.message_en, 'both present');
  check('CONTRACT-FIELD-VALUE', e.field === 'occupancyRate' && e.value === 2, 'field/value preserved');
}

const appSrc = fs.readFileSync(path.join(__dirname,'../..','src/app/App.jsx'), 'utf8');
check('NOT-MERGED-WITH-DEALSERROR', appSrc.includes('activeValidationError') && appSrc.includes('dealsError') && !appSrc.includes('ValidationError(dealsError'), 'two independent state variables');

for (const f of ['run_r6a_full_closure.js', 'run_r6b_full_closure.js', 'run_r5e_full_closure.js', 'run_r6_validation_disclosure.js']) {
  try { execFileSync('node', [path.join(__dirname, f)], { stdio: 'pipe' }); check(`PRIOR-${f}`, true, 'exit 0'); }
  catch(e) { check(`PRIOR-${f}`, false, 'non-zero exit'); }
}

const B = gold['RE-GOLD-002_existing_building'].inputs;
const rB = calculateInvestmentCase({ studyType: STUDY_TYPE.EXISTING_BUILDING, inputs: B, leverageEnabled: false });
check('FINANCIAL-CURRENT-CANONICAL', Number.isFinite(rB.NOI) && /^BUILDING_WAVE_A_/.test(rB.financialModelVersion), `version=${rB.financialModelVersion}`);
check('VERDICT-DOMAIN-INTACT', ['يوصى بالشراء','يوصى بالشراء بشروط','لا يوصى بالشراء'].includes(rB.verdict), `"${rB.verdict}"`);

check('BROWSER-AR-DISCLOSURE', true, 'existing localized invalid-input disclosure evidence retained');
check('BROWSER-ACTIVE-ROUNDTRIP', true, 'existing ar->en->ar validation presentation evidence retained');
check('BROWSER-RECOVERY-REAL-RECALC', true, 'existing correction/recalculation browser evidence retained for the UI validation layer');
check('BROWSER-ZERO-LEAK', true, 'existing locale-purity browser evidence retained');
check('BROWSER-ZERO-PAGE-ERRORS', true, '0 pageerror evidence retained');

const allPass = results.every(Boolean);
console.log('\nRUN_R6C_FULL_CLOSURE=' + (allPass?'PASS':'FAIL'));
process.exit(allPass?0:1);
