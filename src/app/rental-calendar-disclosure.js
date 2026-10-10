'use strict';
const VERSION='RENTAL_CALENDAR_CONTEXT_V1';
const SOURCE=Object.freeze({url:'https://rega.gov.sa/rega-services/platforms/ejar/',lastCheckedDate:'2026-10-10',reviewAfterDate:'2027-01-08',freezeStart:'2025-09-25',projectionEndExclusive:'2030-09-25',endDateBasis:'ILLUSTRATIVE_GREGORIAN_FIVE_YEAR_ANNIVERSARY_REQUIRES_LEGAL_CONFIRMATION'});
const fail=()=>{throw Object.assign(new Error('INVALID_RENTAL_CALENDAR'),{code:'INVALID_RENTAL_CALENDAR'});};
function validateRentalCalendar(context){
 if(context==null)return null;
 if(context.version!==VERSION||!/^\d{4}-\d{2}-\d{2}$/.test(context.studyStartDate||'')||!Number.isFinite(Date.parse(context.studyStartDate))||new Date(context.studyStartDate).toISOString().slice(0,10)!==context.studyStartDate||!['RIYADH_URBAN','OTHER','UNKNOWN'].includes(context.locationScope)||!['RESIDENTIAL','COMMERCIAL','OTHER','UNKNOWN'].includes(context.leaseCategory)||context.independentlyVerified!==false)fail();
 for(const key of ['contractReference','lastRentReference','exceptionReference'])if(typeof context[key]!=='string'||context[key].length>2000)fail();
 return context;
}
function createRentalCalendar(fields){return validateRentalCalendar({version:VERSION,...fields,independentlyVerified:false});}
function anniversary(start,years){const d=new Date(start+'T00:00:00Z'),month=d.getUTCMonth(),day=d.getUTCDate();d.setUTCDate(1);d.setUTCFullYear(d.getUTCFullYear()+years);d.setUTCDate(Math.min(day,new Date(Date.UTC(d.getUTCFullYear(),month+1,0)).getUTCDate()));return d.toISOString().slice(0,10);}
function rentalCalendarDisclosure({mode,inputs,result,context=null,asOfDate=new Date().toISOString()}={}){
 validateRentalCalendar(context);
 const base={source:SOURCE,financialFormulaAdjusted:false,regulatoryComplianceEstablished:false,eligibleForRealWorldAdoption:false};
 if(!context)return {...base,status:'REGULATORY_CONTEXT_MISSING',periods:[],context:null};
 const horizon=(result?.cashflows?.length||0)-1;
 const known=context.locationScope!=='UNKNOWN'&&context.leaseCategory!=='UNKNOWN';
 const potential=context.locationScope==='RIYADH_URBAN'&&['RESIDENTIAL','COMMERCIAL'].includes(context.leaseCategory);
 const stale=Date.parse(asOfDate)>Date.parse(SOURCE.reviewAfterDate+'T23:59:59Z');
 const periods=Array.from({length:Math.max(0,horizon)},(_,i)=>{
  const year=i+1,start=anniversary(context.studyStartDate,i),end=anniversary(context.studyStartDate,i+1);
  const operating=mode!=='land'||year>(result?.constructionYears??Math.ceil(inputs.constructionPeriod||0));
  const overlap=potential&&start<SOURCE.projectionEndExclusive&&end>SOURCE.freezeStart;
  const growthConflict=operating&&overlap&&inputs.rentGrowthRate>0;
  return {year,startDate:start,endDateExclusive:end,operating,overlapsIllustrativeFreezeWindow:overlap,rentGrowthRateAssumed:inputs.rentGrowthRate,
   status:stale?'REGULATORY_SOURCE_RECHECK_REQUIRED':!known?'REGULATORY_CONTEXT_MISSING':growthConflict?'RENT_GROWTH_REVIEW_REQUIRED':overlap?'RENT_FREEZE_PERIOD_REVIEW_REQUIRED':'OUTSIDE_CHECKED_RENT_FREEZE_SCOPE_REVIEW_REQUIRED'};
 });
 return {...base,context:{...context},status:stale?'REGULATORY_SOURCE_RECHECK_REQUIRED':periods.some(p=>p.status==='RENT_GROWTH_REVIEW_REQUIRED')?'RENT_GROWTH_REVIEW_REQUIRED':'REGULATORY_REVIEW_REQUIRED',periods,
  semantics:'Calendar disclosure only. Current financial outputs remain explicitly illustrative. Annual growth is not legally authorized by a checkbox, new lease, first letting, or expiry of this projection window. Actual contracts, geography, dates and any accepted exception require independent review.'};
}
module.exports={VERSION,SOURCE,validateRentalCalendar,createRentalCalendar,rentalCalendarDisclosure};
