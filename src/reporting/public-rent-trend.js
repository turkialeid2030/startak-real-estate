'use strict';
// Compare source-reported aggregates, not a property valuation or price index.
const norm=s=>String(s??'').trim().replace(/[أإآٱ]/g,'ا').replace(/\s+/g,' ').toLowerCase();
const validPrice=n=>typeof n==='number'&&Number.isFinite(n)&&n>0;
function buildRentalTrend(rows,scope){
 if(!Array.isArray(rows)||!scope||!['region','city','district','kind','classification'].every(k=>typeof scope[k]==='string'&&scope[k].trim()))throw Error('TREND_SCOPE_REQUIRED');
 const matches=rows.filter(r=>['region','city','district','kind','classification'].every(k=>norm(r[k])===norm(scope[k])));
 const groups=new Map();
 for(const r of matches){const key=r.year+'-Q'+r.quarter;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);}
 const points=[...groups.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([period,items])=>{
  if(items.length!==1)return {period,count:null,rentSar:null,rentPerSqmSar:null,status:'AMBIGUOUS'};
  const r=items[0],enough=Number.isSafeInteger(r.count)&&r.count>=3;
  return {period,count:r.count,rentSar:enough&&validPrice(r.reportedRentSar)?r.reportedRentSar:null,rentPerSqmSar:enough&&validPrice(r.reportedRentPerSqmSar)?r.reportedRentPerSqmSar:null,status:!enough?'SMALL_SAMPLE':!validPrice(r.reportedRentSar)&&!validPrice(r.reportedRentPerSqmSar)?'NO_PRICE':'REPORTED_ONLY'};
 });
 // Adjacent year-on-year quarter comparison, no filling missing periods.
 const map=new Map(points.map(p=>[p.period,p]));
 const pct=(a,b)=>validPrice(a)&&validPrice(b)?Math.round((a/b-1)*10000)/100:null;
 return points.map(p=>{const [y,q]=p.period.split('-Q'),prior=map.get((Number(y)-1)+'-Q'+q);return {...p,priorYearPeriod:prior?.period??null,rentYoYPct:prior?pct(p.rentSar,prior.rentSar):null,rentPerSqmYoYPct:prior?pct(p.rentPerSqmSar,prior.rentPerSqmSar):null};});
}
module.exports={buildRentalTrend};
