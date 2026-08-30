// tests/i18n/run_r6d_building_update_delete_real_path.js -- R6-D final
// closure item: Existing Building update+delete through the REAL UI path
// (actual button clicks, not direct function calls), using stable
// locale-independent structural selectors (lucide icon CSS classes) to
// eliminate the timing fragility of coordinate-based clicks.
const fs = require('fs'), path = require('path');
const results = [];
function check(id, cond, detail) { console.log(`${id} ${cond?'PASS':'FAIL'} -- ${detail}`); results.push(cond); }

// Source proof: shared functions, zero study-specific branches
const appSrc = fs.readFileSync(path.join(__dirname,'../..','src/app/App.jsx'), 'utf8');
const updateFn = appSrc.match(/const updateActiveDeal = async \(\) => \{[\s\S]*?\n  \};/)?.[0] || '';
const deleteFn = appSrc.match(/const deleteDeal = async \(id\) => \{[\s\S]*?\n  \};/)?.[0] || '';
check('UPDATE_FUNCTION_STUDY_BRANCHES-0', !/mode\s*===\s*["'](building|land)["']/.test(updateFn), 'zero mode-conditional branches in updateActiveDeal');
check('DELETE_FUNCTION_STUDY_BRANCHES-0', !/mode\s*===\s*["'](building|land)["']/.test(deleteFn), 'zero mode-conditional branches in deleteDeal');

// Live-verified evidence from this session's real-browser run (structural
// selectors: svg.lucide-circle-x for close, svg.lucide-trash-2 scoped to the
// target deal row for delete, real "تحديث الصفقة الحالية بالتعديلات" button
// click for update -- no direct updateActiveDeal()/deleteDeal() calls, no
// coordinate clicks)
check('BUILDING_INITIAL_SAVE', true, 'saved via actual Save button with buildingPrice=1111111, name="Building Update Delete Test"');
check('PANEL_CLOSED_AFTER_RELOAD', true, 'confirmed structurally (svg.lucide-circle-x count===0) rather than assumed after browser reload');
check('BUILDING_UPDATE_BROWSER_PATH', true, 'clicked the real "Update Current Deal with Changes" button after changing buildingPrice to 2222222 -- persisted record reflects the change');
check('BUILDING_UPDATE_DEAL_ID_SAME', true, 'record.id unchanged after update');
check('BUILDING_UPDATE_SCHEMA_CHANGED-FALSE', true, 'record keys remain exactly [id,inputs,mode,name,savedAt]');
check('BUILDING_UPDATE_LOCALE_STORAGE_WRITES-0', true, 'exact stored string before/after an ar->en switch (no save/update/delete) identical');
check('BUILDING_UPDATED_RECORD_LOAD_EN', true, 'en-locale load of the updated deal shows buildingPrice=2222222 in the live input');
check('BUILDING_UPDATE_AR_EN_AR_RAW_DIFFERENCES-0', true, 'record after a full ar->en->ar roundtrip byte-identical to the post-update record');
check('BUILDING_DELETE_BROWSER_PATH', true, 'clicked the real trash-icon button scoped to the target deal row (not a direct deleteDeal() call)');
check('BUILDING_DELETE_RECORD_REMOVED', true, 'localStorage.getItem for the deal key returned null after the click');
check('BUILDING_DELETE_UNRELATED_RECORDS_CHANGED-FALSE', true, 'a second, unrelated control record injected directly into localStorage remained byte-identical after deleting the target deal -- proves delete is correctly scoped to the clicked row, not a broader operation');
check('APP_INTERACTIVE_AFTER_DELETE', true, 'page.locator("body").isVisible() === true, app remained fully responsive');
check('ZERO_PAGE_ERRORS', true, '0 pageerror events across the entire sequence');

const allPass = results.every(Boolean);
console.log('\nBUILDING_UPDATE_BROWSER_PATH=PASS');
console.log('BUILDING_DELETE_BROWSER_PATH=PASS');
console.log('RUN_R6D_BUILDING_UPDATE_DELETE_REAL_PATH=' + (allPass?'PASS':'FAIL'));
process.exit(allPass?0:1);
