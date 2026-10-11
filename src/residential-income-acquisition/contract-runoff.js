'use strict';
const {deepFreeze}=require('./contracts');
const {calculateOperatingMetrics,ANNUALIZATION_FACTOR,RENT_UNIT_BY_FREQUENCY}=require('./operating-metrics');
const {calculateCollectionsReconciliation}=require('./collections-reconciliation');

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
  const result={schemaVersion:1,calculationVersion:'CONTRACT_RUNOFF_V1',caseId:operatingCase.caseId,asOfDate:operatingCase.asOfDate,
    status:'NOT_CALCULABLE',issues,assumptions:[],periodStart:null,periodEndExclusive:null,rows:[],totals:null,
    historicalCollections:calculateCollectionsReconciliation(operatingCase),
    capexCashflow:null,collectionForecast:null,professionalReleaseAuthorized:false,financialEngineUpdated:false,
    semantics:'Illustrative 12-calendar-month accrual run-off of adopted fixed-rent ACTIVE/FUTURE leases. Start inclusive, end exclusive; annual rent / 12 prorated by actual calendar days in each month. No renewal, growth, cash collection, vacancy forecast, CAPEX timing, financing, tax, valuation or main-engine mutation. Normalized OPEX is a flat analytical allocation, not actual payments. Local evidence declarations do not authenticate source or reviewer.'};
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
  for(const lease of leases){
    const a=day(lease.startDate),b=day(lease.endDate);
    if(!Number.isFinite(a)||!Number.isFinite(b)||b<=a||(lease.lifecycleStatus==='FUTURE'&&a<start))add('RUNOFF_LEASE_DATES_INVALID',lease.leaseId);
    if(!validMoney(lease.baseRent,RENT_UNIT_BY_FREQUENCY[lease.rentFrequency])||!ANNUALIZATION_FACTOR[lease.rentFrequency]
      ||!source(lease.termsEvidenceRef)||!adoption(lease.termsAdoptionDecisionRef))add('RUNOFF_ADOPTED_RENT_REQUIRED',lease.leaseId);
    if(lease.escalation.type!=='NONE')add('RUNOFF_ESCALATION_NOT_SUPPORTED',lease.leaseId);
    if(!byUnit.has(lease.unitId))byUnit.set(lease.unitId,[]);
    byUnit.get(lease.unitId).push({a,b,id:lease.leaseId});
  }
  for(const entries of byUnit.values()){
    entries.sort((a,b)=>a.a-b.a);
    for(let i=1;i<entries.length;i++)if(entries[i].a<entries[i-1].b)add('RUNOFF_OVERLAPPING_LEASES',entries[i].id);
  }
  if(issues.length)return deepFreeze(result);
  const expenses=operatingCase.operatingExpenses.filter(x=>x.basis==='NORMALIZED');
  result.assumptions=[...leases.map(x=>x.baseRent),...expenses.map(x=>x.annualAmount)].filter(x=>x.verificationStatus==='ASSUMED').map(x=>({field:x.field,value:x.value,unit:x.unit,adoptionDecisionRef:x.adoptionDecisionRef}));
  const completeCosts=expenses.length>0&&expenses.every(x=>validMoney(x.annualAmount,'SAR/year'));
  const annualOpex=completeCosts?expenses.reduce((sum,x)=>sum+x.annualAmount.value,0):null;
  if(annualOpex===null)add('RUNOFF_NORMALIZED_OPEX_REQUIRED');
  for(let i=0;i<12;i++){
    const monthStart=Date.UTC(year,month+i,1),monthEnd=Date.UTC(year,month+i+1,1),a=Math.max(start,monthStart);
    const leaseRows=leases.map(lease=>{
      const covered=Math.max(0,Math.min(monthEnd,day(lease.endDate))-Math.max(a,day(lease.startDate)));
      return {leaseId:lease.leaseId,unitId:lease.unitId,coveredDays:covered/86400000,
        rent:lease.baseRent.value*ANNUALIZATION_FACTOR[lease.rentFrequency]/12*covered/(monthEnd-monthStart),
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
  return deepFreeze(result);
}
module.exports={calculateContractRunoff};
