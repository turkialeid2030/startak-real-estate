'use strict';

const assert = require('assert/strict');
const {
  GEOSPATIAL_EVIDENCE_TYPE,
  GEOSPATIAL_VERIFICATION_STATUS,
  GEOSPATIAL_RESOLUTION_METHOD,
  GEOSPATIAL_GATE_STATUS,
} = require('../../src/contracts/geospatial-evidence');
const {
  OFFICIAL_SOURCE_REGISTRY,
  sourceSupportsEvidenceType,
  officialUrlMatchesSource,
} = require('../../src/geospatial/official-source-registry');
const {
  evaluateGeospatialEvidenceBundle,
} = require('../../src/geospatial/geospatial-evidence-governance');

const AS_OF = '2026-09-29T12:00:00.000Z';

function baseRecord(overrides = {}) {
  return {
    id: 'c1-evidence-1',
    subjectId: 'deal-001',
    evidenceType: GEOSPATIAL_EVIDENCE_TYPE.PARCEL_IDENTITY,
    normalizedValue: { parcelNumber: '101', planNumber: '202' },
    sourceId: 'REGA_GEOSPATIAL_REAL_ESTATE_PORTAL',
    sourceReference: 'REGA-GEO-QUERY-001',
    sourceUrl: 'https://rega.gov.sa/rega-services/platforms/geospatial-real-estate-portal/',
    verificationStatus: GEOSPATIAL_VERIFICATION_STATUS.VERIFIED,
    resolutionMethod: GEOSPATIAL_RESOLUTION_METHOD.OFFICIAL_MAP_QUERY,
    observedAt: '2026-09-29T08:00:00.000Z',
    validUntil: '2026-10-29T08:00:00.000Z',
    freshnessPolicyId: 'C1-TEST-FRESHNESS-POLICY',
    critical: true,
    ...overrides,
  };
}

function completeRequiredEvidence() {
  return [
    baseRecord(),
    baseRecord({
      id: 'c1-evidence-2',
      evidenceType: GEOSPATIAL_EVIDENCE_TYPE.LAND_USE,
      normalizedValue: { useCode: 'RESIDENTIAL' },
      sourceId: 'BALADY_URBAN_MAPS',
      sourceReference: 'BALADY-URBAN-QUERY-001',
      sourceUrl: 'https://www.balady.gov.sa/',
      resolutionMethod: GEOSPATIAL_RESOLUTION_METHOD.OFFICIAL_MAP_QUERY,
    }),
    baseRecord({
      id: 'c1-evidence-3',
      evidenceType: GEOSPATIAL_EVIDENCE_TYPE.ZONING_BUILDABILITY,
      normalizedValue: { zoningCode: 'Z-TEST', maxFloors: 4 },
      sourceId: 'BALADY_URBAN_MAPS',
      sourceReference: 'BALADY-URBAN-QUERY-002',
      sourceUrl: 'https://www.balady.gov.sa/',
      resolutionMethod: GEOSPATIAL_RESOLUTION_METHOD.OFFICIAL_MAP_QUERY,
    }),
  ];
}

assert.equal(sourceSupportsEvidenceType('BALADY_URBAN_MAPS', GEOSPATIAL_EVIDENCE_TYPE.ZONING_BUILDABILITY), true);
assert.equal(sourceSupportsEvidenceType('REAL_ESTATE_REGISTRY', GEOSPATIAL_EVIDENCE_TYPE.ZONING_BUILDABILITY), false);
assert.equal(officialUrlMatchesSource('REAL_ESTATE_REGISTRY', 'https://www.rer.sa/'), true);
assert.equal(officialUrlMatchesSource('REAL_ESTATE_REGISTRY', 'https://example.com/'), false);
for (const source of Object.values(OFFICIAL_SOURCE_REGISTRY)) {
  assert.equal(source.productionAdapterEnabled, false, `${source.id}: live production adapter must remain disabled in C1 foundation`);
}

const empty = evaluateGeospatialEvidenceBundle({ evidenceRecords: [], asOf: AS_OF });
assert.equal(empty.status, GEOSPATIAL_GATE_STATUS.HOLD_EVIDENCE);
assert.equal(empty.decisionReady, false);
assert.ok(empty.blockers.includes('C1_REQUIRED_EVIDENCE_MISSING:PARCEL_IDENTITY'));
assert.ok(empty.blockers.includes('C1_REQUIRED_EVIDENCE_MISSING:LAND_USE'));
assert.ok(empty.blockers.includes('C1_REQUIRED_EVIDENCE_MISSING:ZONING_BUILDABILITY'));
assert.equal(empty.transactionAuthorized, false);
assert.equal(empty.professionalValuationOpinion, false);
assert.equal(empty.bindingZoningDetermination, false);

const ready = evaluateGeospatialEvidenceBundle({ evidenceRecords: completeRequiredEvidence(), asOf: AS_OF });
assert.equal(ready.status, GEOSPATIAL_GATE_STATUS.READY);
assert.equal(ready.decisionReady, true);
assert.deepEqual(ready.blockers, []);
assert.equal(ready.resolvedEvidence.PARCEL_IDENTITY.normalizedValue.parcelNumber, '101');
assert.equal(ready.resolvedEvidence.ZONING_BUILDABILITY.normalizedValue.maxFloors, 4);
assert.equal(ready.transactionAuthorized, false);
assert.equal(ready.publicAiAuthorized, false);
assert.equal(ready.professionalValuationOpinion, false);
assert.equal(ready.bindingZoningDetermination, false);

const userParcel = completeRequiredEvidence();
userParcel[0] = { ...userParcel[0], resolutionMethod: GEOSPATIAL_RESOLUTION_METHOD.USER_SUPPLIED };
const userParcelHeld = evaluateGeospatialEvidenceBundle({ evidenceRecords: userParcel, asOf: AS_OF });
assert.equal(userParcelHeld.status, GEOSPATIAL_GATE_STATUS.HOLD_EVIDENCE);
assert.ok(userParcelHeld.blockers.includes('C1_OFFICIAL_RESOLUTION_REQUIRED:PARCEL_IDENTITY'));
assert.ok(userParcelHeld.blockers.includes('C1_REQUIRED_EVIDENCE_MISSING:PARCEL_IDENTITY'));

const stale = completeRequiredEvidence();
stale[2] = { ...stale[2], validUntil: '2026-09-28T23:59:59.000Z' };
const staleHeld = evaluateGeospatialEvidenceBundle({ evidenceRecords: stale, asOf: AS_OF });
assert.equal(staleHeld.status, GEOSPATIAL_GATE_STATUS.HOLD_EVIDENCE);
assert.ok(staleHeld.blockers.includes('C1_EVIDENCE_STALE:ZONING_BUILDABILITY'));

const future = completeRequiredEvidence();
future[1] = { ...future[1], observedAt: '2026-09-30T00:00:00.000Z', validUntil: '2026-10-30T00:00:00.000Z' };
const futureHeld = evaluateGeospatialEvidenceBundle({ evidenceRecords: future, asOf: AS_OF });
assert.equal(futureHeld.status, GEOSPATIAL_GATE_STATUS.HOLD_EVIDENCE);
assert.ok(futureHeld.blockers.includes('C1_FUTURE_EVIDENCE_TIMESTAMP:LAND_USE'));

const scopeMismatch = completeRequiredEvidence();
scopeMismatch[2] = {
  ...scopeMismatch[2],
  sourceId: 'REAL_ESTATE_REGISTRY',
  sourceReference: 'RER-TEST-001',
  sourceUrl: 'https://www.rer.sa/',
};
const scopeHeld = evaluateGeospatialEvidenceBundle({ evidenceRecords: scopeMismatch, asOf: AS_OF });
assert.equal(scopeHeld.status, GEOSPATIAL_GATE_STATUS.HOLD_EVIDENCE);
assert.ok(scopeHeld.blockers.includes('C1_SOURCE_SCOPE_MISMATCH:REAL_ESTATE_REGISTRY:ZONING_BUILDABILITY'));

const badDomain = completeRequiredEvidence();
badDomain[1] = { ...badDomain[1], sourceUrl: 'https://example.com/fake-balady' };
const badDomainHeld = evaluateGeospatialEvidenceBundle({ evidenceRecords: badDomain, asOf: AS_OF });
assert.equal(badDomainHeld.status, GEOSPATIAL_GATE_STATUS.HOLD_EVIDENCE);
assert.ok(badDomainHeld.blockers.includes('C1_OFFICIAL_SOURCE_URL_REQUIRED:BALADY_URBAN_MAPS'));

// Non-JSON or cyclic values must fail closed rather than throwing or producing
// ambiguous hashes that could collide with legitimate evidence.
const nonFinite = completeRequiredEvidence();
nonFinite[1] = { ...nonFinite[1], normalizedValue: { useCode: 'RESIDENTIAL', ratio: Number.NaN } };
const nonFiniteHeld = evaluateGeospatialEvidenceBundle({ evidenceRecords: nonFinite, asOf: AS_OF });
assert.equal(nonFiniteHeld.status, GEOSPATIAL_GATE_STATUS.HOLD_EVIDENCE);
assert.ok(nonFiniteHeld.blockers.includes('C1_NORMALIZED_VALUE_JSON_REQUIRED:LAND_USE'));

const cyclicValue = { useCode: 'RESIDENTIAL' };
cyclicValue.self = cyclicValue;
const cyclic = completeRequiredEvidence();
cyclic[1] = { ...cyclic[1], normalizedValue: cyclicValue };
assert.doesNotThrow(() => evaluateGeospatialEvidenceBundle({ evidenceRecords: cyclic, asOf: AS_OF }));
const cyclicHeld = evaluateGeospatialEvidenceBundle({ evidenceRecords: cyclic, asOf: AS_OF });
assert.equal(cyclicHeld.status, GEOSPATIAL_GATE_STATUS.HOLD_EVIDENCE);
assert.ok(cyclicHeld.blockers.includes('C1_NORMALIZED_VALUE_JSON_REQUIRED:LAND_USE'));

const conflict = completeRequiredEvidence();
conflict.push({
  ...conflict[2],
  id: 'c1-evidence-4',
  normalizedValue: { zoningCode: 'Z-CONFLICT', maxFloors: 8 },
  sourceReference: 'BALADY-URBAN-QUERY-003',
});
const conflictHeld = evaluateGeospatialEvidenceBundle({ evidenceRecords: conflict, asOf: AS_OF });
assert.equal(conflictHeld.status, GEOSPATIAL_GATE_STATUS.HOLD_EVIDENCE);
assert.ok(conflictHeld.blockers.includes('C1_EVIDENCE_CONFLICT:ZONING_BUILDABILITY'));
assert.equal(conflictHeld.resolvedEvidence.ZONING_BUILDABILITY, undefined);

const corroborated = completeRequiredEvidence();
const roadValue = { roadClass: 'PRIMARY', access: true };
corroborated.push(baseRecord({
  id: 'c1-road-1',
  evidenceType: GEOSPATIAL_EVIDENCE_TYPE.ROAD_ACCESS,
  normalizedValue: roadValue,
  sourceId: 'GEOSA_NATIONAL_GEOSPATIAL_PLATFORM',
  sourceReference: 'GEOSA-ROAD-001',
  sourceUrl: 'https://geoportal.geosa.gov.sa/geoportal/',
  resolutionMethod: GEOSPATIAL_RESOLUTION_METHOD.OFFICIAL_SPATIAL_MATCH,
  critical: true,
}));
corroborated.push(baseRecord({
  id: 'c1-road-2',
  evidenceType: GEOSPATIAL_EVIDENCE_TYPE.ROAD_ACCESS,
  normalizedValue: roadValue,
  sourceId: 'BALADY_URBAN_MAPS',
  sourceReference: 'BALADY-ROAD-001',
  sourceUrl: 'https://www.balady.gov.sa/',
  resolutionMethod: GEOSPATIAL_RESOLUTION_METHOD.OFFICIAL_MAP_QUERY,
  critical: true,
}));
const corroboratedReady = evaluateGeospatialEvidenceBundle({ evidenceRecords: corroborated, asOf: AS_OF });
assert.equal(corroboratedReady.status, GEOSPATIAL_GATE_STATUS.READY);
assert.equal(corroboratedReady.resolvedEvidence.ROAD_ACCESS.sourceCount, 2);
assert.equal(corroboratedReady.resolvedEvidence.ROAD_ACCESS.crossSourceConfirmed, true);

console.log('C1_OFFICIAL_GEOSPATIAL_EVIDENCE_FOUNDATION=PASS');
