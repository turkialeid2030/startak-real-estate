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

  await test('STORAGE-07', () => withMockWindow(Object.defineProperty({}, 'localStorage', {
    get() { throw new Error('Synthetic denied storage getter'); },
  }), () => {
    assert.strictEqual(browserProvider.isAvailable(), false);
    assert.throws(() => createStorageProvider(), PersistenceUnavailableError);
  }));

  await test('STORAGE-08', () => {
    const prefix = browserProvider.NAMESPACE + '__availability_probe__:';
    const store = new Map([['__storage_test__', 'external'], [prefix + '0', 'existing']]);
    const before = [...store];
    return withMockWindow({ localStorage: {
      getItem: k => store.has(k) ? store.get(k) : null,
      setItem: (k,v) => store.set(k,v),
      removeItem: k => store.delete(k),
    } }, () => {
      assert.strictEqual(browserProvider.isAvailable(), true);
      assert.deepStrictEqual([...store], before);
    });
  });

  await test('STORAGE-09', () => {
    const prefix = browserProvider.NAMESPACE + '__availability_probe__:';
    const observed = [];
    let mutations = 0;
    return withMockWindow({ localStorage: {
      getItem: k => { observed.push(k); return 'occupied'; },
      setItem: () => { mutations++; },
      removeItem: () => { mutations++; },
    } }, () => {
      assert.strictEqual(browserProvider.isAvailable(), false);
      assert.strictEqual(observed.length, 8);
      assert.ok(observed.every(k => k.startsWith(prefix)));
      assert.strictEqual(mutations, 0);
    });
  });

  await test('STORAGE-10', () => withMockWindow({ localStorage: {
    getItem: () => null, setItem: () => { throw new Error('Synthetic quota denial'); },
    removeItem: () => { throw new Error('Unexpected delete'); },
  } }, () => assert.strictEqual(browserProvider.isAvailable(), false)));

  await test('STORAGE-11', () => {
    let removed = false;
    return withMockWindow({ localStorage: {
      getItem: () => null, setItem: () => {}, removeItem: () => { removed = true; },
    } }, () => {
      assert.strictEqual(browserProvider.isAvailable(), false);
      assert.strictEqual(removed, false);
    });
  });

  await test('STORAGE-12', () => {
    const store = new Map();
    let removals = 0;
    return withMockWindow({localStorage:{
      getItem: k => store.has(k) ? store.get(k) : null,
      setItem: (k,v) => store.set(k,'SYNTHETIC_OTHER_WRITER'),
      removeItem: k => { removals++;store.delete(k); },
    }}, () => {
      assert.strictEqual(browserProvider.isAvailable(),false);
      assert.strictEqual(removals,0);
      assert.deepStrictEqual([...store.values()],['SYNTHETIC_OTHER_WRITER']);
    });
  });

  await test('STORAGE-13', () => {
    const store = new Map(), keys = [];
    return withMockWindow({localStorage:{
      getItem: k => store.has(k) ? store.get(k) : null,
      setItem: (k,v) => { keys.push(k);store.set(k,v); },
      removeItem: k => store.delete(k),
    }}, () => {
      for(let i=0;i<12;i++)assert.strictEqual(browserProvider.isAvailable(),true);
      assert.strictEqual(new Set(keys).size,12);
      assert.ok(keys.every(k => /^[a-f0-9]{32}$/.test(k.split(':').pop())));
      assert.strictEqual(store.size,0);
    });
  });

  await test('STORAGE-14', () => {
    const store = new Map();
    return withMockWindow({localStorage:{
      getItem: k => store.has(k) ? store.get(k) : null,
      setItem: (k,v) => store.set(k,v),
      removeItem: () => {}, // deletion denied/no-op
    }}, () => {
      assert.strictEqual(browserProvider.isAvailable(),false);
      assert.strictEqual(store.size,1);
    });
  });

  const failed = results.filter(r => r[1] !== 'PASS');
  console.log('');
  console.log('STORAGE_PROVIDER_TEST_CASES=' + results.length);
  console.log('STORAGE_PROVIDER_TESTS=' + (failed.length === 0 ? 'PASS' : 'FAIL'));
  process.exitCode = failed.length === 0 ? 0 : 1;
})();
