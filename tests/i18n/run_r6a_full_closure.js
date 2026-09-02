// tests/i18n/run_r6a_full_closure.js -- R6-A: Saved Deals presentation (14
// rows). Default-name policy proof, dictionary parity, schema freeze,
// user-content non-mutation, R5/R6-validation preservation.
const fs = require('fs'), path = require('path');
const { getDealDisplayName } = require('../../src/i18n/domain-presentation.js');
const arSA = require('../../src/i18n/locales/ar-SA.js');
const en = require('../../src/i18n/locales/en.js');
function tFactory(dict) { return p => p.split('.').reduce((o,k)=>o?.[k],dict) ?? p; }
const tAr = tFactory(arSA), tEn = tFactory(en);
const results = [];
function check(id, cond, detail) { console.log(`${id} ${cond?'PASS':'FAIL'} -- ${detail}`); results.push(cond); }

check('DICT-21-KEYS', Object.keys(arSA.savedDeals).length===21 && Object.keys(en.savedDeals).length===21, `ar=${Object.keys(arSA.savedDeals).length} en=${Object.keys(en.savedDeals).length} (was 14 through R6-A; PR-12 added 7 keys for Export/Import Backup -- intentional, later-authorized increase, not a regression)`);
check('DICT-PARITY', JSON.stringify(Object.keys(arSA.savedDeals).sort())===JSON.stringify(Object.keys(en.savedDeals).sort()), 'exact key match');

// Default name policy: CASE A confirmed and implemented
check('DEFAULT-NAME-SYSTEM-LABEL-AR', getDealDisplayName({name:'صفقة'}, tAr) === 'صفقة', 'raw literal displays unchanged in ar (same string)');
check('DEFAULT-NAME-SYSTEM-LABEL-EN', getDealDisplayName({name:'صفقة'}, tEn) === 'Deal', 'raw literal maps to "Deal" in en');
check('USER-NAME-PASSTHROUGH-AR', getDealDisplayName({name:'مشروعي الخاص'}, tAr) === 'مشروعي الخاص', 'real user content unchanged');
check('USER-NAME-PASSTHROUGH-EN', getDealDisplayName({name:'مشروعي الخاص'}, tEn) === 'مشروعي الخاص', 'real user content NOT translated even in en mode -- critical: user content must never be translated');
check('USER-NAME-ENGLISH-PASSTHROUGH', getDealDisplayName({name:'My Project'}, tAr) === 'My Project', 'user content in any script passes through unchanged');

// Schema preservation proof. RIAI-01P intentionally wraps the original five
// fields and may append one validated optional operatingCase for Building.
const appSrc = fs.readFileSync(path.join(__dirname,'../..','src/app/App.jsx'), 'utf8');
check('SCHEMA-CORE-PRESERVED-WITH-OPTIONAL-RIAI', appSrc.includes('recordWithOperatingCase({ id, name, mode, inputs, savedAt: new Date().toISOString() })'), 'original five raw fields preserved; optional validated operatingCase is non-translatable and Building-only');
check('SCHEMA-UPDATE-UNCHANGED', appSrc.includes('name: existing ? existing.name : "صفقة"'), 'update-active record shape byte-identical -- raw persisted literal "صفقة" untouched, only DISPLAY wrapped via getDealDisplayName');
check('DNAME-CALL-SITE-USES-DISPLAY-FN', appSrc.includes('getDealDisplayName(d, t)'), 'list rendering uses the presentation function, not raw d.name directly');

// R6-B freeze: dealsError untouched
check('R6B-DEALSERROR-NOW-STRUCTURED', appSrc.includes('code: "DEAL_SAVE_FAILED"'), 'dealsError producers now use stable-code bilingual objects -- expected once R6-B completes');

// R6-validation-disclosure preservation
check('R6-VALIDATION-DISCLOSURE-INTACT', appSrc.includes('t("validationDisclosure.title")'), 'prior targeted fix untouched');

// Reset button gap closure
check('RESET-GAP-CLOSED', appSrc.includes('t("savedDeals.resetButtonTitleActive")'), 'the pre-existing documented i18n gap is now closed');

const allPass = results.every(Boolean);
console.log('\nR6A_LOCALIZED_ROWS=14');
console.log('RUN_R6A_FULL_CLOSURE=' + (allPass?'PASS':'FAIL'));
process.exit(allPass?0:1);
