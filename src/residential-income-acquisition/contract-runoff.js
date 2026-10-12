'use strict';
const {deepFreeze}=require('./contracts');
const {calculateOperatingMetrics,ANNUALIZATION_FACTOR,RENT_UNIT_BY_FREQUENCY}=require('./operating-metrics');
const {calculateCollectionsReconciliation}=require('./collections-reconciliation');
const {calculateCapitalPaymentPlan}=require('./capital-payment-plan');

// A bounded analytical run-off, not a billing schedule or a renewal forecast.
// Monthly accrual = annual rent / 12, prorated by covered calendar days.
function calculateContractRunoff(operatingCase) {
  if (operatingCase?.contractType !== 'RESIDENTIAL_INCOME_OPERATING_CASE_V1') throw new TypeError('OPERATING_CASE_REQUIRED');
  const issues=[];
  const add=(code,refId=null)=>issues.push({code,refId});
  const day=value=>{
    if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value)) return NaN;
    const ms=Date.parse(value.slice(0,10));
    return Number.isFinite(ms)&&new Date(ms).toISOString().slice(0,10)===value.slice(0,10)?ms:NaN;
  };
  const start=day(operatingCase.asOfDate);
  const lineage=new Map(operatingCase.evidenceLineage.map(x=>[x.refId,x]));
  const source=ref=>['EVIDENCE_FACT','SOURCE_DOCUMENT'].includes(lineage.get(ref)?.kind);
  const adoption=ref=>lineage.get(ref)?.kind==='UNDERWRITING_ADOPTION';
  const validMoney=(value,unit)=>value && ['VERIFIED_FACT','ASSUMED'].includes(value.verificationStatus)
    && value.adoptedForUnderwriting===true && typeof value.value==='number' && value.value>=0
    && Number.isSafeInteger(Math.round(value.value*100)) && value.unit===unit
    && Number.isFinite(day(value.effectiveDate)) && day(value.effectiveDate)<=start
    && adoption(value.adoptionDecisionRef) && (value.verificationStatus==='ASSUMED'||source(value.sourceRef));
  const result={schemaVersion:1,calculationVersion:'CONTRACT_RUNOFF_V3',caseId:operatingCase.caseId,asOfDate:operatingCase.asOfDate,
    status:'NOT_CALCULABLE',issues,assumptions:[],periodStart:null,periodEndExclusive:null,rows:[],totals:null,
    historicalCollections:calculateCollectionsReconciliation(operatingCase),
    capexCashflow:null,collectionForecast:null,professionalReleaseAuthorized:false,financialEngineUpdated:false,
    semantics:'Illustrative 12-calendar-month accrual run-off of adopted ACTIVE/FUTURE leases with fixed rent or explicit dated STEP_RENT/MANUAL_SCHEDULE amounts. Each scheduled amount replaces periodic rent from its inclusive date until the next entry or exclusive lease end. Explicit zero represents rent-free days; no implicit end or restart is inferred. Annualized rent / 12 is prorated by calendar days in each segment. No automatic renewal, percentage/index growth, collection forecast, CAPEX timing, financing, tax, valuation or main-engine mutation. Normalized OPEX is a flat analytical allocation. Local declarations do not authenticate source, reviewer or legal permissibility.'};
  if(!Number.isFinite(start)){add('RUNOFF_CASE_DATE_INVALID');return deepFreeze(result);}
  const interest=operatingCase.propertyInterest;
  if(interest.interestType!=='FREEHOLD'||!source(interest.interestEvidenceRef)||!adoption(interest.interestAdoptionDecisionRef)
    ||(interest.commencementDate&&day(interest.commencementDate)>start))add('RUNOFF_PROPERTY_INTEREST_REQUIRED');
  if(calculateOperatingMetrics(operatingCase).status!=='CALCULATED')add('RUNOFF_OPERATING_METRICS_REQUIRED');
  const first=new Date(start),month=first.getUTCMonth(),year=first.getUTCFullYear();
  const end=Date.UTC(year,month+12,1);
  result.periodStart=new Date(start).toISOString().slice(0,10);
  result.periodEndExclusive=new Date(end).toISOString().slice(0,10);
  const leases=operatingCase.leases.filter(x=>['ACTIVE','FUTURE'].includes(x.lifecycleStatus));
  if(leases.length>2000){add('RUNOFF_LEASE_LIMIT_EXCEEDED');return deepFreeze(result);}
  const byUnit=new Map();
  const schedules=new Map();
  let scheduledEntryCount=0;
  for(const lease of leases){
    const a=day(lease.startDate),b=day(lease.endDate);
    if(!Number.isFinite(a)||!Number.isFinite(b)||b<=a||(lease.lifecycleStatus==='FUTURE'&&a<start))add('RUNOFF_LEASE_DATES_INVALID',lease.leaseId);
    if(!validMoney(lease.baseRent,RENT_UNIT_BY_FREQUENCY[lease.rentFrequency])||!ANNUALIZATION_FACTOR[lease.rentFrequency]
      ||!source(lease.termsEvidenceRef)||!adoption(lease.termsAdoptionDecisionRef))add('RUNOFF_ADOPTED_RENT_REQUIRED',lease.leaseId);
    const scheduled=['STEP_RENT','MANUAL_SCHEDULE'].includes(lease.escalation.type);
    if(!scheduled&&lease.escalation.type!=='NONE')add('RUNOFF_ESCALATION_NOT_SUPPORTED',lease.leaseId);
    const entries=scheduled?lease.escalation.schedule:[];
    scheduledEntryCount+=entries.length;
    if(scheduled&&(entries.length===0||entries.length>200))add('RUNOFF_SCHEDULE_INVALID',lease.leaseId);
    let previous=-Infinity;
    for(const entry of entries){
      const effective=day(entry.effectiveDate);
      if(!Number.isFinite(effective)||effective<a||effective>=b||effective<=previous
        ||!validMoney(entry.rent,RENT_UNIT_BY_FREQUENCY[lease.rentFrequency]))add('RUNOFF_SCHEDULE_INVALID',lease.leaseId);
      previous=effective;
    }
    schedules.set(lease.leaseId,entries.map(x=>({...x,date:day(x.effectiveDate)})));
    if(!byUnit.has(lease.unitId))byUnit.set(lease.unitId,[]);
    byUnit.get(lease.unitId).push({a,b,id:lease.leaseId});
  }
  for(const entries of byUnit.values()){
    entries.sort((a,b)=>a.a-b.a);
    for(let i=1;i<entries.length;i++)if(entries[i].a<entries[i-1].b)add('RUNOFF_OVERLAPPING_LEASES',entries[i].id);
  }
  if(scheduledEntryCount>10000)add('RUNOFF_SCHEDULE_LIMIT_EXCEEDED');
  if(issues.length)return deepFreeze(result);
  const expenses=operatingCase.operatingExpenses.filter(x=>x.basis==='NORMALIZED');
  result.assumptions=[...leases.map(x=>x.baseRent),...[...schedules.values()].flatMap(x=>x.map(e=>e.rent)),...expenses.map(x=>x.annualAmount)].filter(x=>x.verificationStatus==='ASSUMED').map(x=>({field:x.field,value:x.value,unit:x.unit,adoptionDecisionRef:x.adoptionDecisionRef}));
  const completeCosts=expenses.length>0&&expenses.every(x=>validMoney(x.annualAmount,'SAR/year'));
  const annualOpex=completeCosts?expenses.reduce((sum,x)=>sum+x.annualAmount.value,0):null;
  if(annualOpex===null)add('RUNOFF_NORMALIZED_OPEX_REQUIRED');
  for(let i=0;i<12;i++){
    const monthStart=Date.UTC(year,month+i,1),monthEnd=Date.UTC(year,month+i+1,1),a=Math.max(start,monthStart);
    const leaseRows=leases.map(lease=>{
      const from=Math.max(a,day(lease.startDate)),to=Math.min(monthEnd,day(lease.endDate));
      const entries=schedules.get(lease.leaseId),segments=[];
      if(to>from){
        const boundaries=[from,...entries.filter(e=>e.date>from&&e.date<to).map(e=>e.date),to];
        for(let n=0;n<boundaries.length-1;n++){
          let input=lease.baseRent;
          for(const entry of entries){if(entry.date>boundaries[n])break;input=entry.rent;}
          const days=(boundaries[n+1]-boundaries[n])/86400000;
          segments.push({start:new Date(boundaries[n]).toISOString().slice(0,10),endExclusive:new Date(boundaries[n+1]).toISOString().slice(0,10),days,periodicRent:input.value,rent:input.value*ANNUALIZATION_FACTOR[lease.rentFrequency]/12*days/((monthEnd-monthStart)/86400000),sourceRef:input.sourceRef,adoptionDecisionRef:input.adoptionDecisionRef});
        }
      }
      return {leaseId:lease.leaseId,unitId:lease.unitId,coveredDays:Math.max(0,to-from)/86400000,segments,
        rent:segments.reduce((sum,segment)=>sum+segment.rent,0),
        sourceRef:lease.baseRent.sourceRef,adoptionDecisionRef:lease.baseRent.adoptionDecisionRef};
    });
    const rent=leaseRows.reduce((sum,x)=>sum+x.rent,0);
    const opex=annualOpex===null?null:annualOpex/12*(monthEnd-a)/(monthEnd-monthStart);
    result.rows.push({periodStart:new Date(a).toISOString().slice(0,10),periodEndExclusive:new Date(monthEnd).toISOString().slice(0,10),contractRent:rent,normalizedOpex:opex,contractNetBeforeCapex:opex===null?null:rent-opex,leaseRows});
  }
  result.totals={contractRent:result.rows.reduce((s,r)=>s+r.contractRent,0),normalizedOpex:annualOpex===null?null:result.rows.reduce((s,r)=>s+r.normalizedOpex,0),contractNetBeforeCapex:annualOpex===null?null:result.rows.reduce((s,r)=>s+r.contractNetBeforeCapex,0)};
  if(Object.values(result.totals).some(v=>v!==null&&!Number.isSafeInteger(Math.round(v*100)))){
    add('RUNOFF_AMOUNT_OUT_OF_RANGE');result.rows=[];result.totals=null;return deepFreeze(result);
  }
  result.status=annualOpex===null?'RENT_ONLY':'ILLUSTRATIVE_RUNOFF';
  result.capitalPaymentPlan=calculateCapitalPaymentPlan(operatingCase,result.rows);
  result.capexCashflow=result.capitalPaymentPlan.status==='SCHEDULED'?result.capitalPaymentPlan.rows:null;
  result.rows.forEach((row,index)=>{
    row.scheduledCapex=result.capexCashflow===null?null:result.capexCashflow[index].amount;
    row.contractNetAfterScheduledCapex=row.contractNetBeforeCapex===null||row.scheduledCapex===null?null:row.contractNetBeforeCapex-row.scheduledCapex;
  });
  result.totals.scheduledCapex=result.capitalPaymentPlan.total;
  result.totals.contractNetAfterScheduledCapex=result.totals.contractNetBeforeCapex===null||result.capitalPaymentPlan.total===null?null:result.totals.contractNetBeforeCapex-result.capitalPaymentPlan.total;
  if(result.totals.contractNetAfterScheduledCapex!==null&&!Number.isSafeInteger(Math.round(result.totals.contractNetAfterScheduledCapex*100))){add('RUNOFF_AMOUNT_OUT_OF_RANGE');result.totals.contractNetAfterScheduledCapex=null;result.rows.forEach(row=>{row.contractNetAfterScheduledCapex=null;});}
  result.semantics=result.semantics.replace('CAPEX timing, ','')+' Explicit capital payment plans, when present and reconciled to all supplied item costs, are separately deducted to show analytical net after scheduled CAPEX. This is not a receipt forecast or actual cash balance.';
  if(result.capitalPaymentPlan.status==='SCHEDULED')result.assumptions.push(...operatingCase.capexItems.filter(item=>item.estimatedCost.verificationStatus==='ASSUMED').map(item=>({field:item.estimatedCost.field,value:item.estimatedCost.value,unit:item.estimatedCost.unit,adoptionDecisionRef:item.estimatedCost.adoptionDecisionRef})));
  return deepFreeze(result);
}
module.exports={calculateContractRunoff};
