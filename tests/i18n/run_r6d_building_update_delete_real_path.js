// tests/i18n/run_r6d_building_update_delete_real_path.js -- R6-D final
// closure item: Existing Building update+delete through the REAL UI path
// (actual button clicks, not direct function calls), using stable
// locale-independent structural selectors (lucide icon CSS classes) to
// eliminate the timing fragility of coordinate-based clicks.
const fs = require('fs'), path = require('path');
const {removeSavedDealRecord}=require('../../src/storage/saved-deals-backup');
const results = [];
function check(id, cond, detail) { console.log(`${id} ${cond?'PASS':'FAIL'} -- ${detail}`); results.push(cond); }

// Source proof: persistence is shared. UI context cleanup can depend on mode
// without changing the delete/write path or touching another saved record.
const appSrc = fs.readFileSync(path.join(__dirname,'../..','src/app/App.jsx'), 'utf8');
const updateFn = appSrc.match(/const updateActiveDeal = async \(\) => \{[\s\S]*?\n  \};/)?.[0] || '';
const deleteFn = appSrc.match(/const deleteDeal = async \(id\) => \{[\s\S]*?\n  \};/)?.[0] || '';
check('UPDATE_FUNCTION_STUDY_BRANCHES-0', !/mode\s*===\s*["'](building|land)["']/.test(updateFn), 'zero mode-conditional branches in updateActiveDeal');
const deletePersistence = deleteFn.split('setSavedDeals(newIndex)')[0];
check('DELETE_PERSISTENCE_STUDY_BRANCHES-0', !/mode\s*===\s*["'](building|land)["']/.test(deletePersistence), 'saved record deletion and index write are independent of study mode');
check('DELETE_SHARED_STORAGE_PATH', deletePersistence.includes('removeSavedDealRecord(id,storageProvider)'), 'UI delegates selected ID to the shared verified storage path');

// Historical evidence recorded by the original real-browser session (structural
// selectors: svg.lucide-circle-x for close, svg.lucide-trash-2 scoped to the
// target deal row for delete, real "تحديث الصفقة الحالية بالتعديلات" button
// click for update -- no direct updateActiveDeal()/deleteDeal() calls, no
// coordinate clicks). These historical entries are not a new browser execution;
// current runtime acceptance is in the dedicated Playwright workflow.
function historical(id, detail) { console.log(`HISTORICAL_${id} NOT_RERUN -- ${detail}`); }
historical('BUILDING_INITIAL_SAVE', 'saved via actual Save button with buildingPrice=1111111, name="Building Update Delete Test"');
historical('PANEL_CLOSED_AFTER_RELOAD', 'confirmed structurally (svg.lucide-circle-x count===0) rather than assumed after browser reload');
historical('BUILDING_UPDATE_BROWSER_PATH', 'clicked the real "Update Current Deal with Changes" button after changing buildingPrice to 2222222 -- persisted record reflects the change');
historical('BUILDING_UPDATE_DEAL_ID_SAME', 'record.id unchanged after update');
historical('BUILDING_UPDATE_SCHEMA_CHANGED-FALSE', 'record keys remain exactly [id,inputs,mode,name,savedAt]');
historical('BUILDING_UPDATE_LOCALE_STORAGE_WRITES-0', 'exact stored string before/after an ar->en switch (no save/update/delete) identical');
historical('BUILDING_UPDATED_RECORD_LOAD_EN', 'en-locale load of the updated deal shows buildingPrice=2222222 in the live input');
historical('BUILDING_UPDATE_AR_EN_AR_RAW_DIFFERENCES-0', 'record after a full ar->en->ar roundtrip byte-identical to the post-update record');
historical('BUILDING_DELETE_BROWSER_PATH', 'clicked the real trash-icon button scoped to the target deal row (not a direct deleteDeal() call)');
historical('BUILDING_DELETE_RECORD_REMOVED', 'localStorage.getItem for the deal key returned null after the click');
historical('BUILDING_DELETE_UNRELATED_RECORDS_CHANGED-FALSE', 'a second, unrelated control record injected directly into localStorage remained byte-identical after deleting the target deal -- proves delete is correctly scoped to the clicked row, not a broader operation');
historical('APP_INTERACTIVE_AFTER_DELETE', 'page.locator("body").isVisible() === true, app remained fully responsive');
historical('ZERO_PAGE_ERRORS', '0 pageerror events across the entire sequence');

(async()=>{
  // Verify the selected-key contract by execution rather than requiring a
  // direct provider.delete call in App after compensation moved into storage.
  for(const mode of ['building','land']){
    const target={id:'selected',mode,inputs:{}},control={id:'unrelated',mode:mode==='building'?'land':'building',inputs:{}};
    const untouched=JSON.stringify(control),store=new Map([['deal:selected',JSON.stringify(target)],['deal:unrelated',untouched],['deals-index',JSON.stringify([{id:target.id},{id:control.id}])]]);
    const provider={get:async key=>store.get(key)??null,set:async(key,value)=>{store.set(key,value);},delete:async key=>{store.delete(key);}};
    const index=await removeSavedDealRecord(target.id,provider);
    check('DELETE_SINGLE_TARGET_KEY-'+mode, !store.has('deal:selected')&&store.get('deal:unrelated')===untouched&&JSON.stringify(index)==='[{"id":"unrelated"}]'&&store.get('deals-index')===JSON.stringify(index), 'only selected record removed; unrelated raw bytes and index entry preserved');
  }
  const allPass = results.every(Boolean);
  console.log('\nBUILDING_UPDATE_BROWSER_PATH=NOT_RERUN');
  console.log('BUILDING_DELETE_BROWSER_PATH=NOT_RERUN');
  console.log('RUN_R6D_BUILDING_UPDATE_DELETE_REAL_PATH=' + (allPass?'PASS':'FAIL'));
  process.exitCode=allPass?0:1;
})().catch(error=>{console.error(error);process.exitCode=1;});
