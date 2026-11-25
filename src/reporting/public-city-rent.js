'use strict';
// City-level aggregates are not district metrics, individual leases or estimates.
const AR=['السنة','الربع','المنطقة','المدينة','نوع العقار','مجموع الصفقات','المتوسط'];
const EN=['year','quarter','region_ar','city_ar','Category','total_deals','average'];
function parseCityRent(raw,expectedRegion){
 if(typeof raw!=='string'||raw.length>2000000||typeof expectedRegion!=='string'||!expectedRegion.trim())throw Error('CITY_RENT_SCOPE');
 const lines=raw.replace(/^\uFEFF/,'').split(/\r?\n/).filter(x=>x.trim());
 const header=lines.shift()?.split(',').map(x=>x.trim());
 if(!header||![AR,EN].some(h=>h.length===header.length&&h.every((x,i)=>x===header[i])))throw Error('CITY_RENT_HEADER');
 if(!lines.length||lines.length>20000)throw Error('CITY_RENT_COUNT');
 return lines.map((line,i)=>{
  // Audited source uses simple CSV records; fail on any unexpected quoted or multiline schema.
  const r=line.split(',').map(x=>x.trim());
  if(r.length!==7||r.some(x=>!x||x.includes('"'))||!/^20(?:19|2[0-4])$/.test(r[0])||!/^[1-4]$/.test(r[1])||r[2]!==expectedRegion||!/^\d+$/.test(r[5])||!/^\d+(?:\.\d+)?$/.test(r[6]))throw Error('CITY_RENT_ROW_'+(i+2));
  const count=Number(r[5]),average=Number(r[6]);
  if(!Number.isSafeInteger(count)||count<1||!Number.isFinite(average)||average<=0)throw Error('CITY_RENT_VALUE_'+(i+2));
  return {year:Number(r[0]),quarter:Number(r[1]),region:r[2],city:r[3],category:r[4],reportedDealCount:count,reportedAverageSar:average,sourceRow:i+2,geographyLevel:'CITY',periodBasis:'UNKNOWN',vatBasis:'UNKNOWN',areaBasis:'UNKNOWN',propertyEstimateEligible:false};
 });
}
function cityRentSeries(rows,{region,city,category}={}){
 if(![region,city,category].every(x=>typeof x==='string'&&x.trim()))throw Error('CITY_RENT_SERIES_SCOPE');
 const groups=new Map();
 for(const r of rows){if(r.region!==region||r.city!==city||r.category!==category)continue;const p=r.year+'-Q'+r.quarter;if(!groups.has(p))groups.set(p,[]);groups.get(p).push(r);}
 return [...groups].sort(([a],[b])=>a.localeCompare(b)).map(([period,a])=>({period,reportedDealCount:a.length===1?a[0].reportedDealCount:null,reportedAverageSar:a.length===1&&a[0].reportedDealCount>=3?a[0].reportedAverageSar:null,status:a.length!==1?'AMBIGUOUS':a[0].reportedDealCount<3?'SMALL_SAMPLE':'REPORTED_ONLY'}));
}
module.exports={parseCityRent,cityRentSeries};
