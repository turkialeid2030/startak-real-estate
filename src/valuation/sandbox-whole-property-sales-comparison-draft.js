'use strict';

const {
  WHOLE_PROPERTY_UNIT_OF_COMPARISON,
} = require('../contracts/whole-property-sales-comparison');

const C3M_SANDBOX_WHOLE_PROPERTY_SALES_DRAFT_VERSION = 'C3M_SANDBOX_WHOLE_PROPERTY_SALES_DRAFT_V1';
const RESERVED_TRUST_FIELDS = Object.freeze([
  'verifiedBy',
  'verificationReference',
  'verifiedAt',
  'selectedBy',
  'selectionReference',
  'selectedAt',
  'reviewedBy',
  'reviewReference',
  'reviewedAt',
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

function rejectReserved(raw) {
  const attempted = RESERVED_TRUST_FIELDS.filter((field) => Object.prototype.hasOwnProperty.call(raw, field));
  if (attempted.length) throw new TypeError(`sandbox whole-property sales draft cannot set trust/authority fields: ${attempted.join(',')}`);
}

function createSandboxWholePropertyComparableDraft(raw = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new TypeError('sandbox comparable draft input must be an object');
  rejectReserved(raw);
  const unit = cleanString(raw.unitOfComparison);
  if (!Object.values(WHOLE_PROPERTY_UNIT_OF_COMPARISON).includes(unit)) {
    throw new TypeError(`unsupported unitOfComparison: ${unit || 'MISSING'}`);
  }
  return Object.freeze({
    draftVersion: C3M_SANDBOX_WHOLE_PROPERTY_SALES_DRAFT_VERSION,
    comparableId: cleanString(raw.comparableId) || null,
    transactionKey: cleanString(raw.transactionKey) || null,
    sourcePropertyRef: cleanString(raw.sourcePropertyRef) || null,
    assetType: cleanString(raw.assetType) || null,
    unitOfComparison: unit,
    basisQuantity: raw.basisQuantity ?? null,
    sourceRef: cleanString(raw.sourceRef) || null,
    verifiedBy: null,
    verificationReference: null,
    verifiedAt: null,
    sandboxOnly: true,
    decisionReady: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
    publicAiAuthorized: false,
    semantics: 'Sandbox comparable draft only. Capturing a transaction key and denominator does not verify the measurement, bind the transaction to C2, qualify the comparable, create a valuation weight or authorize a valuation conclusion.',
  });
}

function createSandboxWholePropertyReconciliationDraft(raw = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new TypeError('sandbox reconciliation draft input must be an object');
  rejectReserved(raw);
  const weights = raw.weightsByComparableId;
  if (weights !== undefined && (!weights || typeof weights !== 'object' || Array.isArray(weights))) {
    throw new TypeError('weightsByComparableId must be an object when supplied');
  }
  return Object.freeze({
    draftVersion: C3M_SANDBOX_WHOLE_PROPERTY_SALES_DRAFT_VERSION,
    reconciliationPolicyId: cleanString(raw.reconciliationPolicyId) || null,
    weightsByComparableId: Object.freeze(weights ? { ...weights } : {}),
    rationale: cleanString(raw.rationale) || null,
    proposedByRef: cleanString(raw.proposedByRef) || null,
    reconciledBy: null,
    reconciliationReference: null,
    reconciledAt: null,
    sandboxOnly: true,
    decisionReady: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
    publicAiAuthorized: false,
    semantics: 'Sandbox reconciliation draft only. Proposed weights do not establish professional reconciliation authority, comparable sufficiency, policy compliance or decision readiness.',
  });
}

module.exports = {
  C3M_SANDBOX_WHOLE_PROPERTY_SALES_DRAFT_VERSION,
  RESERVED_TRUST_FIELDS,
  createSandboxWholePropertyComparableDraft,
  createSandboxWholePropertyReconciliationDraft,
};
