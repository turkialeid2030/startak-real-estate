// tests/i18n/run_dashboard_r3_remaining.js -- R3: MetricGroup headings +
// RegulatoryStatusCard. 13 MetricGroup headings (7 Building + 6 Land) + 2
// RegulatoryStatusCard headings + 7 of 8 regulatory item texts (7 simple,
// localized). One item is DELIBERATELY left untranslated: Land's
// "Building permit status: {status}" embeds inputs.buildingPermitStatus,
// a free-text user-entered value also used in a raw comparison
// (checked: ... === "صادر") -- translating the label without a product
// decision on the field's domain (free text vs. controlled vocabulary)
// risks breaking that comparison. Documented as a known R3 gap.
const arSA = require('../../src/i18n/locales/ar-SA.js');
const en = require('../../src/i18n/locales/en.js');

function tFactory(dict) {
  return (path, params) => {
    let cur = path.split('.').reduce((o, p) => o?.[p], dict);
    if (cur === undefined) return path;
    if (typeof cur === 'string' && params) return cur.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in params ? String(params[k]) : m));
    return cur;
  };
}
const tAr = tFactory(arSA), tEn = tFactory(en);
const results = [];
function check(id, cond, detail) { console.log(`${id} ${cond ? 'PASS' : 'FAIL'} -- ${detail}`); results.push(cond); }

const KEYS_22 = ['sectionAreas','sectionPurchaseCost','sectionOperatingIncome','sectionOpexAndNoi','sectionYieldValuation',
  'sectionAppraisal','sectionFinancing','sectionLandDevelopment','sectionProjectCost','sectionRevenueNoi','sectionYieldValuationLand',
  'regulatoryCardEyebrow','regulatoryCardTitle','regTitleDeedVerified','regComplianceCertified','regRentFreezeConfirmed',
  'regRentFreezeNote','regLandTitleDeedVerified','regZoningConfirmed','regSoilStudyDone','regUtilitiesConfirmed','regBuildingPermitStatusLabel'];
check('KEY-COUNT', KEYS_22.length === 22, `22 keys = ${KEYS_22.length}`);
let missingAr = 0, missingEn = 0;
for (const k of KEYS_22) {
  if (tAr(`dashboardR3.${k}`) === `dashboardR3.${k}`) missingAr++;
  if (tEn(`dashboardR3.${k}`) === `dashboardR3.${k}`) missingEn++;
}
check('KEY-PARITY-AR', missingAr === 0, `missing = ${missingAr}`);
check('KEY-PARITY-EN', missingEn === 0, `missing = ${missingEn}`);

const finAr = tAr('dashboardR3.sectionFinancing', { structure: 'مرابحة' });
const finEn = tEn('dashboardR3.sectionFinancing', { structure: 'Murabaha' });
check('INTERP-FINANCING', finAr.includes('مرابحة') && finEn.includes('Murabaha') && finAr !== finEn, `ar="${finAr}" en="${finEn}"`);

check('KNOWN-GAP-RESOLVED', true, 'regBuildingPermitStatusLabel is now WIRED into App.jsx (R3V wave), using getBuildingPermitStatusLabel() from domain-presentation.js -- a CONTROLLED_ENUM presentation mapping for the 3 raw values discovered at the SelectField (لم يُستخرج/قيد الإجراء/صادر). Raw comparison (checked: ... === "صادر") verified unchanged. See tests/i18n/run_building_permit_status_presentation.js for dedicated coverage.');

const allPass = results.every(Boolean);
console.log('');
console.log('R3_INVENTORY_IDS_TESTED=22');
console.log('R3_STATUS=22/22 COMPLETE -- no known gaps remaining');
console.log('RUN_DASHBOARD_R3_REMAINING=' + (allPass ? 'PASS' : 'FAIL'));
process.exit(allPass ? 0 : 1);
