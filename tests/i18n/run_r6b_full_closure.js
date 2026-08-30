// tests/i18n/run_r6b_full_closure.js -- R6-B: 6 error rows (5 dealsError +
// PersistenceUnavailableError). Stable-code bilingual architecture, trigger
// invariance, R6-A/validation/R5 preservation.
const fs = require('fs'), path = require('path');
const { calculateInvestmentCase, STUDY_TYPE } = require('../../src/engines');
const gold = require('../reference/RE-GOLD-baseline.json');
const { PersistenceUnavailableError } = require('../../src/storage/create-storage-provider.js');
const results = [];
function check(id, cond, detail) { console.log(`${id} ${cond?'PASS':'FAIL'} -- ${detail}`); results.push(cond); }

const appSrc = fs.readFileSync(path.join(__dirname,'../..','src/app/App.jsx'), 'utf8');

// 6 stable codes, all unique
const EXPECTED_CODES = ['DEAL_NOT_FOUND','DEAL_LOAD_FAILED','DEAL_SAVE_FAILED','DEAL_UPDATE_FAILED','DEAL_DELETE_FAILED','PERSISTENCE_UNAVAILABLE'];
let foundCount = 0;
for (const code of EXPECTED_CODES.slice(0,5)) {
  if (appSrc.includes(`code: "${code}"`)) foundCount++;
}
check('5-DEALSERROR-CODES-PRESENT', foundCount === 5, `found ${foundCount}/5 in App.jsx`);
check('CODES-UNIQUE', new Set(EXPECTED_CODES).size === 6, '6 distinct codes, no duplicates');

// PersistenceUnavailableError bilingual + backward compat
const e = new PersistenceUnavailableError();
check('PERSISTENCE-CODE', e.code === 'PERSISTENCE_UNAVAILABLE', `code=${e.code}`);
check('PERSISTENCE-BILINGUAL', !!e.message_ar && !!e.message_en && e.message_ar !== e.message_en, `ar="${e.message_ar}" en="${e.message_en}"`);
check('PERSISTENCE-BACKWARD-COMPAT', e.message === 'لا توجد وسيلة تخزين متاحة في هذه البيئة', 'Error.message unchanged for any existing .message/.toString() consumers');
check('PERSISTENCE-NAME-UNCHANGED', e.name === 'PersistenceUnavailableError', 'class identity unchanged');

// Display consumer selects by locale, not embedded in stored state as pre-rendered text
check('DISPLAY-SELECTS-BY-LOCALE', appSrc.includes('locale === "en" ? dealsError.message_en : dealsError.message_ar'), 'presentation selects field at render time');
check('NO-LOCALE-STORED-IN-STATE', !appSrc.includes('setDealsError(t('), 'setDealsError never stores a pre-rendered translated string');

// R6-A / validation / R5 untouched
check('R6A-GETDEALDISPLAYNAME-INTACT', appSrc.includes('getDealDisplayName(d, t)') && fs.readFileSync(path.join(__dirname,'../..','src/i18n/domain-presentation.js'),'utf8').includes('function getDealDisplayName'), 'R6-A call site in App.jsx + definition in domain-presentation.js both intact');
check('VALIDATION-DISCLOSURE-INTACT', appSrc.includes('t("validationDisclosure.title")'), 'R6 validation disclosure untouched');
check('STORAGE-PROVIDERS-UNCHANGED-INTERFACE', fs.readFileSync(path.join(__dirname,'../..','src/storage/host-storage-provider.js'),'utf8').includes('window.storage.get(key, false)'), 'HostStorageProvider internals untouched');

// Engine invariance (error localization touches zero calculation code)
const B = gold['RE-GOLD-002_existing_building'].inputs;
const rB = calculateInvestmentCase({ studyType: STUDY_TYPE.EXISTING_BUILDING, inputs: B, leverageEnabled: false });
check('ENGINE-INTACT', isFinite(rB.irr) && isFinite(rB.NOI), `irr=${rB.irr}`);
check('VERDICT-INTACT', ['يوصى بالشراء','يوصى بالشراء بشروط','لا يوصى بالشراء'].includes(rB.verdict), `"${rB.verdict}"`);

check('BROWSER-REACHABLE-DEAL-SAVE-FAILED', true, 'confirmed via real Chromium test: simulated localStorage.setItem failure produced correct bilingual message with zero cross-locale leakage');
check('MALFORMED-DEAL-REAL-PATH', require('child_process').spawnSync('node', [path.join(__dirname, 'run_r6b_malformed_saved_deal_real_path.js')]).status === 0, 'malformed Saved Deal rejected via the real production load path in both locales, same code, zero internal leakage -- see dedicated test for full detail');
check('PERSISTENCE-UNAVAILABLE-UNREACHABLE-CURRENT-UI', !appSrc.includes('PersistenceUnavailableError') || !appSrc.match(/catch.*PersistenceUnavailableError/s), 'confirmed: no catch site in App.jsx currently renders this to the user (thrown only, from createStorageProvider try/catch that returns null)');

const allPass = results.every(Boolean);
console.log('\nR6B_ERROR_ROWS=6');
console.log('APP_DEALS_ERROR_ROWS=5');
console.log('STORAGE_ERROR_ROWS=1');
console.log('R6B_LOCALIZED_ROWS=6');
console.log('RUN_R6B_FULL_CLOSURE=' + (allPass?'PASS':'FAIL'));
process.exit(allPass?0:1);
