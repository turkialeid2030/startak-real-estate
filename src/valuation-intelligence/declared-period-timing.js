'use strict';
const {normalizeCashflows}=require('./dated-returns');
const validDate=value=>typeof value==='string'&&normalizeCashflows([{date:value,amount:0}])!==null;
// Dates are supplied with source references. This validates the user's period
// declarations, not the canonical model's annual/monthly timing conventions.
function reconcileDeclaredPeriodTiming(rows,declaredPeriods,periodCount){
 const fail=blocker=>({ok:false,blocker});
 if(!Number.isInteger(periodCount)||periodCount<2||periodCount>36||
  !Array.isArray(rows)||rows.length<2||rows.length>36)
  return fail('DECLARED_TIMING_INPUTS_INVALID');
 if(!Array.isArray(declaredPeriods)||declaredPeriods.length!==periodCount)
  return fail('ALL_DECLARED_PERIOD_WINDOWS_REQUIRED');
 const periods=[];
 for(let i=0;i<periodCount;i++){
  const p=declaredPeriods[i];
  if(!p||p.period!==i)return fail('DECLARED_PERIOD_ID_OR_ORDER_INVALID');
  if(!validDate(p.startDate)||!validDate(p.endDate))return fail('DECLARED_PERIOD_DATE_INVALID');
  if(typeof p.sourceReference!=='string'||!p.sourceReference.trim()||p.sourceReference.length>240)
   return fail('DECLARED_PERIOD_SOURCE_REQUIRED');
  if(i===0?p.startDate!==p.endDate:
   p.startDate!==periods[i-1].endDate||p.endDate<=p.startDate)
   return fail('DECLARED_PERIOD_WINDOWS_NOT_CONTIGUOUS_OR_ORDERED');
  periods.push(Object.freeze({period:i,startDate:p.startDate,endDate:p.endDate,
   sourceReference:p.sourceReference.trim(),boundary:i===0?'POINT_IN_TIME':'OPEN_START_CLOSED_END'}));
 }
 for(const row of rows){
  if(!row||!validDate(row.date)||!/^(0|[1-9]\d*)$/.test(String(row.canonicalPeriod??'')))
   return fail('DATED_ROW_PERIOD_OR_DATE_INVALID');
  const i=Number(row.canonicalPeriod),p=periods[i];
  if(!p)return fail('DATED_ROW_PERIOD_OR_DATE_INVALID');
  if(i===0?row.date!==p.endDate:row.date<=p.startDate||row.date>p.endDate)
   return fail('CASHFLOW_DATE_OUTSIDE_DECLARED_PERIOD');
 }
 return Object.freeze({ok:true,status:'MATCHED_USER_DECLARED_PERIOD_DATES_ONLY',
  periods:Object.freeze(periods),sourceReferencesUserAttested:true,independentlyVerified:false,
  canonicalTimingReconciled:false,monthlyFinancingReconciled:false});
}
module.exports={reconcileDeclaredPeriodTiming};
