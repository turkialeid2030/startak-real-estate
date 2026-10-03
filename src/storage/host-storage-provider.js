// src/storage/host-storage-provider.js -- wraps window.storage EXACTLY as
// the original 8 call sites used it (shared:false in every original call).
// Does not modify window.storage itself in any way.
function isAvailable() {
  if (typeof window === 'undefined' || window.storage === undefined || window.storage === null) return false;
  // Capability-check the complete host contract, not only object presence.
  // Browser/runtime environments may expose unrelated `window.storage` values;
  // selecting those as the host provider can leave reads/writes pending or fail
  // after a side effect. Fall back to browser localStorage unless the exact
  // get/set/delete contract consumed below is present.
  return typeof window.storage.get === 'function'
    && typeof window.storage.set === 'function'
    && typeof window.storage.delete === 'function';
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
