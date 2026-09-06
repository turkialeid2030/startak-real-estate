// tests/i18n/run_r6a_full_closure.js -- R6-A: Saved Deals presentation (14
// rows). Default-name policy proof, dictionary parity, schema freeze,
// user-content non-mutation, R5/R6-validation preservation.
const fs = require('fs'), path = require('path');
const { getDealDisplayName } = require('../../src/i18n/domain-presentation.js');
const {
  prepareNewUiDealForSave,
  prepareUpdatedUiDealForSave,
} = require('../../src/assumptions/ui-integration-controller');
const { ASSUMPTION_MODEL_VERSION } = require('../../src/assumptions/assumption-model');
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

// Schema preservation proof. Wave 2 delegates persistence through the governed
// UI controller rather than constructing the record inline in App.jsx. Prove
// the five raw core fields and optional Building extensions survive unchanged,
// while the assumption-model version is explicit metadata outside inputs.
const appSrc = fs.readFileSync(path.join(__dirname,'../..','src/app/App.jsx'), 'utf8');
const schemaProbe = {
  id: 'R6A-SCHEMA-PROBE',
  name: 'صفقة',
  mode: 'building',
  inputs: { buildingPrice: 7654321, marketCapRate: 0.08 },
  savedAt: '2026-09-06T00:00:00.000Z',
  operatingCase: { schemaVersion: 1, status: 'PROBE' },
  valuationCase: { schemaVersion: 1, status: 'PROBE' },
};
const newRecord = prepareNewUiDealForSave(schemaProbe);
const updatedRecord = prepareUpdatedUiDealForSave(schemaProbe, ASSUMPTION_MODEL_VERSION.LEGACY);
const corePreserved = ['id','name','mode','savedAt'].every((key) => newRecord[key] === schemaProbe[key])
  && JSON.stringify(newRecord.inputs) === JSON.stringify(schemaProbe.inputs)
  && newRecord.operatingCase === schemaProbe.operatingCase
  && newRecord.valuationCase === schemaProbe.valuationCase;
const versionGoverned = newRecord.assumptionModelVersion === ASSUMPTION_MODEL_VERSION.V2
  && updatedRecord.assumptionModelVersion === ASSUMPTION_MODEL_VERSION.LEGACY
  && !Object.prototype.hasOwnProperty.call(newRecord.inputs, 'assumptionModelVersion');
const appUsesGovernedPersistence = appSrc.includes('prepareNewUiDealForSave({')
  && appSrc.includes('prepareUpdatedUiDealForSave({ id: activeDealId');
check('SCHEMA-CORE-PRESERVED-WITH-OPTIONAL-RIAI', corePreserved && versionGoverned && appUsesGovernedPersistence, 'original five raw fields and optional operatingCase/valuationCase remain preserved through Wave 2 governed persistence; assumptionModelVersion is explicit envelope metadata, not an economic input');
check('SCHEMA-UPDATE-UNCHANGED', appSrc.includes('name: existing ? existing.name : "صفقة"'), 'update-active core record shape preserved -- raw persisted literal "صفقة" untouched, only DISPLAY wrapped via getDealDisplayName');
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
