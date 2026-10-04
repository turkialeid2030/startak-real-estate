'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { SAUDI_OFFICIAL_SOURCE_CATALOG } = require('../../src/sources/saudi-official-source-catalog');
const {
  STATUS,
  EXTERNAL_STATUS,
  canonicalSourceIds,
  createRequiredSourceUniverse,
  verifyRequiredSourceUniverse,
  createExternalSourceRightsRecord,
  verifyExternalSourceRightsRecord,
  evaluateInternalSourceRightsReadiness,
  evaluateExternalSourceRightsForGateIngestion,
  evaluateProductionSourceUseAuthorization,
} = require('../../src/sources/official-source-data-rights-readiness');

const ROOT = path.join(__dirname, '..', '..');
const AS_OF = '2026-10-04T10:00:00.000Z';
const SHA = '1234567890abcdef1234567890abcdef12345678';
const H = (character) => character.repeat(64);
let checks = 0;
function check(fn) { fn(); checks += 1; }
function read(relativePath) { return fs.readFileSync(path.join(ROOT, relativePath), 'utf8'); }

function universe(overrides = {}) {
  return createRequiredSourceUniverse({
    candidateHeadSha: SHA,
    releaseScopeRef: 'STARTAK-REAL-ESTATE-C49-RELEASE-SCOPE',
    requiredSourceIds: canonicalSourceIds(),
    reviewedByRef: 'C49-INTERNAL-ENGINEERING-REVIEW',
    reviewedAt: '2026-10-04T08:00:00.000Z',
    validUntil: '2026-10-11T08:00:00.000Z',
    ...overrides,
  });
}

function rightsRecord(sourceId, status, overrides = {}) {
  const base = {
    evidenceId: 'SOURCE_RIGHTS_AUTHORIZATION',
    candidateHeadSha: SHA,
    sourceId,
    status,
  };
  if (status === EXTERNAL_STATUS.NOT_SUPPLIED) {
    Object.assign(base, { reasonCode: 'INDEPENDENT_SOURCE_RIGHTS_EVIDENCE_NOT_SUPPLIED' });
  } else {
    Object.assign(base, {
      accessBasisRef: `STRUCTURAL-TEST-${sourceId}-ACCESS`,
      processingBasisRef: `STRUCTURAL-TEST-${sourceId}-PROCESSING`,
      storageBasisRef: `STRUCTURAL-TEST-${sourceId}-STORAGE`,
      derivedUseBasisRef: `STRUCTURAL-TEST-${sourceId}-DERIVED`,
      redistributionBasisRef: `STRUCTURAL-TEST-${sourceId}-REDISTRIBUTION`,
      licenceTermsRef: `STRUCTURAL-TEST-${sourceId}-LICENCE-TERMS`,
      restrictionsRef: `STRUCTURAL-TEST-${sourceId}-RESTRICTIONS`,
      evidenceRef: `STRUCTURAL-TEST-${sourceId}-INDEPENDENT-ARTIFACT`,
      evidenceHashSha256: H(sourceId === canonicalSourceIds()[0] ? 'a' : 'b'),
      verifiedByRef: 'STRUCTURAL-TEST-INDEPENDENT-AUTHORIZED-REVIEWER',
      verifiedAt: '2026-10-04T09:00:00.000Z',
      validUntil: '2026-10-10T09:00:00.000Z',
    });
    if (status === EXTERNAL_STATUS.REJECTED) base.reasonCode = 'SOURCE_RIGHTS_NOT_APPROVED';
  }
  return createExternalSourceRightsRecord({ ...base, ...overrides });
}

const ids = canonicalSourceIds();
check(() => assert.strictEqual(ids.length, SAUDI_OFFICIAL_SOURCE_CATALOG.length));
check(() => assert.strictEqual(ids.length, 6));
check(() => assert.deepStrictEqual(ids, [...ids].sort()));
check(() => assert(SAUDI_OFFICIAL_SOURCE_CATALOG.every((source) => source.integrationStatus === 'NOT_CONFIGURED')));

const required = universe();
check(() => assert.strictEqual(verifyRequiredSourceUniverse(required), true));
check(() => assert.deepStrictEqual(required.requiredSourceIds, ids));
check(() => assert.strictEqual(required.sourceRightsAuthorized, false));
check(() => assert.strictEqual(required.sourceUseAuthorized, false));
check(() => assert.strictEqual(required.redistributionAuthorized, false));
check(() => assert.strictEqual(required.deploymentAuthorized, false));
check(() => assert.strictEqual(required.commercialGoLiveAuthorized, false));

const internal = evaluateInternalSourceRightsReadiness({ sourceUniverse: required, asOf: AS_OF });
check(() => assert.strictEqual(internal.status, STATUS.READY_FOR_INDEPENDENT_SOURCE_RIGHTS_REVIEW));
check(() => assert.strictEqual(internal.internalEngineeringReady, true));
check(() => assert.deepStrictEqual(internal.blockers, []));
check(() => assert.strictEqual(internal.externalGateId, '548'));
check(() => assert.strictEqual(internal.sourceRightsAuthorizationSupplied, false));
check(() => assert.strictEqual(internal.sourceUseAuthorized, false));
check(() => assert.strictEqual(internal.redistributionAuthorized, false));
check(() => assert.strictEqual(internal.deploymentAuthorized, false));
check(() => assert.strictEqual(internal.commercialGoLiveAuthorized, false));

check(() => assert.throws(() => universe({ candidateHeadSha: 'bad-sha' }), /40-character Git commit SHA/));
check(() => assert.throws(() => universe({ requiredSourceIds: ids.slice(0, -1) }), /C49_REQUIRED_SOURCE_UNIVERSE_INCOMPLETE/));
check(() => assert.throws(() => universe({ requiredSourceIds: [...ids, 'UNTRUSTED_SOURCE'] }), /C49_NON_CANONICAL_SOURCE_ID/));
check(() => assert.throws(() => universe({ apiKey: 'forbidden' }), /C49_SECRET_MATERIAL_FIELD_FORBIDDEN/));

const stale = universe({ validUntil: '2026-10-04T09:00:00.000Z' });
const staleResult = evaluateInternalSourceRightsReadiness({ sourceUniverse: stale, asOf: AS_OF });
check(() => assert.strictEqual(staleResult.status, STATUS.HOLD_WINDOW));
check(() => assert(staleResult.blockers.includes('C49_WINDOW_SOURCE_UNIVERSE_EXPIRED')));

const tamperedUniverse = { ...required, releaseScopeRef: 'TAMPERED' };
const tamperedUniverseResult = evaluateInternalSourceRightsReadiness({ sourceUniverse: tamperedUniverse, asOf: AS_OF });
check(() => assert.strictEqual(tamperedUniverseResult.status, STATUS.HOLD_INTEGRITY));
check(() => assert(tamperedUniverseResult.blockers.includes('C49_INTEGRITY_SOURCE_UNIVERSE')));

const notSupplied = ids.map((sourceId) => rightsRecord(sourceId, EXTERNAL_STATUS.NOT_SUPPLIED));
check(() => assert(notSupplied.every(verifyExternalSourceRightsRecord)));
const missingResult = evaluateExternalSourceRightsForGateIngestion({ sourceUniverse: required, sourceRightsRecords: notSupplied, asOf: AS_OF });
check(() => assert.strictEqual(missingResult.status, STATUS.HOLD_EXTERNAL_RIGHTS_AUTHORIZATION));
check(() => assert.strictEqual(missingResult.readyForC30GateIngestion, false));
check(() => assert.strictEqual(missingResult.requiredSourceCount, 6));
check(() => assert.strictEqual(missingResult.structurallyVerifiedSourceCount, 0));
check(() => assert(ids.every((sourceId) => missingResult.blockers.includes(`C49_EXTERNAL_RIGHTS_NOT_SUPPLIED:${sourceId}`))));
check(() => assert.strictEqual(missingResult.sourceRightsAuthorized, false));
check(() => assert.strictEqual(missingResult.sourceUseAuthorized, false));
check(() => assert.strictEqual(missingResult.redistributionAuthorized, false));

check(() => assert.throws(() => createExternalSourceRightsRecord({
  evidenceId: 'SOURCE_RIGHTS_AUTHORIZATION', candidateHeadSha: SHA, sourceId: ids[0], status: EXTERNAL_STATUS.NOT_SUPPLIED,
  reasonCode: 'NOT_SUPPLIED', evidenceRef: 'SYNTHETIC-APPROVAL',
}), /C49_NOT_SUPPLIED_MUST_NOT_CARRY_SYNTHETIC_RIGHTS_EVIDENCE/));
check(() => assert.throws(() => rightsRecord(ids[0], EXTERNAL_STATUS.SUPPLIED_VERIFIED, { apiKey: 'forbidden' }), /C49_SECRET_MATERIAL_FIELD_FORBIDDEN/));
check(() => assert.throws(() => rightsRecord('UNTRUSTED_SOURCE', EXTERNAL_STATUS.SUPPLIED_VERIFIED), /C49_NON_CANONICAL_SOURCE_ID/));

const structurallySupplied = ids.map((sourceId) => rightsRecord(sourceId, EXTERNAL_STATUS.SUPPLIED_VERIFIED));
const suppliedResult = evaluateExternalSourceRightsForGateIngestion({ sourceUniverse: required, sourceRightsRecords: structurallySupplied, asOf: AS_OF });
check(() => assert.strictEqual(suppliedResult.status, STATUS.READY_FOR_C30_GATE_INGESTION));
check(() => assert.strictEqual(suppliedResult.readyForC30GateIngestion, true));
check(() => assert.strictEqual(suppliedResult.structurallyVerifiedSourceCount, 6));
check(() => assert.strictEqual(suppliedResult.independentAuthorityStillMustBeValidatedByC30, true));
check(() => assert.strictEqual(suppliedResult.sourceRightsAuthorized, false));
check(() => assert.strictEqual(suppliedResult.sourceUseAuthorized, false));
check(() => assert.strictEqual(suppliedResult.redistributionAuthorized, false));
check(() => assert.strictEqual(suppliedResult.deploymentAuthorized, false));
check(() => assert.strictEqual(suppliedResult.commercialGoLiveAuthorized, false));

const incomplete = structurallySupplied.slice(0, -1);
const incompleteResult = evaluateExternalSourceRightsForGateIngestion({ sourceUniverse: required, sourceRightsRecords: incomplete, asOf: AS_OF });
check(() => assert.strictEqual(incompleteResult.status, STATUS.HOLD_EXTERNAL_RIGHTS_AUTHORIZATION));
check(() => assert(incompleteResult.blockers.includes(`C49_EXTERNAL_REQUIRED_SOURCE_MISSING:${ids[ids.length - 1]}`)));

const wrongShaRecords = [...structurallySupplied];
wrongShaRecords[0] = rightsRecord(ids[0], EXTERNAL_STATUS.SUPPLIED_VERIFIED, { candidateHeadSha: 'abcdefabcdefabcdefabcdefabcdefabcdefabcd' });
const wrongShaResult = evaluateExternalSourceRightsForGateIngestion({ sourceUniverse: required, sourceRightsRecords: wrongShaRecords, asOf: AS_OF });
check(() => assert(wrongShaResult.blockers.includes(`C49_EXTERNAL_BINDING_MISMATCH:${ids[0]}:candidateHeadSha`)));
check(() => assert.strictEqual(wrongShaResult.readyForC30GateIngestion, false));

const rejectedRecords = [...structurallySupplied];
rejectedRecords[0] = rightsRecord(ids[0], EXTERNAL_STATUS.REJECTED);
const rejectedResult = evaluateExternalSourceRightsForGateIngestion({ sourceUniverse: required, sourceRightsRecords: rejectedRecords, asOf: AS_OF });
check(() => assert.strictEqual(rejectedResult.status, STATUS.REJECTED));
check(() => assert(rejectedResult.blockers.some((item) => item.startsWith(`C49_EXTERNAL_RIGHTS_REJECTED:${ids[0]}:`))));
check(() => assert.strictEqual(rejectedResult.sourceUseAuthorized, false));

const expiredRecords = [...structurallySupplied];
expiredRecords[0] = rightsRecord(ids[0], EXTERNAL_STATUS.SUPPLIED_VERIFIED, { validUntil: '2026-10-04T09:30:00.000Z' });
const expiredResult = evaluateExternalSourceRightsForGateIngestion({ sourceUniverse: required, sourceRightsRecords: expiredRecords, asOf: AS_OF });
check(() => assert(expiredResult.blockers.includes(`C49_EXTERNAL_RIGHTS_EXPIRED:${ids[0]}`)));
check(() => assert.strictEqual(expiredResult.readyForC30GateIngestion, false));

const runtime = evaluateProductionSourceUseAuthorization({ sourceUniverse: required, sourceRightsRecords: structurallySupplied, asOf: AS_OF });
check(() => assert.strictEqual(runtime.status, STATUS.HOLD_EXTERNAL_RIGHTS_AUTHORIZATION));
check(() => assert(runtime.blockers.includes('C49_C30_GATE_AUTHORITY_NOT_CONSUMED')));
check(() => assert(runtime.blockers.includes('C49_PRODUCTION_SOURCE_USE_REQUIRES_SEPARATE_ACTIVATION')));
check(() => assert.strictEqual(runtime.productionSourceUseAllowed, false));
check(() => assert.strictEqual(runtime.sourceUseAuthorized, false));
check(() => assert.strictEqual(runtime.redistributionAuthorized, false));
check(() => assert.strictEqual(runtime.deploymentAuthorized, false));
check(() => assert.strictEqual(runtime.commercialGoLiveAuthorized, false));

const catalog = read('src/sources/saudi-official-source-catalog.js');
check(() => assert(catalog.includes('discovery/governance metadata, not')));
check(() => assert(catalog.includes("integrationStatus: 'NOT_CONFIGURED'")));

const evidence = JSON.parse(read('release/evidence/c49-internal-official-source-data-rights-readiness.json'));
check(() => assert.strictEqual(evidence.externalGateId, 548));
check(() => assert.strictEqual(evidence.requiredExternalSourceCount, 6));
for (const field of ['externalSourceRightsAuthorizationSupplied', 'gate548Satisfied', 'sourceRightsAuthorized', 'sourceUseAuthorized', 'redistributionAuthorized', 'deploymentAuthorized', 'commercialGoLiveAuthorized']) {
  check(() => assert.strictEqual(evidence[field], false, `${field} must remain false`));
}

const docs = read('docs/C49_INTERNAL_OFFICIAL_SOURCE_DATA_RIGHTS_READINESS.md');
check(() => assert(docs.includes('does not satisfy external gate #548')));
check(() => assert(docs.includes('Public visibility is not source-rights authorization')));
check(() => assert(docs.includes('does not create a licence')));
check(() => assert(docs.includes('C30 remains HOLD')));

const workflow = read('.github/workflows/c49-internal-official-source-data-rights-readiness.yml');
const immutableUse = /^\s*-?\s*uses:\s*[^\s@]+@[a-f0-9]{40}\s*$/i;
const usesLines = workflow.split(/\r?\n/).filter((line) => /^\s*-?\s*uses:/.test(line));
check(() => assert(usesLines.length > 0));
usesLines.forEach((line) => check(() => assert(immutableUse.test(line), `mutable action reference: ${line.trim()}`)));
check(() => assert(workflow.includes('C49_GATE_548_SATISFIED=FALSE')));
check(() => assert(workflow.includes('C49_SOURCE_USE_AUTHORIZED=FALSE')));
check(() => assert(workflow.includes('C49_REDISTRIBUTION_AUTHORIZED=FALSE')));

console.log(`C49_INTERNAL_OFFICIAL_SOURCE_DATA_RIGHTS_READINESS=PASS checks=${checks}`);
console.log('C49_READY_FOR_INDEPENDENT_SOURCE_RIGHTS_REVIEW=PASS');
console.log('C49_GATE_548_SATISFIED=FALSE');
console.log('C49_SOURCE_USE_AUTHORIZED=FALSE');
console.log('C49_REDISTRIBUTION_AUTHORIZED=FALSE');
console.log('C49_DEPLOYMENT_AUTHORIZED=FALSE');
console.log('C49_COMMERCIAL_GO_LIVE_AUTHORIZED=FALSE');
