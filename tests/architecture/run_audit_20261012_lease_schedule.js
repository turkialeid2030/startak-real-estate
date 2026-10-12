'use strict';
const assert=require('node:assert/strict');
const {operatingCase}=require('../fixtures/synthetic-collections-case');
const {updateVerifiedLeaseSchedule,updateVerifiedLeaseTerms,buildResidentialIncomeOperatingCaseEnvelope,parseResidentialIncomeOperatingCaseEnvelope}=require('../../src/residential-income-acquisition');
const {calculateContractRunoff}=require('../../src/residential-income-acquisition/contract-runoff');
let checks=0;
const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
const near=(a,b)=>{assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);checks++;};
const fails=fn=>{assert.throws(fn);checks++;};
const base=operatingCase(),original=JSON.stringify(base);
const draft={leaseId:'LEASE-1',entries:[{effectiveDate:'2026-09-16',rent:'0'},{effectiveDate:'2026-10-01',rent:'1440000'}],sourceRef:'source://schedule',adoptionDecisionRef:'adoption://schedule',confirmed:true};
const update=d=>updateVerifiedLeaseSchedule(base,d,{recordedAt:'2026-09-01T00:00:00Z'});
const updated=update(draft),r=calculateContractRunoff(updated);
eq(r.calculationVersion,'CONTRACT_RUNOFF_V3');near(r.rows[0].contractRent,50000);near(r.rows[1].contractRent,120000);near(r.totals.contractRent,410000);eq(r.rows[4].contractRent,0);
eq(r.rows[0].leaseRows[0].segments.length,2);eq(r.rows[0].leaseRows[0].segments[1].periodicRent,0);eq(r.rows[1].leaseRows[0].segments[0].sourceRef,draft.sourceRef);
eq(updated.leases[0].escalation.schedule[0].rent.unit,'SAR/year');eq(updated.leases[0].baseRent,base.leases[0].baseRent);eq(updated.rentCollections,base.rentCollections);eq(JSON.stringify(base),original);
eq(r.historicalCollections.totals.rentCollected,90000);eq(r.collectionForecast,null);eq(r.financialEngineUpdated,false);
eq(calculateContractRunoff(parseResidentialIncomeOperatingCaseEnvelope(JSON.stringify(buildResidentialIncomeOperatingCaseEnvelope(updated)))),r);
const permanent=calculateContractRunoff(update({...draft,entries:[{effectiveDate:'2026-09-16',rent:0}]}));near(permanent.totals.contractRent,50000);eq(permanent.rows[1].contractRent,0);
const initialFree=calculateContractRunoff(update({...draft,entries:[{effectiveDate:'2026-01-01',rent:0},{effectiveDate:'2026-10-01',rent:1200000}]}));eq(initialFree.rows[0].contractRent,0);near(initialFree.totals.contractRent,300000);
for(const value of ['',null,undefined,false,[],{},-1,'-1','NaN','1e6'])fails(()=>update({...draft,entries:[{effectiveDate:'2026-09-16',rent:value}]}));
for(const value of ['2025-12-31','2027-01-01','2026-02-30','bad','2026-09-16T12:00:00Z'])fails(()=>update({...draft,entries:[{effectiveDate:value,rent:0}]}));
fails(()=>update({...draft,confirmed:false}));fails(()=>update({...draft,sourceRef:''}));fails(()=>update({...draft,adoptionDecisionRef:''}));fails(()=>update({...draft,entries:[]}));fails(()=>update({...draft,entries:Array(201).fill(draft.entries[0])}));
fails(()=>update({...draft,entries:[draft.entries[0],draft.entries[0]]}));fails(()=>update({...draft,entries:[draft.entries[1],draft.entries[0]]}));
fails(()=>updateVerifiedLeaseTerms(updated,{leaseId:'LEASE-1',baseRent:1200000,endDate:'2026-10-01',sourceRef:'source://shorten',adoptionDecisionRef:'adoption://shorten',confirmed:true}));
for(const [field,value] of [['effectiveDate','2026-09-02'],['sourceRef','missing'],['adoptionDecisionRef','missing'],['unit','SAR/month']]){const c=JSON.parse(JSON.stringify(updated));c.leases[0].escalation.schedule[0].rent[field]=value;eq(calculateContractRunoff(c).totals,null);}
const step=JSON.parse(JSON.stringify(updated));step.leases[0].escalation.type='STEP_RENT';near(calculateContractRunoff(step).totals.contractRent,410000);
// Independent daily summation compared with the segment implementation.
for(let cut=2;cut<=29;cut++){
 const entries=[{effectiveDate:`2026-09-${String(cut).padStart(2,'0')}`,rent:0},{effectiveDate:'2026-10-01',rent:600000+cut*10000}];
 const result=calculateContractRunoff(update({...draft,entries}));let expected=0;
 for(let ms=Date.UTC(2026,8,1);ms<Date.UTC(2027,0,1);ms+=86400000){const date=new Date(ms);let rent=1200000;for(const entry of entries)if(ms>=Date.parse(entry.effectiveDate))rent=entry.rent;const days=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate();expected+=rent/12/days;}
 near(result.totals.contractRent,expected);
}
console.log(`AUDIT_LEASE_SCHEDULE=PASS checks=${checks}`);
