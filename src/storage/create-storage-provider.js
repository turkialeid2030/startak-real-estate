// src/storage/create-storage-provider.js -- single centralized environment
// distinction point. No other file may branch on typeof window.storage.
const hostProvider = require('./host-storage-provider');
const browserProvider = require('./browser-local-storage-provider');

class PersistenceUnavailableError extends Error {
  constructor() {
    super('لا توجد وسيلة تخزين متاحة في هذه البيئة'); // preserved verbatim for backward-compat (Error.message / .toString())
    this.name = 'PersistenceUnavailableError';
    this.code = 'PERSISTENCE_UNAVAILABLE';
    this.message_ar = 'لا توجد وسيلة تخزين متاحة في هذه البيئة';
    this.message_en = 'No storage mechanism is available in this environment';
  }
}

function createStorageProvider() {
  if (hostProvider.isAvailable()) return hostProvider;
  if (browserProvider.isAvailable()) return browserProvider;
  throw new PersistenceUnavailableError(); // NO_SILENT_STORAGE_SUCCESS -- explicit failure, no silent no-op provider
}

module.exports = { createStorageProvider, PersistenceUnavailableError };
