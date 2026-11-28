// src/storage/browser-local-storage-provider.js -- standalone Vite/Chromium
// fallback using standard window.localStorage. Namespaced to avoid collisions.
const NAMESPACE = 'STARTAK_REAL_ESTATE:SAVED_DEALS:';
function isAvailable() {
  try {
    if (typeof window === 'undefined') return false;
    const storage = window.localStorage;
    if (!storage) return false;
    // Fresh probe identities avoid shared cross-tab slots. localStorage has
    // no atomic compare-and-delete; do not remove an observed changed value.
    const prefix = NAMESPACE + '__availability_probe__:';
    for (let i = 0; i < 8; i++) {
      const nonce = Array.from(globalThis.crypto.getRandomValues(new Uint32Array(4)),
        part => part.toString(16).padStart(8, '0')).join('');
      const key = prefix + nonce;
      if (storage.getItem(key) !== null) continue;
      storage.setItem(key, nonce);
      if (storage.getItem(key) !== nonce) return false;
      storage.removeItem(key);
      return storage.getItem(key) === null;
    }
    return false;
  } catch { return false; }
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
    this.message_ar = 'امتلأت مساحة التخزين أو لم تعد تكفي للحفظ الآمن. صدِّر نسخة احتياطية واحتفظ بها خارج المتصفح قبل معالجة المساحة، ثم أعد المحاولة.';
    this.message_en = 'Browser storage is full or cannot accommodate safe saving. Export a backup and retain it outside the browser before addressing storage capacity, then try again.';
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
module.exports = { isAvailable, get, set, delete: del, providerName, NAMESPACE, StorageQuotaExceededError, isQuotaError, savedDealsRecovery:'BROWSER_LOCAL_JOURNAL_V1' };
