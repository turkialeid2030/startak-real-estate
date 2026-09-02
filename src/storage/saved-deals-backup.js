// src/storage/saved-deals-backup.js -- PR-12: Saved Deal export/import
// (backup/restore). Static client-only, no backend. Version 2 adds an optional
// validated Residential Income operating-case snapshot to the canonical Saved
// Deal record while retaining full version-1 restore compatibility. Reuses
// SDI-001's validateSavedDealRecord --
// does NOT implement a second/duplicate schema validator.

const { validateSavedDealRecord } = require('../validation/saved-deal-schema.js');

const BACKUP_FORMAT = 'STARTAK_SAVED_DEALS_BACKUP';
const BACKUP_VERSION = 2;

function projectDealRecord(parsed, id = parsed.id) {
  const record = { id, name: parsed.name, mode: parsed.mode, inputs: parsed.inputs, savedAt: parsed.savedAt };
  if (Object.prototype.hasOwnProperty.call(parsed, 'operatingCase')) record.operatingCase = parsed.operatingCase;
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
  const deals = [];
  for (const entry of dealIndexEntries) {
    const raw = await storageProvider.get('deal:' + entry.id);
    if (!raw) throw new BackupError('MISSING_INDEXED_RECORD', `id=${entry.id}`);
    let parsed;
    try { parsed = JSON.parse(raw); } catch (e) { throw new BackupError('CORRUPT_JSON_IN_STORAGE', `id=${entry.id}`); }
    validateSavedDealRecord(parsed); // throws SavedDealValidationError if structurally invalid -- propagates, aborting the whole export
    // Preserve the core deal plus the optional canonical operating-case snapshot.
    // No calculated view-model or presentation fields are exported.
    deals.push(projectDealRecord(parsed));
  }
  return { format: BACKUP_FORMAT, backupVersion: BACKUP_VERSION, exportedAt: new Date().toISOString(), deals };
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
 * what makes restore transactional/non-destructive: nothing is written
 * until this entire plan succeeds.
 */
function planRestore(backupPayload, existingIndexEntries, existingRecordsById) {
  validateBackupEnvelope(backupPayload);
  const existingIds = new Map(existingIndexEntries.map((e) => [e.id, e]));
  const toWrite = []; // [{id, record}]
  const newIndexEntries = [...existingIndexEntries];

  for (const deal of backupPayload.deals) {
    validateSavedDealRecord(deal); // reuse SDI-001 validator -- throws on any structural defect, aborting the whole plan
    let targetId = deal.id;
    if (existingIds.has(deal.id)) {
      const existingRaw = existingRecordsById.get(deal.id);
      const existingContent = existingRaw ? JSON.stringify(JSON.parse(existingRaw)) : null;
      const incomingContent = JSON.stringify(projectDealRecord(deal));
      if (existingContent === incomingContent) {
        continue; // exact duplicate -- skip, not an error, not a write
      }
      targetId = 'deal_restored_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    }
    const record = projectDealRecord(deal, targetId);
    toWrite.push({ id: targetId, record });
    newIndexEntries.push({ id: targetId, name: deal.name, mode: deal.mode, savedAt: deal.savedAt });
  }
  return { toWrite, newIndexEntries };
}

/**
 * commitRestore(plan, storageProvider)
 * Only called after planRestore() succeeds without throwing. Performs the
 * actual writes. Since planRestore already validated everything, this step
 * cannot fail for structural reasons -- only genuine storage I/O failure
 * (handled by the caller's existing DEAL_SAVE_FAILED-style error path).
 */
async function commitRestore(plan, storageProvider) {
  for (const { id, record } of plan.toWrite) {
    await storageProvider.set('deal:' + id, JSON.stringify(record));
  }
  await storageProvider.set('deals-index', JSON.stringify(plan.newIndexEntries));
  return plan.newIndexEntries;
}

module.exports = { buildExportPayload, validateBackupEnvelope, planRestore, commitRestore, BackupError, BACKUP_FORMAT, BACKUP_VERSION };
