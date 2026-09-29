'use strict';

const assert = require('assert/strict');
const {
  createSandboxMethodIndicationDraft,
  createSandboxReconciliationInstructionDraft,
} = require('../../src/valuation-reconciliation/sandbox-valuation-reconciliation-draft');

function marketSourceResult() {
  return {
    modelVersion: 'LAND_SALES_COMPARISON_1.0',
    status: 'LAND_VALUE_INDICATION_READY',
    propertyRef: 'property-001',
    valuationDate: '2026-09-29T00:00:00.000Z',
    calculationHashSha256: 'a'.repeat(64),
    indicationType: 'LAND_SALES_COMPARISON_VALUE_INDICATION',
    landValueIndicationSar: 10000000,
    finalValuationConclusionEstablished: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
  };
}

const methodDraft = createSandboxMethodIndicationDraft({
  id: 'market-draft-1',
  sourceResult: marketSourceResult(),
});
assert.equal(methodDraft.recognizedApproachFamily, 'MARKET');
assert.equal(methodDraft.recognizedModelVersion, 'LAND_SALES_COMPARISON_1.0');
assert.equal(methodDraft.verifiedBy, null);
assert.equal(methodDraft.verificationReference, null);
assert.equal(methodDraft.verifiedAt, null);
assert.equal(methodDraft.sandboxOnly, true);
assert.equal(methodDraft.eligible, false);
assert.equal(methodDraft.decisionReady, false);
assert.equal(methodDraft.certifiedValuationEstablished, false);
assert.equal(methodDraft.transactionAuthorized, false);
assert.equal(methodDraft.publicAiAuthorized, false);

assert.throws(() => createSandboxMethodIndicationDraft({
  id: 'authority-injection',
  sourceResult: marketSourceResult(),
  verifiedBy: 'CALLER',
}), /cannot set trust\/authority fields/);

assert.throws(() => createSandboxMethodIndicationDraft({
  id: 'unsupported-model',
  sourceResult: { modelVersion: 'CALLER_MODEL_9.9' },
}), /unsupported method model version/);

const instructionDraft = createSandboxReconciliationInstructionDraft({
  instructionId: 'draft-recon-1',
  rationale: 'Candidate weights for professional review.',
  proposedByRef: 'analyst-draft',
  weightsByIndicationId: {
    'market-1': 0.4,
    'income-1': 0.35,
    'cost-1': 0.25,
  },
});
assert.equal(instructionDraft.reconciledBy, null);
assert.equal(instructionDraft.reconciliationReference, null);
assert.equal(instructionDraft.reconciledAt, null);
assert.equal(instructionDraft.sandboxOnly, true);
assert.equal(instructionDraft.decisionReady, false);
assert.equal(instructionDraft.certifiedValuationEstablished, false);
assert.equal(instructionDraft.transactionAuthorized, false);
assert.equal(instructionDraft.publicAiAuthorized, false);
assert.equal(instructionDraft.weightsByIndicationId['market-1'], 0.4);

assert.throws(() => createSandboxReconciliationInstructionDraft({
  instructionId: 'reconciler-injection',
  rationale: 'Attempt',
  weightsByIndicationId: { 'market-1': 1 },
  reconciledBy: 'CALLER-INVENTED-RECONCILER',
}), /cannot set trust\/authority fields/);

assert.throws(() => createSandboxReconciliationInstructionDraft({
  instructionId: 'bad-weights',
  weightsByIndicationId: [],
}), /weightsByIndicationId must be an object/);

console.log('C3_SANDBOX_VALUATION_RECONCILIATION_DRAFT=PASS');
