'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const currentRegistry = require('../../config/governance/canonical-baseline.json');
const {
  STATUS,
  verifyCanonicalBaselineRegistryFile,
} = require('../../tools/canonical-baseline-registry-gate');

(function run() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'canonical-baseline-registry-gate-'));
  try {
    const goodPath = path.join(root, 'good.json');
    fs.writeFileSync(goodPath, JSON.stringify(currentRegistry), 'utf8');
    const good = verifyCanonicalBaselineRegistryFile({ filePath: goodPath });
    assert.strictEqual(good.status, STATUS.VERIFIED);
    assert.strictEqual(good.verified, true);
    assert.strictEqual(good.activeMode, 'LEGACY_FILE_SHA256');
    assert.strictEqual(good.activationApplied, false);
    assert.strictEqual(good.canonicalBaselineChanged, false);
    assert.match(good.registryHashSha256, /^[a-f0-9]{64}$/);

    const missing = verifyCanonicalBaselineRegistryFile({ filePath: path.join(root, 'missing.json') });
    assert.strictEqual(missing.status, STATUS.MISSING);
    assert.strictEqual(missing.verified, false);

    const malformedPath = path.join(root, 'malformed.json');
    fs.writeFileSync(malformedPath, '{not-json', 'utf8');
    const malformed = verifyCanonicalBaselineRegistryFile({ filePath: malformedPath });
    assert.strictEqual(malformed.status, STATUS.MALFORMED);
    assert.strictEqual(malformed.verified, false);

    const driftPath = path.join(root, 'drift.json');
    fs.writeFileSync(driftPath, JSON.stringify({ ...currentRegistry, activeMode: 'GOVERNED_COMPOSITE_BASELINE' }), 'utf8');
    const drift = verifyCanonicalBaselineRegistryFile({ filePath: driftPath });
    assert.strictEqual(drift.status, STATUS.REGISTRY_HOLD);
    assert.strictEqual(drift.verified, false);
    assert.ok(Array.isArray(drift.blockers));

    const authorityPath = path.join(root, 'authority.json');
    fs.writeFileSync(authorityPath, JSON.stringify({ ...currentRegistry, releaseAuthorized: true }), 'utf8');
    const authority = verifyCanonicalBaselineRegistryFile({ filePath: authorityPath });
    assert.strictEqual(authority.status, STATUS.REGISTRY_HOLD);
    assert.strictEqual(authority.verified, false);

    console.log('canonical baseline registry release gate tests: PASS');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
})();
