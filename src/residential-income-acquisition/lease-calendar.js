'use strict';
// Deterministic local follow-up derived from the case date; no renewal,
// occupancy assertion, notice delivery or mutation of contractual facts.
const DAY=86400000;
function day(value){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value)||!Number.isFinite(Date.parse(value)))return NaN;
  const n=Date.parse(value.slice(0,10));
  return new Date(n).toISOString().slice(0,10)===value.slice(0,10)?n:NaN;
}
const iso=n=>new Date(n).toISOString().slice(0,10);
function calculateLeaseCalendar(c){
  const result={status:'NOT_CALCULABLE',caseId:c?.caseId,asOfDate:c?.asOfDate,periodStart:null,periodEndExclusive:null,leaseRows:[],unitRows:[],totalUncoveredUnitDays:null,issues:[],excludedLeaseIds:[],contractStateChanged:false,noticesSent:false,actualVacancyEstablished:false};
  const issue=(code,refId=null)=>result.issues.push({code,refId});
  if(c?.contractType!=='RESIDENTIAL_INCOME_OPERATING_CASE_V1'||!Array.isArray(c.units)||!Array.isArray(c.leases)||!Array.isArray(c.evidenceLineage)){issue('LEASE_CALENDAR_CASE_REQUIRED');return result;}
  const start=day(c.asOfDate);
  if(!Number.isFinite(start)){issue('LEASE_CALENDAR_DATE_INVALID');return result;}
  if(c.leases.length>2000||c.units.length>10000){issue('LEASE_CALENDAR_LIMIT_EXCEEDED');return result;}
  const first=new Date(start),end=Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+12,1);
  result.periodStart=iso(start);result.periodEndExclusive=iso(end);
  const units=new Set(c.units.map(u=>u.unitId)),refs=new Map(c.evidenceLineage.map(x=>[x.refId,x.kind])),byUnit=new Map();
  if(!c.units.length||units.size!==c.units.length||c.units.some(u=>u.caseId!==c.caseId)){issue('LEASE_CALENDAR_UNIT_INVENTORY_REQUIRED');return result;}
  const ids=new Set();
  for(const l of c.leases){
    if(l.caseId!==c.caseId||ids.has(l.leaseId)){issue('LEASE_CALENDAR_CASE_ISOLATION',l.leaseId);continue;}ids.add(l.leaseId);
    if(['EXPIRED','TERMINATED'].includes(l.lifecycleStatus)){result.excludedLeaseIds.push(l.leaseId);continue;}
    if(!['ACTIVE','FUTURE'].includes(l.lifecycleStatus)){issue('LEASE_CALENDAR_STATE_REQUIRED',l.leaseId);continue;}
    const a=day(l.startDate),b=day(l.endDate);
    if(!Number.isFinite(a)||!Number.isFinite(b)||a>=b){issue('LEASE_CALENDAR_TERM_INVALID',l.leaseId);continue;}
    if(!units.has(l.unitId)){issue('LEASE_CALENDAR_UNIT_REQUIRED',l.leaseId);continue;}
    if(!['SOURCE_DOCUMENT','EVIDENCE_FACT'].includes(refs.get(l.termsEvidenceRef))||refs.get(l.termsAdoptionDecisionRef)!=='UNDERWRITING_ADOPTION'){issue('LEASE_CALENDAR_TERMS_REQUIRED',l.leaseId);continue;}
    const state=start<a?'UPCOMING':start>=b?'END_REACHED':'CURRENT';
    const daysToStart=(a-start)/DAY,daysToEnd=(b-start)/DAY;
    let actionCode='NO_NEAR_MILESTONE';
    if((l.lifecycleStatus==='FUTURE'&&a<=start)||(l.lifecycleStatus==='ACTIVE'&&(a>start||b<=start))){issue('LEASE_CALENDAR_DECLARED_STATE_REVIEW',l.leaseId);actionCode='REVIEW_DECLARED_STATE';}
    else if(state==='UPCOMING'&&daysToStart<=90)actionCode='REVIEW_START_WITHIN_90_DAYS';
    else if(state==='CURRENT'&&daysToEnd<=90)actionCode='REVIEW_END_WITHIN_90_DAYS';
    result.leaseRows.push({leaseId:l.leaseId,unitId:l.unitId,declaredState:l.lifecycleStatus,calendarState:state,startDate:iso(a),endDateExclusive:iso(b),daysToStart,daysToEnd,actionCode,sourceRef:l.termsEvidenceRef,reviewRef:l.termsAdoptionDecisionRef});
    const intervals=byUnit.get(l.unitId)||[];intervals.push({a,b,leaseId:l.leaseId});byUnit.set(l.unitId,intervals);
  }
  for(const intervals of byUnit.values()){
    intervals.sort((a,b)=>a.a-b.a);
    for(let i=1;i<intervals.length;i++)if(intervals[i].a<intervals[i-1].b)issue('LEASE_CALENDAR_OVERLAP',intervals[i].leaseId);
  }
  if(result.issues.length){result.status='NEEDS_REVIEW';return result;}
  for(const unit of c.units){
    let cursor=start;const gaps=[];
    for(const interval of byUnit.get(unit.unitId)||[]){
      const a=Math.max(start,interval.a),b=Math.min(end,interval.b);if(b<=a)continue;
      if(a>cursor)gaps.push({start:iso(cursor),endExclusive:iso(a),days:(a-cursor)/DAY});
      cursor=Math.max(cursor,b);
    }
    if(cursor<end)gaps.push({start:iso(cursor),endExclusive:iso(end),days:(end-cursor)/DAY});
    result.unitRows.push({unitId:unit.unitId,uncoveredDays:gaps.reduce((s,g)=>s+g.days,0),gaps});
  }
  result.totalUncoveredUnitDays=result.unitRows.reduce((s,u)=>s+u.uncoveredDays,0);
  result.status='DERIVED_DOCUMENTED_CALENDAR';
  result.semantics='Dates and uncovered unit-days from locally sourced ACTIVE/FUTURE leases only, over the 12-calendar-month case horizon. Ends exclusive. Uncovered days mean no supplied qualifying contract, not physical vacancy or lost income. No automatic renewal, legal notice, lifecycle mutation, revenue or cash forecast. EXPIRED/TERMINATED declarations do not provide future coverage.';
  return result;
}
module.exports={calculateLeaseCalendar};
