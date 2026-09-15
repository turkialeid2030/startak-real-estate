'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  EXPECTED_CANONICAL_SHA256,
  CANONICAL_SOURCE_STATUS,
  evaluateCanonicalSourceEvidence,
} = require('../../tools/canonical-source-evidence');

const results = [];

async function test(id, fn) {
  try {
    await fn();
    results.push([id, 'PASS']);
    console.log(id + ' PASS');
  } catch (error) {
    results.push([id, 'FAIL: ' + error.message]);
    console.log(id + ' FAIL: ' + error.message);
  }
}

(async () => {
  await test('PRODUCTIZATION-P21-01', async () => {
    const result = evaluateCanonicalSourceEvidence({ filePath: null });
    assert.strictEqual(result.status, CANONICAL_SOURCE_STATUS.NOT_EVALUATED);
    assert.strictEqual(result.evaluated, false);
    assert.strictEqual(result.verified, false);
    assert.strictEqual(result.computedSha256, null);
    assert.strictEqual(result.expectedSha256, EXPECTED_CANONICAL_SHA256);
  });

  await test('PRODUCTIZATION-P21-02', async () => {
    const result = evaluateCanonicalSourceEvidence({
      filePath: '/definitely/not/present/canonical-source',
      requireEvidence: true,
    });
    assert.strictEqual(result.status, CANONICAL_SOURCE_STATUS.MISSING_REQUIRED);
    assert.strictEqual(result.evaluated, false);
    assert.strictEqual(result.verified, false);
  });

  await test('PRODUCTIZATION-P21-03', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'startak-canonical-'));
    try {
      const file = path.join(dir, 'fixture.bin');
      const bytes = Buffer.from('canonical-source-fixture\n', 'utf8');
      fs.writeFileSync(file, bytes);
      const expected = crypto.createHash('sha256').update(bytes).digest('hex');
      const result = evaluateCanonicalSourceEvidence({ filePath: file, expectedSha256: expected });
      assert.strictEqual(result.status, CANONICAL_SOURCE_STATUS.VERIFIED);
      assert.strictEqual(result.evaluated, true);
      assert.strictEqual(result.verified, true);
      assert.strictEqual(result.computedSha256, expected);
      assert.ok(!JSON.stringify(result).includes(file));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  await test('PRODUCTIZATION-P21-04', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'startak-canonical-'));
    try {
      const file = path.join(dir, 'fixture.bin');
      fs.writeFileSync(file, 'wrong-source', 'utf8');
      const result = evaluateCanonicalSourceEvidence({
        filePath: file,
        expectedSha256: 'a'.repeat(64),
      });
      assert.strictEqual(result.status, CANONICAL_SOURCE_STATUS.MISMATCH);
      assert.strictEqual(result.evaluated, true);
      assert.strictEqual(result.verified, false);
      assert.notStrictEqual(result.computedSha256, result.expectedSha256);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  await test('PRODUCTIZATION-P21-05', async () => {
    assert.throws(
      () => evaluateCanonicalSourceEvidence({ expectedSha256: 'not-a-hash' }),
      /expectedSha256 must be a 64-character SHA-256 hex digest/,
    );
  });

  await test('PRODUCTIZATION-P21-06', async () => {
    const result = evaluateCanonicalSourceEvidence({ filePath: '' });
    const serialized = JSON.stringify(result);
    assert.ok(!serialized.includes('CANONICAL_ORIGINAL_PATH'));
    assert.ok(!Object.prototype.hasOwnProperty.call(result, 'filePath'));
    assert.strictEqual(result.sourcePathProvided, false);
  });

  const failed = results.filter((entry) => entry[1] !== 'PASS');
  console.log(`PRODUCTIZATION_P21_CANONICAL_SOURCE_EVIDENCE_RESULT=${failed.length === 0 ? 'PASS' : 'FAIL'} ${results.filter((entry) => entry[1] === 'PASS').length}/${results.length}`);
  if (failed.length > 0) process.exit(1);
})().catch((error) => {
  console.error('PRODUCTIZATION_P21_CANONICAL_SOURCE_EVIDENCE_FATAL', error && error.stack ? error.stack : error);
  process.exit(1);
});
