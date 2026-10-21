// src/storage/saved-deals-backup.js -- PR-12: Saved Deal export/import
// (backup/restore). Static client-only, no backend. Version 2 added an optional
// validated Residential Income operating-case snapshot. Version 3 added the
// optional versioned valuationCase configuration. Version 4 adds non-economic
// compliance-boundary and export-provenance metadata while retaining restore
// compatibility with versions 1-3. Per-deal optional non-economic extensions
// remain additive and are preserved by projectDealRecord(). Reuses SDI-001's
// canonical validator; does NOT implement a second/duplicate schema validator.

const { validateSavedDealRecord } = require('../validation/saved-deal-schema.js');
const {withSavedDealsLock}=require('./saved-deals-operation-lock');
const {beginSavedDealTransaction,finishSavedDealTransaction,recoverSavedDeals}=require('./saved-deals-recovery');
const {MAX_BACKUP_BYTES,MAX_DEALS,checkText,checkJson,validId,checkIndex,parseBackupText,serializeBackup}=require('./saved-deals-backup-limits');
const restorePlans=new WeakMap();
const {
  OPERATING_MODE,
  SHORT_SCOPE_NOTICE,
  FULL_SCOPE_NOTICE,
} = require('../compliance/decision-support.js');

const BACKUP_FORMAT = 'STARTAK_SAVED_DEALS_BACKUP';
const BACKUP_VERSION = 4;
const OPTIONAL_DEAL_EXTENSION_KEYS = Object.freeze([
  'assumptionModelVersion',
  'assumptionRegistry',
  'assumptionRegistryVersion',
  'zakatCase',
  'operatingCase',
  'valuationCase',
  'valuationEditorDraft',
  'inputProvenance',
  'rentalContext',
  'standardsSnapshotVersion',
  'standardsSnapshot',
  'valuationStandardsContext',
]);

function projectDealRecord(parsed, id = parsed.id) {
  const record = { id, name: parsed.name, mode: parsed.mode, inputs: parsed.inputs, savedAt: parsed.savedAt };
  // Historical canonically valid records may omit optional display metadata.
  for(const key of ['name','savedAt'])if(record[key]===undefined)delete record[key];
  for (const key of OPTIONAL_DEAL_EXTENSION_KEYS) {
    if (Object.prototype.hasOwnProperty.call(parsed, key)) record[key] = parsed[key];
  }
  return record;
}

class BackupError extends Error {
  constructor(reasonCode, detail) {
    super(`Saved Deal backup operation failed: ${reasonCode}`);
    this.name = 'BackupError';
    this.reasonCode = reasonCode; // safe enumerated code only
    this.detail = detail; // safe short string, never a raw payload dump
  }
}

function buildComplianceMetadata() {
  return Object.freeze({
    schemaVersion: 1,
    operatingMode: OPERATING_MODE.UNLICENSED_DECISION_SUPPORT,
    outputClassification: 'USER_MANAGED_DATA_BACKUP',
    shortNotice: Object.freeze({ ar: SHORT_SCOPE_NOTICE.ar, en: SHORT_SCOPE_NOTICE.en }),
    fullNotice: Object.freeze({ ar: FULL_SCOPE_NOTICE.ar, en: FULL_SCOPE_NOTICE.en }),
    certifiedValuation: false,
    legalOpinionEstablished: false,
    transactionAuthorized: false,
    legalReviewRequiredBeforeCommercialExternalLaunch: true,
  });
}

function buildExportProvenance(exportedAt, dealCount) {
  return Object.freeze({
    schemaVersion: 1,
    exportKind: 'USER_MANAGED_SAVED_DEALS_BACKUP',
    source: 'CANONICALLY_VALIDATED_SAVED_DEAL_RECORDS',
    exportedAt,
    dealCount,
    qualification: 'STRUCTURAL_VALIDATION_ONLY_NOT_PROFESSIONAL_CERTIFICATION',
    evidenceScope: 'Stored user inputs and versioned optional case/provenance configuration only; no certified appraisal, legal opinion, or transaction instruction is created by this export.',
  });
}

/**
 * buildExportPayload(dealIndexEntries, storageProvider)
 * Reads every Saved Deal record through the existing storage abstraction,
 * structurally validates each with the canonical SDI-001 validator, and
 * returns the complete backup envelope as a JS object (caller serializes).
 * Throws BackupError and produces NO partial output if any record is
 * structurally invalid -- export is all-or-nothing, per policy: a corrupted
 * record is never silently omitted or silently exported as trusted data.
 */
async function buildExportPayload(dealIndexEntries, storageProvider) {
  return withSavedDealsLock(storageProvider,()=>buildExportUnlocked(dealIndexEntries,storageProvider));
}
async function buildExportUnlocked(dealIndexEntries, storageProvider) {
  checkIndex(dealIndexEntries);
  const deals = [];
  for (const entry of dealIndexEntries) {
    const raw = await storageProvider.get('deal:' + entry.id);
    if (!raw) throw new BackupError('MISSING_INDEXED_RECORD', `id=${entry.id}`);
    checkText(raw);
    let parsed;
    try { parsed = JSON.parse(raw); } catch (e) { throw new BackupError('CORRUPT_JSON_IN_STORAGE', `id=${entry.id}`); }
    validateSavedDealRecord(parsed); // throws SavedDealValidationError if structurally invalid -- propagates, aborting the whole export
    checkJson(parsed);
    if(parsed.id!==entry.id)throw new BackupError('BACKUP_RECORD_ID_MISMATCH');
    // Preserve the core deal plus optional canonical non-economic extensions.
    // No calculated view-model, valuation result, or presentation field is
    // exported here.
    deals.push(projectDealRecord(parsed));
  }
  const exportedAt = new Date().toISOString();
  const payload={
    format: BACKUP_FORMAT,
    backupVersion: BACKUP_VERSION,
    exportedAt,
    compliance: buildComplianceMetadata(),
    evidenceProvenance: buildExportProvenance(exportedAt, deals.length),
    deals,
  };
  serializeBackup(payload);return payload;
}

async function readSavedDealsIndex(provider){
 const raw=await provider.get('deals-index');let entries=[];
 if(raw!==null){checkText(raw);try{entries=JSON.parse(raw);}catch{throw new BackupError('BACKUP_INDEX_INVALID');}}
 checkIndex(entries);return {entries,raw};
}
async function readSavedDealsSnapshot(provider){
 const {entries,raw}=await readSavedDealsIndex(provider),records=new Map();
 let total=0;
 for(const entry of entries){const text=await provider.get('deal:'+entry.id);if(typeof text!=='string')throw new BackupError('MISSING_INDEXED_RECORD');checkText(text);total+=new TextEncoder().encode(text).byteLength;if(total>MAX_BACKUP_BYTES)throw new BackupError('BACKUP_SIZE_LIMIT');records.set(entry.id,text);}
 return {entries,raw,records};
}
function buildCurrentExportPayload(provider){return withSavedDealsLock(provider,async()=>{
 const {entries}=await readSavedDealsIndex(provider);return buildExportUnlocked(entries,provider);
});}

function validateV4ComplianceMetadata(parsed) {
  const compliance = parsed.compliance;
  const provenance = parsed.evidenceProvenance;
  const validCompliance =
    compliance && typeof compliance === 'object' && !Array.isArray(compliance) &&
    compliance.operatingMode === OPERATING_MODE.UNLICENSED_DECISION_SUPPORT &&
    compliance.certifiedValuation === false &&
    compliance.legalOpinionEstablished === false &&
    compliance.transactionAuthorized === false &&
    compliance.legalReviewRequiredBeforeCommercialExternalLaunch === true &&
    compliance.shortNotice?.ar === SHORT_SCOPE_NOTICE.ar &&
    compliance.shortNotice?.en === SHORT_SCOPE_NOTICE.en &&
    compliance.fullNotice?.ar === FULL_SCOPE_NOTICE.ar &&
    compliance.fullNotice?.en === FULL_SCOPE_NOTICE.en;
  if (!validCompliance) {
    throw new BackupError('V4_COMPLIANCE_METADATA_INVALID', 'v4 exports require the immutable unlicensed decision-support boundary');
  }

  const validProvenance =
    provenance && typeof provenance === 'object' && !Array.isArray(provenance) &&
    provenance.exportKind === 'USER_MANAGED_SAVED_DEALS_BACKUP' &&
    provenance.source === 'CANONICALLY_VALIDATED_SAVED_DEAL_RECORDS' &&
    provenance.exportedAt === parsed.exportedAt &&
    provenance.dealCount === parsed.deals.length &&
    provenance.qualification === 'STRUCTURAL_VALIDATION_ONLY_NOT_PROFESSIONAL_CERTIFICATION' &&
    typeof provenance.evidenceScope === 'string' && provenance.evidenceScope.length > 0;
  if (!validProvenance) {
    throw new BackupError('V4_EXPORT_PROVENANCE_INVALID', 'v4 exports require source-bound export provenance');
  }
}

/**
 * validateBackupEnvelope(parsed)
 * Structural check of the backup file's top level, independent of the
 * per-deal check below. Throws BackupError on any defect.
 */
function validateBackupEnvelope(parsed) {
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new BackupError('ENVELOPE_NOT_OBJECT', `typeof=${Array.isArray(parsed) ? 'array' : typeof parsed}`);
  }
  if (parsed.format !== BACKUP_FORMAT) {
    throw new BackupError('UNKNOWN_FORMAT', `format=${JSON.stringify(parsed.format)}`);
  }
  if (!Number.isInteger(parsed.backupVersion) || parsed.backupVersion < 1 || parsed.backupVersion > BACKUP_VERSION) {
    throw new BackupError('UNSUPPORTED_VERSION', `backupVersion=${JSON.stringify(parsed.backupVersion)}`);
  }
  if (!Array.isArray(parsed.deals)) {
    throw new BackupError('MISSING_DEALS_ARRAY', `typeof=${typeof parsed.deals}`);
  }
  checkJson(parsed);
  if(parsed.deals.length>MAX_DEALS)throw new BackupError('BACKUP_DEAL_LIMIT');
  if (parsed.backupVersion >= 4) validateV4ComplianceMetadata(parsed);
  return parsed;
}

/**
 * planRestore(backupPayload, existingIndexEntries)
 * Pure function: validates the envelope and every deal, resolves ID
 * conflicts, and returns the COMPLETE proposed final state -- without
 * writing anything. Conflict policy (documented, deterministic):
 *   - same ID + byte-identical record  -> deduplicate (skip re-importing)
 *   - same ID + different record       -> import under a NEW id, all raw
 *                                          content preserved unchanged
 *   - no ID collision                  -> import as-is
 * Throws BackupError on ANY structural problem (envelope or any single
 * deal) -- the caller must not commit anything if this throws. This is
 * what keeps structural validation ahead of writes: nothing is written
 * until this entire plan succeeds. Observed I/O failures use compensation.
 */
function planRestore(backupPayload, existingIndexEntries, existingRecordsById) {
  validateBackupEnvelope(backupPayload);
  checkIndex(existingIndexEntries);
  if(!(existingRecordsById instanceof Map))throw new BackupError('RESTORE_SNAPSHOT_INVALID');
  const incomingIds=new Set();
  for(const deal of backupPayload.deals){
    validateSavedDealRecord(deal);
    if(!validId(deal.id)||incomingIds.has(deal.id))throw new BackupError('BACKUP_DUPLICATE_OR_INVALID_ID');
    incomingIds.add(deal.id);
  }
  const existingIds = new Map(existingIndexEntries.map((e) => [e.id, e]));
  const reservedIds=new Set([...existingIds.keys(),...incomingIds]);
  const toWrite = []; // [{id, record}]
  const newIndexEntries = JSON.parse(JSON.stringify(existingIndexEntries));
  let skippedCount=0,renamedCount=0;

  for (const deal of backupPayload.deals) {
    validateSavedDealRecord(deal); // reuse SDI-001 validator -- throws on any structural defect, aborting the whole plan
    let targetId = deal.id;
    if (existingIds.has(deal.id)) {
      const existingRaw = existingRecordsById.get(deal.id);
      if(typeof existingRaw!=='string')throw new BackupError('MISSING_INDEXED_RECORD');
      checkText(existingRaw);
      let existing;try{existing=JSON.parse(existingRaw);}catch{throw new BackupError('CORRUPT_JSON_IN_STORAGE');}
      validateSavedDealRecord(existing);checkJson(existing);
      if(existing.id!==deal.id)throw new BackupError('BACKUP_RECORD_ID_MISMATCH');
      const existingContent = JSON.stringify(projectDealRecord(existing));
      const incomingContent = JSON.stringify(projectDealRecord(deal));
      if (existingContent === incomingContent) {
        skippedCount++;
        continue; // exact duplicate -- skip, not an error, not a write
      }
      let suffix=1;do{targetId=deal.id.slice(0,130)+'~restored-'+suffix++;}while(reservedIds.has(targetId));
      reservedIds.add(targetId);renamedCount++;
    }
    const record = JSON.parse(JSON.stringify(projectDealRecord(deal, targetId)));
    toWrite.push({ id: targetId, record });
    newIndexEntries.push(Object.fromEntries(Object.entries({id:targetId,name:deal.name,mode:deal.mode,savedAt:deal.savedAt}).filter(([,value])=>value!==undefined)));
  }
  checkIndex(newIndexEntries);
  const plan={toWrite,newIndexEntries,skippedCount,renamedCount};
  const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};freeze(plan);
  restorePlans.set(plan,{used:false,index:JSON.stringify(existingIndexEntries),records:new Map(existingRecordsById)});
  return plan;
}

/**
 * commitRestore(plan, storageProvider)
 * Only called after planRestore() succeeds without throwing. Performs the
 * actual writes. Since planRestore already validated everything, this step
 * cannot fail for structural reasons -- only genuine storage I/O failure
 * (handled by the caller's existing DEAL_SAVE_FAILED-style error path).
 */
async function commitRestore(plan, storageProvider) {
  return withSavedDealsLock(storageProvider,()=>commitRestoreUnlocked(plan,storageProvider));
}
async function commitRestoreUnlocked(plan,provider){
 const state=restorePlans.get(plan);
 if(!state||state.used)throw new BackupError('RESTORE_PLAN_INVALID_OR_USED');state.used=true;
 if(!['get','set','delete'].every(key=>typeof provider[key]==='function'))throw new BackupError('RESTORE_PROVIDER_UNSUPPORTED');
 const before=await readSavedDealsIndex(provider);
 if(JSON.stringify(before.entries)!==state.index)throw new BackupError('RESTORE_STORAGE_CHANGED');
 const checkExisting=async()=>{for(const[id,text]of state.records)if(await provider.get('deal:'+id)!==text)throw new BackupError('RESTORE_STORAGE_CHANGED');};
 await checkExisting();
 for(const {id}of plan.toWrite)if(await provider.get('deal:'+id)!==null)throw new BackupError('RESTORE_TARGET_OCCUPIED');
 if(!plan.toWrite.length)return plan.newIndexEntries;
 return applySavedDealState(provider,before,plan.newIndexEntries,plan.toWrite.map(({id,record})=>({key:'deal:'+id,beforeRaw:null,afterRaw:JSON.stringify(record)})),checkExisting);
}

// All callers hold the shared operation lock. This compensates observed I/O
// failure, including write-then-reject. The local browser also prepares a
// recovery journal before any data write; its removal is the commit point.
async function applySavedDealState(provider,before,newIndex,changes,checkUnchanged=async()=>{}){
 if(!['get','set','delete'].every(key=>typeof provider[key]==='function'))throw new BackupError('RESTORE_PROVIDER_UNSUPPORTED');
 checkIndex(newIndex);const after=JSON.stringify(newIndex),attempted=[];
 if(await provider.get('deals-index')!==before.raw)throw new BackupError('RESTORE_STORAGE_CHANGED');
 for(const change of changes)if(await provider.get(change.key)!==change.beforeRaw)throw new BackupError('RESTORE_STORAGE_CHANGED');
 await checkUnchanged();
 const journal=await beginSavedDealTransaction(provider,before.raw,after,changes);
 const write=async change=>{
  if(await provider.get(change.key)!==change.beforeRaw)throw new BackupError('RESTORE_STORAGE_CHANGED');
  attempted.push(change);
  if(change.afterRaw===null)await provider.delete(change.key);else await provider.set(change.key,change.afterRaw);
  if(await provider.get(change.key)!==change.afterRaw)throw new BackupError('RESTORE_WRITE_NOT_CONFIRMED');
 };
 try{
  // Adds/updates stage their record before publishing the index. Deletion
  // unlinks first so a successful read never sees a missing indexed record.
  for(const change of changes.filter(c=>c.afterRaw!==null))await write(change);
  if(await provider.get('deals-index')!==before.raw)throw new BackupError('RESTORE_STORAGE_CHANGED');
  await checkUnchanged();await provider.set('deals-index',after);
  if(await provider.get('deals-index')!==after)throw new BackupError('RESTORE_WRITE_NOT_CONFIRMED');
  for(const change of changes.filter(c=>c.afterRaw===null))await write(change);
  if(await provider.get('deals-index')!==after)throw new BackupError('RESTORE_STORAGE_CHANGED');
  for(const change of changes)if(await provider.get(change.key)!==change.afterRaw)throw new BackupError('RESTORE_WRITE_NOT_CONFIRMED');
 }catch(cause){
  try{
   const ownedIndex=async()=>{
    const current=await provider.get('deals-index');
    if(current!==before.raw&&current!==after)throw new Error('FOREIGN_INDEX');return current;
   };
   await ownedIndex();
   await checkUnchanged();
   for(const change of changes){const current=await provider.get(change.key);if(current!==change.beforeRaw&&(!attempted.includes(change)||current!==change.afterRaw))throw new Error('FOREIGN_RECORD');}
   // Restore deleted/updated records before making the old index visible.
   for(const change of attempted.filter(c=>c.beforeRaw!==null)){
    const current=await provider.get(change.key);if(current===change.beforeRaw)continue;
    if(current!==change.afterRaw)throw new Error('FOREIGN_RECORD');await ownedIndex();
    await provider.set(change.key,change.beforeRaw);
    if(await provider.get(change.key)!==change.beforeRaw)throw new Error('RECORD_ROLLBACK_UNCONFIRMED');
   }
   if(await ownedIndex()!==before.raw){
    if(before.raw===null)await provider.delete('deals-index');else await provider.set('deals-index',before.raw);
   }
   if(await provider.get('deals-index')!==before.raw)throw new Error('INDEX_ROLLBACK_UNCONFIRMED');
   await finishSavedDealTransaction(provider,journal,'before');
   for(const change of attempted.filter(c=>c.beforeRaw===null).reverse()){
    const current=await provider.get(change.key);if(current===null)continue;
    if(current!==change.afterRaw)throw new Error('FOREIGN_RECORD');
    if(await provider.get('deals-index')!==before.raw)throw new Error('FOREIGN_INDEX');
    await provider.delete(change.key);
    if(await provider.get(change.key)!==null)throw new Error('RECORD_ROLLBACK_UNCONFIRMED');
   }
   for(const change of changes)if(await provider.get(change.key)!==change.beforeRaw)throw new Error('RECORD_ROLLBACK_UNCONFIRMED');
   if(await provider.get('deals-index')!==before.raw)throw new Error('INDEX_ROLLBACK_UNCONFIRMED');
  }catch(_){throw new BackupError('RESTORE_RECOVERY_REQUIRED');}
  throw new BackupError('RESTORE_STORAGE_FAILED_ROLLED_BACK');
 }
 // An ambiguous final cleanup must never start compensation after the commit
 // point. It reports recovery required; a retained journal rolls back on reopen.
 await finishSavedDealTransaction(provider,journal,'after');
 return newIndex;
}
function initializeSavedDealsStorage(provider){return withSavedDealsLock(provider,async()=>{
 const recovery=await recoverSavedDeals(provider);const {entries}=await readSavedDealsIndex(provider);return {entries,...recovery};
});}
function readCurrentSavedDealsIndex(provider){return withSavedDealsLock(provider,()=>readSavedDealsIndex(provider));}
function readSavedDealRecord(id,provider){return withSavedDealsLock(provider,async()=>{
 const {entries}=await readSavedDealsIndex(provider);if(!entries.some(e=>e.id===id))return null;return provider.get('deal:'+id);
});}
function checkedRecord(record){
 validateSavedDealRecord(record);checkJson(record);
 if(!validId(record.id))throw new BackupError('BACKUP_DUPLICATE_OR_INVALID_ID');
 return JSON.parse(JSON.stringify(record));
}
function indexEntry(record){return Object.fromEntries(Object.entries({id:record.id,name:record.name,mode:record.mode,savedAt:record.savedAt}).filter(([,value])=>value!==undefined));}
function saveNewSavedDeal(record,provider){return withSavedDealsLock(provider,async()=>{
 const saved=checkedRecord(record),before=await readSavedDealsIndex(provider);
 if(before.entries.length>=MAX_DEALS)throw new BackupError('BACKUP_DEAL_LIMIT');
 const ids=new Set(before.entries.map(e=>e.id)),base=saved.id;let suffix=0;
 while(ids.has(saved.id)||await provider.get('deal:'+saved.id)!==null)saved.id=base.slice(0,130)+'~saved-'+ ++suffix;
 const index=await applySavedDealState(provider,before,[...before.entries,indexEntry(saved)],[{key:'deal:'+saved.id,beforeRaw:null,afterRaw:JSON.stringify(saved)}]);
 return {id:saved.id,index};
});}
const READ_ONLY_EXTENSION_KEYS=['assumptionRegistry','assumptionRegistryVersion','standardsSnapshotVersion','standardsSnapshot','valuationStandardsContext'];
function updateSavedDealRecord(id,makeRecord,provider){return withSavedDealsLock(provider,async()=>{
 const before=await readSavedDealsIndex(provider);
 if(!before.entries.some(entry=>entry.id===id))throw new BackupError('DEAL_NOT_FOUND');
 const raw=await provider.get('deal:'+id);if(raw===null)throw new BackupError('MISSING_INDEXED_RECORD');
 const original=checkedRecord(parseBackupText(raw));if(original.id!==id)throw new BackupError('BACKUP_RECORD_ID_MISMATCH');
 const proposed=makeRecord(JSON.parse(JSON.stringify(original)));
 // The form has no editor for these imported source/standards fields. Keep
 // them while allowing editable Zakat/operating/valuation cases to be cleared.
 for(const key of READ_ONLY_EXTENSION_KEYS)if(!Object.prototype.hasOwnProperty.call(proposed,key)&&Object.prototype.hasOwnProperty.call(original,key))proposed[key]=original[key];
 const saved=checkedRecord(proposed);if(saved.id!==id||saved.mode!==original.mode)throw new BackupError('BACKUP_RECORD_ID_MISMATCH');
 return applySavedDealState(provider,before,before.entries.map(entry=>entry.id===id?{...entry,...indexEntry(saved)}:entry),[{key:'deal:'+id,beforeRaw:raw,afterRaw:JSON.stringify(saved)}]);
});}
function removeSavedDealRecord(id,provider){return withSavedDealsLock(provider,async()=>{
 const before=await readSavedDealsIndex(provider);
 if(!before.entries.some(entry=>entry.id===id))throw new BackupError('DEAL_NOT_FOUND');
 const raw=await provider.get('deal:'+id);if(raw===null)throw new BackupError('MISSING_INDEXED_RECORD');
 return applySavedDealState(provider,before,before.entries.filter(entry=>entry.id!==id),[{key:'deal:'+id,beforeRaw:raw,afterRaw:null}]);
});}
function restoreBackupPayload(payload,provider){return withSavedDealsLock(provider,async()=>{
 const {entries,records}=await readSavedDealsSnapshot(provider);
 const plan=planRestore(payload,entries,records);const index=await commitRestoreUnlocked(plan,provider);
 return {index,added:plan.toWrite.length,skipped:plan.skippedCount,renamed:plan.renamedCount};
});}

module.exports = {
  buildExportPayload,
  validateBackupEnvelope,
  planRestore,
  commitRestore,
  BackupError,
  BACKUP_FORMAT,
  BACKUP_VERSION,
  OPTIONAL_DEAL_EXTENSION_KEYS,
  projectDealRecord,
  buildComplianceMetadata,
  buildExportProvenance,
  buildCurrentExportPayload,readSavedDealsIndex,restoreBackupPayload,
  saveNewSavedDeal,updateSavedDealRecord,removeSavedDealRecord,
  initializeSavedDealsStorage,readCurrentSavedDealsIndex,readSavedDealRecord,
  parseBackupText,serializeBackup,MAX_BACKUP_BYTES,MAX_DEALS,
};
