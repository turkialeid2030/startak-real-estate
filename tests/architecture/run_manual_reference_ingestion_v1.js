'use strict';
const assert = require('assert');
const {
  INGESTION_MODE,
  INGESTION_STATUS,
  createManualReferenceRecord,
  qualifyReferenceForDecision,
} = require('../../src/source-ingestion/manual-reference-ingestion');

let checks = 0;
function check(fn) { fn(); checks++; }

const accepted = createManualReferenceRecord({
  sourceId: 'SRC-SA-REGA',
  sourceName: 'Real Estate General Authority',
  sourceUrl: 'https://rega.gov.sa/',
  mode: INGESTION_MODE.MANUAL_REFERENCE_ONLY,
  retrievedAt: '2026-09-01',
  suppliedBy: 'USER_OR_ANALYST',
  lastVerifiedDate: '2026-09-01',
  authorityClass: 'OFFICIAL_TRUTH_REFERENCE',
});
check(() => assert.strictEqual(accepted.status, INGESTION_STATUS.ACCEPTED_REFERENCE));
check(() => assert.strictEqual(accepted.liveConnected, false));
check(() => assert.strictEqual(accepted.officialApiUsed, false));
check(() => assert.strictEqual(accepted.claimBoundary.isOfficialIntegration, false));
check(() => assert.strictEqual(accepted.claimBoundary.isLiveDataFeed, false));
check(() => assert.strictEqual(accepted.claimBoundary.mayBeUsedAsReferenceEvidence, true));

const liveClaim = createManualReferenceRecord({
  sourceId: 'SRC-X', sourceName: 'X', sourceUrl: 'https://example.com',
  retrievedAt: '2026-09-01', suppliedBy: 'USER', liveConnected: true,
});
check(() => assert.strictEqual(liveClaim.status, INGESTION_STATUS.REJECT_LIVE_INTEGRATION_CLAIM));

const missingMeta = createManualReferenceRecord({ sourceName: 'X', sourceUrl: 'https://example.com' });
check(() => assert.strictEqual(missingMeta.status, INGESTION_STATUS.HOLD_SOURCE_METADATA));

const missingProv = createManualReferenceRecord({
  sourceId: 'SRC-X', sourceName: 'X', retrievedAt: '2026-09-01', suppliedBy: 'USER',
});
check(() => assert.strictEqual(missingProv.status, INGESTION_STATUS.HOLD_PROVENANCE));

const qualified = qualifyReferenceForDecision({ record: accepted, requiredFreshnessDate: '2026-08-01' });
check(() => assert.strictEqual(qualified.qualified, true));
check(() => assert.strictEqual(qualified.liveConnected, false));

const stale = qualifyReferenceForDecision({ record: accepted, requiredFreshnessDate: '2026-10-01' });
check(() => assert.strictEqual(stale.qualified, false));
check(() => assert.strictEqual(stale.status, 'HOLD_STALE_REFERENCE'));

const effectiveRequired = qualifyReferenceForDecision({ record: accepted, requireEffectiveDate: true });
check(() => assert.strictEqual(effectiveRequired.qualified, false));
check(() => assert.strictEqual(effectiveRequired.status, 'HOLD_EFFECTIVE_DATE'));

console.log(`MANUAL_REFERENCE_INGESTION_V1: PASS (${checks} checks)`);
