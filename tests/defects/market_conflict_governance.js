'use strict';
const assert=require('node:assert/strict');
const {ASSET_TYPES,evaluateMarketStudy}=require('../../src/market/instant-market-study');
const {auditValuationReadiness}=require('../../src/market/valuation-decision-gate');
const {ownerMarketEvidenceGuidance}=require('../../src/market/owner-market-evidence-guidance');
let cases=0;
for(const type of Object.keys(ASSET_TYPES)){
 const income=!['LAND','HOTEL','FUEL_STATION','HEALTHCARE_PROPERTY','INDUSTRIAL_PROPERTY'].includes(type);
 const subject={assetType:type,city:'الرياض',district:'SYNTH',location:'24.7,46.7',landArea:1000,builtArea:1000,rentableArea:800,buildingCount:1,unitCount:10,roomCount:20};
 const rows=Array.from({length:4},(_,i)=>({assetType:type,status:'EXECUTED',date:'2026-11-24',sourceUrl:'https://example.org/synthetic/row-'+i,sourceRecordId:'row-'+i,location:subject.location,landArea:1000,builtArea:1000,rentableArea:800,price:1000000,annualRent:100000}));
 const asOf=new Date('2026-11-25T00:00:00Z'),assumptions={occupancy:1,expenseRatio:0.2,capRate:0.08};
 for(const kind of income?['SALE','RENT','BOTH']:['SALE']){
  for(const reverse of [false,true]){
   const saleConflict=kind!=='RENT',rentConflict=kind!=='SALE';
   let sales=saleConflict?[...rows,{...rows[0],price:3000000}]:rows;
   let rentals=income?(rentConflict?[...rows,{...rows[0],annualRent:300000}]:rows):[];
   if(reverse){sales=[...sales].reverse();rentals=[...rentals].reverse();}
   const projects=[{name:'Synthetic project',status:'OPERATING',location:subject.location,sourceUrl:'https://example.org/synthetic/project',impactPct:0.05}];
   const report=evaluateMarketStudy({subject,sales,rentals,assumptions,asOf,projects});
   assert.equal(report.todayValueScenarioSar,null);
   assert.equal(report.projectScenarioSar,null);
   assert.equal(report.confidence,'UNRESOLVED_SOURCE_RECORD_CONFLICT');
   assert.equal(report.eligibleSalesCount,saleConflict?3:4);
   assert.equal(report.eligibleRentalsCount,income?(rentConflict?3:4):0);
   assert.equal(report.saleIndicationSar,1000000);
   const gate=auditValuationReadiness({subject,report,sales,rentals,asOf});
   assert.equal(gate.preliminaryValueSar,null);
   assert.equal(gate.permittedExport,'HOLD_SOURCE_RECORD_CONFLICT');
   assert.equal(gate.status,'HOLD_INSUFFICIENT_OR_CONFLICTING_EVIDENCE');
   assert.equal(gate.rawMarketIndicationSar,1000000);
   assert.equal(gate.certifiedValueSar,null);
   assert.equal(gate.publishableProfessionalReport,false);
   assert.equal(gate.newAnnualMarketRentSar,income&&!rentConflict?100000:null);
   if(rentConflict){
    const segment=auditValuationReadiness({subject,report,sales,rentals,asOf,segmentedRent:{status:'PRELIMINARY_SEGMENTED_RENT_UNVERIFIED',grossPotentialNewAnnualRentSar:100000}});
    assert.equal(segment.newAnnualMarketRentSar,null);
    assert.equal(segment.rentSource,'CONFLICT_REQUIRES_REVIEW');
   }
   for(const [code,required,target] of [['SALE_SOURCE_RECORD_CONFLICT',saleConflict,'market-comparables-sale'],['RENT_SOURCE_RECORD_CONFLICT',rentConflict,'market-comparables-rent']]){
    assert.equal(gate.issues.includes(code),required);
    if(required)for(const locale of ['ar-SA','en']){
     const item=ownerMarketEvidenceGuidance(gate,locale).items.find(x=>x.key===code);
     assert.ok(item);assert.equal(item.kind,'hold');assert.equal(item.target.step,2);assert.equal(item.target.key,target);
     assert.ok(locale==='en'?item.description.includes('Reconcile'):/[\u0600-\u06ff]/.test(item.description));
    }
   }
   cases++;
  }
 }
 // Explicitly corrected data, no conflict: independent research only.
 const report=evaluateMarketStudy({subject,sales:rows,rentals:income?rows:[],assumptions,asOf});
 const gate=auditValuationReadiness({subject,report,sales:rows,rentals:income?rows:[],asOf});
 assert.ok(!gate.issues.includes('SALE_SOURCE_RECORD_CONFLICT'));assert.ok(!gate.issues.includes('RENT_SOURCE_RECORD_CONFLICT'));
 assert.equal(gate.certifiedValueSar,null);
 assert.equal(gate.permittedExport,'PERSONAL_RESEARCH_DRAFT_ONLY');
 cases++;
}
console.log('MARKET_CONFLICT_GOVERNANCE=PASS scenarios='+cases+' synthetic_only=true');
