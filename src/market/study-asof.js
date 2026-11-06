'use strict';
// One explicit valuation reference day for comparisons, leases and rent calculation.
// A user-entered date is a date-of-value, not a declaration that the market
// data were actually published that day.
function localDateString(d){return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');}
function resolveStudyAsOf(value,clock=()=>new Date()){
 const now=clock();
 if(!(now instanceof Date)||!Number.isFinite(now.getTime()))throw Error('STUDY_CLOCK_INVALID');
 if(value===null||value===undefined||String(value).trim()===''){
  return {asOf:new Date(now.getTime()),date:localDateString(now),
    origin:'CURRENT_CLOCK',issues:[],userSelected:false};
 }
 const day=String(value).trim();
 const valid=/^\d{4}-\d{2}-\d{2}$/.test(day);
 const date=valid?new Date(day+'T00:00:00.000Z'):new Date(NaN);
 if(!valid||!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==day)
  return {asOf:new Date(now.getTime()),date:now.toISOString().slice(0,10),
    origin:'FALLBACK_INVALID_DATE',issues:['VALUATION_DATE_INVALID'],userSelected:true};
 const endOfDay=new Date(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate(),23,59,59,999);
 if(day>localDateString(now))
  return {asOf:new Date(now.getTime()),date:now.toISOString().slice(0,10),
    origin:'FALLBACK_FUTURE_DATE',issues:['FUTURE_VALUATION_DATE_NOT_SUPPORTED'],userSelected:true};
 const asOf=day===localDateString(now)?new Date(now.getTime()):endOfDay;
 return {asOf,date:day,origin:'USER_VALUATION_DATE',
   issues:[],userSelected:true};
}
module.exports={resolveStudyAsOf,localDateString};
