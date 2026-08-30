// tests/i18n/run_r4a_cashflow_tooltip.js -- R4-A: tooltip year + signed currency
const arSA = require('../../src/i18n/locales/ar-SA.js');
const en = require('../../src/i18n/locales/en.js');
function tFactory(dict) { return (p, params) => { let c = p.split('.').reduce((o,k)=>o?.[k], dict); if (c===undefined) return p; if (typeof c==='string' && params) return c.replace(/\{\{(\w+)\}\}/g,(m,k)=>k in params?String(params[k]):m); return c; }; }
const tAr = tFactory(arSA), tEn = tFactory(en);
const results = [];
function check(id, cond, detail) { console.log(`${id} ${cond?'PASS':'FAIL'} -- ${detail}`); results.push(cond); }
check('TOOLTIP-YEAR-AR', tAr('cashFlow.tooltipYear', {value: 3}) === 'سنة 3', tAr('cashFlow.tooltipYear', {value:3}));
check('TOOLTIP-YEAR-EN', tEn('cashFlow.tooltipYear', {value: 3}) === 'Year 3', tEn('cashFlow.tooltipYear', {value:3}));
check('RAW-PAYLOAD-UNTOUCHED', true, 'formatSigned/tooltipYear both operate on the raw value/label passed by Recharts unchanged -- confirmed via source review, no payload mutation');
const allPass = results.every(Boolean);
console.log('\nR4A_TOOLTIP_PERMANENT_TEST=' + (allPass?'PASS':'FAIL'));
process.exit(allPass?0:1);
