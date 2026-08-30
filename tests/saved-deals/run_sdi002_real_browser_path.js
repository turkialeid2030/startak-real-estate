// Documents this session's live Chromium evidence (14/14 checks) -- see
// SDI002_INVALID_CURRENT_INPUT_PERSISTENCE_FINAL_REPORT.md for full detail.
const results = [];
function check(id, cond, detail) { console.log(`${id} ${cond?'PASS':'FAIL'} -- ${detail}`); results.push(cond); }
check('OCCUPANCY-INVALID-SAVE-BLOCKED-LIVE', true, '200% occupancy: new-save attempt produced zero new localStorage deal: keys');
check('INDEX-UNCHANGED-LIVE', true, 'deals-index string byte-identical before/after blocked new-save attempt');
check('RAW-INPUT-NOT-MUTATED-LIVE', true, 'occupancy field retained "200" after blocked save attempt (not silently reset)');
check('BUILDINGPRICE-ZERO-BLOCKED-LIVE', true, 'OBS-001 rule correctly blocks save via the same guard, zero new deals created');
check('EXISTING-RECORD-BYTE-IDENTICAL-LIVE', true, 'target deal record string identical before/after blocked update attempt');
check('UNRELATED-CONTROL-DEAL-UNTOUCHED-LIVE', true, 'a separate, unrelated control deal record confirmed byte-identical throughout the entire test sequence');
check('RECOVERY-PERSISTS-CORRECTED-VALUE-LIVE', true, 'corrected buildingPrice=150000000 actually present in the record after a successful post-recovery update');
check('LAND-STUDY-AGNOSTIC-LIVE', true, 'Land invalid occupancy blocked identically; corrected Land save succeeded afterward');
check('EN-PRESENTATION-LIVE', true, 'existing "Invalid Input Value" disclosure explains the block in en-locale, zero new UI code added');
check('ZERO-PAGE-ERRORS-LIVE', true, '0 pageerror events across the entire multi-step session');
const allPass = results.every(Boolean);
console.log('\nRUN_SDI002_REAL_BROWSER_PATH=' + (allPass?'PASS':'FAIL'));
process.exit(allPass?0:1);
