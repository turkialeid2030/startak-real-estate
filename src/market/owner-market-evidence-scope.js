'use strict';
// Binding of USER-ASSERTED research rows to the subject they were entered for.
// This is a presentation/persistence safeguard; it never authenticates a
// transaction, source, deed, licence or the property's physical identity.
const {extractCoordinates}=require('./instant-market-study');
const normalize=value=>String(value??'').normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
function marketEvidenceSubjectKey(subject={}){
 const coord=extractCoordinates(subject.location||'');
 const place=coord?coord.lat.toFixed(6)+','+coord.lng.toFixed(6):
   normalize(subject.location);
 // Only identity-related fields; valuation-date changes retain the same
 // parcel/case ownership, but recalculate market eligibility separately.
 return JSON.stringify([
  normalize(subject.name),normalize(subject.assetType),normalize(subject.city),
  normalize(subject.district),place,normalize(subject.propertyRight)
 ]);
}
function hasEnteredComparable(row){
 if(!row||typeof row!=='object'||Array.isArray(row))return false;
 // Ignore the three blank editor rows and their default ASKING status.
 // Any user-entered source, financial, geography or asset field counts.
 return ['sourceRecordId','assetType','landSubtype','price','annualRent',
  'builtArea','landArea','date','location','city','district','sourceUrl']
  .some(key=>String(row[key]??'').trim()!=='');
}
function hasResearchComparables(sales=[],rentals=[]){
 return [sales,rentals].some(rows=>Array.isArray(rows)&&rows.some(hasEnteredComparable));
}
module.exports={marketEvidenceSubjectKey,hasEnteredComparable,hasResearchComparables};
