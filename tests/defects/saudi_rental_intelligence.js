'use strict';
const assert=require('node:assert/strict');
const {VERSION,KINDS,evaluateRentalIntelligence}=require('../../src/reporting/saudi-rental-intelligence');
const {renderExternalReview}=require('../../src/reporting/reporting-studio');
let cases=0,checks=0;
function eq(a,b){assert.equal(a,b);checks++;}
function ok(a){assert.ok(a);checks++;}
function denied(fn){assert.throws(fn);cases++;checks++;}
const seg={id:'S1',kind:'OFFICE',subtype:'GRADE-A',areaBasis:'NLA',areaPerUnitSqm:100,unitCount:10,propertyRight:'FREEHOLD_PROPERTY_LEASE',occupancy:.9,collection:.98,contractAnnualExVatSar:90000,contractRef:'SYNTH-CURRENT'};
const comp={sourceUrl:'https://example.com/synthetic-rental',status:'EXECUTED',kind:'OFFICE',subtype:'GRADE-A',city:'SYNTH-CITY',district:'SYNTH-DISTRICT',location:null,areaBasis:'NLA',areaSqm:100,propertyRight:'FREEHOLD_PROPERTY_LEASE',date:'2026-01-01',observedDate:'2026-01-02',periodMonths:12,vatBasis:'EXCLUDED',declaredVatRate:null,vatRef:null,rentOnly:true,usageRightsDeclared:true,adjustments:[]};
const comps=[10000,11000,12000].map((rentAmountSar,i)=>({...comp,sourceRecordId:'REC-'+i,contractRef:'LEASE-'+i,rentAmountSar}));
const base={version:VERSION,propertyRef:'SYNTH-P',valuationDate:'2026-01-05',city:comp.city,district:comp.district,location:null,segmentsNonOverlapping:true,segments:[seg],comparables:comps};
function run(x){cases++;const r=evaluateRentalIntelligence(x);for(const k of ['liveSourceConnected','sourceAuthenticated','professionalValuationCertified','transactionAuthorized','canonicalModelUpdated'])eq(r[k],false);eq(r.legalRentExVatSar,null);eq(r.applicableVatRate,null);return r;}
const a=run(base);eq(a.total.annualRentExVatSar,110000);eq(a.total.monthlyRentExVatSar,9166.67);eq(a.total.rateSarPerSqmYear,110);eq(a.total.occupiedRentSar,99000);eq(a.total.expectedCollectionsSar,97020);eq(a.total.contractGapSar,20000);eq(a.total.observedAdjustedMinAnnualSar,100000);eq(a.total.observedAdjustedMaxAnnualSar,120000);eq(a.segments[0].result.rateSarPerSqmMonth,9.17);eq(a.segments[0].result.annualRentPerUnitSar,11000);
for(const kind of KINDS){const areaBasis=kind==='LAND'?'LAND_AREA':'NLA';const r=run({...base,segments:[{...seg,kind,areaBasis}],comparables:comps.map(c=>({...c,kind,areaBasis}))});eq(r.total.annualRentExVatSar,110000);}
const v=run({...base,comparables:comps.map(c=>({...c,rentAmountSar:c.rentAmountSar*1.15/12>0?Math.round(c.rentAmountSar*1.15*100)/100:c.rentAmountSar,vatBasis:'INCLUDED',declaredVatRate:.15,vatRef:'SYNTH-VAT'}))});eq(v.total.annualRentExVatSar,110000);
const monthly=run({...base,comparables:comps.map(c=>({...c,rentAmountSar:1000,periodMonths:1}))});eq(monthly.total.annualRentExVatSar,120000);
const adjusted=run({...base,comparables:comps.map(c=>({...c,adjustments:[{category:'TIME',fraction:.1,evidenceRef:'SYNTH-T'},{category:'QUALITY',fraction:-.05,evidenceRef:'SYNTH-Q'}]}))});eq(adjusted.total.annualRentExVatSar,115500);
const ask={...comps[0],sourceRecordId:'ASK-1',contractRef:'ASK-1',status:'ASKING',rentAmountSar:90000};
const offers=run({...base,comparables:[...comps,ask]});eq(offers.total.annualRentExVatSar,110000);eq(offers.segments[0].offerMedianRateSar,900);
const only=run({...base,comparables:comps.map(c=>({...c,status:'ASKING'}))});eq(only.total,null);eq(only.segments[0].askingCount,3);
for(const patch of [{date:'2026-01-06'},{observedDate:'2026-01-06'},{observedDate:'2025-12-31'},{date:'2024-01-01'},{city:'OTHER'},{district:'OTHER'},{areaSqm:10},{rentOnly:false},{usageRightsDeclared:false},{vatBasis:'UNKNOWN'},{status:'UNKNOWN'},{kind:'VILLA'},{subtype:'OTHER'},{areaBasis:'WHOLE_LEASE_AREA'}]){
 const r=run({...base,comparables:[...comps.slice(0,2),{...comps[2],...patch}]});eq(r.total,null);eq(r.segments[0].executedCount,2);
}
const far=run({...base,location:{lat:24.7,lng:46.7},comparables:[...comps.slice(0,2),{...comps[2],location:{lat:21.5,lng:39.2}}]});eq(far.total,null);eq(far.segments[0].excluded.DISTANCE,1);
const dup=run({...base,comparables:[...comps,{...comps[0],sourceUrl:'https://example.org/synthetic',sourceRecordId:'CROSS'}]});eq(dup.segments[0].executedCount,3);eq(dup.total.annualRentExVatSar,110000);
for(const patch of [{rentAmountSar:10001},{status:'ASKING'},{observedDate:'2026-01-03'},{contractRef:'OTHER'}]){const r=run({...base,comparables:[...comps,{...comps[0],...patch}]});eq(r.total,null);ok(r.issues.some(i=>i.code==='RENT_SOURCE_CONFLICT'));}
const second={...seg,id:'S2',kind:'LAND',subtype:'SYNTH-LAND',areaBasis:'LAND_AREA',unitCount:1,contractAnnualExVatSar:null,contractRef:null};
const land=comps.map((c,i)=>({...c,sourceRecordId:'L-'+i,contractRef:'L-'+i,kind:'LAND',subtype:'SYNTH-LAND',areaBasis:'LAND_AREA'}));
const mix=run({...base,segments:[seg,second],comparables:[...comps,...land]});eq(mix.total.annualRentExVatSar,121000);eq(mix.total.rateSarPerSqmYear,null);eq(mix.total.contractGapSar,null);
eq(run({...base,segments:[seg,second]}).total,null);
for(const patch of [{segmentsNonOverlapping:false},{valuationDate:'2026-02-30'},{segments:[]},{segments:[seg,seg]},{segments:[{...seg,areaPerUnitSqm:0}]},{segments:[{...seg,occupancy:1.1}]},{segments:[{...seg,contractRef:null}]},{segments:[{...seg,kind:'HOTEL_PROPERTY',propertyRight:'BUSINESS'}]},{segments:[{...seg,kind:'LAND'}]},{comparables:[{...comps[0],sourceUrl:'http://example.com'}]},{comparables:[{...comps[0],sourceUrl:'https://example.com/?token=secret'}]},{comparables:[{...comps[0],periodMonths:2}]},{comparables:[{...comps[0],vatBasis:'INCLUDED'}]},{comparables:[{...comps[0],rentAmountSar:.001}]},{comparables:[{...comps[0],adjustments:[{category:'TIME',fraction:.1,evidenceRef:'A'},{category:'TIME',fraction:.2,evidenceRef:'B'}]}]},{comparables:[{...comps[0],adjustments:[{category:'TIME',fraction:.5,evidenceRef:'A'},{category:'SIZE',fraction:.5,evidenceRef:'B'}]}]}])denied(()=>evaluateRentalIntelligence({...base,...patch}));
for(const locale of ['ar-SA','en'])for(const input of [{...base,propertyRef:'<script>bad</script>'},{...base,comparables:[]}]){
 cases++;const r=renderExternalReview(input,{locale});ok(!r.html.includes('<script>'));ok(r.html.includes(locale==='en'?'dir="ltr"':'dir="rtl"'));eq(r.report.transactionAuthorized,false);eq(r.report.liveSourceConnected,false);if(input.comparables.length)ok(r.html.includes('&lt;script&gt;'));else eq(r.report.total,null);
}
console.log('SAUDI_RENTAL_INTELLIGENCE=PASS cases='+cases+' checks='+checks);
