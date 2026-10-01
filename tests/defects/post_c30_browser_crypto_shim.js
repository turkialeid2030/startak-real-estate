'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const nativeCrypto = require('crypto');
const browserCrypto = require('../../src/runtime/browser-crypto-shim.js');

function nativeSha(value) {
  return nativeCrypto.createHash('sha256').update(value).digest('hex');
}

const vectors = [
  '',
  'abc',
  'Startak Real Estate',
  'التحقق من البصمة الرقمية',
  'A'.repeat(1000),
];

for (const value of vectors) {
  const actual = browserCrypto.createHash('sha256').update(value).digest('hex');
  assert.strictEqual(actual, nativeSha(value), `browser SHA-256 mismatch for vector length ${value.length}`);
}

const incremental = browserCrypto.createHash('sha256').update('Startak ').update('Real ').update('Estate').digest('hex');
assert.strictEqual(incremental, nativeSha('Startak Real Estate'));
assert.throws(() => browserCrypto.createHash('sha1'), /STARTAK_BROWSER_CRYPTO_ONLY_SHA256_SUPPORTED/);

const viteConfigPath = path.resolve(__dirname, '../../vite.config.mjs');
assert.strictEqual(fs.existsSync(path.resolve(__dirname, '../../vite.config.js')), false, 'legacy vite.config.js must not remain after explicit ESM migration');
assert.strictEqual(fs.existsSync(viteConfigPath), true, 'vite.config.mjs must exist');
const viteSource = fs.readFileSync(viteConfigPath, 'utf8');
assert.match(viteSource, /browser-crypto-shim\.js/);
assert.match(viteSource, /['"]node:crypto['"]\s*:\s*browserCryptoShim/);
assert.match(viteSource, /crypto\s*:\s*browserCryptoShim/);
assert.match(viteSource, /strictExecutionOrder\s*:\s*true/);

console.log('POST_C30_BROWSER_CRYPTO_SHIM=PASS');
console.log('VITE_EXPLICIT_ESM_CONFIG=PASS');
