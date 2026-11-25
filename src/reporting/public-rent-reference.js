'use strict';
// Public mirror snapshot, not authenticated individual lease evidence.
// Keep the publisher's metric labels: no inferred annualization, NLA or VAT.
const HEADER=['السنة','الربع','المنطقة','المدينة','الحي','نوع العقار','تصنيف العقار','عدد الصفقات','متوسط الايجار  ر.س','متوسط الايجار لكل متر مربع ر.س'];
const SOURCE='https://github.com/civillizard/Saudi-Real-Estate-Data/blob/main/rega/quarterlies/rental/Rental-indicators-in-Riyadh-region-1st-Q-2026.csv';
const norm=s=>s.trim().replace(/[أإآٱ]/g,'ا').replace(/\s+/g,' ').toLowerCase();
function parsePublicRentCsv(raw){
 if(typeof raw!=='string'||raw.length>2000000)throw Error('PUBLIC_RENT_SIZE');
 const rows=[];let row=[],v='',quoted=false,closed=false;
 const cell=()=>{row.push(v.trim());v='';closed=false;};
 const end=()=>{cell();if(row.some(Boolean))rows.push(row);row=[];};
 raw=raw.replace(/^\uFEFF/,'');
 for(let i=0;i<raw.length;i++){
  const c=raw[i];
  if(quoted){if(c==='"'){if(raw[i+1]==='"'){v+='"';i++;}else{quoted=false;closed=true;}}else v+=c;continue;}
  if(c===','){cell();continue;}
  if(c==='\r'||c==='\n'){if(c==='\r'&&raw[i+1]==='\n')i++;end();continue;}
  if(closed)throw Error('PUBLIC_RENT_QUOTE');
  if(c==='"'){if(v)throw Error('PUBLIC_RENT_QUOTE');quoted=true;}else v+=c;
 }
 if(quoted)throw Error('PUBLIC_RENT_QUOTE');if(row.length||v||closed)end();
 const h=rows.shift();if(!h||h.length!==HEADER.length||h.some((s,i)=>s!==HEADER[i]))throw Error('PUBLIC_RENT_HEADER');
 if(!rows.length||rows.length>20000)throw Error('PUBLIC_RENT_COUNT');
 const number=s=>{if(!/^\d+(\.\d+)?$/.test(s))return null;const n=Number(s);return Number.isFinite(n)?n:null;};
 return rows.map((r,i)=>{
  if(r.length!==10||!/^20\d{2}$/.test(r[0])||!/^[1-4]$/.test(r[1])||!r[2]||!r[3]||!r[5])throw Error('PUBLIC_RENT_ROW_'+(i+1));
  const count=number(r[7]),rent=number(r[8]),sqm=number(r[9]);
  return {year:Number(r[0]),quarter:Number(r[1]),region:r[2],city:r[3],district:r[4],kind:r[5],classification:r[6],count:Number.isSafeInteger(count)?count:null,reportedRentSar:rent>0?rent:null,reportedRentPerSqmSar:sqm>0?sqm:null,vatBasis:'UNKNOWN',sourceRow:i+2};
 });
}
function selectPublicRents(rows,city,district){
 if(!city?.trim()||!district?.trim())return [];
 const c=norm(city),d=norm(district);
 return rows.filter(r=>norm(r.city)===c&&r.district&&norm(r.district)===d);
}
module.exports={HEADER,SOURCE,parsePublicRentCsv,selectPublicRents};
