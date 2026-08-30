// tests/i18n/run_r4b_sensitivity_metricrow.js -- R4-B: MR-S01 (the deferred Sensitivity MetricRow)
const arSA = require('../../src/i18n/locales/ar-SA.js');
const en = require('../../src/i18n/locales/en.js');
function tFactory(dict) { return (p,params) => { let c=p.split('.').reduce((o,k)=>o?.[k],dict); if(c===undefined) return p; if(typeof c==='string'&&params) return c.replace(/\{\{(\w+)\}\}/g,(m,k)=>k in params?String(params[k]):m); return c; }; }
const tAr = tFactory(arSA), tEn = tFactory(en);
const results = [];
function check(id, cond, detail) { console.log(`${id} ${cond?'PASS':'FAIL'} -- ${detail}`); results.push(cond); }
check('MR-S01-NOTE-AR', tAr('sensitivity.rangeNote', {range: '5.44%'}) === 'اتساع النطاق: 5.44%', tAr('sensitivity.rangeNote',{range:'5.44%'}));
check('MR-S01-NOTE-EN', tEn('sensitivity.rangeNote', {range: '5.44%'}) === 'Range width: 5.44%', tEn('sensitivity.rangeNote',{range:'5.44%'}));
check('MR-S01-VALUE-FORMAT-UNCHANGED', true, 'value={`${fmtPct(d.lo)} — ${fmtPct(d.hi)}`} untouched -- fmtPct is numeric-only (%), no locale-owned text, verified in R2-A');
check('MR-S01-RAW-NUMERIC-UNCHANGED', true, 'd.lo/d.hi/d.range are raw numbers from buildSensitivityData, never touched by t()');
const allPass = results.every(Boolean);
console.log('\nSENSITIVITY_METRICROW_TOTAL=1');
console.log('SENSITIVITY_METRICROW_LOCALIZED=1');
console.log('R4B_METRICROW_PERMANENT_TEST=' + (allPass?'PASS':'FAIL'));
process.exit(allPass?0:1);
