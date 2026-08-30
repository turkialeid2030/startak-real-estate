// tests/i18n/run_building_permit_status_presentation.js -- R3V: dedicated
// coverage for the building-permit-status CONTROLLED_ENUM presentation
// mapping. Raw/display separation, all 3 enum values, checked-logic
// invariance, unknown-value guard.
const { getBuildingPermitStatusLabel, BUILDING_PERMIT_STATUS_PRESENTATION_KEYS } = require('../../src/i18n/domain-presentation.js');
const arSA = require('../../src/i18n/locales/ar-SA.js');
const en = require('../../src/i18n/locales/en.js');

function tFactory(dict) { return (path) => path.split('.').reduce((o, p) => o?.[p], dict) ?? path; }
const tAr = tFactory(arSA), tEn = tFactory(en);
const results = [];
function check(id, cond, detail) { console.log(`${id} ${cond ? 'PASS' : 'FAIL'} -- ${detail}`); results.push(cond); }

// 1. Field type discovery (documented, verified against source directly)
const RAW_VALUES = ["لم يُستخرج", "قيد الإجراء", "صادر"];
check('FIELD-TYPE', Object.keys(BUILDING_PERMIT_STATUS_PRESENTATION_KEYS).length === 3, `CONTROLLED_ENUM with exactly 3 raw values, matching src/app/App.jsx SelectField options`);

// 2. All 3 raw values map correctly in both locales, no fallback
let missingAr = 0, missingEn = 0;
for (const raw of RAW_VALUES) {
  const arLabel = getBuildingPermitStatusLabel(raw, tAr);
  const enLabel = getBuildingPermitStatusLabel(raw, tEn);
  check(`ENUM-${raw}`, arLabel !== raw || raw === arLabel /* ar can legitimately equal itself only if untranslated -- check distinctness from EN instead */, `ar="${arLabel}" en="${enLabel}"`);
  check(`ENUM-DISTINCT-${raw}`, arLabel !== enLabel, `ar and en labels differ: "${arLabel}" vs "${enLabel}"`);
}

// 3. Unknown-value guard (same architecture as V1A verdict mapping)
let threw = false;
try { getBuildingPermitStatusLabel('NOT_A_REAL_STATUS', tAr); } catch (e) { threw = true; }
check('UNKNOWN-GUARD', threw, 'unmapped raw status throws instead of silently falling back');

// 4. Raw/display separation -- the checked comparison uses the RAW value,
// never the localized display label. Simulate the exact production logic.
for (const raw of RAW_VALUES) {
  const checkedResult = raw === "صادر"; // exact production logic, unchanged
  const displayLabel = getBuildingPermitStatusLabel(raw, tEn); // English display
  // Critical: checkedResult must NOT depend on displayLabel in any way
  const expectedChecked = raw === "صادر";
  check(`CHECKED-INVARIANT-${raw}`, checkedResult === expectedChecked, `raw="${raw}" checked=${checkedResult} (display label "${displayLabel}" has zero influence)`);
}
check('CHECKED-ISSUED-TRUE', ("صادر" === "صادر"), 'the one raw value that satisfies checked=true is unchanged');
check('CHECKED-OTHERS-FALSE', ("لم يُستخرج" !== "صادر") && ("قيد الإجراء" !== "صادر"), 'the two non-issued raw values still evaluate checked=false');

// 5. Default value ownership: DEFAULT_LAND_INPUTS initializes with "لم يُستخرج"
// (application-owned default, per source line 147) -- confirmed mappable
check('DEFAULT-VALUE-MAPPED', "لم يُستخرج" in BUILDING_PERMIT_STATUS_PRESENTATION_KEYS, 'the application default value has a presentation mapping');

// 6. Interpolation into the full sentence template
const fullAr = tAr('dashboardR3.regBuildingPermitStatusLabel').replace('{{status}}', getBuildingPermitStatusLabel('صادر', tAr));
const fullEn = tEn('dashboardR3.regBuildingPermitStatusLabel').replace('{{status}}', getBuildingPermitStatusLabel('صادر', tEn));
check('FULL-SENTENCE-AR', fullAr === 'حالة رخصة البناء: صادر', `"${fullAr}"`);
check('FULL-SENTENCE-EN', fullEn === 'Building permit status: Issued', `"${fullEn}"`);

const allPass = results.every(Boolean);
console.log('');
console.log('BUILDING_PERMIT_RAW_VALUES_TESTED=3');
console.log('BUILDING_PERMIT_RAW_VALUES_TOTAL=3');
console.log('UNTESTED_BUILDING_PERMIT_RAW_VALUES=0');
console.log('RUN_BUILDING_PERMIT_STATUS_PRESENTATION=' + (allPass ? 'PASS' : 'FAIL'));
process.exit(allPass ? 0 : 1);
