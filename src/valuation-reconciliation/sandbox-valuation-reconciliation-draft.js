'use strict';

const {
  RECOGNIZED_METHOD_MODELS_BY_VERSION,
} = require('../contracts/valuation-reconciliation');

const C3_SANDBOX_VALUATION_RECONCILIATION_DRAFT_VERSION = 'C3_SANDBOX_VALUATION_RECONCILIATION_DRAFT_V1';

const METHOD_RESERVED_TRUST_FIELDS = Object.freeze([
  'verifiedBy',
  'verificationReference',
  'verifiedAt',
  'eligible',
  'decisionReady',
  'certifiedValuationEstablished',
  'transactionAuthorized',
  'publicAiAuthorized',
]);

const INSTRUCTION_RESERVED_TRUST_FIELDS = Object.freeze([
  'reconciledBy',
  'reconciliationReference',
  'reconciledAt',
  'decisionReady',
  'certifiedValuationEstablished',
  'transactionAuthorized',
  'publicAiAuthorized',
]);

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function rejectReserved(raw, reserved, label) {
  const attempted = reserved.filter((field) => Object.prototype.hasOwnProperty.call(raw, field));
  if (attempted.length) throw new TypeError(`${label} cannot set trust/authority fields: ${attempted.join(',')}`);
}

function createSandboxMethodIndicationDraft(raw = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new TypeError('sandbox method indication draft input must be an object');
  rejectReserved(raw, METHOD_RESERVED_TRUST_FIELDS, 'sandbox method indication');

  const sourceResult = raw.sourceResult;
  if (!sourceResult || typeof sourceResult !== 'object' || Array.isArray(sourceResult)) {
    throw new TypeError('sandbox method indication requires sourceResult');
  }
  const modelVersion = cleanString(sourceResult.modelVersion);
  const model = RECOGNIZED_METHOD_MODELS_BY_VERSION[modelVersion];
  if (!model) throw new TypeError(`unsupported method model version: ${modelVersion || 'MISSING'}`);

  return Object.freeze({
    draftVersion: C3_SANDBOX_VALUATION_RECONCILIATION_DRAFT_VERSION,
    id: cleanString(raw.id) || null,
    sourceResult,
    recognizedApproachFamily: model.approachFamily,
    recognizedModelVersion: modelVersion,
    verifiedBy: null,
    verificationReference: null,
    verifiedAt: null,
    sandboxOnly: true,
    eligible: false,
    decisionReady: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
    publicAiAuthorized: false,
    semantics: 'Sandbox method draft only. Recognition of a model version does not verify the result, its source hash, its evidence dependencies or its professional suitability for reconciliation.',
  });
}

function createSandboxReconciliationInstructionDraft(raw = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new TypeError('sandbox reconciliation instruction draft input must be an object');
  rejectReserved(raw, INSTRUCTION_RESERVED_TRUST_FIELDS, 'sandbox reconciliation instruction');

  const weights = raw.weightsByIndicationId;
  if (weights !== undefined && (!weights || typeof weights !== 'object' || Array.isArray(weights))) {
    throw new TypeError('weightsByIndicationId must be an object when supplied');
  }

  return Object.freeze({
    draftVersion: C3_SANDBOX_VALUATION_RECONCILIATION_DRAFT_VERSION,
    instructionId: cleanString(raw.instructionId) || null,
    rationale: cleanString(raw.rationale) || null,
    weightsByIndicationId: weights ? Object.freeze({ ...weights }) : Object.freeze({}),
    proposedByRef: cleanString(raw.proposedByRef) || null,
    reconciledBy: null,
    reconciliationReference: null,
    reconciledAt: null,
    sandboxOnly: true,
    decisionReady: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
    publicAiAuthorized: false,
    semantics: 'Sandbox reconciliation instruction draft only. Proposed weights and rationale remain unverified and cannot create professional reconciliation authority or decision readiness.',
  });
}

module.exports = {
  C3_SANDBOX_VALUATION_RECONCILIATION_DRAFT_VERSION,
  METHOD_RESERVED_TRUST_FIELDS,
  INSTRUCTION_RESERVED_TRUST_FIELDS,
  createSandboxMethodIndicationDraft,
  createSandboxReconciliationInstructionDraft,
};
