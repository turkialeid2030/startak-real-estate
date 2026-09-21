'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');
const TEMPLATE_DIR = path.join(ROOT, 'governance', 'operator-templates');

const EXPECTED_TYPES = [
  'CANONICAL_SOURCE_HASH_COMPARISON',
  'SAUDI_LEGAL_OPERATING_MODE_REVIEW',
  'PDPL_DATA_GOVERNANCE_REVIEW',
  'PROFESSIONAL_STANDARDS_SCOPE_REVIEW',
  'PRODUCTION_EXECUTION_CHAIN_CONFIRMATION',
  'OPERATING_MODE_CLAIMS_RESTRICTION_CONFIRMATION',
].sort();

const FROZEN = Object.freeze({
  releaseCandidateId: 'startak-real-estate-rc-2026-09-16-e876208c19ff',
  sourceCommitSha: 'e876208c19ffbddd0dacd2bf8fce24aba1e52b55',
  artifactSha256: 'c3ddcd7b4a66fd58c271fb08b9e5a3efb5e4237f0015d3771e7ab9818412017f',
  environmentRef: 'cloudflare-pages:startak-real-estate:production',
  environmentConfigSha256: '819183fb9f4fb09017c636d2d1d841dd086ac4ba4bbccd103dffbc4c5980bc73',
});

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(TEMPLATE_DIR, name), 'utf8'));
}

function readText(name) {
  return fs.readFileSync(path.join(TEMPLATE_DIR, name), 'utf8');
}

function assertFrozenTuple(value) {
  for (const [key, expected] of Object.entries(FROZEN)) assert.strictEqual(value[key], expected, `${key} must match frozen RC tuple`);
}

function findForbiddenKey(value, trail = 'root') {
  if (!value || typeof value !== 'object') return null;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      const hit = findForbiddenKey(value[i], `${trail}[${i}]`);
      if (hit) return hit;
    }
    return null;
  }
  for (const [key, child] of Object.entries(value)) {
    if (/(^|_)(private.?key|secret|password|token|credential)(_|$)/i.test(key)) return `${trail}.${key}`;
    const hit = findForbiddenKey(child, `${trail}.${key}`);
    if (hit) return hit;
  }
  return null;
}

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}: ${error.stack || error.message}`);
    process.exitCode = 1;
  }
}

test('E2I verifier registry template is non-authoritative, public-material-only and covers all six evidence classes', () => {
  const registry = readJson('e2i-readiness-verifier-registry.input.template.json');
  assert.strictEqual(registry.templateOnly, true);
  assert.strictEqual(findForbiddenKey(registry), null);
  assert.strictEqual(JSON.stringify(registry).includes('BEGIN PRIVATE KEY'), false);
  assert(Array.isArray(registry.verifiers));
  assert(registry.verifiers.length >= 2);
  assert(new Set(registry.verifiers.map((item) => item.verifierSubjectRef)).size >= 2);
  const covered = [...new Set(registry.verifiers.flatMap((item) => item.allowedEvidenceTypes))].sort();
  assert.deepStrictEqual(covered, EXPECTED_TYPES);
});

test('E2I unsigned evidence template is bound to frozen RC and contains no signature', () => {
  const evidence = readJson('e2i-readiness-evidence.input.template.json');
  assertFrozenTuple(evidence);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(evidence, 'signatureBase64'), false);
  assert.strictEqual(evidence.signatureAlgorithm, 'RSA-SHA256');
  assert.strictEqual(findForbiddenKey(evidence), null);
});

test('E2I release binding template pins frozen tuple and leaves genuine E2H fields unresolved', () => {
  const binding = readJson('e2i-release-binding.input.template.json');
  assert.strictEqual(binding.templateOnly, true);
  assertFrozenTuple(binding);
  assert.match(binding.upstreamCloseoutPacketHashSha256, /^<.*>$/);
  assert.match(binding.upstreamCloseoutPreparedAt, /^<.*>$/);
});

test('E2I signed response-set template requires exactly the six evidence classes and frozen tuple', () => {
  const evidence = readJson('e2i-readiness-evidence-set.input.template.json');
  assert(Array.isArray(evidence));
  assert.strictEqual(evidence.length, 6);
  assert.deepStrictEqual(evidence.map((item) => item.evidenceType).sort(), EXPECTED_TYPES);
  for (const item of evidence) {
    assertFrozenTuple(item);
    assert.strictEqual(item.signatureAlgorithm, 'RSA-SHA256');
    assert.match(item.signatureBase64, /^<.*>$/);
    assert.strictEqual(item.result, 'VERIFIED');
    assert.strictEqual(findForbiddenKey(item), null);
  }
});

test('E2I operator runbook preserves fail-closed status boundaries and authority limits', () => {
  const runbook = readText('E2I-EXTERNAL-EVIDENCE-HANDOFF.current.md');
  for (const required of [
    'READY_FOR_E2I_READINESS_VERIFIER_TRUST_ROOT_PINNING',
    'READY_FOR_EXTERNAL_READINESS_RSA_SHA256_SIGNATURE',
    'READY_FOR_E2I_AGGREGATION_NOT_ACCEPTED',
    'EXECUTION_AND_POST_DEPLOYMENT_CLOSEOUT_COMPLETE',
    'tools/e2i-readiness-evidence-intake.js',
    'tools/e2i-external-evidence-response-preflight.js',
    'Never fabricate',
    'private keys',
    'E2I_ACCEPTANCE=NOT_ESTABLISHED',
    'GO_LIVE_AUTHORITY=false',
    'TRANSACTION_AUTHORITY=false',
  ]) assert(runbook.includes(required), `runbook missing ${required}`);
});

if (!process.exitCode) {
  console.log(`E2I_OPERATOR_HANDOFF_TEMPLATE_TESTS=PASS ${passed}/${passed}`);
  console.log('EXTERNAL_EVIDENCE_CREATED=false');
  console.log('SIGNATURES_CREATED=false');
  console.log('OUT_OF_BAND_PIN_CREATED=false');
  console.log('AUTHORITY_EFFECT=NONE');
}
