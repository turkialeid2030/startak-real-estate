'use strict';
// District comparison matrix; no fabricated geographic coordinates or valuation.
const norm=s=>String(s??'').trim().replace(/[أإآٱ]/g,'ا').replace(/\s+/g,' ').toLowerCase();
function buildDistrictRentMatrix(rows,scope){
 if(!Array.isArray(rows)||!scope||!['region','city','kind','classification'].every(k=>typeof scope[k]==='string'&&scope[k].trim())||!Number.isInteger(scope.year)||![1,2,3,4].includes(scope.quarter))throw Error('DISTRICT_SCOPE_REQUIRED');
 const matches=rows.filter(r=>r.year===scope.year&&r.quarter===scope.quarter&&['region','city','kind','classification'].every(k=>norm(r[k])===norm(scope[k]))&&norm(r.district));
 const groups=new Map();
 for(const r of matches){const k=norm(r.district);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r);}
 const items=[...groups.values()].map(rs=>{
  const r=rs[0],valid=rs.length===1&&Number.isSafeInteger(r.count)&&r.count>=3&&Number.isFinite(r.reportedRentPerSqmSar)&&r.reportedRentPerSqmSar>0;
  return {district:r.district,count:rs.length===1?r.count:null,reportedRentPerSqmSar:valid?r.reportedRentPerSqmSar:null,status:rs.length!==1?'AMBIGUOUS':valid?'REPORTED_ONLY':'INSUFFICIENT'};
 });
 const prices=items.map(x=>x.reportedRentPerSqmSar).filter(x=>x!==null).sort((a,b)=>a-b);
 const lo=prices.length>=3?prices[0]:null,hi=prices.length>=3?prices.at(-1):null;
 return {scope:{...scope},districts:items.sort((a,b)=>a.district.localeCompare(b.district,'ar')).map(x=>({...x,relativeBand:x.reportedRentPerSqmSar===null||lo===null?null:hi===lo?2:Math.min(4,Math.floor(5*(x.reportedRentPerSqmSar-lo)/(hi-lo)))})),comparableDistricts:prices.length,geometryAvailable:false,valuationEligible:false};
}
module.exports={buildDistrictRentMatrix};
