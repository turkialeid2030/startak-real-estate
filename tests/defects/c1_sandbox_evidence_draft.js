'use strict';

const assert = require('assert/strict');
const {
  GEOSPATIAL_EVIDENCE_TYPE,
  GEOSPATIAL_VERIFICATION_STATUS,
  GEOSPATIAL_RESOLUTION_METHOD,
  GEOSPATIAL_GATE_STATUS,
} = require('../../src/contracts/geospatial-evidence');
const {
  createSandboxGeospatialEvidenceDraft,
} = require('../../src/geospatial/sandbox-evidence-draft');
const {
  evaluateGeospatialEvidenceBundle,
} = require('../../src/geospatial/geospatial-evidence-governance');

const raw = {
  id: 'sandbox-parcel-001',
  subjectId: 'deal-001',
  evidenceType: GEOSPATIAL_EVIDENCE_TYPE.PARCEL_IDENTITY,
  normalizedValue: { parcelNumber: '101', planNumber: '202' },
  sourceId: 'REGA_GEOSPATIAL_REAL_ESTATE_PORTAL',
  sourceReference: 'MANUAL-PORTAL-CAPTURE-001',
  sourceUrl: 'https://rega.gov.sa/rega-services/platforms/geospatial-real-estate-portal/',
  observedAt: '2026-09-29T12:00:00.000Z',
  validUntil: '2026-10-29T12:00:00.000Z',
  freshnessPolicyId: 'C1-TEST-FRESHNESS-POLICY',
  critical: true,
};

const draft = createSandboxGeospatialEvidenceDraft(raw);
assert.equal(draft.verificationStatus, GEOSPATIAL_VERIFICATION_STATUS.UNVERIFIED);
assert.equal(draft.verifiedBy, null);
assert.equal(draft.verificationReference, null);
assert.equal(draft.resolutionMethod, GEOSPATIAL_RESOLUTION_METHOD.USER_SUPPLIED);
assert.equal(draft.sandboxOnly, true);
assert.equal(draft.productionConnectorUsed, false);
assert.equal(draft.decisionReady, false);
assert.equal(draft.transactionAuthorized, false);
assert.equal(draft.publicAiAuthorized, false);
assert.equal(draft.professionalValuationOpinion, false);

const evaluated = evaluateGeospatialEvidenceBundle({
  subjectId: 'deal-001',
  evidenceRecords: [draft],
  asOf: '2026-09-29T13:00:00.000Z',
  requiredEvidenceTypes: [GEOSPATIAL_EVIDENCE_TYPE.PARCEL_IDENTITY],
  trustedVerifierIds: ['TRUSTED-C1-VERIFIER'],
  governedFreshnessPolicyIds: ['C1-TEST-FRESHNESS-POLICY'],
});
assert.equal(evaluated.status, GEOSPATIAL_GATE_STATUS.HOLD_EVIDENCE);
assert.equal(evaluated.decisionReady, false);
assert.ok(evaluated.blockers.includes('C1_VERIFIED_EVIDENCE_REQUIRED:PARCEL_IDENTITY'));
assert.ok(evaluated.blockers.includes('C1_OFFICIAL_RESOLUTION_REQUIRED:PARCEL_IDENTITY'));
assert.ok(evaluated.blockers.includes('C1_REQUIRED_EVIDENCE_MISSING:PARCEL_IDENTITY'));
assert.equal(evaluated.transactionAuthorized, false);

assert.throws(
  () => createSandboxGeospatialEvidenceDraft({ ...raw, verificationStatus: 'VERIFIED' }),
  /cannot set trust\/authority fields/,
);
assert.throws(
  () => createSandboxGeospatialEvidenceDraft({ ...raw, verifiedBy: 'TRUSTED-C1-VERIFIER' }),
  /cannot set trust\/authority fields/,
);
assert.throws(
  () => createSandboxGeospatialEvidenceDraft({
    ...raw,
    resolutionMethod: GEOSPATIAL_RESOLUTION_METHOD.OFFICIAL_MAP_QUERY,
  }),
  /cannot set trust\/authority fields/,
);
assert.throws(
  () => createSandboxGeospatialEvidenceDraft({ ...raw, decisionReady: true }),
  /cannot set trust\/authority fields/,
);
assert.throws(
  () => createSandboxGeospatialEvidenceDraft({ ...raw, transactionAuthorized: true }),
  /cannot set trust\/authority fields/,
);

assert.throws(
  () => createSandboxGeospatialEvidenceDraft({ ...raw, sourceId: 'UNKNOWN_SOURCE' }),
  /unregistered official geospatial source/,
);
assert.throws(
  () => createSandboxGeospatialEvidenceDraft({
    ...raw,
    evidenceType: GEOSPATIAL_EVIDENCE_TYPE.ZONING_BUILDABILITY,
    sourceId: 'REAL_ESTATE_REGISTRY',
    sourceUrl: 'https://www.rer.sa/',
  }),
  /does not support evidence type/,
);
assert.throws(
  () => createSandboxGeospatialEvidenceDraft({ ...raw, sourceUrl: 'https://example.com/fake' }),
  /does not match registered official domains/,
);

console.log('C1_SANDBOX_EVIDENCE_DRAFT=PASS');
