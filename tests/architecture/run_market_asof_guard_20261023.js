'use strict';
const assert=require('node:assert/strict');
const {createComparableEvidenceRecord,evaluateComparableSetQuality,MARKET_EVIDENCE_LEVEL,MARKET_TRANSACTION_TYPE,MARKET_VERIFICATION_STATUS}=require('../../src/market');
const record=createComparableEvidenceRecord({
 comparableId:'TEST-1',caseId:'SYNTHETIC-CASE',sourcePropertyRef:'SYNTH-PROPERTY',
 assetType:'OFFICE',transactionType:MARKET_TRANSACTION_TYPE.SALE,
 evidenceLevel:MARKET_EVIDENCE_LEVEL.VERIFIED_TRANSACTION,
 sourceName:'SYNTHETIC TEST',sourceRef:'test://source',
 sourceDate:'2026-07-03T00:00:00Z',transactionDate:'2026-07-01T00:00:00Z',
 capturedAt:'2026-07-06T00:00:00Z',
 location:{city:'Riyadh',district:'Fixture'},areaSqm:100,amountSar:1000,
 verification:{status:MARKET_VERIFICATION_STATUS.VERIFIED,verifiedByRef:'test-reviewer',
  verifiedAt:'2026-07-04T00:00:00Z',evidenceRef:'test://review'}
});
const check=asOfDate=>evaluateComparableSetQuality({
 caseId:'SYNTHETIC-CASE',records:[record],asOfDate,maxAgeDays:365,
 minimumComparableCount:1,minimumEvidenceLevel:MARKET_EVIDENCE_LEVEL.VERIFIED_OFFER
});
const historic=check('2026-07-02T00:00:00Z');
assert.equal(historic.status,'HOLD_INSUFFICIENT_EVIDENCE');
assert(historic.blockers.includes('FUTURE_KNOWLEDGE_COMPARABLE:TEST-1'));
assert.deepEqual(historic.qualifiedComparableIds,[]);
assert.equal(historic.recordQuality[0].futureKnowledge,true);
const capturedLater=check('2026-07-05T00:00:00Z');
assert(capturedLater.blockers.includes('FUTURE_KNOWLEDGE_COMPARABLE:TEST-1'));
const valid=check('2026-07-07T00:00:00Z');
assert.equal(valid.recordQuality[0].futureKnowledge,false);
assert.deepEqual(valid.qualifiedComparableIds,['TEST-1']);
assert.equal(valid.professionalMarketUseAuthorized,false);
console.log('MARKET_ASOF_LOOKAHEAD_GUARD=PASS checks=8');
