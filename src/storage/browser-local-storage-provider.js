// src/storage/browser-local-storage-provider.js -- standalone Vite/Chromium
// fallback using standard window.localStorage. Namespaced to avoid collisions.
const NAMESPACE = 'STARTAK_REAL_ESTATE:SAVED_DEALS:';
function isAvailable() {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return false;
  try { const k = '__storage_test__'; window.localStorage.setItem(k, '1'); window.localStorage.removeItem(k); return true; }
  catch { return false; }
}
async function get(key) {
  const v = window.localStorage.getItem(NAMESPACE + key);
  return v; // null if absent -- same contract as HostStorageProvider.get
}
class StorageQuotaExceededError extends Error {
  constructor(cause) {
    super('Browser storage quota exceeded');
    this.name = 'StorageQuotaExceededError';
    this.code = 'STORAGE_QUOTA_EXCEEDED';
    this.message_ar = 'امتلأت مساحة التخزين في المتصفح. صدِّر نسخة احتياطية من الصفقات ثم احذف صفقات قديمة قبل الحفظ مرة أخرى.';
    this.message_en = 'Browser storage is full. Export a backup of your deals and delete older deals before saving again.';
    this.cause = cause;
  }
}
function isQuotaError(error) {
  if (!error) return false;
  return error.name === 'QuotaExceededError'
    || error.name === 'NS_ERROR_DOM_QUOTA_REACHED'
    || error.code === 22
    || error.code === 1014;
}
async function set(key, value) {
  try {
    window.localStorage.setItem(NAMESPACE + key, value);
  } catch (error) {
    if (isQuotaError(error)) throw new StorageQuotaExceededError(error);
    throw error;
  }
}
async function del(key) {
  window.localStorage.removeItem(NAMESPACE + key);
}
function providerName() { return 'BrowserLocalStorageProvider'; }
module.exports = { isAvailable, get, set, delete: del, providerName, NAMESPACE, StorageQuotaExceededError, isQuotaError };
