'use strict';

const assert = require('assert');
const policy = require('../../governance/e2d-substantive-review-activation-proposal-policy-2026-09-08.json');
const {
  E2D_STATUS,
  createSubstantiveReviewActivationProposal,
} = require('../../src/standards/substantive-review-activation-proposal');
const {
  parseArgs,
  containsPlaceholder,
  extractMappings,
  prepareProposal,
} = require('../../tools/e2d-substantive-review-activation-intake');

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

test('parseArgs requires every governed input', () => {
  assert.throws(
    () => parseArgs(['--policy', 'policy.json']),
    /--applicability is required/,
  );
});

test('parseArgs maps the full E2D CLI contract', () => {
  const result = parseArgs([
    '--policy', 'policy.json',
    '--applicability', 'e2.json',
    '--evidence-envelope', 'e2b.json',
    '--authority-validation', 'e2c.json',
    '--mappings', 'mappings.json',
    '--proposal-id', 'proposal-1',
    '--prepared-by', 'operator:test',
    '--prepared-at', '2026-09-21T10:00:00+03:00',
    '--out', 'out.json',
  ]);
  assert.strictEqual(result.evidenceEnvelope, 'e2b.json');
  assert.strictEqual(result.authorityValidation, 'e2c.json');
  assert.strictEqual(result.proposalId, 'proposal-1');
  assert.strictEqual(result.out, 'out.json');
});

test('placeholder detection is recursive and fail-closed', () => {
  assert.strictEqual(containsPlaceholder({ nested: ['ok', '<REAL_EVIDENCE_REF>'] }), true);
  assert.strictEqual(containsPlaceholder({ nested: ['ok', 'real-value'] }), false);
  assert.strictEqual(containsPlaceholder('REPLACE_REAL_VALUE'), true);
});

test('extractMappings accepts array and activationMappings envelope', () => {
  const record = {
    candidateId: 'candidate-1',
    ruleSetId: 'ruleset-1',
    proposedRuleRefs: ['rule-1'],
    implementationScopeRef: 'scope:1',
    mappingEvidenceRef: 'evidence:1',
    mappingArtifactSha256: 'a'.repeat(64),
    mappedByRef: 'human:mapper',
    mappedAt: '2026-09-21T09:30:00Z',
  };
  assert.deepStrictEqual(extractMappings([record]), [record]);
  assert.deepStrictEqual(extractMappings({ activationMappings: [record] }), [record]);
  assert.throws(
    () => extractMappings({ activationMappings: [{ ...record, mappingEvidenceRef: '<REAL_MAPPING_EVIDENCE>' }] }),
    /unresolved template placeholders/,
  );
});

test('prepareProposal rejects placeholder-bearing external evidence', () => {
  assert.throws(
    () => prepareProposal({
      policy,
      applicabilityPacket: { status: '<QUALIFIED_E2_STATUS>' },
      externalEvidenceEnvelope: {},
      authorityValidationPacket: {},
      activationMappings: [],
      proposalId: 'proposal-placeholder-rejection',
      preparedByRef: 'operator:test',
      preparedAt: '2026-09-21T10:00:00Z',
    }),
    /E2 applicability packet contains unresolved template placeholders/,
  );
});

test('invalid upstream chain remains HOLD and matches repository constructor', () => {
  const input = {
    proposalId: 'proposal-fail-closed',
    applicabilityPacket: {},
    externalEvidenceEnvelope: {},
    authorityValidationPacket: {},
    policy,
    activationMappings: [],
    preparedByRef: 'operator:test',
    preparedAt: '2026-09-21T10:00:00Z',
  };
  const direct = createSubstantiveReviewActivationProposal(input);
  const wrapped = prepareProposal(input);
  assert.deepStrictEqual(wrapped, direct);
  assert.strictEqual(wrapped.status, E2D_STATUS.HOLD_APPLICABILITY_DISPOSITION);
  assert.ok(wrapped.blockers.includes('E2_APPLICABILITY_DISPOSITIONS_NOT_QUALIFIED'));
  assert.strictEqual(wrapped.proposalPacketHashSha256, null);
  assert.strictEqual(wrapped.standardsOrRulesActivated, false);
  assert.strictEqual(wrapped.releaseAuthorized, false);
  assert.strictEqual(wrapped.mergeAuthorized, false);
  assert.strictEqual(wrapped.deploymentAuthorized, false);
  assert.strictEqual(wrapped.transactionAuthorized, false);
});

if (!process.exitCode) {
  console.log(`E2D_OPERATOR_INTAKE_TESTS=PASS ${passed}/${passed}`);
  console.log('SYNTHETIC_TEST_FIXTURES_ARE_NOT_PRODUCTION_EVIDENCE=true');
  console.log('AUTHORITY_EFFECT=NONE');
}
