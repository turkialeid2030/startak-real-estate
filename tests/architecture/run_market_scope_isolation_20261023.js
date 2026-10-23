'use strict';
const assert=require('node:assert/strict');
const {
 MARKET_EVIDENCE_LEVEL:LEVEL, MARKET_TRANSACTION_TYPE:TYPE,
 MARKET_VERIFICATION_STATUS:VER, COMPARABLE_QUALITY_STATUS:STATUS,
 createComparableEvidenceRecord,evaluateComparableSetQuality
}=require('../../src/market');
let checks=0;
function check(a,b,msg){assert.deepEqual(a,b,msg);checks++;}
function cmp(id,opts={}){
 return createComparableEvidenceRecord({
   comparableId:id,caseId:'CASE-1',sourcePropertyRef:'PROP-'+id,
   assetType:opts.assetType||'OFFICE',
   transactionType:opts.transactionType||TYPE.SALE,
   evidenceLevel:LEVEL.VERIFIED_TRANSACTION,
   sourceName:'SYNTHETIC-ONLY',sourceRef:'test://'+id,
   sourceDate:'2026-07-03T00:00:00Z',
   transactionDate:'2026-07-01T00:00:00Z',
   capturedAt:'2026-07-06T00:00:00Z',
   location:{city:opts.city||'Riyadh',district:opts.district||'Olaya'},
   areaSqm:1000,amountSar:10000000,
   verification:{status:VER.VERIFIED,verifiedByRef:'TEST',verifiedAt:'2026-07-05T00:00:00Z',evidenceRef:'test://'+id}
 });
}
const base=(records,params={})=>evaluateComparableSetQuality({
 caseId:'CASE-1',records,asOfDate:'2026-09-07T00:00:00Z',maxAgeDays:365,
 minimumComparableCount:1,minimumEvidenceLevel:LEVEL.VERIFIED_OFFER,
 ...params
});
const a=cmp('OFFICE-SALE');
const b=cmp('WAREHOUSE',{assetType:'WAREHOUSE'});
const c=cmp('RENT',{transactionType:TYPE.RENT});
const d=cmp('JEDDAH',{city:'Jeddah'});
const e=cmp('OLAYA-2',{district:'Malaz'});
check(base([a]).status,STATUS.QUALIFIED_FOR_PROFESSIONAL_SELECTION,'single synthetic quality survives');
const mixedAsset=base([a,b]);
check(mixedAsset.status,STATUS.HOLD_QUALITY,'mixed asset types should not pass quality');
check(mixedAsset.qualifiedComparableIds,['OFFICE-SALE'],'wrong asset does not count');
check(mixedAsset.blockers.includes('COMPARABLE_ASSET_TYPE_MISMATCH:WAREHOUSE'),true);
const mixedTransaction=base([a,c]);
check(mixedTransaction.status,STATUS.HOLD_QUALITY);
check(mixedTransaction.qualifiedComparableIds,['OFFICE-SALE']);
check(mixedTransaction.blockers.includes('COMPARABLE_TRANSACTION_TYPE_MISMATCH:RENT'),true);
const mixedCity=base([a,d]);
check(mixedCity.status,STATUS.HOLD_QUALITY);
check(mixedCity.qualifiedComparableIds,['OFFICE-SALE']);
check(mixedCity.blockers.includes('COMPARABLE_CITY_OUTSIDE_SCOPE:JEDDAH'),true);
const explicitlyWider=base([a,d],{
 targetAssetType:'office',targetTransactionType:TYPE.SALE,
 targetCity:'Riyadh',allowedComparableCities:['Jeddah']
});
check(explicitlyWider.status,STATUS.QUALIFIED_FOR_PROFESSIONAL_SELECTION);
check(explicitlyWider.qualifiedComparableIds,['OFFICE-SALE','JEDDAH']);
check(explicitlyWider.subjectScope.callerSpecified,true);
check(explicitlyWider.subjectScope.independentSubjectVerificationEstablished,false);
check(explicitlyWider.professionalMarketUseAuthorized,false);
const district=base([a,e],{
 targetAssetType:'OFFICE',targetTransactionType:TYPE.SALE,targetCity:'Riyadh',targetDistrict:'Olaya'
});
check(district.status,STATUS.QUALIFIED_FOR_PROFESSIONAL_SELECTION);
check(district.warnings.includes('COMPARABLE_DISTRICT_ADJUSTMENT_REVIEW:OLAYA-2'),true);
check(district.qualifiedComparableIds,['OFFICE-SALE','OLAYA-2']);
const wrongExplicitTarget=base([a],{
 targetAssetType:'LAND',targetTransactionType:TYPE.SALE,targetCity:'Riyadh'
});
check(wrongExplicitTarget.status,STATUS.HOLD_INSUFFICIENT_EVIDENCE);
check(wrongExplicitTarget.qualifiedComparableIds,[]);
check(wrongExplicitTarget.blockers.includes('COMPARABLE_ASSET_TYPE_MISMATCH:OFFICE-SALE'),true);
const empty=base([]);
check(empty.status,STATUS.HOLD_INSUFFICIENT_EVIDENCE);
assert.throws(()=>base([a],{allowedComparableCities:['Jeddah']}),/ALLOWED_CITIES_REQUIRE_TARGET_CITY/);checks++;
assert.throws(()=>base([a],{targetCity:'  '}),/targetCity must be null/);checks++;
assert.throws(()=>base([a],{targetTransactionType:'BID'}),/targetTransactionType is invalid/);checks++;
assert.throws(()=>base([a],{allowedComparableCities:['']}),/allowedComparableCities must be/);checks++;
const inverted=base([d,a],{targetAssetType:'OFFICE',targetTransactionType:TYPE.SALE,targetCity:'Riyadh'});
check(inverted.status,STATUS.HOLD_QUALITY);
check(inverted.qualifiedComparableIds,['OFFICE-SALE']);
console.log('MARKET_COMPARABLE_SCOPE_ISOLATION=PASS checks='+checks);
