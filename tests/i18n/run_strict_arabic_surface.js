'use strict';
const fs = require('fs');
const path = require('path');
const arSA = require('../../src/i18n/locales/ar-SA.js');
const {
  GOVERNED_PRESENTATION_TOKENS,
  sanitizeArabicUiText,
  hasVisibleLatinText,
  presentCode,
} = require('../../src/i18n/strict-arabic-presentation.js');

const results = [];
function check(id, condition, detail) {
  console.log(`${id} ${condition ? 'PASS' : 'FAIL'} -- ${detail}`);
  results.push(Boolean(condition));
}

function flattenStrings(value, prefix = '', output = []) {
  if (typeof value === 'string') output.push([prefix, value]);
  else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) flattenStrings(child, prefix ? `${prefix}.${key}` : key, output);
  }
  return output;
}

const leaks = flattenStrings(arSA)
  .map(([key, value]) => [key, sanitizeArabicUiText(value)])
  .filter(([, value]) => hasVisibleLatinText(value));
if (leaks.length) {
  console.log('STRICT_ARABIC_DICTIONARY_LEAKS:');
  for (const [key, value] of leaks.slice(0, 100)) console.log(`  ${key}: ${value}`);
}
check('STRICT-AR-DICTIONARY-RUNTIME-SURFACE', leaks.length === 0, `remaining Latin-bearing Arabic dictionary values after presentation sanitization=${leaks.length}`);

const codeCases = {
  READY_FOR_REVIEW: 'جاهز للمراجعة',
  HOLD_EVIDENCE: 'معلّق لاستكمال الأدلة',
  ANALYST: 'المحلل',
  INDUSTRIAL_LOGISTICS: 'صناعي ولوجستي',
  ACQUIRE_HOLD: 'استحواذ واحتفاظ',
  LEASE_INCOME: 'دخل إيجاري',
};
for (const [raw, expected] of Object.entries(codeCases)) {
  check(`STRICT-AR-CODE-${raw}`, presentCode(raw, 'ar-SA') === expected, `${raw} => ${expected}`);
}

const governedWave2Tokens = ['EN', 'V2', 'MISSING_REQUIRED', 'EXPLICIT'];
const missingExitCapAr = 'معدل رسملة الخروج مطلوب في إصدار الافتراضات V2. لا تُحتسب مؤشرات العائد المعتمدة على الخروج حتى إدخاله صراحةً.';
const governedSanitizerCases = [
  ['STRICT-AR-SANITIZER-V2-BADGE', 'إصدار الافتراضات V2'],
  ['STRICT-AR-SANITIZER-V2-NOTICE', missingExitCapAr],
  ['STRICT-AR-SANITIZER-GOVERNED-TOKENS', 'EN V2 MISSING_REQUIRED EXPLICIT'],
];
for (const [id, text] of governedSanitizerCases) {
  check(id, sanitizeArabicUiText(text) === text, 'governed production-contract tokens remain byte-stable through Arabic sanitization');
}
check(
  'STRICT-AR-SANITIZER-GOVERNED-TOKEN-INVENTORY',
  governedWave2Tokens.every((token) => GOVERNED_PRESENTATION_TOKENS.has(token)),
  'sanitizer-level governed token inventory covers the complete Wave 2 production contract',
);
check(
  'STRICT-AR-GOVERNED-TOKENS-NOT-LATIN-LEAKS',
  !hasVisibleLatinText('إصدار الافتراضات V2 — MISSING_REQUIRED — EXPLICIT — EN'),
  'approved governed tokens are excluded from generic Latin-leak detection',
);
check(
  'STRICT-AR-UNAPPROVED-LATIN-STILL-DETECTED',
  hasVisibleLatinText('نص غير معتمد TEST'),
  'unapproved Latin prose still fails the strict Arabic boundary',
);
check(
  'STRICT-AR-NON-GOVERNED-TERM-STILL-LOCALIZED',
  sanitizeArabicUiText('Production NPV') === 'الإنتاج صافي القيمة الحالية',
  'governed-token protection does not disable ordinary Arabic term localization',
);

const contextSource = fs.readFileSync(path.join(__dirname, '../../src/i18n/LocaleContext.js'), 'utf8');
check('STRICT-AR-STORED-PREFERENCE-FIRST', contextSource.includes('safeReadStoredLocale() || detectBrowserLocale()'), 'saved explicit choice precedes browser-language fallback');
check('STRICT-AR-BROWSER-FALLBACK', contextSource.includes("detectBrowserLocale() || normalizeLocale(defaultLocale)"), 'browser language precedes supplied default');
check('STRICT-AR-HTML-LANG-DIR', contextSource.includes("setAttribute('lang', locale)") && contextSource.includes("setAttribute('dir', dir)"), 'document language and direction synchronized');
check('STRICT-AR-MISSING-KEY-FAIL-CLOSED', contextSource.includes("locale === 'ar-SA' ? 'نص واجهة غير متاح' : path"), 'missing Arabic key never leaks internal translation path');

const mainSource = fs.readFileSync(path.join(__dirname, '../../src/main.jsx'), 'utf8');
const guardSource = fs.readFileSync(path.join(__dirname, '../../src/components/StrictArabicSurfaceGuard.jsx'), 'utf8');
check('STRICT-AR-GUARD-INSTALLED', mainSource.includes('<StrictArabicSurfaceGuard />'), 'strict Arabic surface guard installed under LocaleProvider');
check('STRICT-AR-GUARD-FAIL-CLOSED', guardSource.includes("return original.replace(trimmed, 'محتوى واجهة غير معرّب');"), 'unmapped English prose is not exposed in Arabic mode');
check('STRICT-AR-TECHNICAL-REF-BOUNDARY', guardSource.includes('TECHNICAL_REFERENCE.test(trimmed)'), 'immutable technical references remain exact');

check(
  'STRICT-AR-WAVE2-GOVERNED-TOKENS',
  governedWave2Tokens.every((token) => guardSource.includes(`'${token}'`))
    && guardSource.includes('APPROVED_TECHNICAL_TOKENS.has(trimmed)')
    && guardSource.includes('protectApprovedTechnicalTokens(original)')
    && guardSource.includes("translated.replace(APPROVED_TECHNICAL_TOKEN_PATTERN, '')"),
  'Wave 2 provenance and language-control tokens remain exact while surrounding prose stays fail-closed',
);
check(
  'STRICT-AR-NO-GENERAL-ENGLISH-BYPASS',
  guardSource.includes("if (/[A-Za-z]/.test(proseForLatinCheck))")
    && !guardSource.includes("EN: 'الإنجليزية'"),
  'approved tokens do not disable the unmapped-English fail-closed boundary and EN remains discoverable',
);

const passed = results.filter(Boolean).length;
console.log(`STRICT_ARABIC_TOTAL=${results.length} PASSED=${passed} FAILED=${results.length - passed}`);
console.log('STRICT_ARABIC_SURFACE=' + (passed === results.length ? 'PASS' : 'FAIL'));
process.exit(passed === results.length ? 0 : 1);
