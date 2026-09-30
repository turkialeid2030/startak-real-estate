'use strict';

const assert = require('assert');
const nodeCrypto = require('crypto');
const { sha256Hex } = require('../../src/crypto/sha256');

function nodeSha256(value) {
  return nodeCrypto.createHash('sha256').update(value).digest('hex');
}

(function run() {
  const vectors = [
    '',
    'abc',
    'Startak Real Estate',
    'ستارتاك للعقار — قرار تحليلي محكوم',
    '🏢📊🔒',
    JSON.stringify({ a: 1, b: 'العقار', c: [true, false, 12.5] }),
  ];

  assert.strictEqual(
    sha256Hex(''),
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  );
  assert.strictEqual(
    sha256Hex('abc'),
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  );

  for (const value of vectors) {
    assert.strictEqual(sha256Hex(value), nodeSha256(value), `SHA-256 parity mismatch for ${JSON.stringify(value)}`);
  }

  assert.throws(() => sha256Hex(null), TypeError);
  console.log('C5 browser-safe SHA-256 parity: PASS');
})();
