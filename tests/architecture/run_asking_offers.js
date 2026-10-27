'use strict';
const assert=require('node:assert/strict');
const {reviewMarketOffers,importOfferRowsCsv}=require('../../src/market/asking-offers');
const asOf=new Date('2026-10-27T12:00:00Z');
const base={assetType:'COMMERCIAL_COMPLEX',city:'جدة',district:'السلامة',
 location:'21.580000,39.150000',landArea:'2000',builtArea:'4500',rentableArea:'3000'};
const sale=i=>({
 assetType:'COMMERCIAL_COMPLEX',offerKind:'SALE',evidenceType:'ASKING',
 date:'2026-10-12',sourceUrl:'https://sa.aqar.fm/a/'+i,
 price:String([12000000,15000000,18000000][i-1]),builtArea:'3000',
 city:'جدة',district:'السلامة',location:'',availability:'ACTIVE',
});
const rent=i=>({
 assetType:'COMMERCIAL_COMPLEX',offerKind:'RENT',evidenceType:'ASKING',
 date:'2026-10-12',sourceUrl:'https://sa.aqar.fm/r/'+i,
 annualRent:String([10000,12000,14000][i-1]),rentableArea:'100',
 rentPeriod:'MONTH',city:'جدة',district:'السلامة',location:'',availability:'ACTIVE',
});
const report=reviewMarketOffers({subject:base,asOf,offers:[sale(1),sale(2),sale(3),rent(1),rent(2),rent(3)]});
assert.equal(report.askingSales.acceptedOffers,3);
assert.equal(report.askingSales.medianAskingSarPerSqm,5000);
assert.equal(report.askingRentalsAnnual.acceptedOffers,3);
assert.equal(report.askingRentalsAnnual.medianAskingSarPerSqm,1440);
assert.equal(report.canEstimateExecutedSalePrice,false);
assert.equal(report.canEstimateContractedMarketRent,false);
assert.equal(report.safeToUseAsPrimaryValue,false);
const duplicated=reviewMarketOffers({subject:base,offers:[...Array.from({length:3},(_,i)=>sale(i+1)),sale(1)],asOf});
assert.equal(duplicated.askingSales.acceptedOffers,3);
assert.equal(duplicated.rejectedReasons.DUPLICATE_SOURCE,1);
const stale=reviewMarketOffers({subject:base,offers:[sale(1),sale(2),{...sale(3),date:'2024-01-01'}],asOf});
assert.equal(stale.askingSales.medianAskingSarPerSqm,null);
const wrongType=reviewMarketOffers({subject:base,offers:[sale(1),sale(2),{...sale(3),assetType:'HOTEL'}],asOf});
assert.equal(wrongType.askingSales.acceptedOffers,2);
const official=reviewMarketOffers({subject:base,offers:[sale(1),sale(2),{...sale(3),evidenceType:'EXECUTED'}],asOf});
assert.equal(official.askingSales.acceptedOffers,2,'executed input belongs to deeds, never classified as offer');
const distant=reviewMarketOffers({subject:base,offers:[sale(1),sale(2),{...sale(3),location:'24.7,46.7'}],asOf});
assert.equal(distant.askingSales.acceptedOffers,2);
const wrongCity=reviewMarketOffers({subject:{...base,city:'الرياض'},offers:[sale(1),sale(2),sale(3)],asOf});
assert.equal(wrongCity.askingSales.acceptedOffers,0);
const otherCity=reviewMarketOffers({subject:{...base,city:'مكة المكرمة',district:'العزيزية'},
 offers:[sale(1),sale(2),sale(3)].map((x,i)=>({...x,city:'مكة المكرمة',district:'العزيزية',
 sourceUrl:'https://sa.aqar.fm/m/'+i})),asOf});
assert.equal(otherCity.askingSales.acceptedOffers,3,'not hard-coded to one city');
const factory=reviewMarketOffers({subject:{...base,assetType:'INDUSTRIAL_PROPERTY'},
 offers:[sale(1),sale(2),sale(3)].map((x,i)=>({...x,assetType:'INDUSTRIAL_PROPERTY',
 sourceUrl:'https://example.org/industrial/'+i})),asOf});
assert.equal(factory.askingSales.acceptedOffers,3);
const seasonal=reviewMarketOffers({subject:base,offers:[rent(1),rent(2),{...rent(3),rentPeriod:'DAY'}],asOf});
assert.equal(seasonal.askingRentalsAnnual.acceptedOffers,2);
const missingSource=reviewMarketOffers({subject:base,offers:[sale(1),sale(2),{...sale(3),sourceUrl:''}],asOf});
assert.equal(missingSource.askingSales.acceptedOffers,2);
const csv=[
'نوع العرض,نوع العقار,حالة السعر,تاريخ الإعلان,رابط الإعلان,السعر المطلوب,المساحة المبنية,المدينة,الحي',
'بيع,مجمع تجاري,عرض,2026-10-12,https://sa.aqar.fm/list/1,12000000,3000,جدة,السلامة',
'بيع,مجمع تجاري,منفذ,2026-10-12,https://sa.aqar.fm/list/2,15000000,3000,جدة,السلامة',
].join('\n');
const imported=importOfferRowsCsv(csv);
assert.equal(imported.offers.length,2);
assert.equal(imported.offers[0].offerKind,'SALE');
assert.equal(imported.offers[0].assetType,'COMMERCIAL_COMPLEX');
assert.equal(imported.offers[0].evidenceType,'ASKING');
assert.equal(imported.offers[1].evidenceType,'UNVERIFIED');
assert.equal(reviewMarketOffers({subject:base,offers:imported.offers,asOf}).askingSales.acceptedOffers,1);
console.log('STARTAK_ASKING_OFFER_EVIDENCE=PASS');
