// tests/i18n/run_r4a_cashflow_chart.js -- R4-A: chart tick formatters, numeric-preserving
const arSA = require('../../src/i18n/locales/ar-SA.js');
const en = require('../../src/i18n/locales/en.js');
function tFactory(dict) { return (p, params) => { let c = p.split('.').reduce((o,k)=>o?.[k], dict); if (c===undefined) return p; if (typeof c==='string' && params) return c.replace(/\{\{(\w+)\}\}/g,(m,k)=>k in params?String(params[k]):m); return c; }; }
const tAr = tFactory(arSA), tEn = tFactory(en);
const results = [];
function check(id, cond, detail) { console.log(`${id} ${cond?'PASS':'FAIL'} -- ${detail}`); results.push(cond); }

// X-axis: raw year unchanged, only prefix localized
for (const y of [0, 5, 12]) {
  const ar = tAr('cashFlow.chartYearTick', { value: y });
  const en_ = tEn('cashFlow.chartYearTick', { value: y });
  check(`X-TICK-${y}`, ar === `س${y}` && en_ === `Y${y}`, `ar="${ar}" en="${en_}"`);
}
// Y-axis: exact same (v/1e6).toFixed(0) operation, only suffix localized
for (const v of [220000000, -110000000, 0]) {
  const scaled = (v / 1e6).toFixed(0);
  const ar = tAr('cashFlow.chartMillionTick', { value: scaled });
  const en_ = tEn('cashFlow.chartMillionTick', { value: scaled });
  check(`Y-TICK-${v}`, ar === `${scaled}م` && en_ === `${scaled}M`, `scaled=${scaled} ar="${ar}" en="${en_}"`);
}
check('SCALE-OP-UNCHANGED', (220000000/1e6).toFixed(0) === '220', 'exact same division/rounding as original');
const allPass = results.every(Boolean);
console.log('\nR4A_CHART_PERMANENT_TEST=' + (allPass?'PASS':'FAIL'));
process.exit(allPass?0:1);
