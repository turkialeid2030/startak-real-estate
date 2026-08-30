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
async function set(key, value) {
  window.localStorage.setItem(NAMESPACE + key, value);
}
async function del(key) {
  window.localStorage.removeItem(NAMESPACE + key);
}
function providerName() { return 'BrowserLocalStorageProvider'; }
module.exports = { isAvailable, get, set, delete: del, providerName, NAMESPACE };
