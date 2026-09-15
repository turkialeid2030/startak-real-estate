'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  EVIDENCE_TYPE,
} = require('../../src/standards/production-evidence-go-live-readiness');

const matrixPath = path.join(__dirname, '../../governance/e2i-external-evidence-request-matrix-2026-09-11.json');
const matrix = JSON.parse(fs.readFileSync(matrixPath, 'utf8'));
const results = [];

function test(id, fn) {
  try {
    fn();
    results.push([id, 'PASS']);
    console.log(`${id} PASS`);
  } catch (error) {
    results.push([id, `FAIL: ${error.message}`]);
    console.log(`${id} FAIL: ${error.message}`);
  }
}

test('E2I-EVIDENCE-REQUEST-MATRIX-01', () => {
  assert.strictEqual(matrix.operatingModeUnderReview, 'UNLICENSED_DECISION_SUPPORT');
  assert.strictEqual(matrix.signatureAlgorithmRequired, 'RSA-SHA256');
  assert.strictEqual(matrix.outOfBandReadinessVerifierRegistryHashRequired, true);
  assert.strictEqual(matrix.sameVerifierSubjectMayVerifyAllEvidenceTypes, false);
});

test('E2I-EVIDENCE-REQUEST-MATRIX-02', () => {
  const expected = Object.values(EVIDENCE_TYPE).sort();
  const actual = matrix.evidenceRequests.map((entry) => entry.evidenceType).sort();
  assert.deepStrictEqual(actual, expected);
  assert.strictEqual(new Set(actual).size, expected.length);
});

test('E2I-EVIDENCE-REQUEST-MATRIX-03', () => {
  for (const request of matrix.evidenceRequests) {
    assert.strictEqual(request.realExternalArtifactRequired, true, request.evidenceType);
    assert.ok(Array.isArray(request.scopeQuestions) && request.scopeQuestions.length > 0, request.evidenceType);
    assert.ok(typeof request.minimumDeliverable === 'string' && request.minimumDeliverable.length > 0, request.evidenceType);
    assert.ok(typeof request.requestedVerifierRole === 'string' && request.requestedVerifierRole.length > 0, request.evidenceType);
  }
});

test('E2I-EVIDENCE-REQUEST-MATRIX-04', () => {
  const legal = matrix.evidenceRequests.find((entry) => entry.evidenceType === EVIDENCE_TYPE.SAUDI_LEGAL_OPERATING_MODE_REVIEW);
  const pdpl = matrix.evidenceRequests.find((entry) => entry.evidenceType === EVIDENCE_TYPE.PDPL_DATA_GOVERNANCE_REVIEW);
  const professional = matrix.evidenceRequests.find((entry) => entry.evidenceType === EVIDENCE_TYPE.PROFESSIONAL_STANDARDS_SCOPE_REVIEW);
  assert.ok(legal.publicSourceRefs.length >= 2);
  assert.ok(pdpl.publicSourceRefs.length >= 2);
  assert.ok(professional.publicSourceRefs.length >= 2);
  for (const entry of [legal, pdpl, professional]) {
    for (const source of entry.publicSourceRefs) {
      assert.strictEqual(source.officialSource, true);
      assert.ok(source.url.startsWith('https://'));
    }
  }
});

test('E2I-EVIDENCE-REQUEST-MATRIX-05', () => {
  const execution = matrix.evidenceRequests.find((entry) => entry.evidenceType === EVIDENCE_TYPE.PRODUCTION_EXECUTION_CHAIN_CONFIRMATION);
  assert.ok(Array.isArray(execution.internalPrerequisites) && execution.internalPrerequisites.length >= 2);
  assert.deepStrictEqual(execution.publicSourceRefs, []);
});

test('E2I-EVIDENCE-REQUEST-MATRIX-06', () => {
  for (const value of Object.values(matrix.authorityBoundary)) assert.strictEqual(value, false);
  assert.ok(/does not constitute any evidence result/i.test(matrix.purpose));
});

const failed = results.filter((entry) => entry[1] !== 'PASS');
console.log(`E2I_EXTERNAL_EVIDENCE_REQUEST_MATRIX_RESULT=${failed.length === 0 ? 'PASS' : 'FAIL'} ${results.filter((entry) => entry[1] === 'PASS').length}/${results.length}`);
if (failed.length > 0) process.exit(1);
