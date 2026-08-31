'use strict';

const {
  getVerdictLabel,
  getExternalDecisionSupportVerdictLabel,
  VERDICT_PRESENTATION_KEYS,
} = require('../../src/i18n/domain-presentation.js');
const arSA = require('../../src/i18n/locales/ar-SA.js');
const en = require('../../src/i18n/locales/en.js');

function tFactory(dict) { return (path) => path.split('.').reduce((o, p) => o?.[p], dict) ?? path; }
const tAr = tFactory(arSA);
const tEn = tFactory(en);
const results = [];
function check(id, cond, detail) { console.log(`${id} ${cond ? 'PASS' : 'FAIL'} -- ${detail}`); results.push(cond); }

const prohibitedExternal = [/يوصى بالشراء/, /لا يوصى بالشراء/, /Recommended to Buy/i, /Not Recommended/i];
for (const raw of Object.keys(VERDICT_PRESENTATION_KEYS)) {
  const legacyAr = getVerdictLabel(raw, tAr);
  const legacyEn = getVerdictLabel(raw, tEn);
  const externalAr = getExternalDecisionSupportVerdictLabel(raw, tAr);
  const externalEn = getExternalDecisionSupportVerdictLabel(raw, tEn);

  check(`LEGACY-AR-${raw}`, typeof legacyAr === 'string' && legacyAr.length > 0, 'legacy Arabic contract preserved');
  check(`LEGACY-EN-${raw}`, typeof legacyEn === 'string' && legacyEn.length > 0, 'legacy English contract preserved');
  check(`EXTERNAL-DIFF-AR-${raw}`, externalAr !== legacyAr, `external Arabic is bounded: ${externalAr}`);
  check(`EXTERNAL-DIFF-EN-${raw}`, externalEn !== legacyEn, `external English is bounded: ${externalEn}`);
  check(`EXTERNAL-NO-BUY-AR-${raw}`, prohibitedExternal.every((rx) => !rx.test(externalAr)), 'external Arabic contains no legacy buy/no-buy recommendation');
  check(`EXTERNAL-NO-BUY-EN-${raw}`, prohibitedExternal.every((rx) => !rx.test(externalEn)), 'external English contains no legacy buy/no-buy recommendation');
}

let unknownLegacy = false;
let unknownExternal = false;
try { getVerdictLabel('UNKNOWN_VERDICT', tAr); } catch (_) { unknownLegacy = true; }
try { getExternalDecisionSupportVerdictLabel('UNKNOWN_VERDICT', tAr); } catch (_) { unknownExternal = true; }
check('UNKNOWN-LEGACY', unknownLegacy, 'legacy path fails closed on unknown verdict');
check('UNKNOWN-EXTERNAL', unknownExternal, 'external path fails closed on unknown verdict');

const allPass = results.every(Boolean);
console.log('EXTERNAL_VERDICT_PRESENTATION_BOUNDARY_V1=' + (allPass ? 'PASS' : 'FAIL'));
process.exit(allPass ? 0 : 1);
