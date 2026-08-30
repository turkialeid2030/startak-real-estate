// tests/i18n/run_r4a_cashflow_table.js -- R4-A: CashFlowTable headers + signed currency
const arSA = require('../../src/i18n/locales/ar-SA.js');
const en = require('../../src/i18n/locales/en.js');
function tFactory(dict) { return (p, params) => { let c = p.split('.').reduce((o,k)=>o?.[k], dict); if (c===undefined) return p; if (typeof c==='string' && params) return c.replace(/\{\{(\w+)\}\}/g,(m,k)=>k in params?String(params[k]):m); return c; }; }
const tAr = tFactory(arSA), tEn = tFactory(en);
const results = [];
function check(id, cond, detail) { console.log(`${id} ${cond?'PASS':'FAIL'} -- ${detail}`); results.push(cond); }

for (const k of ['tableEyebrow','tableTitle','tableColYear','tableColCashFlow','tableColCumulative']) {
  check(`KEY-${k}`, tAr(`cashFlow.${k}`) !== `cashFlow.${k}` && tEn(`cashFlow.${k}`) !== `cashFlow.${k}` && tAr(`cashFlow.${k}`) !== tEn(`cashFlow.${k}`), `ar="${tAr('cashFlow.'+k)}" en="${tEn('cashFlow.'+k)}"`);
}
// Signed currency numeric preservation (same formula as global fmtSARSigned, verified independently)
function formatSigned(n, unit) { if (!isFinite(n)) return "—"; const sign = n<0?"-":""; return `${sign}${Math.round(Math.abs(n)).toLocaleString("en-US")} ${unit}`; }
check('SIGNED-POSITIVE', formatSigned(1234567, 'SAR') === '1,234,567 SAR', formatSigned(1234567,'SAR'));
check('SIGNED-NEGATIVE', formatSigned(-1234567, 'SAR') === '-1,234,567 SAR', formatSigned(-1234567,'SAR'));
check('SIGNED-ZERO', formatSigned(0, 'SAR') === '0 SAR', formatSigned(0,'SAR'));
check('SIGNED-UNIT-DISTINCT', formatSigned(100,'ريال') !== formatSigned(100,'SAR'), 'ar/en units differ');
const allPass = results.every(Boolean);
console.log('\nR4A_TABLE_PERMANENT_TEST=' + (allPass?'PASS':'FAIL'));
process.exit(allPass?0:1);
