'use strict';
const {createLease}=require('./contracts');
function leaseWithoutHistory(lease){const {changeLog,...snapshot}=lease;return snapshot;}
function appendLeaseChange(before,after,{kind,recordedAt,caseDateBefore,caseDateAfter=caseDateBefore,effectiveDate=caseDateAfter,sourceRef,adoptionDecisionRef,reason}){
 const log=before.changeLog||[];
 return createLease({...leaseWithoutHistory(after),changeLog:[...log,{
  revision:log.length+1,kind,recordedAt,caseDateBefore:caseDateBefore.slice(0,10),caseDateAfter:caseDateAfter.slice(0,10),effectiveDate:effectiveDate.slice(0,10),
  sourceRef,adoptionDecisionRef,reason,before:leaseWithoutHistory(before),after:leaseWithoutHistory(after),
 }]});
}
function assertLeaseIntervals(leases,unitId=null){
 const groups=new Map();
 for(const lease of leases.filter(l=>['ACTIVE','FUTURE'].includes(l.lifecycleStatus)&&(unitId===null||l.unitId===unitId))){
  if(!lease.startDate||!lease.endDate||!Number.isFinite(Date.parse(lease.startDate))||!Number.isFinite(Date.parse(lease.endDate))||Date.parse(lease.endDate)<=Date.parse(lease.startDate))throw new TypeError('LEASE_LIFECYCLE_TERMS_REQUIRED');
  const rows=groups.get(lease.unitId)||[];rows.push(lease);groups.set(lease.unitId,rows);
 }
 for(const rows of groups.values()){
  rows.sort((a,b)=>Date.parse(a.startDate)-Date.parse(b.startDate));let end=-Infinity;
  for(const row of rows){if(Date.parse(row.startDate)<end)throw new TypeError('LEASE_LIFECYCLE_OVERLAP');end=Math.max(end,Date.parse(row.endDate));}
 }
}
module.exports={leaseWithoutHistory,appendLeaseChange,assertLeaseIntervals};
