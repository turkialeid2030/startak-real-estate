// src/storage/storage-provider.js -- canonical interface. Every provider
// implements exactly these 4 operations, matching the 8 actual current
// window.storage call sites' usage exactly (get/set/delete, no list() used).
// @typedef {{get(key:string):Promise<string|null>, set(key:string,value:string):Promise<void>, delete(key:string):Promise<void>, isAvailable():boolean, providerName():string}} StorageProvider
module.exports = {};
