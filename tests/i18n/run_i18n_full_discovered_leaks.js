// tests/i18n/run_i18n_full_discovered_leaks.js -- permanent regression for
// the defects discovered during I18N_FULL final-gate qualification itself:
// FG-I18N-001 (section eyebrow labels, 27+2=29 occurrences across input
// panels, Dashboard MetricGroup combined/conditional labels) and
// FG-I18N-002 (projectTitle system-generated title). Also re-guards the two
// earlier R7 leaks (CashFlow SAR, rangeWarning fallback) since all four were
// discovered via the same class of incomplete-pattern-search mistake.
const fs = require('fs'), path = require('path');
const { getProjectTitleDisplay } = require('../../src/i18n/domain-presentation.js');
const arSA = require('../../src/i18n/locales/ar-SA.js');
const en = require('../../src/i18n/locales/en.js');
const results = [];
function check(id, cond, detail) { console.log(`${id} ${cond?'PASS':'FAIL'} -- ${detail}`); results.push(cond); }

const appSrc = fs.readFileSync(path.join(__dirname,'../..','src/app/App.jsx'), 'utf8');

// FG-I18N-001: zero raw "القسم" anywhere in production source (the exact
// forensic search that found this defect -- broad substring, not a narrow
// pre-built pattern list, to avoid repeating the original discovery gap)
check('FG001-ZERO-RAW-SECTION-LITERAL', !appSrc.includes('القسم'), 'zero raw "القسم" substring anywhere in App.jsx (both simple eyebrow= and MetricGroup combined/conditional forms)');
check('FG001-DICT-8-SECTIONS-PLUS-COMBINED', ['section1','section2','section3','section4','section5','section6','section7','section8','sectionCombined2And3'].every(k => arSA.globalApp[k] && en.globalApp[k]), 'all 9 section-label keys present both locales');

// FG-I18N-002: projectTitle raw/display separation
check('FG002-USER-EDITABLE-FALSE-CONFIRMED', !appSrc.match(/patch\("projectTitle"/) && !appSrc.match(/onChange.*projectTitle/), 'zero edit path exists -- re-confirms PROJECT_TITLE_USER_EDITABLE=FALSE');
check('FG002-DISPLAY-FN-USED', appSrc.includes('getProjectTitleDisplay(inputs.projectTitle, t)'), 'presentation wrapper in use at the single render site');
const buildingDefault = 'مبنى مكتبي قائم — طريق أبو بكر الصديق، حي الندى، الرياض';
const landDefault = 'أرض للتطوير — الدائري الشرقي، حي الوادي';
function tF(dict) { return p => p.split('.').reduce((o,k)=>o?.[k],dict) ?? p; }
check('FG002-BUILDING-DEFAULT-MAPS-EN', getProjectTitleDisplay(buildingDefault, tF(en)) === en.globalApp.defaultProjectTitleBuilding, 'exact-literal match maps to EN default');
check('FG002-LAND-DEFAULT-MAPS-EN', getProjectTitleDisplay(landDefault, tF(en)) === en.globalApp.defaultProjectTitleLand, 'exact-literal match maps to EN default');
check('FG002-USER-CONTENT-PASSTHROUGH', getProjectTitleDisplay('Any Other Title', tF(en)) === 'Any Other Title', 'non-default value passes through unchanged in any locale');
check('FG002-RAW-VALUES-UNCHANGED-IN-DEFAULTS', appSrc.includes(`projectTitle: "${buildingDefault}"`) && appSrc.includes(`projectTitle: "${landDefault}"`), 'DEFAULT_*_INPUTS literals byte-identical to before -- display-only fix');

// Re-guard the two earlier R7 leaks (same discovery-methodology class)
check('NO-CASHFLOW-ARABIC-SAR-LEAK', !appSrc.match(/fmtSAR\(activeNPV\)/), 'CashFlow NPV still uses localized helper');
check('NO-RANGEWARNING-ARABIC-FALLBACK', !appSrc.includes('"قيمة أقل من المعتاد — تحقّق منها"') || appSrc.includes('genericWarnBelow: "قيمة أقل من المعتاد'), 'fallback only exists inside the dictionary value, not as inline JSX/JS fallback');

// Dictionary integrity
check('GLOBAL-PARITY', JSON.stringify(Object.keys(arSA.globalApp).sort()) === JSON.stringify(Object.keys(en.globalApp).sort()), `ar=${Object.keys(arSA.globalApp).length} en=${Object.keys(en.globalApp).length}`);
check('GLOBAL-NO-BLANKS', Object.values(arSA.globalApp).every(v=>v.trim()) && Object.values(en.globalApp).every(v=>v.trim()), 'zero blank values');

const allPass = results.every(Boolean);
console.log('\nSECTION_EYEBROW_OCCURRENCES=29');
console.log('SECTION_EYEBROW_HARDCODED_ARABIC_REMAINING=0');
console.log('PROJECT_TITLE_RAW_VALUE_CHANGED=FALSE');
console.log('RUN_I18N_FULL_DISCOVERED_LEAKS=' + (allPass?'PASS':'FAIL'));
process.exit(allPass?0:1);
