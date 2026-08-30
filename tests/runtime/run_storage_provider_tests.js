const assert = require('assert');
const browserProvider = require('../../src/storage/browser-local-storage-provider');
const { createStorageProvider, PersistenceUnavailableError } = require('../../src/storage/create-storage-provider');

const results = [];
async function test(id, fn) {
  try { await fn(); results.push([id, 'PASS']); console.log(id + ' PASS'); }
  catch (e) { results.push([id, 'FAIL: ' + e.message]); console.log(id + ' FAIL: ' + e.message); }
}
async function withMockWindow(mockWindow, fn) {
  global.window = mockWindow;
  try { await fn(); } finally { delete global.window; }
}

(async () => {
  await test('STORAGE-01', () => withMockWindow({ storage: { get: async () => null, set: async () => {}, delete: async () => {} } }, () => {
    const p = createStorageProvider();
    assert.strictEqual(p.providerName(), 'HostStorageProvider');
  }));

  await test('STORAGE-02', () => {
    const store = {};
    return withMockWindow({ localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = v; },
      removeItem: (k) => { delete store[k]; },
    } }, () => {
      const p = createStorageProvider();
      assert.strictEqual(p.providerName(), 'BrowserLocalStorageProvider');
    });
  });

  await test('STORAGE-03', () => withMockWindow({}, () => {
    assert.throws(() => createStorageProvider(), PersistenceUnavailableError);
  }));

  await test('STORAGE-04', () => {
    const store = {};
    return withMockWindow({ localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = v; },
      removeItem: (k) => { delete store[k]; },
    } }, async () => {
      await browserProvider.set('deal:test1', JSON.stringify({ id: 'test1' }));
      const back = await browserProvider.get('deal:test1');
      assert.strictEqual(JSON.parse(back).id, 'test1');
    });
  });

  await test('STORAGE-05', () => {
    assert.strictEqual(typeof browserProvider.list, 'undefined');
    console.log('  (list() intentionally not implemented -- not used by any of the 8 original call sites)');
  });

  await test('STORAGE-06', () => {
    const store = { 'STARTAK_REAL_ESTATE:SAVED_DEALS:deal:test2': '{"id":"test2"}' };
    return withMockWindow({ localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = v; },
      removeItem: (k) => { delete store[k]; },
    } }, async () => {
      await browserProvider.delete('deal:test2');
      const back = await browserProvider.get('deal:test2');
      assert.strictEqual(back, null);
    });
  });

  const failed = results.filter(r => r[1] !== 'PASS');
  console.log('');
  console.log('STORAGE_PROVIDER_TEST_CASES=' + results.length);
  console.log('STORAGE_PROVIDER_TESTS=' + (failed.length === 0 ? 'PASS' : 'FAIL'));
  process.exitCode = failed.length === 0 ? 0 : 1;
})();
