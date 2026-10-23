'use strict';
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {
  MARKET_EVIDENCE_LEVEL:LEVEL, MARKET_TRANSACTION_TYPE:TYPE,
  MARKET_VERIFICATION_STATUS:VER,
  createComparableEvidenceRecord, assertComparableRecordIntegrity,
  evaluateComparableSetQuality
}=require('../../src/market');
const stableClone=x=>Array.isArray(x)?x.map(stableClone):(x&&typeof x==='object')?Object.keys(x).sort().reduce((r,k)=>(r[k]=stableClone(x[k]),r),{}):x;
const sha=x=>createHash('sha256').update(JSON.stringify(stableClone(x))).digest('hex');
function sample(id){
  return createComparableEvidenceRecord({
    comparableId:id,caseId:'CASE-X',sourcePropertyRef:'PROP-'+id,assetType:'OFFICE',
    transactionType:TYPE.SALE,evidenceLevel:LEVEL.VERIFIED_TRANSACTION,
    sourceName:'SYNTHETIC — NOT AN OFFICIAL RECORD',sourceRef:'synthetic://'+id,
    sourceDate:'2026-07-03T00:00:00Z',transactionDate:'2026-07-01T00:00:00Z',
    location:{city:'Riyadh',district:'Synthetic'},areaSqm:1000,amountSar:10000000,
    verification:{status:VER.VERIFIED,verifiedByRef:'SYNTHETIC-REVIEWER',
      verifiedAt:'2026-07-04T00:00:00Z',evidenceRef:'synthetic://review/'+id},
    capturedAt:'2026-07-06T00:00:00Z'
  });
}
const record=sample('C1');
const quality=records=>evaluateComparableSetQuality({
  caseId:'CASE-X',records,asOfDate:'2026-09-07T00:00:00Z',
  maxAgeDays:365,minimumComparableCount:1,
  minimumEvidenceLevel:LEVEL.VERIFIED_OFFER
});
assert.equal(assertComparableRecordIntegrity(record),true);
const valid=quality([record]);
assert.equal(valid.status,'QUALIFIED_FOR_PROFESSIONAL_SELECTION');
for(const key of ['sourceUsageRightsEstablished','officialSourceAuthenticationEstablished','professionalMarketUseAuthorized','certifiedValuationEstablished']){
  assert.equal(valid[key],false,'analytics quality cannot grant '+key);
}
const alteredAmount={...record,amountSar:50000000};
assert.throws(()=>quality([alteredAmount]),/COMPARABLE_INTEGRITY_MISMATCH/);
const alteredRank={...record,evidenceRank:999999};
assert.throws(()=>quality([alteredRank]),/COMPARABLE_INTEGRITY_MISMATCH/);
const alteredVerifier={...record,verification:{...record.verification,verifiedByRef:'IMPERSONATED-REVIEWER'}};
assert.throws(()=>quality([alteredVerifier]),/COMPARABLE_INTEGRITY_MISMATCH/);
const alteredGeo={...record,location:{...record.location,city:'Another City'}};
assert.throws(()=>quality([alteredGeo]),/COMPARABLE_INTEGRITY_MISMATCH/);
assert.throws(()=>quality([{...record,comparableHashSha256:'invalid'}]),/COMPARABLE_DIGEST_MISSING/);
const recomputedRank={...record,evidenceRank:999999};
delete recomputedRank.comparableHashSha256;recomputedRank.comparableHashSha256=sha(recomputedRank);
assert.throws(()=>quality([recomputedRank]),/COMPARABLE_EVIDENCE_RANK_MISMATCH/);
const recomputedUnit={...record,unitValueSarPerSqm:1};
delete recomputedUnit.comparableHashSha256;recomputedUnit.comparableHashSha256=sha(recomputedUnit);
assert.throws(()=>quality([recomputedUnit]),/COMPARABLE_UNIT_VALUE_MISMATCH/);
assert.throws(()=>quality([record,record]),/DUPLICATE_COMPARABLE_ID/);
const source2=sample('C2');
assert.equal(quality([record,source2]).status,'QUALIFIED_FOR_PROFESSIONAL_SELECTION');
function make({verifiedAt,transactionDate='2026-07-01T00:00:00Z'}){
  return createComparableEvidenceRecord({
    comparableId:'C-DATE',caseId:'CASE-X',sourcePropertyRef:'P-DATE',assetType:'OFFICE',
    transactionType:TYPE.SALE,evidenceLevel:LEVEL.VERIFIED_TRANSACTION,
    sourceName:'SYNTHETIC',sourceRef:'test',sourceDate:'2026-07-03T00:00:00Z',
    transactionDate,location:{city:'Riyadh',district:'Synthetic'},
    areaSqm:100,amountSar:1000,capturedAt:'2026-07-06T00:00:00Z',
    verification:{status:VER.VERIFIED,verifiedByRef:'synthetic',verifiedAt,evidenceRef:'test'}
  });
}
assert.throws(()=>make({verifiedAt:'2026-07-07T00:00:00Z'}),/MARKET_REVIEW_AFTER_CAPTURE/);
assert.throws(()=>make({verifiedAt:'2026-06-30T00:00:00Z'}),/MARKET_REVIEW_BEFORE_TRANSACTION/);
assert.equal(assertComparableRecordIntegrity(make({verifiedAt:'2026-07-05T00:00:00Z'})),true);
console.log('MARKET_COMPARABLE_INTEGRITY_AND_TEMPORAL_REVIEW=PASS checks=16');
