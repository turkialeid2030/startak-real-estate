'use strict';
const assert=require('node:assert/strict');
const {operatingCase}=require('../fixtures/synthetic-collections-case');
const {addDocumentedFutureLease}=require('../../src/residential-income-acquisition/operating-case-editor');
const {calculateLeaseCalendar}=require('../../src/residential-income-acquisition/lease-calendar');
const {calculateContractRunoff}=require('../../src/residential-income-acquisition/contract-runoff');
const {buildResidentialIncomeOperatingCaseEnvelope,parseResidentialIncomeOperatingCaseEnvelope}=require('../../src/residential-income-acquisition/operating-case-snapshot');
let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
const base=operatingCase({collections:[]}),before=JSON.stringify(base),r=calculateLeaseCalendar(base);
eq(r.status,'DERIVED_DOCUMENTED_CALENDAR');eq(r.periodStart,'2026-09-01');eq(r.periodEndExclusive,'2027-09-01');eq(r.leaseRows[0].calendarState,'CURRENT');eq(r.leaseRows[0].daysToEnd,122);eq(r.totalUncoveredUnitDays,243);eq(r.unitRows[0].gaps,[{start:'2027-01-01',endExclusive:'2027-09-01',days:243}]);eq(r.contractStateChanged,false);eq(r.noticesSent,false);eq(r.actualVacancyEstablished,false);eq(JSON.stringify(base),before);
const draft={previousLeaseId:'LEASE-1',leaseId:'NEXT',tenantId:'TENANT-1',startDate:'2027-02-01',endDate:'2028-02-01',baseRent:'1440000',sourceRef:'source-next',adoptionDecisionRef:'review-next',confirmed:true};
const c=addDocumentedFutureLease(base,draft),f=calculateLeaseCalendar(c);
eq(f.totalUncoveredUnitDays,31);eq(f.unitRows[0].gaps,[{start:'2027-01-01',endExclusive:'2027-02-01',days:31}]);eq(f.leaseRows[1].calendarState,'UPCOMING');eq(c.leases[1].lifecycleStatus,'FUTURE');
eq(calculateLeaseCalendar(parseResidentialIncomeOperatingCaseEnvelope(JSON.stringify(buildResidentialIncomeOperatingCaseEnvelope(c)))),f);
eq(calculateLeaseCalendar(addDocumentedFutureLease(base,{...draft,startDate:'2027-01-01'})).totalUncoveredUnitDays,0);
for(const [asOfDate,days,action] of [['2026-10-03',90,'REVIEW_END_WITHIN_90_DAYS'],['2026-11-02',60,'REVIEW_END_WITHIN_90_DAYS'],['2026-12-02',30,'REVIEW_END_WITHIN_90_DAYS'],['2026-10-02',91,'NO_NEAR_MILESTONE']]){const x=calculateLeaseCalendar({...base,asOfDate});eq(x.leaseRows[0].daysToEnd,days);eq(x.leaseRows[0].actionCode,action);}
for(const asOfDate of ['2027-01-01','2027-02-01']){const x=calculateLeaseCalendar({...base,asOfDate});eq(x.status,'NEEDS_REVIEW');eq(x.totalUncoveredUnitDays,null);eq(x.unitRows,[]);eq(x.leaseRows[0].actionCode,'REVIEW_DECLARED_STATE');}
const reached=calculateLeaseCalendar({...c,asOfDate:'2027-02-01'});eq(reached.status,'NEEDS_REVIEW');eq(reached.leaseRows[1].calendarState,'CURRENT');eq(reached.totalUncoveredUnitDays,null);
for(const patch of [{startDate:'2026-02-30'},{endDate:null},{endDate:'2025-01-01'},{termsEvidenceRef:'missing'},{termsAdoptionDecisionRef:'missing'},{unitId:'missing'},{lifecycleStatus:'UNKNOWN'},{caseId:'other'}]){const x=calculateLeaseCalendar({...base,leases:[{...base.leases[0],...patch}]});eq(x.status,'NEEDS_REVIEW');eq(x.totalUncoveredUnitDays,null);}
const overlap=calculateLeaseCalendar({...c,leases:[c.leases[0],{...c.leases[1],startDate:'2026-12-01'}]});eq(overlap.status,'NEEDS_REVIEW');eq(overlap.issues.some(x=>x.code==='LEASE_CALENDAR_OVERLAP'),true);
for(const lifecycleStatus of ['EXPIRED','TERMINATED']){const x=calculateLeaseCalendar({...base,leases:[{...base.leases[0],lifecycleStatus}]});eq(x.excludedLeaseIds,['LEASE-1']);eq(x.totalUncoveredUnitDays,365);}
eq(calculateLeaseCalendar({...base,units:[]}).totalUncoveredUnitDays,null);eq(calculateLeaseCalendar({...base,units:[base.units[0],base.units[0]]}).status,'NOT_CALCULABLE');
eq(calculateLeaseCalendar({...base,leases:Array(2001).fill(base.leases[0])}).status,'NOT_CALCULABLE');eq(calculateLeaseCalendar({...base,asOfDate:'2026-02-30'}).status,'NOT_CALCULABLE');
eq(calculateContractRunoff(c).totals.contractRent,1240000);eq(JSON.stringify(base),before);
console.log(`AUDIT_LEASE_CALENDAR=PASS checks=${checks}`);
