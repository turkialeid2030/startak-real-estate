'use strict';
const assert=require('node:assert/strict');
const {buildRentalWorkspaceInput,evaluateWorkspace,parseLocalRentalJson}=require('../../src/reporting/rental-workspace-input');
const {VERSION,SOURCES,reviewRentIndicator}=require('../../src/reporting/saudi-rent-indicator-snapshot');
let cases=0,checks=0;
const eq=(a,b)=>{assert.equal(a,b);checks++};
const ok=a=>{assert.ok(a);checks++};
const deny=fn=>{assert.throws(fn);cases++;checks++};
const s={id:'S1',kind:'OFFICE',subtype:'GRADE-A',areaBasis:'NLA',areaPerUnitSqm:'١٠٠',unitCount:'10',occupancy:'90',collection:'98',contractAnnualExVatSar:'90000',contractRef:'CUR'};
const c={sourceUrl:'https://example.com/synthetic',sourceRecordId:'REC',contractRef:'LEASE',status:'EXECUTED',kind:'OFFICE',subtype:'GRADE-A',city:'SYNTH-CITY',district:'SYNTH-DISTRICT',lat:'',lng:'',areaBasis:'NLA',areaSqm:'100',date:'2026-01-01',observedDate:'2026-01-02',rentAmountSar:'10000',periodMonths:'12',vatBasis:'EXCLUDED',declaredVatRate:'',vatRef:'',rentOnly:true,usageRightsDeclared:true,adjustments:[]};
const base={propertyRef:'SYNTH-P',valuationDate:'2026-01-05',city:c.city,district:c.district,lat:'',lng:'',segmentsNonOverlapping:true,segments:[s],comparables:['10000','11000','12000'].map((rentAmountSar,i)=>({...c,rentAmountSar,sourceRecordId:'R'+i,contractRef:'C'+i}))};
const r=evaluateWorkspace(base);cases++;eq(r.total.annualRentExVatSar,110000);eq(r.total.expectedCollectionsSar,97020);eq(r.total.contractGapSar,20000);eq(r.liveSourceConnected,false);eq(r.sourceAuthenticated,false);
const x=buildRentalWorkspaceInput(base);cases++;eq(x.segments[0].areaPerUnitSqm,100);eq(x.segments[0].occupancy,.9);eq(x.location,null);
const tax=evaluateWorkspace({...base,comparables:base.comparables.map(v=>({...v,rentAmountSar:String(Number(v.rentAmountSar)*115/100),vatBasis:'INCLUDED',declaredVatRate:'15',vatRef:'SYNTH-VAT'}))});cases++;eq(tax.total.annualRentExVatSar,110000);
for(const [k,v] of [['areaPerUnitSqm',''],['areaPerUnitSqm','1,2'],['unitCount','1.5'],['occupancy','101'],['collection','abc'],['contractRef','']])deny(()=>evaluateWorkspace({...base,segments:[{...s,[k]:v}]}));
deny(()=>evaluateWorkspace({...base,lat:'24.7'}));deny(()=>evaluateWorkspace({...base,segmentsNonOverlapping:false}));deny(()=>parseLocalRentalJson('[]'));deny(()=>parseLocalRentalJson('{'));deny(()=>parseLocalRentalJson(' '.repeat(65537)));
cases++;eq(parseLocalRentalJson('{"x":1}').x,1);
const indicator={version:VERSION,sourceId:'REGA',sourceUrl:SOURCES.REGA.url,sourceRef:'SYNTH',attribution:'SYNTHETIC ONLY',city:c.city,district:c.district,kind:'OFFICE',subtype:'GRADE-A',areaBasis:'NLA',periodStart:'2025-10-01',periodEnd:'2025-12-31',publishedDate:'2026-01-02',observedDate:'2026-01-03',priceSource:'REGISTERED',metric:'MEAN_ANNUAL_SAR_PER_SQM',valueSar:115,sampleCount:20,vatBasis:'INCLUDED',declaredVatRate:.15,vatRef:'SYNTH-VAT'};
const ctx={city:c.city,district:c.district,kind:'OFFICE',subtype:'GRADE-A',areaBasis:'NLA',asOf:'2026-01-05'};
function run(a,b=ctx){cases++;const r=reviewRentIndicator(a,b);eq(r.liveSourceConnected,false);eq(r.sourceAuthenticated,false);eq(r.sourceLicenseVerified,false);eq(r.propertyRentEstimateSar,null);eq(r.individualLeaseComparables.length,0);eq(r.canonicalModelUpdated,false);eq(r.professionalValuationCertified,false);ok(r.snapshotHashSha256.length===64);return r;}
const v=run(indicator);eq(v.referenceMetricExVatSar,100);eq(v.flags.length,0);eq(v.input.attribution,'SYNTHETIC ONLY');
for(const [patch,flag] of [[{district:'OTHER'},'SCOPE_MISMATCH'],[{observedDate:'2026-01-06'},'FUTURE_EVIDENCE'],[{periodStart:'2023-01-01',periodEnd:'2023-03-31'},'STALE_PERIOD_REVIEW'],[{priceSource:'ASKING'},'NOT_REGISTERED_AGGREGATE'],[{sampleCount:2},'SMALL_SAMPLE_REVIEW'],[{vatBasis:'UNKNOWN',declaredVatRate:null,vatRef:null},'VAT_UNKNOWN']]){const a=run({...indicator,...patch});eq(a.referenceMetricExVatSar,null);ok(a.flags.includes(flag));}
const kite=run({...indicator,sourceId:'KITE_COMMERCIAL',sourceUrl:SOURCES.KITE_COMMERCIAL.url,priceSource:'ASKING'});eq(kite.referenceMetricExVatSar,null);ok(kite.flags.includes('NOT_REGISTERED_AGGREGATE'));deny(()=>reviewRentIndicator({...indicator,sourceId:'KITE_COMMERCIAL',sourceUrl:SOURCES.KITE_COMMERCIAL.url},ctx));
const house=run({...indicator,sourceId:'KITE_REGISTERED',sourceUrl:SOURCES.KITE_REGISTERED.url,kind:'APARTMENT'},{...ctx,kind:'APARTMENT'});eq(house.referenceMetricExVatSar,100);
for(const patch of [{sourceUrl:'https://rega.gov.sa.evil.example/'},{sourceUrl:'https://rei.rega.gov.sa/?token=secret'},{sourceId:'UNKNOWN'},{sourceRef:''},{attribution:''},{periodEnd:'2026-01-04'},{publishedDate:'2026-02-30'},{valueSar:0},{sampleCount:0},{declaredVatRate:null},{sourceId:'KITE_REGISTERED',sourceUrl:SOURCES.KITE_REGISTERED.url},{sourceId:'KITE_COMMERCIAL',sourceUrl:SOURCES.KITE_COMMERCIAL.url,metric:'MEAN_ANNUAL_SAR_PER_UNIT'},{individualLeaseComparables:[]}])deny(()=>reviewRentIndicator({...indicator,...patch},ctx));
console.log('RENTAL_WORKSPACE_INDICATORS=PASS cases='+cases+' checks='+checks);
