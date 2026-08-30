// src/storage/host-storage-provider.js -- wraps window.storage EXACTLY as
// the original 8 call sites used it (shared:false in every original call).
// Does not modify window.storage itself in any way.
function isAvailable() {
  return typeof window !== 'undefined' && typeof window.storage !== 'undefined' && window.storage !== null;
}
async function get(key) {
  const result = await window.storage.get(key, false);
  return result ? result.value : null; // matches original: `result.value` used after `if (!result)` guard
}
async function set(key, value) {
  await window.storage.set(key, value, false);
}
async function del(key) {
  await window.storage.delete(key, false);
}
function providerName() { return 'HostStorageProvider'; }
module.exports = { isAvailable, get, set, delete: del, providerName };
