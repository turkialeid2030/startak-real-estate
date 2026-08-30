// tests/saved-deals/run_pr12_backup_restore_equivalence.js -- PR-12 targeted
// final proof: ONE exact production round trip using the real
// buildExportPayload/planRestore/commitRestore functions (not manually
// constructed fixtures), a destructive clear, and a BRAND-NEW
// storageProvider closure for restore (proving no in-memory cheating),
// with complete financial + recommendation equivalence via the real
// calculateInvestmentCase().
const { buildExportPayload, planRestore, commitRestore } = require('../../src/storage/saved-deals-backup');
const { calculateInvestmentCase, STUDY_TYPE } = require('../../src/engines');
const { validateSavedDealRecord, SavedDealValidationError } = require('../../src/validation/saved-deal-schema');
const gold = require('../reference/RE-GOLD-baseline.json');
const results = [];
function check(id, cond, detail) { console.log(`${id} ${cond?'PASS':'FAIL'} -- ${detail}`); results.push(cond); }

(async () => {
  const backingStore = {};
  const storageProvider = { get: async (k) => (k in backingStore ? backingStore[k] : null), set: async (k, v) => { backingStore[k] = v; }, delete: async (k) => { delete backingStore[k]; } };

  const buildingInputs = { ...gold['RE-GOLD-002_existing_building'].inputs, leaseStatus: '6 أشهر', financingStructureLabel: 'إجارة منتهية بالتمليك', leverageEnabled: false };
  const buildingId = 'deal_pr12_b';
  const buildingRecord = { id: buildingId, name: 'مشروعي الأول', mode: 'building', inputs: buildingInputs, savedAt: '2026-01-01T00:00:00.000Z' };
  await storageProvider.set('deal:' + buildingId, JSON.stringify(buildingRecord));
  let index = [{ id: buildingId, name: buildingRecord.name, mode: 'building', savedAt: buildingRecord.savedAt }];
  await storageProvider.set('deals-index', JSON.stringify(index));
  const buildingResultBefore = calculateInvestmentCase({ studyType: STUDY_TYPE.EXISTING_BUILDING, inputs: buildingInputs, leverageEnabled: false });

  const landInputs = { ...gold['RE-GOLD-001_land_development'].inputs, buildingTypeLabel: 'برج سكني', buildingPermitStatus: 'صادر', financingStructureLabel: 'مرابحة', leverageEnabled: false };
  const landId = 'deal_pr12_l';
  const landRecord = { id: landId, name: 'صفقة', mode: 'land', inputs: landInputs, savedAt: '2026-01-01T00:00:00.000Z' };
  await storageProvider.set('deal:' + landId, JSON.stringify(landRecord));
  index.push({ id: landId, name: landRecord.name, mode: 'land', savedAt: landRecord.savedAt });
  await storageProvider.set('deals-index', JSON.stringify(index));
  const landResultBefore = calculateInvestmentCase({ studyType: STUDY_TYPE.LAND_DEVELOPMENT, inputs: landInputs, leverageEnabled: false });

  // Export via PRODUCTION function
  const exportedPayload = await buildExportPayload(index, storageProvider);
  check('EXPORT-2-DEALS', exportedPayload.deals.length === 2, `count=${exportedPayload.deals.length}`);
  const exportedBuilding = exportedPayload.deals.find(d => d.mode === 'building');
  check('EXPORT-RAW-DIFF-0', JSON.stringify(exportedBuilding) === JSON.stringify(buildingRecord), 'exact match');
  check('EXPORT-ENUMS-RAW-NOT-LOCALIZED', exportedBuilding.inputs.leaseStatus === '6 أشهر', 'raw preserved');
  check('EXPORT-USER-CONTENT-PRESERVED', exportedBuilding.name === 'مشروعي الأول', 'unchanged');

  const backupPayloadString = JSON.stringify(exportedPayload);

  // Destructive clear
  delete backingStore['deal:' + buildingId]; delete backingStore['deal:' + landId]; delete backingStore['deals-index'];
  check('CLEAR-ABSENT', (await storageProvider.get('deal:' + buildingId)) === null && (await storageProvider.get('deal:' + landId)) === null, 'both absent');

  // Restore with a BRAND-NEW storageProvider (proves no memory cheating) via PRODUCTION functions, from the re-parsed STRING
  const freshStore = {};
  const freshProvider = { get: async (k) => (k in freshStore ? freshStore[k] : null), set: async (k, v) => { freshStore[k] = v; } };
  const parsed = JSON.parse(backupPayloadString);
  const plan = planRestore(parsed, [], new Map());
  const newIndex = await commitRestore(plan, freshProvider);
  check('RESTORE-COUNT-EXACT', newIndex.length === 2, 'RESTORED_DEAL_COUNT_DIFFERENCE=0');

  const restoredBuildingRaw = await freshProvider.get('deal:' + buildingId);
  const restoredLandRaw = await freshProvider.get('deal:' + landId);
  check('RESTORE-BUILDING-BYTE-IDENTICAL', restoredBuildingRaw === JSON.stringify(buildingRecord), 'BYTE_IDENTICAL=true');
  check('RESTORE-LAND-SEMANTIC-IDENTICAL', JSON.stringify(JSON.parse(restoredLandRaw)) === JSON.stringify(landRecord), 'SEMANTIC_DIFFERENCES=0');

  const restoredBuildingParsed = JSON.parse(restoredBuildingRaw);
  validateSavedDealRecord(restoredBuildingParsed); // SDI-001 through production load path
  const buildingResultAfter = calculateInvestmentCase({ studyType: STUDY_TYPE.EXISTING_BUILDING, inputs: restoredBuildingParsed.inputs, leverageEnabled: false });
  check('BUILDING-FINANCIAL-EQUIVALENCE', buildingResultAfter.irr === buildingResultBefore.irr && buildingResultAfter.NOI === buildingResultBefore.NOI && JSON.stringify(buildingResultAfter.cashflows) === JSON.stringify(buildingResultBefore.cashflows), 'irr/NOI/cashflows exact');
  check('BUILDING-RECOMMENDATION-EQUIVALENCE', buildingResultAfter.verdict === buildingResultBefore.verdict && buildingResultAfter.metCount === buildingResultBefore.metCount, 'verdict/metCount exact');

  const restoredLandParsed = JSON.parse(restoredLandRaw);
  validateSavedDealRecord(restoredLandParsed);
  const landResultAfter = calculateInvestmentCase({ studyType: STUDY_TYPE.LAND_DEVELOPMENT, inputs: restoredLandParsed.inputs, leverageEnabled: false });
  check('LAND-OBS002-STILL-SATISFIED', landResultAfter.totalProjectCost > 0, `totalProjectCost=${landResultAfter.totalProjectCost}`);
  check('LAND-FINANCIAL-EQUIVALENCE', landResultAfter.irr === landResultBefore.irr && JSON.stringify(landResultAfter.cashflows) === JSON.stringify(landResultBefore.cashflows), 'exact');
  check('LAND-RECOMMENDATION-EQUIVALENCE', landResultAfter.verdict === landResultBefore.verdict, 'exact');

  // Safety controls
  const mixed = { format: 'STARTAK_SAVED_DEALS_BACKUP', backupVersion: 1, deals: [{ id: 'ok', name: 'x', mode: 'building', inputs: {}, savedAt: '2026-01-01' }, { id: 'bad', name: 'y', mode: 'not_real', inputs: {}, savedAt: '2026-01-01' }] };
  const indexBefore = JSON.stringify(newIndex);
  let threwOnMixed = false;
  try { planRestore(mixed, newIndex, new Map()); } catch (e) { threwOnMixed = e instanceof SavedDealValidationError; }
  check('MIXED-IMPORT-WHOLE-PLAN-REJECTED', threwOnMixed, 'zero writes before this line');
  check('VALID-DATA-UNCHANGED-AFTER-FAILED-IMPORT', JSON.stringify(newIndex) === indexBefore, 'unaffected');

  const dupPlan = planRestore({ format: 'STARTAK_SAVED_DEALS_BACKUP', backupVersion: 1, deals: [restoredBuildingParsed] }, newIndex, new Map([[buildingId, restoredBuildingRaw]]));
  check('CONFLICT-IDENTICAL-DEDUPED', dupPlan.toWrite.length === 0, 'no silent overwrite, no duplicate');

  let threwOnVersion = false;
  try { planRestore({ format: 'STARTAK_SAVED_DEALS_BACKUP', backupVersion: 999, deals: [] }, newIndex, new Map()); } catch (e) { threwOnVersion = true; }
  check('UNSUPPORTED-VERSION-REJECTED', threwOnVersion, 'rejected');

  const allPass = results.every(Boolean);
  console.log('\nBACKUP_PAYLOAD_SOURCE=PRODUCTION_EXPORT_IMPLEMENTATION');
  console.log('RESTORE_USES_PRODUCTION_IMPORT_IMPLEMENTATION=TRUE');
  console.log('RUN_PR12_BACKUP_RESTORE_EQUIVALENCE=' + (allPass ? 'PASS' : 'FAIL'));
  process.exit(allPass ? 0 : 1);
})();
