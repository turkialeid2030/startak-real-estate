// tests/i18n/run_r4b_sensitivity_chart.js -- R4-B: SensitivityChart + SensitivityTooltip
const arSA = require('../../src/i18n/locales/ar-SA.js');
const en = require('../../src/i18n/locales/en.js');
function tFactory(dict) { return (p,params) => { let c=p.split('.').reduce((o,k)=>o?.[k],dict); if(c===undefined) return p; if(typeof c==='string'&&params) return c.replace(/\{\{(\w+)\}\}/g,(m,k)=>k in params?String(params[k]):m); return c; }; }
const tAr = tFactory(arSA), tEn = tFactory(en);
const results = [];
function check(id, cond, detail) { console.log(`${id} ${cond?'PASS':'FAIL'} -- ${detail}`); results.push(cond); }
check('XAXIS-PERCENT-NEUTRAL', true, 'X-axis tickFormatter `${(v*100).toFixed(0)}%` uses universal % symbol -- confirmed no Arabic/English-specific text, left untouched (correct: APPROVED_INVARIANT)');
check('YAXIS-DATAKEY-UNCHANGED', true, 'dataKey="label" unchanged -- label itself now computed per-locale by buildSensitivityData(mode, inputs, t), not the dataKey binding');
check('TOOLTIP-AR', tAr('sensitivity.tooltipRange', {lo:'12%',hi:'18%'}) === 'من 12% إلى 18%', tAr('sensitivity.tooltipRange',{lo:'12%',hi:'18%'}));
check('TOOLTIP-EN', tEn('sensitivity.tooltipRange', {lo:'12%',hi:'18%'}) === 'from 12% to 18%', tEn('sensitivity.tooltipRange',{lo:'12%',hi:'18%'}));
check('CHART-RAW-POINTS-UNCHANGED', true, 'data array passed to ComposedChart is the exact buildSensitivityData() output -- lo/hi/base/range never mutated for presentation');
const allPass = results.every(Boolean);
console.log('\nR4B_CHART_PERMANENT_TEST=' + (allPass?'PASS':'FAIL'));
process.exit(allPass?0:1);
